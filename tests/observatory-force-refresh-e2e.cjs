// Offline UI integration: the real page, with a controlled public quote endpoint.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch();try{
 for(const width of [360,820,1363]){
  const page=await browser.newPage({viewport:{width,height:960},hasTouch:true});
  let reads=0,fail=false;
  await page.route('https://jjooni-ct-fast-apgynr7pea-du.a.run.app/observatory/quotes*',async route=>{
   reads++;if(fail)return route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'{}'});
   const at=new Date(Date.now()-60000).toISOString();
   await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({schema:'JJOONI_OBSERVATORY_QUOTES_V1',status:'COMPLETE',fetched_count:1,expected_count:20,quotes:{NASDAQ100:{key:'NASDAQ100',value:30000+reads*100,previous_close:30000,observed_at:at,session_date:at.slice(0,10),market_state:'REGULAR',quality:'DELAY_POSSIBLE',refresh_status:'FETCHED'}}})});
  });
  await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'networkidle'});
  const button=page.getByRole('button',{name:'지금 최신화',exact:true});await button.waitFor();
  const before=await page.evaluate(()=>JSON.stringify({series:DATA.series,tripod:DATA.tripod_latest}));
  const card=page.locator('#latestMarketBoard .latestChangeFirst[data-metric="NASDAQ100"]');
  await page.waitForFunction(()=>document.querySelector('[data-metric="NASDAQ100"] .latestLevelValue')?.textContent.includes('30,100'));
  assert.match(await card.locator('.latestPrimaryLabel').innerText(),/전일 종가 대비/);
  assert.match(await card.locator('.latestQuoteContext').innerText(),/장중 관측/);
  assert.match(await card.locator('time').innerText(),/KST/);
  const r=await button.boundingBox();assert(r.width>=100&&r.height>=48);
  await button.click();await page.waitForFunction(()=>document.querySelector('#obsNowMessage')?.textContent.includes('시세 조회 완료'));
  assert.equal(reads,2);assert.match(await card.locator('.latestLevelValue').innerText(),/30,200/);
  assert.match(await card.locator('.latestPrimaryValue').innerText(),/\+0.67%/);
  assert.match(await page.locator('#overviewKpis').innerText(),/NASDAQ100 · 최근 시세/);assert.match(await page.locator('#overviewKpis').innerText(),/30,200/);
  assert.equal(await page.evaluate(()=>JSON.stringify({series:DATA.series,tripod:DATA.tripod_latest})),before,'quotes never rewrite history or strategy inputs');
  await page.locator('#latestCompare [data-compare="W1"]').click();
  assert.equal(await card.locator('.latestQuoteContext').count(),0,'weekly comparison retains completed-close basis');
  await page.locator('#latestCompare [data-compare="D1"]').click();
  fail=true;await button.click();await page.waitForFunction(()=>document.querySelector('#obsNowMessage')?.dataset.state==='FAILED');
  assert.match(await card.locator('.latestLevelValue').innerText(),/30,200/);assert(await button.isEnabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/obs-force-refresh-'+width+'.png'});
  console.log('OBS_FORCE_REFRESH_PASS',width);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
