/* Price-index analytics. Calendar time for CAGR; observed samples for drawdown. */
(function(root){
'use strict';
const DAY=86400000,YEAR=365.2425*DAY;
function clean(rows){const m=new Map();for(const p of rows||[])if(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(Date.parse(p.date))&&p.value!==null&&p.value!==''&&Number.isFinite(Number(p.value))&&Number(p.value)>0)m.set(p.date,Number(p.value));return [...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));}
function years(a,b){return (Date.parse(b)-Date.parse(a))/YEAR;}
function annual(rows){rows=clean(rows);const last=new Map();for(const p of rows)last.set(p.date.slice(0,4),p);return [...last].map(([year,end])=>{const prev=last.get(String(Number(year)-1));return {year,value:(end.value/(prev?.value||rows[0].value)-1)*100,partial:!prev||end.date===rows.at(-1).date&&end.date.slice(5,7)!=='12'};});}
function summary(rows){rows=clean(rows);if(rows.length<2)return null;const first=rows[0],last=rows.at(-1),elapsed=years(first.date,last.date);let peak=first.value,mdd=0;for(const p of rows){peak=Math.max(peak,p.value);mdd=Math.min(mdd,(p.value/peak-1)*100);}const complete=annual(rows).filter(x=>!x.partial);return {start:first.date,end:last.date,count:rows.length,total:(last.value/first.value-1)*100,cagr:elapsed>=1?(Math.pow(last.value/first.value,1/elapsed)-1)*100:null,mdd,mean:complete.length?complete.reduce((s,p)=>s+p.value,0)/complete.length:null,sparse:rows.some((p,i)=>i&&(Date.parse(p.date)-Date.parse(rows[i-1].date))/DAY>10)};}
function transform(rows,mode){rows=clean(rows);if(!rows.length)return [];let peak=rows[0].value;return rows.map(p=>{peak=Math.max(peak,p.value);const y=years(rows[0].date,p.date),ratio=p.value/rows[0].value;return {date:p.date,value:mode==='raw'?p.value:mode==='base'?ratio*100:mode==='drawdown'?(p.value/peak-1)*100:mode==='cagr'?(y>=1?(Math.pow(ratio,1/y)-1)*100:null):(ratio-1)*100};});}
const api={clean,years,annual,summary,transform};root.ObsIndexMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
