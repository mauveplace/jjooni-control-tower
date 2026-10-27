const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');

// Exercise both current and older published calendar contracts using the real UI.
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const legacy of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:844}}),counts={index:0,overrides:0},errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',request=>{const u=request.url();if(u.includes('/calendar-history-index.json'))counts.index++;if(u.includes('/calendar-manual-overrides.json'))counts.overrides++});
   if(legacy){
    const calendar=JSON.parse(fs.readFileSync('market-observatory/data/economic-calendar.json','utf8'));delete calendar.official_actual_contract;
    await page.route('**/economic-calendar.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(calendar)}));
   }
   await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof CAL!=='undefined'&&CAL?.events?.length,{timeout:30000});
   assert.equal(counts.index,0,'overview must not request calendar history');
   assert.equal(counts.overrides,0,'overview must not request manual overrides');
   await page.locator('#tabs button[data-tab="calendar"]').click();
   await page.locator('#events .obsCalEditBtn').first().waitFor({timeout:30000});
   await page.locator('#events .obsHistBtn').first().waitFor({timeout:30000});
   assert.equal(counts.index,0,'calendar entry must not request history until opened');
   assert.equal(counts.overrides,legacy?1:0,'only older calendar contracts need the server seed');
   await page.locator('#events .obsHistBtn').first().click();
   await page.waitForFunction(()=>!!document.querySelector('#events .obsHistPanel.on .obsHistMeta'),null,{timeout:30000});
   assert.equal(counts.index,1,'opening history must fetch its index once');
   assert.deepEqual(errors,[]);
   console.log('CALENDAR_LAZY_PASS',legacy?'legacy':'canonical',counts);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
