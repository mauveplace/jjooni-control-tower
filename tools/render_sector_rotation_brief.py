#!/usr/bin/env python3
"""Render the existing Song Sector Observatory's 34 vertical rows, without new market calls."""
from __future__ import annotations

import json
from pathlib import Path
try:
    from build_sector_rotation_brief import OUTPUT, ROOT
except ModuleNotFoundError:
    # The Sector QA contract imports tools.render_sector_rotation_brief as a package.
    from tools.build_sector_rotation_brief import OUTPUT, ROOT

OUTPUT_MD = ROOT / "market-observatory/data/sector-rotation-brief.md"
ORDER = ("classic", "kr_sector", "semiconductor", "software", "biotech",
         "financial", "defense_infra", "robotics")
DIRECTION = {
    "TURN_POSITIVE": "상승 전환",
    "TURN_NEGATIVE": "하락 전환",
    "REMAINS_POSITIVE": "강세 지속",
    "REMAINS_NEGATIVE": "약세 지속",
    "FLAT": "보합",
    "UNAVAILABLE": "원장 확인 대기",
}


def fmt(value, suffix="%"):
    if value is None:
        return "미확인"
    return f"{value:+.2f}{suffix}"


def render(digest):
    assert digest.get("schema") == "JJOONI_SECTOR_ROTATION_BRIEF_V1", "ROTATION_SCHEMA"
    assert digest.get("read_only") is True and digest.get("no_trade") is True, "NO_TRADE_SOURCE"
    assert digest.get("flow_evidence") == "PRICE_PERFORMANCE_PROXY_ONLY_NOT_NET_INFLOWS", "NO_CASH_FLOW_LAUNDERING"
    groups = digest["groups"]
    assert tuple(g["key"] for g in groups) == ORDER, "EXISTING_VERTICAL_ORDER"
    assert [g["expected_count"] for g in groups] == [11, 10, 2, 3, 1, 1, 4, 2], "FULL_EXISTING_UNIVERSE"

    date_us = digest["completed_cutoffs"]["US"]
    date_kr = digest["completed_cutoffs"]["KR"]
    lines = [
        "**송팀장 Sector Observatory · 전체 업종 강약**",
        "",
        f"완료일봉 기준: 미국 {date_us} / 한국 {date_kr} · 출처: 기존 옵저버토리 Sector ETF 원장 "
        f"({digest['source_generated_kst']})",
        "",
        "**수익률 기반 추정**이며 실제 펀드 자금 순유입·기관 순매수액이 아님. "
        "관측된 상대 강약의 이동만 해석하며, 원장 결측은 미확인으로 남김.",
        "",
    ]
    for group in groups:
        label = ("미국 S&P500 11개 업종" if group["key"] == "classic" else
                 "한국 10개 섹터 ETF" if group["key"] == "kr_sector" else
                 "주요 테마 ETF · " + group["label"])
        lines += [
            "**" + label + "**",
            "",
            "| 업종 · ETF | 전일 수익률 | 당일 수익률 | 변화(%p) | 방향 |",
            "|---|---:|---:|---:|---|",
        ]
        # Preserve the vertical board's descending 1D return order. Stale
        # incomplete rows remain visible at bottom instead of disappearing.
        sorted_rows = sorted(group["rows"],
                            key=lambda r: (r["current_return_pct"] is None,
                                           -(r["current_return_pct"] or 0)))
        for row in sorted_rows:
            status = DIRECTION[row["direction"]] if row["status"] == "OK" else "미확인(" + row["status"] + ")"
            lines.append(
                f"| {row['label']} · {row['ticker']} | {fmt(row['previous_return_pct'])} | "
                f"{fmt(row['current_return_pct'])} | {fmt(row['change_pp'], '%p')} | {status} |"
            )
        lines.append("")

    lines += [
        "**업종 주도권 변화 · 원인과 다음 확인**",
        "",
        "시장 전체가 강한지/약한지, 상승·하락 전환 업종, 경기민감 업종과 방어 업종의 "
        "상대 강약을 살펴볼 것. 금리·이익·밸류에이션·정책·기업 신규 사건을 "
        "원인 *가설*로 확인하고 반대 설명을 제시할 것. ",
        "기업별 상세는 실적·가이던스·공시·사건이 실제 발생할 때에만 포함하고, "
        "송팀장의 과거 언급 여부가 없더라도 시장에 중요한 사건을 누락하지 말 것.",
        "",
    ]
    return "\n".join(lines) + "\n"


def main():
    digest = json.loads(OUTPUT.read_text(encoding="utf-8"))
    txt = render(digest)
    OUTPUT_MD.write_text(txt, encoding="utf-8")
    print("SECTOR_VERTICAL_MARKDOWN=PASS rows=34 bytes="+str(len(txt.encode("utf-8"))))


if __name__ == "__main__":
    main()
