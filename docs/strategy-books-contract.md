# Physical accounts and strategy performance

The only additive accounts are TOSS, ISA, PENSION, IRP, TRIPOD. Strategy screens are projections of the SAME positions, not additional balances. The retired AI account is excluded. A physical holding is identified by account plus normalized symbol. The same symbol in different accounts is retained. Identical duplicate rows within an account are excluded; conflicting duplicates prevent certification.

## Strategy attribution

Passive Nasdaq-100 ETFs QQQ, QQQM, QLD, TQQQ and named domestic Nasdaq-100 ETFs form NASDAQ_SYSTEM. TIME Nasdaq-100 Active 426030 and other explicitly active Nasdaq funds belong to NASDAQ_ACTIVE, excluded from the system but retained in whole-portfolio NAV. Covered calls and inverse products are not automatically included. OTHER and UNALLOCATED complete the partition. 1x/2x/3x product exposures are labeled MONO/BI/TRI-POD. Mixed exposure is value weighted, never added to NAV. MONO/BI/TRI product sub-books are shown separately within every physical account and across accounts. Their values partition the existing Nasdaq system balance. Closed products retain their period P&L. Income/costs without a product-level attribution remain a separate POD residual; they are never guessed into a product book. These are exposure labels, not newly invented strategy trading rules. Existing verified TRI-POD signals remain the decision authority. No order path exists.

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
