# JJOONI Control Tower architectural independent audit baseline

2026-11-08 KST · Public source-only. This is a new issue work order for ROY, NOT authority to change main, deploy, unlock brokerage access or inspect private account balances.

## Observed static evidence

- `tools/audit_control_tower_architecture.py` inventories `.github/workflows`, potential browser JS and recurring/observer callback sites, as **candidates**, not proven live loops. Root main currently contains roughly 48 active workflows, 70+ top-level files and 151 tests including many UI/market tests. Ask ROY to recompute exact versioned counts from the HEAD.
- `docs/20261026-login-and-remediation-audit.md` says 32 critical UI modules out of 34 declared; prior static runtime graph had ~55 candidate JS assets, which are NOT guaranteed initial-load downloads. It leaves encrypted legacy shell timer cleanup, 3–5 critical first-screen lazy loading, one authoritative UI status, data/UI publication separation, some earned performance proof, broker-trade ledger reconciliation and IRP original cost verification pending.
- `docs/20261026-authenticated-screen-audit.md` verified some authenticated browser issues in October, but explicitly did **not** claim complete real-device timing, encrypted shell internal timer removal, all tabs/touch targets, full 6-account reconciliation, or live financial truth.
- `market-observatory/data/market-regime.json` currently reports `generated_kst=2026-10-11T09:44:22.647+09:00` and `status=EXPIRED`; a public AI read contract explicitly says expired consensus cannot be treated as current trade/order authority.
- `public-market-daily.json`, current generated 2026-11-08T22:18:06+09:00, reports a read-only TRI-POD daily reference with action HOLD_NO_TRADE; source / snapshot freshness and private Control Tower decision gates remain distinct.
- `market-observatory/data/freshness-status.json` has `generated_kst` and an age policy. A newly generated status panel alone is not a real-time source price or proof private account status is LIVE.

## Requested multi-layer source audit

### 1. First boot & mobile interaction

Enumerate critical vs deferred scripts from `trade-review-loader.js`, `ui-bootstrap-v1.js` and entry `index.html`. Identify re-entrant listeners, timers or duplicate tablet/mobile callbacks with grounded code paths, not guesses. Find UI hitbox spacing/stacking risks and value flickering from multiple render writers. Verify read-only fallback on missing DOM nodes without hiding fatal schema errors.

### 2. Accounting and strategy boundary

Separate account NAV, net cash flow, investment P&L, realized loss, FX contribution and daily mark-to-market; do not infer original cost from current price or vice versa. TRI-POD origin must be basis-fixed per account, and strategy labels TRI/BIPOD/MONOPOD/NOPOD should follow source-backed state. A market-only strategy reference cannot promote to actual order authority.

### 3. Data pipeline and published state

Map observable production publisher workflows, compute shared update conflicts, old failure emails, freshness timestamps, main atomic publish and independent Pages deployment. Choose guardrails that prevent false 'LIVE', silent stale values and noisy repeated full-data commits. Distinguish a green static CI from current public endpoint proof, and from authenticated private app proof.

### 4. Security and operational cost

Review service boundaries and GitHub Pages public exposure, especially no PB private data in main or generated static assets. Suggest incremental runtime telemetry only if it can be implemented without exposing secrets or adding paid Cloud Run/model API usage. Repo source must never grant merge/deploy/trade privileges from PR text.

## Proposed acceptance format

Report: `Finding`, `Severity P0/P1/P2`, `Evidence filepath:line + reproducible test`, `Impact`, `Fix scope`, `Verification (unit/CI/browser/live)`, `Release gate`. Do not falsely claim access to decrypted user browser or broker accounts. Identify 3-5 highest-value small repairs before proposing any broad rewrite.

## Current linked work

- PR #309 still unmerged for TRI-POD historical lookahead, previously reviewed by JJOONI with B1/B2 outstanding until branch changes and tests verify closure.
- PR #310 is separate AI-collaboration V4 scaffolding, not production UI. Treat its own unmerged files as planned future operations only.
- PR #312 is separate public morning-brief source consistency review. Avoid duplicate edits across these branches.
