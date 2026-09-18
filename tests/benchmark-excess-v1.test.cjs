const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyPosition,computeMixed,computePortfolioReturnFromAccounts}=require('../benchmark-excess-v1.js');

test('mixed benchmark uses exposure weights and returns excess',()=>{
 const r=computeMixed({portfolio_return:2,kospi_return:2.66,ndx_return:1.73,kr_value:60,us_value:40});
 assert.ok(r);
 assert.equal(Number(r.kr_weight.toFixed(2)),0.60);
 assert.equal(Number(r.us_weight.toFixed(2)),0.40);
 assert.equal(Number(r.benchmark_return.toFixed(3)),2.288);
 assert.equal(Number(r.excess_return.toFixed(3)),-0.288);
});

test('US/global underlying KR-listed ETF is mapped to NDX proxy bucket',()=>{
 assert.equal(classifyPosition({currency:'KRW',market:'KR',name:'ACE 글로벌반도체TOP4 Plus'}),'US');
 assert.equal(classifyPosition({currency:'KRW',market:'KR',name:'RISE 미국S&P500'}),'US');
 assert.equal(classifyPosition({currency:'KRW',market:'KR',name:'KODEX 200'}),'KR');
});

test('USD and US market securities are US bucket',()=>{
 assert.equal(classifyPosition({currency:'USD',market:'US',ticker:'NVDA'}),'US');
});

test('missing benchmark input fails closed',()=>{
 assert.equal(computeMixed({portfolio_return:1,kospi_return:2,ndx_return:null,kr_value:50,us_value:50}),null);
});


test('six-account portfolio return derives from account today-return contracts when previous_nav is absent',()=>{
 const accounts={
  TOSS:{nav:74197059.9611795,today_pnl:756983.1293,today_return:1.16},
  ISA:{nav:61822307.6168,today_pnl:592925,today_return:0.968366778595142},
  PENSION:{nav:49061002,today_pnl:737205,today_return:1.5255527209503013},
  IRP:{nav:90038074.7309,today_pnl:729015,today_return:0.8162833672156202},
  AI:{nav:1522637,today_pnl:21401.5515,today_return:1.4255959330952443},
  TRIPOD:{nav:1333290.402048,today_pnl:1663.839936,today_return:0.1249479383590213}
 };
 const r=computePortfolioReturnFromAccounts(accounts);
 assert.ok(r);
 assert.equal(r.used,6);
 assert.equal(Number(r.pnl_sum.toFixed(2)),2839193.52);
 assert.equal(Number(r.return_pct.toFixed(3)),1.064);
});
