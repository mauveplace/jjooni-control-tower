const {test}=require('node:test');const assert=require('node:assert/strict');const {parse}=require('../market-observatory/crypto-on-view-v1.js');
test('Binance last trade is USDT and carries exchange timestamp',()=>{const now=Date.now(),q=parse('BTCUSD',[{price:'90000.25',time:now-5000}],now);assert.equal(q.value,90000.25);assert.equal(q.quote_currency,'USDT');assert.equal(Date.parse(q.observed_at),now-5000);assert.match(q.source,/BTCUSDT/)});
test('invalid, old, future and wrong-symbol observations are rejected',()=>{const now=Date.now();for(const [key,row] of [['BTCUSD',{price:'0',time:now}],['BTCUSD',{price:'1',time:now-1200001}],['ETHUSD',{price:'1',time:now+60001}],['OTHER',{price:'1',time:now}],['BTCUSD',{}]])assert.throws(()=>parse(key,[row],now));});
test('on-view requests coalesce, retain failed symbols, and honor published timestamps',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');let now=Date.now(),requests=0,failEth=false;const events={};
 class Clock extends Date{static now(){return now}}
 const document={hidden:true,addEventListener:(n,f)=>events[n]=f};const context=vm.createContext({document,Date:Clock,AbortSignal,Promise,Error,fetch:async url=>{requests++;if(failEth&&url.includes('ETHUSDT'))throw Error('offline');return {ok:true,json:async()=>[{price:'123',time:now-1000}]}}});
 context.window=context;context.addEventListener=(n,f)=>events[n]=f;context.__JJOONI_LATEST_BOARD={render(){}};vm.runInContext(fs.readFileSync('market-observatory/crypto-on-view-v1.js','utf8'),context);
 const q=context.__JJOONI_CRYPTO_ON_VIEW;assert.equal(requests,0);document.hidden=false;
 await Promise.all([q.refresh(true),q.refresh(true)]);assert.equal(requests,2);assert.equal(q.status,'COMPLETE');assert.equal(q.get('BTCUSD').quote_currency,'USDT');assert.equal(q.get('BTCUSD',new Date(now).toISOString()),null);
 await q.refresh(false);assert.equal(requests,2);now+=60000;failEth=true;await q.refresh(false);assert.equal(requests,4);assert.equal(q.status,'PARTIAL');assert.equal(q.get('ETHUSD').refresh_status,'RETAINED');assert.equal(q.get('BTCUSD').refresh_status,'FETCHED');
});
