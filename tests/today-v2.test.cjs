const test = require('node:test');
const assert = require('node:assert/strict');
const { viewModel } = require('../market-observatory/today-v2.js');

const NOW = Date.parse('2026-11-12T06:00:00Z'); // 15:00 KST
const glance = {
  us_session: '2026-11-11', headline: 'BIPOD 유지 · NDX 28,374(+2.28%)',
  brief_check: { official_status: 'MISSING', official_eod_verified: false },
  consistency: { status: 'OK', reasons: [] },
  tripod: { session: '2026-11-11', pod: 'BIPOD', regime: '상승', changed: false, ndx: 28374.25, drawdown_52w_pct: -9.13, vix10: 20.59,
    lines: { tripod_return: 28414.27, ma250_upper: 27755.69, ma250_lower: 26106.84 }, distance_pct: { tripod_return: 0.14, ma250_upper: -2.18, ma250_lower: -7.99 } },
  groups: [
    { name: '미국', items: [{ key: 'NASDAQ100', label: '나스닥100', date: '2026-11-11', value: 28374.252, d1_pct: 2.28, w1_pct: -0.22 }, { key: 'SP500', label: 'S&P500', date: '2026-11-11', value: 7619.38, d1_pct: 1.31, w1_pct: -0.9 }] },
    { name: '아시아', items: [{ key: 'KOSDAQ', label: '코스닥', date: '2026-11-12', value: 705.86, d1_pct: 0.11, w1_pct: 4.05 }] },
    { name: '금리', items: [{ key: 'US2Y', label: '미 2년물', date: '2026-11-10', value: 4.73, d1_bp: 17, w1_bp: 12 }] }]
};
const brief = { report_date_kst: '2026-11-12', market_date_us: '2026-11-11', title: 'T' };
const calendar = { events: [
  { datetime_kst: '2026-11-12T10:00+09:00', title: 'past', importance: 3, country: 'KR' },
  { datetime_kst: '2026-11-13T22:30+09:00', title: 'Producer Price Index', importance: 2, country: 'US' },
  { datetime_kst: '2026-11-12T22:30+09:00', title: 'U.S. Initial Jobless Claims', importance: 2, country: 'US' },
  { datetime_kst: '2026-11-14T09:00+09:00', title: 'minor', importance: 1, country: 'US' }] };

test('unverified NDX: top alert, NDX row is ? 검증 보류', () => {
  const vm = viewModel({ glance, brief, freshness: { overall: 'LIVE', critical_bad: [] }, calendar }, NOW);
  assert.equal(vm.alerts[0].title, 'NDX 공식 종가 미검증');
  const ndx = vm.groups[0].rows[0];
  assert.equal(ndx.state, 'hold');
  assert.equal(ndx.tag, '? 검증 보류');
});

test('TRI-POD: breached −9% shown as exceeded, not as a distance', () => {
  const vm = viewModel({ glance, brief, calendar }, NOW);
  const dd = vm.tripod.conds[0];
  assert.equal(dd.ok, false);
  assert.match(dd.note, /임계 −9%를 0\.13%p 초과/);
  assert.match(dd.note, /복귀선 NDX 28,414\.27 \(\+0\.14%\)/);
  assert.equal(vm.tripod.conds[1].ok, true); // VIX10 < 28 in 상승
  assert.match(vm.tripod.conds[1].label, /28 미만/);
  assert.equal(vm.tripod.conds[2].ok, true);
  assert.equal(vm.tripod.pod, 'BIPOD');
  assert.match(vm.tripod.verification, /검증 보류/);
  assert.match(vm.noTrade, /자동주문 없음/);
});

test('states: Treasury official, same-day KR delayed, others reference', () => {
  const vm = viewModel({ glance, brief, calendar }, NOW);
  assert.equal(vm.groups[2].rows[0].state, 'official');
  assert.equal(vm.groups[2].rows[0].d1, '+17.0bp');
  assert.equal(vm.groups[1].rows[0].state, 'delay');
  assert.equal(vm.groups[0].rows[1].state, 'ref');
});

test('verified NDX removes the alert and marks the row official', () => {
  const g = { ...glance, brief_check: { official_status: 'VERIFIED', official_eod_verified: true } };
  const vm = viewModel({ glance: g, brief, calendar }, NOW);
  assert.ok(!vm.alerts.some(a => /NDX/.test(a.title)));
  assert.equal(vm.groups[0].rows[0].state, 'official');
});

test('rebased quotes, stale brief and freshness problems become alerts', () => {
  const vm = viewModel({ glance, brief: { ...brief, report_date_kst: '2026-11-11' }, freshness: { overall: 'STALE', critical_bad: ['US_CLOSE'] }, calendar, rebased: ['KOSDAQ'] }, NOW);
  const titles = vm.alerts.map(a => a.title);
  assert.ok(titles.includes('KOSDAQ 전일 종가 보정'));
  assert.ok(titles.includes('오늘 아침 시황 미게시'));
  assert.ok(titles.includes('데이터 신선도 STALE'));
});

test('events: future, importance >= 2, sorted, max 4', () => {
  const vm = viewModel({ glance, brief, calendar }, NOW);
  assert.deepEqual(vm.events.map(e => e.title), ['U.S. Initial Jobless Claims', 'Producer Price Index']);
});
