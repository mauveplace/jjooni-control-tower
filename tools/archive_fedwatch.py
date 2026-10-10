#!/usr/bin/env python3
"""Append immutable FedWatch observations and build public analyst read views."""
from __future__ import annotations
import csv
import hashlib
import io
import json
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "market-observatory/data"

def archive_snapshot(snapshot: dict, data: Path = DATA) -> dict:
    if snapshot.get("schema") != "JJOONI_FED_WATCH_V1":
        raise ValueError("FEDWATCH_ARCHIVE_SCHEMA")
    if snapshot.get("contains_account_data") is not False or snapshot.get("read_only") is not True:
        raise ValueError("FEDWATCH_ARCHIVE_PUBLIC_BOUNDARY")
    trade_date = date.fromisoformat(snapshot["market_data_as_of"]).isoformat()
    rows = snapshot.get("meeting_probability_matrix") or []
    if not rows or any(abs(sum(r["probabilities"].values()) - 1) > .001 for r in rows):
        raise ValueError("FEDWATCH_ARCHIVE_PROBABILITIES")
    raw = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    relative = f"fedwatch-history/{trade_date}/{digest}.json"
    target = data / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_text(encoding="utf-8") != raw:
        raise ValueError("IMMUTABLE_ARCHIVE_CONFLICT")
    if not target.exists():
        target.write_text(raw, encoding="utf-8")
    index_path = data / "fedwatch-history/index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"entries": []}
    entries = {r["market_data_as_of"]: r for r in index["entries"]}
    old = entries.get(trade_date, {})
    revisions = list(old.get("revisions") or [])
    revision = {"path": relative, "sha256": digest, "generated_kst": snapshot["generated_kst"]}
    if not any(r["sha256"] == digest for r in revisions):
        revisions.append(revision)
    # Older reruns may add evidence, but must not replace a newer observation.
    selected = max(revisions, key=lambda r: (r["generated_kst"], r["sha256"]))
    entries[trade_date] = {"market_data_as_of": trade_date, "path": selected["path"],
                           "generated_kst": selected["generated_kst"], "revisions": revisions}
    index = {"schema": "JJOONI_FEDWATCH_HISTORY_INDEX_V1", "read_only": True,
             "contains_account_data": False, "date_basis": "CME_SETTLEMENT_TRADE_DATE",
             "entries": sorted(entries.values(), key=lambda r: r["market_data_as_of"], reverse=True)}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["market_data_as_of", "generated_kst", "meeting_date", "target_range_pct",
                     "probability", "freshness_at_observation", "source", "snapshot_path"])
    for entry in reversed(index["entries"]):
        saved = json.loads((data / entry["path"]).read_text(encoding="utf-8"))
        for meeting in saved["meeting_probability_matrix"]:
            for target_range, probability in meeting["probabilities"].items():
                writer.writerow([saved["market_data_as_of"], saved["generated_kst"], meeting["meeting_date"],
                                 target_range, probability, saved["freshness"], saved["source"], entry["path"]])
    (data / "fedwatch-history/probabilities.csv").write_text(stream.getvalue(), encoding="utf-8")
    latest = json.loads((data / "fed-watch.json").read_text(encoding="utf-8"))
    brief = f"""# FedWatch · PB / Analyst Read View

- 가격 기준일: {latest['market_data_as_of']}
- 관측 시각: {latest['generated_kst']}
- 수집 당시 상태: {latest['freshness']}
- 원천: {latest['source']}
- 공식 API: {latest.get('official_api_status', 'UNKNOWN')}
- 최신 원문: [fed-watch.json](../fed-watch.json)
- 전체 관측 이력: [index.json](index.json)
- 회의별 확률 CSV: [probabilities.csv](probabilities.csv)

확률은 0~1, 확률 변화는 %p입니다. 생성시각과 가격 기준일은 다릅니다.
과거 파일의 LIVE는 당시 판정이며 현재 데이터라는 뜻이 아닙니다.
서로 다른 날짜를 비교할 때 같은 meeting_date와 target range를 맞추십시오.
next FOMC가 바뀌면 다음회의 확률끼리 단순 비교하지 마십시오.
내장 change_1d/change_1w는 현재 금리 기준으로 재산출한 비교값입니다.
실제 당시 관측 비교는 날짜별 원문 current_target과 matrix를 사용하십시오.
결측 기간은 추정하지 않습니다. 파일 수정 관측은 revisions로 보존합니다.
주문 권한은 없으며 계좌정보를 포함하지 않습니다.

| 가격 기준일 | 관측 시각 | 원문 | 보존 관측 수 |
|---|---|---|---|
"""
    for entry in index["entries"]:
        brief += f"| {entry['market_data_as_of']} | {entry['generated_kst']} | [JSON](../{entry['path']}) | {len(entry['revisions'])} |\n"
    (data / "fedwatch-history/brief.md").write_text(brief, encoding="utf-8")
    return index

if __name__ == "__main__":
    archive_snapshot(json.loads((DATA / "fed-watch.json").read_text(encoding="utf-8")))
    print("FEDWATCH_ARCHIVE=PASS")
