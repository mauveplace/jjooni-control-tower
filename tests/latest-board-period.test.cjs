const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function board(series) {
  const src = fs.readFileSync(path.join(__dirname, '../market-observatory/latest-board-v1.js'), 'utf8');
  const context = {
    DATA: {series}, window: {}, document: {createElement: () => ({}), head: {appendChild() {}}},
    setInterval() {}, clearInterval() {}, console,
  };
  vm.createContext(context);
  vm.runInContext(src.replace('let tries=0;', 'window.testPeriod={stat,standardTile,BY_KEY,setCompare:key=>compareKey=key};let tries=0;'), context);
  return context.window.testPeriod;
}

test('Russell daily gain and weekly loss retain separate signs and bases', () => {
  const api = board({RUSSELL2000: [
    {date: '2026-10-02', value: 2832.89990234},
    {date: '2026-10-08', value: 2794.12988281},
    {date: '2026-10-09', value: 2806.97998047},
  ]});
  const item = api.BY_KEY.RUSSELL2000;
  assert.equal(api.stat(item, 'D1').change.toFixed(2), '0.46');
  assert.equal(api.stat(item, 'W1').change.toFixed(2), '-0.91');
  assert.equal(api.stat(item, 'W1').refDate, '2026-10-02');
  const html = api.standardTile(item);
  assert.match(html, /일간 \+0\.46%/);
  assert.match(html, /주간 -0\.91%/);
  assert.match(html, /2026-10-08 → 2026-10-09/);
});

test('holiday comparison uses latest close on or before weekly target', () => {
  const api = board({SP500: [
    {date: '2026-10-01', value: 100},
    {date: '2026-10-06', value: 104},
    {date: '2026-10-08', value: 105},
  ]});
  assert.equal(api.stat(api.BY_KEY.SP500, 'W1').refDate, '2026-10-01');
  assert.equal(api.stat(api.BY_KEY.SP500, 'W1').change.toFixed(2), '5.00');
});

test('missing weekly reference remains unavailable instead of using daily gain', () => {
  const api = board({RUSSELL2000: [
    {date: '2026-10-08', value: 100}, {date: '2026-10-09', value: 101},
  ]});
  assert.equal(api.stat(api.BY_KEY.RUSSELL2000, 'W1').change, null);
  assert.match(api.standardTile(api.BY_KEY.RUSSELL2000), /주간 —/);
});

test('rate, spread, FX, commodity and sentiment cards show daily and weekly units together', () => {
  const dates=['2026-10-13','2026-10-19','2026-10-20'];
  const rows=values=>values.map((value,i)=>({date:dates[i],value}));
  const api=board({US10Y:rows([4.90,5.10,5.117]),US_2S10S:rows([.2,.3,.33]),
    USDKRW:rows([1300,1320,1327]),WTI:rows([100,102,101]),FEAR_GREED:rows([40,45,47])});
  for(const [key,daily,weekly] of [
    ['US10Y_OFFICIAL','일간 +1.7bp','주간 +21.7bp'],
    ['US_2S10S','일간 +3.0bp','주간 +13.0bp'],
    ['USDKRW','일간 +0.53%','주간 +2.08%'],
    ['WTI','일간 -0.98%','주간 +1.00%'],
    ['FEAR_GREED','일간 +2.0pt','주간 +7.0pt']]){
      const html=api.standardTile(api.BY_KEY[key]);
      assert(html.includes(daily),html);assert(html.includes(weekly),html);
      assert(html.includes('2026-10-13 → 2026-10-20'),html);
  }
});

test('missing observations are excluded rather than converted into zero changes',()=>{
  const api=board({KR10Y:[{date:'2026-10-13',value:null},{date:'2026-10-19',value:4},{date:'2026-10-20',value:null}]});
  const html=api.standardTile(api.BY_KEY.KR10Y);
  assert.match(html,/일간 —/);assert.match(html,/주간 —/);
  assert.doesNotMatch(html,/-400\.0bp/);
});

test('daily and weekly each appear once while longer selected comparisons remain available',()=>{
 const api=board({WTI:[{date:'2026-09-01',value:80},{date:'2026-10-13',value:100},{date:'2026-10-19',value:102},{date:'2026-10-20',value:101}]});
 for(const comparison of ['D1','W1','M1','Y1']){
  api.setCompare(comparison);
  const html=api.standardTile(api.BY_KEY.WTI),text=html.replace(/<[^>]*>/g,'');
  assert.equal((text.match(/일간/g)||[]).length,1,text);
  assert.equal((text.match(/주간/g)||[]).length,1,text);
  assert(text.includes('일간 -0.98%'));assert(text.includes('주간 +1.00%'));
  if(comparison==='M1')assert(text.includes('전월 ▲ 26.25%'));
  if(comparison==='Y1')assert.match(text,/전년 대비 —/);
 }
});
