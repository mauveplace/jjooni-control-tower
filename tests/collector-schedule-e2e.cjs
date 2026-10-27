const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];let calls=0,offline=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.github.com/repos/mauveplace/jjooni-control-tower/actions/workflows/market-observatory-daily.yml/runs?*',route=>{
   calls++;const run={id:123,event:'schedule',created_at:new Date(Date.now()-160*60000).toISOString(),status:'completed',conclusion:'success'};
   return route.fulfill({status:offline?503:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({workflow_runs:[run]})});
  });
  await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'domcontentloaded'});
  await page.locator('#obsCollectorSchedule').waitFor({state:'attached',timeout:30000});
  assert.equal(calls,0,'collapsed panel should not request GitHub');
  await page.locator('.obsFreshDetails > summary').click();
  await page.waitForFunction(()=>document.querySelector('#obsCollectorSchedule')?.dataset.state==='SCHEDULE_GAP',null,{timeout:30000});
  assert.equal(calls,1);assert.match(await page.locator('#obsCollectorDetail').innerText(),/실행 기록은 수집 완료나 자동 복구를 보장하지 않습니다/);
  offline=true;await page.locator('#obsCollectorRetry').click();
  await page.waitForFunction(()=>document.querySelector('#obsCollectorSchedule')?.dataset.state==='UNVERIFIED',null,{timeout:30000});
  assert.equal(calls,2);assert.deepEqual(errors,[]);console.log('COLLECTOR_SCHEDULE_E2E_PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
