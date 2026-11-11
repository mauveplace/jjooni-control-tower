(function (root) {
'use strict';

const PAIRS = {BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT'};
const BASE = 'https://data-api.binance.vision/api/v3/';
const DAY_MS = 86400000;
const CACHE_PREFIX = 'jjooni:binance-spot:v1:';
const MAX_AGE_MS = 20 * 60 * 1000;
const TIMEOUT_MS = 10 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;
const FAILURE_LABELS = {
  TIMEOUT: '바이낸스 응답 시간 초과',
  NETWORK: '바이낸스 연결 실패',
  HTTP_451: '바이낸스 접속 제한',
  HTTP_429: '바이낸스 요청 한도 초과',
  INVALID_TRADE: '바이낸스 거래 데이터 오류',
  STALE_TRADE: '바이낸스 관측 시각 지연',
};

function observation(key, trade, now) {
  const value = typeof trade?.price === 'boolean' ? NaN : Number(trade?.price);
  const observedMs = trade?.time;
  if (!Object.prototype.hasOwnProperty.call(PAIRS, key) || !Number.isFinite(value) || value <= 0 ||
      !Number.isFinite(observedMs) || observedMs <= 0 || observedMs > now + 60000) {
    throw Error('INVALID_TRADE');
  }
  const observedAt = new Date(observedMs).toISOString();
  return {
    key, value, observed_at: observedAt, session_date: observedAt.slice(0, 10),
    source: 'Binance ' + PAIRS[key], quote_currency: 'USDT',
    market_state: 'CONTINUOUS', refresh_status: 'FETCHED',
  };
}

function parse(key, data, now = Date.now()) {
  const quote = observation(key, Array.isArray(data) && data[0], now);
  if (now - Date.parse(quote.observed_at) > MAX_AGE_MS) throw Error('STALE_TRADE');
  return quote;
}

function priorDay(sessionDate) {
  return Date.parse(sessionDate + 'T00:00:00Z') - DAY_MS;
}

function parseClose(data, start, now = Date.now()) {
  const row = Array.isArray(data) && data.length === 1 && data[0];
  const value = typeof row?.[4] === 'boolean' ? NaN : Number(row?.[4]);
  if (!Array.isArray(row) || row[0] !== start || row[6] !== start + DAY_MS - 1 ||
      row[6] >= now || !Number.isFinite(value) || value <= 0) throw Error('INVALID_CLOSE');
  return value;
}

if (typeof module === 'object' && module.exports) {
  module.exports = {parse, parseClose, PAIRS};
  return;
}

async function fetchJson(path) {
  // AbortController also works in WebViews that lack AbortSignal.timeout().
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const response = await fetch(BASE + path, {
      cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw Error('HTTP_' + response.status);
    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw Error('INVALID_TRADE');
    }
    return data;
  } catch (error) {
    if (timedOut) throw Error('TIMEOUT');
    if (FAILURE_LABELS[error.message] || /^HTTP_\d{3}$/.test(error.message)) throw error;
    throw Error('NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

function readCache(kind, key) {
  try { return JSON.parse(root.localStorage.getItem(CACHE_PREFIX + kind + ':' + key)); }
  catch (_) { return null; }
}

function writeCache(kind, key, data, clockField) {
  try {
    const old = readCache(kind, key);
    if (!old || !Number.isFinite(old[clockField]) || old[clockField] <= data[clockField]) {
      root.localStorage.setItem(CACHE_PREFIX + kind + ':' + key, JSON.stringify(data));
    }
  } catch (_) { /* Storage is optional. */ }
}

const rows = {};
const closes = {};
const failures = {};
const keys = Object.keys(PAIRS);
let pending = null;
let lastAttempt = null;
for (const key of keys) {
  try {
    rows[key] = observation(key, readCache('trade', key), Date.now());
    rows[key].refresh_status = 'RETAINED';
  } catch (_) { /* No usable cached trade. */ }
}

function previousClose(key, sessionDate) {
  const start = priorDay(sessionDate);
  const close = closes[key] || readCache('close', key);
  return Number.isFinite(start) && start + DAY_MS <= Date.now() && close?.start === start &&
    Number.isFinite(close.value) && close.value > 0 ? close.value : null;
}

async function loadPreviousClose(key, sessionDate) {
  if (previousClose(key, sessionDate) !== null) return;
  const start = priorDay(sessionDate);
  if (!Number.isFinite(start) || start + DAY_MS > Date.now()) return;
  const data = await fetchJson(`klines?symbol=${PAIRS[key]}&interval=1d&startTime=${start}&endTime=${start + DAY_MS - 1}&limit=1`);
  const close = {start, value: parseClose(data, start)};
  closes[key] = close;
  writeCache('close', key, close, 'start');
}

function get(key, publishedAt) {
  const row = rows[key];
  const publishedMs = Date.parse(publishedAt);
  if (!row || (publishedMs <= Date.now() + 60000 && publishedMs > Date.parse(row.observed_at))) return null;
  const age = Date.now() - Date.parse(row.observed_at);
  const retained = Boolean(failures[key]) || row.refresh_status === 'RETAINED';
  return {
    ...row,
    refresh_status: retained ? 'RETAINED' : row.refresh_status,
    display_status: retained ? '이전 관측 유지' : age > MAX_AGE_MS ? '관측 지연' : '최근 거래 관측',
    age_label: Math.max(0, Math.floor(age / 60000)) + '분 전',
    failure_label: failureLabel(key),
    previous_close: previousClose(key, row.session_date),
  };
}

function failureLabel(key) {
  const code = failures[key];
  return code ? FAILURE_LABELS[code] || '바이낸스 응답 오류' : '';
}

function displayReason(key, publishedAt) {
  if (state.status === 'CHECKING' || state.status === 'WAITING') return '실시간 조회 중';
  if (failures[key]) return failureLabel(key);
  if (rows[key] && !get(key, publishedAt)) return '게시값 관측 시각이 더 최신';
  return '실시간 시세 미확인';
}

function render() {
  root.__JJOONI_LATEST_BOARD?.renderCrypto?.();
  root.JjooniDailyGlance?.renderCrypto?.();
}

async function refreshSymbol(key) {
  let quote;
  try {
    quote = parse(key, await fetchJson('trades?limit=1&symbol=' + PAIRS[key]));
    const time = Date.parse(quote.observed_at);
    if (rows[key] && time < Date.parse(rows[key].observed_at)) throw Error('STALE_TRADE');
    rows[key] = quote;
    writeCache('trade', key, {price: quote.value, time}, 'time');
    delete failures[key];
  } catch (error) {
    failures[key] = error.message;
    render();
    return false;
  }
  render();
  // Previous close is independent of the current price. One unavailable candle
  // or a slow symbol must never prevent the latest observed trade from rendering.
  try { await loadPreviousClose(key, quote.session_date); } catch (_) { /* Leave return unavailable. */ }
  render();
  return true;
}

function refresh(force = false) {
  if (pending) return pending;
  if (!force && (document.hidden ||
      (lastAttempt !== null && Date.now() - lastAttempt < RETRY_INTERVAL_MS))) {
    return Promise.resolve(state.status);
  }
  lastAttempt = Date.now();
  state.status = 'CHECKING';
  pending = Promise.allSettled(keys.map(refreshSymbol)).then(results => {
    const count = results.filter(result => result.status === 'fulfilled' && result.value).length;
    state.status = count === keys.length ? 'COMPLETE' : count ? 'PARTIAL' : 'FAILED';
    render();
    return state.status;
  }).finally(() => { pending = null; });
  return pending;
}

const state = {status: 'WAITING', get, refresh, displayReason};
root.__JJOONI_CRYPTO_ON_VIEW = state;
function resume() { return refresh().catch(() => {}); }
document.addEventListener('visibilitychange', resume);
root.addEventListener('pageshow', resume);
resume();
})(typeof window === 'object' ? window : globalThis);
