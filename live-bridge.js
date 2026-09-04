(function(){
  'use strict';
  const SHEET_ID='1t8TNfIHxSIc_uoSxAgmSbkqCz00923nF1u-b6jlCgYE';
  const TAB='GITHUB_CT_LIVE';
  const REFRESH_MS=60000;

  const b64=s=>Uint8Array.from(atob(String(s||'')),c=>c.charCodeAt(0));

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
    el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:10000;padding:6px 9px;border-radius:999px;background:#ecfdf3;border:1px solid #abefc6;color:#087443;font:800 10px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 4px 14px #0002';
    document.body.appendChild(el);
    return el;
  }

  function applyAiLive(live){
    if(!live||live.schema!=='JJOONI_CT_LIVE_V1')throw new Error('LIVE_SCHEMA_MISMATCH');
    const a=((live.accounts||{}).AI)||null;
    if(!a||String(a.status||'').toUpperCase()!=='LIVE')throw new Error('AI_NOT_LIVE');
    if(typeof D==='undefined')throw new Error('CONTROL_TOWER_DATA_MISSING');

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

    if(typeof render==='function')render();

    const badge=ensureBadge();
    const t=String(live.observed_at||'').replace('T',' ').slice(5,16);
    badge.textContent='AI LIVE · '+(t||'KIS');
    badge.title='Encrypted browser live feed · KIS READ ONLY';
  }

  async function refresh(){
    try{
      const password=sessionStorage.getItem('jjooni_ct_session_pw');
      if(!password)return;
      const kv=await loadGviz();
      if(kv.SCHEMA!=='JJOONI_CT_LIVE_ENCRYPTED_V1')throw new Error('ENVELOPE_SCHEMA_MISMATCH');
      const env=JSON.parse(kv.ENCRYPTED_PAYLOAD||'{}');
      const live=await decryptEnvelope(env,password);
      applyAiLive(live);
    }catch(e){
      const badge=ensureBadge();
      badge.textContent='AI FEED WAIT';
      badge.style.background='#fff7ed';
      badge.style.borderColor='#fed7aa';
      badge.style.color='#b45309';
      badge.title=String((e&&e.message)||e||'live bridge error').slice(0,160);
      console.warn('CT encrypted live bridge',e);
    }
  }

  refresh();
  setInterval(refresh,REFRESH_MS);
})();
