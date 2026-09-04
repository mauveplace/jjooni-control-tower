(function(){
  'use strict';
  const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
  const TAB='GITHUB_CT_LIVE';
  const REFRESH_MS=60000;
  const MAX_LIVE_AGE_MS=20*60*1000;

  const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
  const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const won=v=>'₩'+Math.round(Math.abs(n(v))).toLocaleString('ko-KR');
  const swon=v=>(n(v)>=0?'+':'-')+won(v);
  const usd=v=>'$'+n(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>Number.isFinite(Number(v))?(n(v)>=0?'+':'')+n(v).toFixed(2)+'%':'—';

  async function decryptEnvelope(env,password){
    const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:b64(env.salt),iterations:Number(env.iterations),hash:'SHA-256'},
      raw,{name:'AES-GCM',length:256},false,['decrypt']
    );
    const plain=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:b64(env.nonce),additionalData:b64(env.aad),tagLength:128},key,b64(env.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function loadGviz(){
    return new Promise((resolve,reject)=>{
      const cb='__jjooniCtLive_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const s=document.createElement('script');
      let done=false;
      const finish=(err,val)=>{
        if(done)return;done=true;
        try{delete window[cb]}catch(e){}
        try{s.remove()}catch(e){}
        clearTimeout(timer);
        err?reject(err):resolve(val);
      };
      window[cb]=(resp)=>{
        try{
          const out={};
          ((((resp||{}).table||{}).rows)||[]).forEach(r=>{
            const c=r.c||[];
            const k=c[0]&&c[0].v!=null?String(c[0].v):'';
            const v=c[1]&&c[1].v!=null?String(c[1].v):'';
            if(k)out[k]=v;
          });
          finish(null,out);
        }catch(e){finish(e)}
      };
      const timer=setTimeout(()=>finish(new Error('GVIZ_TIMEOUT')),15000);
      s.onerror=()=>finish(new Error('GVIZ_LOAD_FAIL'));
      s.src='https://docs.google.com/spreadsheets/d/'+SHEET_ID+
        '/gviz/tq?sheet='+encodeURIComponent(TAB)+'&tqx='+encodeURIComponent('responseHandler:'+cb)+'&_='+Date.now();
      document.head.appendChild(s);
    });
  }

  function ensureBadge(){
    let el=document.getElementById('ctEncryptedLiveBadge');
    if(el)return el;
    el=document.createElement('div');
    el.id='ctEncryptedLiveBadge';
    el.style.cssText='position:fixed;right:12px;bottom:72px;z-index:10000;padding:6px 9px;border-radius:999px;background:#ecfdf3;border:1px solid #abefc6;color:#087443;font:800 10px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px #0002;max-width:92vw;white-space:nowrap';
    document.body.appendChild(el);
    return el;
  }

  function setBadge(text,state,title){
    const badge=ensureBadge();badge.textContent=text;badge.title=title||'';
    if(state==='good'){badge.style.background='#ecfdf3';badge.style.borderColor='#abefc6';badge.style.color='#087443';}
    else if(state==='warn'){badge.style.background='#fff7ed';badge.style.borderColor='#fed7aa';badge.style.color='#b45309';}
    else{badge.style.background='#fff1f2';badge.style.borderColor='#fecdd3';badge.style.color='#be123c';}
  }

  function kstParts(v){
    const d=new Date(v||Date.now());if(Number.isNaN(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const m={};parts.forEach(x=>{if(x.type!=='literal')m[x.type]=x.value;});
    return {ymd:`${m.year}-${m.month}-${m.day}`,weekday:m.weekday||'',minuteOfDay:Number(m.hour||0)*60+Number(m.minute||0)};
  }

  function prevWeekdayIso(v){
    let d=new Date(v||Date.now());
    for(let i=0;i<4;i++){
      d=new Date(d.getTime()-86400000);
      const wd=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(d);
      if(wd!=='Sat'&&wd!=='Sun')return new Date(d.getTime()).toISOString();
    }
    return new Date(Date.now()-86400000).toISOString();
  }

  function installSessionMetricFilter(){
    if(window.__jjooniSessionMetricFilterInstalled||typeof window.buildRegularSessionMetrics!=='function')return;
    const original=window.buildRegularSessionMetrics;
    window.buildRegularSessionMetrics=function(){
      const H=(typeof D!=='undefined'&&D.human)||{};const saved=H.positions;
      try{
        if(Array.isArray(saved))H.positions=saved.filter(p=>String(p.record_type||p.RECORD_TYPE||'POSITION').toUpperCase()!=='FUND');
        return original();
      }finally{H.positions=saved;}
    };
    window.__jjooniSessionMetricFilterInstalled=true;
  }

  function publishQuoteSurface(id,p,observedAt){
    const rt=String(p.record_type||p.RECORD_TYPE||'POSITION').toUpperCase();
    const px=n(p.current_price||p.price);if(rt!=='POSITION'||!(px>0))return;
    const key=sym(p.ticker||p.symbol);if(!key)return;
    D.human=D.human||{};D.human.trade_quotes=D.human.trade_quotes||{};
    D.human.trade_quotes[key]={...(D.human.trade_quotes[key]||{}),price:px,timestamp:String(p.live_price_timestamp||observedAt||''),source:String(p.price_source||'KIS_MARKET_QUOTE'),currency:String(p.currency||'KRW'),account:id};

    D.human.session_reference_prices=D.human.session_reference_prices||{};
    const arr=Array.isArray(D.human.session_reference_prices[key])?D.human.session_reference_prices[key]:[];
    let kept=[...arr];
    const prev=n(p.prev_close);
    if(prev>0){
      const pts=prevWeekdayIso(p.live_price_timestamp||observedAt);
      kept=kept.filter(x=>!(sym(x&&x.ticker||key)===key&&String(x&&x.source||'').startsWith('KIS_PREV_CLOSE')));
      kept.push({close:prev,timestamp:pts,source:'KIS_PREV_CLOSE_BRIDGE',account:id,fx_rate:n(p.current_fx||0)||undefined});
    }
    const k=kstParts(p.live_price_timestamp||observedAt);
    if(k&&!['Sat','Sun'].includes(k.weekday)&&k.minuteOfDay>=930){
      kept=kept.filter(x=>{
        const xp=kstParts(x&&x.timestamp);return !(xp&&xp.ymd===k.ymd&&String(x&&x.source||'').startsWith('KIS_CURRENT'));
      });
      kept.push({close:px,timestamp:String(p.live_price_timestamp||observedAt||''),source:'KIS_CURRENT_BRIDGE',account:id,fx_rate:n(p.current_fx||0)||undefined});
    }
    D.human.session_reference_prices[key]=kept.sort((a,b)=>String(a.timestamp||'').localeCompare(String(b.timestamp||'')));
  }

  function applyAi(live){
    const a=((live.accounts||{}).AI)||null;if(!a||String(a.status||'').toUpperCase()!=='LIVE')return false;
    D.ai=D.ai||{};D.ai.latest=D.ai.latest||{};
    const L=D.ai.latest;
    L.nav=n(a.nav);L.kr_nav=n(a.kr_nav);L.us_nav=n(a.us_nav_krw);L.us_nav_krw=n(a.us_nav_krw);
    L.cash=n(a.cash);L.cash_krw=n(a.cash_krw);L.cash_usd=n(a.cash_usd);L.cash_usd_krw=n(a.cash_usd_krw);L.fx=n(a.fx_krw_per_usd);
    L.holdings_kr=Array.isArray(a.holdings_kr)?a.holdings_kr:(Array.isArray(a.holdings)?a.holdings:[]);
    L.holdings_us=Array.isArray(a.holdings_us)?a.holdings_us:[];
    L.holdings_kr_source='KIS_ENCRYPTED_LIVE_V3';L.holdings_us_source='KIS_ENCRYPTED_LIVE_V3';L.observed_at=String(live.observed_at||'');
    D.ai.latest_source_status='KIS_ENCRYPTED_LIVE_V3';
    D.ai.live_bridge={status:'LIVE',observed_at:String(live.observed_at||''),source:'KIS_READ_ONLY_KR+OVERSEAS'};
    return true;
  }

  function mergeHumanPosition(id,p,observedAt){
    D.human=D.human||{};D.human.positions=Array.isArray(D.human.positions)?D.human.positions:[];
    const key=sym(p.ticker||p.symbol);
    const idx=D.human.positions.findIndex(x=>String(x.account||x.account_type||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===id.replace(/[^A-Z0-9]/g,'')&&sym(x.ticker||x.symbol)===key);
    const merged={...(idx>=0?D.human.positions[idx]:{}),...p,account:id,account_type:id,record_type:String(p.record_type||p.RECORD_TYPE||(idx>=0?D.human.positions[idx].record_type:'POSITION')||'POSITION').toUpperCase(),current_price:n(p.current_price),market_value:n(p.market_value),avg_price:n(p.avg_price||p.avg),live_price_timestamp:String(p.live_price_timestamp||observedAt||''),price_source:String(p.price_source||'KIS_MARKET_QUOTE'),data_state:String(p.data_state||'CURRENT')};
    if(idx>=0)D.human.positions[idx]=merged;else D.human.positions.push(merged);
    publishQuoteSurface(id,merged,observedAt);
  }

  function applyKbModeled(live){
    D.human=D.human||{};D.human.current_account_navs=D.human.current_account_navs||{};D.human.current_account_details=D.human.current_account_details||{};D.human.live_bridge_accounts=D.human.live_bridge_accounts||{};
    let modeled=0;
    ['ISA','PENSION','IRP'].forEach(id=>{
      const a=((live.accounts||{})[id])||null;if(!a)return;
      const st=String(a.status||'').toUpperCase();if(!['MODELED_LIVE','PARTIAL_MODELED'].includes(st))return;
      D.human.current_account_navs[id]=n(a.nav);
      D.human.current_account_details[id]={...(D.human.current_account_details[id]||{}),cash_residual:n(a.cash),cash_krw:n(a.cash_krw||a.cash),live_mode:st,live_observed_at:String(live.observed_at||''),source_snapshot_kst:String(a.source_snapshot_kst||live.source_snapshot_kst||''),quote_coverage_pct:a.quote_coverage_pct==null?null:n(a.quote_coverage_pct)};
      (Array.isArray(a.positions)?a.positions:[]).forEach(p=>mergeHumanPosition(id,p,live.observed_at));
      D.human.live_bridge_accounts[id]={status:st,nav:n(a.nav),observed_at:String(live.observed_at||''),quote_coverage_pct:a.quote_coverage_pct};modeled++;
    });
    return modeled;
  }

  function applyTossReference(live){
    const a=((live.accounts||{}).TOSS)||null;if(!a)return false;
    D.human=D.human||{};D.human.current_account_details=D.human.current_account_details||{};D.human.live_bridge_accounts=D.human.live_bridge_accounts||{};
    D.human.current_account_details.TOSS={...(D.human.current_account_details.TOSS||{}),cash_krw:n(a.cash_krw),cash_usd:n(a.cash_usd),cash_reference_status:String(a.status||'REFERENCE_STALE'),cash_sync_krw:String(a.cash_sync_krw||''),cash_sync_usd:String(a.cash_sync_usd||''),cash_source:String(a.source||'DB_CASH_LEDGER_LAST_KNOWN')};
    D.human.live_bridge_accounts.TOSS={status:String(a.status||'REFERENCE_STALE'),observed_at:String(live.observed_at||''),cash_only:true};
    return true;
  }

  function applyTripod(live){
    const a=((live.accounts||{}).TRIPOD)||null;if(!a)return false;
    D.human=D.human||{};D.human.tripod_positions=Array.isArray(a.positions)?a.positions:[];D.human.tripod_master_ok=D.human.tripod_positions.length>0;
    const pos=D.human.tripod_positions[0]||{};
    D.human.tripod_market={ticker:'TQQQ',current_price:n(a.current_price),prev_close:n(a.prev_close),fx:n(a.fx),previous_fx:n(a.previous_fx)||n(a.fx),currency:'USD',current_price_source:'PUBLIC_MARKET_MODEL',quote_timestamp:String(live.observed_at||'')};
    D.human.tripod_signal=a.signal||live.tripod_signal||{};
    D.human.trade_quotes=D.human.trade_quotes||{};
    if(n(a.current_price)>0)D.human.trade_quotes.TQQQ={price:n(a.current_price),timestamp:String(live.observed_at||''),source:'TRIPOD_PUBLIC_MARKET',currency:'USD',account:'TRIPOD'};
    if(pos&&n(pos.current_price)>0)publishQuoteSurface('TRIPOD',{...pos,record_type:'POSITION',currency:'USD',market:'US',prev_close:n(a.prev_close),current_price:n(a.current_price),live_price_timestamp:String(live.observed_at||''),price_source:'TRIPOD_PUBLIC_MARKET'},live.observed_at);
    return true;
  }

  function cardByName(needle){
    const want=String(needle).toLowerCase();
    return [...document.querySelectorAll('.ctAcct')].find(c=>String((c.querySelector('.ctAcctName')||{}).textContent||'').toLowerCase().includes(want))||null;
  }

  function upsertCardLine(card,id,html,color){
    if(!card)return;
    let el=card.querySelector('#'+id);if(!el){el=document.createElement('div');el.id=id;el.style.cssText='grid-column:1/-1;font:800 9px/1.35 system-ui,-apple-system,sans-serif;margin-top:4px;padding-top:4px;border-top:1px dashed #e7ebf0;text-align:right;white-space:normal';card.appendChild(el);}el.style.color=color||'#667085';el.innerHTML=html;
  }

  function patchCashAndTripodUI(live){
    const accts=live.accounts||{};
    const t=accts.TOSS||{};
    upsertCardLine(cardByName('toss'),'ctTossCashLine',`예수금 <b>KRW ${won(t.cash_krw||0)}</b> · <b>USD ${usd(t.cash_usd||0)}</b> · <span style="color:#b45309">REF</span>`,'#667085');

    const a=accts.AI||{};
    upsertCardLine(cardByName('ai bot'),'ctAiCashLine',`예수금 <b>KRW ${won(a.cash_krw||0)}</b> · <b>USD ${usd(a.cash_usd||0)}</b> · <span style="color:#087443">LIVE</span>`,'#667085');

    const tp=accts.TRIPOD||{};const sig=tp.signal||live.tripod_signal||{};
    const tpText=`TQQQ ${n(tp.qty).toLocaleString('en-US',{maximumFractionDigits:4})}주 · ${usd(tp.current_price||0)} · ${pct(tp.today_return)} · <span style="color:#175cd3">${String(sig.regime||'—')} / ${String(sig.target||'—')}</span>`;
    upsertCardLine(cardByName('tri-pod'),'ctTripodLine',tpText,'#667085');

    ['ISA','연금저축','IRP'].forEach((name,i)=>{
      const id=['ISA','PENSION','IRP'][i];const x=accts[id]||{};
      upsertCardLine(cardByName(name),'ct'+id+'CashLine',`예수금 <b>${won(x.cash_krw||x.cash||0)}</b> · <span style="color:#175cd3">MODEL</span>`,'#667085');
    });
  }

  function patchTodayAccountingUI(){
    if(typeof window.buildTodayAccounting!=='function')return;
    let T;try{T=window.buildTodayAccounting();}catch(e){return;}
    const map={TOSS:'toss',ISA:'isa',PENSION:'연금저축',IRP:'irp'};
    Object.entries(map).forEach(([id,name])=>{
      const x=((T||{}).accounts||{})[id];if(!x)return;
      const line=`오늘 순증 <b style="color:${n(x.nav_change)>=0?'#d92d3b':'#2167d5'}">${swon(x.nav_change)}</b> · 투자손익 <b>${swon(x.live_pnl)}</b> · 순입출금 <b>${swon(x.net_cash_flow)}</b>`;
      upsertCardLine(cardByName(name),'ctDayNet'+id,line,'#667085');
    });

    let strip=document.getElementById('ctTodayNetStrip');
    const container=document.querySelector('.ctOvMetaRow');
    if(!strip&&container&&container.parentNode){strip=document.createElement('div');strip.id='ctTodayNetStrip';strip.style.cssText='margin:0 2px 8px;padding:8px 10px;border:1px solid #e4e7ec;border-radius:10px;background:#fff;font:800 10px/1.45 system-ui,-apple-system,sans-serif;color:#475467';container.parentNode.insertBefore(strip,container.nextSibling);}
    if(strip){
      strip.innerHTML=`4 Human계좌 오늘 순증 <b style="color:${n(T.nav_change)>=0?'#d92d3b':'#2167d5'}">${swon(T.nav_change)}</b> · 투자손익 <b>${swon(T.live_pnl)}</b> · 순입출금 <b>${swon(T.net_cash_flow)}</b> <span style="color:#b45309">(Toss는 현재 REF)</span>`;
    }
  }

  function applyLive(live){
    if(!live||!['JJOONI_CT_LIVE_V1','JJOONI_CT_LIVE_V2','JJOONI_CT_LIVE_V3'].includes(String(live.schema||'')))throw new Error('LIVE_SCHEMA_MISMATCH');
    if(typeof D==='undefined')throw new Error('CONTROL_TOWER_DATA_MISSING');
    installSessionMetricFilter();
    const aiOk=applyAi(live);
    const kbCount=['JJOONI_CT_LIVE_V2','JJOONI_CT_LIVE_V3'].includes(String(live.schema))?applyKbModeled(live):0;
    const tossOk=String(live.schema)==='JJOONI_CT_LIVE_V3'?applyTossReference(live):false;
    const tpOk=String(live.schema)==='JJOONI_CT_LIVE_V3'?applyTripod(live):false;
    if(typeof render==='function')render();
    patchCashAndTripodUI(live);patchTodayAccountingUI();

    const ts=Date.parse(String(live.observed_at||''));const age=Number.isFinite(ts)?Date.now()-ts:Infinity;const t=String(live.observed_at||'').replace('T',' ').slice(5,16);
    if(age>MAX_LIVE_AGE_MS)setBadge('FEED STALE · '+(t||'—'),'bad','Encrypted feed older than 20 minutes');
    else if(aiOk&&kbCount===3&&tpOk)setBadge('AI LIVE · KB3 MODEL · TP MODEL · TOSS REF · '+(t||'—'),'good','AI=KIS broker direct KR+overseas; KB3=model live; TRI-POD=model live; Toss cash=last-known reference');
    else if(aiOk)setBadge('LIVE PARTIAL · KB '+kbCount+'/3 · '+(t||'—'),'warn','Partial encrypted feed');
    else setBadge('LIVE FEED PARTIAL · '+(t||'—'),'warn','AI direct feed unavailable');
  }

  async function refresh(){
    try{
      const password=sessionStorage.getItem('jjooni_ct_session_pw');if(!password)return;
      const kv=await loadGviz();
      if(!['JJOONI_CT_LIVE_ENCRYPTED_V1','JJOONI_CT_LIVE_ENCRYPTED_V2','JJOONI_CT_LIVE_ENCRYPTED_V3'].includes(String(kv.SCHEMA||'')))throw new Error('ENVELOPE_SCHEMA_MISMATCH');
      const env=JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}');const live=await decryptEnvelope(env,password);applyLive(live);
    }catch(e){setBadge('LIVE FEED WAIT','warn',String((e&&e.message)||e||'live bridge error').slice(0,160));console.warn('CT encrypted live bridge',e);}
  }

  refresh();setInterval(refresh,REFRESH_MS);
})();
