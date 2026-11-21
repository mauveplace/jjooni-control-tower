# Observatory architecture — JJOONI initial evidence / ROY independent challenge

**Audit mode:** read-only, public-source-only. Source commit pinned to `c19940c5d741952aadd5bc5ee0613b0d9a4ef555`. This document is an initial hypothesis/evidence register, **not** a completed joint finding nor an approved implementation.

## End-to-end architecture traced from code

```text
US/KR/JP markets & macro/quotes
  -> tools/build_* and refresh_* Python collectors
  -> GitHub Actions (schedules, workflow_run, push, manual)
  -> tools/publish_observatory_data.py (merge/rebase/rebuild audit & consumer files)
  -> main: market-observatory/data/*.json, public-market-daily.json
  -> current branch-based GitHub Pages build
  -> /market-observatory/ static HTML, 31 external JS <script src>, 1 inline script
  -> UI cached static series + separate read-only live quote endpoint
```

**Critical distinctions:** `observatory.json` and `public-market-daily.json` are published snapshots; `refresh-receipt.json` is evidence of a particular source commit; `freshness-status.json` is a time-bounded verdict; `watchdog-status.json` is a historical recovery check; quote API may be fresher than Pages JSON. Do not call any of these continuous live truth on its own.

## Source-grounded baseline (observed in repository on 2026-11-08)

- `.github/workflows/` contains **47 workflow definitions** (not all are Observatory runtime collectors; classification required). Many independent scheduled runs and workflow_run triggers share and compete for files on `main`.
- `market-observatory/data/` has **31 direct entries** including JSON datasets and history subdirectories. Large payloads: `observatory.json` ~6.6MB, `history-30y.json` ~6.7MB, `economic-calendar-history.json` ~35.0MB, `observatory-recent.json` ~1.3MB; browser mostly selects recent/lite, but large files remain in branch Pages root.
- `market-observatory/index.html` has **31 external script tags** (including 3 CDN scripts) and an inline application script. This is not proof of slow load, but increases dependency/order complexity, and a measurable mobile initialization audit is warranted.
- `market-observatory/AUTO_REFRESH.md` confirms browser open/reload refreshes published JSON only; server-side collection is separate. New-source collection button redirects to authenticated GitHub workflow rather than triggering it on the page.
- `.github/workflows/market-observatory-daily.yml` has `schedule`, `workflow_run` (including Pages deployment), `push` and manual triggers, with multiple writer jobs. Some use concurrency group `economic-calendar-canonical-writer`, a separate crypto group and separate supplemental group.
- `.github/workflows/observatory-crypto-refresh.yml` has `schedule: '12,42 * * * *'` and independent collector; `market-observatory-daily.yml` also has a crypto fallback path (`observatory-crypto-quote-writer` lock). Observe no fresh-data SLA guarantee from best-effort GitHub cron.
- `tools/publish_observatory_data.py` explicitly merges remote and local data with up to 3 fetch/rebase/push attempts; rebuilds interdependent snapshot and health before/after rebase. Good recovery feature; still review multi-workflow conflict and transaction boundaries, especially other workflows with custom git commit/push paths.
- `docs/pages-controlled-deployment.md` states Pages Actions controlled deploy is **staged/disabled until an explicit setting and variable switch**; the current branch-source Pages system receives frequent main-branch commits and can cancel superseded deploys. Do **not** activate in this task.

## Findings / hypotheses for ROY to challenge

### P0 / verified code-level flaw — historical mixed-granularity look-ahead

`tools/backfill_market_history_30y.py` calls Yahoo `interval=1d&range=max` but does not require `chart.meta.dataGranularity='1d'`. A prior independent Gemini/Claude review on PR #302 found that the coarse archive contains future quarter/month closes mapped to period starts. `tools/build_tripod_comparison.py` builds a `supplement` daily map then overwrites matching keys with archive and Observatory observations. See `build_tripod_comparison.py:110-114`, `backfill_market_history_30y.py:yahoo_max`. The historic 6-series TRI-POD CAGR/MDD and signal changes cannot be trusted pending a verified daily-only rebuild. **Do not touch live EOD decisions while auditing historical comparison.**

### P0 / measurement-contract gap — snapshot health vs historical validity

On Nov 8, the published `freshness-status.json` said overall `LIVE` and `data-audit.json` said zero critical issues despite the independently reviewed historical mixed-granularity comparison weakness. The two predicates are different: completed-session freshness **does not** prove historical strategy input integrity. Recommendation: explicit `historical_signal_integrity` QA gate and separate read-only quarantine badge; existing `LIVE` is not proof of historical backtest accuracy.

### P1 / testable issue — audit metadata references previous health

`tools/publish_observatory_data.py:289-296` runs audit then freshness. Audit includes `file_status.freshness` read from a previous snapshot. Current repository example has audit generated `2026-11-08T14:55:01+09:00` citing earlier freshness `LIVE_WITH_WARNINGS` (`fx`, `audit`) while fresh `freshness-status.json` generated at the same minute says `LIVE` with empty warning list. This may be expected historical reference, but should be modeled as `input_health_snapshot` and prevented from appearing as simultaneous current inconsistency.

### P1 / trigger and publication topology risk

Separate `market-observatory-daily`, supplemental freshness, official macro, calendar verified, close watchdog, crypto and Pages workflows may independently write overlapping JSON. Different concurrency lock groups can overlap; `publish_observatory_data.py` rebase/merge is intended to reconcile, but we must prove **same-snapshot consumer consistency** and no lost updates under overlapping pushes. Prefer one versioned publication manifest and explicit source ownership, while keeping independent collectors isolated from failures.

### P1 / user-perceived freshness and operational observability

Current user controls include three distinct concepts: ① latest quotes API, ② reload published snapshots, ③ GitHub workflow manual collection. Labels are clearer than before, but live API vs exchange completed EOD vs Pages publish must be marked in each card, with `source_asof`, `snapshot_id`, `generated_kst`, `published_at`, and `deployed_at` and a deterministic stale/fail-closed indicator. Verify refresh receipt is the matching run ID and not simply 'job success'.

### P1 / mobile performance and complexity

31 scripts and multiple chart modules rely on shared globals, cache-busting and synchronous mounting. Root `observatory-recent.json` is ~1.3MB and calendar JSON is >0.5MB; UI has lazy consumers, but separate fetches/modules may re-read overlapping data and charts. Measure cold render, subsequent tab transition, network transfer, main-thread long tasks, memory and touch target reliability on mobile/tablet **before** considering bundling or rewrite. Prefer shared data service and deferred chart init; no unmeasured rewrite.

### P2 / expensive data archives in Pages

Large historical archives are included under root of branch Pages. Investigate whether static history should be partitioned into immutable yearly shards with compact index and on-demand fetch. Ensure no broken historical UI, no account info in public paths, no new paid CDN/Cloud storage.

## First-pass priority plan — proposal only

| Priority | Short action | Concrete acceptance gate |
| --- | --- | --- |
| P0 | Quarantine historical TRI-POD 6-way performance until daily-only source backtest verified | Original artifacts preserved; daily-bar provenance strict; corrected 2018-10-01/2020-04-01/2022-04-01; signal diff and risk metrics audited |
| P0 | Data-contract QA for historical signal series distinct from live session freshness | Test that future quarter-end value placed on first of quarter fails; historical gate remains BLOCKED until validated |
| P1 | Multi-writer dependency/ownership map from 47 workflows | Producer→file→consumer matrix, overlapping write locks, loop/duplicate trigger map, bounded event/commit volume |
| P1 | Make revision, publication and UI evidence separately observable | Per-file build SHA, source session, published SHA, deployed timestamp, stale verdict and API response times; no false LIVE |
| P1 | Establish mobile/tab performance baseline | 3 device sizes, 3 network profiles, p50/p95 startup/interaction, no regressions in tap/scroll/zoom |
| P2 | Decompose static historical data delivery | Gated immutable year/month shards, archive hash and referential completeness; no default huge archive download |

## ROY deliverable

Independently verify or rebut each hypothesis, map at least 3 traced end-to-end flows, identify 5 immediate low-risk improvements and 3 strategic architecture choices, rank P0/P1/P2 by actual customer impact + failure frequency + engineering cost, specify exact test files and migrations, and report source references/UNKNOWNs. **One single top-level PR comment** with marker:

`<!-- JJOONI-COLLAB-V3 task=D-261108-OBS-ARCH-005 actor=ROY snapshot=c19940c5d741952aadd5bc5ee0613b0d9a4ef555 -->`

Include: verdict, proven issues, false positives, performance/cost unknowns, top 10 fix list, staging, session URL and trigger mode (AUTO/MANUAL/UNKNOWN). Do not change/commit/merge/deploy any source. JJOONI will synthesize after session provenance confirmation.
