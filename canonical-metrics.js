(function(root){
'use strict';
// Shared display contract. No trading decisions; browser may load the separate
// read-only FAST refresh client after the pure metrics API is installed.
const IDS=['TOSS','ISA','PENSION','IRP'];
const accountOwner=id=>String(id||'').toUpperCase()==='TRIPOD'?'TOSS':String(id||'').toUpperCase();
const number=v=>{if(v==null||typeof v==='boolean'||typeof v==='object'||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const first=(o,keys)=>{for(const k of keys){const x=number(o?.[k]);if(x!=null)return x}return null};
const sum=xs=>xs.length&&xs.every(x=>number(x)!=null)?xs.reduce((s,x)=>s+Number(x),0):null;
const positions=a=>(a?.positions||[]).filter(p=>!['CASH','CASH_EQUIVALENT','WATCHLIST'].includes(String(p.record_type||'POSITION').toUpperCase()));
const currency=p=>String(p?.currency||(String(p?.market||'').toUpperCase()==='US'?'USD':'KRW')).toUpperCase();
function fx(a,p){const x=first(p,['fx','fx_krw_per_usd'])??first(a,['fx_krw_per_usd','fx']);return x!=null&&x>0?x:null}
function valueKrw(p,a){
 const explicit=first(p,['market_value_krw','value_krw','market_value_krw_equiv','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw']);if(explicit!=null)return explicit;
 const mv=number(p?.market_value);
 // CT canonical market_value is KRW; native broker value uses `value`.
 if(mv!=null&&String(p.market_value_currency||'KRW').toUpperCase()==='KRW')return mv;
 const native=first(p,['value','market_value']),f=fx(a,p);
 if(native!=null)return currency(p)==='USD'?(f==null?null:native*f):native;
 const q=first(p,['qty','quantity','held_qty']),px=first(p,['current_price','price','last_price']);
 if(q==null||px==null)return null;
 return currency(p)==='USD'?(f==null?null:q*px*f):q*px;
}
function cash(a){
 const direct=first(a,['cash_krw_equiv','cash_total_krw']);if(direct!=null)return direct;
 const kr=number(a?.cash_krw),us=number(a?.cash_usd);
 if(us==null)return kr;
 const usdKrw=number(a?.cash_usd_krw),f=fx(a);
 if(kr==null||us!==0&&usdKrw==null&&f==null)return null;
 return kr+(usdKrw??(us===0?0:us*f));
}
function stock(a){const ps=positions(a);return ps.length?sum(ps.map(p=>valueKrw(p,a))):Array.isArray(a?.positions)?0:null}
function previous(a){const explicit=first(a,['previous_nav','previous_nav_krw','baseline_nav']);if(explicit!=null)return explicit;const nav=number(a?.nav),day=number(a?.today_pnl),flow=number(a?.net_flow);return nav!=null&&day!=null&&flow!=null?nav-day-flow:null}
function confirmedIrpPrincipal(a){return number(a?.principal)>0&&a?.principal_basis==='NET_CONTRIBUTED_CAPITAL'&&['BROKER_MEASURED','USER_CONFIRMED','RECONCILED'].includes(a?.principal_quality)}
function tossHoldingPerformance(a){
 const valid=a?.official_pnl_valid===true;
 return {pnl:valid?number(a?.official_total_pnl_krw_equiv):null,return_pct:valid?number(a?.official_total_return_pct):null,source:valid?'TOSS_HOLDINGS':'UNAVAILABLE',observed_at:a?.observed_at||null};
}
function cumulative(a){
 const principal=number(a?.principal),nav=number(a?.nav);
 if(String(a?.id||'').toUpperCase()==='IRP'){
  if(a.total_pnl_quality==='BROKER_MEASURED'&&number(a.total_pnl)!=null)return {pnl:number(a.total_pnl),return_pct:number(a.total_return_pct)};
  if(!confirmedIrpPrincipal(a))return {pnl:null,return_pct:null};
  const pnl=nav==null?null:nav-principal;return {pnl,return_pct:pnl==null?null:100*pnl/principal};
 }
 if(['ISA','PENSION'].includes(String(a?.id||'').toUpperCase())&&principal>0){const pnl=nav==null?null:nav-principal;return {pnl,return_pct:pnl==null?null:100*pnl/principal};}
 const pnl=number(a?.total_pnl)??(nav!=null&&principal!=null?nav-principal:null);
 return {pnl,return_pct:pnl==null?null:number(a?.total_return_pct)??(principal>0?100*pnl/principal:null)};
}
function dayQuality(accounts,ids=IDS){
 const groups={BROKER_MEASURED:{ids:[],subtotal:null},MODELED:{ids:[],subtotal:null},UNKNOWN:{ids:[],subtotal:null}},scopes=new Set();
 for(const id of ids){const a=accounts?.[id]||{},value=number(a.today_pnl);if(value==null)continue;
  const kind=['BROKER_MEASURED','MODELED'].includes(a.today_pnl_quality)?a.today_pnl_quality:'UNKNOWN',g=groups[kind];g.ids.push(id);g.subtotal=(g.subtotal??0)+value;scopes.add(a.today_pnl_scope||'UNSPECIFIED');
 }
 const used=Object.keys(groups).filter(key=>groups[key].ids.length),state=used.length>1?'MIXED':used[0]||'MISSING';
 return {state,groups,scopes:[...scopes],comparable_period:scopes.size===1&&!scopes.has('UNSPECIFIED')};
}
function aggregate(accounts,ids=IDS){
 ids=[...new Set(ids.filter(id=>!['AI','AIBOT','AI_BOT'].includes(id)).map(accountOwner))];const xs=ids.map(id=>accounts?.[id]||{}),nav=sum(xs.map(x=>number(x.nav))),day=sum(xs.map(x=>number(x.today_pnl))),flow=sum(xs.map(x=>number(x.net_flow))),prior=sum(xs.map(previous)),cum=sum(xs.map(x=>number(x.pnl))),principal=sum(xs.map(x=>number(x.principal)));
 return {day_quality:dayQuality(accounts,ids),nav,day,flow,previous:prior,day_return:day!=null&&prior>0&&(!xs.some(a=>a.today_pnl_scope==='CT_US_CLOSE_PERFORMANCE_DAY_V1')||flow===0)?100*day/prior:null,cum,principal,return_pct:cum!=null&&principal>0?100*cum/principal:null,known_cumulative:xs.filter(x=>number(x.pnl)!=null).length,missing_cumulative:ids.filter((id,i)=>number(xs[i].pnl)==null),known_cumulative_subtotal:xs.some(x=>number(x.pnl)!=null)?xs.reduce((s,x)=>s+(number(x.pnl)??0),0):null,known_day:xs.filter(x=>number(x.today_pnl)!=null).length,account_count:ids.length,known_day_subtotal:xs.reduce((s,x)=>s+(number(x.today_pnl)??0),0)};
}
function dayKey(v){const s=String(v||'').trim();if(/^\d{8}$/.test(s))return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);if(/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(s))return s.replaceAll('/','-');const t=parseMs(s);return t==null?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(t))}
function parseMs(v){let s=String(v||'').trim();if(!s)return null;if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'+09:00';const x=Date.parse(s);return Number.isFinite(x)?x:null}
function freshness(l,now=Date.now()){
 const t=parseMs(l?.generated_kst||l?.observed_at),until=parseMs(l?.stale_after_kst),session=l?.session,closed=l?.market_closed===true||String(session?.state||session).toUpperCase().includes('CLOSED');
 if(t==null||t>now+120000)return {kind:'warn',state:'UNKNOWN',text:'기준시각 확인 필요',age_ms:null};
 const late=until!=null?now>until:now-t>20*60000;
 if(late)return {kind:'warn',state:'STALE',text:'업데이트 지연',age_ms:now-t};
 return {kind:closed?'closed':'good',state:closed?'CLOSED':'LIVE',text:closed?'장 마감 · 다음 수집 대기':'최신 수집 기준',age_ms:now-t};
}
function positionDay(p,a){
 const direct=first(p,['daily_pnl','day_pnl_krw','regular_pnl']);if(direct!=null)return direct;
 const native=number(p?.day_pnl),f=currency(p)==='USD'?fx(a,p):1;if(native!=null)return f==null?null:native*f;
 const q=first(p,['qty','quantity']),cur=first(p,['current_price','price']),prev=number(p?.prev_close);
 return q!=null&&cur>0&&prev>0&&f!=null?q*(cur-prev)*f:null;
}
function audit(c){const rows={};for(const id of IDS){const a=c.accounts?.[id]||{},s=stock(a),k=cash(a),nav=number(a.nav);rows[id]={stock:s,cash:k,nav,gap:s!=null&&k!=null&&nav!=null?nav-s-k:null,cash_kind:a.cash_kind||'CASH',position_count:positions(a).length}}return rows}
const api={IDS,accountOwner,number,first,sum,positions,currency,fx,valueKrw,cash,stock,previous,confirmedIrpPrincipal,cumulative,tossHoldingPerformance,dayQuality,aggregate,dayKey,parseMs,freshness,positionDay,audit};
root.JjooniMetrics=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);

