#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "market-observatory" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUT = DATA_DIR / "official-macro.json"
VINT = DATA_DIR / "official-macro-vintages.json"
CAL = DATA_DIR / "economic-calendar.json"
FEDWATCH = DATA_DIR / "fed-watch.json"
KST = ZoneInfo("Asia/Seoul")
UA = "Mozilla/5.0 JJOONI-Official-Macro/1.0"

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
FRED_SOURCE = "Federal Reserve Bank of St. Louis FRED transport"

US_DEF = {
    "US_CPI": {"series": "CPIAUCSL", "institution": "BLS", "name": "CPI", "group": "inflation", "kind": "monthly_index", "target": 2.0},
    "US_CORE_CPI": {"series": "CPILFESL", "institution": "BLS", "name": "Core CPI", "group": "inflation", "kind": "monthly_index", "target": 2.0},
    "US_PCE": {"series": "PCEPI", "institution": "BEA", "name": "PCE", "group": "inflation", "kind": "monthly_index", "target": 2.0},
    "US_CORE_PCE": {"series": "PCEPILFE", "institution": "BEA", "name": "Core PCE", "group": "inflation", "kind": "monthly_index", "target": 2.0},
    "US_NFP": {"series": "PAYEMS", "institution": "BLS", "name": "Nonfarm Payrolls", "group": "labor", "kind": "monthly_change", "unit": "K"},
    "US_UNEMPLOYMENT": {"series": "UNRATE", "institution": "BLS", "name": "Unemployment Rate", "group": "labor", "kind": "level", "unit": "%"},
    "US_AHE": {"series": "CES0500000003", "institution": "BLS", "name": "Average Hourly Earnings", "group": "labor", "kind": "monthly_index", "unit": "$/hour"},
    "US_JOLTS": {"series": "JTSJOL", "institution": "BLS", "name": "JOLTS Openings", "group": "labor", "kind": "level", "unit": "K"},
    "US_ECI": {"series": "ECIWAG", "institution": "BLS", "name": "Employment Cost Index", "group": "labor", "kind": "quarterly_index"},
    "US_GDP": {"series": "A191RL1Q225SBEA", "institution": "BEA", "name": "Real GDP", "group": "growth", "kind": "direct", "unit": "% SAAR"},
}

CONSENSUS_ALIASES = {
    "US_CPI": ["cpi", "consumer price index", "headline cpi"],
    "US_CORE_CPI": ["core cpi", "cpi core"],
    "US_PCE": ["pce", "pce price"],
    "US_CORE_PCE": ["core pce", "pce core"],
    "US_NFP": ["nfp", "nonfarm", "non-farm", "payroll"],
    "US_UNEMPLOYMENT": ["unemployment", "실업률"],
    "US_AHE": ["average hourly", "hourly earnings", "임금"],
    "US_JOLTS": ["jolts", "job openings"],
    "US_ECI": ["employment cost", "eci"],
    "US_GDP": ["gdp", "gross domestic product"],
    "US_FED_FUNDS": ["fed rate", "fomc", "federal funds"],
    "KR_CPI": ["소비자물가", "cpi"],
    "KR_GDP": ["gdp", "국내총생산"],
    "KR_BASE_RATE": ["기준금리", "통화정책"],
}


def now_kst() -> datetime:
    return datetime.now(KST)


def req_text(url: str, timeout: int = 25) -> str:
    r = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/csv,application/json,*/*"})
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return resp.read().decode("utf-8-sig", "replace")


def req_json(url: str, timeout: int = 25):
    return json.loads(req_text(url, timeout=timeout))


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v) if math.isfinite(float(v)) else None
    s = str(v).strip().replace(",", "")
    m = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        x = float(m.group())
        return x if math.isfinite(x) else None
    except Exception:
        return None


def r4(v):
    return None if v is None else round(float(v), 4)


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def fred_series(series_id: str, start: str) -> list[dict]:
    qs = urllib.parse.urlencode({"id": series_id, "cosd": start})
    txt = req_text(FRED_CSV + "?" + qs)
    rows = []
    for row in csv.DictReader(io.StringIO(txt)):
        d = row.get("DATE") or row.get("observation_date") or row.get("date")
        v = row.get(series_id) or row.get("value")
        x = num(v)
        if not d or x is None:
            continue
        rows.append({"date": str(d)[:10], "value": x})
    return rows


def pct(a, b):
    if a is None or b in (None, 0):
        return None
    return (a / b - 1.0) * 100.0


def annualized(a, b, periods_per_year: float):
    if a is None or b in (None, 0):
        return None
    return ((a / b) ** periods_per_year - 1.0) * 100.0


def monthly_index_history(rows: list[dict]) -> list[dict]:
    out = []
    vals = [x["value"] for x in rows]
    for i, row in enumerate(rows):
        v = vals[i]
        out.append({
            "period": row["date"],
            "raw": r4(v),
            "value": r4(pct(v, vals[i - 12])) if i >= 12 else None,
            "yoy": r4(pct(v, vals[i - 12])) if i >= 12 else None,
            "mom": r4(pct(v, vals[i - 1])) if i >= 1 else None,
            "ann_3m": r4(annualized(v, vals[i - 3], 4.0)) if i >= 3 else None,
            "ann_6m": r4(annualized(v, vals[i - 6], 2.0)) if i >= 6 else None,
        })
    return out


def quarterly_index_history(rows: list[dict]) -> list[dict]:
    out = []
    vals = [x["value"] for x in rows]
    for i, row in enumerate(rows):
        v = vals[i]
        out.append({
            "period": row["date"],
            "raw": r4(v),
            "value": r4(pct(v, vals[i - 4])) if i >= 4 else None,
            "yoy": r4(pct(v, vals[i - 4])) if i >= 4 else None,
            "qoq": r4(pct(v, vals[i - 1])) if i >= 1 else None,
        })
    return out


def monthly_change_history(rows: list[dict]) -> list[dict]:
    out = []
    vals = [x["value"] for x in rows]
    for i, row in enumerate(rows):
        ch = vals[i] - vals[i - 1] if i >= 1 else None
        recent3 = [(vals[j] - vals[j - 1]) for j in range(max(1, i - 2), i + 1)]
        recent6 = [(vals[j] - vals[j - 1]) for j in range(max(1, i - 5), i + 1)]
        out.append({
            "period": row["date"],
            "raw": r4(vals[i]),
            "value": r4(ch),
            "avg_3m": r4(sum(recent3) / len(recent3)) if recent3 else None,
            "avg_6m": r4(sum(recent6) / len(recent6)) if recent6 else None,
        })
    return out


def level_history(rows: list[dict]) -> list[dict]:
    out = []
    vals = [x["value"] for x in rows]
    for i, row in enumerate(rows):
        recent3 = vals[max(0, i - 2): i + 1]
        recent6 = vals[max(0, i - 5): i + 1]
        out.append({
            "period": row["date"],
            "raw": r4(vals[i]),
            "value": r4(vals[i]),
            "avg_3m": r4(sum(recent3) / len(recent3)) if recent3 else None,
            "avg_6m": r4(sum(recent6) / len(recent6)) if recent6 else None,
            "yoy_change": r4(vals[i] - vals[i - 12]) if i >= 12 else None,
        })
    return out


def direct_history(rows: list[dict]) -> list[dict]:
    return [{"period": x["date"], "raw": r4(x["value"]), "value": r4(x["value"])} for x in rows]


def metric_history(kind: str, rows: list[dict]) -> list[dict]:
    if kind == "monthly_index":
        return monthly_index_history(rows)
    if kind == "quarterly_index":
        return quarterly_index_history(rows)
    if kind == "monthly_change":
        return monthly_change_history(rows)
    if kind == "level":
        return level_history(rows)
    return direct_history(rows)


def latest_non_null(hist: list[dict], key: str = "value"):
    for x in reversed(hist):
        if x.get(key) is not None:
            return x
    return None


def calendar_consensus(metric_key: str, calendar: dict):
    aliases = [a.lower() for a in CONSENSUS_ALIASES.get(metric_key, [])]
    if not aliases:
        return None
    candidates = []
    for e in calendar.get("events", []):
        title = str(e.get("title") or "")
        event_text = (title + " " + str(e.get("category") or "")).lower()
        dt = str(e.get("datetime_kst") or e.get("date") or "")
        for m in e.get("market_metrics", []) or []:
            text = (str(m.get("key") or "") + " " + str(m.get("label") or "") + " " + event_text).lower()
            if any(a in text for a in aliases):
                candidates.append((dt, {
                    "previous": m.get("previous"),
                    "consensus": m.get("consensus"),
                    "calendar_actual": m.get("actual"),
                    "event": title,
                    "event_kst": dt,
                    "source": e.get("market_data_source") or e.get("source") or "economic-calendar",
                }))
        if any(a in event_text for a in aliases):
            candidates.append((dt, {
                "previous": e.get("previous"),
                "consensus": e.get("consensus"),
                "calendar_actual": e.get("actual"),
                "event": title,
                "event_kst": dt,
                "source": e.get("market_data_source") or e.get("source") or "economic-calendar",
            }))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    non_empty = [x for x in candidates if x[1].get("consensus") not in (None, "")]
    return (non_empty or candidates)[-1][1]


def release_value(metric_key: str, latest: dict):
    if not latest:
        return None, None
    if metric_key in {"US_CPI", "US_CORE_CPI", "US_PCE", "US_CORE_PCE", "US_AHE"}:
        return latest.get("mom"), "MoM %"
    if metric_key == "US_ECI":
        return latest.get("qoq"), "QoQ %"
    return latest.get("value"), None


def metric_payload(metric_key: str, cfg: dict, rows: list[dict], calendar: dict):
    hist = metric_history(cfg["kind"], rows)
    cutoff = (date.today() - timedelta(days=3653 + 400)).isoformat()
    hist = [x for x in hist if x["period"] >= cutoff]
    latest = latest_non_null(hist)
    prev = None
    if latest:
        idx = hist.index(latest)
        for x in reversed(hist[:idx]):
            if x.get("value") is not None:
                prev = x
                break
    rel_actual, rel_measure = release_value(metric_key, latest or {})
    cc = calendar_consensus(metric_key, calendar) or {}
    consensus = num(cc.get("consensus"))
    surprise = None if rel_actual is None or consensus is None else r4(rel_actual - consensus)
    source_url = f"https://fred.stlouisfed.org/series/{cfg['series']}"
    transport = {
        "provider": FRED_SOURCE,
        "series_id": cfg["series"],
        "url": source_url,
    }
    primary = {
        "institution": cfg["institution"],
        "name": {"BLS": "U.S. Bureau of Labor Statistics", "BEA": "U.S. Bureau of Economic Analysis", "FED": "Federal Reserve"}.get(cfg["institution"], cfg["institution"]),
    }
    out = {
        "key": metric_key,
        "name": cfg["name"],
        "country": "US",
        "group": cfg["group"],
        "frequency": "quarterly" if cfg["kind"] == "quarterly_index" or metric_key == "US_GDP" else "monthly",
        "unit": cfg.get("unit") or ("%" if cfg["kind"] in {"monthly_index", "quarterly_index"} else None),
        "primary_source": primary,
        "transport_source": transport,
        "latest": latest,
        "previous_period": prev,
        "release": {
            "actual": r4(rel_actual),
            "measure": rel_measure or cfg.get("unit"),
            "previous": r4(release_value(metric_key, prev or {})[0]) if prev else None,
            "consensus": r4(consensus),
            "surprise": surprise,
            "consensus_source": {
                "provider": cc.get("source") if cc else None,
                "event": cc.get("event") if cc else None,
                "event_kst": cc.get("event_kst") if cc else None,
                "contract": "MARKET_CONSENSUS_SEPARATE_FROM_OFFICIAL_ACTUAL",
            },
        },
        "target": cfg.get("target"),
        "history": hist,
        "status": "LIVE" if latest else "DEGRADED",
    }
    return out


def build_us(calendar: dict):
    start = (date.today() - timedelta(days=3653 + 500)).isoformat()
    metrics = {}
    errors = {}
    for key, cfg in US_DEF.items():
        try:
            rows = fred_series(cfg["series"], start)
            if not rows:
                raise RuntimeError("empty series")
            metrics[key] = metric_payload(key, cfg, rows, calendar)
        except Exception as e:
            errors[key] = str(e)
            metrics[key] = {
                "key": key, "name": cfg["name"], "country": "US", "group": cfg["group"],
                "primary_source": {"institution": cfg["institution"]},
                "transport_source": {"provider": FRED_SOURCE, "series_id": cfg["series"]},
                "history": [], "latest": None, "status": "DEGRADED", "error": str(e),
            }

    try:
        lower = fred_series("DFEDTARL", start)
        upper = fred_series("DFEDTARU", start)
        lm = {x["date"]: x["value"] for x in lower}
        um = {x["date"]: x["value"] for x in upper}
        dates = sorted(set(lm) & set(um))
        hist = [{"period": d, "lower": r4(lm[d]), "upper": r4(um[d]), "value": r4((lm[d] + um[d]) / 2.0), "raw": r4((lm[d] + um[d]) / 2.0)} for d in dates]
        latest = latest_non_null(hist)
        cc = calendar_consensus("US_FED_FUNDS", calendar) or {}
        metrics["US_FED_FUNDS"] = {
            "key": "US_FED_FUNDS", "name": "Fed Funds Target Range", "country": "US", "group": "fed",
            "frequency": "FOMC", "unit": "%", "history": hist, "latest": latest,
            "release": {
                "actual": latest.get("value") if latest else None,
                "measure": "target midpoint %",
                "previous": hist[-2].get("value") if len(hist) > 1 else None,
                "consensus": r4(num(cc.get("consensus"))),
                "surprise": None,
                "consensus_source": {"provider": cc.get("source"), "event": cc.get("event"), "contract": "MARKET_CONSENSUS_SEPARATE_FROM_OFFICIAL_ACTUAL"},
            },
            "primary_source": {"institution": "FED", "name": "Federal Reserve"},
            "transport_source": {"provider": FRED_SOURCE, "series_id": "DFEDTARL / DFEDTARU", "url": "https://fred.stlouisfed.org/series/DFEDTARU"},
            "status": "LIVE" if latest else "DEGRADED",
        }
    except Exception as e:
        errors["US_FED_FUNDS"] = str(e)

    metrics["US_SEP_DOT_PLOT"] = {
        "key": "US_SEP_DOT_PLOT", "name": "SEP / Dot Plot", "country": "US", "group": "fed",
        "frequency": "quarterly FOMC", "status": "SOURCE_PENDING",
        "primary_source": {"institution": "FED", "name": "Federal Reserve"},
        "note": "Fed SEP/Dot Plot is retained as an explicit official-source slot. Structured extraction is not fabricated; latest official values require a dedicated SEP parser.",
        "history": [],
    }
    return metrics, errors


def ecos_url(key: str, service: str, *parts) -> str:
    esc = [urllib.parse.quote(str(x), safe="") for x in parts]
    return "https://ecos.bok.or.kr/api/" + service + "/" + key + "/json/kr/" + "/".join(esc)


def ecos_search(key: str, stat: str, cycle: str, start: str, end: str, item1: str, item2: str | None = None):
    parts = ["1", "10000", stat, cycle, start, end, item1]
    if item2:
        parts.append(item2)
    obj = req_json(ecos_url(key, "StatisticSearch", *parts))
    rows = ((obj.get("StatisticSearch") or {}).get("row") or [])
    out = []
    for r in rows:
        v = num(r.get("DATA_VALUE"))
        if v is None:
            continue
        t = str(r.get("TIME") or "")
        if cycle == "D" and len(t) == 8:
            p = f"{t[:4]}-{t[4:6]}-{t[6:8]}"
        elif cycle == "M" and len(t) == 6:
            p = f"{t[:4]}-{t[4:6]}-01"
        elif cycle == "Q":
            m = re.match(r"(\d{4})Q([1-4])", t)
            p = f"{m.group(1)}-{(int(m.group(2))-1)*3+1:02d}-01" if m else t
        else:
            p = t
        out.append({"date": p, "value": v})
    return sorted(out, key=lambda x: x["date"])


def ecos_items(key: str, stat: str):
    obj = req_json(ecos_url(key, "StatisticItemList", "1", "10000", stat))
    return ((obj.get("StatisticItemList") or {}).get("row") or [])


def find_ecos_item(key: str, stat: str, terms: list[str]):
    try:
        rows = ecos_items(key, stat)
    except Exception:
        return None
    scored = []
    for r in rows:
        name = " ".join(str(r.get(k) or "") for k in ["ITEM_NAME", "ITEM_NAME1", "ITEM_NAME2", "STAT_NAME"]).lower()
        score = sum(1 for term in terms if term.lower() in name)
        code = r.get("ITEM_CODE") or r.get("ITEM_CODE1")
        if score and code:
            scored.append((score, str(code), name))
    scored.sort(reverse=True)
    return scored[0][1] if scored else None


def build_kr(calendar: dict):
    key = os.getenv("BOK_ECOS_API_KEY", "sample")
    start_m = f"{date.today().year - 11}01"
    end_m = now_kst().strftime("%Y%m")
    start_d = f"{date.today().year - 11}0101"
    end_d = now_kst().strftime("%Y%m%d")
    start_q = f"{date.today().year - 11}Q1"
    end_q = f"{date.today().year}Q4"
    metrics = {}
    errors = {}

    def make_metric(metric_key, name, group, institution, rows, kind, unit=None, target=None, transport_note=None):
        hist = metric_history(kind, rows)
        latest = latest_non_null(hist)
        prev = None
        if latest:
            i = hist.index(latest)
            prev = latest_non_null(hist[:i])
        cc = calendar_consensus(metric_key, calendar) or {}
        rel_actual = latest.get("value") if latest else None
        consensus = num(cc.get("consensus"))
        return {
            "key": metric_key, "name": name, "country": "KR", "group": group,
            "frequency": "daily" if metric_key == "KR_BASE_RATE" else ("quarterly" if metric_key == "KR_GDP" else "monthly"),
            "unit": unit, "target": target, "history": hist, "latest": latest, "previous_period": prev,
            "release": {
                "actual": r4(rel_actual), "measure": unit,
                "previous": r4(prev.get("value")) if prev else None,
                "consensus": r4(consensus),
                "surprise": None if rel_actual is None or consensus is None else r4(rel_actual - consensus),
                "consensus_source": {"provider": cc.get("source"), "event": cc.get("event"), "contract": "MARKET_CONSENSUS_SEPARATE_FROM_OFFICIAL_ACTUAL"},
            },
            "primary_source": {"institution": institution, "name": {"BOK": "한국은행", "KOSTAT": "통계청"}.get(institution, institution)},
            "transport_source": {"provider": "BOK ECOS official API", "note": transport_note},
            "status": "LIVE" if latest else "DEGRADED",
        }

    try:
        rows = ecos_search(key, "722Y001", "D", start_d, end_d, "0101000")
        metrics["KR_BASE_RATE"] = make_metric("KR_BASE_RATE", "한국 기준금리", "policy", "BOK", rows, "level", "%")
    except Exception as e:
        errors["KR_BASE_RATE"] = str(e)

    try:
        rows = ecos_search(key, "901Y009", "M", start_m, end_m, "0")
        metrics["KR_CPI"] = make_metric("KR_CPI", "CPI", "inflation", "KOSTAT", rows, "monthly_index", "%", 2.0, "KOSTAT series republished through BOK ECOS")
    except Exception as e:
        errors["KR_CPI"] = str(e)

    core_item = find_ecos_item(key, "901Y009", ["식료품", "에너지", "제외"])
    if not core_item:
        core_item = find_ecos_item(key, "901Y009", ["농산물", "석유류", "제외"])
    if core_item:
        try:
            rows = ecos_search(key, "901Y009", "M", start_m, end_m, core_item)
            metrics["KR_CORE_CPI"] = make_metric("KR_CORE_CPI", "Core CPI", "inflation", "KOSTAT", rows, "monthly_index", "%", 2.0, f"ECOS item {core_item}")
        except Exception as e:
            errors["KR_CORE_CPI"] = str(e)

    try:
        rows = ecos_search(key, "200Y002", "Q", start_q, end_q, "10111")
        metrics["KR_GDP"] = make_metric("KR_GDP", "Real GDP Growth", "growth", "BOK", rows, "direct", "% QoQ SA")
    except Exception as e:
        errors["KR_GDP"] = str(e)

    ca_item = find_ecos_item(key, "301Y017", ["경상수지"])
    if ca_item:
        try:
            rows = ecos_search(key, "301Y017", "M", start_m, end_m, ca_item)
            metrics["KR_CURRENT_ACCOUNT"] = make_metric("KR_CURRENT_ACCOUNT", "경상수지", "external", "BOK", rows, "level", "USD million", None, f"ECOS item {ca_item}")
        except Exception as e:
            errors["KR_CURRENT_ACCOUNT"] = str(e)

    pending = {
        "KR_BOK_OUTLOOK": ("한국은행 경제전망", "growth", "BOK", "Structured forecast table parser pending"),
        "KR_EXPORT_YOY": ("수출 YoY", "exports", "KCS/MOTIE", "Official customs/industry structured series connector pending"),
        "KR_SEMICON_EXPORT_YOY": ("반도체 수출 YoY", "exports", "KCS/MOTIE", "Official semiconductor export structured series connector pending"),
        "KR_EXPORT_1_20": ("1~20일 수출", "exports", "KCS", "Official early-month customs series connector pending"),
        "KR_EMPLOYMENT": ("고용", "labor", "KOSTAT", "KOSTAT official structured series connector pending"),
        "KR_INDUSTRIAL_PRODUCTION": ("산업생산", "growth", "KOSTAT", "KOSTAT official structured series connector pending"),
    }
    for k, (name, group, institution, note) in pending.items():
        if k not in metrics:
            metrics[k] = {
                "key": k, "name": name, "country": "KR", "group": group, "status": "SOURCE_PENDING",
                "primary_source": {"institution": institution}, "history": [], "latest": None, "note": note,
            }
    return metrics, errors


def group_regimes(metrics: dict):
    def m(key, field="value"):
        x = (metrics.get(key) or {}).get("latest") or {}
        return num(x.get(field))

    us_core_pce_yoy = m("US_CORE_PCE", "yoy")
    us_core_pce_3m = m("US_CORE_PCE", "ann_3m")
    if us_core_pce_yoy is None:
        us_infl = ("GRAY", "DATA_PENDING")
    elif us_core_pce_3m is not None and us_core_pce_3m > us_core_pce_yoy + 0.25:
        us_infl = ("RED", "ACCELERATING")
    elif us_core_pce_yoy > 2.5:
        us_infl = ("ORANGE", "STICKY")
    else:
        us_infl = ("GREEN", "COOLING")

    nfp3, nfp6 = m("US_NFP", "avg_3m"), m("US_NFP", "avg_6m")
    unemp = m("US_UNEMPLOYMENT")
    if nfp3 is None:
        us_labor = ("GRAY", "DATA_PENDING")
    elif nfp6 is not None and nfp3 < nfp6:
        us_labor = ("GREEN", "COOLING")
    elif unemp is not None and unemp < 4.0 and nfp3 > 200:
        us_labor = ("RED", "TIGHT")
    else:
        us_labor = ("ORANGE", "BALANCING")

    gdp = m("US_GDP")
    us_growth = ("GRAY", "DATA_PENDING") if gdp is None else (("GREEN", "EXPANDING") if gdp > 1.0 else (("RED", "CONTRACTING") if gdp < 0 else ("ORANGE", "SLOWING")))
    fed_mid = m("US_FED_FUNDS")
    us_fed = ("GRAY", "DATA_PENDING") if fed_mid is None else (("RED", "RESTRICTIVE") if fed_mid >= 4.0 else (("ORANGE", "MODERATELY_RESTRICTIVE") if fed_mid >= 3.0 else ("GREEN", "EASING")))

    kr_cpi = m("KR_CPI", "yoy")
    kr_cpi3 = m("KR_CPI", "ann_3m")
    if kr_cpi is None:
        kr_infl = ("GRAY", "DATA_PENDING")
    elif kr_cpi3 is not None and kr_cpi3 > kr_cpi + 0.25:
        kr_infl = ("RED", "ACCELERATING")
    elif kr_cpi > 2.5:
        kr_infl = ("ORANGE", "ABOVE_TARGET")
    else:
        kr_infl = ("GREEN", "NEAR_TARGET")

    kr_gdp = m("KR_GDP")
    kr_growth = ("GRAY", "DATA_PENDING") if kr_gdp is None else (("GREEN", "EXPANDING") if kr_gdp > 0 else ("RED", "CONTRACTING"))
    export_live = (metrics.get("KR_EXPORT_YOY") or {}).get("status") == "LIVE"
    semi_live = (metrics.get("KR_SEMICON_EXPORT_YOY") or {}).get("status") == "LIVE"

    def block(pair, why):
        return {"color": pair[0], "regime": pair[1], "why": why}

    return {
        "us": {
            "inflation": block(us_infl, "Core PCE YoY와 최근 3개월 연율 비교"),
            "labor": block(us_labor, "NFP 3개월/6개월 평균과 실업률"),
            "growth": block(us_growth, "실질 GDP 전기비 연율"),
            "fed": block(us_fed, "Fed Funds 목표범위 중간값"),
        },
        "kr": {
            "inflation": block(kr_infl, "CPI YoY와 최근 3개월 연율 비교"),
            "growth": block(kr_growth, "실질 GDP 전기비"),
            "exports": {"color": "GRAY", "regime": "SOURCE_PENDING" if not export_live else "LIVE", "why": "관세청/산업부 공식 수출 시계열"},
            "semiconductor": {"color": "GRAY", "regime": "SOURCE_PENDING" if not semi_live else "LIVE", "why": "관세청/산업부 반도체 수출 시계열"},
        },
    }


def portfolio_context(regimes: dict):
    usi = regimes["us"]["inflation"]["regime"]
    labor = regimes["us"]["labor"]["regime"]
    notes = []
    if usi in {"ACCELERATING", "STICKY"}:
        notes.append({"feature": "US_INFLATION_PRESSURE", "effect": "금리 민감 성장주/레버리지에 부담 요인", "decision_engine": False})
    if usi == "COOLING" and labor in {"COOLING", "BALANCING"}:
        notes.append({"feature": "GOLDILOCKS_SETUP", "effect": "금리 부담 완화 가능성을 점검할 정보 feature", "decision_engine": False})
    notes.append({"feature": "KR_EXPORT_SEMICON", "effect": "공식 수출/반도체 수출이 LIVE가 되면 국내 반도체 익스포저 참고 feature로 사용", "decision_engine": False})
    return notes


def revision_scalar(metric: dict, point: dict):
    key = metric.get("key")
    if key in {"US_CPI", "US_CORE_CPI", "US_PCE", "US_CORE_PCE", "US_AHE", "US_ECI", "KR_CPI", "KR_CORE_CPI"}:
        return point.get("raw")
    return point.get("value")


def update_vintages(metrics: dict):
    ledger = load_json(VINT, {"schema": "JJOONI_OFFICIAL_MACRO_VINTAGES_V1", "created_kst": now_kst().isoformat(timespec="seconds"), "vintages": {}})
    bootstrap = not VINT.exists()
    vintages = ledger.setdefault("vintages", {})
    detected = now_kst().isoformat(timespec="seconds")
    for key, metric in metrics.items():
        hist = metric.get("history") or []
        if not hist:
            continue
        for point in hist[-18:]:
            period = str(point.get("period") or "")
            value = revision_scalar(metric, point)
            if not period or value is None:
                continue
            lk = key + "|" + period
            entries = vintages.setdefault(lk, [])
            if not entries:
                entries.append({"version": "baseline_import" if bootstrap else "initial_release", "value": r4(value), "captured_kst": detected})
            elif abs(float(entries[-1]["value"]) - float(value)) > 1e-9:
                rev_no = sum(1 for x in entries if str(x.get("version", "")).startswith("revision_")) + 1
                entries.append({"version": f"revision_{rev_no}", "value": r4(value), "captured_kst": detected})
        latest = metric.get("latest") or {}
        if latest.get("period"):
            lk = key + "|" + str(latest["period"])
            metric.setdefault("release", {})["vintage"] = (vintages.get(lk) or [])[-1] if vintages.get(lk) else None
            metric["release"]["vintage_history"] = vintages.get(lk) or []
    ledger["updated_kst"] = detected
    VINT.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ledger


def main():
    calendar = load_json(CAL, {})
    fedwatch = load_json(FEDWATCH, {})
    us, us_errors = build_us(calendar)
    kr, kr_errors = build_kr(calendar)
    metrics = {**us, **kr}
    vintages = update_vintages(metrics)
    regimes = group_regimes(metrics)

    official_tree = {
        "us": {
            "inflation": {"regime": regimes["us"]["inflation"], "metrics": ["US_CORE_PCE", "US_PCE", "US_CORE_CPI", "US_CPI"]},
            "labor": {"regime": regimes["us"]["labor"], "metrics": ["US_NFP", "US_UNEMPLOYMENT", "US_AHE", "US_JOLTS", "US_ECI"]},
            "growth": {"regime": regimes["us"]["growth"], "metrics": ["US_GDP"]},
            "fed": {"regime": regimes["us"]["fed"], "metrics": ["US_FED_FUNDS", "US_SEP_DOT_PLOT"], "fedwatch_reference": {"meeting_date": fedwatch.get("meeting_date"), "freshness": fedwatch.get("freshness")}},
        },
        "kr": {
            "inflation": {"regime": regimes["kr"]["inflation"], "metrics": ["KR_CPI", "KR_CORE_CPI"]},
            "growth": {"regime": regimes["kr"]["growth"], "metrics": ["KR_GDP", "KR_BOK_OUTLOOK", "KR_INDUSTRIAL_PRODUCTION"]},
            "exports": {"regime": regimes["kr"]["exports"], "metrics": ["KR_EXPORT_YOY", "KR_EXPORT_1_20", "KR_CURRENT_ACCOUNT"]},
            "semiconductor": {"regime": regimes["kr"]["semiconductor"], "metrics": ["KR_SEMICON_EXPORT_YOY"]},
        },
    }

    out = {
        "schema": "JJOONI_OFFICIAL_MACRO_V1",
        "generated_kst": now_kst().isoformat(timespec="seconds"),
        "read_only": True,
        "contains_account_data": False,
        "scope": "OFFICIAL_MACRO_ONLY_MARKET_INDICATORS_EXCLUDED",
        "history_target_years": 10,
        "actual_contract": "OFFICIAL_PRIMARY_SOURCE_LOGICAL_SSOT",
        "transport_contract": "FRED_FOR_US_HISTORY_BOK_ECOS_FOR_KR_WHERE_AVAILABLE",
        "consensus_contract": "CONSENSUS_IS_SEPARATE_MARKET_DATA_NOT_OFFICIAL_ACTUAL",
        "revision_contract": "PROSPECTIVE_VINTAGE_LEDGER_NO_OVERWRITE",
        "macro": {"official": official_tree},
        "metrics": metrics,
        "regimes": regimes,
        "portfolio_context": portfolio_context(regimes),
        "historical_markers": [
            {"date": "2020-03-01", "label": "COVID"},
            {"date": "2022-03-01", "label": "Fed tightening"},
            {"date": "2022-06-01", "label": "Inflation peak"},
            {"date": "2024-01-01", "label": "2024~25 disinflation"},
            {"date": "2026-01-01", "label": "2026 reacceleration check"},
        ],
        "quality": {
            "us_errors": us_errors,
            "kr_errors": kr_errors,
            "live_metrics": sum(1 for x in metrics.values() if x.get("status") == "LIVE"),
            "pending_metrics": [k for k, x in metrics.items() if x.get("status") == "SOURCE_PENDING"],
            "vintage_keys": len(vintages.get("vintages", {})),
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OFFICIAL_MACRO_BUILD=PASS")
    print("generated_kst=" + out["generated_kst"])
    print("live_metrics=" + str(out["quality"]["live_metrics"]))
    print("pending=" + ",".join(out["quality"]["pending_metrics"]))


if __name__ == "__main__":
    main()
