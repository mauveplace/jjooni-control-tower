#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, math, statistics, urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HIST = ROOT / "market-observatory" / "data" / "history-30y.json"
OUT_DIR = ROOT / "research-output"
OUT_DIR.mkdir(exist_ok=True)
OUT_JSON = OUT_DIR / "tripod_bond_backtest.json"
OUT_MD = OUT_DIR / "tripod_bond_backtest.md"

COST_ONE_WAY = 0.0005


def load_map(series, key):
    out = {}
    for row in series.get(key, []):
        try:
            d = str(row["date"])
            v = float(row["value"])
            if math.isfinite(v):
                out[d] = v
        except Exception:
            pass
    return out


def ffill_on(dates, m):
    vals=[]; last=None
    for d in dates:
        if d in m: last=m[d]
        vals.append(last)
    return vals


def rolling_mean(xs, n, i):
    if i+1 < n: return None
    w=[x for x in xs[i-n+1:i+1] if x is not None]
    return sum(w)/len(w) if len(w)==n else None


def rolling_max(xs, n, i):
    if i+1 < n: return None
    w=[x for x in xs[i-n+1:i+1] if x is not None]
    return max(w) if len(w)==n else None


def compound(rs):
    w=1.0
    for r in rs:
        if r is None: continue
        w *= max(1e-12, 1.0+r)
    return w


def metrics(dates, rs):
    pairs=[(d,r) for d,r in zip(dates,rs) if r is not None]
    if not pairs: return {}
    ds=[p[0] for p in pairs]; rr=[p[1] for p in pairs]
    w=1.0; peak=1.0; mdd=0.0
    annual=defaultdict(list)
    downside=[]
    for d,r in pairs:
        w *= max(1e-12, 1+r)
        peak=max(peak,w); mdd=min(mdd,w/peak-1)
        annual[d[:4]].append(r)
        if r < 0: downside.append(r)
    years=max(1e-9, len(rr)/252.0)
    cagr=w**(1/years)-1
    avg=sum(rr)/len(rr)
    vol=(statistics.stdev(rr)*math.sqrt(252)) if len(rr)>1 else 0.0
    ddstd=(math.sqrt(sum(x*x for x in downside)/len(downside))*math.sqrt(252)) if downside else 0.0
    sortino=(avg*252/ddstd) if ddstd>0 else None
    annual_rets={y:compound(v)-1 for y,v in annual.items()}
    worst_year=min(annual_rets.items(), key=lambda kv: kv[1]) if annual_rets else (None,None)
    return {
        "start": ds[0], "end": ds[-1], "trading_days": len(rr), "years": years,
        "terminal_multiple": w, "cagr": cagr, "mdd": mdd, "ann_vol": vol,
        "sortino": sortino, "calmar": (cagr/abs(mdd) if mdd<0 else None),
        "worst_year": {"year": worst_year[0], "return": worst_year[1]},
    }


def subset(dates, rs, start=None, end=None):
    outd=[]; outr=[]
    for d,r in zip(dates,rs):
        if start and d < start: continue
        if end and d > end: continue
        outd.append(d); outr.append(r)
    return outd,outr


def fetch_public_tlt():
    url="https://raw.githubusercontent.com/revred/TradeSmart.Tracker/refs/heads/main/market/us/tlt.csv"
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 JJOONI-Research/1.0"})
    with urllib.request.urlopen(req,timeout=30) as r:
        txt=r.read().decode("utf-8-sig")
    out={}
    for row in csv.DictReader(io.StringIO(txt)):
        try: out[row["Date"]]=float(row["Close"])
        except Exception: pass
    return out,url


def pct(x):
    return None if x is None else round(100*x,4)


def main():
    h=json.loads(HIST.read_text(encoding="utf-8")); s=h["series"]
    ndx=load_map(s,"NASDAQ100"); vix=load_map(s,"VIX")
    us3=load_map(s,"US3M"); y10=load_map(s,"US10Y_OFFICIAL") or load_map(s,"US10Y")
    y30=load_map(s,"US30Y_OFFICIAL")
    dates=sorted(set(ndx)&set(vix))
    if not dates: raise RuntimeError("No NDX/VIX overlap")
    close=[ndx[d] for d in dates]; vx=[vix[d] for d in dates]
    r3=ffill_on(dates,us3); r10=ffill_on(dates,y10); r30=ffill_on(dates,y30)

    # Exact classical TRI-POD signal rules; signal at close, execution next close.
    regime=[]; state=[]; prev_reg=None
    for i,d in enumerate(dates):
        ma250=rolling_mean(close,250,i); v10=rolling_mean(vx,10,i); hi252=rolling_max(close,252,i)
        if ma250 is None or v10 is None or hi252 is None:
            regime.append(None); state.append(None); continue
        if close[i] > ma250*1.01: reg="UP"
        elif close[i] < ma250*0.95: reg="DOWN"
        else: reg=prev_reg
        if reg is None:
            reg="UP" if close[i] >= ma250 else "DOWN"
        prev_reg=reg; regime.append(reg)
        dd=close[i]/hi252-1
        if reg=="UP": st="TRIPOD" if (v10 < 28 and dd >= -0.09) else "BIPOD"
        else: st="MONOPOD" if v10 < 18 else "NOPOD"
        state.append(st)

    # Market and bond returns. 10Y/30Y proxies are constant-duration Treasury total-return approximations.
    ndxret=[None]*len(dates); cashret=[None]*len(dates); b10=[None]*len(dates); b30=[None]*len(dates)
    for i in range(1,len(dates)):
        ndxret[i]=close[i]/close[i-1]-1
        if r3[i-1] is not None: cashret[i]=(r3[i-1]/100)/252
        else: cashret[i]=0.0
        if r10[i] is not None and r10[i-1] is not None:
            dy=(r10[i]-r10[i-1])/100
            b10[i]=(r10[i-1]/100)/252 - 8.0*dy + 0.5*75.0*dy*dy
        if r30[i] is not None and r30[i-1] is not None:
            dy=(r30[i]-r30[i-1])/100
            b30[i]=(r30[i-1]/100)/252 - 15.5*dy + 0.5*260.0*dy*dy

    # Rate filters known at signal close. Generic, predeclared trend filters (no optimization).
    filt10=[False]*len(dates); filt_dual=[False]*len(dates)
    for i in range(len(dates)):
        ma=rolling_mean(r10,100,i) if r10[i] is not None else None
        ten20=(r10[i] is not None and i>=20 and r10[i-20] is not None and r10[i] < r10[i-20])
        ttrend=(ma is not None and r10[i] < ma and ten20)
        three20=(r3[i] is not None and i>=20 and r3[i-20] is not None and r3[i] < r3[i-20])
        filt10[i]=bool(ttrend); filt_dual[i]=bool(ttrend and three20)

    # Two-day shift for close-signal -> next-close execution -> following close-to-close return.
    exec_state=[None if i<2 else state[i-2] for i in range(len(dates))]
    exec_f10=[False if i<2 else filt10[i-2] for i in range(len(dates))]
    exec_fdual=[False if i<2 else filt_dual[i-2] for i in range(len(dates))]

    # Start only when signal + rates available.
    valid=[i for i in range(len(dates)) if exec_state[i] and ndxret[i] is not None and cashret[i] is not None and b10[i] is not None]
    start_i=valid[0]; dates2=dates[start_i:]
    exec_state=exec_state[start_i:]; exec_f10=exec_f10[start_i:]; exec_fdual=exec_fdual[start_i:]
    ndxret=ndxret[start_i:]; cashret=cashret[start_i:]; b10=b10[start_i:]; b30=b30[start_i:]

    # Reconstructed Max proxy: same equity side for every overlay, differing only in NOPOD sleeve.
    def equity_ret(st, i):
        rf=cashret[i] or 0.0; r=ndxret[i] or 0.0
        if st=="TRIPOD":
            return 3.0*r - 2.0*rf - 0.0095/252
        if st in ("BIPOD","MONOPOD"):
            return 1.5*r - 0.5*rf - 0.00575/252
        return None

    variants={
        "CASH": lambda i: (0.0,"cash"),
        "10Y_50_ALWAYS": lambda i: (0.5,"10y"),
        "10Y_100_ALWAYS": lambda i: (1.0,"10y"),
        "10Y_50_TREND": lambda i: (0.5 if exec_f10[i] else 0.0,"10y"),
        "10Y_100_TREND": lambda i: (1.0 if exec_f10[i] else 0.0,"10y"),
        "10Y_50_DUAL": lambda i: (0.5 if exec_fdual[i] else 0.0,"10y"),
        "10Y_100_DUAL": lambda i: (1.0 if exec_fdual[i] else 0.0,"10y"),
        "30Y_25_TREND": lambda i: (0.25 if exec_f10[i] else 0.0,"30y"),
        "30Y_50_TREND": lambda i: (0.5 if exec_f10[i] else 0.0,"30y"),
    }
    strat={}; sleeve={}; bond_weights={}
    for name,alloc_fn in variants.items():
        rr=[]; sr=[]; ws=[]; prev_w=0.0
        for i,st in enumerate(exec_state):
            if st!="NOPOD":
                rr.append(equity_ret(st,i)); sr.append(None); w=0.0
            else:
                w,kind=alloc_fn(i)
                br=(b10[i] if kind=="10y" else b30[i])
                if br is None: w=0.0; br=0.0
                r=(1-w)*(cashret[i] or 0.0)+w*br
                # Differential bond-turnover cost, including NOPOD entry/exit allocation changes.
                r -= COST_ONE_WAY*abs(w-prev_w)
                rr.append(r); sr.append(r); ws.append(w)
            # Charge exit of bond sleeve when state leaves NOPOD on that day's strategy return.
            if st!="NOPOD" and prev_w>0 and rr[-1] is not None:
                rr[-1] -= COST_ONE_WAY*prev_w
            prev_w=w
            if st!="NOPOD": ws.append(0.0)
        strat[name]=rr; sleeve[name]=sr; bond_weights[name]=ws

    # NOPOD episode stats.
    episodes=[]; cur=None
    for i,st in enumerate(exec_state):
        if st=="NOPOD" and cur is None: cur=[i,i]
        elif st=="NOPOD": cur[1]=i
        elif cur is not None:
            episodes.append(cur); cur=None
    if cur is not None: episodes.append(cur)

    full={name:metrics(dates2,rr) for name,rr in strat.items()}
    splits={}
    for label,a,b in [("EARLY","1997-01-01","2010-12-31"),("LATE","2011-01-01",None),("POST2020","2020-01-01",None)]:
        splits[label]={}
        for name,rr in strat.items():
            dd,xx=subset(dates2,rr,a,b); splits[label][name]=metrics(dd,xx)

    baseline=full["CASH"]
    comparisons={}
    for name,m in full.items():
        if not m or not baseline: continue
        ratio=m["terminal_multiple"]/baseline["terminal_multiple"]
        comparisons[name]={
            "terminal_ratio_vs_cash":ratio,
            "annualized_increment_vs_cash":ratio**(1/baseline["years"])-1,
            "cagr_diff_pp":100*(m["cagr"]-baseline["cagr"]),
            "mdd_diff_pp":100*(m["mdd"]-baseline["mdd"]),
        }

    # Actual TLT robustness check on available public adjusted-close-like history.
    actual={"available":False}
    try:
        tlt,tlt_url=fetch_public_tlt(); actual["source"]=tlt_url
        tdates=[d for d in dates2 if d in tlt]
        if len(tdates)>100:
            idx={d:i for i,d in enumerate(dates2)}
            tltret={}; prev=None
            for d in tdates:
                if prev is not None: tltret[d]=tlt[d]/tlt[prev]-1
                prev=d
            acts={}
            for name,wbase,flt in [("TLT_50_ALWAYS",0.5,"always"),("TLT_100_ALWAYS",1.0,"always"),("TLT_50_TREND",0.5,"trend"),("TLT_100_TREND",1.0,"trend")]:
                rr=[]; dd=[]; prevw=0.0
                for d in tdates:
                    i=idx[d]; st=exec_state[i]; r=None
                    if d not in tltret: continue
                    if st!="NOPOD":
                        r=equity_ret(st,i); w=0.0
                        if prevw>0: r-=COST_ONE_WAY*prevw
                    else:
                        on=(flt=="always" or exec_f10[i]); w=wbase if on else 0.0
                        r=(1-w)*(cashret[i] or 0.0)+w*tltret[d]-COST_ONE_WAY*abs(w-prevw)
                    prevw=w; dd.append(d); rr.append(r)
                acts[name]=metrics(dd,rr)
            # same-period synthetic cash baseline
            rr=[]; dd=[]
            for d in tdates[1:]:
                i=idx[d]; st=exec_state[i]
                rr.append((cashret[i] or 0.0) if st=="NOPOD" else equity_ret(st,i)); dd.append(d)
            acts["CASH"]=metrics(dd,rr)
            base=acts["CASH"]
            for n,m in acts.items():
                if n=="CASH" or not m: continue
                ratio=m["terminal_multiple"]/base["terminal_multiple"]
                m["annualized_increment_vs_cash"]=ratio**(1/base["years"])-1
                m["cagr_diff_pp"]=100*(m["cagr"]-base["cagr"])
                m["mdd_diff_pp"]=100*(m["mdd"]-base["mdd"])
            actual.update({"available":True,"start":tdates[0],"end":tdates[-1],"variants":acts})
    except Exception as e:
        actual["error"]=repr(e)

    # NOPOD-only episode outcome table for cash vs selected sleeves.
    ep_rows=[]
    for a,b in episodes:
        row={"start":dates2[a],"end":dates2[b],"trading_days":b-a+1}
        for n in ["CASH","10Y_50_TREND","10Y_100_TREND","10Y_50_ALWAYS","30Y_25_TREND","30Y_50_TREND"]:
            vals=[strat[n][j] for j in range(a,b+1)]
            row[n]=compound(vals)-1
        ep_rows.append(row)

    diagnostics={
        "history_schema":h.get("schema"),"history_generated_kst":h.get("generated_kst"),
        "series":{},"test_start":dates2[0],"test_end":dates2[-1],
        "nopod_days":sum(1 for x in exec_state if x=="NOPOD"),"nopod_episodes":len(episodes),
        "nopod_share":sum(1 for x in exec_state if x=="NOPOD")/len(exec_state),
        "trend_on_nopod_days":sum(1 for i,x in enumerate(exec_state) if x=="NOPOD" and exec_f10[i]),
        "dual_on_nopod_days":sum(1 for i,x in enumerate(exec_state) if x=="NOPOD" and exec_fdual[i]),
    }
    for k,m in [("NASDAQ100",ndx),("VIX",vix),("US3M",us3),("US10Y_OFFICIAL",y10),("US30Y_OFFICIAL",y30)]:
        ks=sorted(m); diagnostics["series"][k]={"count":len(ks),"oldest":ks[0] if ks else None,"latest":ks[-1] if ks else None}

    result={
        "generated_utc":datetime.utcnow().isoformat(timespec="seconds")+"Z",
        "methodology":{
            "tripod_rules":"NDX MA250 hysteresis 1.01/0.95; VIX10 thresholds 28/18; 52w drawdown 9%; close signal, next-close execution (2-bar return lag)",
            "cash":"US3M yield / 252",
            "bond10_proxy":"constant-duration Treasury proxy: carry y/252 - 8*delta_y + 0.5*75*delta_y^2",
            "bond30_proxy":"constant-duration Treasury proxy: carry y/252 - 15.5*delta_y + 0.5*260*delta_y^2",
            "rate_trend":"DGS10 below 100-trading-day MA AND below its level 20 trading days earlier",
            "dual_filter":"rate_trend AND US3M below its level 20 trading days earlier",
            "bond_turnover_cost_one_way":COST_ONE_WAY,
            "note":"Absolute reconstructed TRI-POD Max is a proxy; overlay-vs-cash deltas are the primary inference. Synthetic bond proxies are not actual ETF total returns.",
        },
        "diagnostics":diagnostics,"full_period":full,"comparisons":comparisons,"splits":splits,"actual_tlt":actual,"episodes":ep_rows,
    }
    OUT_JSON.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    lines=["# TRI-POD NOPOD Bond Overlay Backtest","",f"Period: {dates2[0]} ~ {dates2[-1]}",f"NOPOD: {diagnostics['nopod_days']} trading days / {diagnostics['nopod_episodes']} episodes ({diagnostics['nopod_share']:.1%})","", "## Full-period reconstructed Max proxy", "", "| Variant | CAGR | MDD | Terminal vs CASH | Ann. incr. vs CASH |", "|---|---:|---:|---:|---:|"]
    for n in variants:
        m=full[n]; c=comparisons[n]
        lines.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {c['terminal_ratio_vs_cash']:.3f}x | {c['annualized_increment_vs_cash']:.3%} |")
    lines += ["", "## NOPOD episodes", "", "| Start | End | Days | CASH | 10Y50 trend | 10Y100 trend | 10Y50 always | 30Y25 trend | 30Y50 trend |", "|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in ep_rows:
        lines.append(f"| {r['start']} | {r['end']} | {r['trading_days']} | {r['CASH']:.2%} | {r['10Y_50_TREND']:.2%} | {r['10Y_100_TREND']:.2%} | {r['10Y_50_ALWAYS']:.2%} | {r['30Y_25_TREND']:.2%} | {r['30Y_50_TREND']:.2%} |")
    if actual.get("available"):
        lines += ["",f"## Actual TLT robustness ({actual['start']} ~ {actual['end']})","", "| Variant | CAGR | MDD | Ann. incr. vs CASH |", "|---|---:|---:|---:|"]
        for n,m in actual["variants"].items():
            incr=m.get("annualized_increment_vs_cash")
            lines.append(f"| {n} | {m['cagr']:.2%} | {m['mdd']:.2%} | {'' if incr is None else f'{incr:.3%}'} |")
    OUT_MD.write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(OUT_MD.read_text(encoding="utf-8"))

if __name__=="__main__": main()
