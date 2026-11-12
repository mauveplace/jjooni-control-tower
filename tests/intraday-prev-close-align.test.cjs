const test = require('node:test');
const assert = require('node:assert/strict');
const { alignPrevious } = require('../market-observatory/intraday-quotes-v1.js');

const KQ = [{ date: '2026-11-09', value: 638.97 }, { date: '2026-11-10', value: 667.61 }, { date: '2026-11-11', value: 705.1 }];
const row = (prev, extra = {}) => ({ key: 'KOSDAQ', value: 693.19, previous_close: prev, change_pct: (693.19 / prev - 1) * 100, session_date: '2026-11-12', ...extra });

test('2026-11-12 incident: provider one session behind is rebased to canonical prior close', () => {
  const out = alignPrevious(row(667.61), KQ);
  assert.equal(out.previous_close, 705.1);
  assert.equal(out.previous_close_date, '2026-11-11');
  assert.equal(out.previous_close_status, 'CANONICAL_REBASED');
  assert.equal(out.provider_previous_close, 667.61);
  assert.ok(Math.abs(out.change_pct - (-1.6891)) < 0.001, String(out.change_pct));
});

test('provider matching canonical is kept', () => {
  const out = alignPrevious(row(705.1), KQ);
  assert.equal(out.previous_close, 705.1);
  assert.equal(out.previous_close_status, 'MATCHES_CANONICAL');
});

test('lagging canonical series never overrides a newer provider value', () => {
  const lag = KQ.slice(0, 2); // series still ends 11/10
  const out = alignPrevious(row(705.1), lag);
  assert.equal(out.previous_close, 705.1);
  assert.equal(out.previous_close_status, undefined);
});

test('unknown provider value is left untouched', () => {
  const out = alignPrevious(row(700.0), KQ);
  assert.equal(out.previous_close, 700.0);
  assert.equal(out.previous_close_status, undefined);
});

test('same-day series rows are not used as prior close', () => {
  const withToday = [...KQ, { date: '2026-11-12', value: 690 }];
  const out = alignPrevious(row(667.61), withToday);
  assert.equal(out.previous_close, 705.1);
});

test('missing inputs pass through', () => {
  assert.deepEqual(alignPrevious(row(667.61, { session_date: undefined }), KQ).previous_close, 667.61);
  assert.equal(alignPrevious(row(667.61), null).previous_close, 667.61);
});

test('only the immediately preceding session can trigger a rebase', () => {
  const out = alignPrevious(row(638.97), KQ); // two sessions behind
  assert.equal(out.previous_close, 638.97);
  assert.equal(out.previous_close_status, undefined);
});

test('near-but-not-exact values never match', () => {
  const out = alignPrevious(row(667.6), KQ);
  assert.equal(out.previous_close, 667.6);
});
