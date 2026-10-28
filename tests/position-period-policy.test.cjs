const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function metrics(){const root={};vm.runInNewContext(fs.readFileSync('canonical-metrics.js','utf8'),{window:root,console});return root.JjooniMetrics}
test('shared period effect wins over broker-day value',()=>{const M=metrics(),p={ticker:'005930.KS',daily_pnl:999};assert.equal(M.positionDay(p,{holding_price_effect:{positions:[{ticker:'005930',price_effect_krw:0}]}}),0)});
test('missing period row never falls back to yesterday broker pnl',()=>{const M=metrics();assert.equal(M.positionDay({ticker:'TQQQ',daily_pnl:999},{holding_price_effect:{positions:[]}}),null);assert.equal(M.positionDay({daily_pnl:999},{today_pnl_scope:'CT_US_CLOSE_PERFORMANCE_DAY_V1'}),null)});
