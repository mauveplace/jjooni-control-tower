(function(){
'use strict';
// AUTOBOT retirement guard.
// This file is intentionally still loaded by legacy live-bridge code with a
// cache-busting query string, making it the authoritative cleanup hook for old
// Control Tower shells that may still have cached AUTOBOT UI code.
const KEY='jjooni_ct_active_tab_v1';
const RETIRED_AT='2026-10-08';

function hide(el){
  if(!el)return;
  el.hidden=true;
  el.dataset.ctAutobotRetired='1';
  try{el.style.setProperty('display','none','important')}catch(_){}
}

function visibleAccountLabel(){
  document.querySelectorAll('.ctAcctName').forEach(el=>{
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
    if(!text.includes('AI BOT'))return;
    // Keep a hidden alias so legacy live-bridge card matching continues to work,
    // while the user-facing account is presented as a normal brokerage account.
    el.innerHTML='한국투자<span data-ct-autobot-alias="1" style="display:none!important"> AI BOT</span>';
    el.dataset.ctAutobotRetiredLabel='1';
  });
}

function retireUi(){
  try{
    const active=sessionStorage.getItem(KEY);
    if(active==='ai'||active==='cost')sessionStorage.setItem(KEY,'overview');
  }catch(_){}

  hide(document.querySelector('.tab[data-tab="ai"]'));
  hide(document.getElementById('panel-ai'));
  hide(document.querySelector('.tab[data-tab="cost"]'));
  hide(document.getElementById('panel-cost'));

  const audit=document.getElementById('ctAutobotAuditBoardV1');
  if(audit)hide(audit);
  const auditStyle=document.getElementById('ctAutobotAuditStyleV1');
  if(auditStyle)hide(auditStyle);

  visibleAccountLabel();

  window.__JJOONI_AUTOBOT_RETIRED_V1={
    state:'RETIRED',
    version:'1.0',
    retired_at:RETIRED_AT,
    operational_ui:false,
    audit_polling:false,
    cost_dashboard:false,
    account_asset_reporting:true,
    updated_at:new Date().toISOString()
  };
}

let queued=false;
function queue(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;retireUi()});
}

retireUi();
setTimeout(retireUi,100);
setTimeout(retireUi,600);
setTimeout(retireUi,1800);
setTimeout(retireUi,5000);
try{
  new MutationObserver(queue).observe(document.documentElement,{
    subtree:true,
    childList:true,
    characterData:true,
    attributes:true,
    attributeFilter:['class','style','hidden']
  });
}catch(_){}
document.addEventListener('jjooni:live-applied',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});
})();
