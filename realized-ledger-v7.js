(function(){
'use strict';
if(window.__JJOONI_REALIZED_LEDGER_V7)return;
window.__JJOONI_REALIZED_LEDGER_V7={state:'BOOTING',version:'7.2'};

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='DB_TRADES';
const RECENT_DAYS=90;
const BATCH=5;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase();
const sideText=v=>{const s=String(v||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const esc=s=>String(s||'').replace(/'/g,"''");
function cell(row,i){return row&&row.c&&row.c[i]?row.c[i].v:null}
function parseMs(raw){const s=String(raw||'').trim();if(!s)return 0;const x=Date.parse(s.length<=10?s+'T00:00:00+09:00':s);return Number.isFinite(x)?x:0}
function kstDate(ms){const d=new Date(ms+9*3600000);return d.toISOString().slice(0,10)}
function gviz(tq,tag,timeout=15000){
 return new Promise((resolve,reject)=>{
   const cb='__ctRealizedV72_'+tag+'_'+Date.now()+'_'+Math.random().toString(36).slice(2);
   const url='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx='+encodeURIComponent('responseHandler:'+cb)+'&sheet='+encodeURIComponent(TAB)+'&tq='+encodeURIComponent(tq)+'&_='+Date.now();
   const s=document.createElement('script');let done=false,tm=null;
   const finish=(ok,v)=>{if(done)return;done=true;if(tm)clearTimeout(tm);try{s.remove()}catch(_){}try{delete window[cb]}catch(_){}ok?resolve(v):reject(v)};
   window[cb]=obj=>{
     try{
       if(!obj||obj.status==='error'||!obj.table){const msg=((obj&&obj.errors)||[]).map(e=>e&&e.message||'').filter(Boolean).join(' / ')||'GVIZ_RESPONSE_ERROR';return finish(false,new Error(msg))}
       finish(true,obj);
     }catch(e){finish(false,e)}
   };
   s.src=url;s.async=true;s.onerror=()=>finish(false,new Error('GVIZ_LOAD_FAILED:'+tag));(document.head||document.documentElement).appendChild(s);
   tm=setTimeout(()=>finish(false,new Error('GVIZ_TIMEOUT:'+tag)),timeout);
 });
}

async function discoverTargets(){
 const cutoff=Date.now()-RECENT_DAYS*86400000,date=kstDate(cutoff);
 // Deliberately avoid WHERE on date/side/status here. DB_TRADES has mixed text/date values;
 // a narrow 5-column scan is more reliable and still far lighter than pulling the full ledger.
 const obj=await gviz('select C,G,I,J,U','discover_scan',20000);
 const rows=(obj.table&&obj.table.rows)||[],map=new Map();let sellRows=0,filledRows=0;
 for(const r of rows){
   const account=String(cell(r,0)||'').trim().toUpperCase(),rawDate=cell(r,1),side=sideText(cell(r,2)),ticker=sym(cell(r,3)),status=String(cell(r,4)||'').trim().toUpperCase();
   if(!account||!ticker)continue;
   if(status&&status!=='FILLED'&&!status.includes('체결'))continue;
   filledRows++;
   const ms=parseMs(rawDate);if(side!=='SELL'||!ms||ms<cutoff)continue;
   sellRows++;const k=account+'|'+ticker;if(!map.has(k))map.set(k,{account,ticker});
 }
 return {targets:[...map.values()],sell_rows:sellRows,source:'DB_TRADES_5COL_SCAN',cutoff_date:date,scanned_rows:rows.length,filled_rows:filledRows};
}
function fullQuery(groups){
 const clauses=groups.map(g=>`(C='${esc(g.account)}' and J='${esc(g.ticker)}')`);
 return `select A,C,G,H,I,J,L,M,N,O,P,Q,R,S,T,U where ${clauses.join(' or ')}`;
}
function rowsFrom(obj){
 const rows=[];for(const r of (obj&&obj.table&&obj.table.rows)||[]){
   const status=String(cell(r,15)||'').trim();if(status&&status.toUpperCase()!=='FILLED'&&!status.includes('체결'))continue;
   rows.push({trade_key:String(cell(r,0)||''),account:String(cell(r,1)||'').trim().toUpperCase(),trade_date:String(cell(r,2)||''),filled_at_kst:String(cell(r,3)||''),side:String(cell(r,4)||'').toUpperCase(),ticker:sym(cell(r,5)),name:String(cell(r,6)||''),qty:z(cell(r,7)),price:z(cell(r,8)),amount:z(cell(r,9)),currency:String(cell(r,10)||'KRW').toUpperCase(),fx:n(cell(r,11)),krw_amount:n(cell(r,12)),commission:z(cell(r,13)),tax:z(cell(r,14)),status});
 }return rows;
}
async function loadGroups(targets){
 const all=[],failed=[];
 for(let i=0;i<targets.length;i+=BATCH){
   const batch=targets.slice(i,i+BATCH);
   try{const obj=await gviz(fullQuery(batch),'batch_'+(i/BATCH),15000);all.push(...rowsFrom(obj));continue}catch(e){}
   // Batch query may fail because of one mixed-type ticker. Retry each group independently.
   for(let j=0;j<batch.length;j++){
     const g=batch[j];
     try{const obj=await gviz(fullQuery([g]),'single_'+i+'_'+j,12000);all.push(...rowsFrom(obj))}
     catch(e){failed.push({group:g.account+'|'+g.ticker,error:String(e&&e.message||e)})}
   }
 }
 return {rows:all,failed};
}
function rowMs(r){return parseMs(r.filled_at_kst||r.trade_date)}
function rowFx(r){if(r.currency!=='USD')return 1;return n(r.fx)||n(window.__JJOONI_FX_KRW_PER_USD)||null}
function grossKrw(r){if(n(r.krw_amount)!=null)return n(r.krw_amount);const fx=rowFx(r);if(fx==null)return null;const amount=n(r.amount)!=null?n(r.amount):z(r.qty)*z(r.price);return amount*fx}
function feeKrw(r){const fx=rowFx(r);return fx==null?null:(z(r.commission)+z(r.tax))*fx}
function ledger(rows,targets,expectedSellRows,failedGroups){
 const targetSet=new Set(targets.map(g=>g.account+'|'+g.ticker)),seen=new Set(),groups=new Map();
 rows.forEach(r=>{const fallback=[r.account,r.trade_date,r.filled_at_kst,r.side,r.ticker,r.qty,r.price].join('|'),dk=r.trade_key||fallback;if(seen.has(dk))return;seen.add(dk);const k=r.account+'|'+r.ticker;if(!targetSet.has(k))return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
 const cutoff=Date.now()-RECENT_DAYS*86400000,byGroup={},byTicker={},uncovered=[];let total=0,recentSells=0,covered=0;
 groups.forEach((arr,k)=>{
   arr.sort((a,b)=>rowMs(a)-rowMs(b));let inv=0,avgKrw=0,gap=false,realized=0,groupRecent=0,groupCovered=0;
   for(const r of arr){
     const q=Math.abs(z(r.qty));if(!(q>0))continue;const gross=grossKrw(r),fees=feeKrw(r),sd=sideText(r.side);
     if(gross==null||fees==null){if(sd==='SELL'&&rowMs(r)>=cutoff){groupRecent++;gap=true}continue}
     if(sd==='BUY'){
       const cost=gross+fees;avgKrw=inv>1e-10?(inv*avgKrw+cost)/(inv+q):cost/q;inv+=q;
     }else if(sd==='SELL'){
       const recent=rowMs(r)>=cutoff;if(recent)groupRecent++;
       if(inv+1e-8<q){if(recent)gap=true;continue}
       const pnl=(gross-fees)-(avgKrw*q);if(recent){realized+=pnl;groupCovered++}
       inv=Math.max(0,inv-q);if(inv<1e-10){inv=0;avgKrw=0}
     }
   }
   if(groupRecent){
     const cut=k.indexOf('|'),account=k.slice(0,cut),ticker=k.slice(cut+1),complete=groupCovered===groupRecent&&!gap;
     byGroup[k]={account,ticker,realized_krw:realized,recent_sell_count:groupRecent,covered_sell_count:groupCovered,complete,ending_qty:inv};
     if(!byTicker[ticker])byTicker[ticker]={ticker,realized_krw:0,recent_sell_count:0,covered_sell_count:0,complete:true};
     byTicker[ticker].realized_krw+=realized;byTicker[ticker].recent_sell_count+=groupRecent;byTicker[ticker].covered_sell_count+=groupCovered;byTicker[ticker].complete=byTicker[ticker].complete&&complete;
     total+=realized;recentSells+=groupRecent;covered+=groupCovered;if(!complete)uncovered.push({group:k,recent_sell_count:groupRecent,covered_sell_count:groupCovered,reason:gap?'COST_BASIS_GAP':'PARTIAL'});
   }
 });
 targets.forEach(g=>{const k=g.account+'|'+g.ticker;if(!byGroup[k])uncovered.push({group:k,recent_sell_count:null,covered_sell_count:0,reason:'NO_LEDGER_ROWS'})});
 (failedGroups||[]).forEach(x=>uncovered.push({...x,reason:'QUERY_FAILED'}));
 return {by_group:byGroup,by_ticker:byTicker,total_realized_krw:total,recent_sell_count:recentSells,covered_sell_count:covered,uncovered_sell_count:Math.max(0,(expectedSellRows||recentSells)-covered),uncovered_groups:uncovered,discovery_sell_rows:expectedSellRows,discovery_count_matches:expectedSellRows==null?null:recentSells===expectedSellRows};
}
async function run(){
 window.__JJOONI_REALIZED_LEDGER_V7={state:'DISCOVERING',version:'7.2'};
 try{
   const d=await discoverTargets(),targets=d.targets;
   if(!targets.length){window.__JJOONI_REALIZED_LEDGER_V7={state:'ACTIVE',version:'7.2',targets:0,discovery_source:d.source,discovery_sell_rows:d.sell_rows,discovery_count_matches:d.sell_rows===0,scanned_rows:d.scanned_rows,total_realized_krw:0,recent_sell_count:0,covered_sell_count:0,uncovered_sell_count:0,by_group:{},by_ticker:{},uncovered_groups:[]};document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'));return}
   window.__JJOONI_REALIZED_LEDGER_V7={state:'LOADING',version:'7.2',targets:targets.length,discovery_source:d.source,discovery_sell_rows:d.sell_rows,cutoff_date:d.cutoff_date,scanned_rows:d.scanned_rows};
   const loaded=await loadGroups(targets),out=ledger(loaded.rows,targets,d.sell_rows,loaded.failed);
   const state=loaded.failed.length?'PARTIAL':'ACTIVE';
   window.__JJOONI_REALIZED_LEDGER_V7={state,version:'7.2',targets:targets.length,ledger_rows:loaded.rows.length,failed_group_count:loaded.failed.length,failed_groups:loaded.failed,discovery_source:d.source,discovery_sell_rows:d.sell_rows,cutoff_date:d.cutoff_date,scanned_rows:d.scanned_rows,method:'FULL_LEDGER_WEIGHTED_AVG_KRW_ESTIMATE',fees_and_tax:true,fx_basis:'TRADE_ROW_FX',...out};
 }catch(e){window.__JJOONI_REALIZED_LEDGER_V7={state:'ERROR',version:'7.2',error:String(e&&e.message||e)}}
 document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'));
}
function boot(){if(typeof D==='undefined'||!window.__JJOONI_CANONICAL_SSOT){setTimeout(boot,300);return}run()}
setTimeout(boot,0);
})();
