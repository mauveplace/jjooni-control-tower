(function(){
'use strict';
const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE';
const REFRESH_MS=60000;
const MAX_AGE=20*60*1000;
const REGISTRY=[
 {id:'TOSS',label:'Toss',type:'HUMAN',broker:'Toss증권'},
 {id:'ISA',label:'ISA',type:'HUMAN',broker:'KB증권'},
 {id:'PENSION',label:'연금저축',type:'HUMAN',broker:'KB증권'},
 {id:'IRP',label:'IRP',type:'HUMAN',broker:'KB증권'},
 {id:'AI',label:'AI BOT',type:'AI',broker:'KB증권'},
 {id:'TRIPOD',label:'TRI-POD',type:'TRIPOD',broker:'카카오증권'}
];
const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const won=v=>'₩'+Math.round(Math.abs(z(v))).toLocaleString('ko-KR');
const signed=v=>(z(v)>=0?'+':'-')+won(v);
const pct=v=>n(v)==null?'—':(z(v)>=0?'+':'')+z(v).toFixed(2)+'%';
const usd=v=>'$'+z(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const clone=x=>JSON.parse(JSON.stringify(x));
let LAST_LIVE=null;
let CANON=null;

async function decryptEnvelope(env,password){
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(env.salt),iterations:Number(env.iterations),hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.nonce),additionalData:b64(env.aad),tagLength:128},key,b64(env.ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}
function loadGviz(){return new Promise((resolve,reject)=>{
 const cb='__ct_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;
 const finish=(e,v)=>{if(done)return;done=true;try{delete window[cb]}catch(_){};try{s.remove()}catch(_){};clearTimeout(timer);e?reject(e):resolve(v)};
 window[cb]=resp=>{try{const o={};((((resp||{}).table||{}).rows)||[]).forEach(r=>{const c=r.c||[],k=c[0]&&c[0].v!=null?String(c[0].v):'',v=c[1]&&c[1].v!=null?String(c[1].v):'';if(k)o[k]=v});finish(null,o)}catch(e){finish(e)}};
 const timer=setTimeout(()=>finish(new Error('GVIZ_TIMEOUT')),15000);s.onerror=()=>finish(new Error('GVIZ_LOAD_FAIL'));
 s.src='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?sheet='+encodeURIComponent(TAB)+'&tqx='+encodeURIComponent('responseHandler:'+cb)+'&_='+Date.now();document.head.appendChild(s);
});}
function badge(){let e=document.getElementById('ctEncryptedLiveBadge');if(!e){e=document.createElement('div');e.id='ctEncryptedLiveBadge';e.style.cssText='position:fixed;right:12px;top:10px;z-index:100000;padding:6px 10px;border-radius:999px;font:800 10px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px #0002;white-space:nowrap';document.body.appendChild(e)}return e}
function setBadge(text,state,title){const e=badge();e.textContent=text;e.title=title||'';const s=state==='good'?['#ecfdf3','#abefc6','#087443']:state==='warn'?['#fff7ed','#fed7aa','#b45309']:['#fff1f2','#fecdd3','#be123c'];e.style.background=s[0];e.style.border='1px solid '+s[1];e.style.color=s[2]}

function injectResponsiveCss(){if(document.getElementById('ct-ssot-responsive-v4'))return;const st=document.createElement('style');st.id='ct-ssot-responsive-v4';st.textContent=`
/* phone: tabs at top, horizontally scrollable */
@media (max-width:767px){
 body{padding-bottom:0!important;overflow-x:hidden!important}
 .top{position:sticky!important;top:0!important;z-index:5000!important}
 .tabs{position:fixed!important;left:0!important;right:0!important;top:56px!important;bottom:auto!important;width:100%!important;height:52px!important;padding:4px 6px!important;margin:0!important;display:flex!important;grid-template-columns:none!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;background:#061a36!important;border:0!important;z-index:4999!important;box-shadow:0 5px 18px rgba(6,24,51,.18)!important;scrollbar-width:none!important}
 .tabs::-webkit-scrollbar{display:none!important}
 .tabs:before,.tabs:after{display:none!important}
 .tab,.tab[data-tab]{display:flex!important;flex:0 0 auto!important;min-width:78px!important;height:44px!important;padding:3px 7px!important;border:0!important;border-radius:8px!important;align-items:center!important;justify-content:center!important;text-align:center!important;font-size:8px!important;line-height:1.15!important;color:#c3d1e2!important;background:transparent!important}
 .tab.on{background:rgba(255,255,255,.1)!important;color:#fff!important}
 .tabPanel{padding-top:58px!important}
 .app{padding-bottom:16px!important}
 #ctEncryptedLiveBadge{top:7px!important;right:8px!important;bottom:auto!important}
}
/* tablet: restore original left navigation */
@media (min-width:768px) and (max-width:1199px){
 body{overflow-x:hidden!important}
 .tabs{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:158px!important;height:100vh!important;margin:0!important;padding:108px 12px 18px!important;display:flex!important;flex-direction:column!important;gap:6px!important;overflow-y:auto!important;background:linear-gradient(180deg,#061a36,#07162b)!important;border:0!important;z-index:4500!important;box-shadow:8px 0 28px rgba(6,24,51,.10)!important}
 .tabs:before{content:'CONTROL\\A TOWER';white-space:pre!important;display:block!important;position:absolute!important;left:20px!important;top:28px!important;color:white!important;font:900 17px/1.05 system-ui!important;letter-spacing:.02em!important}
 .tabs:after{content:'INVESTMENT';display:block!important;position:absolute!important;left:20px!important;top:72px!important;color:#8fa4bb!important;font:700 8px/1 system-ui!important;letter-spacing:.18em!important}
 .tab,.tab[data-tab]{display:flex!important;width:100%!important;min-height:46px!important;height:auto!important;padding:10px 10px!important;border:0!important;border-radius:9px!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important;font-size:11px!important;color:#c3d1e2!important;background:transparent!important}
 .tab.on{background:linear-gradient(90deg,#123e75,#0c2d57)!important;color:#fff!important;box-shadow:inset 3px 0 #62a8ff!important}
 .app{margin-left:158px!important;width:calc(100% - 158px)!important;max-width:none!important;padding:0 18px 28px!important}
 .top{margin-left:0!important;width:100%!important}
 .top:before{display:none!important}
 #ctEncryptedLiveBadge{top:10px!important;right:12px!important;bottom:auto!important}
}
`;(document.head||document.documentElement).appendChild(st)}

function staticHumanRow(id){try{if(typeof window.latestAccountRows==='function')return (window.latestAccountRows()||{})[id]||{};}catch(_){}return {}}
function staticPrincipal(id){const r=staticHumanRow(id);if(n(r.principal)!=null)return z(r.principal);try{const p=((D.human||{}).performance||[]).filter(x=>String(x.account||'').toUpperCase()===id).at(-1);return z(p&&p.principal)}catch(_){return 0}}
function humanStaticPositions(id){try{return ((D.human||{}).positions||[]).filter(x=>String(x.account||x.account_type||'').toUpperCase()===id)}catch(_){return []}}

function makeCanonical(live){
 const A=(live.accounts||{}),out={};
 const toss=A.TOSS||{};
 out.TOSS={id:'TOSS',type:'HUMAN',nav:n(toss.nav),principal:n(toss.principal)||staticPrincipal('TOSS'),pnl:n(toss.total_pnl),return_pct:n(toss.total_return_pct),today_pnl:n(toss.today_pnl),today_return:n(toss.today_return),net_flow:null,cash_krw:n(toss.cash_krw),cash_usd:n(toss.cash_usd),positions:humanStaticPositions('TOSS'),source:String(toss.mode||toss.status||'TOSS_REFERENCE'),quality:String(toss.status||'REFERENCE_STALE')};
 ['ISA','PENSION','IRP'].forEach(id=>{const a=A[id]||{};const ps=Array.isArray(a.positions)?a.positions:humanStaticPositions(id);const pr=staticPrincipal(id);const nav=n(a.nav);out[id]={id,type:'HUMAN',nav,principal:pr,pnl:nav!=null&&pr>0?nav-pr:null,return_pct:nav!=null&&pr>0?(nav/pr-1)*100:null,today_pnl:n(a.today_pnl),today_return:n(a.today_return),net_flow:0,cash_krw:n(a.cash_krw??a.cash),cash_usd:null,positions:ps,source:String(a.mode||''),quality:String(a.status||'PARTIAL_MODELED'),quote_coverage_pct:n(a.quote_coverage_pct)};});
 const ai=A.AI||{};const aiPs=[...(ai.holdings_kr||[]).map(x=>({...x,account:'AI',account_type:'AI',current_price:z(x.price),avg_price:z(x.avg),market_value:z(x.value),record_type:'POSITION'})),...(ai.holdings_us||[]).map(x=>({...x,account:'AI',account_type:'AI',current_price:z(x.price),avg_price:z(x.avg),market_value:z(x.value_krw||z(x.value)*z(ai.fx_krw_per_usd)),record_type:'POSITION'}))];const aip=z(((D.ai||{}).inception_nav));const ain=n(ai.nav);out.AI={id:'AI',type:'AI',nav:ain,principal:aip||null,pnl:ain!=null&&aip>0?ain-aip:null,return_pct:ain!=null&&aip>0?(ain/aip-1)*100:null,today_pnl:n(ai.today_pnl),today_return:n(ai.today_return),net_flow:0,cash_krw:n(ai.cash_krw),cash_usd:n(ai.cash_usd),positions:aiPs,source:String(ai.mode||'KIS_BROKER_DIRECT'),quality:String(ai.status||'MISSING')};
 const tp=A.TRIPOD||{};const tpn=n(tp.nav),tpQty=z(tp.qty),tpAvg=z(tp.avg_price),tpFx=z(tp.fx),tpPr=tpQty>0&&tpAvg>0&&tpFx>0?tpQty*tpAvg*tpFx:null;out.TRIPOD={id:'TRIPOD',type:'TRIPOD',nav:tpn,principal:tpPr,pnl:tpn!=null&&tpPr!=null?tpn-tpPr:null,return_pct:n(tp.current_price)!=null&&tpAvg>0?(z(tp.current_price)/tpAvg-1)*100:null,today_pnl:n(tp.today_change),today_return:n(tp.today_return),net_flow:0,cash_krw:null,cash_usd:null,positions:Array.isArray(tp.positions)?tp.positions:[],source:String(tp.mode||''),quality:String(tp.status||'MISSING'),current_price:n(tp.current_price),prev_close:n(tp.prev_close),fx:n(tp.fx),signal:tp.signal||live.tripod_signal||{}};
 const rows=REGISTRY.map(r=>out[r.id]).filter(Boolean);const finite=(x,k)=>n(x&&x[k])!=null;const sum=k=>rows.reduce((s,x)=>s+(finite(x,k)?z(x[k]):0),0);const known=rows.filter(x=>finite(x,'today_pnl'));const nav=sum('nav'),principal=sum('principal');
 return {observed_at:live.observed_at,source_snapshot_kst:live.source_snapshot_kst,registry:REGISTRY,accounts:out,total:{nav,principal,pnl:principal>0?nav-principal:null,return_pct:principal>0?(nav/principal-1)*100:null,today_change:known.reduce((s,x)=>s+z(x.today_pnl),0),today_pnl:known.reduce((s,x)=>s+z(x.today_pnl),0),today_return:null,today_complete:known.length===rows.length,known_today_count:known.length,account_count:rows.length,missing_today:rows.filter(x=>!finite(x,'today_pnl')).map(x=>x.id),net_flow:null,position_count:rows.reduce((s,x)=>s+(x.positions||[]).length,0)}};
}

function mergePositions(live){D.human=D.human||{};D.human.positions=Array.isArray(D.human.positions)?D.human.positions:[];const a=live.accounts||{};['ISA','PENSION','IRP'].forEach(id=>{const x=a[id]||{};(x.positions||[]).forEach(p=>{const k=sym(p.ticker),i=D.human.positions.findIndex(q=>String(q.account||q.account_type||'').toUpperCase()===id&&sym(q.ticker)===k);const m={...(i>=0?D.human.positions[i]:{}),...p,account:id,account_type:id,record_type:String(p.record_type||'POSITION').toUpperCase(),current_price:z(p.current_price),market_value:z(p.market_value),avg_price:z(p.avg_price),price_source:p.price_source||'KIS_MARKET_QUOTE',data_state:p.data_state||'CURRENT'};if(i>=0)D.human.positions[i]=m;else D.human.positions.push(m)})});
 const ai=a.AI||{};D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};Object.assign(D.ai.latest,{nav:z(ai.nav),kr_nav:z(ai.kr_nav),us_nav:z(ai.us_nav_krw),us_nav_krw:z(ai.us_nav_krw),cash:z(ai.cash),cash_krw:z(ai.cash_krw),cash_usd:z(ai.cash_usd),cash_usd_krw:z(ai.cash_usd_krw),fx:z(ai.fx_krw_per_usd),holdings_kr:ai.holdings_kr||[],holdings_us:ai.holdings_us||[],observed_at:live.observed_at});
 const tp=a.TRIPOD||{};D.human.tripod_positions=tp.positions||[];D.human.tripod_market={ticker:'TQQQ',current_price:z(tp.current_price),prev_close:z(tp.prev_close),fx:z(tp.fx),previous_fx:z(tp.previous_fx||tp.fx),currency:'USD',quote_timestamp:live.observed_at,current_price_source:'PUBLIC_MARKET_MODEL'};D.human.tripod_signal=tp.signal||live.tripod_signal||{};
}
function mergeTrades(live){D.human=D.human||{};const old=Array.isArray(D.human.trades)?D.human.trades:[];const fresh=Array.isArray(live.recent_trades)?live.recent_trades:[];const key=t=>[String(t.account||''),String(t.trade_date||t.filled_at_kst||''),sym(t.ticker),String(t.side||''),String(t.qty||''),String(t.price||'')].join('|');const m=new Map();[...fresh,...old].forEach(t=>{const k=key(t);if(k&&!m.has(k))m.set(k,t)});D.human.trades=[...m.values()].sort((a,b)=>String(b.filled_at_kst||b.trade_date||'').localeCompare(String(a.filled_at_kst||a.trade_date||''))).slice(0,180);D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};const at=((live.accounts||{}).AI||{}).trades||[];if(at.length)D.ai.latest.trades=at;}
function syncHumanPerformance(){if(!CANON||!D.human)return;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());const arr=Array.isArray(D.human.performance)?D.human.performance:[];['TOSS','ISA','PENSION','IRP'].forEach(id=>{const c=CANON.accounts[id];if(!c||n(c.nav)==null)return;let r=arr.find(x=>String(x.date||'')===today&&String(x.account||'').toUpperCase()===id);if(!r){r={date:today,account:id,series_id:'ACTUAL'};arr.push(r)}r.total_asset=z(c.nav);if(n(c.principal)!=null)r.principal=z(c.principal);if(n(c.today_pnl)!=null){r.market_pnl=z(c.today_pnl);r.daily_return=n(c.today_return)!=null?z(c.today_return)/100:null;r.flow_adj_daily_return=r.daily_return;}r.data_state=c.quality;r.sync_kst=CANON.observed_at});D.human.performance=arr;const hs=['TOSS','ISA','PENSION','IRP'].map(id=>CANON.accounts[id]).filter(Boolean);const hv=hs.reduce((s,x)=>s+z(x.nav),0),hp=hs.filter(x=>n(x.today_pnl)!=null).reduce((s,x)=>s+z(x.today_pnl),0);D.human.latest_performance={...(D.human.latest_performance||{}),total_asset:hv,market_pnl:hp,daily_return:hv-hp>0?hp/(hv-hp):null,data_state:'CANONICAL_V4',sync_kst:CANON.observed_at};}

function installCanonicalFunctions(){
 window.buildTodayAccounting=function(){const accts={},ids=['TOSS','ISA','PENSION','IRP'];let current=0,pnl=0;ids.forEach(id=>{const c=CANON.accounts[id]||{};const p=n(c.today_pnl);const prev=(id!=='TOSS'&&n(c.nav)!=null&&p!=null)?z(c.nav)-p:null;accts[id]={account:id,current_nav:n(c.nav),actual_nav:n(c.nav),previous_nav:prev,nav_change:p,actual_nav_change:p,live_nav_change:p,net_cash_flow:c.net_flow,live_pnl:p,investment_pnl:p,daily_return:n(c.today_return),data_state:c.quality,sync_kst:CANON.observed_at};current+=z(c.nav);if(p!=null)pnl+=p});return {accounts:accts,current_nav:current,actual_nav:current,nav_change:pnl,actual_nav_change:pnl,live_nav_change:pnl,net_cash_flow:null,live_pnl:pnl,investment_pnl:pnl,previous_nav:null,daily_return:null,explained_gap:null,live_reconciliation_gap:null};};
 window.buildUnifiedAccountSnapshot=function(){const c=clone(CANON);Object.values(c.accounts).forEach(x=>{x.today_change=x.today_pnl;x.session_change=x.today_pnl;x.extended_change=0;x.session_return=x.today_return;x.session_quality=x.quality;x.position_count=(x.positions||[]).length;x.cash=z(x.cash_krw)+(z(x.cash_usd)*(x.id==='AI'?z(((LAST_LIVE.accounts||{}).AI||{}).fx_krw_per_usd):0));x.net_flow=x.net_flow});c.total.session_change=c.total.today_pnl;c.total.extended_change=0;c.total.session_return=null;c.total.unique_ticker_count=new Set(Object.values(c.accounts).flatMap(x=>(x.positions||[]).map(p=>sym(p.ticker)).filter(Boolean))).size;return c;};
 window.buildRegularSessionMetrics=function(){const accounts={},positions=[];REGISTRY.forEach(r=>{const c=CANON.accounts[r.id]||{};let priced=0,total=0;(c.positions||[]).forEach(p=>{if(String(p.record_type||'POSITION').toUpperCase()!=='POSITION')return;total++;const cur=z(p.current_price||p.price),prev=z(p.prev_close),qty=z(p.qty),fx=String(p.currency||'KRW').toUpperCase()==='USD'?(z(p.fx)||z(c.fx)||z(((LAST_LIVE.accounts||{}).AI||{}).fx_krw_per_usd)||1):1;const ok=cur>0&&prev>0&&qty>0;if(ok)priced++;positions.push({account:r.id,ticker:p.ticker,name:p.name,qty,baseline_price:prev,regular_mark:cur,regular_pnl:ok?qty*(cur-prev)*fx:0,extended_pnl:0,session_pnl:ok?qty*(cur-prev)*fx:0,quality:ok?'FULL':'REFERENCE',quote_timestamp:p.live_price_timestamp||CANON.observed_at,quote_source:p.price_source||c.source,base_fx:fx})});let q=(c.quality==='MODELED_LIVE'||c.quality==='MODEL_LIVE'||c.quality==='USER_VERIFIED_CURRENT')?'FULL':c.quality;accounts[r.id]={regular_pnl:n(c.today_pnl),extended_pnl:0,session_pnl:n(c.today_pnl),quality:q,priced,positions:total,session_label:c.source};});return {accounts,positions,context:{source:'CANONICAL_V4',observed_at:CANON.observed_at}};};
}

function updateCards(){const byName=name=>[...document.querySelectorAll('.ctAcct')].find(c=>String((c.querySelector('.ctAcctName')||{}).textContent||'').toLowerCase().includes(name.toLowerCase()));const line=(card,id,html)=>{if(!card)return;let e=card.querySelector('#'+id);if(!e){e=document.createElement('div');e.id=id;e.style.cssText='grid-column:1/-1;font:800 9px/1.4 system-ui;margin-top:4px;padding-top:4px;border-top:1px dashed #e7ebf0;text-align:right;white-space:normal';card.appendChild(e)}e.innerHTML=html};REGISTRY.forEach(r=>{const c=CANON.accounts[r.id]||{},card=byName(r.label==='AI BOT'?'ai bot':r.label==='TRI-POD'?'tri-pod':r.label.toLowerCase());if(!card)return;const nav=card.querySelector('.ctAcctNav');if(nav&&n(c.nav)!=null)nav.textContent=won(c.nav);const day=card.querySelector('.ctAcctTodayValue');if(day)day.textContent=n(c.today_pnl)==null?'당일손익 —':signed(c.today_pnl)+' '+pct(c.today_return);let cash='';if(r.id==='TOSS')cash=`예수금 KRW ${won(c.cash_krw)} · USD ${usd(c.cash_usd)} · <b style="color:#b45309">REF</b>`;else if(r.id==='AI')cash=`예수금 KRW ${won(c.cash_krw)} · USD ${usd(c.cash_usd)} · <b style="color:#087443">LIVE</b>`;else if(['ISA','PENSION','IRP'].includes(r.id))cash=`예수금 ${won(c.cash_krw)} · <b style="color:#175cd3">MODEL</b>`;else if(r.id==='TRIPOD')cash=`TQQQ ${z(((LAST_LIVE.accounts||{}).TRIPOD||{}).qty).toLocaleString()}주 · ${usd(c.current_price)} · ${pct(c.today_return)} · ${(c.signal||{}).regime||'—'} / ${(c.signal||{}).target||'—'}`;if(cash)line(card,'ctCanonical'+r.id,cash)});
 const strip=document.getElementById('ctTodayNetStrip');if(strip){const miss=CANON.total.missing_today.join(', ')||'없음';strip.innerHTML=`SSOT 검증 · NAV ${won(CANON.total.nav)} · 검증가능 당일손익 <b>${signed(CANON.total.today_pnl)}</b> (${CANON.total.known_today_count}/${CANON.total.account_count}) · 미연결 ${miss}`;}
}
function updateHero(){const h=document.querySelector('.ctOvPrimary');if(!h)return;const label=h.querySelector('.ctOvLabel'),big=document.getElementById('overviewNavChange'),ret=document.getElementById('overviewDailyReturn');if(label)label.textContent=`검증가능 당일 P&L (${CANON.total.known_today_count}/${CANON.total.account_count} 계좌)`;if(big)big.textContent=signed(CANON.total.today_pnl);if(ret)ret.textContent=CANON.total.today_complete?'FULL':'PARTIAL';let w=document.getElementById('ctHeroScopeWarning');if(!w){w=document.createElement('div');w.id='ctHeroScopeWarning';w.style.cssText='margin-top:5px;font:800 9px/1.35 system-ui;color:#ffb4bf';h.appendChild(w)}w.textContent=CANON.total.today_complete?'6계좌 SSOT 완전 검증':'미연결: '+CANON.total.missing_today.join(', ')+' · NAV는 별도 최신 권위값 사용';}
function fixLegacyBadges(){const l=document.getElementById('ctLiveBadge');if(l)l.style.display='none';document.querySelectorAll('.live').forEach(e=>{e.style.display='none'})}
function renderAll(){try{if(typeof window.render==='function')window.render()}catch(e){console.warn('render',e)};updateCards();updateHero();fixLegacyBadges();injectResponsiveCss();}

function applyLive(live){if(!live||!['JJOONI_CT_LIVE_V3','JJOONI_CT_LIVE_V4'].includes(String(live.schema||'')))throw new Error('LIVE_SCHEMA_MISMATCH');if(typeof D==='undefined')throw new Error('CONTROL_TOWER_DATA_MISSING');LAST_LIVE=live;mergePositions(live);mergeTrades(live);CANON=makeCanonical(live);window.__JJOONI_CANONICAL_SSOT=CANON;syncHumanPerformance();installCanonicalFunctions();renderAll();const ts=Date.parse(String(live.observed_at||'')),age=Number.isFinite(ts)?Date.now()-ts:Infinity,t=String(live.observed_at||'').replace('T',' ').slice(5,16),miss=CANON.total.missing_today.join(',')||'none';if(age>MAX_AGE)setBadge('SSOT STALE · '+t,'warn','Feed age exceeded 20 minutes; current canonical values remain labeled by account source. Missing daily P&L: '+miss);else setBadge('SSOT '+CANON.total.known_today_count+'/'+CANON.total.account_count+' · '+t,CANON.total.today_complete?'good':'warn','One canonical account object drives overview, performance, account drilldowns and trade review. Missing daily P&L: '+miss);}
async function refresh(){try{const pw=sessionStorage.getItem('jjooni_ct_session_pw');if(!pw)return;const kv=await loadGviz();if(!String(kv.SCHEMA||'').startsWith('JJOONI_CT_LIVE_ENCRYPTED_'))throw new Error('ENVELOPE_SCHEMA_MISMATCH');const live=await decryptEnvelope(JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}'),pw);applyLive(live)}catch(e){setBadge('SSOT WAIT','warn',String(e&&e.message||e).slice(0,180));console.warn('CT SSOT bridge',e)}}
injectResponsiveCss();refresh();setInterval(refresh,REFRESH_MS);setInterval(()=>{if(CANON){updateCards();updateHero();fixLegacyBadges()}},1500);
})();