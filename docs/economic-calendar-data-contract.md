# Economic Calendar collection and publication

## Entry points

All four calendar publishers run `tools/refresh_calendar_pipeline.py` and
`tools/publish_observatory_data.py`, under `economic-calendar-canonical-writer`.
Do not add another script sequence or a blind `git rebase -X theirs` publisher.
Light Refresh owns collector-code pushes and release-window schedules. Daily
owns schedule rebuilding and wider market data. Verified checks completed
Light/Daily runs. Actual Capture remains a manual recovery entry point; its
duplicate scheduled executions were removed.

The pipeline restores previous observations **before** collection, then merges
official -> secondary -> market-feed observations, applies curated event
contracts, retains history, computes final health, archives, and validates.
Publication merges concurrent calendar observations by source authority and
recomputes health. A concurrent code/UI conflict fails without overwriting it.

## Observation contract

`actual`, `source_tier`, `source_url`/`official_url`, `checked_kst`,
`observed_kst`, `verification_status`, and `value_vintage` describe one observation.
Null never erases a non-null actual. Source precedence is OFFICIAL > SECONDARY >
MARKET_FEED > legacy captured values. Within a tier a stale archive cannot
replace a newer checked observation. Release-vintage observations take
precedence over subsequently revised time-series values in this calendar.
Previous and consensus are retained when a new source omits them.

`calendar-manual-overrides.json` contains curated corrections and captured
observations. `persist_calendar_history.py` also retains unresolved events after
weekly feed rollover. `calendar-official-release-cache.json` preserves dated
official document excerpts/table cells, not manually entered numeric overrides.
The same parser handles live documents and preserved documents. Complete live
BLS documents are automatically cached and published. The initial historical
cache was captured from official BLS archive links on 2026-09-21 UTC.

## Official adapters

The registry in `official_calendar_collectors.py` defines expected metrics and
isolates failures per source. DOL uses date-bound ETA/DOL PDFs; BOK PPI discovers
dated release attachments; BOJ parses the meeting's policy PDF; BOE parses Bank
Rate and the MPC vote. BOK policy meeting dates and decisions share the official
meeting table. The existing dated Federal Reserve collector remains behind the
same enrichment/pipeline entry point and repairs missing `fed_rate` metrics.

BLS parsers require the full announcement date. Exact release types separate
national employment, veterans, national/state JOLTS and industry productivity.
Metric corrections carry tombstones so historical merges cannot resurrect
incorrect metrics. The annual State JOLTS publication notice is represented as
an explicitly labelled dataset-publication result, not a national job-opening
number or a monthly count of states.

When BLS HTML/PDF/text requests fail, the official Public Data API can supply
configured monthly series. It requires a reference period from the official
schedule/release; it never assumes announcement month minus one. Such values
are labelled `LATEST_REVISION` / `VERIFIED_OFFICIAL_REVISED`, retain the series
ID and API URL, and display “수정치” in the UI. Missing period, missing series
point, HTTP errors and parser failures remain visible in collection checks.

## Freshness

Importance >= 2 or `actual_watch=true` is monitored. Event-level actual and all
expected metric actuals must be present. Empty metrics do not exempt an event.
Before release: SCHEDULED. After release and during grace: PENDING. Missing
after deadline: OVERDUE, making overall health DEGRADED. No age-based expiry.
Only actual recovery or an explicit no-actual contract resolves the obligation.
Probability snapshots, market forecasts and explicit schedule-only items are
excluded. Normal grace is 45 minutes. TBD meetings use the end of the meeting
day in KST; a noon display/sort placeholder is never the deadline.

## Refresh cadence and UI

Korean release checks run at 06:05/06:15 KST (21:05/21:15 previous UTC day).
BOJ checks run in the 11:05–16:35 KST weekday window. Existing US release-window
checks remain. Historical network backfill is bounded and oldest-attempt-first;
local official-cache recovery does not consume that network budget.
GitHub cron may be delayed; the cadence is a target, not a delivery guarantee.

The visible calendar polls published JSON every two minutes, preserves the
selected month, pauses while hidden or editing, and preserves displayed values
on errors. Canonical server data is not re-overridden by a stale browser copy of
the server archive; explicit local user edits are still applied.

## Verification and extension

Run `python -m unittest discover -s tests -p 'test*.py' -v` and
`node --test tests/*.test.cjs`. Production QA also checks public JSON, desktop
1280px/mobile 390px actual columns, missing-actual labels, a new poll payload,
failed-poll preservation, selected-month preservation and horizontal overflow.

Add adapters with exact release identity, expected metric keys, date/period
validation and recorded source errors. Add real announcement fixtures for wording
and unit variants. Do not solve upstream outages by lowering importance,
expiring unresolved rows, inventing actuals or bypassing strict health checks.
