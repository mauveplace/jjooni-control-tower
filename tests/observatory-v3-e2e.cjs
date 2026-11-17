// V3 opt-in smoke: actual DOM, stylesheet, data state and mobile nav ownership.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dataDir=path.join(__dirname,'..','market-observatory','data');
const fixtureData=['daily-glance.json','freshness-status.json','sector-rotation-brief.json'].map(x=>JSON.parse(fs.readFileSync(path.join(dataDir,x),'utf8')));
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
  await page.screenshot({path:'/tmp/obs-v3-home-'+width+'.png'});
  if(state.ready)await page.locator('#ov3TripodRail .ov3Rail').screenshot({path:'/tmp/obs-v3-tripod-'+width+'.png'});
  if(state.ready){
   const detail=page.locator('.todayV2 button[data-ov3-tab="jjooni-tripod"]');
   assert.ok(await detail.isVisible(),'fixed-anchor detail shortcut visible');
   await detail.click();
   await page.waitForFunction(()=>document.querySelector('#jjooni-tripod')?.classList.contains('on'));
   await page.locator('.navV2Sub button[data-tab="tripod"]').click();
  }else{
   await page.locator('.navV2Main button[data-group="strategy"]').click();
  }
  await page.waitForFunction(()=>document.querySelector('#tripod')?.classList.contains('on'));
  await page.waitForFunction(()=>document.querySelector('#ov3TripodDetail'));
  const strategyRail=await page.locator('#ov3TripodDetail').textContent();
  assert.ok(strategyRail.includes('기준점')||strategyRail.includes('확인 대기'),'strategy page has safe threshold view');
  await page.locator('.navV2Main button[data-group="brief"]').click();
  await page.waitForFunction(()=>document.querySelector('#morning-brief')?.classList.contains('on'));
  await page.waitForFunction(()=>document.querySelector('#briefVisualDigest')?.textContent?.length>0,null,{timeout:25000});
  const digest=await page.locator('#briefVisualDigest').textContent();
  assert.ok(digest.includes('트라이팟')||digest.includes('확인 대기'),'morning brief has visual section or safe hold');
  // Independently force the published same-session fixture through the REAL browser model/rail.
  // Live state may legitimately HOLD; CI must still prove all four lines render when READY.
  const fixture=await page.evaluate(([g,f,sec])=>{
   const api=window.__JJOONI_OBS_V3;
   const ready=api.model(g,f,sec,Date.parse(f.generated_kst)+60000);
   if(!ready.ready)return {ready:false,reason:ready.reason};
   const el=document.createElement('section');el.id='ov3FixtureRail';el.innerHTML=api.rail(ready);
   document.body.appendChild(el);
   return {ready:true,count:el.querySelectorAll('.ov3Threshold').length,
    text:el.textContent,axis:ready.axis,pod:ready.pod};
  },fixtureData);
  assert.equal(fixture.ready,true,'published synthetic same-session fixture must render: '+fixture.reason);
  assert.equal(fixture.count,4,'all FOUR priced TRI-POD thresholds must render in browser DOM');
  assert.match(fixture.text,/MA250×0\\.95/);
  assert.match(fixture.text,/MA250×1\\.01/);
  assert.match(fixture.text,/현재 NDX/);
  assert.match(fixture.text,/DD -9%/);
  assert.ok(fixture.text.includes(fixture.pod),'stage must use real ledger');
  await page.locator('#ov3FixtureRail').evaluate(el=>el.remove());
  if(width===390){
   const v2=await ctx.newPage();
   await v2.goto(BASE+'?ui=v2',{waitUntil:'networkidle'});
   await v2.locator('.navV2Main button[data-group="brief"]').click();
   await v2.waitForFunction(()=>document.querySelector('#briefVisualDigest')&&document.querySelector('#briefArticle')?.textContent?.length>0,null,{timeout:25000});
   assert.equal(await v2.locator('#briefVisualDigest').evaluate(el=>el.hidden),true,
    'V2 default must NOT display V3 brief digest');
   await v2.close();
  }
  assert.deepEqual(errors,[],'no page exceptions');
  console.log('OBS_V3_E2E_PASS width='+width+' visual='+(state.ready?'READY':'HOLD')+' totalNav='+state.navOwner);
  await ctx.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
