const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='https://mauveplace.github.io/jjooni-control-tower/market-observatory/';
const keys=['KR_GDP','KR_CORE_CPI','KR_EXPORT_YOY','KR_SEMICON_EXPORT_YOY','KR_EXPORT_1_20','KR_EMPLOYMENT','KR_INDUSTRIAL_PRODUCTION','KR_BOK_OUTLOOK','US_SEP_DOT_PLOT'];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const report=[];
 try{
  const probe=await browser.newPage();let data;
  for(let attempt=0;attempt<17;attempt++){
   const response=await probe.request.get(base+'data/official-macro.json?qa='+Date.now());
   if(response.ok()){
    const d=await response.json();
    if(keys.every(k=>d.metrics[k]?.status==='LIVE'&&d.metrics[k]?.latest?.value!=null)&&d.metrics.KR_GDP.series_identity==='200Y102/Q/10111'){data=d;break;}
   }
   if(attempt<16)await new Promise(r=>setTimeout(r,15000));
  }
  assert(data,'Latest official collectors have not reached production');
  console.log('DEPLOYED_MACRO',data.generated_kst,JSON.stringify(data.quality));
  await probe.close();
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(base,{waitUntil:'networkidle',timeout:90000});
   await page.click('button[data-tab="official-macro"]');
   await page.waitForSelector('.obsMacroQuality');
   for(const key of keys){
    const metric=data.metrics[key];
    const row=page.locator('.obsMacroRow[data-macro-key="'+key+'"]');
    assert.equal(await row.count(),1,key+' absent from UI');
    await row.click();
    const box=page.locator('#officialMacroDetail');
    const text=await box.innerText();
    assert(text.includes(key),key+' detail mismatch');
    assert(!text.includes('NaN')&&!text.includes('undefined'),key+' invalid display');
    assert((await row.innerText()).includes(Number(metric.latest.value).toLocaleString('ko-KR',{maximumFractionDigits:2})),key+' value not rendered');
    if(metric.value_role==='official_forecast'){
     assert.equal(metric.release.actual,null);
     assert(text.includes('연도별 공식 전망')&&text.includes('공식기관 전망입니다.'),key+' forecast mislabelled');
     assert(!text.includes('발표 Actual'),key+' forecast labelled actual');
    }else assert(metric.release.actual!=null,key+' actual missing');
    assert.equal(await box.locator('a:has-text("공식 원문")').count(),1,key+' source missing');
    report.push({width,key,status:metric.status,period:metric.latest.period,value:metric.latest.value,role:metric.value_role||'released_actual'});
   }
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(size.scroll<=size.width+3,'macro horizontal overflow');
   await page.screenshot({path:`macro-production-${width}.png`,fullPage:true});
   await page.close();
  }
  fs.writeFileSync('macro-production-qa.json',JSON.stringify({status:'PASS',generated_kst:data.generated_kst,quality:data.quality,report},null,2));
  console.log('MACRO_PRODUCTION_QA=PASS',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
