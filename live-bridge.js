(function(){
  'use strict';
  const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
  const TAB='GITHUB_CT_LIVE';
  const REFRESH_MS=60000;
  const MAX_LIVE_AGE_MS=20*60*1000;

  const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));
  const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');

  async function decryptEnvelope(env,password){
    const raw=await crypto.subtle.importKey(
      'raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']
    );
    const key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:b64(env.salt),iterations:Number(env.iterations),hash:'SHA-256'},
      raw,{name:'AES-GCM',length:256},false,['decrypt']
    );
    const plain=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:b64(env.nonce),additionalData:b64(env.aad),tagLength:128},
      key,b64(env.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function loadGviz(){
    return new Promise((resolve,reject)=>{
      const cb='__jjooniCtLive_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const s=document.createElement('script');
      let done=false;
      const finish=(err,val)=>{
        if(done)return; done=true;
        try{delete window[cb]}catch(e){}
        try{s.remove()}catch(e){}
        clearTimeout(timer);
        err?reject(err):resolve(val);
      };
      window[cb]=(resp)=>{
        try{
          const out={};
          const rows=(((resp||{}).table||{}).rows)||[];
          rows.forEach(r=>{
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
        '/gviz/tq?sheet='+encodeURIComponent(TAB)+
        '&tqx='+encodeURIComponent('responseHandler:'+cb)+
        '&_='+Date.now();
      document.head.appendChild(s);
    });
  }

  function ensureBadge(){
    let el=document.getElementById('ctEncryptedLiveBadge');
    if(el)return el;
    el=document.createElement('div');
    el.id='ctEncryptedLiveBadge';
    el.style.cssText='position:fixed;right:12px;bottom:72px;z-index:10000;padding:6px 9px;border-radius:999px;background:#ecfdf3;border:1px solid #abefc6;color:#087443;font:800 10px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px #0002';
    document.body.appendChild(el);
    return el;
  }

  function setBadge(text,state,title){
    const badge=ensureBadge();
    badge.textContent=text;
    badge.title=title||'';
    if(state==='good'){
      badge.style.background='#ecfdf3';badge.style.borderColor='#abefc6';badge.style.color='#087443';
    }else if(state==='warn'){
      badge.style.background='#fff7ed';badge.style.borderColor='#fed7aa';badge.style.color='#b45309';
    }else{
      badge.style.background='#fff1f2';badge.style.borderColor='#fecdd3';badge.style.color='#be123c';
    }
  }

  function applyAi(live){
    const a=((live.accounts||{}).AI)||null;
    if(!a||String(a.status||'').toUpperCase()!=='LIVE')return false;
    D.ai=D.ai||{};
    D.ai.latest=D.ai.latest||{};
    D.ai.latest.nav=Number(a.nav||0);
    D.ai.latest.kr_nav=Number(a.nav||0);
    D.ai.latest.cash=Number(a.cash||0);
    D.ai.latest.holdings_kr=Array.isArray(a.holdings)?a.holdings:[];
    D.ai.latest.holdings_kr_source='KIS_ENCRYPTED_LIVE';
    D.ai.latest.observed_at=String(live.observed_at||'');
    D.ai.latest_source_status='KIS_ENCRYPTED_LIVE';
    D.ai.live_bridge={status:'LIVE',observed_at:String(live.observed_at||''),source:'KIS_READ_ONLY'};
    return true;
  }

  function mergeHumanPosition(id,p,observedAt){
    D.human=D.human||{};
    D.human.positions=Array.isArray(D.human.positions)?D.human.positions:[];
    const key=sym(p.ticker||p.symbol);
    const idx=D.human.positions.findIndex(x=>
      String(x.account||x.account_type||'').toUpperCase()===id && sym(x.ticker||x.symbol)===key
    );
    const merged={
      ...(idx>=0?D.human.positions[idx]:{}),
      ...p,
      account:id,
      account_type:id,
      current_price:Number(p.current_price||0),
      market_value:Number(p.market_value||0),
      avg_price:Number(p.avg_price||p.avg||0),
      live_price_timestamp:String(p.live_price_timestamp||observedAt||''),
      price_source:String(p.price_source||'KIS_MARKET_QUOTE'),
      data_state:String(p.data_state||'CURRENT')
    };
    if(idx>=0)D.human.positions[idx]=merged;
    else D.human.positions.push(merged);
  }

  function applyKbModeled(live){
    D.human=D.human||{};
    D.human.current_account_navs=D.human.current_account_navs||{};
    D.human.current_account_details=D.human.current_account_details||{};
    D.human.live_bridge_accounts=D.human.live_bridge_accounts||{};
    let modeled=0;
    ['ISA','PENSION','IRP'].forEach(id=>{
      const a=((live.accounts||{})[id])||null;
      if(!a)return;
      const st=String(a.status||'').toUpperCase();
      if(!['MODELED_LIVE','PARTIAL_MODELED'].includes(st))return;
      D.human.current_account_navs[id]=Number(a.nav||0);
      D.human.current_account_details[id]={
        ...(D.human.current_account_details[id]||{}),
        cash_residual:Number(a.cash||0),
        live_mode:st,
        live_observed_at:String(live.observed_at||''),
        source_snapshot_kst:String(a.source_snapshot_kst||live.source_snapshot_kst||''),
        quote_coverage_pct:a.quote_coverage_pct==null?null:Number(a.quote_coverage_pct)
      };
      (Array.isArray(a.positions)?a.positions:[]).forEach(p=>mergeHumanPosition(id,p,live.observed_at));
      D.human.live_bridge_accounts[id]={status:st,nav:Number(a.nav||0),observed_at:String(live.observed_at||''),quote_coverage_pct:a.quote_coverage_pct};
      modeled++;
    });
    return modeled;
  }

  function applyLive(live){
    if(!live||!['JJOONI_CT_LIVE_V1','JJOONI_CT_LIVE_V2'].includes(String(live.schema||'')))throw new Error('LIVE_SCHEMA_MISMATCH');
    if(typeof D==='undefined')throw new Error('CONTROL_TOWER_DATA_MISSING');

    const aiOk=applyAi(live);
    const kbCount=String(live.schema)==='JJOONI_CT_LIVE_V2'?applyKbModeled(live):0;
    if(typeof render==='function')render();

    const ts=Date.parse(String(live.observed_at||''));
    const age=Number.isFinite(ts)?Date.now()-ts:Infinity;
    const t=String(live.observed_at||'').replace('T',' ').slice(5,16);
    if(age>MAX_LIVE_AGE_MS){
      setBadge('FEED STALE · '+(t||'—'),'bad','Encrypted feed is older than 20 minutes');
    }else if(aiOk&&kbCount===3){
      setBadge('AI LIVE · KB 3 MODEL · '+(t||'—'),'good','AI = broker direct; ISA/PENSION/IRP = latest PB positions repriced with KIS quotes');
    }else if(aiOk){
      setBadge('AI LIVE · KB '+kbCount+'/3 · '+(t||'—'),'warn','Partial encrypted feed');
    }else{
      setBadge('LIVE FEED PARTIAL · '+(t||'—'),'warn','AI direct feed unavailable');
    }
  }

  async function refresh(){
    try{
      const password=sessionStorage.getItem('jjooni_ct_session_pw');
      if(!password)return;
      const kv=await loadGviz();
      if(!['JJOONI_CT_LIVE_ENCRYPTED_V1','JJOONI_CT_LIVE_ENCRYPTED_V2'].includes(String(kv.SCHEMA||'')))throw new Error('ENVELOPE_SCHEMA_MISMATCH');
      const env=JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}');
      const live=await decryptEnvelope(env,password);
      applyLive(live);
    }catch(e){
      setBadge('LIVE FEED WAIT','warn',String((e&&e.message)||e||'live bridge error').slice(0,160));
      console.warn('CT encrypted live bridge',e);
    }
  }

  refresh();
  setInterval(refresh,REFRESH_MS);
})();
