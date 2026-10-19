const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 for(const width of [360,390,800,1363]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/market-observatory/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelectorAll('#latestBoardGrid .latestTile[data-metric]').length>30);
  const keys=await page.locator('#latestBoardGrid .latestTile[data-metric]').evaluateAll(es=>es.map(e=>e.dataset.metric));
  assert.equal(keys.length,await page.locator('#latestBoardGrid .latestTile').count(),'Every overview metric tile must link');
  for(const key of keys){
   const tile=page.locator(`#latestBoardGrid [data-metric="${key}"]`).first();
   await tile.click();
   const dialog=page.locator('dialog[open]');assert(await dialog.isVisible(),key+' opens');
   const info=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),c=Chart.getChart(el.querySelector('canvas'));return{left:r.left,right:r.right,bottom:r.bottom,top:r.top,w:innerWidth,h:innerHeight,points:c?.data.datasets[0].data.length||0,axis:c?{min:c.scales.x.min,max:c.scales.x.max,first:c.data.datasets[0].data[0].x,last:c.data.datasets[0].data.at(-1).x}:null,value:el.querySelector('.obsMetricValue').textContent}});
   assert(info.left>=-1&&info.right<=info.w+1&&info.top>=-1&&info.bottom<=info.h+1,`${width} ${key} bounds ${JSON.stringify(info)}`);
   if(info.value!=='관측값 없음')assert(info.points>0,key+' actual points rendered');
   if(info.points>1){assert.equal(info.axis.min,info.axis.first,key+' axis starts at first observation');assert.equal(info.axis.max,info.axis.last,key+' axis ends at last observation')}
   if(key==='US10Y_OFFICIAL')assert.match(info.value,/\d\.\d{3}%$/);
   await dialog.getByRole('button',{name:'그래프 닫기'}).click();
   assert(await page.locator('dialog').evaluate(el=>!el.open));
  }
  await page.locator('#spreadKpis [data-metric="KR_US_10Y"]').click();
  assert.notEqual(await page.locator('dialog .obsMetricValue').textContent(),'관측값 없음','Same-date rate spread history');
  await page.keyboard.press('Escape');
  const tile=page.locator('#latestBoardGrid [data-metric="US10Y_OFFICIAL"]');
  await tile.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);
  await tile.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'1개월',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'1개월',exact:true}).getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  assert(Math.abs(await page.evaluate(()=>scrollY)-y)<2,'Closing restores scroll');
  assert.equal(await tile.evaluate(el=>document.activeElement===el),true,'Closing restores focus');
  await page.locator('[data-metric="TRIPOD_TARGET"]').click();
  await page.getByRole('button',{name:'VIX·VIX10',exact:true}).click();
  assert.match(await page.locator('dialog h2').textContent(),/VIX/);
  await page.keyboard.press('Escape');
  const model=await page.evaluate(()=>{const a=window.__JJOONI_METRIC_DETAIL;return{clean:a.clean([{date:'2026-01-01',value:null},null,{date:'2026-01-02',value:0},{date:'2026-01-02',value:2}]),flat:a.position([{date:'2026-01-01',value:0}]),missing:a.model('not-a-metric'),empty:a.position([])}});
  assert.deepEqual(model.clean,[{date:'2026-01-02',value:2}]);assert.equal(model.flat.ratio,null);assert.equal(model.missing,null);assert.equal(model.empty,null);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(`OBS_METRIC_DETAIL=PASS width=${width} tiles=${keys.length} keyboard/range/scroll/focus/empty`);
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
