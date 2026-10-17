# Mobile-first Control Tower presentation

The presentation uses four physical accounts (TOSS, ISA, PENSION, IRP).
TRI-POD is a strategy within TOSS; strategy sleeves never add a fifth NAV.
AUTOBOT remains retired. This change does not enable orders or alter balances,
transactions, quantities, cost bases or cash-flow ledgers.

Implementation order: shared correctness, mobile, tablet, desktop.

- `overview-consistency-v21.js` owns shared current performance, quality,
  account allocation and risk summaries. All consume `JjooniMetrics` and the
  same canonical snapshot. Unverified historical analytics stay unavailable.
- `tablet-accounts-v8.js` supplies the canonical account cards on all devices.
- `trade-review-outcomes-v26.js` uses canonical held-security prices ahead of
  stale trade marks. Fund amount rows require NAV/unit evidence; reconstructed
  fund realized and opportunity gains are excluded. Explicit broker realized
  profit is retained. Watchlist references cannot overwrite held prices.
- `ui-refactor.js` owns navigation and loads `responsive-layout.css`. Phones
  and tablets have four primary actions and one expandable menu. Keyboard
  Enter/Space and Escape are supported. Desktop reserves sidebar width.
- The old inline portrait CSS is removed. The shell and runtime load one CSS
  contract. The boot shield waits until that stylesheet is available.
- Source-truth updates no longer listen to their own emitted event or observe
  the whole document. Navigation normalization avoids rewriting identical text.

Validation: synthetic fixtures contain no private account data. They exercise
360, 390, 500, 768, 820, 1024 and 1363px layouts, touch tablet mode, menu controls,
canonical totals, missing-value display, fund exclusion and quote precedence.
Live post-deployment verification is separate from these offline fixtures.
