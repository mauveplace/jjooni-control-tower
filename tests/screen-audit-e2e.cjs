const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 for(const width of [390,820,1363]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html><head><style>*{box-sizing:border-box}body{margin:8px}.ctCommonLine{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.ctCommonLine small{display:block}</style></head><body><section id="panel-portfolio"><section class="card"><div id="accounts">LEGACY_ZERO</div></section><section class="card"><div id="risks">LEGACY_RISK</div></section><section class="card"><div id="humanPositions">LEGACY_POSITIONS</div></section></section><section id="portfolio-extra">OLD_CURRENT_HISTORY</section></body></html>');
  await page.evaluate(()=>{
   const p={ticker:'TEST',name:'검수용 USD 종목',currency:'USD',market:'US',qty:2,current_price:110};
   const a={id:'TOSS',nav:286000,cash_krw:0,cash_usd:0,fx:1300,positions:[p],holding_price_effect:{positions:[{...p,baseline_price:100,baseline_session_date:'2026-10-23',baseline_source:'BROKER_CANDLES',state:'CALCULATED'}]}};
   window.__JJOONI_CANONICAL_SSOT={accounts:{TOSS:a},snapshot_id:'synthetic-screen'};
   window.__JJOONI_LIVE_PAYLOAD={generated_kst:new Date().toISOString(),source_health:{pb_history:{state:'STALE'}},fx_reference:{state:'REFERENCE',krw_per_usd:1300,prev_close_krw_per_usd:1320}};
  });
  for(const name of ['canonical-metrics.js','overview-consistency-v21.js','fx-attribution-v16.js'])await page.addScriptTag({content:fs.readFileSync(name,'utf8')});
  await page.locator('#ctCurrentPortfolio').waitFor();await page.locator('#ctFxAttrV16 tbody tr').waitFor();
  assert.match(await page.locator('#ctCurrentPortfolio').innerText(),/검수용 USD 종목/);
  for(const id of ['accounts','risks','humanPositions','portfolio-extra'])assert.equal(await page.locator('#'+id).isVisible(),false);
  assert.match(await page.locator('#ctFxAttrV16').innerText(),/USD 1\/1종목 확인/);
  assert.match(await page.locator('#ctFxAttrV16').innerText(),/\+\$20.00/);
  await page.evaluate(()=>{__JJOONI_CANONICAL_SSOT.accounts.TOSS.holding_price_effect.positions[0].state='MISSING';document.dispatchEvent(new Event('jjooni:live-applied'))});
  await page.getByText('USD 보유종목의 검증된 기준가격을 확인 중입니다.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
  console.log('SCREEN_AUDIT_PASS',width);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
