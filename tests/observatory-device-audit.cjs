// Runs the repository's public Observatory in Chromium, without account APIs.
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(); fs.mkdirSync('/tmp/obs-audit',{recursive:true});
 for(const width of [360,390,430,768,800,820,1024,1363]){
  const page=await browser.newPage({viewport:{width,height:960},hasTouch:true});
  await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'networkidle'});
  await page.waitForSelector('[data-fresh-key="audit"]',{state:'attached'});
  for(const tab of ['overview','morning-brief','official-macro','indices','fx','energy','analysis-lab','sectors','regime','tripod','rates','calendar']){
   await page.locator(`#tabs [data-tab="${tab}"]`).click();
   if(tab==='analysis-lab')await page.waitForFunction(()=>window.__JJOONI_ANALYSIS_LAB.loaded);
   if(tab==='sectors')await page.waitForFunction(()=>window.__JJOONI_OBSERVATORY_SECTOR_ETF_V1.loaded);
   const result=await page.evaluate(()=>{
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
    const panel=document.querySelector('.panel.on');
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,tab:panel.id,
     nav:rect(document.querySelector('#tabs')),header:rect(document.querySelector('.top')),
     freshness:rect(document.querySelector('#obsFreshnessPanel')),
     smallTargets:[...document.querySelectorAll('#tabs button,.obsRange button,.latestCompare button')].filter(visible).filter(e=>e.getBoundingClientRect().height<44).length,
     clipped:[...panel.querySelectorAll('select,input,button,.card,.obsMacroRow,.labSeriesRow')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1}).map(e=>({tag:e.tagName,cls:e.className,...rect(e)})).slice(0,10),
     textMin:Math.min(...[...panel.querySelectorAll('.meta,.obsCoverage,.obsMacroCell span')].filter(visible).map(e=>parseFloat(getComputedStyle(e).fontSize))) };
   });
   console.log('DEVICE_AUDIT '+JSON.stringify(result));
   assert(result.scroll<=width+1&&result.bodyScroll<=width+1,'page overflow '+JSON.stringify(result));
   if(await page.locator('body.obsDeviceUI').count()){
    assert.equal(result.smallTargets,0,'small touch targets '+JSON.stringify(result));
    assert(result.textMin>=11||result.textMin===null,'small text '+JSON.stringify(result));
    assert.equal(new URL(page.url()).hash,'#'+tab);
    if(tab==='official-macro'){const row=page.locator('[data-macro-key=US_CORE_PCE]');await row.waitFor();assert.match(await row.innerText(),/발표 실제/);assert(await row.getByText(/예상 ·/).isVisible());assert(await row.getByText('Surprise',{exact:true}).isVisible());}
    if(tab==='analysis-lab'){assert.equal(await page.locator('#analysis-lab .obsRange').count(),0);const folded=await page.locator('.labControls').getAttribute('open');assert.equal(folded===null,width<=1100);await page.locator('#labExpand').click();assert(await page.locator('.labExpanded').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('.labExpanded').count(),0);}
    if(tab==='regime'){if(await page.getByText('유효기간이 끝난 과거 합의문입니다.',{exact:false}).count())assert.equal(await page.locator('.mrActions').isVisible(),false);}
   }
   if([390,820].includes(width)&&['overview','official-macro','analysis-lab','sectors'].includes(tab)){
    if(tab!=='overview')await page.evaluate(()=>document.querySelector('.panel.on').scrollIntoView({block:'start'}));
    const data=await page.screenshot({type:'jpeg',quality:45});
    // Public market UI only; no morning brief or account/portfolio screenshots.
    console.log(`AUDIT_IMAGE ${width}-${tab} ${data.toString('base64')}`);
   }
  }
  if([390,820].includes(width)&&await page.locator('body.obsDeviceUI').count()){
   if(await page.locator('#obsCalendarDelay').isVisible()){
    await page.locator('#obsCalendarDelay').click();
    await page.waitForFunction(()=>{const r=document.querySelector('#events [data-actual-status="OVERDUE"]')?.getBoundingClientRect();return r&&r.top>=0&&r.top<innerHeight});
   }
   await page.locator('.obsFreshDetails>summary').click();
   await page.waitForFunction(()=>document.querySelectorAll('#obsFreshGrid .obsFreshTile').length===19);
   assert.equal(await page.locator('#obsFreshGrid .obsFreshTile:visible').count(),19);
   await page.locator('#obsWatchToggle').click();assert(await page.locator('#obsWatchAnalysis').isVisible());
   await page.locator('.obsFreshDetails>summary').click();assert.equal(await page.locator('#obsWatchAnalysis').isVisible(),false);
  }
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
