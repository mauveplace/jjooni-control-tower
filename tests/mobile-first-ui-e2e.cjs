// Synthetic, offline UI regression. Never reads the private encrypted payload.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=p=>fs.readFileSync(p,'utf8');
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui}.tabs{position:fixed;width:194px;background:#071a33;z-index:9999;height:100vh}.app{width:100%;margin:0;padding:24px}.tabPanel{display:none}.tabPanel.on{display:block}.card{padding:16px;background:white;margin:12px 0}.ctOvAccounts{display:grid;grid-template-columns:repeat(4,1fr)}.ctAcct{padding:12px}.ctOvHero{background:#071a33;color:white}.ctOvHeroCell{padding:12px}button{cursor:pointer}.tabs .tab{color:white}</style></head><body><main class="app"><header class="top"><div class="brand">OVERVIEW</div></header><nav class="tabs">${['overview','portfolio','accounts','tripod','compare','decisions','trades','quality','watchlist','consultant'].map(id=>`<div class="tab ${id==='overview'?'on':''}" data-tab="${id}">${({overview:'Overview',portfolio:'보유분석',accounts:'계좌성과',tripod:'TRI-POD',compare:'성과분석',decisions:'의사결정',trades:'거래내역',quality:'데이터품질',watchlist:'시황/워치',consultant:'시장·섹터'})[id]}</div>`).join('')}<div id="ctSideAI">AI EXPERIMENT NAV</div></nav><section id="panel-overview" class="tabPanel on"><div class="ctOvHero"><div class="ctOvHeroCell ctOvPrimary"><div class="ctOvLabel">오늘 투자손익</div><strong id="overviewNavChange">4</strong></div></div><div id="overviewAccounts" class="ctOvAccounts">${['Toss','ISA','연금저축','IRP'].map(n=>`<article class="ctAcct"><div class="ctAcctHead"><span class="ctAcctName">${n}</span><b class="ctAcctNav">₩1,000</b></div><div class="ctAcctStats"><span>DD</span><b>-17%</b></div><div class="ctAcctSpark">old chart</div></article>`).join('')}</div><div class="card"><h3>오늘 손익 (6계좌 대표 SSOT)</h3>0</div><div class="card ctOvLossCard"></div><div class="card"><h3>Risk Alert</h3><b class="ctRiskTitle">현재 낙폭 -17.2%</b></div><div class="card"><h3>노출 구성 (Look-through)</h3>AI BOT 100%</div></section><section id="panel-portfolio" class="tabPanel"></section><section id="panel-accounts" class="tabPanel"><div class="legacy">old account result</div></section><section id="panel-tripod" class="tabPanel"></section><section id="panel-compare" class="tabPanel"><div class="card"><h3>Human vs AI</h3>AI BOT</div><div class="card">old NAV 9999 / MDD 0%</div></section><section id="panel-decisions" class="tabPanel"><p>표시 가능한 Decision 데이터가 없습니다.</p></section><section id="panel-trades" class="tabPanel"></section><section id="panel-quality" class="tabPanel"><div class="card"><h2>Data Quality</h2>old PB 09/04</div></section><section id="panel-watchlist" class="tabPanel"></section><section id="panel-consultant" class="tabPanel"></section><div class="footer">Human = PB DB SSOT · AI = GCS AI NAV V3 SSOT<br>CURRENT는 최신 운용값<br>현재 전체자산 = Broker Actual NAV</div></main></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true});
for(const width of [360,390,500,768,820,1024,1280,1363]){
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1363,isMobile:width<768});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fixture.test/**',r=>r.fulfill({contentType:r.request().url().includes('.css')?'text/css':'text/html',body:r.request().url().includes('.css')?read('responsive-layout.css'):fixture}));
 await page.goto('https://fixture.test/');
 // The login shell and runtime now share one responsive stylesheet.
 let metrics=read('canonical-metrics.js').split('\n(function(){')[0];await page.addScriptTag({content:metrics});
 await page.evaluate(()=>{const at=new Date().toISOString(),ids=['TOSS','ISA','PENSION','IRP'];const C={observed_at:at,snapshot_id:'synthetic',accounts:Object.fromEntries(ids.map((id,i)=>[id,{nav:1000,today_pnl:i+1,today_return:(i+1)/10,cash_krw:100,net_flow:0,positions:[],source:'FIXTURE',quality:'BROKER_DIRECT'}]))};C.accounts.TOSS.positions=[{ticker:'TQQQ',name:'TQQQ',currency:'USD',qty:2,current_price:73,avg_price:70,fx:1300,market_value_krw:189800,daily_pnl:2600}];C.total={nav:4000,today_pnl:10,account_count:4};window.__JJOONI_CANONICAL_SSOT=C;window.__JJOONI_LIVE_PAYLOAD={generated_kst:at,market_closed:true,stale_after_kst:new Date(Date.now()+86400000).toISOString(),source_health:{pb_history:{state:'REFERENCE',as_of:'2026-09-04T09:12:00+09:00'}}};window.D={human:{trades:[{account:'TOSS',ticker:'TQQQ',name:'TQQQ',side:'BUY',qty:2,price:70,current_price:67,currency:'USD',trade_date:'2026-10-15'},{account:'IRP',ticker:'F002',name:'마이다스 혼합자산 투자신탁',side:'BUY',qty:1,price:360000,current_price:17599696,trade_date:'2026-09-21'},{account:'IRP',ticker:'F002',name:'마이다스 혼합자산 투자신탁',side:'SELL',qty:1,price:400000,trade_date:'2026-09-22'}]}};document.querySelectorAll('.tabs .tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.toggle('on',x===t));document.querySelectorAll('.tabPanel').forEach(p=>p.classList.toggle('on',p.id==='panel-'+t.dataset.tab))}));});
 for(const f of ['ui-refactor.js','toss-account-basis-v43.js','mobile-stability-v4.js','human-ui-v6.js','tablet-accounts-v8.js','trade-review-outcomes-v26.js','overview-consistency-v21.js','account-return-30d-v46.js','tablet-stability-v37.js'])await page.addScriptTag({content:read(f)});
 await page.waitForFunction(()=>document.querySelector('#ctDesktopAccountsV8')&&document.querySelector('#ctResponsiveLayout')?.sheet);await page.waitForTimeout(350);
 // Real producers compare raw markup. Typography must not keep replacing their
 // buttons/labels between refreshes, and first-paint sizes must already be final.
 const heroStability=await page.evaluate(async()=>{
  const strip=document.querySelector('#ctHeroTrustStripV6'),net=document.querySelector('#ctMobileNetSummaryV4');
  const button=strip.querySelector('button'),label=net?.querySelector('.ctNetLabel');
  const first=[getComputedStyle(button).fontSize,label?getComputedStyle(label).fontSize:null];
  let writes=0;const observer=new MutationObserver(ms=>{writes+=ms.length});
  observer.observe(strip,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
  if(net)observer.observe(net,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
  await new Promise(r=>setTimeout(r,900));observer.disconnect();
  return {first,writes,sameButton:button===strip.querySelector('button'),sameLabel:!label||label===net.querySelector('.ctNetLabel')};
 });
 assert.equal(heroStability.first[0],'14px');if(heroStability.first[1])assert.equal(heroStability.first[1],'12px');
 assert.equal(heroStability.writes,0,'live hero producers must settle at '+width+': '+JSON.stringify(heroStability));
 assert(heroStability.sameButton&&heroStability.sameLabel,'hero nodes must survive unchanged refreshes at '+width);
 // Keep the Toss runtime AND typography guard active together: the old
 // unconditionally rewritten note cycled its bold font/line-wrap every 45ms.
 await page.locator('#overviewAccounts .ctTossBasisNoteV43 b').waitFor();
 const stability=await page.locator('#overviewAccounts .ctTossBasisNoteV43').evaluate(async note=>{
  const bold=note.querySelector('b'),top=note.getBoundingClientRect().top;
  let writes=0;const observer=new MutationObserver(ms=>writes+=ms.filter(m=>m.type==='childList'||m.type==='characterData').length);
  observer.observe(note,{subtree:true,childList:true,characterData:true});
  await new Promise(r=>setTimeout(r,1600));observer.disconnect();
  return {writes,sameBold:bold===note.querySelector('b'),topDelta:Math.abs(top-note.getBoundingClientRect().top),font:parseFloat(getComputedStyle(note.querySelector('b')).fontSize)};
 });
 await page.evaluate(()=>{const c=document.querySelector('#overviewAccounts .ctAcct'),d=document.createElement('section');d.className='ctStrategySleeve';d.id='navIsolation';d.innerHTML='<strong>₩90,000,000</strong>';c.append(d)});await page.waitForTimeout(250);assert.equal(await page.locator('#navIsolation strong').innerText(),'₩90,000,000','NAV correction must never rewrite strategy cost or value');await page.locator('#navIsolation').evaluate(e=>e.remove());
 assert.equal(stability.writes,0,'unchanged Toss note must settle with typography: '+JSON.stringify(stability));assert(stability.sameBold);assert(stability.font>=12&&stability.font<=16);
 assert.equal(await page.locator('#ctSideAI').count(),0);assert.equal(await page.locator('.footer').isVisible(),false);assert.match(await page.locator('#overviewAccounts .ctAcctStats').first().innerText(),/\+0.10%/,'30-day runtime cannot rewrite today return');
 const geo=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,app:document.querySelector('.app').getBoundingClientRect().toJSON(),tabs:document.querySelector('.tabs').getBoundingClientRect().toJSON()}));
 assert(geo.scroll<=geo.w+1,JSON.stringify(geo));assert.equal(geo.app.x,0);assert(geo.tabs.y>=0&&geo.tabs.bottom<250,'navigation must be at the top: '+JSON.stringify(geo));
 if(true){assert.equal(await page.locator('.tabs>.tab:visible').count(),4);await page.getByRole('button',{name:'더보기',exact:true}).click();assert(await page.locator('#ctMoreMenu').isVisible());await page.locator('#ctMoreMenu button[data-tab="compare"]').click();assert(!(await page.locator('#ctMoreMenu').isVisible()));}else await page.locator('.tabs [data-tab="compare"]').click();
 await page.waitForTimeout(160);assert.match(await page.locator('.brand').innerText(),/성과분석/);assert.match(await page.locator('#ctCurrentPerformance').innerText(),/₩4,000/);assert(!(await page.locator('#panel-compare').innerText()).includes('9999'));
 await page.locator('.tabs [data-tab="accounts"]').click();await page.waitForTimeout(140);assert(await page.locator('#panel-accounts').isVisible(),'account tap opens accounts');assert(!(await page.locator('#panel-tripod').isVisible()),'account tap must not open tripod');assert.equal(await page.locator('#ctDesktopAccountsV8 .ctA8Card:visible').count(),4);assert.equal(await page.locator('#panel-accounts .legacy').isVisible(),false);await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings summary').first().click();assert.match(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings').first().innerText(),/TQQQ/);assert.match(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings').first().innerText(),/\+4\.29%\s+달러 가격 기준/);const firstSummary=page.locator('#ctDesktopAccountsV8 .ctHoldingDetail').first().locator('summary');const positiveRate=firstSummary.locator('.ctHoldingRate');assert.match(await positiveRate.innerText(),/\+4\.29%/);assert.equal(await positiveRate.evaluate(el=>getComputedStyle(el).color),'rgb(217, 45, 32)');const positions=await firstSummary.evaluate(e=>({name:e.querySelector('.ctHoldingName').getBoundingClientRect().toJSON(),right:e.querySelector('.ctHoldingRight').getBoundingClientRect().toJSON(),rate:e.querySelector('.ctHoldingRate').getBoundingClientRect().toJSON()}));assert(positions.right.x>positions.name.x&&positions.rate.y<positions.name.bottom+36,'return stays to the right of the holding: '+JSON.stringify(positions));assert(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldingRows').first().isVisible());
 await page.evaluate(()=>{const L=window.__JJOONI_LIVE_PAYLOAD,C=window.__JJOONI_CANONICAL_SSOT;window.__periodTestBackup={snapshot_id:L.snapshot_id,performance_day:L.performance_day};const now=Date.now(),start=new Date(now-10000).toISOString(),end=new Date(now+3600000).toISOString(),at=new Date(now-1000).toISOString(),row=(amount)=>({ticker:'TQQQ',state:'CALCULATED',price_effect_krw:amount,baseline_value_krw:1000}),account=amount=>({positions:[row(amount)],known_count:1,position_count:1,known_subtotal_krw:amount});L.snapshot_id=C.snapshot_id;L.performance_day={schema:'CT_US_CLOSE_PERFORMANCE_DAY_V1',snapshot_id:L.snapshot_id,start_kst:start,end_kst:end,as_of_kst:at,price_comparisons:{schema:'CT_HOLDING_PRICE_COMPARISONS_V1',snapshot_id:L.snapshot_id,current:{snapshot_id:L.snapshot_id,start_kst:start,accounts:{TOSS:account(100)}},week:{snapshot_id:L.snapshot_id,accounts:{TOSS:account(-50)}}}};document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(200);
 const periods=page.locator('#ctDesktopAccountsV8 .ctHoldingDetail').first().locator('.ctHoldingPeriod');assert.match(await periods.nth(0).innerText(),/오늘 \+₩100 · \+10\.00%/);assert.match(await periods.nth(1).innerText(),/전주 -₩50 · -5\.00%/);assert.equal(await periods.nth(0).evaluate(el=>getComputedStyle(el).color),'rgb(217, 45, 32)');assert.equal(await periods.nth(1).evaluate(el=>getComputedStyle(el).color),'rgb(23, 92, 211)');assert.match(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings').first().innerText(),/오늘 1\/1종목 · 합계 일치/);
 await page.evaluate(()=>{const C=window.__JJOONI_CANONICAL_SSOT,L=window.__JJOONI_LIVE_PAYLOAD,pc=L.performance_day.price_comparisons;C.accounts.ISA.positions=[{ticker:'005930.KS',name:'삼성전자',currency:'KRW',qty:1,current_price:10000,avg_price:12000,market_value_krw:10000}];for(const key of ['current','week'])pc[key].accounts.ISA={positions:[{ticker:'005930',state:'CALCULATED',price_effect_krw:key==='current'?0:-500,baseline_value_krw:10000}],known_count:1,position_count:1,known_subtotal_krw:key==='current'?0:-500};document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(100);
 const isaHoldings=page.locator('#ctDesktopAccountsV8 .ctA8Card').nth(1).locator('.ctAccountHoldings');await isaHoldings.locator('summary').first().click();assert.match(await isaHoldings.innerText(),/오늘 \+₩0 · \+0\.00%/);assert.match(await isaHoldings.innerText(),/전주 -₩500 · -5\.00%/);assert.doesNotMatch(await isaHoldings.innerText(),/기준가 확인 필요/);assert.match(await isaHoldings.innerText(),/오늘 1\/1종목 · 합계 일치/);assert.equal(await isaHoldings.locator('.ctHoldingPeriod').nth(1).evaluate(e=>getComputedStyle(e).color),'rgb(23, 92, 211)');
 await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.snapshot_id='old';document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(100);assert.equal(await periods.count(),0);assert.match(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings').first().innerText(),/오늘·전주 가격변동 갱신 필요/);
 await page.evaluate(()=>{const L=window.__JJOONI_LIVE_PAYLOAD;window.__JJOONI_CANONICAL_SSOT.snapshot_id=L.snapshot_id;L.snapshot_id=window.__periodTestBackup.snapshot_id;L.performance_day=window.__periodTestBackup.performance_day;document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(100);
 await page.evaluate(()=>{const a=window.__JJOONI_CANONICAL_SSOT.accounts.TOSS;Object.assign(a,{official_pnl_valid:true,official_total_pnl_krw_equiv:-500,official_total_return_pct:-1});document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(220);
 const overviewToss=page.locator('#overviewAccounts .ctAcct').first();assert.match(await overviewToss.innerText(),/전체 보유 평가손익/);assert.match(await overviewToss.innerText(),/-₩500/);assert.match(await overviewToss.innerText(),/-1.00%/);
 await page.evaluate(()=>{const a=window.__JJOONI_CANONICAL_SSOT.accounts.TOSS;Object.assign(a,{official_pnl_valid:true,official_total_pnl_krw_equiv:-500,official_total_return_pct:-1});Object.assign(a.positions[0],{broker_holding_pnl_krw:0,broker_holding_return_pct:0,broker_holding_observed_at:'2026-10-28T11:00:00+09:00'});document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(220);
 assert.match(await page.locator('#ctDesktopAccountsV8 .ctA8Card').first().innerText(),/보유주식 평가손익/);assert.match(await page.locator('#ctDesktopAccountsV8 .ctA8Card').first().innerText(),/-₩500/);
 const holding=page.locator('#ctDesktopAccountsV8 .ctHoldingDetail').first();await holding.locator('summary').click();
 assert.match(await holding.innerText(),/토스 보유내역 기준/);assert.match(await holding.innerText(),/평가손익 \+₩0 · 수익률 \+0.00%/);assert.match(await positiveRate.innerText(),/\+0.00%/);
 await page.evaluate(()=>{const a=window.__JJOONI_CANONICAL_SSOT.accounts.TOSS;a.official_pnl_valid=false;delete a.positions[0].broker_holding_pnl_krw;delete a.positions[0].broker_holding_return_pct;document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(220);assert.doesNotMatch(await page.locator('#ctDesktopAccountsV8 .ctA8Card').first().innerText(),/-₩500/);assert.match(await overviewToss.innerText(),/자료 확인 필요/);assert.match(await positiveRate.innerText(),/\+4.29%/);
 assert.match(await holding.innerText(),/현재가 · 원통화/);assert.match(await holding.innerText(),/평균 매수가 · 원통화/);
 await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.accounts.TOSS.positions[0].current_price=74;document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(250);
 assert(await holding.getAttribute('open')!==null,'live refresh retains the selected holding');
 assert(await page.locator('#ctDesktopAccountsV8 .ctAccountHoldings').first().getAttribute('open')!==null,'live refresh retains the account list');
 assert.match(await holding.innerText(),/74 USD/);assert.match(await holding.innerText(),/산정 대기/,'unknown cumulative cost must not turn into zero');await page.evaluate(()=>{const p=window.__JJOONI_CANONICAL_SSOT.accounts.TOSS.positions[0];p.broker_holding_return_pct=-9.25;p.broker_holding_observed_at=new Date().toISOString();document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(120);assert.match(await positiveRate.innerText(),/-9.25%/);assert.equal(await positiveRate.evaluate(el=>getComputedStyle(el).color),'rgb(23, 92, 211)');assert.match(await holding.locator('summary').innerText(),/토스 보유 기준/);
 await page.evaluate(()=>document.addEventListener('jjooni:open-intraday',e=>window.openedChart=e.detail.symbol,{once:true}));await holding.getByRole('button',{name:'일중 그래프 보기',exact:true}).click();assert.equal(await page.evaluate(()=>window.openedChart),'TQQQ');assert(await page.locator('#panel-accounts').isVisible(),'opening a chart retains the originating account view');
 await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.accounts.TOSS.positions[0].current_price=73;document.dispatchEvent(new Event('jjooni:live-applied'))});

 await page.evaluate(()=>document.querySelector('.tabs [data-tab="trades"]').click());
 const fund=page.locator('[data-v26-ticker="F002"]');assert.equal(await fund.count(),2);assert.match(await fund.first().innerText(),/펀드 기준가·좌수 확인 필요/);assert.equal(await fund.filter({has:page.locator('[data-v26-realized="OK"]')}).count(),0);assert(!(await page.locator('#ctTradeOutcomeV26').innerText()).includes('4788'));
 assert.match(await page.locator('[data-v26-ticker="TQQQ"]').innerText(),/\+\$6/,'canonical price 73 overrides stale trade price 67');
 await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT.accounts.ISA.today_pnl=null;document.dispatchEvent(new Event('jjooni:live-applied'))});await page.waitForTimeout(220);assert.match(await page.locator('#ctCurrentPerformance').innerText(),/3\/4계좌/);assert.match(await page.locator('#ctCurrentPerformance').innerText(),/자료 없음/);assert.doesNotMatch(await page.locator('#ctCurrentPerformance').innerText(),/오늘 투자손익 · 3\/4계좌[+]?₩[0-9]/,'incomplete accounting must not become a fabricated total');
 await page.evaluate(()=>document.querySelector('.tabs [data-tab="quality"]').click());await page.waitForTimeout(160);assert.equal(await page.locator('#ctCurrentQuality article').count(),4);assert(!(await page.locator('#panel-quality').innerText()).includes('old PB'));
 // Check every navigation target, including delayed legacy and detail content.
 for(const id of ['overview','portfolio','accounts','tripod','compare','decisions','trades','quality','watchlist','consultant']){
  await page.evaluate(id=>document.querySelector('.tabs [data-tab="'+id+'"]').click(),id);
  await page.waitForTimeout(320);
  const small=await page.evaluate(()=>Array.from(document.querySelectorAll('.tabPanel.on *')).filter(e=>e.getClientRects().length&&!['STYLE','SCRIPT'].includes(e.tagName)&&Array.from(e.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11.9).map(e=>e.tagName+':'+e.className));
  assert.deepEqual(small,[],id+' has unreadable text at '+width);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+' body overflow at '+width);
 }
 await page.evaluate(()=>{const dialog=document.createElement('section');dialog.id='syntheticDetail';dialog.setAttribute('role','dialog');dialog.innerHTML='<p style="font-size:10px">Late detail text</p><small style="font-size:9px">Metadata</small><strong style="font-size:32px">Large KPI</strong>';document.body.append(dialog)});
 await page.waitForTimeout(320);
 const detailFonts=await page.locator('#syntheticDetail').evaluate(e=>Array.from(e.children).map(n=>parseFloat(getComputedStyle(n).fontSize)));assert(detailFonts[0]>=14);assert(detailFonts[1]>=12);assert.equal(detailFonts[2],32);
 await page.locator('#syntheticDetail').evaluate(e=>e.remove());
 await page.evaluate(()=>document.querySelector('.tabs [data-tab="overview"]').click());await page.waitForTimeout(320);
 assert.equal(await page.locator('#ctCanonicalMovers .ctCommonLine>b').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),20);
 // A profitable day must coexist with a loss since the confirmed deposit.
 await page.evaluate(()=>{const a=window.__JJOONI_CANONICAL_SSOT.accounts;Object.assign(a.ISA,{nav:54422276,principal:60000000,today_pnl:1515800,today_return:2.87,pnl:999999});Object.assign(a.PENSION,{nav:42221980,principal:38517414,today_pnl:820000,today_return:1.98});document.dispatchEvent(new Event('jjooni:live-applied'))});
 await page.waitForTimeout(220);
 for(const [name,day,cumulative,rate,capital] of [['ISA','+₩1,515,800','-₩5,577,724','-9.30%','₩60,000,000'],['연금저축','+₩820,000','+₩3,704,566','+9.62%','₩38,517,414']]){
  const card=page.locator('#overviewAccounts .ctAcct').filter({has:page.locator('.ctAcctName',{hasText:name})}),daily=card.locator('[data-period="daily"]'),cum=card.locator('[data-period="cumulative"]');
  assert((await daily.innerText()).includes(day));assert((await cum.innerText()).includes(cumulative));assert((await cum.innerText()).includes(rate));assert((await card.locator('.ctAccountCapitalRow').innerText()).includes(capital));
  for(const label of [daily.locator('.ctAccountPeriodLabel'),cum.locator('.ctAccountPeriodLabel')])assert(await label.isVisible(),'period labels must stay visible');
  assert.equal(await daily.locator('.ctAccountPeriodAmount').evaluate(e=>getComputedStyle(e).color),'rgb(180, 35, 24)');
  if(name==='ISA')assert.equal(await cum.locator('.ctAccountPeriodAmount').evaluate(e=>getComputedStyle(e).color),'rgb(23, 92, 211)');
 }
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'period rows overflow at '+width);
 await page.addScriptTag({content:read('performance-day-view.js')});
 await page.evaluate(()=>{
  const L=window.__JJOONI_LIVE_PAYLOAD,C=window.__JJOONI_CANONICAL_SSOT,ids=['TOSS','ISA','PENSION','IRP'];
  const at=new Date(),start=new Date(at.getTime()-3600000).toISOString(),end=new Date(at.getTime()+3600000).toISOString();
  L.snapshot_id=C.snapshot_id='close-day-fixture';L.accounts=C.accounts;
  L.performance_day={schema:'CT_US_CLOSE_PERFORMANCE_DAY_V1',snapshot_id:L.snapshot_id,date:'2026-10-22',previous_date:'2026-10-21',start_kst:start,end_kst:end,previous_start_kst:new Date(at.getTime()-90000000).toISOString(),as_of_kst:at.toISOString(),current:{accounts:Object.fromEntries(ids.map(id=>[id,{state:'PENDING',pnl_krw:null,reasons:['CLOSING_NAV_BASELINE_MISSING']}]))},previous:{accounts:Object.fromEntries(ids.map(id=>[id,{state:'PENDING',pnl_krw:null}]))}};
  ids.forEach(id=>{C.accounts[id].broker_daily_reference={today_pnl:12345};C.accounts[id].today_pnl=null;C.accounts[id].today_return=null});
  document.dispatchEvent(new Event('jjooni:live-applied'));
 });
 await page.waitForTimeout(250);
 const closeDay=page.locator('#ctCanonicalDailySummary .ctPerformanceDay');
 assert.match(await closeDay.innerText(),/오늘 진행 손익/);assert.match(await closeDay.innerText(),/전일 손익/);
 assert.equal(await closeDay.locator('.ctPerformanceDayMetric').count(),2);
 assert.match(await closeDay.locator('.ctPerformanceDayMetric').first().innerText(),/산정 대기/);
 await closeDay.locator('summary').click();assert.equal(await closeDay.locator('.ctPerformanceDayAccounts article:visible').count(),4);
 assert.match(await closeDay.locator('.ctPerformanceDayReference').first().innerText(),/12,345/);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'close day overflows at '+width);
 await page.evaluate(()=>{const L=window.__JJOONI_LIVE_PAYLOAD,C=window.__JJOONI_CANONICAL_SSOT,e={state:'PARTIAL',known_count:1,position_count:2,known_subtotal_krw:260000,return_pct:2,positions:[{ticker:'TQQQ',name:'TQQQ',qty:100,currency:'USD',baseline_price:100,current_price:102,baseline_session_date:'2026-10-21',price_effect_krw:260000}]};L.performance_day.price_effect={schema:'CT_CURRENT_HOLDINGS_PRICE_EFFECT_V1',snapshot_id:L.snapshot_id,start_kst:L.performance_day.start_kst,...e,accounts:{TOSS:e}};C.performance_day=L.performance_day;C.accounts.TOSS.holding_price_effect=e;document.dispatchEvent(new Event('jjooni:live-applied'))});
 await page.waitForTimeout(250);
 assert.match(await page.locator('#ctDesktopAccountsV8 .ctA8Card').first().innerText(),/보유 가격변동/);assert.match(await page.locator('#ctDesktopAccountsV8 .ctA8Card').first().innerText(),/260,000/);
 assert.match(await closeDay.locator('.ctPerformanceDayMetric').first().innerText(),/보유종목 가격변동/);assert.match(await closeDay.locator('.ctPerformanceDayMetric').first().innerText(),/260,000/);assert.match(await closeDay.innerText(),/1\/2종목/);
 const priceDetails=closeDay.locator('[data-price-account="TOSS"]');await priceDetails.locator('summary').click();assert.match(await priceDetails.innerText(),/2026-10-21/);assert.match(await priceDetails.innerText(),/100 → 102/);
 await page.evaluate(()=>document.dispatchEvent(new Event('jjooni:live-applied')));await page.waitForTimeout(250);assert(await priceDetails.getAttribute('open')!==null);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'price evidence overflow at '+width);
 // Exercise first paint and repeated producer writes in the actual overview.
 // The old 80ms floor changed markup; innerHTML-based writers then recreated it.
 const overviewStability=await page.evaluate(async()=>{
  const host=document.createElement('section');host.id='overviewTypographyProbe';
  document.querySelector('#panel-overview').append(host);
  const samples=new Set();let replacements=0,styleWrites=0;
  const observer=new MutationObserver(ms=>{styleWrites+=ms.filter(m=>m.type==='attributes'&&m.attributeName==='style').length});
  observer.observe(host,{subtree:true,attributes:true});
  for(let revision=0;revision<3;revision++){
   const html='<div class="ctOvLabel">갱신 '+revision+'</div><div class="ctStrategySleeve"><div class="ctSleeveAmounts"><span>보유 원가 '+revision+'</span></div></div><div class="ctAcctComparisonRow"><span>전일 손익</span><strong>+₩1,000</strong><b>+1.00%</b></div>';
   for(let frame=0;frame<14;frame++){
    if(host.innerHTML!==html){host.innerHTML=html;replacements++}
    samples.add(JSON.stringify([...host.querySelectorAll('.ctOvLabel,.ctSleeveAmounts span,.ctAcctComparisonRow strong')].map(e=>[getComputedStyle(e).fontSize,getComputedStyle(e).lineHeight])));
    await new Promise(requestAnimationFrame);
   }
  }
  observer.disconnect();host.remove();return {samples:[...samples],replacements,styleWrites};
 });
 assert.deepEqual(overviewStability.samples,[JSON.stringify([['14px','21px'],['14px','21px'],['14px','21px']])],'first-paint and live typography at '+width+': '+JSON.stringify(overviewStability));
 assert.equal(overviewStability.replacements,3,'unchanged producer markup must settle at '+width);
 assert.equal(overviewStability.styleWrites,0,'typography must not mutate overview markup at '+width);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).webkitTextSizeAdjust),'100%','mobile text autosizing is stable without disabling page zoom');
 // Newly inserted migrated rows must be readable before the delayed font floor.
 const rowFonts=()=>page.locator('#typographyStabilityProbe').evaluate(e=>Array.from(e.children).map(n=>parseFloat(getComputedStyle(n).fontSize)));
 await page.evaluate(()=>{const row=document.createElement('div');row.id='typographyStabilityProbe';row.className='ctCommonLine';row.innerHTML='<span>새 종목</span><small>기준시각</small><b>123,456</b>';document.querySelector('.app').append(row)});
 assert.deepEqual(await rowFonts(),[16,14,20],'readable on first render at '+width);
 await page.waitForTimeout(160);
 assert.deepEqual(await rowFonts(),[16,14,20],'no delayed font jump at '+width);
 await page.locator('#typographyStabilityProbe').evaluate(e=>{e.innerHTML='<span>갱신된 종목</span><small>새 기준시각</small><b>987,654</b>'});
 assert.deepEqual(await rowFonts(),[16,14,20],'replacement nodes keep typography at '+width);
 await page.locator('#typographyStabilityProbe').evaluate(e=>e.remove());
 await page.screenshot({path:'/tmp/ct-ui-'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS mobile-first width='+width+' canonical=4000 missing=unknown fund=excluded nav=usable');await context.close();
}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});


