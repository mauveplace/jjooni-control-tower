const test = require('node:test');
const assert = require('node:assert/strict');
const { viewModel, summarizeSectors } = require('../market-observatory/today-v2.js');

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
  const fresh = { groups: { us_rates: { state: 'LIVE', as_of: '2026-11-10',
    source: 'U.S. Treasury official' } } };
  const vm = viewModel({ glance, brief, calendar, freshness: fresh }, NOW);
  assert.equal(vm.groups[2].rows[0].state, 'official');
  assert.equal(vm.groups[2].rows[0].d1, '+17.0bp');
  assert.equal(vm.groups[1].rows[0].state, 'delay');
  assert.equal(vm.groups[0].rows[1].state, 'ref');
});

test('verified NDX removes the alert and marks the row official', () => {
  const g = { ...glance, brief_check: { official_status: 'VERIFIED', official_eod_verified: true } };
  const fresh = { groups: { market: { state: 'LIVE', as_of: '2026-11-11',
    source: 'observatory.json' } } };
  const vm = viewModel({ glance: g, brief, calendar, freshness: fresh }, NOW);
  assert.ok(!vm.alerts.some(a => /NDX/.test(a.title)));
  assert.equal(vm.groups[0].rows[0].state, 'official');
});

test('rebased quotes, stale brief and freshness problems become alerts', () => {
  const vm = viewModel({ glance, brief: { ...brief, report_date_kst: '2026-11-11', market_date_us: '2026-11-10' }, freshness: { overall: 'STALE', critical_bad: ['US_CLOSE'] }, calendar, rebased: ['KOSDAQ'] }, NOW);
  const titles = vm.alerts.map(a => a.title);
  assert.ok(titles.includes('KOSDAQ 전일 종가 보정'));
  assert.ok(titles.includes('오늘 아침 시황 미게시'));
  assert.ok(titles.includes('데이터 신선도 STALE'));
});

test('LIVE_WITH_WARNINGS renders noncritical warnings as MID, not urgent HIGH', () => {
  const g = { ...glance, brief_check: { official_status: 'VERIFIED', official_eod_verified: true } };
  const vm = viewModel({ glance: g, brief, freshness: {
    overall: 'LIVE_WITH_WARNINGS', warnings: ['fedwatch', 'audit'], critical_bad: [],
    groups: { market: { state: 'LIVE', as_of: '2026-11-11', source: 'observatory.json' } }
  }, calendar }, NOW);
  assert.equal(vm.alerts.some(a => a.level === 'HIGH'), false);
  assert.ok(vm.alerts.some(a => a.level === 'MID' && /fedwatch/.test(a.body)));
});

test('LIVE_WITH_WARNINGS still surfaces a critical_bad as HIGH', () => {
  const vm = viewModel({ glance, brief, freshness: {
    overall: 'LIVE_WITH_WARNINGS', warnings: ['fedwatch'], critical_bad: ['US_CLOSE']
  }, calendar }, NOW);
  assert.ok(vm.alerts.some(a => a.level === 'HIGH' && /US_CLOSE/.test(a.body)));
});

test('events: future, importance >= 2, sorted, max 4', () => {
  const vm = viewModel({ glance, brief, calendar }, NOW);
  assert.deepEqual(vm.events.map(e => e.title), ['U.S. Initial Jobless Claims', 'Producer Price Index']);
});


test('Treasury without matching dated official source is reference, never official', () => {
  const stale = { groups: { us_rates: { state: 'LAGGING', as_of: '2026-11-09',
    source: 'U.S. Treasury official' } } };
  const vm = viewModel({ glance, brief, freshness: stale, calendar }, NOW);
  assert.equal(vm.groups[2].rows[0].state, 'delay');
  const wrong = { groups: { us_rates: { state: 'LIVE', as_of: '2026-11-10', source: 'Yahoo' } } };
  assert.equal(viewModel({ glance, brief, freshness: wrong, calendar }, NOW).groups[2].rows[0].state, 'ref');
});

test('critical upstream read failure does not assert new official status', () => {
  const g = { ...glance, brief_check: { official_status: 'VERIFIED', official_eod_verified: true } };
  const trusted = { groups: { market: { state: 'LIVE', as_of: '2026-11-11' },
    us_rates: { state: 'LIVE', as_of: '2026-11-10', source: 'U.S. Treasury official' } } };
  const vm = viewModel({ glance: g, brief, freshness: trusted, calendar,
    loadErrors: ['freshness 조회 실패(이전값 유지)'], glanceLoaded: true }, NOW);
  assert.equal(vm.groups[0].rows[0].state, 'hold');
  assert.equal(vm.groups[2].rows[0].state, 'ref');
  assert.ok(vm.alerts.some(a => /재조회 실패/.test(a.title)));
});

function fullSectorFixture() {
  const rows = (size, market, prefix) => Array.from({ length: size }, (_, i) => ({
    ticker: prefix + i, label: prefix + ' ' + i, market,
    status: 'OK', current_session: '2026-11-11', previous_return_pct: -1,
    current_return_pct: i * .2 - 1, change_pp: i * .2, direction: 'REMAINS_NEGATIVE'
  }));
  const us = rows(11, 'US', 'XL'), kr = rows(10, 'KR', 'KR');
  const themes = rows(13, 'US', 'TH');
  return { read_only: true, no_trade: true, source_generated_kst: '2026-11-12T07:00:00+09:00',
    completed_cutoffs: { US: '2026-11-11', KR: '2026-11-11' },
    groups: [{ key: 'classic', rows: us }, { key: 'kr_sector', rows: kr },
      { key: 'semiconductor', rows: themes }] };
}

test('34 completed source rows yield two changed sectors per US/KR; no net flow', () => {
  const src = fullSectorFixture();
  const s = summarizeSectors(src);
  assert.equal(s.status, 'OK');
  assert.equal(s.count, 34);
  assert.equal(s.groups.length, 2);
  assert.deepEqual(s.groups[0].rows.map(x => x.ticker), ['XL10', 'XL9']);
  assert.deepEqual(s.groups[1].rows.map(x => x.ticker), ['KR9', 'KR8']);
  assert.match(s.note, /자금 순유입/);
  const vm = viewModel({ glance, brief, calendar, sector: src }, NOW);
  assert.equal(vm.sectors.status, 'OK');
});

test('stale, incomplete or different source sessions suppress sector highlight', () => {
  const data = fullSectorFixture();
  data.groups[0].rows[0].current_session = '2026-11-10';
  assert.equal(summarizeSectors(data).status, 'UNVERIFIED');
  data.groups[0].rows[0].current_session = '2026-11-11';
  data.completed_cutoffs.US = '2026-11-10';
  assert.equal(summarizeSectors(data).status, 'UNVERIFIED');
  data.completed_cutoffs.US = '2026-11-11';
  const g = { ...glance, us_session: '2026-11-10' };
  assert.equal(viewModel({ glance: g, brief, calendar, sector: data }, NOW).sectors.status, 'UNVERIFIED');
});

test('first publish, latest revision and real ROY review scope remain distinct', () => {
  const b = { ...brief, published_kst: '2026-11-12T06:30:00+09:00',
    revisions: [{ revised_at_kst: '2026-11-12T09:00:00+09:00' }],
    editorial_contract: { dual_review: { review_status: 'PENDING' } } };
  const vm = viewModel({ glance, brief: b, calendar, loadedAt: '2026-11-12T10:00:00+09:00' }, NOW);
  assert.equal(vm.judgment.firstPublished, b.published_kst);
  assert.equal(vm.judgment.revised, b.revisions[0].revised_at_kst);
  assert.match(vm.judgment.royStatus, /대기/);
});

test('no invented missing morning brief on a market-closed KST date with same completed US session', () => {
  const b = { ...brief, report_date_kst: '2026-11-11' };
  const vm = viewModel({ glance, brief: b, calendar }, NOW);
  assert.equal(vm.alerts.some(x => x.title === '오늘 아침 시황 미게시'), false);
});
