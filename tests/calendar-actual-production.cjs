const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const base='https://mauveplace.github.io/jjooni-control-tower/market-observatory/';
const {targets,verifiedTargetActualsReady}=require('./calendar-actual-production-readiness.cjs');
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
    // An unrelated newly due release must not invalidate the already verified targets.
    ready=verifiedTargetActualsReady(data);
    if(ready){console.log('DEPLOYED_CALENDAR',data.generated_kst,data.actual_freshness);break;}
   }
   if(attempt<12) await new Promise(resolve=>setTimeout(resolve,15000));
  }
  await probe.close();assert(ready,'Pages did not publish the target verified official actuals within 180 seconds');
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(base,{waitUntil:'networkidle',timeout:90000});
   await page.click('button[data-tab="calendar"]');
   await page.waitForSelector('#events .event');
   // The UI correctly opens the current month. Navigate to the historical
   // release month explicitly so this regression survives month rollover.
   const targetMonth=targets[0][0].slice(0,7);
   for(let attempt=0;attempt<120;attempt++){
    const selected=(await page.locator('#calendarMonth').innerText()).trim();
    if(selected===targetMonth)break;
    assert(/^\d{4}-\d{2}$/.test(selected),'invalid selected calendar month');
    await page.click(selected>targetMonth?'#prevMonth':'#nextMonth');
   }
   assert.equal((await page.locator('#calendarMonth').innerText()).trim(),targetMonth);

   const response=await page.request.get(base+'data/economic-calendar.json?qa='+Date.now());
   assert(response.ok());const data=await response.json();
   for(const [date,title,value] of targets){
    const event=data.events.find(e=>e.datetime_kst.startsWith(date)&&e.title.includes(title));
    assert(event, title);assert.equal(event.actual,value,title);assert.equal(event.source_tier,'OFFICIAL',title);assert(event.source_url,title);
    // Recurring releases (claims, PMI, etc.) legitimately appear multiple times in
    // the selected month. Scope the DOM assertion to the target release's verified
    // actual instead of requiring the title itself to be globally unique.
    const row=page.locator('#events .event').filter({hasText:title}).filter({has:page.locator('.date').filter({hasText:date.slice(5)})});
    assert.equal(await row.count(),1,`${title} ${date} ${value}`);
    // Read the row first. The live calendar may replace DOM nodes during a poll,
    // so scrolling a previously resolved element can race with that refresh.
    const text=await row.innerText();assert(text.includes(value),title+' actual not rendered');
    const metrics=await row.locator('.actual').allTextContents();assert(metrics.some(x=>x.includes(value)),title+' actual column missing');
    try {
      await row.screenshot({path:`calendar-${width}-${event.country}.png`,timeout:4000});
    } catch (error) {
      // Screenshots are diagnostics, not the source-of-truth validation above.
      // Preserve evidence even if a live poll detaches a row during auto-scroll.
      console.warn('CALENDAR_ROW_SCREENSHOT_FALLBACK',String(error.message||error));
      await page.screenshot({path:`calendar-${width}-${event.country}.png`});
    }
    report.push({width,date,title,actual:event.actual,source_url:event.source_url,text});
   }
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(size.scroll<=size.width+3,'calendar horizontal overflow');
   // Exercise a new published payload without changing server data. The same
   // public poll function must refresh values/status and preserve month selection.
   const month=await page.locator('#calendarMonth').innerText();
   const simulated=structuredClone(data);
   const delayed=simulated.events.find(e=>e.title==='U.S. Initial Jobless Claims'&&e.datetime_kst.startsWith('2026-09-17'));
   delayed.actual=null;delayed.actual_status='OVERDUE';
   for(const metric of delayed.market_metrics||[])metric.actual=null;
   simulated.actual_freshness={...simulated.actual_freshness,status:'DEGRADED',overdue_count:1};
   simulated.generated_kst=new Date(Date.now()+60000).toISOString();
   await page.route('**/data/economic-calendar.json?refresh=*',route=>route.fulfill({json:simulated}));
   assert(await page.evaluate(()=>window.__JJOONI_OBSERVATORY_UI.refresh_calendar(true)));
   assert.equal(await page.locator('#calendarMonth').innerText(),month);
   const delayedRow=page.locator('#events .event').filter({hasText:'U.S. Initial Jobless Claims'}).filter({hasText:'수집 지연'});
   assert.equal(await delayedRow.count(),1,'target overdue claims row must be unique after simulated refresh');
   assert((await delayedRow.innerText()).includes('수집 지연'));
   assert((await page.locator('#calendarLiveStatus').innerText()).includes('수집 지연 1건'));
   await delayedRow.screenshot({path:`calendar-${width}-overdue.png`});
   // A failed poll preserves the last payload, and reports connection failure.
   await page.unroute('**/data/economic-calendar.json?refresh=*');
   await page.route('**/data/economic-calendar.json?refresh=*',route=>route.fulfill({status:503,body:'Unavailable'}));
   assert.equal(await page.evaluate(()=>window.__JJOONI_OBSERVATORY_UI.refresh_calendar(true)),false);
   assert((await delayedRow.innerText()).includes('수집 지연'));
   assert((await page.locator('#calendarLiveStatus').innerText()).includes('연결 재시도'));
   report.push({width,poll_update:'PASS',poll_failure_preserves_values:'PASS',selected_month_preserved:true});
   await page.close();
  }
  fs.writeFileSync('calendar-production-qa.json',JSON.stringify({status:'PASS',report},null,2));
  console.log('CALENDAR_ACTUAL_PRODUCTION_QA=PASS',JSON.stringify(report));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});