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

function ensureRetirementStyle(){
  if(document.getElementById('ctAutobotRetirementStyleV2'))return;
  const st=document.createElement('style');
  st.id='ctAutobotRetirementStyleV2';
  st.textContent=`
html body .tabs .tab[data-tab="ai"],
html body .tabs .tab[data-tab="cost"],
html body #panel-ai,
html body #panel-cost,
html body #ctAutobotAuditBoardV1{display:none!important}`;
  (document.head||document.documentElement).appendChild(st);
}

function isRetiredAccountCard(card){
  if(!card)return false;
  const attrs=[
    card.getAttribute('data-account'),
    card.getAttribute('data-account-id'),
    card.getAttribute('data-ct-account')
  ].filter(Boolean).join(' ').toUpperCase();
  if(/(^|\s)(AI|AUTOBOT)(\s|$)/.test(attrs))return true;
  const name=card.querySelector('.ctAcctName,.v2AccountName,[data-account-name]');
  const text=String((name||card).textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
  return text.includes('AI BOT')||text.includes('AUTOBOT');
}

function hideRetiredAccountCards(){
  document.querySelectorAll('.ctAcct,.v2Account,[data-account],[data-account-id],[data-ct-account]').forEach(card=>{
    if(isRetiredAccountCard(card))hide(card);
  });
}

function retireUi(){
  try{
    const active=sessionStorage.getItem(KEY);
    if(active==='ai'||active==='cost')sessionStorage.setItem(KEY,'overview');
  }catch(_){}

  ensureRetirementStyle();
  hide(document.querySelector('.tab[data-tab="ai"]'));
  hide(document.getElementById('panel-ai'));
  hide(document.querySelector('.tab[data-tab="cost"]'));
  hide(document.getElementById('panel-cost'));

  const audit=document.getElementById('ctAutobotAuditBoardV1');
  if(audit)hide(audit);
  const auditStyle=document.getElementById('ctAutobotAuditStyleV1');
  if(auditStyle)hide(auditStyle);

  // Do not show the retired AUTOBOT / AI account as a card on the overview.
  // The underlying brokerage account remains in canonical NAV/account math so
  // removing the card cannot understate total assets or alter broker data.
  hideRetiredAccountCards();

  window.__JJOONI_AUTOBOT_RETIRED_V1={
    state:'RETIRED',
    version:'2.0',
    retired_at:RETIRED_AT,
    operational_ui:false,
    audit_polling:false,
    cost_dashboard:false,
    overview_account_card:false,
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
    attributeFilter:['class','style','hidden','data-account','data-account-id','data-ct-account']
  });
}catch(_){}
document.addEventListener('jjooni:live-applied',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});
})();
