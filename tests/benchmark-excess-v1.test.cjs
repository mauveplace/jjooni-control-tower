const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyPosition,computeMixed}=require('../benchmark-excess-v1.js');

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
