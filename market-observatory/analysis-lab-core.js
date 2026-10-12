(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JJOONIAnalysisCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const number=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const iso=d=>d.toISOString().slice(0,10);
function periodEnd(raw,frequency){const date=new Date(String(raw).slice(0,10)+'T00:00:00Z');if(!Number.isFinite(+date))return null;if(frequency==='monthly')return iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)));if(frequency==='quarterly')return iso(new Date(Date.UTC(date.getUTCFullYear(),Math.floor(date.getUTCMonth()/3)*3+3,0)));return iso(date);}
function resample(rows,frequency='monthly',aggregation='last',end='9999-12-31'){
 const buckets=new Map();
 for(const row of [...rows].sort((a,b)=>a.date.localeCompare(b.date))){const v=number(row.value);if(v==null||row.date>end)continue;let key=row.date,date=row.date;
  if(frequency==='monthly'){key=row.date.slice(0,7);date=periodEnd(row.date,'monthly');}
  if(frequency==='weekly'){const d=new Date(row.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+((7-d.getUTCDay())%7));key=iso(d);date=key;}
  const bucket=buckets.get(key)||{key,date:date>end?end:date,values:[],sourceDates:[],partial:date>end};bucket.values.push(v);bucket.sourceDates.push(row.date);buckets.set(key,bucket);
 }
 return [...buckets.values()].map(b=>({date:b.date,key:b.key,value:aggregation==='mean'?b.values.reduce((a,v)=>a+v,0)/b.values.length:b.values[b.values.length-1],sourceDate:b.sourceDates[b.sourceDates.length-1],partial:b.partial}));
}
function transform(rows,mode='raw',smooth=1){
 const xs=rows.map(r=>({...r}));const values=xs.map(r=>r.value);const first=values.find(v=>number(v)!=null);const mean=values.length?values.reduce((a,v)=>a+v,0)/values.length:0;const sd=values.length?Math.sqrt(values.reduce((a,v)=>a+(v-mean)**2,0)/values.length):0;let high=-Infinity;
 xs.forEach((r,i)=>{const v=r.value;high=Math.max(high,v);r.value=mode==='index'?(first===0?null:v/first*100):mode==='cumulative'?(first===0?null:(v/first-1)*100):mode==='return'?(i===0||values[i-1]===0?null:(v/values[i-1]-1)*100):mode==='change'?(i===0?null:v-values[i-1]):mode==='zscore'?(sd===0?null:(v-mean)/sd):mode==='drawdown'?(high<=0?null:(v/high-1)*100):v;});
 const window=Math.max(1,Math.min(120,Number(smooth)||1));if(window>1){const transformed=xs.map(r=>r.value);xs.forEach((r,i)=>{const part=transformed.slice(Math.max(0,i-window+1),i+1);r.value=part.length===window&&part.every(v=>number(v)!=null)?part.reduce((a,v)=>a+v,0)/window:null;});}
 return xs.filter(r=>number(r.value)!=null);
}
function align(x,y,lag=0){const ym=new Map(y.map(r=>[r.key||r.date,r]));const paired=x.filter(r=>ym.has(r.key||r.date)).map(r=>({date:r.date,x:r.value,y:ym.get(r.key||r.date).value,xDate:r.sourceDate||r.date,yDate:ym.get(r.key||r.date).sourceDate||ym.get(r.key||r.date).date}));const n=Math.max(-24,Math.min(24,Math.trunc(Number(lag)||0)));if(!n)return paired;const out=[];for(let i=0;i<paired.length;i++){const j=i+n;if(j<0||j>=paired.length)continue;out.push({...paired[j],x:paired[i].x,xDate:paired[i].xDate});}return out;}
function correlation(points){const n=points.length;if(n<3)return null;const mx=points.reduce((a,p)=>a+p.x,0)/n,my=points.reduce((a,p)=>a+p.y,0)/n;let xy=0,xx=0,yy=0;for(const p of points){xy+=(p.x-mx)*(p.y-my);xx+=(p.x-mx)**2;yy+=(p.y-my)**2;}return xx===0||yy===0?null:Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)));}
function rollingCorrelation(points,window=20){window=Math.max(3,Math.min(120,Number(window)||20));return points.map((p,i)=>({date:p.date,value:i+1<window?null:correlation(points.slice(i-window+1,i+1))})).filter(r=>r.value!=null);}
function prepare(rows,config,start,end,frequency,aggregation){return transform(resample(rows.filter(r=>r.date>=start&&r.date<=end),frequency,aggregation,end),config.mode,config.smooth);}
return {number,periodEnd,resample,transform,align,correlation,rollingCorrelation,prepare};
});
