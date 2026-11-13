const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const report=JSON.parse(fs.readFileSync('market-observatory/data/morning-brief/latest.json','utf8'));
const quoteCards=(report.editorial_contract?.close_checks||[]).map(check=>{
 const official=['VERIFIED','CROSS_CHECKED'].includes(check.status) && Number.isFinite(check.close) && Number.isFinite(check.change_pct);
 const r=(report.editorial_contract?.reference_quotes||[]).find(r=>r.symbol===check.symbol&&r.session_date===report.market_date_us&&r.status==='PROVIDER_REFERENCE_ONLY'&&r.trade_signal_eligible===false&&r.official_eod_verified===false);
 const ref=!official&&check.status==='CONFLICT'&&r;
 const close=official?check.close:ref?r.close:null;
 const pct=official?check.change_pct:ref?r.change_pct:null;
 return {symbol:check.symbol,closeText:Number.isFinite(close)?Number(close).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'확인 보류',pctText:Number.isFinite(pct)?Number(pct).toFixed(2)+'%':null,reference:!!ref};
});
// Real mobile viewport must accept the new display-only post-publication
// catch-up; the immutable editorial close gate is deliberately unchanged.
const glance=JSON.parse(fs.readFileSync('market-observatory/data/daily-glance.json','utf8'));
const pulse=JSON.parse(fs.readFileSync('market-observatory/data/daily-market-pulse.json','utf8'));
const ndxItem=(glance.groups||[]).flatMap(g=>g.items||[]).find(x=>x.key==='NASDAQ100');
const soxItem=(glance.groups||[]).flatMap(g=>g.items||[]).find(x=>x.key==='SOX');
const pndx=pulse.raw?.tradingview_cross_asset?.ndx;
const hasAlignedCanonical=(glance.us_session===report.market_date_us&&
 glance.tripod?.session===report.market_date_us&&pulse.market_date_us===report.market_date_us&&
 pulse.session_gate?.aligned===true&&pulse.snapshot_status==='FINAL'&&
 glance.no_trade===true&&pulse.read_only===true&&
 glance.consistency?.status==='OK'&&pndx?.market_date===report.market_date_us&&
 ndxItem?.date===report.market_date_us&&
 [glance.tripod?.ndx,glance.tripod?.vix10,glance.tripod?.ma250,
  glance.tripod?.drawdown_52w_pct,ndxItem?.value,ndxItem?.d1_pct,
  pndx?.value,pndx?.change_pct].every(Number.isFinite)&&
 Math.abs(ndxItem.value-pndx.value)<=0.05&&
 Math.abs(glance.tripod.ndx-pndx.value)<=0.05&&
 Math.abs(ndxItem.d1_pct-pndx.change_pct)<=0.06);
if(hasAlignedCanonical){
 for(const c of quoteCards){
  if(c.closeText!=='확인 보류')continue;
  if(c.symbol==='NDX'){
   c.closeText=Number(pndx.value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
   c.pctText=Number(pndx.change_pct).toFixed(2)+'%';
   c.reference=true;c.singleSource=true;
  }
  if(c.symbol==='SOX'&&soxItem?.date===report.market_date_us&&
     Number.isFinite(soxItem.value)&&soxItem.value>0&&Number.isFinite(soxItem.d1_pct)){
   c.closeText=Number(soxItem.value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
   c.pctText=Number(soxItem.d1_pct).toFixed(2)+'%';
   c.reference=true;c.singleSource=true;
  }
 }
}
const nowKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const {name,width,height} of [{name:'mobile360',width:360,height:800},
    {name:'mobile390',width:390,height:844},
    {name:'mobile430',width:430,height:932},
    {name:'tablet800',width:800,height:1280}]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'domcontentloaded',timeout:90000});
   await page.locator('button[data-tab="morning-brief"]').click();
   await page.waitForFunction(expected=>{
    const cards=[...document.querySelectorAll('#briefKeyFigures .briefFigure b')].map(x=>x.textContent);
    return cards.length===expected.length && cards.every((v,i)=>v.includes(expected[i]));
   },quoteCards.map(x=>x.closeText),{timeout:45000});
   const result=await page.evaluate(()=>{
    const rect=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width}};
    const tools=document.querySelector('.briefTools');
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,
     title:document.querySelector('#briefTitle')?.textContent,
     badge:document.querySelector('#briefBadge')?.textContent,
     notice:document.querySelector('#briefNotice')?.textContent,
     figures:[...document.querySelectorAll('#briefKeyFigures .briefFigure')].map(x=>x.innerText),
     detailsOpen:document.querySelector('#briefSourceDetails')?.open,
     tools:rect(tools),label:rect(tools.querySelector('label')),select:rect(tools.querySelector('select')),
     refresh:rect(tools.querySelector('button')),head:rect(document.querySelector('.briefHead'))};
   });
   assert.equal(result.scroll<=result.width+3,true,name+' horizontal page overflow '+JSON.stringify(result));
   assert.match(result.badge,report.report_date_kst===nowKst()?/오늘 공개본/:/마지막 게시본/);
   if((report.editorial_contract?.close_checks||[]).some(c=>c.status==='CONFLICT'))assert.match(result.notice,/확정 종가 불일치\/미검증/);
   assert.doesNotMatch(result.notice,/CROSS_CHECKED/);
   if(hasAlignedCanonical&&quoteCards.some(c=>c.singleSource)){
    assert.match(result.notice,/후속 원장 참고값/);
    assert.match(await page.locator('#briefCanonicalCatchup').innerText(),/NO_TRADE_REVIEW_ONLY/);
   }
   for(let i=0;i<quoteCards.length;i++){
    const card=quoteCards[i],actual=result.figures[i];
    assert.match(actual,new RegExp(card.closeText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(card.pctText)assert(actual.includes(card.pctText),name+' missing percent '+card.symbol);
    if(card.reference)assert.match(actual,card.singleSource?/원장 참고.*공식 EOD 미검증/:/참고 완료 일봉.*공식 종가 미검증/);
   }
   assert.equal(result.detailsOpen,false);
   for(const k of ['tools','label','select','refresh','head']){
    assert(result[k].left>=-2&&result[k].right<=width+2,name+' '+k+' overflows');
   }
   if(width<=430)assert(result.select.bottom<=result.refresh.top+2,name+' mobile refresh overlaps date select');
   await page.locator('#briefSourceDetails summary').click();
   assert((await page.locator('#briefSourceDetails p').textContent()).trim().length>20);
   await page.screenshot({path:'/tmp/brief-'+name+'.png'});
   console.log('BRIEF_MOBILE_RENDER=PASS '+name+' '+quoteCards.map(x=>x.symbol+'_'+x.closeText).join(',')+' report='+report.report_date_kst);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
