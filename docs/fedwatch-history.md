# FedWatch daily archive · PB / analyst contract

## Daily publication
The sole routine producer is Market Observatory FedWatch Matrix V2.
One timezone-gated scheduled run per US business day at 17:15 ET:
06:15 KST Tue–Sat in EDT, 07:15 KST Tue–Sat in EST.
GitHub scheduling is best-effort and may run late. A late run is not discarded.
A rerun reuses a LIVE snapshot already matching the expected settlement date.
The general Observatory build consumes the existing daily snapshot.

## Public read paths (relative to market-observatory/data/)
- fed-watch.json: latest daily observation, full conditional FOMC matrix.
- fedwatch-history/index.json: settlement dates, selected observations and immutable revisions.
- fedwatch-history/YYYY-MM-DD/SHA256.json: complete observed payload, permanently retained.
- fedwatch-history/probabilities.csv: one row per settlement date / meeting / target range.
- fedwatch-history/brief.md: human and LLM read guide.

New observations include normalized CME settlement rows alongside the calculations.
The archive starts with the actual 2026-10-08 observation retained on 2026-10-10.
Older embedded comparison summaries are recomputations and are not backfilled as authentic historical observations.
Existing morning brief archives remain separate from raw FedWatch observations.
No account data, credentials, or order authority is published.

## Interpretation
Always state market_data_as_of, generated_kst, source, official_api_status and quality.
Freshness inside an archive is the verdict at observation time, not freshness today.
Compare the same meeting_date and target range, allowing for changes in current_target and methodology.
Do not splice different next meetings into a single comparable probability series.
Missing observations remain missing. Do not interpolate.
change_1d / change_1w may use the current target range to recompute prior settlements:
use the immutable observations for genuine historical vintage comparisons.

## Revision preservation
The full payload SHA256 identifies the immutable file. Same payload is idempotent.
A correction creates another observation; all revisions are retained in the date index.
An older rerun cannot replace a newer selected observation.
If raw collection fails the workflow fails and preserves the last published snapshot.
The displayed price date must be checked before using any probability as a current fact.
