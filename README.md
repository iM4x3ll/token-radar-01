# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iM4x3ll/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iM4x3ll/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot, finds the protocols that record no token, and ranks them by an implied launch value — each with the steps to farm it. An entry for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## What it builds

`main.ts` (Node 22, standard library only) reads the snapshot, scores every rankable pre-token protocol, and writes a static dashboard:

- **board.json** — 178 rows: all 40 watchlist protocols plus the 138 rankable pre-token protocols below the $50M floor, ranked by implied value, each with a 7-step farm plan.
- **dashboard/** — a static page (no network): sortable, filterable board, a detail view per protocol with the model's full breakdown, a live-token view, and the methodology.
- **screenshots/** — the board, a protocol detail view, and a filtered view.
- **dossier.json** — built with the vendored `vendor/makefun-board.ts`.

## The model (radar-2)

Implied value follows from the snapshot's own figures, never from a hand-kept list of names:

```
implied = round( tvl_usd × multiple(category)
  × (1 + clamp(change_7d, -50, 100) / 100 × 0.4)
  × (0.6 + 0.4 × √(min(age_days, 1095) / 1095))
  × (1 + 0.03 × min(ln(chains), ln(10))) )
```

The multiple is the category's own market price for a dollar of TVL: the median mcap/TVL of the snapshot's launched protocols in that category, ratios winsorized at the 75th percentile, shrunk toward the global median when the category has few comparables, clamped to [0.02, 1.50]. Bridges, liquid-staking products, versioned pools and exchange listings are left out — the watchlist's own rule, applied to the early rows too, because a wrapped or staked product of a token that already trades is not a launch ahead.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Then open `out/dashboard/index.html` (it reads `out/data.js`, no network).
