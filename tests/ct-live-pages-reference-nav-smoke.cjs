// Public-origin production smoke: no browser approval key, no private financial data.
// Unlike synthetic E2E, this checks EXACT GitHub Pages CDN delivery after deploy.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const VERIFIED_SCRIPT='ct-performance-history-v1.js?v=2';
const HUMAN_SCRIPT='ct-human-v2.js?v=6';
const humanGuard=script=>{assert(script.includes('const snapshotAligned=Boolean(C.snapshot_id&&L?.snapshot_id)&&String(C.snapshot_id)===String(L.snapshot_id);'),'HUMAN_SNAPSHOT_MISMATCH_GUARD_NOT_FOUND');assert(script.includes('⚠ 계좌 동기화 확인 대기')&&script.includes('⚠ 계좌 동기화 불일치'),'HUMAN_SYNC_COPY_NOT_CONDITIONAL');};
const navGuard=(script,style)=>{
 assert(script.includes('function syncNavigationOwner()'),'HUMAN_NAV_OWNER_MISSING');
 assert(script.includes("tabs.style.setProperty('display','none','important')"),'MOBILE_DUPLICATE_NAV_GUARD_MISSING');
 assert(script.includes("bottom.style.setProperty('display','none','important')"),'DESKTOP_DUPLICATE_NAV_GUARD_MISSING');
 assert(style.includes('html[data-ct-layout="mobile-first"][data-ct-human-ui="v2"] body nav.tabs'),
   'RESPONSIVE_NAV_GUARD_MISSING');
};
const guard=script=>{
 assert(script.includes('const near=(a,b)=>Math.abs(a-b)<=2;'),'PERF_BRIDGE_TOLERANCE_NOT_FIXED');
 assert(script.includes('zonedTime(history.verified_at_kst)'),'PERF_VERIFICATION_TIMEZONE_NOT_GATED');
};
const BASE='https://mauveplace.github.io/jjooni-control-tower/';
const fetchText=async path=>{
 const u=BASE+path+(path.includes('?')?'&':'?')+'ct_live_smoke='+Date.now();
 const r=await fetch(u,{redirect:'follow',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'PAGES_HTTP_FAILED '+path+' status '+r.status);
 const t=await r.text();
 assert(t.length>100,'EMPTY_ASSET '+path);
 return t;
};
(async()=>{
 if(process.env.GITHUB_EVENT_NAME==='pull_request'){
  // Pages has not deployed this PR. A local source contract is the truthful pre-merge check.
  const localIndex=fs.readFileSync('index.html','utf8');
  const localVerified=fs.readFileSync('ct-performance-history-v1.js','utf8');
  assert(localIndex.includes(VERIFIED_SCRIPT),'PR_ENTRY_MISSING_VERSIONED_PERFORMANCE_SCRIPT');
  guard(localVerified);
  assert(localIndex.includes(HUMAN_SCRIPT),'PR_ENTRY_MISSING_HUMAN_JS_CACHE_BUST');
  humanGuard(fs.readFileSync('ct-human-v2.js','utf8'));
  navGuard(fs.readFileSync('ct-human-v2.js','utf8'),fs.readFileSync('responsive-layout.css','utf8'));
  assert(localIndex.includes('responsive-layout.css?v=1.8-single-navigation'),'PR_ENTRY_MISSING_RESPONSIVE_CACHE_BUST');
  console.log('CT_PREDEPLOY_VERIFIED_HISTORY_ASSET=PASS');
  return;
 }
 // Post-merge Pages deploy may race this workflow: retry bounded, no background polling.
 let ready=false,index='',js='',css='',verified='',human='',responsive='';
 for(let attempt=0;attempt<10;attempt++){
  [index,js,css,verified,human,responsive]=await Promise.all([
   fetchText('?ctui=v2'),fetchText('ct-reference-nav-history-v1.js?v=2'),
   fetchText('ct-reference-nav-history-v1.css?v=2'),fetchText(VERIFIED_SCRIPT),fetchText(HUMAN_SCRIPT),fetchText('responsive-layout.css?v=1.8-single-navigation')
  ]);
  if(index.includes(VERIFIED_SCRIPT)&&index.includes(HUMAN_SCRIPT)&&verified.includes('zonedTime(history.verified_at_kst)')&&human.includes('const snapshotAligned=Boolean(C.snapshot_id&&L?.snapshot_id)&&String(C.snapshot_id)===String(L.snapshot_id);')&&responsive.includes('html[data-ct-layout="mobile-first"][data-ct-human-ui="v2"] body nav.tabs')){ready=true;break}
  if(attempt<9)await new Promise(resolve=>setTimeout(resolve,15000));
 }
 assert(ready,'PAGES_ENTRY_OR_ASSET_NOT_YET_DEPLOYED');
 guard(verified);
 humanGuard(human);
 navGuard(human,responsive);
 assert(index.includes('responsive-layout.css?v=1.8-single-navigation'),'PAGES_ENTRY_OLD_RESPONSIVE_LAYOUT');
 assert(index.includes('ct-reference-nav-history-v1.js?v=2'),'PAGES_ENTRY_OLD_REFERENCE_SCRIPT');
 assert(index.includes(HUMAN_SCRIPT),'PAGES_ENTRY_MISSING_V2');
 assert(index.includes(VERIFIED_SCRIPT),'PAGES_ENTRY_MISSING_VERIFIED_HISTORY');
 assert(js.includes('function overviewShortcut(report)'),'LIVE_JS_MISSING_OVERVIEW_LINK');
 assert(js.includes('그래프 보기 · 성과 탭'),'LIVE_JS_MISSING_PERFORMANCE_NAV');
 assert(js.includes("tab.click()"),'LIVE_JS_MISSING_REAL_TAB_ACTION');
 assert(js.includes("'#panel-compare'"),'LIVE_JS_MISSING_PERFORMANCE_TARGET');
 assert(js.includes("overviewShortcut(report);"),'LIVE_JS_MISSING_UPDATE_HOOK');
 assert(js.includes('참고 NAV 검증 대기'),'LIVE_JS_MISSING_NO_DATA_DISCLOSURE');
 assert(css.includes('ctReferenceNavOverviewV1'),'LIVE_CSS_MISSING_OVERVIEW_CARD');
 assert(css.includes('@media(max-width:479px)'),'LIVE_CSS_MISSING_PHONE_LAYOUT');
 new Function(js);
 new Function(verified);
 new Function(human);
 const expected={production_shell:true,reference_js_current:true,reference_css_current:true,
                   direct_performance_navigation:true,reference_no_data_fail_closed:true,
                   verified_history_js_current:true,strict_nav_bridge_and_time:true,human_snapshot_guard:true,
                   approved_browser_decryption:'NOT_TESTED',private_nav_values_logged:false};
 console.log('CT_LIVE_PAGES_REFERENCE_NAV_DISCOVERY=PASS '+JSON.stringify(expected));
})().catch(e=>{console.error('CT_LIVE_PAGES_REFERENCE_NAV_DISCOVERY=FAIL '+e.message);process.exit(1)});
