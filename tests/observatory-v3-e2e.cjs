// V3 default smoke: actual DOM, stylesheet, data state, mobile nav and V2 fallback.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dataDir=path.join(__dirname,'..','market-observatory','data');
const fixtureData=['daily-glance.json','freshness-status.json','sector-rotation-brief.json'].map(x=>JSON.parse(fs.readFileSync(path.join(dataDir,x),'utf8')));
fixtureData.push(JSON.parse(fs.readFileSync(path.join(__dirname,'..','public-market-daily.json'),'utf8')));
const BASE=process.env.URL||'http://127.0.0.1:8123/market-observatory/';
(async()=>{
 const browser=await chromium.launch();
 for(const width of [390,800,1363]){
  const ctx=await browser.newContext({viewport:{width,height:920}});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  if(width===390){
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.body.classList.contains('obsV3')&&window.__JJOONI_OBS_V3?.version==='3.1-default');
    assert.equal(await page.locator('.navV2Main button[data-group]').count(),5,'root URL defaults to V3');
   }
   await page.goto(BASE+'?ui=v3',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.classList.contains('obsV3')&&window.__JJOONI_OBS_V3?.version==='3.1-default');
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

   const layout=await page.evaluate(()=>{
     const today=document.querySelector('.todayV2'),rail=today.querySelector('#ov3TripodRail');
     const market=today.querySelector('#ov3MarketStrip'),grid=today.querySelector('.tV2Grid');
     return {
       railBeforeMarket:!!(rail.compareDocumentPosition(market)&Node.DOCUMENT_POSITION_FOLLOWING),
       marketBeforeGrid:!!(market.compareDocumentPosition(grid)&Node.DOCUMENT_POSITION_FOLLOWING),
       guard:(rail.textContent.includes('공식 종가 독립검증 대기')&&rail.textContent.includes('전환 확정 금지'))
          ||(rail.textContent.includes('정수자리 일치 검증 완료')&&rail.textContent.includes('자동주문 없음')),
       headerHeight:document.querySelector('header.top').getBoundingClientRect().height,
       refreshWidth:document.querySelector('#obsForceRefresh')?.getBoundingClientRect().width||0,
       noticeDetails:!!today.querySelector('details.ov3StatusDetails'),
       warningCount:(window.__JJOONI_TODAY_V2?.vm?.alerts||[]).filter(a=>a.level!=='HIGH').length
     };
   });
   assert.ok(layout.railBeforeMarket,'TRI-POD rail must precede market summary');
   assert.ok(layout.marketBeforeGrid,'market strip must precede large editorial cards');
   if(state.ready)assert.ok(layout.guard,'source-dependent official EOD status and NO_TRADE guard visible');
   if(width===390){
     assert.ok(layout.headerHeight<245,'mobile header too tall: '+layout.headerHeight);
     assert.ok(layout.refreshWidth<160,'refresh button must not take full mobile width: '+layout.refreshWidth);
     if(layout.warningCount)assert.ok(layout.noticeDetails,'noncritical status details collapsed on mobile');
   }
   // Real browser coordinates: negative bars end at 0%, positive bars start at 0%.
   // Synthetic positives are necessary when the entire source session is negative.
   const geometry=await page.evaluate(([g,f,s])=>{
     const api=window.__JJOONI_OBS_V3,m=api.model(g,f,s,Date.parse(f.generated_kst)+60000);
     if(!m.ready||!m.sectorReady)return {ready:false,reason:m.reason};
     const rows=m.sectors.map(x=>({...x}));
     rows[0].current_return_pct=-4;
     rows[1].current_return_pct=2;
     rows[2].current_return_pct=0;
     const wrap=document.createElement('section');
     wrap.className='todayV2';wrap.id='ov3SectorTest';
     wrap.innerHTML=api.sectorChart({...m,sectors:rows});
     document.body.appendChild(wrap);
     const metrics=[...wrap.querySelectorAll('.ov3SectorLine')].slice(0,3).map(el=>{
       const track=el.querySelector('.ov3SectorTrack'),i=[...el.querySelectorAll('.ov3SectorHalf i')];
       const box=track.getBoundingClientRect(),left=i[0].getBoundingClientRect(),right=i[1].getBoundingClientRect();
       return {dir:el.dataset.direction,mid:box.left+box.width/2,negativeEnd:left.right,positiveStart:right.left,
         negWidth:left.width,posWidth:right.width,negColor:getComputedStyle(i[0]).backgroundColor,
         posColor:getComputedStyle(i[1]).backgroundColor};
     });
     const overflow=document.documentElement.scrollWidth-innerWidth;
     wrap.remove();
     return {ready:true,metrics,overflow};
   },fixtureData);
   assert.equal(geometry.ready,true,'synthetic source-aligned sector state: '+geometry.reason);
   const [negative,positive,flat]=geometry.metrics;
   assert.deepEqual([negative.dir,positive.dir,flat.dir],['loss','gain','neutral']);
   assert.ok(Math.abs(negative.negativeEnd-negative.mid)<2,'loss must terminate at 0% center');
   assert.ok(Math.abs(positive.positiveStart-positive.mid)<2,'gain must originate at 0% center');
   assert.ok(negative.negWidth>0&&negative.posWidth===0,'negative LEFT only');
   assert.ok(positive.posWidth>0&&positive.negWidth===0,'positive RIGHT only');
   assert.ok(flat.negWidth===0&&flat.posWidth===0,'zero stays on central axis');
   assert.equal(negative.negColor,'rgb(39, 89, 160)','negative is blue');
   assert.equal(positive.posColor,'rgb(186, 50, 45)','positive is red');
   assert.ok(geometry.overflow<=3,'bipolar chart must not overflow at '+width);

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
  const fixture=await page.evaluate(([g,f,sec,d])=>{
   const api=window.__JJOONI_OBS_V3;
   const ready=api.model(g,f,sec,Date.parse(f.generated_kst)+60000,d);
   if(!ready.ready)return {ready:false,reason:ready.reason};
   const el=document.createElement('section');el.id='ov3FixtureRail';el.innerHTML=api.rail(ready);
   document.body.appendChild(el);
   return {ready:true,count:el.querySelectorAll('.ov3Threshold').length,
    text:el.textContent,axis:ready.axis,pod:ready.pod};
  },fixtureData);
  assert.equal(fixture.ready,true,'published synthetic same-session fixture must render: '+fixture.reason);
  assert.equal(fixture.count,4,'all FOUR priced TRI-POD thresholds must render in browser DOM');
  assert.match(fixture.text,/MA250×0\.95/);
  assert.match(fixture.text,/MA250×1\.01/);
  assert.match(fixture.text,/현재 NDX/);
  assert.match(fixture.text,/DD -9%/);
  assert.ok(fixture.text.includes(fixture.pod),'stage must use real ledger');
  // Colored markers must select their matching threshold card in the actual browser.
  for(const key of ['lower','upper','tri','now']){
    const marker=page.locator('#ov3FixtureRail button[data-ov3-point="'+key+'"]');
    assert.ok(await marker.isVisible(),'marker '+key+' visible');
    await marker.click();
    assert.equal(await marker.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#ov3FixtureRail .ov3Threshold.selected').count(),1);
    assert.equal(await page.locator('#ov3FixtureRail .ov3Threshold.selected').getAttribute('data-ov3-card'),key);
    const status=await page.locator('#ov3FixtureRail [data-ov3-selected]').textContent();
    assert.ok(status.includes(key==='now'?'전일 대비':'현재 대비'),'selected distance status '+key);
     if(key==='now'){
       const card=await page.locator('#ov3FixtureRail [data-ov3-card="now"] .ov3Distance').textContent();
       assert.match(card,/전일 대비 [+-]?[0-9,.]+pt \\([+-]?[0-9.]+%\\)/);
       assert.ok(!status.includes('현재 위치 · 0.00pt'),'no self-distance');
       assert.ok(status.includes(card),'selected status and NDX card same value');
     }
  }

  await page.locator('#ov3FixtureRail').evaluate(el=>el.remove());
  if(width===390){
   const v2=await ctx.newPage();
   await v2.goto(BASE+'?ui=v2',{waitUntil:'networkidle'});
   await v2.locator('.navV2Main button[data-group="brief"]').click();
   await v2.waitForFunction(()=>document.querySelector('#briefVisualDigest')&&document.querySelector('#briefArticle')?.textContent?.length>0,null,{timeout:25000});
   assert.equal(await v2.locator('#briefVisualDigest').evaluate(el=>el.hidden),true,
    'explicit V2 must NOT display V3 brief digest');
   await v2.close();
  }
  assert.deepEqual(errors,[],'no page exceptions');
  console.log('OBS_V3_E2E_PASS width='+width+' visual='+(state.ready?'READY':'HOLD')+' totalNav='+state.navOwner);
  await ctx.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
