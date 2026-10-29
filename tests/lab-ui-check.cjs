const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 for(const width of [390,820]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/data/observatory.json*',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync(fs.existsSync('lab-observatory.json')?'lab-observatory.json':'market-observatory/data/observatory.json','utf8')}));
  await page.route('**/data/official-macro.json*',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync(fs.existsSync('lab-official-macro.json')?'lab-official-macro.json':'market-observatory/data/official-macro.json','utf8')}));
  await page.route('**/market-observatory/*.js*',r=>{const url=new URL(r.request().url());const name=url.pathname.split('/').at(-1);if(!['analysis-lab-core.js','analysis-lab-v1.js','latest-board-v1.js','shared-data-reader-v1.js'].includes(name))return r.fulfill({contentType:'application/javascript',body:''});return r.continue();});
  let chartPath;try{chartPath=require.resolve('chart.js',{paths:[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}).replace(/dist\/chart\.cjs$/,'dist/chart.umd.js');}catch(e){}
  if(chartPath)await page.route('**/chart.umd.min.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(chartPath,'utf8')}));
  await page.goto('http://127.0.0.1:8765/market-observatory/index.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.latestTile[data-metric="US10Y_OFFICIAL"] .latestTilePeriods');
  assert(!(await page.locator('body').innerText()).includes('\\n'),'literal newline must never leak into visible text');
  const rates=page.locator('.latestTile[data-metric="US10Y_OFFICIAL"] .latestTilePeriods');
  const rateTile=page.locator('.latestTile[data-metric="US10Y_OFFICIAL"]');
  const rateText=await rateTile.innerText();assert.equal((rateText.match(/일간/g)||[]).length,1);assert.equal((rateText.match(/주간/g)||[]).length,1);
  // Change-first cards promote the selected comparison to the headline and hide
  // its duplicate in the secondary period row. Verify both daily and weekly
  // changes remain visible across the headline switch, rather than asserting
  // that the secondary row is invariant.
  const primary=rateTile.locator('.latestPrimaryChange');
  const rateBefore=await rateTile.innerText();
  assert.match(await primary.innerText(),/일간 대비[\\s\\S]*bp/);
  assert.match(await rates.innerText(),/주간 .*bp/);
  assert.match(await page.locator('.latestTile[data-metric="USDKRW"] .latestTilePeriods').innerText(),/주간 .*%/);
  assert.match(await page.locator('.latestTile[data-metric="FEAR_GREED"] .latestPrimaryChange').innerText(),/일간 대비[\\s\\S]*pt/);
  await page.locator('#latestCompare [data-compare="W1"]').click();
  assert.match(await primary.innerText(),/주간 대비[\\s\\S]*bp/);
  assert.match(await rates.innerText(),/일간 .*bp/);
  const weeklyRateText=await rateTile.innerText();
  assert.equal((weeklyRateText.match(/일간/g)||[]).length,1);
  assert.equal((weeklyRateText.match(/주간/g)||[]).length,1);
  await page.locator('#latestCompare [data-compare="D1"]').click();
  assert.equal(await rateTile.innerText(),rateBefore,'daily/weekly headline switch must preserve both comparisons');
  await page.screenshot({path:'lab-overview-'+width+'.png',fullPage:true});
  await page.locator('[data-tab="analysis-lab"]').click();
  await page.waitForFunction(()=>window.__JJOONI_ANALYSIS_LAB?.loaded,{timeout:30000});
  assert.equal(await page.locator('#labSeries .labSeriesRow').count(),3);
  if(await page.locator('details.labControls').count())await page.locator('details.labControls>summary').click();
  const initial=await page.locator('#labStats').innerText();assert.match(initial,/공통 관측/);
  await page.selectOption('#labType','scatter');assert.equal(await page.evaluate(()=>Chart.getChart('labChart').config.type),'scatter');
  await page.selectOption('#labType','correlation');assert.match(await page.locator('#labNotes').innerText(),/사후 분석/);
  await page.selectOption('#labBasis','release');assert.match(await page.locator('#labNotes').innerText(),/발표일이 없는 이력은 제외/);
  await page.selectOption('#labBasis','reference');await page.locator('#labSave').click();await page.locator('[data-preset="dollar"]').click();await page.locator('#labLoad').click();assert.equal(await page.locator('#labType').inputValue(),'correlation');
  await page.locator('#labShare').click();assert.match(await page.locator('#labShareUrl').inputValue(),/#analysis=/);
  await page.locator('#labExpand').click();assert.equal(await page.locator('.labExpanded').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.labExpanded').count(),0);
  await page.screenshot({path:'lab-'+width+'.png',fullPage:true});const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,inner:innerWidth,overflow:[...document.querySelectorAll('#analysis-lab *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))}));assert(size.width<=size.inner+2,JSON.stringify(size));
  assert.equal(await page.locator('#latestMarketBoard').isVisible(),false);assert.deepEqual(errors,[]);
  await page.screenshot({path:'lab-'+width+'.png',fullPage:true});console.log('LAB_UI_PASS width='+width+' stats='+initial);await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
