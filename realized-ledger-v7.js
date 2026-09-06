(function(){
'use strict';
if(window.__JJOONI_REALIZED_LEDGER_V7)return;
window.__JJOONI_REALIZED_LEDGER_V7={state:'BOOTING',version:'7.3'};

const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='DB_TRADES';
const RECENT_DAYS=90;
const BATCH=6;
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase();
const acct=o=>String(o&&(o.account||o.account_type)||'UNKNOWN').trim().toUpperCase();
const side=o=>{const s=String(o&&o.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'};
const qty=o=>Math.abs(z(o&&(o.qty||o.quantity||o.filled_qty)));
const parseTs=o=>{const raw=String(o&&(o.filled_at_kst||o.trade_date||o.date)||'').trim();if(!raw)return 0;const x=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);return Number.isFinite(x)?x:0};
const esc=s=>String(s||'').replace(/'/g,"''");
function recentTrades(){const out=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}try{if(typeof D!=='undefined'&&Array.isArray(D.ai?.latest?.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}return out}
function targetGroups(){const cutoff=Date.now()-RECENT_DAYS*86400000,map=new Map();recentTrades().forEach(t=>{if(side(t)!=='SELL'||parseTs(t)<cutoff)return;const a=acct(t),ticker=sym(t.ticker||t.symbol);if(!ticker)return;const k=a+'|'+ticker;if(!map.has(k))map.set(k,{account:a,ticker})});return [...map.values()]}
function gviz(groups,tag,timeout=12000){
 return new Promise((resolve,reject)=>{
   const cb='__ctRealizedV73_'+tag+'_'+Date.now()+'_'+Math.random().toString(36).slice(2),clauses=groups.map(g=>`(C='${esc(g.account)}' and J='${esc(g.ticker)}')`);
   const tq=`select A,C,G,H,I,J,L,M,N,O,P,Q,R,S,T,U where U='FILLED' and (${clauses.join(' or ')})`;
   const url='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=responseHandler:'+cb+'&sheet='+encodeURIComponent(TAB)+'&tq='+encodeURIComponent(tq)+'&_='+Date.now();
   const s=document.createElement('script');let done=false,tm=null;
   const finish=(ok,v)=>{if(done)return;done=true;if(tm)clearTimeout(tm);try{s.remove()}catch(_){}try{delete window[cb]}catch(_){}ok?resolve(v):reject(v)};
   window[cb]=obj=>finish(true,obj);s.src=url;s.async=true;s.onerror=()=>finish(false,new Error('GVIZ_LOAD_FAILED:'+tag));(document.head||document.documentElement).appendChild(s);tm=setTimeout(()=>finish(false,new Error('GVIZ_TIMEOUT:'+tag)),timeout);
 });
}
function cell(row,i){return row&&row.c&&row.c[i]?row.c[i].v:null}
function rowsFrom(obj){const rows=[];for(const r of (obj&&obj.table&&obj.table.rows)||[]){rows.push({trade_key:String(cell(r,0)||''),account:String(cell(r,1)||'').toUpperCase(),trade_date:String(cell(r,2)||''),filled_at_kst:String(cell(r,3)||''),side:String(cell(r,4)||'').toUpperCase(),ticker:sym(cell(r,5)),name:String(cell(r,6)||''),qty:z(cell(r,7)),price:z(cell(r,8)),amount:z(cell(r,9)),currency:String(cell(r,10)||'KRW').toUpperCase(),fx:n(cell(r,11)),krw_amount:n(cell(r,12)),commission:z(cell(r,13)),tax:z(cell(r,14)),status:String(cell(r,15)||'')})}return rows}
async function loadTargets(targets){const all=[],failed=[];for(let i=0;i<targets.length;i+=BATCH){const batch=targets.slice(i,i+BATCH);try{const obj=await gviz(batch,'b'+i);all.push(...rowsFrom(obj));continue}catch(_){}for(let j=0;j<batch.length;j++){const g=batch[j];try{const obj=await gviz([g],'s'+i+'_'+j);all.push(...rowsFrom(obj))}catch(e){failed.push({group:g.account+'|'+g.ticker,error:String(e&&e.message||e)})}}}return {rows:all,failed}}
function rowMs(r){const raw=r.filled_at_kst||r.trade_date;const x=Date.parse(raw&&raw.length<=10?raw+'T00:00:00+09:00':raw);return Number.isFinite(x)?x:0}
function rowFx(r){if(r.currency!=='USD')return 1;return n(r.fx)||n(window.__JJOONI_FX_KRW_PER_USD)||null}
function grossKrw(r){if(n(r.krw_amount)!=null)return n(r.krw_amount);const fx=rowFx(r);if(fx==null)return null;const amount=n(r.amount)!=null?n(r.amount):z(r.qty)*z(r.price);return amount*fx}
function feeKrw(r){const fx=rowFx(r);return fx==null?null:(z(r.commission)+z(r.tax))*fx}
function ledger(rows,targets,failed){
 const targetSet=new Set(targets.map(g=>g.account+'|'+g.ticker)),seen=new Set(),groups=new Map();rows.forEach(r=>{const dk=r.trade_key||[r.account,r.trade_date,r.filled_at_kst,r.side,r.ticker,r.qty,r.price].join('|');if(seen.has(dk))return;seen.add(dk);const k=r.account+'|'+r.ticker;if(!targetSet.has(k))return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
 const cutoff=Date.now()-RECENT_DAYS*86400000,byGroup={},byTicker={},uncovered=[];let total=0,recentSells=0,covered=0;
 groups.forEach((arr,k)=>{arr.sort((a,b)=>rowMs(a)-rowMs(b));let inv=0,avgKrw=0,gap=false,realized=0,groupRecent=0,groupCovered=0;for(const r of arr){const q=Math.abs(z(r.qty));if(!(q>0))continue;const gross=grossKrw(r),fees=feeKrw(r);if(gross==null||fees==null){if(side(r)==='SELL'&&rowMs(r)>=cutoff){groupRecent++;gap=true}continue}if(side(r)==='BUY'){const cost=gross+fees;avgKrw=inv>1e-10?(inv*avgKrw+cost)/(inv+q):cost/q;inv+=q}else if(side(r)==='SELL'){const recent=rowMs(r)>=cutoff;if(recent)groupRecent++;if(inv+1e-8<q){if(recent)gap=true;continue}const pnl=(gross-fees)-(avgKrw*q);if(recent){realized+=pnl;groupCovered++}inv=Math.max(0,inv-q);if(inv<1e-10){inv=0;avgKrw=0}}}if(groupRecent){const cut=k.indexOf('|'),account=k.slice(0,cut),ticker=k.slice(cut+1),complete=groupCovered===groupRecent&&!gap;byGroup[k]={account,ticker,realized_krw:realized,recent_sell_count:groupRecent,covered_sell_count:groupCovered,complete,ending_qty:inv};if(!byTicker[ticker])byTicker[ticker]={ticker,realized_krw:0,recent_sell_count:0,covered_sell_count:0,complete:true};byTicker[ticker].realized_krw+=realized;byTicker[ticker].recent_sell_count+=groupRecent;byTicker[ticker].covered_sell_count+=groupCovered;byTicker[ticker].complete=byTicker[ticker].complete&&complete;total+=realized;recentSells+=groupRecent;covered+=groupCovered;if(!complete)uncovered.push({group:k,recent_sell_count:groupRecent,covered_sell_count:groupCovered,reason:'COST_BASIS_GAP'})}});
 targets.forEach(g=>{const k=g.account+'|'+g.ticker;if(!byGroup[k])uncovered.push({group:k,recent_sell_count:null,covered_sell_count:0,reason:'NO_LEDGER_ROWS'})});(failed||[]).forEach(x=>uncovered.push({...x,reason:'QUERY_FAILED'}));return {by_group:byGroup,by_ticker:byTicker,total_realized_krw:total,recent_sell_count:recentSells,covered_sell_count:covered,uncovered_sell_count:Math.max(0,recentSells-covered)+(failed||[]).length,uncovered_groups:uncovered}
}
async function run(){const targets=targetGroups(),source=recentTrades(),dates=source.map(parseTs).filter(Boolean).sort((a,b)=>a-b);if(!targets.length){window.__JJOONI_REALIZED_LEDGER_V7={state:'ACTIVE',version:'7.3',targets:0,coverage_scope:'RECENT_UI_TRADE_GROUPS',source_trade_count:source.length,total_realized_krw:0,recent_sell_count:0,covered_sell_count:0,uncovered_sell_count:0,by_group:{},by_ticker:{}};document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'));return}window.__JJOONI_REALIZED_LEDGER_V7={state:'LOADING',version:'7.3',targets:targets.length,coverage_scope:'RECENT_UI_TRADE_GROUPS',source_trade_count:source.length};try{const loaded=await loadTargets(targets),out=ledger(loaded.rows,targets,loaded.failed);window.__JJOONI_REALIZED_LEDGER_V7={state:'ACTIVE',version:'7.3',targets:targets.length,ledger_rows:loaded.rows.length,failed_group_count:loaded.failed.length,failed_groups:loaded.failed,coverage_scope:'RECENT_UI_TRADE_GROUPS',coverage_note:'최근 화면 거래에 등장한 매도 종목군의 DB_TRADES 전체 원가이력 복원',source_trade_count:source.length,source_earliest_kst:dates.length?new Date(dates[0]).toISOString():null,source_latest_kst:dates.length?new Date(dates[dates.length-1]).toISOString():null,method:'TARGETED_FULL_LEDGER_WEIGHTED_AVG_KRW_ESTIMATE',fees_and_tax:true,fx_basis:'TRADE_ROW_FX',...out}}catch(e){window.__JJOONI_REALIZED_LEDGER_V7={state:'ERROR',version:'7.3',targets:targets.length,error:String(e&&e.message||e)}}document.dispatchEvent(new CustomEvent('jjooni:realized-ledger'))}
function boot(){if(typeof D==='undefined'||!window.__JJOONI_CANONICAL_SSOT){setTimeout(boot,300);return}run()}setTimeout(boot,0);
})();
