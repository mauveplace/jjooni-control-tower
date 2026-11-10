(function (root) {
'use strict';

const PAIRS = {BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT'};
const BASE = 'https://data-api.binance.vision/api/v3/trades?limit=1&symbol=';
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

function parse(key, data, now = Date.now()) {
  const trade = Array.isArray(data) && data[0];
  const value = Number(trade?.price);
  const observedMs = Number(trade?.time);
  if (!Object.prototype.hasOwnProperty.call(PAIRS, key) || !Number.isFinite(value) || value <= 0 ||
      !Number.isFinite(observedMs) || observedMs <= 0 || observedMs > now + 60000) {
    throw Error('INVALID_TRADE');
  }
  if (now - observedMs > MAX_AGE_MS) throw Error('STALE_TRADE');
  const observedAt = new Date(observedMs).toISOString();
  return {
    key, value, observed_at: observedAt, session_date: observedAt.slice(0, 10),
    source: 'Binance ' + PAIRS[key], quote_currency: 'USDT',
    market_state: 'CONTINUOUS', refresh_status: 'FETCHED',
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = {parse, PAIRS};
  return;
}

async function fetchTrade(key) {
  // AbortController also works in WebViews that lack AbortSignal.timeout().
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const response = await fetch(BASE + PAIRS[key], {
      cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw Error('HTTP_' + response.status);
    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw Error('INVALID_TRADE');
    }
    return parse(key, data);
  } catch (error) {
    if (timedOut) throw Error('TIMEOUT');
    if (FAILURE_LABELS[error.message] || /^HTTP_\d{3}$/.test(error.message)) throw error;
    throw Error('NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

const rows = {};
const failures = {};
const keys = Object.keys(PAIRS);
let pending = null;
let lastAttempt = null;

function get(key, publishedAt) {
  const row = rows[key];
  if (!row || Date.parse(publishedAt) > Date.parse(row.observed_at)) return null;
  const age = Date.now() - Date.parse(row.observed_at);
  const retained = Boolean(failures[key]);
  return {
    ...row,
    refresh_status: retained ? 'RETAINED' : row.refresh_status,
    display_status: retained ? '이전 관측 유지' : age > MAX_AGE_MS ? '관측 지연' : '최근 거래 관측',
    age_label: Math.max(0, Math.floor(age / 60000)) + '분 전',
    failure_label: failureLabel(key),
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

function refresh(force = false) {
  if (pending) return pending;
  if (!force && (document.hidden ||
      (lastAttempt !== null && Date.now() - lastAttempt < RETRY_INTERVAL_MS))) {
    return Promise.resolve(state.status);
  }
  lastAttempt = Date.now();
  state.status = 'CHECKING';
  pending = Promise.allSettled(keys.map(fetchTrade)).then(results => {
    let count = 0;
    results.forEach((result, i) => {
      const key = keys[i];
      if (result.status === 'rejected') {
        failures[key] = result.reason.message;
        return;
      }
      const quote = result.value;
      if (rows[key] && Date.parse(quote.observed_at) < Date.parse(rows[key].observed_at)) {
        failures[key] = 'STALE_TRADE';
        return;
      }
      rows[key] = quote;
      delete failures[key];
      count++;
    });
    state.status = count === keys.length ? 'COMPLETE' : count ? 'PARTIAL' : 'FAILED';
    root.__JJOONI_LATEST_BOARD?.render?.();
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
