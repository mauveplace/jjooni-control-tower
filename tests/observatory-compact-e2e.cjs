const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<html><head></head><body style="margin:8px"><nav id="tabs"><button data-tab="sectors">섹터</button></nav><section id="sectors"></section></body></html>');
  await page.evaluate(data=>{window.JjooniDataReads={read:async()=>data}},JSON.parse(fs.readFileSync('market-observatory/data/sector-etf.json','utf8')));
  await page.addScriptTag({content:fs.readFileSync('market-observatory/sector-etf-v1.js','utf8')});
  await page.getByRole('button',{name:'섹터',exact:true}).click();await page.waitForFunction(()=>__JJOONI_OBSERVATORY_SECTOR_ETF_V1.loaded);
  const groups=page.locator('details.obsTheme');assert.ok(await groups.count()>2);assert.equal(await page.locator('details.obsTheme[open]').count(),0);
  const before=await page.locator('body').evaluate(e=>e.scrollHeight);await groups.first().locator('summary').click();await page.waitForTimeout(60);
  assert.equal(await groups.first().getAttribute('open'),'');assert.ok(await groups.first().locator('.obsEtfCard:visible').count()>0);
  const after=await page.locator('body').evaluate(e=>e.scrollHeight);assert.ok(after>before,'theme details should expand only on request');
  await page.getByRole('button',{name:'섹터',exact:true}).click();await page.waitForTimeout(60);assert.equal(await groups.first().getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  console.log('SECTOR_COMPACT_PASS',JSON.stringify({groups:await groups.count(),collapsedHeight:before,firstGroupOpenHeight:after}));await page.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
