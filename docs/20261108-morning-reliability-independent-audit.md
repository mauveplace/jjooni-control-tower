# Morning market report · Observatory source quality independent audit

**2026-11-08 KST / public-only, no trading or production writes.** This report is a work order for ROY independent review, not a conclusion that a historical quote was wrong or that a failed GitHub email means current outage.

## Reproduced source inconsistency (P0 publication integrity)

| Field | Public 2026-11-07 morning brief (US session 2026-11-06) | Latest GitHub main canonical same US session, captured 2026-11-08T22:18:06+09:00 |
| --- | --- | --- |
| NDX | 27,154.71 and +1.97% (`CROSS_CHECKED`, official history delayed) | 26,989.99023438 and +1.35254% (`OBSERVATORY_CANONICAL`) |
| NDX MA250 | approx 27,452.10 | 27,451.43946875024 |
| VIX 10-close average | 20.04–20.10 (provider range) | 20.185000039 |
| TRI-POD target | BIPOD | QQQ 50% + QLD 50% (BIPOD) |

The NDX closing-price gap is **164.7198 index points** for the same market date (about 0.61% of canonical); this is material for the strategy threshold calculation even when the current state did not change. Treat latest canonical as a more recent revised observation, **not** as independently proved correct. Preserve original publication and source-vintage evidence; do not silently retcon the earlier report.

Source 1: `market-observatory/data/morning-brief/latest.json`: `editorial_contract.close_checks[NDX]`, first 2 body lines, published 2026-11-07 06:40 KST.
Source 2: `public-market-daily.json` root: `tripod_signal` and `market_context.items.NASDAQ100`, generated 2026-11-08 22:18 KST.

## Existing validation vs published artifact

`tools/validate_morning_brief.py:validate_editorial` currently requires `CROSS_CHECKED` records to carry `official_status=NOT_CHECKED`; but the published latest has `official_status=DELAYED`. The validator further requires source observations to have **exactly identical close** and observation types `COMPLETED_DAILY_BAR` or `POST_CLOSE_QUOTE`; the report recorded 27154.71 and 27154.78 with types `POST_CLOSE_DYNAMIC` / `POST_CLOSE_DAILY`. This is a strong indication that the published latest does **not** pass current validator. Execute it in CI to confirm. Do not weaken the gate merely to make the already-published report pass: require a justified source-vintage normalization and explicit diff tolerance if appropriate.

`market-observatory/data/daily-market-pulse.json` says `snapshot_status=FINAL`, but `session_gate.price_crosscheck=NOT_VERIFIED`; `FINAL` certifies only trading-session alignment. The morning report must not treat it as 2-source proof of actual NDX close.

## Operational error email investigation

Historical GitHub failed runs: [Latest Board E2E #42453458571](https://github.com/mauveplace/jjooni-control-tower/actions/runs/42453458571), [Calendar Actual QA #42450005179](https://github.com/mauveplace/jjooni-control-tower/actions/runs/42450005179), [10Y backfill #42463818004](https://github.com/mauveplace/jjooni-control-tower/actions/runs/42463818004), [Calendar Light #42453458525](https://github.com/mauveplace/jjooni-control-tower/actions/runs/42453458525).

- E2E and Calendar Actual QA were Playwright 1.55 failing on GitHub `ubuntu-latest` mapping to unsupported `ubuntu26.04`; latest main workflow files now pin `ubuntu-24.04`. Calendar Actual production QA later succeeded, but latest-board E2E did not yet show a post-fix success in the recent workflow-runs sample.
- Backfill built 437 series, 37,819 rows and reported `FULL` through 2026-11-06, then failed in atomic publish after **3 concurrent-update retries**; subsequent main backfill on 2026-11-08T10:44Z succeeded. No historical-data loss established.
- Light refresh returned CPI `previous` actual 0.6% vs expected 3.7% on that run; later same-day light refresh passed. Need distinguish the semantic basis of CPI m/m vs y/y before asserting actual correction.
- Some old failure emails are for isolated PR SHA and have green successors; alerting should use latest relevant run and current production freshness before declaring an active incident.

## Editorial gaps for ROY to challenge

- `docs/song-daily-editorial-contract.md` already defines the current ①–⑧ headings, independent claim verification, and same-US-session next-day comparison, but `docs/morning-brief-publishing.md` and `docs/pb-morning-intelligence-handoff.md` still describe old 16:40 ET and separate Monday 05:40 KST schedules.
- The active automation `시장·AI산업·송팀장 통합 브리핑` currently runs New York 16:25 every day and branches by KST weekday, including Sunday and Monday, overriding the old split schedule. Public files must not contradict the active task or quietly alter its schedule.
- The automation's older `[화~일 ①~⑧]` prose uses different section descriptions from the strict current editorial contract. Execution should prioritize actual `docs/song-daily-editorial-contract.md` headings and keep flexible deep dives.
- The opening TRI-POD signal is high priority but must be separated into (a) market data quality, (b) strategy calculation from current frozen inputs, (c) CT/order authority. `decision_gate LIMITED` or incomplete source means no current order authorization.

## Requested final design

Provide a concise **two-pass market report**: first-pass fact/freshness/session reconciliation that can fail closed on quote conflict, then narrative/independent interpretation. Rank critical events ahead of cosmetic sections; track hypothesis invalidation and the next published source; preserve a revision ledger for post-publish source updates. Explain missing inputs and blast radius. Never fabricate quotes, news, users' holdings or a private Song video timeline.
