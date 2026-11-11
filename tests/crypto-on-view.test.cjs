const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {parse, parseClose} = require('../market-observatory/crypto-on-view-v1.js');
const source = fs.readFileSync('market-observatory/crypto-on-view-v1.js', 'utf8');

test('Binance trade retains USDT and rejects invalid or stale data', () => {
  const now = Date.now();
  const quote = parse('BTCUSD', [{price: '90000.25', time: now - 5000}], now);
  assert.equal(quote.value, 90000.25);
  assert.equal(quote.quote_currency, 'USDT');
  assert.equal(Date.parse(quote.observed_at), now - 5000);
  assert.match(quote.source, /BTCUSDT/);
  assert.throws(() => parse('BTCUSD', [{price: '0', time: now}], now), /INVALID_TRADE/);
  assert.throws(() => parse('BTCUSD', [{price: '1', time: now - 1200001}], now), /STALE_TRADE/);
  assert.throws(() => parse('ETHUSD', [{price: '1', time: now + 60001}], now), /INVALID_TRADE/);
  assert.throws(() => parse('toString', [{price: '1', time: now}], now), /INVALID_TRADE/);
});

function browser(fetch, schedule = setTimeout, storage = new Map(), initial = '2026-11-10T23:59:00Z') {
  let clock = Date.parse(initial);
  const handlers = {};
  const document = {hidden: true, addEventListener: (event, handler) => { handlers[event] = handler; }};
  class Clock extends Date { static now() { return clock; } }
  // A legacy WebView has AbortController but no AbortSignal.timeout().
  const context = vm.createContext({
    document, Date: Clock, AbortController, AbortSignal: {},
    setTimeout: schedule, clearTimeout,
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    fetch: (url, options) => fetch(url, options, clock),
  });
  context.window = context;
  context.addEventListener = document.addEventListener;
  vm.runInContext(source, context);
  return {quote: context.__JJOONI_CRYPTO_ON_VIEW, handlers, document, advance: ms => { clock += ms; }};
}

const ok = (now, price = '123') => ({ok: true, json: async () => [{price, time: now - 1000}]});
const http = status => ({ok: false, status});
const candle = (url, price = '100') => {
  const start = Number(new URL(url).searchParams.get('startTime'));
  return {ok: true, json: async () => [[start, '99', '101', '98', price, '1', start + 86400000 - 1]]};
};

test('only a completed candle for the exact prior UTC date can supply the close', () => {
  const start = Date.parse('2026-11-09T00:00:00Z');
  const row = [start, '99', '101', '98', '100', '1', start + 86400000 - 1];
  assert.equal(parseClose([row], start, start + 86400000), 100);
  assert.throws(() => parseClose([row], start + 86400000), /INVALID_CLOSE/);
  assert.throws(() => parseClose([row], start, row[6]), /INVALID_CLOSE/);
  assert.throws(() => parseClose([row, row], start), /INVALID_CLOSE/);
});


test('visibility and pageshow coalesce requests and preserve per-symbol fallbacks', async () => {
  let requests = 0;
  let failEth = false;
  const {quote, handlers, document, advance} = browser(async (url, _, now) => {
    requests++;
    if (url.includes('/klines?')) return candle(url);
    return failEth && url.includes('ETHUSDT') ? http(451) : ok(now);
  });
  assert.equal(requests, 0);
  document.hidden = false;
  await Promise.all([handlers.visibilitychange(), handlers.pageshow()]);
  assert.equal(requests, 4);
  assert.equal(quote.status, 'COMPLETE');
  assert.equal(quote.get('BTCUSD').previous_close, 100);
  const later = '2026-11-11T00:00:00Z';
  assert.equal(quote.get('BTCUSD', later), null);
  assert.match(quote.displayReason('BTCUSD', later), /게시값.*최신/);
  await handlers.pageshow();
  assert.equal(requests, 4);
  advance(21 * 60000);
  failEth = true;
  await handlers.pageshow();
  assert.equal(quote.status, 'PARTIAL');
  assert.equal(quote.get('ETHUSD').refresh_status, 'RETAINED');
  assert.equal(quote.get('ETHUSD').session_date, '2026-11-10');
  assert.match(quote.get('ETHUSD').age_label, /21분/);
  assert.match(quote.get('ETHUSD').failure_label, /접속 제한/);
  assert.equal(quote.get('BTCUSD').session_date, '2026-11-11');
});

test('timeout aborts fetch, invalid responses stay unavailable, and a manual retry recovers', async () => {
  let recover = false;
  let aborts = 0;
  const {quote} = browser((url, {signal}, now) => {
    if (url.includes('/klines?')) return Promise.resolve(candle(url));
    if (recover) return Promise.resolve(ok(now));
    if (url.includes('ETHUSDT')) return Promise.resolve(ok(now - 1200001));
    return new Promise((_, reject) => signal.addEventListener('abort', () => {
      aborts++;
      reject(Error('aborted'));
    }));
  }, (fn, ms) => { assert.equal(ms, 10000); return setTimeout(fn, 0); });
  await quote.refresh(true);
  assert.equal(aborts, 1);
  assert.equal(quote.status, 'FAILED');
  assert.equal(quote.get('BTCUSD'), null);
  assert.match(quote.displayReason('BTCUSD'), /시간 초과/);
  assert.match(quote.displayReason('ETHUSD'), /시각 지연/);
  recover = true;
  await quote.refresh(true);
  assert.equal(quote.status, 'COMPLETE');
  assert.equal(quote.get('BTCUSD').failure_label, '');
});

test('reload retains the last observed price and its exact UTC close when offline', async () => {
  const storage = new Map();
  const initial = browser(async (url, _, now) => url.includes('/klines?') ? candle(url) : ok(now), setTimeout, storage);
  await initial.quote.refresh(true);
  const old = initial.quote.get('BTCUSD');
  const reloaded = browser(async () => http(451), setTimeout, storage, '2026-11-11T02:00:00Z');
  await reloaded.quote.refresh(true);
  const retained = reloaded.quote.get('BTCUSD');
  assert.equal(retained.value, old.value);
  assert.equal(retained.observed_at, old.observed_at);
  assert.equal(retained.previous_close, 100);
  assert.equal(retained.refresh_status, 'RETAINED');
  assert.match(retained.failure_label, /접속 제한/);
});

test('new-day trade shows even if the newly required UTC close is unavailable', async () => {
  const storage = new Map();
  const initial = browser(async (url, _, now) => url.includes('/klines?') ? candle(url) : ok(now), setTimeout, storage);
  await initial.quote.refresh(true);
  const later = browser(async (url, _, now) => url.includes('/klines?') ? http(503) : ok(now, '456'),
    setTimeout, storage, '2026-11-11T00:01:00Z');
  await later.quote.refresh(true);
  const btc = later.quote.get('BTCUSD');
  assert.equal(btc.value, 456);
  assert.equal(btc.session_date, '2026-11-11');
  assert.equal(btc.previous_close, null);
  assert.equal(later.quote.status, 'COMPLETE');
});
