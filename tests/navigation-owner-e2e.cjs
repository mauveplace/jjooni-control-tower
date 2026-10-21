const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const width of [390,900,1363]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const keys=['overview','portfolio','accounts','tripod','compare','decisions','trades','quality','consultant','watchlist','ai'];
  await page.setContent('<html data-ct-layout="mobile-first"><head><style>'+fs.readFileSync('responsive-layout.css','utf8')+'</style></head><body><nav class="tabs">'+keys.map(key=>'<button class="tab" data-tab="'+key+'" style="display:none!important">'+key+'</button>').join('')+'<button class="tab" data-tab="accounts" data-primary="1">duplicate</button><button id="ctMoreTab" style="display:none!important">더보기</button></nav><nav id="ctMoreMenu"></nav></body></html>');
  let code=fs.readFileSync('trade-review-loader.js','utf8');
  code=code.slice(0,code.lastIndexOf('boot();'))+'window.testNav={canonicalizeNavigation,lockNavigation};})();';
  await page.addScriptTag({content:code});
  await page.evaluate(()=>window.testNav.lockNavigation());
  const visible=await page.locator('.tabs .tab:visible').evaluateAll(xs=>xs.map(x=>x.dataset.tab));
  assert.deepEqual(visible,width<1200?['overview','portfolio','accounts','tripod']:keys.filter(k=>k!=='ai'));
  assert.equal(await page.locator('[data-tab="ai"]').count(),0);
  assert.deepEqual(await page.locator('#ctMoreMenu button').evaluateAll(xs=>xs.map(x=>x.dataset.tab)),['compare','decisions','trades','quality','consultant','watchlist']);
  await page.evaluate(()=>document.querySelector('.tab[data-tab="tripod"]').style.setProperty('display','none','important'));
  await page.waitForTimeout(150);
  assert(await page.locator('.tab[data-tab="tripod"]').isVisible(),'late legacy style cannot hide TRI-POD');
  await page.evaluate(()=>{window.testClicked=false;document.querySelector('.tab[data-tab="trades"]').onclick=()=>window.testClicked=true;document.querySelector('#ctMoreMenu').classList.add('open')});
  await page.locator('#ctMoreMenu button[data-tab="trades"]').evaluate(b=>b.click());
  assert(await page.evaluate(()=>window.testClicked));
  console.log('NAVIGATION_OWNER_PASS',width,JSON.stringify(visible));
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
