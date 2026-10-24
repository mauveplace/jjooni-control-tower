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

for (const file of sources) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  // The UI scripts are browser IIFEs. Extract the deterministic pure
  // freshness function without executing or mocking the entire DOM.
  const match = code.match(/(?:const effective=\(key,raw\)=>|function effective\(key,raw\))\s*\{([\s\S]*?)\n\s*\};?\n(?:const tile|function analysis)/);
  assert.ok(match, file+' should implement viewer-time quote freshness');
  const effective = new Function('key', 'raw', match[1]);
  assert.equal(effective('crypto', quotes(30, 45)).state, 'LIVE', file);
  assert.equal(effective('crypto', quotes(61, 10)).state, 'STALE', file);
  assert.equal(effective('crypto', quotes(10, 61)).state, 'STALE', file);
  assert.equal(effective('crypto', quotes(5, 5, 'UNAVAILABLE')).state, 'STALE', file);
  assert.equal(effective('crypto', {quotes:{}, max_age_seconds:3600}).state, 'UNAVAILABLE', file);
  assert.equal(effective('market', {state:'LIVE'}).state, 'LIVE', file);
  const d = effective('crypto', quotes(10, 20));
  assert.match(d.detail, /BTCUSD/);
  assert.match(d.detail, /ETHUSD/);
  console.log('PASS '+file);
}
