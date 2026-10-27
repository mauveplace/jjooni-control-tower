const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const consensus of ['PARTIAL_PENDING_JJANGGU','UNKNOWN','CLOSED']){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const regime=JSON.parse(fs.readFileSync('market-observatory/data/market-regime.json','utf8'));
   regime.source.consensus_status=consensus;
   regime.authority=consensus==='PARTIAL_PENDING_JJANGGU'?'ANALYST_WEEKLY_PROVISIONAL_NOT_FINAL_CONSENSUS':'ANALYST_CONSENSUS_WEEKLY_SSOT';
   regime.effective_window={start_kst:new Date(Date.now()-3600000).toISOString(),end_kst:new Date(Date.now()+3600000).toISOString()};
   await page.route('**/market-regime.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(regime)}));
   await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'domcontentloaded'});
   await page.locator('#tabs button[data-tab="regime"]').click();
   await page.locator('#regimeRoot .mrBadge').first().waitFor({timeout:30000});
   const expected=consensus==='CLOSED'?'ACTIVE':consensus==='UNKNOWN'?'UNKNOWN':'PROVISIONAL';
   assert.equal(await page.locator('#regimeRoot .mrBadge').first().innerText(),expected);
   if(consensus!=='CLOSED')assert(await page.locator('#regimeRoot .obsBasisWarning').isVisible());
   await page.locator('#mrProvisionalReference').waitFor({timeout:30000});
   assert.match(await page.locator('#mrProvisionalReference').innerText(),/부분 합의 대기|기간 경과/);
   assert.deepEqual(errors,[]);
   console.log('REGIME_CONSENSUS_PASS',consensus,expected);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
