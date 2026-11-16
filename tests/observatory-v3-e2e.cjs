// V3 opt-in smoke: actual DOM, stylesheet, data state and mobile nav ownership.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.URL||'http://127.0.0.1:8123/market-observatory/';
(async()=>{
 const browser=await chromium.launch();
 for(const width of [390,800,1363]){
  const ctx=await browser.newContext({viewport:{width,height:920}});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE+'?ui=v3',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.classList.contains('obsV3')&&window.__JJOONI_OBS_V3?.version==='3.0-opt-in');
  await page.waitForFunction(()=>document.querySelector('.todayV2')&&document.querySelector('#ov3MarketStrip'),null,{timeout:25000});
  const state=await page.evaluate(()=>({
   v3:document.body.classList.contains('obsV3'),
   five:document.querySelectorAll('.navV2Main button[data-group]').length,
   navOwner:document.querySelectorAll('.navV2Bar').length,
   originalTabsHidden:getComputedStyle(document.querySelector('#tabs')).display==='none',
   css:!!document.querySelector('#observatoryV3Skin'),
   oldV1SwitchHidden:getComputedStyle(document.querySelector('.obsSwitchUi')).display==='none',
   prompt:document.querySelector('.ov3MarketStrip')?.textContent||'',
   ready:!!document.querySelector('#ov3TripodRail .ov3Rail'),
   hold:!!document.querySelector('#ov3TripodRail .ov3Pending'),
   thresholds:document.querySelectorAll('#ov3TripodRail .ov3Threshold').length,
   docWidth:document.documentElement.scrollWidth,screenWidth:innerWidth,
   v2Return:document.querySelector('.ov3Back')?.getAttribute('href')
  }));
  assert.equal(state.five,5,'five navigation ownership groups');
  assert.equal(state.navOwner,1,'no duplicated top/bottom nav');
  assert.equal(state.originalTabsHidden,true,'legacy tab bar hidden');
  assert.ok(state.css,'opt-in V3 skin attached');
  assert.equal(state.oldV1SwitchHidden,true);
  assert.ok(state.ready||state.hold,'either source-safe visual or explicit hold');
  if(state.ready)assert.equal(state.thresholds,4,'all four thresholds with source guard');
  assert.ok(state.docWidth<=state.screenWidth+3,'V3 horizontal overflow '+width+': '+JSON.stringify(state));
  assert.match(state.v2Return||'',/ui=v2/);
  await page.locator('.navV2Main button[data-group="strategy"]').click();
  await page.waitForFunction(()=>document.querySelector('#tripod')?.classList.contains('on'));
  await page.waitForFunction(()=>document.querySelector('#ov3TripodDetail'));
  const strategyRail=await page.locator('#ov3TripodDetail').textContent();
  assert.ok(strategyRail.includes('기준점')||strategyRail.includes('확인 대기'),'strategy page has safe threshold view');
  await page.locator('.navV2Main button[data-group="brief"]').click();
  await page.waitForFunction(()=>document.querySelector('#morning-brief')?.classList.contains('on'));
  await page.waitForFunction(()=>document.querySelector('#briefVisualDigest')?.textContent?.length>0,null,{timeout:25000});
  const digest=await page.locator('#briefVisualDigest').textContent();
  assert.ok(digest.includes('트라이팟')||digest.includes('확인 대기'),'morning brief has visual section or safe hold');
  assert.deepEqual(errors,[],'no page exceptions');
  console.log('OBS_V3_E2E_PASS width='+width+' visual='+(state.ready?'READY':'HOLD')+' totalNav='+state.navOwner);
  await ctx.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
