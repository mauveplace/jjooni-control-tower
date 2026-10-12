# Observatory market session freshness contract

- KOSPI/KOSDAQ: Naver Finance daily index history is the primary recent-close source because it exposes the Korean `localTradedAt` explicitly. Yahoo Finance is fallback only. Korean daily bars must use the Asia/Seoul trading date; they must never be dated through America/New_York.
- NASDAQ100/SP500/VIX remain the canonical US completed-session trio.
- Russell 2000/Dow/NASDAQ Composite are supplemental US cash indices and must be truncated to the same `us_completed_session_date`. An in-progress same-day Yahoo daily bar is never published as a completed daily return.
- `market_supplement_quality` records source, status and last date per supplemental index. Freshness UI exposes KR and US-supplement states separately so a newly generated file cannot hide a stale underlying market series.
- Data age is not equivalent to source freshness. Acceptance and watchdog logic must inspect the actual last trading date, not only `generated_kst` or row count.
