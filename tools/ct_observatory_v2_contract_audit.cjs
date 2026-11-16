'use strict';
// Cross-surface, read-only UI/UX contract audit for independent JJOONI ↔ ROY review.
// This is NOT an authenticated browser acceptance or investment-performance proof.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const OBS_TABS=['overview','indices','official-macro','rates','fx','energy','sectors',
 'tripod','jjooni-tripod','regime','calendar','morning-brief','analysis-lab'];
const OBS_LABELS=['오늘','시장','전략','일정','시황'];

function inspect(){
 const human=read('ct-human-v2.js'),humanCss=read('ct-human-v2.css');
 const legacyResponsive=read('responsive-layout.css');
 const rootHtml=read('index.html'),reference=read('ct-reference-nav-history-v1.js');
 const performance=read('ct-performance-history-v1.js');
 const obsHtml=read('market-observatory/index.html');
 const obsSource=read('market-observatory/observatory-nav-v2.js');
 const obsNav=require(path.join(ROOT,'market-observatory/observatory-nav-v2.js'));
 const sectors=JSON.parse(read('market-observatory/data/sector-rotation-brief.json'));

 assert.deepEqual(obsNav.IA.map(x=>x.label),OBS_LABELS,'V2 5-group contract drift');
 const flattened=obsNav.IA.flatMap(x=>x.tabs);
 assert.equal(new Set(flattened).size,13,'duplicate or missing Observatory tabs');
 assert.deepEqual([...flattened].sort(),[...OBS_TABS].sort(),'all old destinations must remain reachable');
 for(const tab of OBS_TABS)assert(obsNav.groupOf(tab),'orphan Observatory destination '+tab);
 assert.equal(obsNav.enabled('',null),true,'new visitors must default to V2');
 assert.equal(obsNav.enabled('?ui=v1','v2'),false,'V1 rollback must override storage');
 assert.equal(obsNav.enabled('?ui=v2','v1'),true,'V2 recovery must override storage');
 assert(obsHtml.includes('observatory-nav-v2.js'),'actual Observatory shell missing V2 nav');
 assert(obsSource.includes('body.navV2 #tabs{display:none!important}'),'V2 legacy menu hiding changed');
 assert(obsSource.includes('overflow-x:auto'),'mobile secondary tab scrolling missing');
 assert(obsSource.includes('safe-area-inset-bottom'),'bottom navigation must account for safe area');

 assert(rootHtml.includes('ct-human-v2.js?v=9-home-ux'),'Human V2 cache version drift');
 assert(rootHtml.includes('responsive-layout.css?v=1.8-single-navigation'),'legacy responsive cache version drift');
 assert(human.includes('function syncNavigationOwner()')&&human.includes("force(tabs,'none')")&&human.includes("force(bottom,'none')"),
   'single-nav viewport arbiter missing');
 assert(legacyResponsive.includes('html[data-ct-layout="mobile-first"][data-ct-human-ui="v2"] body .tabs'),
   'V2 mobile hide guard missing from competing responsive stylesheet');
 assert(legacyResponsive.includes('#ctMoreMenu'),'orphan legacy mobile popup needs suppression');
 assert(read('trade-review-loader.js').includes('humanV2.enforceNavigation()'),'legacy owner must delegate V2 visibility after tab mutations');
 assert(human.includes("attributeFilter:['class','style','aria-selected','data-tab']"),
   'Human V2 must reassert bottom-only nav after legacy inline style writes');
 assert(rootHtml.includes('ui-bootstrap-v1.js?v=5-home-tripod'),'entry must cache bust UI boot');
 assert(read('ui-bootstrap-v1.js').includes('boot-coordinator-v33.js?v=33.2-single-navigation'),
   'UI boot must cache bust boot coordinator');
 assert(read('boot-coordinator-v33.js').includes('trade-review-loader.js?v=14.38-single-navigation'),
   'actual boot loader cache version must be bumped with nav handoff');
 assert(read('ui-refactor.js').includes('responsive-layout.css?v=1.8-single-navigation'),
   'secondary CSS injection fallback still exposes stale layout');
 assert(rootHtml.includes('ct-reference-nav-history-v1.js?v=4-home-axis'),'reference NAV module missing');
 assert(rootHtml.includes('ct-performance-history-v1.js?v=3'),'verified P&L module missing');
 // Audit the actual fail-closed expression, not just its existence.
 assert(human.includes('const snapshotAligned=isFresh&&Boolean(C.snapshot_id&&L?.snapshot_id)&&String(C.snapshot_id)===String(L.snapshot_id);'),
   'live or canonical missing snapshot IDs must block account figures');
 const primary=human.match(/const PRIMARY=(\[[^\n]+\]);/);
 assert(primary,'Human V2 primary tab source missing');
 const primaryTabs=Array.from(primary[1].matchAll(/\['([^']+)','([^']+)','[^']+'\]/g),m=>m[1]);
 assert.deepEqual(primaryTabs,['overview','accounts','compare','tripod'],'primary tab order changed');
 const moreTab=human.includes("button('더보기','more'")&&human.includes('nav.append(more)')?1:0;
 const humanMobileTabs=primaryTabs.length+moreTab;
 assert.equal(humanMobileTabs,5,'Human mobile bottom menu lost a tab');
 assert(human.includes("'⚠ 계좌 동기화 확인 대기 · '")&&human.includes("'⚠ 계좌 동기화 불일치 · '"),'pending versus proven snapshot mismatch must be distinguished');
 assert(human.includes('M.aggregate(C.accounts,IDS)'),'four-account total source contract absent');
 assert(human.includes("['overview','오늘'")&&human.includes("['accounts','계좌'"),'five-menu contract drift');
 assert(humanCss.includes('safe-area-inset-bottom'),'Human safe area missing');
 assert(humanCss.includes('min-height:52px'),'Human tap target protection missing');
 assert(reference.includes('function overviewShortcut(report)'),'reference NAV not discoverable from Overview');
 assert(reference.includes('상세 그래프 · 성과 탭'),'reference NAV details link unavailable');
 assert(reference.includes("plot.replaceChildren(makeChart(rows))")&&reference.includes("plot.replaceChildren();plot.hidden=true"),
   'Overview reference plot must appear only for source-audited history and clear on mismatch');
 assert(human.includes("track.dataset.ctMetric='NAV_SHARE'")&&human.includes('navShareReady'),
   'current NAV allocation must be independent of P&L period comparability');
 assert(performance.includes('ctPerfHistoryUnavailable')&&performance.includes('return;'),
   'unverified 3 charts must collapse into explicit evidence blocker');
 assert(reference.includes('REFERENCE_ONLY_NO_ATTESTED_BROKER_CLOSE'),'reference NAV mislabeled as profit');
 assert(performance.includes('const near=(a,b)=>Math.abs(a-b)<=2;'),'KRW bridge tolerance weakened');
 assert(performance.includes('zonedTime(history.verified_at_kst)'),'untrusted history timestamp');
 assert(performance.includes("history.status!=='VERIFIED'"),'unverified investment charts enabled');

 assert(Array.isArray(sectors.groups),'sector board source missing');
 // Independent canonical 11 US / 10 KR / 13 thematic rows. Do not trust
 // expected_count taken from the same JSON being audited.
 const expectedGroups={classic:11,kr_sector:10,semiconductor:2,software:3,
   biotech:1,financial:1,defense_infra:4,robotics:2};
 assert.deepEqual(sectors.groups.map(g=>g.key).sort(),Object.keys(expectedGroups).sort(),
   'sector group identifiers changed');
 const sectorCount=sectors.groups.reduce((sum,g)=>{
  assert(Array.isArray(g.rows),'sector group missing rows');
  assert.equal(g.rows.length,expectedGroups[g.key],'independent sector group count: '+g.key);
  assert.equal(g.expected_count,expectedGroups[g.key],'self-declared sector count drift: '+g.key);
  return sum+g.rows.length;
 },0);
 assert.equal(sectorCount,34,'vertical 34-sector board incomplete');
 assert(sectors.flow_evidence==='PRICE_PERFORMANCE_PROXY_ONLY_NOT_NET_INFLOWS',
   'performance proxy must not be called actual money inflow');
 return Object.freeze({
  state:'SOURCE_CONTRACT_PASS',
  human_mobile_destinations:humanMobileTabs,
  observatory_groups:obsNav.IA.length,
  observatory_legacy_destinations:flattened.length,
  sector_rows:sectorCount,
  reference_nav_quality:'REFERENCE_ONLY',
  verified_pnl_history:'EVIDENCE_REQUIRED_NOT_ASSERTED',
  authenticated_private_browser:'UNVERIFIED',
  actual_pages_origin:'SEPARATE_LIVE_SMOKE_REQUIRED'
 });
}
if(require.main===module)console.log('CT_OBS_V2_CROSS_UI_AUDIT '+JSON.stringify(inspect()));
module.exports={inspect};
