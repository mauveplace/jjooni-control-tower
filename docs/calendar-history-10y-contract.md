# Economic Calendar 10Y History Contract

## Goal
Keep approximately ten years (3,650 days) of economic-calendar history usable by the public Observatory UI and PB/analyst consumers.

## Data fields
For every historical row where a source supplies the value, retain:
- release date/time (KST)
- country/currency
- event/metric identity
- Previous
- market Forecast / Consensus
- Actual
- source / source tier / verification status
- canonical-match metadata

Missing values are never invented. A missing consensus remains `미발표` in the UI.

## Source precedence
1. OFFICIAL actual already captured by JJOONI
2. verified secondary/canonical observations already in the archive
3. historical market-calendar values used only to fill missing history

Historical market data must never overwrite an OFFICIAL actual.

## Coverage
- target window: rolling 3,650 days
- canonical contract: `ROLLING_3650D_EVENT_AND_METRIC_HISTORY_PRESERVE_V2`
- historical backfill contract: `FOREXFACTORY_HISTORICAL_10Y_RESUMABLE_V2`
- `FULL`: target start reached and no failed weekly pages remain
- `PARTIAL_GAPS`: target start reached but one or more weekly pages require retry
- `PARTIAL`: target start has not yet been reached

## Operation
Routine calendar refreshes preserve/extend the 10Y archive but do not crawl hundreds of historical pages.
`Economic Calendar 10Y History Backfill` performs the deep crawl under the same canonical-writer lock. Failed weeks are recorded and retried by later runs. Once coverage is FULL, scheduled runs become no-op health checks.

## Consumer UI
Each current calendar event exposes `최근 10년 이력`. Metric-level history is preferred; event-level history is used as fallback. PB/analyst consumers may read `market-observatory/data/economic-calendar-history.json` directly.
