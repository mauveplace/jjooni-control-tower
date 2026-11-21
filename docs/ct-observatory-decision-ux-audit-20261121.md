# 2026-11-21 JJOONI Control Tower + Observatory V3 decision UX audit

Scope: Public front-end and published market metadata only. The owner's encrypted authenticated Control Tower and personal account data were **not** opened. No PC relay, workflow/subscription, trading or private data changes.

## Verified code-level deficiencies and bounded changes

| Priority | Surface | Source evidence | Change in this PR | Guard |
| --- | --- | --- | --- | --- |
| P1 | Control Tower first screen | `ct-human-v2.js` showed only "확인 N/4계좌 · 기준기간 대사 필요" when a financial account lacked today_pnl, so the owner could not tell which account needed reconciliation | Identify missing TOSS/ISA/PENSION/IRP by display name; if all 4 present but time-period comparability fails, say exactly that. Keep previous fail-closed aggregate and NAV/account-snapshot logic. | Existing `tests/ct-human-v2-ui-e2e.cjs` plus new IRP missing-account assertion. |
| P1 | Observatory V3 first-screen sector | `observatory-v3.js` displayed only US S&P500 11x symmetric bars, while `sector-rotation-brief.json` had 34 rows (US 11, KR 10, theme ETFs 13) and previous/current returns + change_pp. `today-v2.js` separately exposed US/KR top-two sector movers but not broad market participation. | Compact 3-cohort advance/decline and positive→negative/negative→positive counts, above existing symmetric US bar chart. Full 34-sector drilldown unchanged. | Must require all 34 same completed sessions, finite prev/current returns and consistent change_pp; otherwise show comparison-held note, never invent fund flows. |
| P0 (verification) | CT authenticated runtime | The actual encrypted 4-account private screen has not been directly observed in this review. Synthetic tests and successful Pages deployment cannot prove actual mobile NAV or daily return. | No synthetic private data published. List the required private device checks, preserve V1 rollback. | Owner-device verification gate remains OPEN. |
| P0 (operational) | Observatory morning publication | 2026-11-21 report is present under latest, dated archive and index, but it was first published 15:58:59 KST rather than 06:30. #584/#588 add detection and handoff, but an Issue is not a completed editorial publication. | No change to collector, schedule, publisher, alert, or backfill. Carry the missed-SLO observation forward for a future real on-time scheduled end-to-end acceptance. | Do not describe the next 06:30 SLA as proved by same-day late recovery. |
| P1 (further UX proposal) | Both | Similar terms "현재", "완료 세션", "관측", "검증", "참고" appear in different locations and the relative priority changes by screen. | **Not implemented here**: one compact provenance language bar and top-level drilldown for accounts, market and strategy; requires separate usability/real-device review. | Account/strategy data provenance must not be collapsed into a misleading green dot. |

## 2026-11-20 market close example — read-only classification

Same completed-session source `market-observatory/data/sector-rotation-brief.json` (generated on 2026-11-21). For that session, 1/11 US sectors rose and 10/11 fell; KR sectors 0/10 rose and 10/10 fell; theme ETFs 0/13 rose and 13/13 fell. Five KR sectors transitioned from positive previous daily returns to negative current daily returns. All counts are **ETF return sign classifications**, not capital flows, relative total-return allocation, capital migration, or investment recommendations. Rows represent different markets and ETF universes; rankings across universes do not establish money moving between them.

## Acceptance / evidence levels

1. Node syntax and existing + new source-contract tests at the exact PR HEAD.
2. Chromium V3 browser 390/800/1440: first-screen breadth, sector symmetry, non-overflow, toggle/deep-link and no runtime errors.
3. Control Tower authenticated 390/desktop screen: the missing-account explanation and 4-account NAV; **cannot be proven by a public synthetic fixture**.
4. Independent ROY exact-HEAD source/UX review; exact PR HEAD, task JSON, review record and CI must match. GitHub owner-authored review markers alone do not independently authenticate the assistant.
5. Merge/Pages only after user release approval; verify published asset versions and real browser behavior after merging.

Preserve all previous rules: read_only, no_trade, SSOT, no private account data in public repo, P&L/flow separation, 4 accounts only, no AUTOBOT, TRI-POD rule values unchanged, Observatory V3 default with explicit V1/V2 rollback.
