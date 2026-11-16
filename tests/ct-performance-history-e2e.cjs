// Synthetic browser regression: real account history and encrypted payload are NEVER loaded.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const fixture='<!doctype html><html lang="ko" data-ct-human-ui="v2"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui}.app{padding:15px;width:100%}#panel-compare{display:block}</style></head><body><main class="app"><section id="panel-compare"><div id="ctCurrentPerformance"><h2>기존 성과분석 보존</h2></div></section></main></body></html>';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,820,1363]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,isMobile:width<768});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://history.fixture.test/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:read('ct-performance-history-v1.css')});
    return route.fulfill({contentType:'text/html',body:fixture});
   });
   await page.goto('https://history.fixture.test/');
   await page.evaluate(()=>{
    window.__JJOONI_CT_HUMAN_V2={mode:'v2'};
    window.__JJOONI_CANONICAL_SSOT={snapshot_id:'mock'};
    window.__JJOONI_LIVE_PAYLOAD={snapshot_id:'mock',source_health:{pb_history:{state:'VERIFIED'}}};
   });
   await page.addScriptTag({content:read('ct-performance-history-v1.js')});
   await page.waitForSelector('#ctVerifiedPerformanceHistoryV1');
   assert.equal(await page.locator('.ctPerfHistoryCard[data-ct-verification="PENDING"]').count(),0,'no repeated fake empty charts');
   assert.equal(await page.locator('.ctPerfHistoryUnavailable[data-ct-verification="BLOCKED"]').count(),1);
   assert.match(await page.locator('.ctPerfHistoryUnavailable').innerText(),/공식 마감 NAV/);
   assert.equal(await page.locator('#ctVerifiedPerformanceHistoryV1 svg').count(),0,'unverified history may not render even one plot');
   await page.evaluate(()=>{
    window.__JJOONI_LIVE_PAYLOAD.performance_history={
     schema:'CT_RECONCILED_PERFORMANCE_HISTORY_V1',status:'VERIFIED',
     accounts:['TOSS','ISA','PENSION','IRP'],bound_snapshot_id:'mock',
     verified_at_kst:'2026-11-15T09:00:00+09:00',asset_class_partition:'DISJOINT',
     rows:[
      {date:'2026-11-11',nav_krw:1000,investment_pnl_krw:100,net_cash_flow_krw:0,asset_class_contributions_krw:{KR_STOCK:70,US_STOCK:30}},
      {date:'2026-11-12',nav_krw:1105,investment_pnl_krw:55,net_cash_flow_krw:50,asset_class_contributions_krw:{KR_STOCK:15,US_STOCK:40}},
      {date:'2026-11-13',nav_krw:1150,investment_pnl_krw:45,net_cash_flow_krw:0,asset_class_contributions_krw:{KR_STOCK:20,US_STOCK:25}}
     ]
    };
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#ctVerifiedPerformanceHistoryV1 svg').length===3);
   assert.equal(await page.locator('.ctPerfHistoryCard[data-ct-verification="VERIFIED"]').count(),3);
   assert.match(await page.locator('#ctVerifiedPerformanceHistoryV1').innerText(),/순입출금 분리/);
   assert.match(await page.locator('#ctVerifiedPerformanceHistoryV1').innerText(),/1,150원/);
   assert.match(await page.locator('#ctCurrentPerformance').innerText(),/기존 성과분석 보존/);
   assert.equal(await page.locator('#ctVerifiedPerformanceHistoryV1').count(),1);
   const layout=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(layout.scroll<=layout.inner+1,'no horizontal overflow: '+JSON.stringify(layout));
   await page.evaluate(()=>{
    window.__JJOONI_LIVE_PAYLOAD.performance_history.rows[1].asset_class_contributions_krw.KR_STOCK+=20;
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#ctVerifiedPerformanceHistoryV1 svg').length===2);
   assert.match(await page.locator('.ctPerfHistoryCard').nth(2).innerText(),/기여 합계와 투자손익 대사 불일치/);
   await page.evaluate(()=>{
    window.__JJOONI_LIVE_PAYLOAD.performance_history.rows[1].nav_krw+=300;
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#ctVerifiedPerformanceHistoryV1 svg').length===0);
   assert.match(await page.locator('#ctVerifiedPerformanceHistoryV1').innerText(),/NAV 증감/);
   assert.equal(await page.locator('.ctPerfHistoryUnavailable').count(),1,'invalid reconciliation returns to single blocker');
   assert.equal(await page.locator('#ctVerifiedPerformanceHistoryV1').count(),1,'no duplicate card after refresh');
   assert.deepEqual(errors,[],'runtime errors: '+errors.join(','));
   await context.close();
   console.log('VERIFIED_PERFORMANCE_3_CHARTS_PASS',width);
  }
  const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true});
  const page=await context.newPage();
  await page.route('https://history.fixture.test/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto('https://history.fixture.test/?ctui=v1');
  await page.evaluate(()=>{document.documentElement.dataset.ctHumanUi='';window.__JJOONI_CT_HUMAN_V2={mode:'v1'}});
  await page.addScriptTag({content:read('ct-performance-history-v1.js')});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#ctVerifiedPerformanceHistoryV1').count(),0,'old screen should not receive V2 charts');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
