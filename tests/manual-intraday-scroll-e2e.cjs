// Offline mobile regression with staggered cached data and changing browser-chrome height.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const width of [360,390,412]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const day=new Date().toISOString().slice(0,10),codes=Array.from({length:24},(_,i)=>String(500000+i));
  await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui}header{height:140px;background:#071a33;color:white;padding:12px;box-sizing:border-box}main{padding:12px}</style><header>모바일 스크롤 검사 · 합성 데이터</header><main id="panel-portfolio"></main>'}));
  await page.route('https://jjooni-ct-fast-apgynr7pea-du.a.run.app/**',async route=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-CT-Epoch,X-CT-Proof'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   const body=route.request().postDataJSON(),path=new URL(route.request().url()).pathname;
   await new Promise(r=>setTimeout(r,path==='/charts/reference'?140:90));
   let out;if(path==='/charts/read')out={chart:{schema:'CT_MANUAL_INTRADAY_V1',symbol:body.symbol,session_date:day,market_timezone:'Asia/Seoul',updated_at:new Date().toISOString(),last_bar_at:day+'T06:30:00Z',backfill_complete:true,candles:[{timestamp:day+'T00:00:00Z',close:100,currency:'KRW'},{timestamp:day+'T06:30:00Z',close:103,currency:'KRW'}]}};
   else if(path==='/charts/reference')out={reference:{session_date:day,previous_close:100,previous_close_date:'2026-01-01'}};
   else if(path==='/charts/observe')out={history:{points:[]}};else throw Error('unexpected automatic collection '+path);
   await route.fulfill({contentType:'application/json',headers,body:JSON.stringify(out)});
  });
  await page.goto('https://fixture.test/');
  await page.evaluate(codes=>{sessionStorage.setItem('jjooni_ct_session_pw','synthetic-password');window.__JJOONI_LIVE_READY=true;window.__JJOONI_CANONICAL_SSOT={accounts:{TOSS:{positions:codes.map(ticker=>({ticker,qty:1,name:'검사 종목 '+ticker}))}}}},codes);
  await page.addScriptTag({content:fs.readFileSync('ui-refactor.js','utf8')});await page.addScriptTag({content:fs.readFileSync('manual-intraday-v1.js','utf8')});
  const graph=page.locator('canvas[aria-label="선택 종목의 일중 가격 그래프"]');await graph.waitFor();await page.waitForFunction(()=>window.__JJOONI_MANUAL_INTRADAY.charts.size>=2);
  await page.evaluate(()=>window.scrollTo(0,460));const initial=await graph.evaluate(e=>e.getBoundingClientRect().top);
  // Cached holdings/reference responses keep arriving while the user reads the main graph.
  await page.waitForFunction(()=>[...window.__JJOONI_MANUAL_INTRADAY.charts.values()].length===24&&[...window.__JJOONI_MANUAL_INTRADAY.charts.values()].every(c=>c.previous_close===100));await page.waitForTimeout(150);
  assert(Math.abs((await graph.evaluate(e=>e.getBoundingClientRect().top))-initial)<3,'cache/reference updates must preserve the visible chart at '+width);
  assert((await page.evaluate(()=>scrollY))>300,'background cache load must not jump to the page header');
  await page.evaluate(()=>{window.stableCanvas=document.querySelector('canvas[aria-label="선택 종목의 일중 가격 그래프"]');window.stableControls=document.querySelector('.mcControls')});
  for(let i=0;i<12;i++){await page.setViewportSize({width,height:i%2?844:700});await page.waitForTimeout(35)}
  const after=await page.evaluate(()=>({canvas:window.stableCanvas===document.querySelector('canvas[aria-label="선택 종목의 일중 가격 그래프"]'),controls:window.stableControls===document.querySelector('.mcControls'),y:scrollY}));
  assert(after.canvas&&after.controls,'height-only browser-chrome changes must retain chart and controls');assert(after.y>300,'height-only resize cannot reset scrolling');
  await page.setViewportSize({width:width+16,height:844});await page.waitForTimeout(150);
  assert(await page.evaluate(()=>window.stableCanvas===document.querySelector('canvas[aria-label="선택 종목의 일중 가격 그래프"]')),'width resize repaints the existing canvas');
  await page.setViewportSize({width,height:844});await page.waitForTimeout(150);assert.deepEqual(errors,[]);
  await page.screenshot({path:'intraday-scroll-'+width+'.png'});
  console.log('PASS mobile-scroll '+width+'px height-resizes=12 canvas=retained controls=retained asynchronous-anchor=stable');await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
