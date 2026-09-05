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
const ORIGINAL={
 latestAccountRows:typeof window.latestAccountRows==='function'?window.latestAccountRows:null,
 openTradePerformanceDetail:typeof window.openTradePerformanceDetail==='function'?window.openTradePerformanceDetail:null
};
const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const won=v=>'₩'+Math.round(Math.abs(z(v))).toLocaleString('ko-KR');
const signed=v=>(z(v)>=0?'+':'-')+won(v);
const pct=v=>n(v)==null?'—':(z(v)>=0?'+':'')+z(v).toFixed(2)+'%';
const usd=v=>'$'+z(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const clone=x=>JSON.parse(JSON.stringify(x));
let LAST_LIVE=null;
let CANON=null;
let TRADE_QUOTES={};

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

function injectResponsiveCss(){
 if(document.getElementById('ct-final-responsive-v5'))return;
 const st=document.createElement('style');st.id='ct-final-responsive-v5';st.textContent=`
/* FINAL responsive contract: phone = top tabs, tablet = original left rail */
@media (max-width:767px){
 html,body{overflow-x:hidden!important}
 html.ctTouchTablet .app,html .app,.app{margin-left:0!important;width:100%!important;max-width:100%!important;padding:0 10px 20px!important;overflow-x:hidden!important}
 html.ctTouchTablet .top,html .top,.top{position:sticky!important;top:0!important;z-index:5000!important;height:56px!important;min-height:56px!important;margin:0 -10px!important;padding:0 12px!important;width:auto!important;background:linear-gradient(180deg,#05172e,#061d3b)!important}
 html.ctTouchTablet .tabs,html .tabs,.tabs{position:fixed!important;left:0!important;right:0!important;top:56px!important;bottom:auto!important;width:100%!important;height:52px!important;margin:0!important;padding:4px 6px!important;display:flex!important;flex-direction:row!important;grid-template-columns:none!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;background:#061a36!important;border:0!important;z-index:4999!important;box-shadow:0 5px 18px rgba(6,24,51,.18)!important;scrollbar-width:none!important}
 html.ctTouchTablet .tabs::-webkit-scrollbar,.tabs::-webkit-scrollbar{display:none!important}
 html.ctTouchTablet .tabs:before,html.ctTouchTablet .tabs:after,.tabs:before,.tabs:after{display:none!important}
 html.ctTouchTablet .tab,html.ctTouchTablet .tab[data-tab],html .tab,.tab,.tab[data-tab]{display:flex!important;flex:0 0 auto!important;min-width:78px!important;width:auto!important;height:44px!important;min-height:44px!important;padding:3px 7px!important;border:0!important;border-radius:8px!important;align-items:center!important;justify-content:center!important;text-align:center!important;font-size:8px!important;line-height:1.15!important;color:#c3d1e2!important;background:transparent!important;box-shadow:none!important}
 html.ctTouchTablet .tab.on,.tab.on{background:rgba(255,255,255,.1)!important;color:#fff!important}
 html.ctTouchTablet .tabPanel,.tabPanel{padding-top:58px!important}
 #ctEncryptedLiveBadge{top:7px!important;right:8px!important;bottom:auto!important}
}
@media (min-width:768px) and (max-width:1199px){
 html,body{overflow-x:hidden!important}
 html.ctTouchTablet .tabs,html .tabs,.tabs{position:fixed!important;left:0!important;top:0!important;bottom:0!important;right:auto!important;width:158px!important;height:100vh!important;margin:0!important;padding:108px 12px 18px!important;display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:6px!important;overflow-y:auto!important;overflow-x:hidden!important;background:linear-gradient(180deg,#061a36,#07162b)!important;border:0!important;z-index:4500!important;box-shadow:8px 0 28px rgba(6,24,51,.10)!important}
 html.ctTouchTablet .tabs:before,.tabs:before{content:'CONTROL\\A TOWER'!important;white-space:pre!important;display:block!important;position:absolute!important;left:20px!important;top:28px!important;color:white!important;font:900 17px/1.05 system-ui!important;letter-spacing:.02em!important}
 html.ctTouchTablet .tabs:after,.tabs:after{content:'INVESTMENT'!important;display:block!important;position:absolute!important;left:20px!important;top:72px!important;color:#8fa4bb!important;font:700 8px/1 system-ui!important;letter-spacing:.18em!important}
 html.ctTouchTablet .tab,html.ctTouchTablet .tab[data-tab],html .tab,.tab,.tab[data-tab]{display:flex!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;min-height:46px!important;height:auto!important;padding:10px 10px!important;border:0!important;border-radius:9px!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important;font-size:11px!important;color:#c3d1e2!important;background:transparent!important;box-shadow:none!important}
 html.ctTouchTablet .tab.on,.tab.on{background:linear-gradient(90deg,#123e75,#0c2d57)!important;color:#fff!important;box-shadow:inset 3px 0 #62a8ff!important}
 html.ctTouchTablet .app,html .app,.app{margin-left:158px!important;width:calc(100% - 158px)!important;max-width:none!important;padding:0 18px 28px!important}
 html.ctTouchTablet .top,html .top,.top{margin-left:0!important;width:100%!important}
 html.ctTouchTablet .top:before,.top:before{display:none!important}
 html.ctTouchTablet .tabPanel,.tabPanel{padding-top:0!important}
 #ctEncryptedLiveBadge{top:10px!important;right:12px!important;bottom:auto!important}
}
/* watchlist */
#panel-watchlist{max-width:100%}
.ctWlHead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:8px 0 12px}
.ctWlTitle{font-size:22px;font-weight:900;color:#14243a}.ctWlSub{font-size:11px;color:#7d8b9d;margin-top:3px}
.ctWlControls{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.ctWlBtn{appearance:none;border:1px solid #dbe3ec;background:#fff;color:#344054;border-radius:999px;padding:7px 10px;font:800 10px/1 system-ui;cursor:pointer}
.ctWlBtn.on{background:#0b2f5d;color:#fff;border-color:#0b2f5d}
.ctWlCard{background:#fff;border:1px solid #e6ebf1;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(12,31,54,.06)}
.ctWlMeta{padding:10px 12px;border-bottom:1px solid #edf1f5;font-size:10px;color:#7d8b9d;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ctWlRow{display:grid;grid-template-columns:34px minmax(0,1.6fr) minmax(80px,.7fr) repeat(4,minmax(66px,.58fr));align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #f0f3f6;font-size:11px;color:#344054}.ctWlRow:last-child{border-bottom:0}
.ctWlRank{font-weight:900;color:#98a2b3}.ctWlName{font-weight:900;color:#101828}.ctWlTicker{font-size:9px;color:#98a2b3;margin-top:2px}.ctWlPrice{text-align:right;font-weight:800}.ctWlRet{text-align:right;font-weight:900}.ctWlRet.pos{color:#d92d20}.ctWlRet.neg{color:#175cd3}.ctWlBadges{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.ctWlTag{font-size:8px;padding:2px 5px;border-radius:999px;background:#f2f4f7;color:#667085}.ctWlTag.live{background:#ecfdf3;color:#087443}.ctWlTag.held{background:#eff8ff;color:#175cd3}
@media(max-width:767px){.ctWlHead{display:block}.ctWlControls{justify-content:flex-start;margin-top:8px}.ctWlRow{grid-template-columns:24px minmax(0,1fr) 72px 64px;padding:9px 8px}.ctWlRow .ctWlRet[data-period="5d"],.ctWlRow .ctWlRet[data-period="10d"],.ctWlRow .ctWlRet[data-period="20d"]{display:none}.ctWlTitle{font-size:18px}.ctWlPrice{font-size:10px}}
`;(document.head||document.documentElement).appendChild(st);
}

function staticRows(){try{return ORIGINAL.latestAccountRows?ORIGINAL.latestAccountRows()||{}:{}}catch(_){return {}}}
function staticHumanRow(id){return staticRows()[id]||{}}
function staticPrincipal(id){const r=staticHumanRow(id);if(n(r.principal)!=null)return z(r.principal);try{const p=((D.human||{}).performance||[]).filter(x=>String(x.account||'').toUpperCase()===id).at(-1);return z(p&&p.principal)}catch(_){return 0}}
function staticNetFlow(id){const r=staticHumanRow(id);if(n(r.net_cash_flow)!=null)return z(r.net_cash_flow);try{const p=((D.human||{}).performance||[]).filter(x=>String(x.account||'').toUpperCase()===id).at(-1);return n(p&&p.net_cash_flow)}catch(_){return null}}
function humanStaticPositions(id){try{return ((D.human||{}).positions||[]).filter(x=>String(x.account||x.account_type||'').toUpperCase()===id)}catch(_){return []}}

function makeCanonical(live){
 const A=live.accounts||{},out={};
 const toss=A.TOSS||{},tossFlow=staticNetFlow('TOSS');
 out.TOSS={id:'TOSS',type:'HUMAN',nav:n(toss.nav),principal:n(toss.principal)||staticPrincipal('TOSS'),pnl:n(toss.total_pnl),return_pct:n(toss.total_return_pct),today_pnl:n(toss.today_pnl),today_return:n(toss.today_return),net_flow:tossFlow,cash_krw:n(toss.cash_krw),cash_usd:n(toss.cash_usd),positions:(Array.isArray(toss.positions)&&toss.positions.length?toss.positions:humanStaticPositions('TOSS')),source:String(toss.mode||toss.status||'TOSS_REFERENCE'),quality:String(toss.status||'REFERENCE_STALE')};
 ['ISA','PENSION','IRP'].forEach(id=>{const a=A[id]||{},ps=Array.isArray(a.positions)?a.positions:humanStaticPositions(id),pr=staticPrincipal(id),nav=n(a.nav),flow=staticNetFlow(id);out[id]={id,type:'HUMAN',nav,principal:pr,pnl:nav!=null&&pr>0?nav-pr:null,return_pct:nav!=null&&pr>0?(nav/pr-1)*100:null,today_pnl:n(a.today_pnl),today_return:n(a.today_return),net_flow:flow,cash_krw:n(a.cash_krw??a.cash),cash_usd:null,positions:ps,source:String(a.mode||''),quality:String(a.status||'PARTIAL_MODELED'),quote_coverage_pct:n(a.quote_coverage_pct)};});
 const ai=A.AI||{},aiPs=[...(ai.holdings_kr||[]).map(x=>({...x,account:'AI',account_type:'AI',current_price:z(x.current_price||x.price),avg_price:z(x.avg),market_value:z(x.value),prev_close:n(x.prev_close),record_type:'POSITION',currency:'KRW',market:'KR'})),...(ai.holdings_us||[]).map(x=>({...x,account:'AI',account_type:'AI',current_price:z(x.current_price||x.price),avg_price:z(x.avg),market_value:z(x.value_krw||z(x.value)*z(ai.fx_krw_per_usd)),prev_close:n(x.prev_close),record_type:'POSITION',currency:x.currency||'USD',market:'US'}))],aip=z(((D.ai||{}).inception_nav)),ain=n(ai.nav);
 out.AI={id:'AI',type:'AI',nav:ain,principal:aip||null,pnl:ain!=null&&aip>0?ain-aip:null,return_pct:ain!=null&&aip>0?(ain/aip-1)*100:null,today_pnl:n(ai.today_pnl),today_return:n(ai.today_return),net_flow:0,cash_krw:n(ai.cash_krw),cash_usd:n(ai.cash_usd),positions:aiPs,source:String(ai.mode||'KIS_BROKER_DIRECT'),quality:String(ai.today_pnl_quality||ai.status||'MISSING'),account_quality:String(ai.status||'MISSING')};
 const tp=A.TRIPOD||{},tpn=n(tp.nav),tpQty=z(tp.qty),tpAvg=z(tp.avg_price),tpFx=z(tp.fx),tpPr=tpQty>0&&tpAvg>0&&tpFx>0?tpQty*tpAvg*tpFx:null;
 out.TRIPOD={id:'TRIPOD',type:'TRIPOD',nav:tpn,principal:tpPr,pnl:tpn!=null&&tpPr!=null?tpn-tpPr:null,return_pct:n(tp.current_price)!=null&&tpAvg>0?(z(tp.current_price)/tpAvg-1)*100:null,today_pnl:n(tp.today_change),today_return:n(tp.today_return),net_flow:0,cash_krw:null,cash_usd:null,positions:Array.isArray(tp.positions)?tp.positions:[],source:String(tp.mode||''),quality:String(tp.status||'MISSING'),current_price:n(tp.current_price),prev_close:n(tp.prev_close),fx:n(tp.fx),signal:tp.signal||live.tripod_signal||{}};
 const rows=REGISTRY.map(r=>out[r.id]).filter(Boolean),finite=(x,k)=>n(x&&x[k])!=null,sum=k=>rows.reduce((s,x)=>s+(finite(x,k)?z(x[k]):0),0),known=rows.filter(x=>finite(x,'today_pnl')),knownFlow=rows.filter(x=>finite(x,'net_flow')),nav=sum('nav'),principal=sum('principal'),todayPnl=known.reduce((s,x)=>s+z(x.today_pnl),0),flow=knownFlow.reduce((s,x)=>s+z(x.net_flow),0);
 rows.forEach(x=>{x.nav_change=n(x.today_pnl)!=null&&n(x.net_flow)!=null?z(x.today_pnl)+z(x.net_flow):n(x.today_pnl)});
 return {observed_at:live.observed_at,source_snapshot_kst:live.source_snapshot_kst,registry:REGISTRY,accounts:out,total:{nav,principal,pnl:principal>0?nav-principal:null,return_pct:principal>0?(nav/principal-1)*100:null,today_change:todayPnl+flow,today_pnl:todayPnl,net_flow:flow,today_complete:known.length===rows.length,flow_complete:knownFlow.length===rows.length,known_today_count:known.length,known_flow_count:knownFlow.length,account_count:rows.length,missing_today:rows.filter(x=>!finite(x,'today_pnl')).map(x=>x.id),missing_flow:rows.filter(x=>!finite(x,'net_flow')).map(x=>x.id),position_count:rows.reduce((s,x)=>s+(x.positions||[]).length,0)}};
}

function mergePositions(live){
 D.human=D.human||{};D.human.positions=Array.isArray(D.human.positions)?D.human.positions:[];const a=live.accounts||{};
 ['TOSS','ISA','PENSION','IRP'].forEach(id=>{const x=a[id]||{};(x.positions||[]).forEach(p=>{const k=sym(p.ticker),i=D.human.positions.findIndex(q=>String(q.account||q.account_type||'').toUpperCase()===id&&sym(q.ticker)===k),m={...(i>=0?D.human.positions[i]:{}),...p,account:id,account_type:id,record_type:String(p.record_type||'POSITION').toUpperCase(),current_price:z(p.current_price),market_value:z(p.market_value),avg_price:z(p.avg_price),price_source:p.price_source||'KIS_MARKET_QUOTE',data_state:p.data_state||'CURRENT'};if(i>=0)D.human.positions[i]=m;else D.human.positions.push(m)})});
 const ai=a.AI||{};D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};Object.assign(D.ai.latest,{nav:z(ai.nav),kr_nav:z(ai.kr_nav),us_nav:z(ai.us_nav_krw),us_nav_krw:z(ai.us_nav_krw),cash:z(ai.cash),cash_krw:z(ai.cash_krw),cash_usd:z(ai.cash_usd),cash_usd_krw:z(ai.cash_usd_krw),fx:z(ai.fx_krw_per_usd),holdings_kr:ai.holdings_kr||[],holdings_us:ai.holdings_us||[],today_pnl:n(ai.today_pnl),today_return:n(ai.today_return),observed_at:live.observed_at});
 const tp=a.TRIPOD||{};D.human.tripod_positions=tp.positions||[];D.human.tripod_market={ticker:'TQQQ',current_price:z(tp.current_price),prev_close:z(tp.prev_close),fx:z(tp.fx),previous_fx:z(tp.previous_fx||tp.fx),currency:'USD',quote_timestamp:live.observed_at,current_price_source:'PUBLIC_MARKET_MODEL'};D.human.tripod_signal=tp.signal||live.tripod_signal||{};
}

function mergeTrades(live){
 D.human=D.human||{};const old=Array.isArray(D.human.trades)?D.human.trades:[],fresh=Array.isArray(live.recent_trades)?live.recent_trades:[],key=t=>[String(t.account||''),String(t.trade_date||t.filled_at_kst||''),sym(t.ticker),String(t.side||''),String(t.qty||''),String(t.price||'')].join('|'),m=new Map();[...fresh,...old].forEach(t=>{const k=key(t);if(k&&!m.has(k))m.set(k,t)});D.human.trades=[...m.values()].sort((a,b)=>String(b.filled_at_kst||b.trade_date||'').localeCompare(String(a.filled_at_kst||a.trade_date||''))).slice(0,240);
 D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};const at=((live.accounts||{}).AI||{}).trades||[];if(at.length)D.ai.latest.trades=at;
}

function syncTradeCurrentPrices(){
 if(typeof D==='undefined'||!D.human)return;
 const px=new Map(),src=new Map(),put=(ticker,price,source)=>{const k=sym(ticker),v=n(price);if(k&&v!=null&&v>0&&!px.has(k)){px.set(k,v);src.set(k,source||'CURRENT_QUOTE')}};
 const side=((TRADE_QUOTES||{}).q)||{};Object.entries(side).forEach(([ticker,q])=>put(ticker,q&&q.p,q&&q.s));
 if(CANON)Object.values(CANON.accounts||{}).forEach(c=>(c.positions||[]).forEach(p=>put(p.ticker,p.current_price||p.price,p.price_source||c.source)));
 const wl=(LAST_LIVE&&LAST_LIVE.watchlist)||{};[...(wl.kr||[]),...(wl.us||[])].forEach(x=>put(x.ticker,x.current_price,x.quote_source));
 const tp=((LAST_LIVE&&LAST_LIVE.accounts)||{}).TRIPOD||{};put('TQQQ',tp.current_price,tp.mode||'TRIPOD_MARKET');
 (D.human.trades||[]).forEach(t=>{const k=sym(t.ticker),p=px.get(k);if(p>0){t.current_price=p;t.current_price_source=src.get(k)||'CURRENT_QUOTE';const ep=n(t.price),sideText=String(t.side||'').toUpperCase();if(ep!=null&&ep>0){if(sideText.includes('BUY')||sideText.includes('매수'))t.trade_return=(p/ep)-1;else t.trade_return=null;}}});
 window.__JJOONI_TRADE_QUOTES=TRADE_QUOTES;
}
function syncLegacyMirrors(){
 if(!CANON||typeof D==='undefined')return;D.human=D.human||{};const humanIds=['TOSS','ISA','PENSION','IRP'],hs=humanIds.map(id=>CANON.accounts[id]).filter(Boolean);
 D.human.current_account_navs=D.human.current_account_navs||{};D.human.current_account_details=D.human.current_account_details||{};
 hs.forEach(c=>{if(n(c.nav)!=null)D.human.current_account_navs[c.id]=z(c.nav);D.human.current_account_details[c.id]={...(D.human.current_account_details[c.id]||{}),cash_residual:z(c.cash_krw),cash_krw:z(c.cash_krw),cash_usd:n(c.cash_usd),canonical_quality:c.quality,canonical_source:c.source,display_nav_source:c.source,modeled_current_nav:n(c.nav)};});
 D.human.total_asset=hs.reduce((s,x)=>s+z(x.nav),0);D.human.principal=hs.reduce((s,x)=>s+(n(x.principal)!=null?z(x.principal):0),0);D.human.total_pnl=D.human.total_asset-D.human.principal;D.human.return_pct=D.human.principal>0?(D.human.total_asset/D.human.principal-1)*100:null;
 const hp=hs.filter(x=>n(x.today_pnl)!=null).reduce((s,x)=>s+z(x.today_pnl),0),hf=hs.filter(x=>n(x.net_flow)!=null).reduce((s,x)=>s+z(x.net_flow),0);D.human.latest_performance={...(D.human.latest_performance||{}),total_asset:D.human.total_asset,principal:D.human.principal,total_pnl:D.human.total_pnl,return_pct:D.human.return_pct,market_pnl:hp,net_cash_flow:hf,daily_return:D.human.total_asset-hp-hf>0?hp/(D.human.total_asset-hp-hf):null,data_state:'CANONICAL_V5',sync_kst:CANON.observed_at};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),arr=Array.isArray(D.human.performance)?D.human.performance:[];humanIds.forEach(id=>{const c=CANON.accounts[id];if(!c||n(c.nav)==null)return;let r=arr.find(x=>String(x.date||'')===today&&String(x.account||'').toUpperCase()===id);if(!r){r={date:today,account:id,series_id:'ACTUAL'};arr.push(r)}r.total_asset=z(c.nav);if(n(c.principal)!=null)r.principal=z(c.principal);if(n(c.today_pnl)!=null){r.market_pnl=z(c.today_pnl);r.daily_return=n(c.today_return)!=null?z(c.today_return)/100:null;r.flow_adj_return=r.daily_return;r.flow_adj_daily_return=r.daily_return;}if(n(c.net_flow)!=null)r.net_cash_flow=z(c.net_flow);r.data_state=c.quality;r.sync_kst=CANON.observed_at;});D.human.performance=arr;
}

function installCanonicalFunctions(){
 window.latestAccountRows=function(){const base=ORIGINAL.latestAccountRows?ORIGINAL.latestAccountRows()||{}:{};if(!CANON)return base;const out={...base};['TOSS','ISA','PENSION','IRP'].forEach(id=>{const c=CANON.accounts[id]||{};out[id]={...(base[id]||{}),account:id,total_asset:n(c.nav),principal:n(c.principal),market_pnl:n(c.today_pnl),net_cash_flow:n(c.net_flow),daily_return:n(c.today_return)!=null?z(c.today_return)/100:null,flow_adj_return:n(c.today_return)!=null?z(c.today_return)/100:null,data_state:c.quality,sync_kst:CANON.observed_at};});return out;};
 window.buildTodayAccounting=function(){const accts={},ids=['TOSS','ISA','PENSION','IRP'];let current=0,pnl=0,flow=0;ids.forEach(id=>{const c=CANON.accounts[id]||{},p=n(c.today_pnl),f=n(c.net_flow),chg=p!=null&&f!=null?p+f:p;const prev=n(c.nav)!=null&&chg!=null?z(c.nav)-chg:null;accts[id]={account:id,current_nav:n(c.nav),actual_nav:n(c.nav),previous_nav:prev,nav_change:chg,actual_nav_change:chg,live_nav_change:chg,net_cash_flow:f,live_pnl:p,investment_pnl:p,daily_return:n(c.today_return),data_state:c.quality,sync_kst:CANON.observed_at};current+=z(c.nav);if(p!=null)pnl+=p;if(f!=null)flow+=f});return {accounts:accts,current_nav:current,actual_nav:current,nav_change:pnl+flow,actual_nav_change:pnl+flow,live_nav_change:pnl+flow,net_cash_flow:flow,live_pnl:pnl,investment_pnl:pnl,previous_nav:current-pnl-flow,daily_return:current-pnl-flow>0?pnl/(current-pnl-flow):null,explained_gap:0,live_reconciliation_gap:0};};
 window.buildUnifiedAccountSnapshot=function(){const c=clone(CANON);Object.values(c.accounts).forEach(x=>{x.today_change=x.today_pnl;x.session_change=x.today_pnl;x.extended_change=0;x.session_return=x.today_return;x.session_quality=x.quality;x.position_count=(x.positions||[]).length;x.cash=z(x.cash_krw)+(z(x.cash_usd)*(x.id==='AI'?z(((LAST_LIVE.accounts||{}).AI||{}).fx_krw_per_usd):0));});c.total.session_change=c.total.today_pnl;c.total.extended_change=0;c.total.session_return=null;c.total.unique_ticker_count=new Set(Object.values(c.accounts).flatMap(x=>(x.positions||[]).map(p=>sym(p.ticker)).filter(Boolean))).size;return c;};
 window.buildUnifiedPortfolioPositions=function(){if(!CANON)return [];return REGISTRY.flatMap(r=>((CANON.accounts[r.id]||{}).positions||[]).map(p=>({...p,account:r.id,account_type:r.id,current_price:z(p.current_price||p.price),market_value:z(p.market_value||p.value_krw||p.value),data_state:p.data_state||((CANON.accounts[r.id]||{}).quality),price_source:p.price_source||((CANON.accounts[r.id]||{}).source)})));};
 window.buildRegularSessionMetrics=function(){const accounts={},positions=[];REGISTRY.forEach(r=>{const c=CANON.accounts[r.id]||{};let priced=0,total=0;(c.positions||[]).forEach(p=>{if(String(p.record_type||'POSITION').toUpperCase()!=='POSITION')return;total++;const cur=z(p.current_price||p.price),prev=z(p.prev_close),qty=z(p.qty),fx=String(p.currency||'KRW').toUpperCase()==='USD'?(z(p.fx)||z(c.fx)||z(((LAST_LIVE.accounts||{}).AI||{}).fx_krw_per_usd)||1):1,ok=cur>0&&prev>0&&qty>0;if(ok)priced++;positions.push({account:r.id,ticker:p.ticker,name:p.name,qty,baseline_price:prev,regular_mark:cur,regular_pnl:ok?qty*(cur-prev)*fx:0,extended_pnl:0,session_pnl:ok?qty*(cur-prev)*fx:0,quality:ok?'FULL':'REFERENCE',quote_timestamp:p.live_price_timestamp||CANON.observed_at,quote_source:p.price_source||c.source,base_fx:fx})});let q=['MODELED_LIVE','MODEL_LIVE','USER_VERIFIED_CURRENT','LIVE'].includes(c.quality)?'FULL':c.quality;accounts[r.id]={regular_pnl:n(c.today_pnl),extended_pnl:0,session_pnl:n(c.today_pnl),quality:q,priced,positions:total,session_label:c.source};});return {accounts,positions,context:{source:'CANONICAL_V5',observed_at:CANON.observed_at}};};
 if(ORIGINAL.openTradePerformanceDetail&&!window.__ctTradeDetailWrapped){window.openTradePerformanceDetail=function(t,acct,currentPrice,perf,rankLabel){let cp=n(currentPrice);if((cp==null||cp<=0)&&CANON){const id=String(acct||t&&t.account||'').toUpperCase(),p=((CANON.accounts[id]||{}).positions||[]).find(x=>sym(x.ticker)===sym(t&&t.ticker));cp=n(p&&p.current_price)||n(p&&p.price)||cp;}return ORIGINAL.openTradePerformanceDetail(t,acct,cp,perf,rankLabel)};window.__ctTradeDetailWrapped=true;}
}

function updateCards(){
 if(!CANON)return;const byName=name=>[...document.querySelectorAll('.ctAcct')].find(c=>String((c.querySelector('.ctAcctName')||{}).textContent||'').toLowerCase().includes(name.toLowerCase())),line=(card,id,html)=>{if(!card)return;let e=card.querySelector('#'+id);if(!e){e=document.createElement('div');e.id=id;e.style.cssText='grid-column:1/-1;font:800 9px/1.4 system-ui;margin-top:4px;padding-top:4px;border-top:1px dashed #e7ebf0;text-align:right;white-space:normal';card.appendChild(e)}e.innerHTML=html};
 REGISTRY.forEach(r=>{const c=CANON.accounts[r.id]||{},card=byName(r.label==='AI BOT'?'ai bot':r.label==='TRI-POD'?'tri-pod':r.label.toLowerCase());if(!card)return;const nav=card.querySelector('.ctAcctNav');if(nav&&n(c.nav)!=null)nav.textContent=won(c.nav);const day=card.querySelector('.ctAcctTodayValue');if(day)day.textContent=n(c.today_pnl)==null?'당일손익 —':signed(c.today_pnl)+' '+pct(c.today_return);let extra='';if(r.id==='TOSS')extra=`예수금 KRW ${won(c.cash_krw)} · USD ${usd(c.cash_usd)} · <b style="color:#b45309">REF</b> · 오늘손익 ${n(c.today_pnl)==null?'—':signed(c.today_pnl)}`;else if(r.id==='AI')extra=`예수금 KRW ${won(c.cash_krw)} · USD ${usd(c.cash_usd)} · <b style="color:#087443">BROKER LIVE</b> · 당일P&L ${n(c.today_pnl)==null?'—':signed(c.today_pnl)} (${c.quality})`;else if(['ISA','PENSION','IRP'].includes(r.id))extra=`예수금 ${won(c.cash_krw)} · <b style="color:#175cd3">MODEL LIVE</b> · 오늘손익 ${n(c.today_pnl)==null?'—':signed(c.today_pnl)} · 순입출금 ${n(c.net_flow)==null?'—':signed(c.net_flow)}`;else if(r.id==='TRIPOD')extra=`TQQQ ${z(((LAST_LIVE.accounts||{}).TRIPOD||{}).qty).toLocaleString()}주 · ${usd(c.current_price)} · ${pct(c.today_return)} · ${(c.signal||{}).regime||'—'} / ${(c.signal||{}).target||'—'}`;if(extra)line(card,'ctCanonical'+r.id,extra)});
 let strip=document.getElementById('ctTodayNetStrip');if(!strip){const anchor=document.getElementById('overviewAccounts');if(anchor){strip=document.createElement('div');strip.id='ctTodayNetStrip';strip.style.cssText='margin:6px 0 10px;padding:9px 12px;border:1px solid #e5eaf0;border-radius:12px;background:#fff;font:800 10px/1.45 system-ui;color:#344054';anchor.parentNode.insertBefore(strip,anchor)}}if(strip){strip.innerHTML=`6계좌 SSOT · NAV <b>${won(CANON.total.nav)}</b> · 오늘 투자손익 <b>${signed(CANON.total.today_pnl)}</b> · 순입출금 <b>${CANON.total.flow_complete?signed(CANON.total.net_flow):'PARTIAL'}</b> · 오늘 순증 <b>${CANON.total.flow_complete?signed(CANON.total.today_change):'검증중'}</b>`;}
}

function updateHero(){if(!CANON)return;const h=document.querySelector('.ctOvPrimary');if(!h)return;const label=h.querySelector('.ctOvLabel'),big=document.getElementById('overviewNavChange'),ret=document.getElementById('overviewDailyReturn');if(label)label.textContent=`6계좌 오늘 투자손익 (${CANON.total.known_today_count}/${CANON.total.account_count})`;if(big)big.textContent=signed(CANON.total.today_pnl);if(ret)ret.textContent=CANON.total.today_complete?'FULL':'PARTIAL';let w=document.getElementById('ctHeroScopeWarning');if(!w){w=document.createElement('div');w.id='ctHeroScopeWarning';w.style.cssText='margin-top:5px;font:800 9px/1.35 system-ui;color:#ffb4bf';h.appendChild(w)}const sources=REGISTRY.map(r=>r.id+':'+((CANON.accounts[r.id]||{}).quality||'—')).join(' · ');w.textContent=(CANON.total.today_complete?'당일 P&L 6계좌 연결':'당일 P&L 미연결 '+CANON.total.missing_today.join(','))+' · '+sources;}
function fixLegacyBadges(){const l=document.getElementById('ctLiveBadge');if(l)l.style.display='none';document.querySelectorAll('.live').forEach(e=>{if(e.id!=='ctEncryptedLiveBadge')e.style.display='none'})}

function ensureWatchlistUi(){
 const tabs=document.querySelector('.tabs');if(!tabs)return;let tab=tabs.querySelector('[data-tab="watchlist"]');if(!tab){tab=document.createElement('div');tab.className='tab';tab.dataset.tab='watchlist';tab.textContent='시황/워치';tabs.appendChild(tab)}
 let panel=document.getElementById('panel-watchlist');if(!panel){panel=document.createElement('div');panel.id='panel-watchlist';panel.className='tabPanel';const root=document.querySelector('.app')||document.querySelector('.container')||document.body;root.appendChild(panel)}
 tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===tab));document.querySelectorAll('.tabPanel').forEach(x=>x.classList.remove('on'));panel.classList.add('on');renderWatchlist();};
}

function renderWatchlist(){
 const panel=document.getElementById('panel-watchlist');if(!panel)return;const wl=LAST_LIVE&&LAST_LIVE.watchlist;if(!wl){panel.innerHTML='<div class="ctWlHead"><div><div class="ctWlTitle">시황 워치리스트</div><div class="ctWlSub">V5 최신 Feed를 기다리는 중입니다.</div></div></div>';return;}
 const market=window.__ctWlMarket||'KR',sortKey=window.__ctWlSort||'day_return_pct',src=market==='KR'?(wl.kr||[]):(wl.us||[]),rows=[...src].sort((a,b)=>z(b[sortKey])-z(a[sortKey])),periods=[['day_return_pct','1D'],['ret_5d_pct','5D'],['ret_10d_pct','10D'],['ret_20d_pct','20D']];
 const fmtPrice=x=>market==='KR'?won(x):usd(x),cls=v=>z(v)>0?'pos':z(v)<0?'neg':'',sync=String(wl.sync_kst||LAST_LIVE.observed_at||'').replace('T',' ').slice(0,16);
 panel.innerHTML=`<div class="ctWlHead"><div><div class="ctWlTitle">시황 워치리스트</div><div class="ctWlSub">보유+관심종목을 수익률 순으로 비교 · 1D는 최신 시세, 5/10/20D는 Rotation Radar 기준</div></div><div class="ctWlControls"><button class="ctWlBtn ${market==='KR'?'on':''}" data-wm="KR">한국장</button><button class="ctWlBtn ${market==='US'?'on':''}" data-wm="US">미국장</button>${periods.map(([k,l])=>`<button class="ctWlBtn ${sortKey===k?'on':''}" data-ws="${k}">${l}순</button>`).join('')}</div></div><div class="ctWlCard"><div class="ctWlMeta"><span>${market==='KR'?'한국장 KIS 우선':'미국장 Yahoo 정규장 우선'} · ${rows.length}종목</span><span>Radar ${sync||'—'} · Feed ${String(LAST_LIVE.observed_at||'').replace('T',' ').slice(5,16)}</span></div>${rows.length?rows.map((x,i)=>`<div class="ctWlRow"><div class="ctWlRank">${i+1}</div><div><div class="ctWlName">${x.name||x.ticker}</div><div class="ctWlTicker">${x.ticker||''}</div><div class="ctWlBadges">${x.is_held?`<span class="ctWlTag held">보유${x.account?' · '+x.account:''}</span>`:''}<span class="ctWlTag ${x.quote_live?'live':''}">${x.quote_live?'현재시세':'RADAR'}</span>${(x.categories||[]).slice(0,2).map(c=>`<span class="ctWlTag">${c}</span>`).join('')}</div></div><div class="ctWlPrice">${fmtPrice(x.current_price)}</div>${periods.map(([k,l])=>`<div class="ctWlRet ${cls(x[k])}" data-period="${l.toLowerCase()}">${pct(x[k])}</div>`).join('')}</div>`).join(''):'<div style="padding:18px;color:#98a2b3">해당 시장 워치리스트 없음</div>'}</div>`;
 panel.querySelectorAll('[data-wm]').forEach(b=>b.onclick=()=>{window.__ctWlMarket=b.dataset.wm;renderWatchlist()});panel.querySelectorAll('[data-ws]').forEach(b=>b.onclick=()=>{window.__ctWlSort=b.dataset.ws;renderWatchlist()});
}

function renderAll(){try{if(typeof window.render==='function')window.render()}catch(e){console.warn('render',e)}ensureWatchlistUi();updateCards();updateHero();fixLegacyBadges();injectResponsiveCss();const wp=document.getElementById('panel-watchlist');if(wp&&wp.classList.contains('on'))renderWatchlist();}

function applyLive(live){
 if(!live||!['JJOONI_CT_LIVE_V3','JJOONI_CT_LIVE_V4','JJOONI_CT_LIVE_V5'].includes(String(live.schema||'')))throw new Error('LIVE_SCHEMA_MISMATCH');if(typeof D==='undefined')throw new Error('CONTROL_TOWER_DATA_MISSING');
 LAST_LIVE=live;window.__JJOONI_LIVE_PAYLOAD=live;mergePositions(live);CANON=makeCanonical(live);window.__JJOONI_CANONICAL_SSOT=CANON;mergeTrades(live);syncTradeCurrentPrices();syncLegacyMirrors();installCanonicalFunctions();renderAll();
 const ts=Date.parse(String(live.observed_at||'')),age=Number.isFinite(ts)?Date.now()-ts:Infinity,t=String(live.observed_at||'').replace('T',' ').slice(5,16),miss=CANON.total.missing_today.join(',')||'none';
 if(age>MAX_AGE)setBadge('SSOT STALE · '+t,'warn','Feed age exceeded 20 minutes. Missing daily P&L: '+miss);
 else setBadge('SSOT '+CANON.total.known_today_count+'/'+CANON.total.account_count+' · '+t,CANON.total.today_complete?'good':'warn','Canonical feed drives overview, performance, account drilldowns, trade review, TRI-POD and watchlist. Missing daily P&L: '+miss);
}

async function refresh(){try{const pw=sessionStorage.getItem('jjooni_ct_session_pw');if(!pw)return;const kv=await loadGviz();if(!String(kv.SCHEMA||'').startsWith('JJOONI_CT_LIVE_ENCRYPTED_'))throw new Error('ENVELOPE_SCHEMA_MISMATCH');try{TRADE_QUOTES=JSON.parse(kv.TRADE_QUOTES_JSON||'{}')}catch(_){TRADE_QUOTES={}};try{window.__JJOONI_COST_SIDECAR=kv.COST_JSON?JSON.parse(kv.COST_JSON):null}catch(_){window.__JJOONI_COST_SIDECAR=null};const live=await decryptEnvelope(JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}'),pw);applyLive(live)}catch(e){setBadge('SSOT WAIT','warn',String(e&&e.message||e).slice(0,180));console.warn('CT SSOT bridge',e)}}

injectResponsiveCss();ensureWatchlistUi();refresh();setInterval(()=>{if(!document.hidden)refresh()},REFRESH_MS);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(()=>{if(!document.hidden&&CANON){updateCards();updateHero();fixLegacyBadges()}},1500);
})();

/* CT_UI_STATE_WATCHLIST_V1 */
(function(){
 'use strict';
 const KEY='jjooni_ct_active_tab_v1';
 const LABELS={overview:'OVERVIEW',accounts:'보유분석',ai:'AI BOT',compare:'성과분석',performance:'계좌성과',tripod:'TRI-POD',decision:'의사결정',trades:'거래내역',quality:'데이터품질',watchlist:'WATCHLIST',cost:'COST'};
 let restoring=false;

 function ensureStyle(){
   if(document.getElementById('ctUiStateStyle'))return;
   const st=document.createElement('style');st.id='ctUiStateStyle';st.textContent='#ctWatchlistSectionHead{padding:14px 10px 5px;color:#8fa4bb;font:800 9px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;pointer-events:none}@media(max-width:767px){#ctWatchlistSectionHead{display:none!important}}';document.head.appendChild(st);
 }

 function ensureWatchHead(){
   const tab=document.querySelector('.tab[data-tab="watchlist"]');
   if(!tab||!tab.parentNode)return false;
   if(!document.getElementById('ctWatchlistSectionHead')){
     const h=document.createElement('div');h.id='ctWatchlistSectionHead';h.textContent='WATCHLIST';
     tab.parentNode.insertBefore(h,tab);
   }
   return true;
 }

 function pageHeading(){
   let h=document.querySelector('[data-ct-context-heading="1"]');
   if(h)return h;
   const candidates=[...document.querySelectorAll('h1,h2,.pageTitle,.page-title,.sectionTitle,.section-title')];
   h=candidates.find(x=>String(x.textContent||'').trim().toUpperCase()==='OVERVIEW');
   if(h)h.dataset.ctContextHeading='1';
   return h||null;
 }

 function syncHeading(name){
   const h=pageHeading();
   if(h&&LABELS[name])h.textContent=LABELS[name];
 }

 function save(name){
   if(!name)return;
   try{sessionStorage.setItem(KEY,name)}catch(_){}
   syncHeading(name);
 }

 function activate(name){
   if(restoring||!name)return false;
   const tab=document.querySelector('.tab[data-tab="'+CSS.escape(name)+'"]');
   if(!tab)return false;
   restoring=true;
   try{
     tab.click();
     setTimeout(()=>{
       const panel=document.getElementById('panel-'+name);
       if(panel&&!panel.classList.contains('on')){
         document.querySelectorAll('.tabPanel').forEach(x=>x.classList.remove('on'));
         panel.classList.add('on');
       }
       document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===tab));
       syncHeading(name);
       restoring=false;
     },30);
   }catch(_){restoring=false;return false}
   return true;
 }

 document.addEventListener('click',e=>{
   const t=e.target&&e.target.closest?e.target.closest('.tab[data-tab]'):null;
   if(t&&!restoring)save(t.dataset.tab);
 },true);

 function restore(){
   ensureStyle();ensureWatchHead();
   let name='overview';
   try{name=sessionStorage.getItem(KEY)||'overview'}catch(_){}
   if(activate(name))return true;
   return false;
 }

 let tries=0;
 const timer=setInterval(()=>{
   ensureStyle();ensureWatchHead();
   if(restore()||++tries>24)clearInterval(timer);
 },125);
 setTimeout(restore,0);
 setTimeout(restore,600);
 setTimeout(restore,1600);
})();


/* CT_COST_BRIDGE_LOADER_V1 */
(function(){
 if(document.getElementById('ctCostBridgeScript'))return;
 const x=document.createElement('script');
 x.id='ctCostBridgeScript';
 x.src='cost-bridge.js?v=1';
 x.async=true;
 (document.head||document.documentElement).appendChild(x);
})();
