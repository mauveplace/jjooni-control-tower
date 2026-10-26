const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let loaderRequests=0;
  await page.route('https://boot.test/**',route=>{
   if(new URL(route.request().url()).pathname.includes('trade-review-loader.js')){loaderRequests++;return route.fulfill({contentType:'application/javascript',body:'window.__JJOONI_UI_BOOT_V14={state:"ACTIVE"};'})}
   return route.fulfill({contentType:'text/html',body:'<html><body><div id="ctEncryptedLiveBadge" title="GVIZ_TIMEOUT">SSOT WAIT</div></body></html>'});
  });
  await page.goto('https://boot.test/');
  await page.evaluate(()=>{window.__JJOONI_FEED_CONNECTION={state:'RETRYING',last_error:'GVIZ_TIMEOUT'};window.__JJOONI_LINEAGE_GUARD={version:'2.0',policy:'fixture'};window.__JJOONI_ENTRY_DIAGNOSTICS={phase:'CONNECTING_ACCOUNTS'};});
  await page.addScriptTag({content:fs.readFileSync('boot-coordinator-v33.js','utf8')});
  await page.waitForFunction(()=>__JJOONI_BOOT_COORDINATOR_V33.pulses>=1);
  assert.equal(await page.locator('#ctUiBootReloadV14').isVisible(),false);assert.doesNotMatch(await page.locator('#ctUiBootTitleV14').innerText(),/실패|진단/);assert.match(await page.locator('#ctUiBootTextV14').innerText(),/다시 시도/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'/tmp/ct-ui-entry-pending.png'});
  await page.evaluate(()=>__JJOONI_FEED_CONNECTION={state:'BLOCKED',last_error:'ENVELOPE_SCHEMA_MISMATCH'});
  await page.locator('#ctUiBootReloadV14').waitFor({state:'visible'});assert.match(await page.locator('#ctUiBootTextV14').innerText(),/검증에 실패/);assert.equal(loaderRequests,0);
  await page.evaluate(()=>{__JJOONI_FEED_CONNECTION={state:'READY'};__JJOONI_CANONICAL_SSOT={};__JJOONI_LIVE_PAYLOAD={};document.dispatchEvent(new Event('jjooni:live-applied'))});
  await page.waitForFunction(()=>__JJOONI_UI_BOOT_V14?.state==='ACTIVE');assert.equal(loaderRequests,1);assert.equal(await page.locator('#ctUiBootShieldV14').count(),0);
  console.log('BOOT_CONNECTION_BROWSER_PASS no-transient-error real-block-visible single-loader-after-recovery mobile-fit');await page.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
