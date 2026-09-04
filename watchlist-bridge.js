(function(){
'use strict';
const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
const TAB='GITHUB_CT_LIVE';
const REFRESH_MS=60000;
const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const pct=v=>n(v)==null?'—':(z(v)>=0?'+':'')+z(v).toFixed(2)+'%';
const tone=v=>n(v)==null?'flat':z(v)>0?'up':z(v)<0?'down':'flat';
let MARKET='KR';
let SORT='day_return_pct';
let LIVE=null;

async function decryptEnvelope(env,password){
  const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(env.salt),iterations:Number(env.iterations),hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.nonce),additionalData:b64(env.aad),tagLength:128},key,b64(env.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

function loadGviz(){
  return new Promise((resolve,reject)=>{
    const cb='__ct_watch_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');
    let done=false;
    const finish=(err,val)=>{if(done)return;done=true;try{delete window[cb]}catch(_){};try{s.remove()}catch(_){};clearTimeout(timer);err?reject(err):resolve(val)};
    window[cb]=resp=>{try{const out={};((((resp||{}).table||{}).rows)||[]).forEach(r=>{const c=r.c||[];const k=c[0]&&c[0].v!=null?String(c[0].v):'';const v=c[1]&&c[1].v!=null?String(c[1].v):'';if(k)out[k]=v});finish(null,out)}catch(e){finish(e)}};
    const timer=setTimeout(()=>finish(new Error('WATCH_GVIZ_TIMEOUT')),15000);
    s.onerror=()=>finish(new Error('WATCH_GVIZ_FAIL'));
    s.src='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?sheet='+encodeURIComponent(TAB)+'&tqx='+encodeURIComponent('responseHandler:'+cb)+'&_='+Date.now();
    document.head.appendChild(s);
  });
}

function ensureStyle(){
  if(document.getElementById('ct-watchlist-style'))return;
  const st=document.createElement('style');
  st.id='ct-watchlist-style';
  st.textContent=`
#panel-watchlist{max-width:1180px;margin:0 auto;padding-bottom:28px}
.ctWatchHead{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:12px 0 10px}
.ctWatchHead h2{margin:0;font-size:22px;letter-spacing:-.03em}
.ctWatchSub{font-size:10px;color:#8796a8;margin-top:4px;line-height:1.45}
.ctWatchControls{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 12px}
.ctWatchCtl{border:1px solid #dce3eb;background:#fff;color:#475467;border-radius:999px;padding:8px 12px;font:800 10px/1 system-ui;cursor:pointer}
.ctWatchCtl.on{background:#0d2f5c;color:#fff;border-color:#0d2f5c}
.ctWatchCard{background:#fff;border:1px solid #e5e9ef;border-radius:15px;overflow:hidden;box-shadow:0 3px 14px rgba(16,24,40,.04)}
.ctWatchMeta{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid #eef1f4;color:#667085;font:750 9px/1.4 system-ui}
.ctWatchRows{display:flex;flex-direction:column}
.ctWatchRow{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 13px;border-bottom:1px solid #f0f2f5;color:#1d2939}
.ctWatchRow:last-child{border-bottom:0}
.ctWatchRank{width:25px;height:25px;border-radius:8px;background:#f2f4f7;color:#475467;display:grid;place-items:center;font:900 10px/1 system-ui}
.ctWatchName{font:900 13px/1.2 system-ui;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctWatchTicker{margin-top:3px;color:#98a2b3;font:750 9px/1.2 system-ui}
.ctWatchTags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.ctWatchTag{padding:3px 6px;border-radius:999px;background:#f2f4f7;color:#667085;font:800 8px/1 system-ui}
.ctWatchTag.held{background:#ecfdf3;color:#087443}
.ctWatchRight{text-align:right;min-width:108px}
.ctWatchPrice{color:#344054;font:850 10px/1.2 system-ui}
.ctWatchSelected{margin-top:3px;font:950 18px/1 system-ui;letter-spacing:-.03em}
.ctWatchSelected.up,.ctWatchMini.up{color:#d92d3b}
.ctWatchSelected.down,.ctWatchMini.down{color:#2167d5}
.ctWatchSelected.flat,.ctWatchMini.flat{color:#667085}
.ctWatchMiniGrid{grid-column:2/4;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:2px}
.ctWatchMini{border:1px solid #edf0f3;background:#fafbfc;border-radius:8px;padding:6px 7px;font:850 9px/1.25 system-ui;text-align:right}
.ctWatchMini b{display:block;color:#98a2b3;font-size:7px;margin-bottom:2px}
.ctWatchEmpty{padding:34px 15px;text-align:center;color:#98a2b3;font:800 11px/1.5 system-ui}
@media (max-width:767px){
 #panel-watchlist{padding-left:1px;padding-right:1px}
 .ctWatchHead{margin-top:4px;align-items:flex-start;flex-direction:column}
 .ctWatchHead h2{font-size:18px}
 .ctWatchControls{gap:5px;margin-top:7px}
 .ctWatchCtl{padding:7px 10px;font-size:9px}
 .ctWatchRow{grid-template-columns:28px minmax(0,1fr) auto;padding:10px 9px;gap:7px}
 .ctWatchName{font-size:11px}
 .ctWatchRight{min-width:84px}
 .ctWatchSelected{font-size:15px}
 .ctWatchMiniGrid{gap:3px}
 .ctWatchMini{padding:5px 4px;font-size:8px}
}
`;
  document.head.appendChild(st);
}

function ensureUI(){
  ensureStyle();
  const tabs=document.querySelector('.tabs');
  if(tabs&&!tabs.querySelector('.tab[data-tab="watchlist"]')){
    const t=document.createElement('div');
    t.className='tab';t.dataset.tab='watchlist';t.textContent='워치리스트';t.title='시황 참고 · Watchlist';
    t.addEventListener('click',()=>{if(typeof window.activateTab==='function')window.activateTab('watchlist');else{document.querySelectorAll('.tabPanel').forEach(x=>x.classList.remove('on'));document.getElementById('panel-watchlist')?.classList.add('on')}});
    const tp=tabs.querySelector('.tab[data-tab="tripod"]');
    if(tp&&tp.nextSibling)tabs.insertBefore(t,tp.nextSibling);else tabs.appendChild(t);
  }
  if(!document.getElementById('panel-watchlist')){
    const p=document.createElement('div');p.id='panel-watchlist';p.className='tabPanel';
    const app=document.querySelector('.app')||document.querySelector('.container')||document.body;app.appendChild(p);
  }
}

function priceText(x){
  const v=n(x.current_price);if(v==null)return '현재가 —';
  if(String(x.market)==='KR')return '₩'+Math.round(v).toLocaleString('ko-KR');
  return '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function sortLabel(){return {day_return_pct:'1D',ret_5d_pct:'5D',ret_10d_pct:'10D',ret_20d_pct:'20D'}[SORT]||'1D'}
function selectedValue(x){return n(x[SORT])}
function rowHtml(x,i){
  const v=selectedValue(x);
  const tags=[];
  if(x.is_held)tags.push(`<span class="ctWatchTag held">보유${x.account?' · '+x.account:''}</span>`);
  if(x.theme&&x.theme!=='ETC')tags.push(`<span class="ctWatchTag">${x.theme}</span>`);
  const cats=(x.categories||[]).slice(0,2);cats.forEach(c=>tags.push(`<span class="ctWatchTag">${String(c).replaceAll('_',' ')}</span>`));
  const metrics=[['1D',x.day_return_pct],['5D',x.ret_5d_pct],['10D',x.ret_10d_pct],['20D',x.ret_20d_pct]];
  return `<div class="ctWatchRow">
    <div class="ctWatchRank">${i+1}</div>
    <div><div class="ctWatchName">${x.name||x.ticker}</div><div class="ctWatchTicker">${x.ticker||''} · ${x.quote_source||'RADAR'}</div><div class="ctWatchTags">${tags.join('')}</div></div>
    <div class="ctWatchRight"><div class="ctWatchPrice">${priceText(x)}</div><div class="ctWatchSelected ${tone(v)}">${pct(v)}</div></div>
    <div class="ctWatchMiniGrid">${metrics.map(([k,val])=>`<div class="ctWatchMini ${tone(val)}"><b>${k}</b>${pct(val)}</div>`).join('')}</div>
  </div>`;
}

function render(){
  ensureUI();
  const p=document.getElementById('panel-watchlist');if(!p)return;
  const w=(LIVE||{}).watchlist||{};
  const list=Array.isArray(MARKET==='KR'?w.kr:w.us)?[...(MARKET==='KR'?w.kr:w.us)]:[];
  list.sort((a,b)=>z(b[SORT])-z(a[SORT]));
  const sync=String(w.sync_kst||'—').replace('T',' ').slice(0,16);
  const observed=String((LIVE||{}).observed_at||'—').replace('T',' ').slice(5,16);
  const liveCount=list.filter(x=>x.quote_live).length;
  const sortButtons=[['day_return_pct','1D'],['ret_5d_pct','5D'],['ret_10d_pct','10D'],['ret_20d_pct','20D']];
  p.innerHTML=`
    <div class="ctWatchHead"><div><h2>워치리스트 시황</h2><div class="ctWatchSub">한국장/미국장 분리 · 선택 기간 수익률 내림차순 · 1D는 가능한 종목 현재 시세 재평가</div></div><div class="ctWatchSub">RADAR ${sync} · FEED ${observed}</div></div>
    <div class="ctWatchControls">
      <button class="ctWatchCtl ${MARKET==='KR'?'on':''}" data-watch-market="KR">한국장 ${Number(w.kr_count||0)}개</button>
      <button class="ctWatchCtl ${MARKET==='US'?'on':''}" data-watch-market="US">미국장 ${Number(w.us_count||0)}개</button>
      ${sortButtons.map(([k,l])=>`<button class="ctWatchCtl ${SORT===k?'on':''}" data-watch-sort="${k}">${l} 수익률순</button>`).join('')}
    </div>
    <div class="ctWatchCard">
      <div class="ctWatchMeta"><span>${MARKET==='KR'?'한국장':'미국장'} · ${sortLabel()} 기준 DESC</span><span>현재시세 ${liveCount}/${list.length}</span></div>
      <div class="ctWatchRows">${list.length?list.map(rowHtml).join(''):`<div class="ctWatchEmpty">워치리스트 데이터가 아직 새 Feed에 반영되지 않았습니다.<br>다음 10분 Feed 갱신 후 자동 표시됩니다.</div>`}</div>
    </div>`;
  p.querySelectorAll('[data-watch-market]').forEach(b=>b.onclick=()=>{MARKET=b.dataset.watchMarket;render()});
  p.querySelectorAll('[data-watch-sort]').forEach(b=>b.onclick=()=>{SORT=b.dataset.watchSort;render()});
}

async function refresh(){
  try{
    ensureUI();
    const password=sessionStorage.getItem('jjooni_ct_session_pw');if(!password)return;
    const kv=await loadGviz();
    const env=JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}');
    LIVE=await decryptEnvelope(env,password);
    render();
  }catch(e){
    console.warn('CT watchlist bridge',e);
    ensureUI();render();
  }
}

ensureUI();render();refresh();setInterval(refresh,REFRESH_MS);
})();
