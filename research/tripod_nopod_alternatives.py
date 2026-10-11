#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, math, statistics, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research-output'
OUT.mkdir(exist_ok=True)
OUT_JSON = OUT / 'tripod_nopod_alternatives.json'
OUT_MD = OUT / 'tripod_nopod_alternatives.md'
COST = 0.0005  # 5bp one-way turnover
UA = 'Mozilla/5.0 JJOONI-TRIPOD-NOPOD-STUDY/1.0'
SAMPLE_BASE = 'https://raw.githubusercontent.com/tomlupo/ai-playground/main/data/samples/'


def text(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/csv,*/*'})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8-sig', 'ignore')


def fred(sid: str) -> dict[str, float]:
    out = {}
    for row in csv.DictReader(io.StringIO(text('https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + sid))):
        d = row.get('observation_date') or row.get('DATE') or row.get('date')
        try:
            v = float(row.get(sid))
        except Exception:
            continue
        if d and math.isfinite(v):
            out[d] = v
    return out


def sample(sym: str) -> dict[str, float]:
    out = {}
    for row in csv.DictReader(io.StringIO(text(SAMPLE_BASE + sym + '.csv'))):
        d = row.get('Date') or row.get('date')
        raw = row.get('Close') or row.get('Adj Close') or row.get('close')
        try:
            v = float(raw)
        except Exception:
            continue
        if d and math.isfinite(v):
            out[d] = v
    return out


def mean(xs):
    return sum(xs) / len(xs) if xs else None


def ff(ds, m):
    out, last = [], None
    for d in ds:
        if d in m:
            last = m[d]
        out.append(last)
    return out


def compound(rs):
    w = 1.0
    for r in rs:
        w *= max(1e-12, 1 + r)
    return w - 1


def metrics(ds, rs):
    p = [(d, r) for d, r in zip(ds, rs) if r is not None]
    if not p:
        return {}
    rr = [r for _, r in p]
    w = 1.0; peak = 1.0; mdd = 0.0
    years = len(rr) / 252
    for _, r in p:
        w *= max(1e-12, 1 + r)
        peak = max(peak, w)
        mdd = min(mdd, w / peak - 1)
    cagr = w ** (1 / years) - 1 if years > 0 else None
    vol = statistics.stdev(rr) * math.sqrt(252) if len(rr) > 1 else 0.0
    return {'start': p[0][0], 'end': p[-1][0], 'days': len(rr), 'years': years,
            'terminal_multiple': w, 'cagr': cagr, 'mdd': mdd, 'ann_vol': vol}


def main():
    nd = fred('NASDAQ100'); vx = fred('VIXCLS'); y10m = fred('DGS10'); y3m = fred('DGS3MO')
    px = {s: sample(s) for s in ['IEF', 'SHY', 'GLD', 'DBC', 'QQQ']}

    base_dates = sorted(set(nd) & set(vx))
    n = [nd[d] for d in base_dates]
    v = [vx[d] for d in base_dates]
    y10 = ff(base_dates, y10m)
    y3 = ff(base_dates, y3m)

    states, dd52, v10s, rate_down = [], [], [], []
    prev = None
    for i, d in enumerate(base_dates):
        if i < 251:
            states.append(None); dd52.append(None); v10s.append(None); rate_down.append(False); continue
        ma250 = mean(n[i-249:i+1]); v10 = mean(v[i-9:i+1]); hi = max(n[i-251:i+1]); dd = n[i] / hi - 1
        if n[i] > ma250 * 1.01:
            reg = 'UP'
        elif n[i] < ma250 * 0.95:
            reg = 'DOWN'
        else:
            reg = prev
        if reg is None:
            reg = 'UP' if n[i] >= ma250 else 'DOWN'
        prev = reg
        if reg == 'UP':
            st = 'TRIPOD' if (v10 < 28 and dd >= -0.09) else 'BIPOD'
        else:
            st = 'MONOPOD' if v10 < 18 else 'NOPOD'
        states.append(st); dd52.append(dd); v10s.append(v10)
        if i >= 99 and y10[i] is not None and y10[i-20] is not None and all(x is not None for x in y10[i-99:i+1]):
            rate_down.append(bool(y10[i] < mean(y10[i-99:i+1]) and y10[i] < y10[i-20]))
        else:
            rate_down.append(False)

    # same close-signal -> next-close execution convention used in the prior reconstruction
    exec_state = [states[i-2] if i >= 2 else None for i in range(len(base_dates))]
    exec_dd = [dd52[i-2] if i >= 2 else None for i in range(len(base_dates))]
    exec_v10 = [v10s[i-2] if i >= 2 else None for i in range(len(base_dates))]
    exec_rate_down = [rate_down[i-2] if i >= 2 else False for i in range(len(base_dates))]
    idx = {d: i for i, d in enumerate(base_dates)}

    common = sorted(set(base_dates) & set(px['IEF']) & set(px['SHY']) & set(px['GLD']) & set(px['DBC']) & set(px['QQQ']))
    common = [d for d in common if exec_state[idx[d]]]
    # need one prior common close for ETF return
    common = common[1:]

    er = {s: {} for s in px}
    all_common = sorted(set(base_dates) & set(px['IEF']) & set(px['SHY']) & set(px['GLD']) & set(px['DBC']) & set(px['QQQ']))
    for j in range(1, len(all_common)):
        d0, d1 = all_common[j-1], all_common[j]
        for s in px:
            er[s][d1] = px[s][d1] / px[s][d0] - 1

    # trailing total return, observable at signal close; execution uses two-bar lag below
    tr63 = {s: {} for s in px}
    tr126 = {s: {} for s in px}
    for s in px:
        ds = sorted(px[s])
        for j, d in enumerate(ds):
            if j >= 63:
                tr63[s][d] = px[s][d] / px[s][ds[j-63]] - 1
            if j >= 126:
                tr126[s][d] = px[s][d] / px[s][ds[j-126]] - 1

    # weight vector order: cash, IEF, SHY, GLD, DBC, QQQ
    assets = ['CASH', 'IEF', 'SHY', 'GLD', 'DBC', 'QQQ']
    def W(**kw):
        z = {a: 0.0 for a in assets}
        for k, v in kw.items(): z[k] = v
        return z

    def obs_mom(d, lookback):
        i = idx[d]
        sig_d = base_dates[i-2] if i >= 2 else None
        src = tr63 if lookback == 63 else tr126
        vals = {s: src[s].get(sig_d) for s in ['IEF', 'SHY', 'GLD', 'DBC']}
        return vals

    def choose_top(d, lookback, topn):
        vals = obs_mom(d, lookback)
        valid = [(s, r) for s, r in vals.items() if r is not None]
        if not valid:
            return W(CASH=1.0)
        valid.sort(key=lambda x: x[1], reverse=True)
        chosen = [s for s, r in valid[:topn] if r > 0]
        if not chosen:
            return W(CASH=1.0)
        w = 1.0 / len(chosen)
        out = W()
        for s in chosen: out[s] = w
        return out

    def crash_rebound(i, vix_fall=False):
        dd = exec_dd[i]; vv = exec_v10[i]
        if dd is None or vv is None:
            return False
        cond = (dd <= -0.20 and vv >= 25)
        if not vix_fall:
            return cond
        # use already lagged observable 10d VIX10 direction
        if i < 10 or exec_v10[i-10] is None:
            return False
        return cond and vv < exec_v10[i-10]

    def weight(name, d):
        i = idx[d]
        rd = exec_rate_down[i]
        if name == 'CASH': return W(CASH=1)
        if name == 'SHY100': return W(SHY=1)
        if name == 'IEF50': return W(CASH=.5, IEF=.5)
        if name == 'IEF100': return W(IEF=1)
        if name == 'GLD25': return W(CASH=.75, GLD=.25)
        if name == 'GLD50': return W(CASH=.5, GLD=.5)
        if name == 'DBC25': return W(CASH=.75, DBC=.25)
        if name == 'BARBELL_IEF25_GLD25': return W(CASH=.5, IEF=.25, GLD=.25)
        if name == 'DEFENSIVE_EQUAL': return W(IEF=.33, SHY=.34, GLD=.33)
        if name == 'RATE_IEF_OR_SHY': return W(IEF=.5, SHY=.5) if rd else W(SHY=1)
        if name == 'RATE_IEF_OR_GLD': return W(IEF=.5, CASH=.5) if rd else W(GLD=.25, CASH=.75)
        if name == 'MOM63_TOP1': return choose_top(d, 63, 1)
        if name == 'MOM126_TOP1': return choose_top(d, 126, 1)
        if name == 'MOM63_TOP2': return choose_top(d, 63, 2)
        if name == 'REBOUND_QQQ25': return W(CASH=.75, QQQ=.25) if crash_rebound(i, False) else W(CASH=1)
        if name == 'REBOUND_QQQ25_VIXFALL': return W(CASH=.75, QQQ=.25) if crash_rebound(i, True) else W(CASH=1)
        if name == 'REBOUND_QQQ50_VIXFALL': return W(CASH=.5, QQQ=.5) if crash_rebound(i, True) else W(CASH=1)
        if name == 'HYBRID':
            if rd: return W(CASH=.5, IEF=.5)
            if crash_rebound(i, True): return W(CASH=.75, QQQ=.25)
            return W(CASH=.75, GLD=.25)
        raise KeyError(name)

    names = ['CASH','SHY100','IEF50','IEF100','GLD25','GLD50','DBC25','BARBELL_IEF25_GLD25',
             'DEFENSIVE_EQUAL','RATE_IEF_OR_SHY','RATE_IEF_OR_GLD','MOM63_TOP1','MOM126_TOP1','MOM63_TOP2',
             'REBOUND_QQQ25','REBOUND_QQQ25_VIXFALL','REBOUND_QQQ50_VIXFALL','HYBRID']

    # precompute daily rows on common dates
    rows = []
    for d in common:
        i = idx[d]
        # prior short rate from signal universe, annualized simple daily cash approximation
        cash_r = (y3[i-1] / 100 / 252) if i > 0 and y3[i-1] is not None else 0.0
        ndx_r = nd[d] / nd[base_dates[i-1]] - 1 if i > 0 else 0.0
        rows.append((d, i, cash_r, ndx_r))

    def equity_return(st, ndx_r, cash_r):
        if st == 'TRIPOD':
            return 3 * ndx_r - 2 * cash_r - 0.0095 / 252
        if st in ('BIPOD','MONOPOD'):
            return 1.5 * ndx_r - 0.5 * cash_r - 0.00575 / 252
        return None

    strategy_returns, nopod_returns, weight_hist = {}, {}, {}
    for name in names:
        rr = []; nr = []; wh = []
        prevw = W(CASH=1.0)
        for d, i, cash_r, ndx_r in rows:
            st = exec_state[i]
            if st == 'NOPOD':
                w = weight(name, d)
                retmap = {'CASH': cash_r, **{s: er[s].get(d, 0.0) for s in px}}
                gross = sum(w[a] * retmap[a] for a in assets)
                turnover = 0.5 * sum(abs(w[a] - prevw[a]) for a in assets)
                r = gross - COST * turnover
                nr.append(r)
            else:
                w = W(CASH=1.0)
                r = equity_return(st, ndx_r, cash_r)
                # only charge exit turnover from NOPOD sleeve; equity reconstruction costs are embedded above
                if prevw != W(CASH=1.0):
                    turnover = 0.5 * sum(abs(w[a] - prevw[a]) for a in assets)
                    r -= COST * turnover
                nr.append(None)
            rr.append(r); wh.append(w); prevw = w
        strategy_returns[name] = rr; nopod_returns[name] = nr; weight_hist[name] = wh

    full = {n: metrics([x[0] for x in rows], strategy_returns[n]) for n in names}
    base = full['CASH']
    compare = {}
    for n, m in full.items():
        ratio = m['terminal_multiple'] / base['terminal_multiple']
        compare[n] = {
            'terminal_ratio_vs_cash': ratio,
            'ann_increment_vs_cash': ratio ** (1 / base['years']) - 1,
            'cagr_diff_pp': 100 * (m['cagr'] - base['cagr']),
            'mdd_diff_pp': 100 * (m['mdd'] - base['mdd']),
        }

    # episode robustness
    eps = []
    in_ep = False; start = None; inds = []
    for k, (d, i, *_rest) in enumerate(rows):
        is_n = exec_state[i] == 'NOPOD'
        if is_n and not in_ep:
            in_ep = True; start = d; inds = []
        if is_n:
            inds.append(k)
        if in_ep and (not is_n or k == len(rows)-1):
            end = rows[inds[-1]][0]
            eps.append((start, end, inds.copy()))
            in_ep = False
    robustness = {}
    for n in names:
        ex = []
        for a, b, js in eps:
            r1 = [nopod_returns[n][j] for j in js if nopod_returns[n][j] is not None]
            r0 = [nopod_returns['CASH'][j] for j in js if nopod_returns['CASH'][j] is not None]
            if r1 and r0:
                ex.append((a, b, compound(r1) - compound(r0)))
        vals = [x[2] for x in ex]
        robustness[n] = {
            'episodes': len(vals),
            'win_rate_vs_cash': sum(x > 0 for x in vals) / len(vals) if vals else None,
            'median_excess_episode': statistics.median(vals) if vals else None,
            'best_episode': max(ex, key=lambda x: x[2]) if ex else None,
            'worst_episode': min(ex, key=lambda x: x[2]) if ex else None,
        }

    # subperiods to expose regime concentration
    subs = {}
    for label, a, b in [('2006_2010','2006-01-01','2010-12-31'),('2011_2019','2011-01-01','2019-12-31'),('2020_PLUS','2020-01-01',None)]:
        ds = []; ind = []
        for j, (d, *_r) in enumerate(rows):
            if d < a: continue
            if b and d > b: continue
            ds.append(d); ind.append(j)
        subs[label] = {}
        for n in names:
            rs = [strategy_returns[n][j] for j in ind]
            subs[label][n] = metrics(ds, rs)

    result = {
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'method': 'Exploratory NOPOD sleeve alternatives on actual adjusted-close ETF samples. Same classical TRI-POD reconstruction and two-return-bar execution lag as prior study. 5bp one-way sleeve turnover. ETF sample common period only.',
        'sources': {
            'signals': ['FRED NASDAQ100','FRED VIXCLS','FRED DGS10','FRED DGS3MO'],
            'etfs': {s: SAMPLE_BASE + s + '.csv' for s in px},
        },
        'period': {'start': rows[0][0], 'end': rows[-1][0], 'days': len(rows), 'nopod_episodes': len(eps)},
        'full': full,
        'comparison': compare,
        'robustness': robustness,
        'subperiods': subs,
        'warning': 'Exploratory research, not optimized or production-approved. Common period is constrained by DBC sample history. CPI/real-yield vintage data are not used here; those require a separate study.'
    }
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')

    ranked = sorted(names, key=lambda n: compare[n]['ann_increment_vs_cash'], reverse=True)
    L = ['# TRI-POD NOPOD alternative sleeve study', '',
         f"Period: {result['period']['start']} ~ {result['period']['end']} | NOPOD episodes: {len(eps)}", '',
         '| Variant | CAGR | MDD | Ann incr vs CASH | Terminal vs CASH | Episode win | Median episode excess |',
         '|---|---:|---:|---:|---:|---:|---:|']
    for n in ranked:
        m = full[n]; c = compare[n]; rb = robustness[n]
        L.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {c['ann_increment_vs_cash']:.3%} | {c['terminal_ratio_vs_cash']:.3f}x | {rb['win_rate_vs_cash']:.1%} | {rb['median_excess_episode']:.2%} |")
    L += ['', '## Subperiod CAGR']
    for lab in ['2006_2010','2011_2019','2020_PLUS']:
        L += ['', f'### {lab}', '', '| Variant | CAGR | MDD |', '|---|---:|---:|']
        for n in ranked[:10]:
            m = subs[lab][n]
            L.append(f"| {n} | {m.get('cagr',0):.2%} | {m.get('mdd',0):.2%} |")
    OUT_MD.write_text('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
