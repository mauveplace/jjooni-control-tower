# Physical accounts and strategy performance

The only additive accounts are TOSS, ISA, PENSION, IRP, TRIPOD. Strategy screens are projections of the SAME positions, not additional balances. The retired AI account is excluded. A physical holding is identified by account plus normalized symbol. The same symbol in different accounts is retained. Identical duplicate rows within an account are excluded; conflicting duplicates prevent certification.

## Strategy attribution

Passive Nasdaq-100 ETFs QQQ, QQQM, QLD, TQQQ and named domestic Nasdaq-100 ETFs form NASDAQ_SYSTEM. TIME Nasdaq-100 Active 426030 and other explicitly active Nasdaq funds belong to NASDAQ_ACTIVE, excluded from the system but retained in whole-portfolio NAV. Covered calls and inverse products are not automatically included. OTHER and UNALLOCATED complete the partition. Product multipliers are numeric exposure descriptions, never MONO/BI/TRI strategy identities. There are no product-multiplier strategy sub-books.

## Account-specific operation rules (user reference photo, 2026-10-16)

All account implementations use the SAME verified market-state signal. They have different target compositions, not different names for product leverage.

| Implementation | Green | Yellow | Red |
| --- | --- | --- | --- |
| Existing overseas TRI-POD | Nasdaq 3x 100% | Nasdaq 1x 50% + 2x 50% | Parking 100% |
| ISA photo model | Nasdaq 2x 100% | Nasdaq 1x 50% + 2x 50% | Parking 100% |
| Pension savings photo model | Nasdaq 1x 100% | Nasdaq 1x 100% | Parking 100% |
| IRP/DC photo model | Nasdaq 1x 70% + Nasdaq/bond 50/50 fund 30% | Same composition | Parking 100% |

IRP/DC effective equity exposure is 0.7*1 + 0.3*0.5 = 0.85. These are supplied strategy-model constraints, not independently verified legal eligibility advice. Do not invent a BI-POD name for the ISA model or a MONO-POD definition from a single product's multiplier. A general account containing domestic and overseas products requires application-scope confirmation instead of assuming all products follow the overseas target.

The existing freshness guard verifies the daily market signal. Its trusted target 3x/1.5x/cash maps to green/yellow/red; current holdings never infer a state. Green is rising, VIX10<28 and 52-week drawdown<=9%; yellow is rising but not green, or falling with VIX10<18; red is falling with VIX10>=18. Static account rules remain visible if signals are unavailable, but no current target/action is certified. HOLD_NO_TRADE stays no additional trading. No order path exists.

Target weights apply only to capital assigned to that strategy, not all assets in an account. Active Nasdaq is never interpreted as strategy execution. Bond-mixed/parking holdings remain OTHER or UNALLOCATED until strategy ownership is evidenced. Their absence from certified strategy attribution is disclosed; no hypothetical parking performance is invented. System trading gains stay in the same physical-account strategy across product changes; the existing baseline, journal, source IDs and historical KRW accounting are not reset.

Per physical account, sum(strategy position values) + residual cash/unallocated = source NAV. The residual is not silently relabeled cash; it may include unreconciled assets or other source differences. A negative residual or conflicting position rows prevent certification. Global NAV is always sum of five physical NAVs, never global NAV plus strategy balances.

## KRW performance

1. Original cumulative account P&L is shown only where present, with coverage. Missing accounts prevent displaying a complete total. This is not relabeled lifetime cash-flow-adjusted actual profit.
2. Holdings P&L uses actual historical KRW cost when explicitly sourced or reconstructed from complete matched-quantity trade rows with each trade's own FX and fees. KRW average-price costs are labeled before costs. No current-FX historical USD cost substitution.
3. New tracking-period actual profit = current NAV - source baseline NAV - signed capital flows. Source identity and timestamp are immutable. Prior cumulative metrics are not reset by establishing a new tracking baseline. Missing historical evidence is not backfilled by assumption.
4. DEPOSIT/WITHDRAWAL affect capital, not profit. A TRANSFER is one journal event with equal/opposite physical-account legs, so aggregate flow is zero. DIVIDEND/FEE/TAX memos allocate already reflected NAV effects, not a second addition/subtraction to account profit. External flows are distinct from dividend income. Records can be voided with an audit trail, not overwritten.
5. Flow review is tied to an exact source snapshot. Later snapshots require review again; unreviewed NAV change is not certified as actual investment profit. Modified Dietz returns weight capital flows by event time and are labeled as such.
6. Strategy interval trading profit = current positions - baseline positions - gross purchases including costs + net sales + explicitly attributed income/costs. The opening quantity plus filled buys minus sells must match current quantity, and KRW amounts, costs and timestamps must be known. Residual account profit stays UNALLOCATED, so strategy totals reconcile and no guessed allocation is made.

## Persistence and scope

Authenticated HMAC endpoints `/strategy/read` and `/strategy/record` use private GCS storage through existing CT FAST. Source data remains in canonical five-account snapshots and DB_TRADES. The baseline and flow journal persist across devices. Observations deduplicate on source snapshot ID. A baseline contains actual source position values and does not create another portfolio. The system begins recording after deployment/on access; it cannot recreate earlier complete lifetime performance without missing account/funding/cost evidence.

No broker mutation, automatic trade, new service, permanent instance, or scheduler is introduced. The manual-intraday deployment inherits the exact current FAST digest and validates existing chart routes plus strategy endpoints before acceptance.

## Performance-first summary (2026-10-17)

The first visible section in the TRI-POD panel is the strategy performance summary. It precedes the daily signal explanation. The total headline and every physical-account card show the current passive Nasdaq strategy's KRW holding return and KRW holding P&L. Detailed account tables, full-portfolio metrics, rules and cashflow reconciliation start collapsed. Mobile cards fit without horizontal scrolling; the total headline always covers all five accounts even when the account list is filtered.

Holding return = sum(current KRW values minus KRW holding costs) / sum(KRW holding costs). Never average the five account percentages. Full-account NAV, active Nasdaq positions and other investments are not the denominator. Empty accounts display not invested, not zero percent. Same-symbol holdings in different accounts are retained once per account. Conflicting duplicates block the full return.

Authoritative same-snapshot position-level broker KRW unrealized P&L can imply its holding basis as current KRW value minus broker KRW P&L, where the implied basis is positive. This is labeled source/before-cost performance unless explicit fee-inclusive cost evidence exists. Do not convert native/USD P&L at current FX to invent historical KRW basis. Missing KRW cost blocks the full total and identifies exact missing symbols; any known-subset figure is explicitly labeled as a subset, never as total performance.

Current holding return is available independently of snapshot cashflow review. Tracking-period verified KRW profit remains separate and retains realized gains after selling out. Its original baseline and reconciliation gates are preserved. A strategy lifetime/cash-adjusted percentage is not fabricated from security trade proceeds, account NAV or unassigned cash: those do not establish the strategy's capital history. The only Modified Dietz percentage remains the original whole-physical-account metric in the expanded account audit.
