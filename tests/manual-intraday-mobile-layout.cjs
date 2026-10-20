const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 for(const width of [360,390,800]){
  const page=await browser.newPage({viewport:{width,height:700},isMobile:width<600,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Use the same isolated public preview; all account data and responses are synthetic.
  await page.route('https://fixture.test/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const file=path.endsWith('ui-refactor.js')?'ui-refactor.js':path.endsWith('manual-intraday-v1.js')?'manual-intraday-v1.js':'qa/intraday-mobile.html';
   await route.fulfill({contentType:file.endsWith('.js')?'application/javascript':'text/html',body:fs.readFileSync(file,'utf8')});
  });
  await page.goto('https://fixture.test/jjooni-control-tower/qa/intraday-mobile.html');
  await page.locator('#width').selectOption(String(width));await page.locator('#height').selectOption('700');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.__JJOONI_MANUAL_INTRADAY?.charts.size===2&&!window.__JJOONI_MANUAL_INTRADAY.busy);
  const canvas=frame.locator('canvas[aria-label="선택 종목의 일중 가격 그래프"]');
  await frame.waitForFunction(()=>document.querySelector('canvas[aria-label="선택 종목의 일중 가격 그래프"]')?.dataset.plotWidth);
  const base=await canvas.evaluate(el=>({w:el.getBoundingClientRect().width,plot:Number(el.dataset.plotWidth),height:Number(el.dataset.plotHeight),ticks:JSON.parse(el.dataset.priceTicks),dual:el.dataset.dualAxis}));
  if(width<600){assert(base.plot/base.w>.7,JSON.stringify(base));assert(base.height>=230);assert.equal(base.dual,'false')}
  assert(base.ticks.every(t=>!t.includes('.')),'No fractional won on KRW axis');
  await frame.getByRole('button',{name:'보유종목 전체 업데이트',exact:true}).click();
  await frame.waitForFunction(()=>!window.__JJOONI_MANUAL_INTRADAY.busy&&window.__JJOONI_MANUAL_INTRADAY.failures.length===1);
  assert.equal(await frame.locator('.mcFailures').getAttribute('open'),null,'Error details start collapsed');
  assert(!await frame.locator('.mcFailures button').isVisible(),'Failure list does not push the chart');
  await frame.getByRole('button',{name:'큰 그래프 보기',exact:true}).click();
  const dialog=frame.getByRole('dialog');await dialog.waitFor();
  const box=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),h=el.querySelector('.mcLargeHeader').getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:innerHeight,headTop:h.top,close:el.querySelector('.mcLargeHeader button').getBoundingClientRect().top}});
  assert(box.top>=-1&&box.bottom<=box.height+1,JSON.stringify(box));assert(box.headTop>=-1&&box.close>=0,'Title and close are visible at open');
  await dialog.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(80);
  const head=await dialog.locator('.mcLargeHeader').evaluate(el=>el.getBoundingClientRect().top);assert(head>=-1,'Sticky title remains visible');
  await page.screenshot({path:`intraday-readable-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'큰 그래프 닫기'}).click();
  assert(!await dialog.isVisible());assert.deepEqual(errors,[]);
  console.log(`INTRADAY_READABILITY=PASS width=${width} plot=${base.plot}x${base.height} KRW integer axis, sticky modal, compact errors`);
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
