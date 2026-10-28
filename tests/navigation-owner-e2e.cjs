const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const width of [390,900,1363]){
  const page=await browser.newPage({viewport:{width,height:1000},hasTouch:true,isMobile:width<768});
  const keys=['overview','portfolio','accounts','tripod','compare','decisions','trades','quality','consultant','watchlist','ai'];
  await page.setContent('<html data-ct-layout="mobile-first"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('responsive-layout.css','utf8')+'</style></head><body><nav class="tabs"><div class="sideLabel">WATCHLIST</div>'+keys.map(key=>'<button class="tab" data-tab="'+key+'" style="display:none!important">'+key+'</button>').join('')+'<button class="tab" data-tab="accounts" data-primary="1">duplicate</button><button id="ctMoreTab" style="display:none!important">더보기</button></nav><nav id="ctMoreMenu"></nav></body></html>');
  let code=fs.readFileSync('trade-review-loader.js','utf8');
  code=code.slice(0,code.lastIndexOf('boot();'))+'window.testNav={canonicalizeNavigation,lockNavigation};})();';
  await page.addScriptTag({content:code});
  await page.evaluate(()=>window.testNav.lockNavigation());
  const visible=await page.locator('.tabs .tab:visible').evaluateAll(xs=>xs.map(x=>x.dataset.tab));
  assert.deepEqual(visible,['overview','portfolio','accounts','tripod']);
  assert.equal(await page.locator('[data-tab="ai"]').count(),0);assert.equal(await page.locator('.tabs .sideLabel').isVisible(),false);
  assert.deepEqual(await page.locator('#ctMoreMenu button').evaluateAll(xs=>xs.map(x=>x.dataset.tab)),['compare','decisions','trades','quality','consultant','watchlist']);
  await page.evaluate(()=>document.querySelector('.tab[data-tab="tripod"]').style.setProperty('display','none','important'));
  await page.waitForTimeout(150);
  assert(await page.locator('.tab[data-tab="tripod"]').isVisible(),'late legacy style cannot hide TRI-POD');
  await page.evaluate(()=>document.querySelector('#ctMoreMenu button[data-tab=trades]').remove());
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#ctMoreMenu button[data-tab=trades]').count(),1,'late legacy menu rebuild cannot discard a destination');
  await page.evaluate(()=>{window.testClicked=false;document.querySelector('.tab[data-tab="trades"]').onclick=()=>window.testClicked=true;document.querySelector('#ctMoreMenu').classList.add('open')});
  await page.locator('#ctMoreMenu button[data-tab="trades"]').evaluate(b=>b.click());
  assert(await page.evaluate(()=>window.testClicked));
  // Reproduce legacy order changes during mobile navigation; hit boxes must stay fixed.
  await page.evaluate(()=>{
   const ids=['overview','portfolio','accounts','tripod'];
   ids.forEach((id,i)=>{const p=document.createElement('section');p.id='panel-'+id;p.textContent=id;p.style.display='none';document.body.append(p);
    const tab=document.querySelector('.tabs .tab[data-tab="'+id+'"]');tab.style.setProperty('order',String(4-i),'important');tab.onclick=()=>{document.querySelectorAll('section[id^="panel-"]').forEach(x=>x.style.display=x.id==='panel-'+id?'block':'none')};
   });
  });
  for(const id of ['overview','portfolio','accounts','tripod']){
   const target=page.locator('.tabs .tab[data-tab="'+id+'"]').first(),r=await target.boundingBox();
   const actual=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.tab')?.dataset.tab,{x:r.x+r.width/2,y:r.y+r.height/2});
   assert.equal(actual,id,'visible touch target must be the requested tab');
   await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
   assert(await page.locator('#panel-'+id).isVisible(),'touch opens '+id);
   if(id==='accounts')assert(!(await page.locator('#panel-tripod').isVisible()));
  }
  const bounds=await page.locator('.tabs .tab:visible').evaluateAll(xs=>xs.map(x=>({id:x.dataset.tab,x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y})));
  assert.deepEqual(bounds.sort((a,b)=>a.x-b.x).map(x=>x.id),['overview','portfolio','accounts','tripod'],'legacy order must not move touch targets');
  console.log('NAVIGATION_OWNER_PASS',width,JSON.stringify(visible));
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
