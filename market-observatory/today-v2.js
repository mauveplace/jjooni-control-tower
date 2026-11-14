/* Observatory v2 "오늘" screen — phase 2 (issue #403).
 * Active only with the v2 navigation (?ui=v2). Read-only ViewModel over data
 * already published (daily-glance, morning brief, freshness, calendar, live
 * quote runtime). It computes no market numbers of its own and never changes
 * collection, verification or TRI-POD inputs. The legacy Overview stays below.
 */
(function (root) {
  'use strict';
  const STATE = {
    official: { tag: '✓ 공식 확정', short: '✓ 공식', cls: 'official' },
    ref: { tag: '◐ 참고·완료 일봉', short: '◐ 참고', cls: 'ref' },
    hold: { tag: '? 검증 보류', short: '? 보류', cls: 'hold' },
    delay: { tag: '! 지연·당일 게시', short: '! 지연', cls: 'delay' }
  };
  const OFFICIAL_KEYS = new Set(['US2Y', 'US10Y_OFFICIAL', 'US30Y_OFFICIAL', 'US3M']);

  function kstDate(now) { return new Date(now + 9 * 3600000).toISOString().slice(0, 10); }

  // A completed provider bar must never become "official" merely by ticker.
  // Validate the exact group source, as-of session, and status of the public SSOT.
  function sourceGroupFor(key) {
    if (OFFICIAL_KEYS.has(key) || ['US5Y', 'US10Y', 'US30Y', 'US3M', 'US_2S10S'].includes(key)) return 'us_rates';
    if (['KOSPI', 'KOSDAQ'].includes(key)) return 'kr_equity';
    if (['NIKKEI225', 'HANGSENG', 'SHCOMP'].includes(key)) return 'us_supplement';
    if (['DXY', 'USDKRW', 'USDJPY', 'JPYKRW'].includes(key)) return 'fx';
    if (['GOLD', 'SILVER', 'COPPER'].includes(key)) return 'metals';
    if (['WTI', 'BRENT', 'NATGAS'].includes(key)) return 'energy';
    if (['BTCUSD', 'ETHUSD'].includes(key)) return 'crypto';
    return 'market';
  }
  function rowState(item, ctx) {
    const fresh = ctx.freshness || {};
    const group = (fresh.groups || {})[sourceGroupFor(item.key)];
    const freshAligned = group?.state === 'LIVE' && group.as_of === item.date;
    if (item.key === 'NASDAQ100') {
      return ctx.ndxVerified && item.date === ctx.usSession && freshAligned ? 'official' : 'hold';
    }
    if (OFFICIAL_KEYS.has(item.key)) {
      return freshAligned && String(group.source || '').startsWith('U.S. Treasury official') ? 'official' : 'ref';
    }
    if (group && group.state !== 'LIVE') return 'delay';
    if (['KOSPI', 'KOSDAQ'].includes(item.key) && item.date === ctx.today && !freshAligned) return 'delay';
    return 'ref';
  }
  function summarizeSectors(source) {
    const groups = Array.isArray(source?.groups) ? source.groups : [];
    const all = groups.flatMap(g => Array.isArray(g.rows) ? g.rows : []);
    const cutoffs = source?.completed_cutoffs || {};
    const valid = source?.read_only === true && source?.no_trade === true
      && all.length === 34 && groups.find(g => g.key === 'classic')?.rows?.length === 11
      && groups.find(g => g.key === 'kr_sector')?.rows?.length === 10
      && all.every(r => r.status === 'OK' && r.current_session === cutoffs[r.market]
        && Number.isFinite(r.current_return_pct) && Number.isFinite(r.previous_return_pct)
        && Number.isFinite(r.change_pp));
    if (!valid) return { status: 'UNVERIFIED', count: all.length, groups: [],
      note: '34개 원장 중 일부 세션/가격을 확인하지 못했습니다. 상세 원장을 확인하세요.' };
    return { status: 'OK', count: 34, sourceGenerated: source.source_generated_kst,
      groups: [
        { key: 'classic', market: 'US', label: '미국 S&P500 11개', session: cutoffs.US },
        { key: 'kr_sector', market: 'KR', label: '한국 10개', session: cutoffs.KR }
      ].map(meta => {
        const rows = groups.find(g => g.key === meta.key).rows;
        return { ...meta, rows: [...rows].sort((a, b) => Math.abs(b.change_pp) - Math.abs(a.change_pp)).slice(0, 2)
          .map(r => ({ ticker: r.ticker, label: r.label, previous: r.previous_return_pct,
            current: r.current_return_pct, delta: r.change_pp, direction: r.direction })) };
      }), note: '완료 일봉 수익률 상대 강약 · 자금 순유입/순매수 증거가 아닙니다' };
  }

  function viewModel(input, now) {
    const glance = input.glance || {}, brief = input.brief || {}, fresh = input.freshness || {};
    const check = glance.brief_check || {};
    const ndxVerified = check.official_status === 'VERIFIED' && check.official_eod_verified === true;
    const today = kstDate(now);
    const alerts = [];
    if (!ndxVerified) alerts.push({ level: 'HIGH', title: 'NDX 공식 종가 미검증', body: 'TRI-POD 전환 확정 금지 · 제공자 완료 일봉은 참고값' });
    if (fresh.overall && !['LIVE', 'LIVE_WITH_WARNINGS'].includes(fresh.overall)) alerts.push({ level: 'HIGH', title: '데이터 신선도 ' + fresh.overall, body: (fresh.critical_bad || []).join(', ') || '상태 파일 확인 필요' });
    // LIVE_WITH_WARNINGS can be caused by noncritical FedWatch/audit warnings.
    // Reserve urgent red alerts for genuinely critical data problems.
    if (fresh.overall === 'LIVE_WITH_WARNINGS') alerts.push({ level: 'MID', title: '일부 데이터 확인 필요', body: (fresh.warnings || []).join(', ') || '데이터 감사 상세 확인' });
    for (const c of fresh.critical_bad || []) if (['LIVE', 'LIVE_WITH_WARNINGS'].includes(fresh.overall)) alerts.push({ level: 'HIGH', title: '핵심 데이터 결함', body: String(c) });
    if (glance.consistency && glance.consistency.status && glance.consistency.status !== 'OK') alerts.push({ level: 'MID', title: '데이터 정합성 ' + glance.consistency.status, body: (glance.consistency.reasons || []).join(' · ') });
    for (const key of input.rebased || []) alerts.push({ level: 'MID', title: key + ' 전일 종가 보정', body: '장중 시세 원천의 전일 종가가 한 세션 늦어 확정 종가 기준으로 재계산' });
    if (brief.report_date_kst && brief.report_date_kst !== today && brief.market_date_us !== glance.us_session)
      alerts.push({ level: 'MID', title: '오늘 아침 시황 미게시', body: '최신 게시 ' + brief.report_date_kst });

    const t = glance.tripod || {};
    const up = t.regime === '상승';
    const vixLimit = up ? 28 : 18;
    const conds = [];
    if (up && typeof t.drawdown_52w_pct === 'number') {
      const ok = t.drawdown_52w_pct > -9;
      const gap = Math.abs(t.drawdown_52w_pct + 9).toFixed(2);
      conds.push({ ok, label: '52주 고점 대비 낙폭 −9% 이내', value: fmtPct(t.drawdown_52w_pct, false),
        note: ok ? '임계까지 ' + gap + '%p 여유' : '임계 −9%를 ' + gap + '%p 초과' + (t.lines && t.lines.tripod_return ? ' · 복귀선 NDX ' + num(t.lines.tripod_return) + ' (' + fmtPct(t.distance_pct && t.distance_pct.tripod_return, true) + ')' : '') });
    }
    if (typeof t.vix10 === 'number') {
      const ok = t.vix10 < vixLimit;
      conds.push({ ok, label: 'VIX10 ' + vixLimit + ' 미만 (' + (t.regime || '—') + ' 레짐 기준)', value: t.vix10.toFixed(2),
        note: ok ? '여유 ' + (vixLimit - t.vix10).toFixed(2) : vixLimit + ' 이상' });
    }
    if (t.lines && t.lines.ma250_lower && typeof t.distance_pct?.ma250_lower === 'number') {
      const ok = up ? t.distance_pct.ma250_lower < 0 : false;
      conds.push({ ok, label: up ? '상승 레짐 유지: NDX ≥ MA250×0.95' : '상승 레짐 복귀: NDX ≥ MA250×1.01',
        value: num(t.ndx), note: up ? '하락 전환선 ' + num(t.lines.ma250_lower) + ' (' + fmtPct(t.distance_pct.ma250_lower, true) + ')' : '복귀선 ' + num(t.lines.ma250_upper) + ' (' + fmtPct(t.distance_pct.ma250_upper, true) + ')' });
    }
    const tripod = { pod: t.pod || '—', regime: t.regime || '—', session: t.session || '—', changed: !!t.changed, conds,
      verification: ndxVerified ? '공식 종가 검증됨' : '검증 보류 — NDX 공식 종가 미확인',
      next: [t.next_up, t.next_down].filter(Boolean) };

    const sourceFailed = (input.loadErrors || []).some(x => /^(freshness|glance)\b/.test(x));
    const ctx = { ndxVerified: ndxVerified && !sourceFailed, today, freshness: sourceFailed ? {} : fresh,
      usSession: glance.us_session };
    const groups = (glance.groups || []).map(g => ({ name: g.name, rows: (g.items || []).map(it => {
      const st = rowState(it, ctx);
      const unit = it.d1_bp != null ? 'bp' : it.d1_pt != null ? 'pt' : '%';
      const d1 = it.d1_pct ?? it.d1_bp ?? it.d1_pt ?? null, w1 = it.w1_pct ?? it.w1_bp ?? null;
      const groupSource = (fresh.groups || {})[sourceGroupFor(it.key)] || {};
      const provenance = [groupSource.source || it.source || '제공자 원장', '시장일자 ' + (it.date || '미확인'),
        groupSource.state || '출처 상태 미확인'].join(' · ');
      return { key: it.key, label: it.label || it.key, value: num(it.value, it.key.startsWith('US') || it.key.startsWith('KR') ? 3 : 2) + (unit === 'bp' ? '%' : ''),
        d1: fmtChange(d1, unit), w1: fmtChange(w1, unit), d1n: d1, unit, date: it.date, state: st,
        tag: STATE[st].tag, provenance };
    }) }));

    const events = ((input.calendar && input.calendar.events) || [])
      .filter(e => (e.importance || 0) >= 2 && Date.parse(e.datetime_kst) >= now)
      .sort((a, b) => Date.parse(a.datetime_kst) - Date.parse(b.datetime_kst)).slice(0, 4)
      .map(e => ({ when: String(e.datetime_kst).slice(5, 16).replace('T', ' '), title: e.title_ko || e.title, country: e.country }));

    const revisions = Array.isArray(brief.revisions) ? brief.revisions : [];
    const revised = revisions.map(x => x.revised_at_kst).filter(x => Number.isFinite(Date.parse(x))).sort().at(-1) || null;
    const roy = brief.editorial_contract?.dual_review || {};
    const errors = Array.isArray(input.loadErrors) ? input.loadErrors : [];
    if (errors.length) alerts.push({ level: !input.glanceLoaded ? 'HIGH' : 'MID',
      title: '공개 데이터 재조회 실패', body: errors.join(', ') + ' · 이전 로드값은 최신 관측값이 아닙니다' });
    const sector = summarizeSectors(input.sector);
    if (sector.status === 'OK' && sector.groups[0].session !== glance.us_session) {
      sector.status = 'UNVERIFIED';
      sector.note = '미국 섹터 세션과 지수 세션이 달라 요약을 보류합니다. 원본의 시장일자를 확인하세요.';
      sector.groups = [];
    }
    return { alerts, judgment: { title: brief.title || '아침 시황 없음', date: brief.report_date_kst || '—',
        market: brief.market_date_us || '—', headline: glance.headline || '',
        firstPublished: brief.published_kst || null, revised,
        royStatus: roy.review_status === 'PENDING' ? '로이 전체 독립검토 대기' :
          (roy.review_status || '로이 검토 범위 미표시') },
      tripod, groups, events, sectors: sector, session: glance.us_session || '—', today,
      loadedAt: input.loadedAt || null,
      noTrade: '관찰용 · 자동주문 없음 · 공식 신호 확정 전 전환 금지' };
  }

  function num(v, d = 2) { return typeof v === 'number' && isFinite(v) ? v.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—'; }
  function fmtPct(v, sign) { if (typeof v !== 'number' || !isFinite(v)) return '—'; const s = v > 0 ? '+' : v < 0 ? '−' : ''; return (sign || v < 0 ? s : '') + Math.abs(v).toFixed(2) + '%'; }
  function fmtChange(v, unit) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    const s = v > 0 ? '+' : v < 0 ? '−' : '';
    return s + Math.abs(v).toFixed(unit === '%' ? 2 : 1) + unit;
  }

  const api = { viewModel, rowState, summarizeSectors, STATE, version: '1.1' };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (!root.document) return;
  root.__JJOONI_TODAY_V2 = { ...api, rendered: false };

  const css = `
.todayV2{display:flex;flex-direction:column;gap:14px;max-width:1180px;margin:14px auto 18px;padding:0 14px;box-sizing:border-box}
.todayV2[hidden]{display:none}
.tV2Alert{background:#fdecec;border:1px solid #f3c4c4;color:#7a1414;border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.tV2Alert b.badge{font-size:11px;background:#b42318;color:#fff;padding:2px 7px;border-radius:4px;margin-right:6px}
.tV2Alert div{font-size:13px;line-height:1.45}
.tV2Notice{background:#fff8e9;border:1px solid #e5ca82;color:#664608;border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:5px}
.tV2Notice div{font-size:13px;line-height:1.45}
.tV2Grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:14px}
.tV2Card{background:#fff;border:1px solid #e5ebf2;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
.tV2Eyebrow{font-size:11px;font-weight:800;color:#5b6878;letter-spacing:.04em}
.tV2Title{margin:0;font-size:18px;line-height:1.4}
.tV2Pods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tV2Pod{border-radius:10px;padding:10px 12px}
.tV2Pod.main{border:2px solid #0e1726}.tV2Pod.calc{border:1px dashed #8a95a3;background:#fafbfc}
.tV2Pod small{display:block;font-size:11px;color:#5b6878}.tV2Pod strong{display:block;font-size:20px}
.tV2Cond{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:baseline;font-size:13px}
.tV2Cond i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;color:#fff;font-weight:800;font-size:12px}
.tV2Cond i.ok{background:#1b5e2b}.tV2Cond i.no{background:#7a1414}
.tV2Cond small{display:block;color:#5b6878;font-size:11px}
.tV2NoTrade{background:#f4f5f7;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#3a4656}
.tV2Table{width:100%;border-collapse:collapse;font-size:13px}
.tV2Table th,.tV2Table td{padding:6px 8px;border-top:1px solid #f1f3f6;text-align:right;white-space:nowrap}
.tV2Table th[scope=row]{text-align:left;font-weight:600}
.tV2Table .grp th{background:#fafbfc;color:#5b6878;font-size:11px;text-align:left}
.tV2Table .up{color:#b71c1c}.tV2Table .dn{color:#163c91}
.tV2Tag{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid}
.tV2Tag.official{background:#e7f4ea;color:#1b5e2b;border-color:#bfe0c7}.tV2Tag.ref{background:#fff4db;color:#7a4a00;border-color:#f0d49a}
.tV2Tag.hold{background:#eef1f5;color:#3a4656;border-color:#c9d1dc}.tV2Tag.delay{background:#fdecec;color:#7a1414;border-color:#f3c4c4}
.tV2Scroll{overflow-x:auto}
.tV2Tag .s{display:none}
@media(max-width:520px){.tV2Table .w1{display:none}.tV2Tag .l{display:none}.tV2Tag .s{display:inline}.tV2Table th,.tV2Table td{padding:6px 5px}}
.tV2Event{display:grid;grid-template-columns:96px 1fr;gap:8px;font-size:13px}.tV2Event span:first-child{color:#5b6878}
.tV2Vintage{font-size:12px;line-height:1.55;color:#44556c}
.tV2SectorRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;border-top:1px solid #edf0f4;padding:8px 0;font-size:12px}
.tV2SectorRow strong{font-size:13px}.tV2SectorRow small{display:block;color:#607084;font-size:11px}
.tV2SectorRow b{text-align:right;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
.tV2SectorBtns{display:flex;flex-wrap:wrap;gap:8px}
.tV2SectorBtns button{min-height:44px;border:1px solid #c5d5e8;background:#f5f9ff;border-radius:9px;padding:8px 12px;font-size:13px;font-weight:700;color:#173e6e;cursor:pointer}
.tV2Source{cursor:help}
.tV2SectorNote{font-size:11px;line-height:1.5;color:#52657b}
.tV2Vintage time{font-variant-numeric:tabular-nums}
`;
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') n.className = v; else n.setAttribute(k, v); }
    for (const k of kids) if (k != null) n.append(k instanceof Node ? k : String(k));
    return n;
  }
  async function load(url) { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw Error(url + ' ' + r.status); return r.json(); }

  function kstClock(iso) {
    if (!iso || !Number.isFinite(Date.parse(iso))) return '미확인';
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) + ' KST';
  }
  function fmtPoint(n) { return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%'; }
  function render(vm) {
    const tabs = document.getElementById('tabs'); if (!tabs) return;
    document.querySelector('.todayV2')?.remove();
    const wrap = el('section', { class: 'todayV2', 'aria-label': '오늘 화면' });
    const criticalAlerts = vm.alerts.filter(a => a.level === 'HIGH');
    const advisoryNotices = vm.alerts.filter(a => a.level !== 'HIGH');
    if (criticalAlerts.length) {
      wrap.append(el('div', { class: 'tV2Alert', role: 'alert' },
        el('div', null, el('b', { class: 'badge' }, '긴급 데이터 경고 ' + criticalAlerts.length)),
        ...criticalAlerts.map(a => el('div', null, el('b', null, a.title), ' — ' + a.body))));
    }
    if (advisoryNotices.length) {
      wrap.append(el('div', { class: 'tV2Notice', role: 'status' },
        el('div', null, el('b', null, '참고 안내 ' + advisoryNotices.length)),
        ...advisoryNotices.map(a => el('div', null, el('b', null, a.title), ' — ' + a.body))));
    }
    const judge = el('article', { class: 'tV2Card' },
      el('div', { class: 'tV2Eyebrow' }, '오늘의 판단 · 아침 시황 ' + vm.judgment.date + ' (미국 ' + vm.judgment.market + ')'),
      el('h2', { class: 'tV2Title' }, vm.judgment.title),
      el('div', { class: 'tV2Vintage' },
        '최초 발행 ' + kstClock(vm.judgment.firstPublished)
        + ' · 최근 보강 ' + (vm.judgment.revised ? kstClock(vm.judgment.revised) : '없음')
        + ' · ' + vm.judgment.royStatus + ' · 화면 조회 ' + kstClock(vm.loadedAt)),
      el('button', { type: 'button', 'data-refresh': 'today',
        style: 'align-self:flex-start;min-height:44px;padding:6px 12px;border:1px solid #c5d5e8;border-radius:8px;background:#f5f9ff;font-size:13px;font-weight:700;color:#173e6e' }, '오늘 정보 다시 확인'),
      vm.judgment.headline ? el('div', { style: 'font-size:13px;color:#3a4656' }, vm.judgment.headline) : null,
      el('button', { type: 'button', class: 'tV2Link', style: 'align-self:flex-start;min-height:44px;border:0;background:none;color:#175cd3;font:inherit;font-weight:700;cursor:pointer;padding:0', 'data-go': 'morning-brief' }, '아침 시황 전문 →'));
    const tp = vm.tripod;
    const tri = el('article', { class: 'tV2Card' },
      el('div', { class: 'tV2Eyebrow' }, 'TRI-POD · 전략 관찰 · 세션 ' + tp.session),
      el('div', { class: 'tV2Pods' },
        el('div', { class: 'tV2Pod main' }, el('small', null, '현재 상태 (canonical)'), el('strong', null, tp.pod + (tp.changed ? ' · 전환' : ' 유지')), el('small', null, '레짐 ' + tp.regime)),
        el('div', { class: 'tV2Pod calc' }, el('small', null, '공식 종가 검증'), el('strong', { style: 'font-size:15px' }, tp.verification), el('small', null, tp.changed ? '전환 미확정' : '상태 변화 없음'))),
      el('div', { style: 'font-size:13px;font-weight:700' }, 'TRIPOD 조건'),
      ...tp.conds.map(c => el('div', { class: 'tV2Cond' }, el('i', { class: c.ok ? 'ok' : 'no', 'aria-label': c.ok ? '충족' : '미충족' }, c.ok ? '✓' : '✗'),
        el('div', null, c.label, el('small', null, c.note)), el('b', null, c.value))),
      el('div', { class: 'tV2NoTrade' }, vm.noTrade));
    wrap.append(el('div', { class: 'tV2Grid' }, judge, tri));
    const sector = vm.sectors;
    const sectorCard = el('article', { class: 'tV2Card' },
      el('div', { class: 'tV2Eyebrow' }, '업종 주도권 이동 · 미국 11개 · 한국 10개 · 테마 13개'),
      el('div', { class: 'tV2Vintage' }, sector.status === 'OK'
        ? '완료 기준 미국 ' + sector.groups[0].session + ' / 한국 ' + sector.groups[1].session
        : '원장 미검증 · 자세한 현황은 섹터 상세에서 확인'),
      ...(sector.status === 'OK' ? sector.groups.map(g => el('div', null,
        el('strong', null, g.label + ' · 전일 대비 변화폭 상위 2개'),
        ...g.rows.map(x => el('div', { class: 'tV2SectorRow' },
          el('div', null, el('strong', null, x.label + ' · ' + x.ticker),
            el('small', null, fmtPct(x.previous, true) + ' → ' + fmtPct(x.current, true))),
          el('b', null, fmtPoint(x.delta) + 'p')))) : []),
      el('div', { class: 'tV2SectorNote' }, sector.note),
      el('div', { class: 'tV2SectorBtns' },
        el('button', { type: 'button', 'data-go': 'sectors' }, '34개 업종 전체 보기'),
        el('button', { type: 'button', 'data-go': 'morning-brief' }, '시황 ④·⑤ 기업사건 분석')));
    wrap.append(sectorCard);

    const tbody = el('tbody');
    for (const g of vm.groups) {
      tbody.append(el('tr', { class: 'grp' }, el('th', { colspan: '5', scope: 'rowgroup' }, g.name)));
      for (const r of g.rows) {
        const cls = typeof r.d1n === 'number' ? (r.d1n > 0 ? 'up' : r.d1n < 0 ? 'dn' : '') : '';
        tbody.append(el('tr', { 'data-key': r.key }, el('th', { scope: 'row' }, r.label), el('td', null, r.value),
          el('td', { class: cls }, r.d1), el('td', { class: 'w1' }, r.w1),
          el('td', null, el('span', { class: 'tV2Tag tV2Source ' + STATE[r.state].cls, title: r.tag + ' · ' + r.provenance }, el('span', { class: 'l' }, r.tag), el('span', { class: 's' }, STATE[r.state].short)), el('span', { class: 'dt' }, ' ' + (r.date || '').slice(5)))));
      }
    }
    const table = el('table', { class: 'tV2Table' },
      el('thead', null, el('tr', null, el('th', { scope: 'col', style: 'text-align:left' }, '항목'), el('th', { scope: 'col' }, '최신'), el('th', { scope: 'col' }, '1D'), el('th', { scope: 'col', class: 'w1' }, '1W'), el('th', { scope: 'col' }, '상태 · 기준일'))), tbody);
    const market = el('article', { class: 'tV2Card' }, el('div', { class: 'tV2Eyebrow' }, '시장 요약 · 색은 방향만(+ 빨강 / − 파랑)'), el('div', { class: 'tV2Scroll' }, table));
    const events = el('article', { class: 'tV2Card' }, el('div', { class: 'tV2Eyebrow' }, '다음 일정 (KST)'),
      ...(vm.events.length ? vm.events.map(e => el('div', { class: 'tV2Event' }, el('span', null, e.when), el('span', null, e.country + ' · ' + e.title))) : [el('div', null, '예정된 주요 일정 없음')]));
    wrap.append(el('div', { class: 'tV2Grid' }, market, events));
    // Directly under the v2 navigation, BEFORE the hidden legacy #tabs: legacy
    // modules insert their board/glance right after #tabs at varying times,
    // so anchoring after #tabs let them land above this screen in CI.
    tabs.parentNode.insertBefore(wrap, tabs);
    showForTab();
    wrap.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () =>
      document.querySelector('#tabs button[data-tab="' + btn.dataset.go + '"]')?.click()));
    wrap.querySelector('[data-refresh="today"]')?.addEventListener('click', () => root.__JJOONI_TODAY_V2.refresh?.());
    root.__JJOONI_TODAY_V2.rendered = true;
    root.__JJOONI_TODAY_V2.vm = vm;
  }

  function showForTab() {
    const w = document.querySelector('.todayV2'); if (!w) return;
    const on = (document.querySelector('#tabs button.on')?.dataset.tab || 'overview') === 'overview';
    w.hidden = !on;
  }
  async function run() {
    if (!root.__JJOONI_NAV_V2 || !root.__JJOONI_NAV_V2.enabled(location.search, (() => { try { return localStorage.getItem('obs-ui'); } catch (_) { return null; } })())) return;
    const style = el('style'); style.textContent = css; document.head.appendChild(style);
    const paths = {
      glance: './data/daily-glance.json', brief: './data/morning-brief/latest.json',
      freshness: './data/freshness-status.json', calendar: './data/economic-calendar.json',
      sector: './data/sector-rotation-brief.json'
    };
    const cache = {};
    let loadErrors = [], loadedAt = null, lastFetched = 0, pending = null;
    const draw = () => {
      const q = root.__JJOONI_OBSERVATORY_QUOTES;
      const rebased = ['KOSPI', 'KOSDAQ'].filter(k => q?.get?.(k)?.previous_close_status === 'CANONICAL_REBASED');
      render(viewModel({ ...cache, rebased, loadErrors, loadedAt, glanceLoaded: !!cache.glance }, Date.now()));
    };
    const refresh = (force = false) => {
      if (pending) return pending;
      // UI-only on-view refresh. Never poll entire Observatory or write source files.
      if (!force && lastFetched && Date.now() - lastFetched < 15000) { draw(); return Promise.resolve(); }
      pending = (async () => {
        const entries = Object.entries(paths);
        const all = await Promise.allSettled(entries.map(([, url]) => load(url)));
        loadErrors = [];
        for (let i = 0; i < entries.length; i++) {
          const key = entries[i][0], result = all[i];
          if (result.status === 'fulfilled') cache[key] = result.value;
          else loadErrors.push(key + ' 조회 실패' + (cache[key] ? '(이전값 유지)' : '(값 없음)'));
        }
        lastFetched = Date.now();
        loadedAt = new Date(lastFetched).toISOString();
        draw();
      })().finally(() => { pending = null; });
      return pending;
    };
    root.__JJOONI_TODAY_V2.refresh = () => refresh(true);
    await refresh(true);
    document.addEventListener('jjooni:observatory-quotes-updated', draw);
    const tabs = document.getElementById('tabs');
    if (tabs) {
      new MutationObserver(showForTab).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['class'] });
      tabs.addEventListener('click', e => {
        if (e.target.closest('button[data-tab="overview"]')) void refresh();
      });
    }
    // Resume only when the user actually returns to this visible view.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (document.querySelector('#tabs button.on')?.dataset.tab === 'overview')) void refresh();
    });
  }
  run().catch(e => { console.error('today-v2', e); });
})(typeof window === 'object' ? window : globalThis);
