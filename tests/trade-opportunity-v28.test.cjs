const test=require('node:test');
const assert=require('node:assert/strict');
const {calcOpportunity}=require('../trade-opportunity-v28.js');

test('LG전자 09/08+09/07 매도는 현재가 207000 기준 +114000원 회피손실',()=>{
  const trades=[
    {side:'SELL',qty:11,price:211000,filled_at_kst:'2026-09-08T10:00:00+09:00',currency:'KRW'},
    {side:'SELL',qty:10,price:214000,filled_at_kst:'2026-09-07T10:00:00+09:00',currency:'KRW'}
  ];
  const r=calcOpportunity(trades,207000);
  assert.equal(r.count,2);
  assert.equal(r.money,114000);
  assert.ok(r.pct<0);
});

test('체결행 current_price가 없어도 계좌/종목 현재가 fallback으로 계산한다',()=>{
  const r=calcOpportunity([{side:'SELL',qty:11,price:211000,currency:'KRW'}],207000);
  assert.equal(r.money,44000);
});

test('체결행 current_price가 있으면 해당 값을 우선한다',()=>{
  const r=calcOpportunity([{side:'SELL',qty:10,price:214000,current_price:208000,currency:'KRW'}],207000);
  assert.equal(r.money,60000);
});
