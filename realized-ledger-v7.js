(function(){
'use strict';
if(window.__JJOONI_REALIZED_LEDGER_V7)return;
window.__JJOONI_REALIZED_LEDGER_V7={state:'BOOTING',version:'7.1'};

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='DB_TRADES';
const RECENT_DAYS=90;
const BATCH=6;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase();
const sideText=v=>{const s=String(v||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const esc=s=>String(s||'').replace(/'/g,"''");
function cell(row,i){return row&&row.c&&row.c[i]?row.c[i].v:null}
function kstDate(ms){const d=new Date(ms+9*3600000);return d.toISOString().slice(0,10)}
function gviz(tq,tag){
 return new Promise((resolve,reject)=>{
   const cb='__ctRealizedV71_'+tag+'_'+Date.now()+'_'+Math.random().toString(36).slice(2);
   const url='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=responseHandler:'+cb+'&sheet='+encodeURIComponent(TAB)+'&tq='+encodeURIComponent(tq)+'&_='+Date.now();
   const s=document.createElement('script');let done=false;
   const finish=(ok,v)=>{if(done)return;done=true;clearTimeout(tm);try{s.remove()}catch(_){}try{delete window[cb]}catch(_){}ok?resolve(v):reject(v)};
   window[cb]=obj=>finish(true,obj);s.src=url;s.async=true;s.onerror=()=>finish(false,new Error('GVIZ_LOAD_FAILED'));(document.head||document.documentElement).appendChild(s);
   const tm=setTimeout(()=>finish(false,new Error('GVIZ_TIMEOUT')),12000);
 });
}
async function discoverTargets(){
 const cutoff=Date.now()-RECENT_DAYS*86400000,date=kstDate(cutoff);
 let obj,source='DB_TRADES_RECENT_SELL_QUERY';
 try{obj=await gviz(`select C,G,J where U='FILLED' and I='SELL' and G >= date '${date}'`,'discover')}catch(e){obj=null}
 let rows=(obj&&obj.table&&obj.table.rows)||[],map=new Map(),sellRows=0;
 rows.forEach(r=>{const account=String(cell(r,0)||'').toUpperCase(),ticker=sym(cell(r,2));if(!account||!ticker)return;sellRows++;const k=account+'|'+ticker;if(!map.has(k))map.set(k,{account,ticker})});
 if(map.size)return {targets:[...map.values()],sell_rows:sellRows,source,cutoff_date:date};
 source='DB_TRADES_ALL_SELL_FALLBACK';
 obj=await gviz("select C,G,J where U='FILLED' and I='SELL'",'discover_all');rows=(obj&&obj.table&&obj.table.rows)||[];map=new Map();sellRows=0;
 rows.forEach(r=>{const raw=String(cell(r,1)||''),ms=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);if(!Number.isFinite(ms)||ms<cutoff)return;const account=String(cell(r,0)||'').toUpperCase(),ticker=sym(cell(r,2));if(!account||!ticker)return;sellRows++;const k=account+'|'+ticker;if(!map.has(k))map.set(k,{account,ticker})});
 return {targets:[...map.values()],sell_rows:sellRows,source,cutoff_date:date};
}
function loadBatch(groups,idx){
 const clauses=groups.map(g=>`(C='${esc(g.account)}' and J='${esc(g.ticker)}')`);
 const tq=`select A,C,G,H,I,J,L,M,N,O,P,Q,R,S,T,U where U='FILLED' and (${clauses.join(' or ')})`;
 return gviz(tq,'batch_'+idx);
}
function rowsFrom(obj){
 const rows=[];for(const r of (obj&&obj.table&&obj.table.rows)||[]){rows.push({trade_key:String(cell(r,0)||''),account:String(cell(r,1)||'').toUpperCase(),trade_date:String(cell(r,2)||''),filled_at_kst:String(cell(r,3)||''),side:String(cell(r,4)||'').toUpperCase(),ticker:sym(cell(r,5)),name:String(cell(r,6)||''),qty:z(cell(r,7)),price:z(cell(r,8)),amount:z(cell(r,9)),currency:String(cell(r,10)||'KRW').toUpperCase(),fx:n(cell(r,11)),krw_amount:n(cell(r,12)),commission:z(cell(r,13)),tax:z(cell(r,14)),status:String(cell(r,15)||'')})}return rows;
}
function rowMs(r){const raw=r.filled_at_kst||r.trade_date;const x=Date.parse(raw&&raw.length<=10?raw+'T00:00:00+09:00':raw);return Number.isFinite(x)?x:0}
function rowFx(r){if(r.currency!=='USD')return 1;return n(r.fx)||n(window.__JJOONI_FX_KRW_PER_USD)||null}
function grossKrw(r){if(n(r.krw_amount)!=null)return n(r.krw_amount);const fx=rowFx(r);if(fx==null)return null;const amount=n(r.amount)!=null?n(r.amount):z(r.qty)*z(r.price);return amount*fx}
function feeKrw(r){const fx=rowFx(r);return fx==null?null:(z(r.commission)+z(r.tax))*fx}
function ledger(rows,targets,expectedSellRows){
 const targetSet=new Set(targets.map(g=>g.account+'|'+g.ticker)),seen=new Set(),groups=new Map();
 rows.forEach(r=>{if(!r.trade_key||seen.has(r.trade_key))return;seen.add(r.trade_key);const k=r.account+'|'+r.ticker;if(!targetSet.has(k))return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
 const cutoff=Date.now()-RECENT_DAYS*86400000,byGroup={},byTicker={},uncovered=[];let total=0,recentSells=0,covered=0;
 groups.forEach((arr,k)=>{
   arr.sort((a,b)=>rowMs(a)-rowMs(b));let inv=0,avgKrw=0,gap=false,realized=0,groupRecent=0,groupCovered=0;
   for(const r of arr){const q=Math.abs(z(r.qty));if(!(q>0))continue;const gross=grossKrw(r),fees=feeKrw(r);if(gross==null||fees==null){if(sideText(r.side)==='SELL'&&rowMs(r)>=cutoff){groupRecent++;gap=true}continue}
     if(sideText(r.side)==='BUY'){const cost=gross+fees;avgKrw=inv>1e-10?(inv*avgKrw+cost)/(inv+q):cost/q;inv+=q}
     else if(sideText(r.side)==='SELL'){const recent=rowMs(r)>=cutoff;if(recent)groupRecent++;if(inv+1e-8<q){if(recent)gap=true;continue}const pnl=(gross-fees)-(avgKrw*q);if(recent){realized+=pnl;groupCovered++}inv=Math.max(0,inv-q);if(inv<1e-10){inv=0;avgKrw=0}}
   }
   if(groupRecent){const cut=k.indexOf('|'),account=k.slice(0,cut),ticker=k.slice(cut+1);byGroup[k]={account,ticker,realized_krw:realized,recent_sell_count:groupRecent,covered_sell_count:groupCovered,complete:groupCovered===groupRecent&&!gap,ending_qty:inv};if(!byTicker[ticker])byTicker[ticker]={ticker,realized_krw:0,recent_sell_count:0,covered_sell_count:0,complete:true};byTicker[ticker].realized_krw+=realized;byTicker[ticker].recent_sell_count+=groupRecent;byTicker[ticker].covered_sell_count+=groupCovered;byTicker[ticker].complete=byTicker[ticker].complete&&(groupCovered===groupRecent&&!gap);total+=realized;recentSells+=groupRecent;covered+=groupCovered;if(groupCovered<groupRecent)uncovered.push({group:k,recent_sell_count:groupRecent,covered_sell_count:groupCovered})}
 });
 targets.forEach(g=>{const k=g.account+'|'+g.ticker;if(!byGroup[k])uncovered.push({group:k,recent_sell_count:null,covered_sell_count:0,reason:'NO_LEDGER_ROWS'})});
 const discoveryMismatch=expectedSellRows!=null&&recentSells!==expectedSellRows;
 return {by_group:byGroup,by_ticker:byTicker,total_realized_krw:total,recent_sell_count:recentSells,covered_sell_count:covered,uncovered_sell_count:Math.max(0,recentSells-covered),uncovered_groups:uncovered,discovery_sell_rows:expectedSellRows,discovery_count_matches:!discoveryMismatch};
}
async function run(){
 window.__JJOONI_REALIZED_LEDGER_V7={state:'DISCOVERING',version:'7.1'};
 try{
   const d=await discoverTargets(),targets=d.targets;
   if(!targets.length){window.__JJOONI_REALIZED_LEDGER_V7={state:'ACTIVE',version:'7.1',targets:0,discovery_source:d.source,discovery_sell_rows:d.sell_rows,total_realized_krw:0,recent_sell_count:0,covered_sell_count:0,uncovered_sell_count:0,by_group:{},by_ticker:{}};document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'));return}
   window.__JJOONI_REALIZED_LEDGER_V7={state:'LOADING',version:'7.1',targets:targets.length,discovery_source:d.source,discovery_sell_rows:d.sell_rows,cutoff_date:d.cutoff_date};
   const all=[];for(let i=0;i<targets.length;i+=BATCH){const obj=await loadBatch(targets.slice(i,i+BATCH),i/BATCH);all.push(...rowsFrom(obj))}
   const out=ledger(all,targets,d.sell_rows);window.__JJOONI_REALIZED_LEDGER_V7={state:'ACTIVE',version:'7.1',targets:targets.length,ledger_rows:all.length,discovery_source:d.source,discovery_sell_rows:d.sell_rows,cutoff_date:d.cutoff_date,method:'FULL_LEDGER_WEIGHTED_AVG_KRW_ESTIMATE',fees_and_tax:true,fx_basis:'TRADE_ROW_FX',...out};
 }catch(e){window.__JJOONI_REALIZED_LEDGER_V7={state:'ERROR',version:'7.1',error:String(e&&e.message||e)}}
 document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'));
}
function boot(){if(typeof D==='undefined'||!window.__JJOONI_CANONICAL_SSOT){setTimeout(boot,300);return}run()}
setTimeout(boot,0);
})();
