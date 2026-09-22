# Official macro collection contract

## Incident and verified root causes

- GDP requested obsolete ECOS `200Y002/10111`, which returns INFO-200.
  `200Y102/Q/10111` explicitly identifies real, seasonally adjusted QoQ GDP.
- Fuzzy CPI item discovery scanned headline classifications and could select a
  different index. Core CPI is explicitly `901Y010/M/DB`, food/energy excluded.
- Remaining exports, employment, BOK outlook and Fed SEP were placeholder slots,
  not functioning collectors. A successful job did not imply full data coverage.
- Customs detail URLs need both `nttSn` and `nttSnUrl`. Omitting the latter can
  return an HTTP-200 system notice. BOK's RSS can return an empty `menuNo`, which
  must be normalized before requesting a release page.
- UI number conversion treated null as zero. This could describe an unavailable
  consensus as a positive surprise. Null now remains missing.

## Structure

`official_macro_registry.py` owns explicit ECOS codes, item axes, raw units,
transformations and series fingerprints. GDP remains QoQ, production is MoM SA,
exports and core CPI are YoY. Current account uses unadjusted `301Y013/000000`.
A metadata or unit mismatch fails closed; a verified same-identity old value is
retained with DEGRADED status. A changed identity cannot import incompatible history.

`official_macro_releases.py` owns independently bounded adapters:

| Adapter | Discovery | Value contract |
|---|---|---|
| Fed SEP | FOMC calendar links | Median projections by variable/year; actual=null |
| BOK outlook | Official RSS, release PDF attachment | GDP/CPI/core CPI by forecast year; actual=null |
| Employment | Official employment release board | YoY employed-person change in thousands; component rates |
| Customs | Paginated official board, full detail token | Monthly confirmed exports/semiconductors; separate 1–20 preliminary window |

Each refresh discovers the latest release; numeric values are never hardcoded.
Network requests retry once within a 65-second adapter budget, with a maximum
18-second per-request timeout and a 20 MB response cap. ECOS has its separate
120-second total budget, revision lookback and pagination guards. An adapter
failure is recorded by metric and cannot suppress successfully collected siblings.
Customs monthly and early-month parsers also fail independently.

Official release points retain URLs, publication/reference dates, checked time,
source tier and verification status. Forecasts have `value_role=official_forecast`,
`actual_expected=false` and `release.forecast`; they never populate Actual.
Old monthly releases and projections past their conservative age limit become
DEGRADED. A successful download alone does not make a missing release LIVE.

Historical values survive failures; null does not overwrite verified history.
Revision ledger keys include the statistical identity or forecast horizon. Old
ledger entries remain intact, but an item-code correction is not called a revision
of a different series. First-observed historical points are baseline imports,
not fabricated initial-release vintages.

## Refresh and production checks

The macro workflow runs at KST 08:10, 09:15 and 13:45 on Korean weekdays, plus
US release windows. Existing calendar schedules separately cover BOK 06:00
releases. GitHub cron is best effort and may start late.

Builds run the complete Python regression suite. A subsequent job checks the
public Pages JSON and actual UI using Chromium at 390 and 1280 px, including all
nine recovered metrics, explicit forecast labels, official links and overflow.
Frontend contract tests cover missing consensus and forecast interpretation.
The UI refreshes every two minutes while visible and preserves values on a
transport failure. The diagnostics workflow is manual-only and shares the
production registry, avoiding a second set of hardcoded source definitions.

## Evidence and limits

The first fully recovered run was `35776700745`: 23 LIVE metrics, no pending or
degraded metrics, generated `2026-09-23T04:55:07+09:00`. Production mobile/desktop
checks passed. Follow-up commits add identity-safe vintage keys and remove the
obsolete fuzzy discovery path.

ECOS series have historical backfill. Some newly enabled release-only metrics
have limited historical coverage; their recorded start dates are explicit and
are not represented as ten years of complete history. HTML/PDF layout changes,
official outages and delayed Actions starts remain external dependencies. Such
failures must surface as DEGRADED with the previous verified observation retained.
