const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.OBS_AUDIT_BASE_URL||'http://127.0.0.1:8123/market-observatory/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const viewports=[{name:'phone',width:390,height:844},{name:'tablet',width:800,height:1120},{name:'desktop',width:1365,height:910}];
 for(const v of viewports){
  const page=await browser.newPage({viewport:{width:v.width,height:v.height}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?ui=v3&songwordtest=1',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('#tabs button[data-tab="song-terms"]').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelectorAll('#sw-item-list .sw-card').length>=25,{timeout:30000});
  const initial=await page.locator('#sw-item-list .sw-card').count();
  assert.equal(initial,28,v.name+' source-verified count');
  assert.equal(await page.locator('.navV2Main button').count(),5,v.name+' exactly 5 main tabs');
  await page.locator('#sw-search').fill('신용스프레드');
  assert.equal(await page.locator('#sw-item-list .sw-card').count(),1,'search result count');
  await page.locator('#sw-item-list [data-sw-action="expand"]').first().click();
  assert.match(await page.locator('#sw-item-list .sw-card .sw-detail').first().innerText(),/송팀장 원문/);
  await page.locator('#sw-item-list [data-sw-action="learn"]').first().click();
  assert.match(await page.locator('#sw-progress').innerText(),/1 \/ 28/);
  await page.locator('#sw-search').fill('');
  await page.locator('#song-terms [data-sw-mode="flash"]').click();
  await page.locator('#song-terms [data-sw-action="flip"]').click();
  assert.ok((await page.locator('#sw-card-flip').innerText()).length>20);
  await page.locator('#song-terms [data-sw-mode="quiz"]').click();
  await page.locator('#song-terms [data-sw-action="answer"]').first().click();
  assert.ok(await page.locator('#song-terms .sw-feedback').count(),'quiz feedback available');
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,mainNav:[...document.querySelectorAll('.navV2Main button')].map(x=>x.textContent.trim())}));
  assert.ok(layout.scroll<=layout.width+4,v.name+' page horizontal overflow '+JSON.stringify(layout));
  assert.deepEqual(layout.mainNav,['오늘','시장','전략','일정','시황']);
  assert.equal(errors.filter(e=>/song.word|sw-|song-terms/i.test(e)).length,0,v.name+' study runtime errors '+errors.join(' | '));
  console.log(v.name,'PASS',JSON.stringify({initial,layout,quiz:'responded'}));
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});