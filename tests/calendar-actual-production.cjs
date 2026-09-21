const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const base='https://mauveplace.github.io/jjooni-control-tower/market-observatory/';
const targets=[['2026-09-17','U.S. Initial Jobless Claims','196K'],['2026-09-18','2026년 8월 생산자물가지수','0.2%'],['2026-09-18','BOJ 금융정책','1.25%'],['2026-09-17','Bank of England','3.75%']];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const report=[];
 try {
  // workflow_run can finish before Pages publishes its generated-data commit.
  // Bound propagation wait; a persistent missing actual still fails this QA.
  const probe=await browser.newPage();
  let ready=false;
  for(let attempt=0;attempt<13;attempt++){
   const response=await probe.request.get(base+'data/economic-calendar.json?qa='+Date.now());
   if(response.ok()){
    const data=await response.json();
    ready=targets.every(([date,title,value])=>data.events.some(e=>e.datetime_kst.startsWith(date)&&e.title.includes(title)&&e.actual===value&&e.source_tier==='OFFICIAL'));
    if(ready){console.log('DEPLOYED_CALENDAR',data.generated_kst,data.actual_freshness);break;}
   }
   if(attempt<12) await new Promise(resolve=>setTimeout(resolve,15000));
  }
  await probe.close();assert(ready,'Pages did not publish the recovered official actuals within 180 seconds');
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(base,{waitUntil:'networkidle',timeout:90000});
   await page.click('button[data-tab="calendar"]');
   await page.waitForSelector('#events .event');
   const response=await page.request.get(base+'data/economic-calendar.json?qa='+Date.now());
   assert(response.ok());const data=await response.json();
   for(const [date,title,value] of targets){
    const event=data.events.find(e=>e.datetime_kst.startsWith(date)&&e.title.includes(title));
    assert(event, title);assert.equal(event.actual,value,title);assert.equal(event.source_tier,'OFFICIAL',title);assert(event.source_url,title);
    const row=page.locator('#events .event').filter({hasText:title});
    assert.equal(await row.count(),1,title);await row.scrollIntoViewIfNeeded();
    const text=await row.innerText();assert(text.includes(value),title+' actual not rendered');
    const metrics=await row.locator('.actual').allTextContents();assert(metrics.some(x=>x.includes(value)),title+' actual column missing');
    await row.screenshot({path:`calendar-${width}-${event.country}.png`});
    report.push({width,title,actual:event.actual,source_url:event.source_url,text});
   }
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(size.scroll<=size.width+3,'calendar horizontal overflow');
   await page.close();
  }
  fs.writeFileSync('calendar-production-qa.json',JSON.stringify({status:'PASS',report},null,2));
  console.log('CALENDAR_ACTUAL_PRODUCTION_QA=PASS',JSON.stringify(report));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
