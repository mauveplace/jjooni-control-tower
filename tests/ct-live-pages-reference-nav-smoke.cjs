// Public-origin production smoke: no browser approval key, no private financial data.
// Unlike synthetic E2E, this checks EXACT GitHub Pages CDN delivery after deploy.
'use strict';
const assert=require('node:assert/strict');
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
 const [index,js,css]=await Promise.all([
  fetchText('?ctui=v2'),fetchText('ct-reference-nav-history-v1.js?v=2'),fetchText('ct-reference-nav-history-v1.css?v=2')
 ]);
 assert(index.includes('ct-reference-nav-history-v1.js?v=2'),'PAGES_ENTRY_OLD_REFERENCE_SCRIPT');
 assert(index.includes('ct-human-v2.js?v=2'),'PAGES_ENTRY_MISSING_V2');
 assert(index.includes('ct-performance-history-v1.js?v=1'),'PAGES_ENTRY_MISSING_VERIFIED_HISTORY');
 assert(js.includes('function overviewShortcut(report)'),'LIVE_JS_MISSING_OVERVIEW_LINK');
 assert(js.includes('그래프 보기 · 성과 탭'),'LIVE_JS_MISSING_PERFORMANCE_NAV');
 assert(js.includes("tab.click()"),'LIVE_JS_MISSING_REAL_TAB_ACTION');
 assert(js.includes("'#panel-compare'"),'LIVE_JS_MISSING_PERFORMANCE_TARGET');
 assert(js.includes("overviewShortcut(report);"),'LIVE_JS_MISSING_UPDATE_HOOK');
 assert(js.includes('참고 NAV 검증 대기'),'LIVE_JS_MISSING_NO_DATA_DISCLOSURE');
 assert(css.includes('ctReferenceNavOverviewV1'),'LIVE_CSS_MISSING_OVERVIEW_CARD');
 assert(css.includes('@media(max-width:479px)'),'LIVE_CSS_MISSING_PHONE_LAYOUT');
 new Function(js);
 const expected={production_shell:true,reference_js_current:true,reference_css_current:true,
                   direct_performance_navigation:true,reference_no_data_fail_closed:true,
                   approved_browser_decryption:'NOT_TESTED',private_nav_values_logged:false};
 console.log('CT_LIVE_PAGES_REFERENCE_NAV_DISCOVERY=PASS '+JSON.stringify(expected));
})().catch(e=>{console.error('CT_LIVE_PAGES_REFERENCE_NAV_DISCOVERY=FAIL '+e.message);process.exit(1)});
