// Synthetic UI integration test. Never decrypts payload or reads actual account values.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const ids=['overview','portfolio','accounts','tripod','compare','decisions','trades','quality','watchlist','consultant'];
const names={overview:'Overview',portfolio:'보유분석',accounts:'계좌성과',tripod:'TRI-POD',compare:'성과분석',decisions:'의사결정',trades:'거래내역',quality:'데이터품질',watchlist:'시황/워치',consultant:'시장·섹터'};
const fixture='<!doctype html><html data-ct-layout="mobile-first"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}.app{padding:14px}.tabPanel{display:none}.tabPanel.on{display:block}.ctOvHero{min-height:160px;background:#071a33;color:white;padding:20px}</style><style>'+read('responsive-layout.css')+'</style></head><body><main class="app"><header class="top"><span class="brand">Overview</span></header><nav class="tabs">'+ids.map(id=>'<button type="button" class="tab '+(id==='overview'?'on':'')+'" data-tab="'+id+'">'+names[id]+'</button>').join('')+'</nav>'+ids.map(id=>'<section class="tabPanel '+(id==='overview'?'on':'')+'" id="panel-'+id+'">'+(id==='overview'?'<div class="ctOvHero">현재 총자산 — 원천 보유</div>':'<div>합성 화면 '+names[id]+'</div>')+'</section>').join('')+'</main></body></html>';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,599,767,820,1363]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,isMobile:width<768});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://ct.fixture.test/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/ct-human-v2.css'))return route.fulfill({contentType:'text/css',body:read('ct-human-v2.css')});
    return route.fulfill({contentType:'text/html',body:fixture});
   });
   await page.goto('https://ct.fixture.test/');
   await page.addScriptTag({content:read('canonical-metrics.js')});
   await page.evaluate(()=>{
    const at=new Date(Date.now()-60000).toISOString();
    const keys=['TOSS','ISA','PENSION','IRP'];
    const accounts=Object.fromEntries(keys.map((id,i)=>[id,{nav:1000,today_pnl:(i+1)*10,net_flow:i===0?500:0,today_pnl_scope:'SAME_SESSION',today_pnl_quality:'BROKER_MEASURED'}]));
    window.__JJOONI_CANONICAL_SSOT={snapshot_id:'synthetic',accounts};
    window.__JJOONI_LIVE_PAYLOAD={snapshot_id:'synthetic',generated_kst:at,stale_after_kst:new Date(Date.now()+600000).toISOString()};
    document.querySelectorAll('.tabs .tab').forEach(tab=>tab.addEventListener('click',()=>{
     document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.toggle('on',x===tab));
     document.querySelectorAll('.tabPanel').forEach(x=>x.classList.toggle('on',x.id==='panel-'+tab.dataset.tab));
    }));
   });
   await page.addScriptTag({content:read('ct-human-v2.js')});
   await page.waitForSelector('#ctHumanQuickV2');
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/당일 투자손익/,'daily investment P&L is labelled independently of flows');
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/순입출금/,'external flows stay visible as a distinct concept');
   assert.match(await page.locator('#ctHumanQuickV2 .ctHumanV2NavHero').innerText(),/4계좌 순자산/);
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').first().innerText(),'+₩100');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').nth(1).innerText(),'+₩500');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric small').first().innerText(),'동일 기간 4계좌 · 증권사 실측');
   assert.equal(await page.locator('#ctHumanV2QuickV2').count(),0,'no duplicate overview');
   const driverRows=page.locator('#ctHumanQuickV2 .ctHumanV2DriverRow');
   assert.equal(await driverRows.count(),4,'all four original accounts remain represented');
   assert.match(await driverRows.first().innerText(),/Toss/,'allocation stays NAV ordered');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickPaths').count(),0,'duplicate quick links removed');
   assert.equal(await page.locator('#ctHumanTripodHomeV1').count(),1,'one TRI-POD overview card');
   assert.equal(await page.locator('#ctHumanTripodHomeV1').getAttribute('data-ct-tripod-trust'),'BLOCKED');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2NavHero strong').innerText(),'₩4,000');
   assert.equal(await page.locator('#panel-overview .ctOvHero').isVisible(),false,'no duplicated legacy Hero in V2');
   if(width<=479){
    const row=await driverRows.first().evaluate(e=>{
     const name=e.querySelector('.ctHumanV2DriverLabel').getBoundingClientRect();
     const amount=e.querySelector('strong').getBoundingClientRect();
     const track=e.querySelector('.ctHumanV2DriverTrack').getBoundingClientRect();
     return {nameY:name.y,amountY:amount.y,trackY:track.y,width:e.getBoundingClientRect().width};
    });
    assert(row.trackY>row.nameY+10,'mobile account NAV bar should have a dedicated line: '+JSON.stringify(row));
    assert(Math.abs(row.nameY-row.amountY)<20,'mobile account name and NAV should share a readable first line');
    assert.equal(await page.locator('#ctHumanTripodHomeV1 .ctHumanV2TripodHead button').count(),1,'single in-card route, not another tab bar');
    const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
    assert(x.scroll<=x.inner+1,'no horizontal scroll on compact phone: '+JSON.stringify(x));
   }
   if(width>=1080)assert.equal(await page.locator('#ctHumanQuickV2').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2,'desktop has two-column concise insight');
   const nav=page.locator('#ctHumanBottomV2');
   if(width<768){
    assert(await nav.isVisible(),'V2 bottom navigation visible on '+width);
    const r=await nav.boundingBox();
    assert(r.y>700,'mobile nav at viewport bottom '+width+': '+JSON.stringify(r));
    assert(r.height>=60);
    assert.equal(await page.locator('.tabs').isVisible(),false,'original top tabs must be fully suppressed');
    assert.equal(await page.locator('.tabs').getAttribute('aria-hidden'),'true');
    assert.equal(await nav.getAttribute('aria-hidden'),null);
    assert.equal(await page.evaluate(()=>window.__JJOONI_CT_HUMAN_V2.navigation),'MOBILE_BOTTOM_5');
    assert.equal(await nav.locator('button').count(),5);
    // A late legacy stylesheet used to reintroduce the sticky top tabs.
    // A real viewport/cascade check must enforce exactly one visible menu.
    if(width===390){
     // Reproduce both real owners in the same document: the legacy loader
     // canonicalizes top navigation and observes late tab style mutations.
     const legacy=read('trade-review-loader.js');
     const legacyTest=legacy.slice(0,legacy.lastIndexOf('boot();'))+
      'window.__ctLegacyNavTest={canonicalizeNavigation,lockNavigation};})();';
     await page.addScriptTag({content:legacyTest});
     await page.evaluate(()=>window.__ctLegacyNavTest.lockNavigation());
     await page.waitForTimeout(120);
     assert.equal(await page.locator('.tabs').isVisible(),false,'legacy loader may not re-show top tabs');
     assert.equal(await nav.isVisible(),true,'Human V2 retains one bottom nav');
     await page.evaluate(()=>{
      document.querySelector('.tabs').style.setProperty('display','grid','important');
      document.querySelector('.tabs .tab').style.setProperty('display','flex','important');
     });
     await page.waitForTimeout(200);
     assert.equal(await page.locator('.tabs').isVisible(),false,'legacy mutation observer must restore V2 nav ownership');
     await page.addStyleTag({content:'html[data-ct-layout="mobile-first"] body .tabs {display:grid!important}'});
     assert.equal(await page.locator('.tabs').isVisible(),false,'late legacy sheet must not bring top tabs back');
     await page.setViewportSize({width:820,height:900});
     await page.waitForFunction(()=>window.__JJOONI_CT_HUMAN_V2.navigation==='DESKTOP_TOP_ONLY');
     assert.equal(await nav.isVisible(),false,'rotated/wide view hides bottom tabs');
     assert.equal(await page.locator('.tabs').isVisible(),true,'wide view restores original top tabs');
     await page.setViewportSize({width:390,height:900});
     await page.waitForFunction(()=>window.__JJOONI_CT_HUMAN_V2.navigation==='MOBILE_BOTTOM_5');
     assert.equal(await nav.isVisible(),true,'return to phone restores bottom nav');
     assert.equal(await page.locator('.tabs').isVisible(),false,'return to phone suppresses top nav');
    }
    assert((await nav.locator('button').evaluateAll(xs=>xs.every(x=>x.getBoundingClientRect().height>=44))));
    await driverRows.first().click();
    assert(await page.locator('#panel-accounts').isVisible(),'account impact navigates to canonical accounts');
    await nav.getByRole('button',{name:'오늘'}).click();
    await nav.getByRole('button',{name:'성과'}).click();
    assert(await page.locator('#panel-compare').isVisible(),'performance route via canonical tab');
    await nav.getByRole('button',{name:'더보기'}).click();
    assert(await page.locator('#ctHumanV2More').isVisible());
    await page.locator('#ctHumanV2More button[data-ct-destination="portfolio"]').click();
    assert(await page.locator('#panel-portfolio').isVisible(),'legacy portfolio preserved in more');
    assert.equal(await page.locator('#ctHumanV2More').isVisible(),false);
    await nav.getByRole('button',{name:'전략'}).click();
    assert(await page.locator('#panel-tripod').isVisible(),'TRI-POD strategy route preserved');
    await nav.getByRole('button',{name:'오늘'}).click();
    assert(await page.locator('#panel-overview').isVisible(),'return to Overview from strategy');
   }else{
    assert.equal(await nav.isVisible(),false,'desktop retains current nav');
    assert.equal(await nav.getAttribute('aria-hidden'),'true');
    assert.equal(await page.evaluate(()=>window.__JJOONI_CT_HUMAN_V2.navigation),'DESKTOP_TOP_ONLY');
    assert(await page.locator('.tabs').isVisible());
   }
   await page.evaluate(()=>{
    const C=window.__JJOONI_CANONICAL_SSOT,L=window.__JJOONI_LIVE_PAYLOAD;
    C.accounts.IRP.today_pnl=null;
    L.stale_after_kst=new Date(Date.now()-600000).toISOString();
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2')?.textContent.includes('합산 확인 대기'));
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2NavHero strong').innerText(),'원천 검증 대기');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverTrack:not([hidden])').count(),0);
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/이전 수집 기준/);
   assert.doesNotMatch(await page.locator('#ctHumanQuickV2').innerText(),/\+₩100/,'no stale performance amount');
   await page.evaluate(()=>{window.__JJOONI_LIVE_PAYLOAD.stale_after_kst=new Date(Date.now()+600000).toISOString();document.dispatchEvent(new Event('jjooni:live-applied'))});
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2 .ctHumanV2DriverTrack[data-ct-metric="NAV_SHARE"]'));
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverTrack[data-ct-metric="NAV_SHARE"]').count(),4);
   assert.match(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverRow').first().innerText(),/25\.0%/);
   await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.accounts.IRP.nav=null;document.dispatchEvent(new Event('jjooni:live-applied'))});
   await page.waitForFunction(()=>document.querySelector('.ctHumanV2DriverTrack[hidden]'));
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverTrack:not([hidden])').count(),0,'missing NAV and PnL cannot produce fake bars');
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/NAV 검증 전 비중 미표시/);
   await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.accounts.IRP.nav=1000;document.dispatchEvent(new Event('jjooni:live-applied'))});

   // If canonical and browser-live IDs diverge, every displayed day/flow
   // amount must fail closed, even when all 4 accounting fields exist.
   await page.evaluate(()=>{
    const C=window.__JJOONI_CANONICAL_SSOT,L=window.__JJOONI_LIVE_PAYLOAD;
    C.accounts.IRP.today_pnl=40;
    L.snapshot_id='older-live-snapshot';
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2')?.textContent.includes('계좌 동기화 불일치'));
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/스냅샷 정합성 확인 대기/);
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').first().innerText(),'합산 확인 대기');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').nth(1).innerText(),'확인 대기');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverRow strong').first().innerText(),'금액 검증 대기');
   assert.doesNotMatch(await page.locator('#ctHumanQuickV2').innerText(),/\+₩100|\+₩500/,'mismatched sources must not show live values');
   await page.evaluate(()=>{
    window.__JJOONI_LIVE_PAYLOAD.snapshot_id=window.__JJOONI_CANONICAL_SSOT.snapshot_id;
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2 .ctHumanV2QuickMetric strong')?.textContent==='+₩100');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').nth(1).innerText(),'+₩500');
   // Missing ID is not the same as equal IDs. Both cases fail closed.
   await page.evaluate(()=>{
    delete window.__JJOONI_LIVE_PAYLOAD.snapshot_id;
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2')?.textContent.includes('계좌 동기화 확인 대기'));
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').first().innerText(),'합산 확인 대기');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').nth(1).innerText(),'확인 대기');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2DriverRow strong').first().innerText(),'금액 검증 대기');
   assert.doesNotMatch(await page.locator('#ctHumanQuickV2').innerText(),/계좌 동기화 불일치/,'missing source is not proven mismatched data');
   await page.evaluate(()=>{
    const C=window.__JJOONI_CANONICAL_SSOT,L=window.__JJOONI_LIVE_PAYLOAD;
    L.snapshot_id=C.snapshot_id;
    delete C.snapshot_id;
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2 .ctHumanV2QuickMetric strong')?.textContent==='합산 확인 대기');
   assert.match(await page.locator('#ctHumanQuickV2').innerText(),/동기화 확인 대기/);
   await page.evaluate(()=>{
    window.__JJOONI_CANONICAL_SSOT.snapshot_id='synthetic';
    document.dispatchEvent(new Event('jjooni:live-applied'));
   });
   await page.waitForFunction(()=>document.querySelector('#ctHumanQuickV2 .ctHumanV2QuickMetric strong')?.textContent==='+₩100');
   assert.equal(await page.locator('#ctHumanQuickV2 .ctHumanV2QuickMetric strong').nth(1).innerText(),'+₩500');


   if(width===390){
    // Real publisher integration: mount Home with no strategy panel,
    // then load the actual source guard and ensure it drives the Home.
    await page.evaluate(()=>{
     document.querySelector('#panel-tripod')?.remove();
     const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
     window.__JJOONI_PUBLIC_MARKET_DAILY={
      market_context:{items:{VIX:{value:21,session_date:date}}},
      tripod_signal:{source:'PUBLIC_MARKET_DAILY_V1',ok:true,date,session_date:date,
       vix_basis:'LAST_10_DAILY_CLOSES_ARITHMETIC_MEAN',vix_window_count:10,
       data_alignment:'NDX_VIX_SAME_COMPLETED_SESSION',vix10:20.5,
       vix_latest_close:21,ndx:28000,ma250:27000,drawdown_52w_pct:-10.5,
       regime:'상승',target:'QQQ 50% + QLD 50%',action:'HOLD_NO_TRADE'}
     };
    });
    await page.addScriptTag({content:read('tripod-daily-freshness-v35.js')});
    await page.waitForFunction(()=>document.querySelector('#ctHumanTripodHomeV1')?.dataset.ctTripodTrust==='VERIFIED');
    assert.match(await page.locator('#ctHumanTripodHomeV1').innerText(),/QQQ 50% \+ QLD 50%/);
    assert.match(await page.locator('#ctHumanTripodHomeV1').innerText(),/신호 판단 · 유지 · 신규 주문 없음/);
    const hero=await page.locator('#ctHumanTripodHomeV1').boundingBox();
    assert(hero&&hero.y<800,'TRI-POD decision must appear above bottom navigation without multi-screen scrolling');
    assert.match(await page.locator('#ctHumanTripodHomeV1').innerText(),/실제 보유·주문 아님/);
    assert.equal(await page.locator('#ctHumanTripodHomeV1').getByRole('button',{name:'전략 상세'}).count(),1);
    assert.equal(await page.evaluate(()=>window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35.last.trusted),true);
    await page.evaluate(()=>{
     window.__JJOONI_PUBLIC_MARKET_DAILY.market_context.items.VIX.session_date='2026-11-01';
     document.dispatchEvent(new Event('jjooni:public-market-loaded'));
    });
    await page.waitForFunction(()=>document.querySelector('#ctHumanTripodHomeV1')?.dataset.ctTripodTrust==='BLOCKED');
    assert.equal(await page.evaluate(()=>window.__JJOONI_TRIPOD_DAILY_FRESHNESS_V35.last.trusted),false);
    assert.doesNotMatch(await page.locator('#ctHumanTripodHomeV1').innerText(),/QQQ 50%/,'invalid market reference must revoke prior target');
   }
   assert.deepEqual(errors,[],'no browser exceptions '+width+': '+errors.join(';'));
   await context.close();
   console.log('CT_HUMAN_V2_PASS',width);
  }
  // Emergency rollback: explicit ?ctui=v1 remains the legacy top-navigation view.
  const c=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});
  const p=await c.newPage();
  await p.route('https://ct.fixture.test/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await p.goto('https://ct.fixture.test/?ctui=v1');
  await p.addScriptTag({content:read('ct-human-v2.js')});
  await p.waitForSelector('#ctHumanV2Activate');
  assert.equal(await p.locator('#ctHumanBottomV2').count(),0);
  assert(await p.locator('.tabs').isVisible());
  await c.close();
  console.log('CT_HUMAN_V2_ROLLBACK_PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
