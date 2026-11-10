const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT=path.resolve(__dirname,'..');
const board=fs.readFileSync(path.join(ROOT,'market-observatory/latest-board-v1.js'),'utf8');

function compileStat(data) {
  const statSource=board.match(/function stat\(item,key=compareKey\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(statSource,'latest board stat() contract present');
  const create=new Function('DATA',`const compareKey='D1';
    const window={};
    const seriesOf=item=>DATA.series[item.k]||[];
    const cryptoItem=item=>['BTCUSD','ETHUSD'].includes(item.k);
    const utcDate=s=>new Date(String(s).slice(0,10)+'T00:00:00Z');
    const refPoint=(series,last,key)=>series.at(-2)||null;
    ${statSource}
    return stat;
  `);
  return create(data);
}
test('Binance BTC/ETH D1 uses separate native USDT close, not USD historical bar',()=>{
  const data={
    series:{BTCUSD:[
      {date:'2026-11-09',value:74500,session_status:'COMPLETED',quote_currency:'USD'},
      {date:'2026-11-10',value:75000,session_status:'IN_PROGRESS',quote_currency:'USDT'}
    ]},
    crypto_market:{BTCUSD:{
      price:75000,status:'LIVE',quote_currency:'USDT',
      daily_change_safe:true,previous_close_value:74800,
      previous_close_currency:'USDT',previous_close_utc_date:'2026-11-09'
    }}
  };
  const calc=compileStat(data);
  const d1=calc({k:'BTCUSD',kind:'pct'},'D1');
  assert.ok(Math.abs(d1.change-(75000/74800-1)*100)<0.001);
  assert.equal(d1.refValue,74800);
  assert.equal(d1.quote_currency,'USDT');
  assert.equal(calc({k:'BTCUSD',kind:'pct'},'W1').change,null);
  assert.equal(calc({k:'BTCUSD',kind:'pct'},'M1').change,null);
  assert.match(board,/W1\/M1/);
});
test('cross currency, stale or missing native close suppress all crypto changes',()=>{
  const data={
    series:{BTCUSD:[
      {date:'2026-11-09',value:74800,session_status:'COMPLETED',quote_currency:'USD'},
      {date:'2026-11-10',value:75000,session_status:'IN_PROGRESS',quote_currency:'USDT'}
    ]},
    crypto_market:{BTCUSD:{
      status:'LIVE',price:75000,quote_currency:'USDT',
      daily_change_safe:false,previous_close_value:74800,
      previous_close_currency:'USD',previous_close_utc_date:'2026-11-09'
    }}
  };
  const calc=compileStat(data);
  assert.equal(calc({k:'BTCUSD',kind:'pct'},'D1').change,null);
  data.crypto_market.BTCUSD.daily_change_safe=true;
  assert.equal(calc({k:'BTCUSD',kind:'pct'},'D1').change,null);
  data.crypto_market.BTCUSD.previous_close_currency='USDT';
  data.crypto_market.BTCUSD.previous_close_utc_date='2026-11-08';
  assert.equal(calc({k:'BTCUSD',kind:'pct'},'D1').change,null);
});
test('historical USD chart and analysis lab remain separate from USDT observations',()=>{
  const lab=fs.readFileSync(path.join(ROOT,'market-observatory/analysis-lab-v1.js'),'utf8');
  assert.match(board,/p\.quote_currency!=='USD'/);
  assert.match(lab,/r\.quote_currency==='USD'/);
  const glance=fs.readFileSync(path.join(ROOT,'market-observatory/daily-glance-v1.js'),'utf8');
  assert.match(glance,/CURRENCY_BASIS_UNAVAILABLE/);
});
