const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {ORDER}=require('../market-observatory/freshness-core-v1.js');
(async()=>{const browser=await chromium.launch();try{
 for(const width of [390,820,1363]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const now=Date.parse('2026-10-27T12:00:00+09:00');let calls=0,offline=false;
  const groups=Object.fromEntries(ORDER.map(key=>[key,{label:key,state:key==='audit'?'PASS':'LIVE',critical:['market','audit'].includes(key),as_of:key==='market_regime'?new Date(now+86400000).toISOString():'2026-10-26'}]));
  groups.market_regime.consensus_status='CLOSED';
  groups.crypto.quotes=Object.fromEntries(['BTCUSD','ETHUSD'].map(k=>[k,{status:'LIVE',quote_as_of_kst:new Date(now).toISOString()}]));
  const status={generated_kst:new Date(now).toISOString(),overall:'LIVE',groups};
  await page.route('https://obs.test/**',route=>{
   const url=route.request().url();if(!url.includes('/data/'))return route.fulfill({contentType:'text/html',body:'<html><head></head><body style="margin:0"><nav id="tabs"></nav></body></html>'});
   calls++;return route.fulfill({status:offline?503:200,contentType:'application/json',body:JSON.stringify(url.includes('watchdog')?{result:'HEALTHY_NOOP',checked_kst:'2026-10-27T07:28:00+09:00'}:status)});
  });
  await page.goto('https://obs.test/');
  await page.evaluate(now=>{const RealDate=Date;window.testNow=now;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.testNow]))}static now(){return window.testNow}};window.testIntervals=[];window.setInterval=(fn,ms)=>{window.testIntervals.push({fn,ms});return window.testIntervals.length};window.tickFreshness=()=>window.testIntervals.forEach(x=>x.fn())},now);
  for(const name of ['shared-data-reader-v1.js','freshness-core-v1.js','freshness-all-groups-v1.js','freshness-watchdog-v1.js'])await page.addScriptTag({content:fs.readFileSync('market-observatory/'+name,'utf8')});
  await page.waitForFunction(()=>window.__JJOONI_OBSERVATORY_STATUS?.overall==='LIVE');
  assert.equal(calls,2);assert.equal(await page.evaluate(()=>testIntervals.length),1);
  await page.locator('.obsFreshDetails>summary').click();await page.waitForTimeout(80);
  assert.equal(await page.locator('.obsFreshTile').count(),20);assert.equal(await page.locator('[data-fresh-key=watchdog].good').count(),0);
  await page.getByRole('button',{name:'점검 결과 보기',exact:true}).click();assert.match(await page.locator('#obsWatchAnalysisBody').innerText(),/미국장 마감 복구 전용/);
  await page.evaluate(()=>{testNow+=7201000;tickFreshness()});
  await page.waitForFunction(()=>__JJOONI_OBSERVATORY_STATUS.overall==='STATUS_STALE');
  assert.match(await page.locator('#obsFreshOverall').innerText(),/상태 재점검 필요/);
  assert.match(await page.locator('[data-fresh-key=market]').innerText(),/CHECK_REQUIRED/);
  assert.equal(await page.locator('.obsFreshTile').count(),20);
  offline=true;await page.evaluate(()=>tickFreshness());await page.waitForFunction(()=>__JJOONI_OBSERVATORY_STATUS.load_errors.length===2);
  assert.match(await page.locator('#obsWatchMeta').innerText(),/조회 실패/);
  offline=false;status.generated_kst=new Date(now+7201000).toISOString();for(const q of Object.values(groups.crypto.quotes))q.quote_as_of_kst=status.generated_kst;
  await page.evaluate(()=>tickFreshness());await page.waitForFunction(()=>__JJOONI_OBSERVATORY_STATUS.overall==='LIVE');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
  console.log('OBS_STATUS_OWNER_PASS',width,'one timer, current-clock verdict, failed-read recovery');await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
