// Strictly synthetic, no private snapshots or plaintext financial data.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const fixture='<!doctype html><html lang="ko" data-ct-human-ui="v2"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui}.app{padding:15px;width:100%}#panel-compare{display:block}</style></head><body><main class="app"><nav class="tabs"><button class="tab on" data-tab="overview">오늘</button><button class="tab" data-tab="compare">성과</button></nav><section id="panel-overview"><div class="ctOvHero">순자산 요약</div></section><section id="panel-compare"><div id="ctLegacyCompare">기존 성과분석 유지</div><section id="ctVerifiedPerformanceHistoryV1">별도 검증된 성과 그래프</section></section></main></body></html>';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,820,1363]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,isMobile:width<768});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://reference.fixture.test/**',route=>{
     if(route.request().url().endsWith('.css?v=3'))return route.fulfill({contentType:'text/css',body:read('ct-reference-nav-history-v1.css')});
     return route.fulfill({contentType:'text/html',body:fixture});
   });
   await page.goto('https://reference.fixture.test/?ctui=v2');
   await page.evaluate(()=>{window.__JJOONI_CT_HUMAN_V2={mode:'v2'};
     window.__JJOONI_CANONICAL_SSOT={snapshot_id:'synthetic'};
     window.__JJOONI_LIVE_PAYLOAD={snapshot_id:'synthetic'};window.JjooniMetrics={freshness:l=>({state:l.__stale?'STALE':'LIVE'})};});
   if(width===390)await page.evaluate(()=>{
     const original=window.setInterval;
     window.setInterval=function(callback,interval,...args){
       if(interval===60000)window.__referenceNavClockTick=callback;
       return original.call(window,callback,interval,...args);
     };
   });
   await page.addScriptTag({content:read('ct-reference-nav-history-v1.js')});
   await page.waitForSelector('#ctReferenceNavHistoryV1');
   await page.waitForSelector('#ctReferenceNavOverviewV1');
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/참고 NAV 미표시/);
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg').count(),0,'unverified history may not draw a NAV plot');
   await page.evaluate(()=>{
    window.__NAV_CLICK_COUNT=0;
    document.querySelector('.tabs .tab[data-tab="compare"]').addEventListener('click',()=>{
      window.__NAV_CLICK_COUNT++;
    });
   });
   await page.locator('#ctReferenceNavOverviewV1 button').click();
   assert.equal(await page.evaluate(()=>window.__NAV_CLICK_COUNT),1,'Overview shortcut opens actual Performance tab');

   assert.match(await page.locator('#ctReferenceNavHistoryV1').innerText(),/검증 대기/);
   assert.equal(await page.locator('#ctReferenceNavHistoryV1 svg').count(),0);
   await page.evaluate(()=>{
      const quality='REFERENCE_ONLY_NO_ATTESTED_BROKER_CLOSE';
      const now=new Date(),midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
      const kstDate=millis=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(millis));
      const days=[9,8,7,6,3,2,1].map((offset,i)=>{
       const ms=midnight-offset*86400000;
       const d=kstDate(ms);
       return {date:d,generated_kst:d+'T09:00:00+09:00',source_snapshot_id:'test'+i,source_quality:quality,legacy_tripod_excluded:i===0,total_four_nav_krw:1000+i*123};
      });
      window.__JJOONI_LIVE_PAYLOAD.reference_nav_history={
       schema:'CT_REFERENCE_NAV_HISTORY_V1',state:'REFERENCE_ONLY',source_quality:quality,
       portfolio_account_ids:['TOSS','ISA','PENSION','IRP'],bound_snapshot_id:'synthetic',
       generated_at_kst:new Date().toISOString(),certified_us_close:false,cash_flow_reconciled:false,
       historical_pnl_available:false,date_basis:'CANONICAL_CAPTURE_KST_CALENDAR_DAY',
       selection_rule:'LATEST_COMPLETE_FOUR_ACCOUNT_CANONICAL_SNAPSHOT_PER_KST_DAY',days};
      document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#ctReferenceNavHistoryV1 svg').length===1);
   assert.equal(await page.locator('#ctReferenceNavHistoryV1 svg circle').count(),7);
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg').count(),1,'Overview must display real sourced NAV chart, not only a button');
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg circle').count(),7,'source-only points and no invented interpolation');
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/투자수익률·손익 아님/);
   assert((await page.locator('#ctReferenceNavOverviewV1 svg').boundingBox()).height>60,'visible plot height required');
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/7일 관측/);
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/투자수익률·손익 아님/);
   assert.equal(await page.locator('#ctReferenceNavOverviewV1').count(),1);

   assert.equal(await page.locator('#ctReferenceNavHistoryV1 svg polyline').count(),2,'missing-day lines must not connect across gap');
   assert.match(await page.locator('#ctReferenceNavHistoryV1').innerText(),/투자손익 아님/);
   assert.match(await page.locator('#ctReferenceNavHistoryV1').innerText(),/기록 없는 날짜/);
   assert.match(await page.locator('#ctLegacyCompare').innerText(),/기존 성과분석 유지/);
   assert.match(await page.locator('#ctVerifiedPerformanceHistoryV1').innerText(),/별도 검증된 성과 그래프/);
   const layout=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(layout.scroll<=layout.inner+1,JSON.stringify(layout));
   if(width===390){
    // Real freshness source, clock-only expiry and NO live-applied event.
    // Execute the module's captured real periodic callback instead of
    // forcing a 60-second wall-clock wait in CI.
    assert.equal(await page.evaluate(()=>typeof window.__referenceNavClockTick),'function');
    await page.addScriptTag({content:read('canonical-metrics.js')});
    await page.evaluate(()=>{
      window.__JJOONI_LIVE_PAYLOAD.generated_kst=new Date().toISOString();
      window.__JJOONI_LIVE_PAYLOAD.stale_after_kst=new Date(Date.now()+500).toISOString();
    });
    assert.equal(await page.evaluate(()=>JjooniMetrics.freshness(window.__JJOONI_LIVE_PAYLOAD).state),'LIVE');
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(()=>JjooniMetrics.freshness(window.__JJOONI_LIVE_PAYLOAD).state),'STALE');
    // Init timers or visibility events may already revoke the SVG; the
    // invariant is that the clock-only recheck leaves no stale monetary SVG.
    await page.evaluate(()=>window.__referenceNavClockTick());
    await page.waitForFunction(()=>document.querySelector('#ctReferenceNavOverviewV1')?.dataset.ctReference==='WAITING');
    assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg').count(),0,'clock-only source staleness must hide reference chart');
    assert.doesNotMatch(await page.locator('#ctReferenceNavOverviewV1').innerText(),/최초 ₩/,'stale source cannot retain overview monetary facts');
    await page.evaluate(()=>{
      window.__JJOONI_LIVE_PAYLOAD.stale_after_kst=new Date(Date.now()+600000).toISOString();
      window.__referenceNavClockTick();
    });
    await page.waitForFunction(()=>document.querySelector('#ctReferenceNavOverviewV1')?.dataset.ctReference==='REFERENCE_ONLY');
    assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg circle').count(),7);
    // Restore test's controlled freshness for subsequent flag-based checks.
    await page.evaluate(()=>{window.JjooniMetrics={freshness:l=>({state:l.__stale?'STALE':'LIVE'})}});
   }
   await page.evaluate(()=>{window.__JJOONI_LIVE_PAYLOAD.__stale=true;document.dispatchEvent(new Event('jjooni:live-applied'))});
   await page.waitForFunction(()=>document.querySelector('#ctReferenceNavOverviewV1')?.dataset.ctReference==='WAITING');
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg').count(),0,'stale live account facts must suppress overview NAV chart');
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/현재 계좌 원천 최신성 검증 대기/);
   await page.evaluate(()=>{delete window.__JJOONI_LIVE_PAYLOAD.__stale;document.dispatchEvent(new Event('jjooni:live-applied'))});
   await page.waitForFunction(()=>document.querySelector('#ctReferenceNavOverviewV1')?.dataset.ctReference==='REFERENCE_ONLY');
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg circle').count(),7,'fresh live source restores real points');
   await page.evaluate(()=>{window.__JJOONI_LIVE_PAYLOAD.reference_nav_history.bound_snapshot_id='wrong';document.dispatchEvent(new Event('jjooni:live-applied'))});
   await page.waitForFunction(()=>document.querySelectorAll('#ctReferenceNavHistoryV1 svg').length===0);
   assert.equal(await page.locator('#ctReferenceNavOverviewV1 svg').count(),0,'invalid binding must immediately clear Overview chart');
   assert.match(await page.locator('#ctReferenceNavOverviewV1').innerText(),/참고 NAV 미표시/);
   assert.doesNotMatch(await page.locator('#ctReferenceNavOverviewV1').innerText(),/7일 관측/);

   assert.equal(await page.locator('#ctReferenceNavHistoryV1').count(),1);
   assert.deepEqual(errors,[],'errors: '+errors.join(','));
   await context.close();
   console.log('REFERENCE_NAV_HISTORY_E2E_PASS',width);
  }
  const ctx=await browser.newContext({viewport:{width:390,height:900}}),page=await ctx.newPage();
  await page.route('https://reference.fixture.test/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto('https://reference.fixture.test/?ctui=v1');
  await page.evaluate(()=>{window.__JJOONI_CT_HUMAN_V2={mode:'v1'};document.documentElement.dataset.ctHumanUi='v1'});
  await page.addScriptTag({content:read('ct-reference-nav-history-v1.js')});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#ctReferenceNavHistoryV1').count(),0);
  assert.equal(await page.locator('#ctReferenceNavOverviewV1').count(),0);

  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
