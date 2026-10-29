const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const width of [320,360,390,500,599,600,768,900,1363]){
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
   assert(r.width>=80&&r.height>=52,'usable touch area at '+width+': '+JSON.stringify(r));
   for(const x of [r.x+3,r.x+r.width/2,r.x+r.width-3]){
    await page.touchscreen.tap(x,r.y+r.height/2);
    assert(await page.locator('#panel-'+id).isVisible(),'center and edge touches open '+id+' at '+width);
   }
   if(id==='accounts')assert(!(await page.locator('#panel-tripod').isVisible()));
  }
  const bounds=await page.locator('.tabs .tab:visible').evaluateAll(xs=>xs.map(x=>({id:x.dataset.tab,x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y})));
  assert.deepEqual(bounds.sort((a,b)=>a.y-b.y||a.x-b.x).map(x=>x.id),['overview','portfolio','accounts','tripod'],'legacy order must not move touch targets');
  const targets=await page.locator('.tabs>.tab:visible,.tabs>#ctMoreTab').evaluateAll(xs=>xs.map(e=>({id:e.dataset.tab||'more',...e.getBoundingClientRect().toJSON()})));
  for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
   const a=targets[i],b=targets[j];
   const gapX=Math.max(b.x-a.right,a.x-b.right),gapY=Math.max(b.y-a.bottom,a.y-b.bottom);
   assert(gapX>=7.9||gapY>=7.9,'touch targets must have 8px separation: '+JSON.stringify([a,b]));
   if(Math.abs(a.y-b.y)<1&&b.x>a.x&&b.x-a.right<10){
    const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.tab,button')?.dataset.tab||null,{x:(a.right+b.x)/2,y:a.y+a.height/2});
    assert.equal(hit,null,'gap must not trigger a neighboring tab');
   }
  }
  if(width<=599){assert(targets[3].y>targets[0].y,'phone uses two rows');assert(targets[0].width>=80)}
  else assert(targets.every(t=>Math.abs(t.y-targets[0].y)<1),'tablet and desktop keep one row');
  // The portfolio capture guard must update the same route/title as legacy tabs.
  await page.evaluate(()=>{
   const header=document.createElement('header');header.className='top';header.innerHTML='<span class="brand">Overview</span>';document.body.prepend(header);
   const style=document.createElement('style');style.textContent='.tabPanel{display:none}.tabPanel.on{display:block}';document.head.append(style);
   for(const p of document.querySelectorAll('section[id^="panel-"]')){p.classList.add('tabPanel');p.style.removeProperty('display')}
   for(const tab of document.querySelectorAll('.tabs .tab[data-tab]'))tab.onclick=()=>{
    document.querySelectorAll('.tabPanel').forEach(p=>p.classList.toggle('on',p.id==='panel-'+tab.dataset.tab));
    document.querySelectorAll('.tabs .tab[data-tab]').forEach(t=>t.classList.toggle('on',t===tab));
    document.querySelector('.brand').textContent=tab.dataset.tab;
    history.replaceState(null,'','#'+tab.dataset.tab);
   };
  });
  await page.addScriptTag({content:fs.readFileSync('portfolio-tab-target-guard-v1.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('tablet-stability-v37.js','utf8')});
  await page.locator('.tabs .tab[data-tab="portfolio"]').first().click();
  assert(await page.locator('#panel-portfolio').isVisible());
  assert.equal(await page.locator('.brand').innerText(),'보유분석');
  assert.equal(await page.evaluate(()=>location.hash),'#portfolio');
  await page.locator('.tabs .tab[data-tab="tripod"]').first().click();
  await page.waitForTimeout(350);
  assert(await page.locator('#panel-tripod').isVisible(),'last intentional destination wins');
  assert.equal(await page.evaluate(()=>location.hash),'#tripod');
  await page.locator('.tabs .tab[data-tab="portfolio"]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  assert(await page.locator('#panel-portfolio').isVisible());
  assert.equal(await page.locator('.brand').innerText(),'보유분석');
  assert.equal(await page.evaluate(()=>location.hash),'#portfolio');
  await page.setViewportSize({width:width+40,height:900});
  await page.waitForTimeout(150);
  assert(await page.locator('#panel-portfolio').isVisible(),'resize keeps the selected panel');
  console.log('NAVIGATION_OWNER_PASS',width,JSON.stringify(visible));
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
