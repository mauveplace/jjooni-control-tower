const test=require('node:test'),assert=require('node:assert/strict');
const {positions,merge,num,needsHistory}=require('../manual-intraday-v1.js');
test('deduplicate symbols across five active accounts',()=>{const ps=positions({accounts:{TOSS:{positions:[{ticker:'005930.KS',qty:2,name:'삼성전자'},{ticker:'AAPL',qty:1}]},ISA:{positions:[{ticker:'005930',qty:3},{ticker:'CASH',qty:1,record_type:'CASH'}]},AI:{positions:[{ticker:'NVDA',qty:1}]}}});assert.equal(ps.length,2);assert.deepEqual(ps[0].accounts,['TOSS','ISA']);});
test('last row replaces unfinished candle by time',()=>{assert.deepEqual(merge([{timestamp:'2026-10-09T01:00:00Z',close:1}],[{timestamp:'2026-10-09T01:00:00Z',close:2}]),[{timestamp:'2026-10-09T01:00:00Z',close:2}])});
test('unknown data is never silently zeroed',()=>{assert.equal(num(null),null);assert.equal(num(''),null);assert.equal(num('NaN'),null);assert.equal(num(0),0)});

test('selection fills missing and partial data but reuses a complete cached session',()=>{assert.equal(needsHistory(null),true);assert.equal(needsHistory({candles:[],status:'NOT_COLLECTED'}),true);assert.equal(needsHistory({candles:[{close:1}],backfill_complete:false}),true);assert.equal(needsHistory({candles:[{close:1}],backfill_complete:true}),false);assert.equal(needsHistory({candles:[],status:'EMPTY_SESSION'}),false)});
