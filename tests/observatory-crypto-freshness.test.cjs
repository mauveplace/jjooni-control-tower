'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sources = [
  'market-observatory/freshness-watchdog-v1.js',
  'market-observatory/freshness-all-groups-v1.js',
];
const now = Date.now();
const isoAgo = minutes => new Date(now - minutes * 60_000).toISOString();
const quotes = (btc, eth, status='LIVE') => ({
  quotes: {
    BTCUSD: {status, quote_as_of_kst: isoAgo(btc)},
    ETHUSD: {status: 'LIVE', quote_as_of_kst: isoAgo(eth)},
  },
  max_age_seconds: 3600,
});

const {effective}=require('../market-observatory/freshness-core-v1.js');
for(const file of sources){
 const code=fs.readFileSync(path.join(root,file),'utf8');
 assert(!code.includes("key!=='crypto'"),file+' must not duplicate the evaluator');
}
assert.equal(effective('crypto',quotes(30,45),now).state,'LIVE');
assert.equal(effective('crypto',quotes(61,10),now).state,'STALE');
assert.equal(effective('crypto',quotes(10,61),now).state,'STALE');
assert.equal(effective('crypto',quotes(5,5,'UNAVAILABLE'),now).state,'STALE');
assert.equal(effective('crypto',{quotes:{}},now).state,'UNAVAILABLE');
assert.equal(effective('market',{state:'LIVE'},now).state,'LIVE');
assert.match(effective('crypto',quotes(10,20),now).detail,/BTCUSD.*ETHUSD/);
console.log('PASS shared viewer-time quote freshness and consumer delegation');
