const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});for(const width of [390,820]){
 const page=await browser.newPage({viewport:{width,height:844}});let requests=0;const d=JSON.parse(fs.readFileSync('market-observatory/data/earnings.json','utf8'));
 d.events.find(e=>e.symbol==='MSFT').facts.push('<img src=x onerror=alert(1)>');
 await page.route('https://earnings.test/**',r=>{if(r.request().url().endsWith('earnings.json')){requests++;return r.fulfill({json:d})}return r.fulfill({contentType:'text/html',body:'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui}.card{padding:14px}.meta{font-size:12px;color:#667}.range{display:flex;gap:6px;flex-wrap:wrap}td,th{padding:6px;text-align:left}</style></head><body><button data-tab="calendar">일정</button><section id="calendar" class="panel on"></section></body></html>'})});
 await page.goto('https://earnings.test/');await page.evaluate(()=>localStorage.setItem('jjooni_private_earnings_symbols_v1',JSON.stringify({as_of:'2026-10-29T07:18:00+09:00',positions:[{symbol:'NVDA',name:'NVIDIA'}]})));
 await page.addScriptTag({content:fs.readFileSync('market-observatory/earnings-v1.js','utf8')});await page.getByText('기업 실적 일정·결과',{exact:true}).waitFor();
 await page.getByRole('button',{name:'발표 완료',exact:true}).click();assert.match(await page.locator('#earningsBoard').innerText(),/92.3/);assert.equal(await page.locator('#earningsBoard img').count(),0);
 await page.getByRole('button',{name:'내 보유 관련',exact:true}).click();assert.match(await page.locator('#earningsBoard').innerText(),/NVIDIA/);assert.equal(await page.locator('#earningsBoard article').count(),1);
 const layout=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=layout.w+1,JSON.stringify(layout));
 await page.getByRole('button',{name:'일정',exact:true}).click();assert.equal(requests,1);await page.screenshot({path:'/tmp/earnings-'+width+'.png'});console.log('EARNINGS_UI_PASS',width);await page.close();}
 await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
