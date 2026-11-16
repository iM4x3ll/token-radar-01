// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// pre-token protocols below the watchlist floor that the watchlist's own rule would keep: a wrapped,
// staked or bridged product of a token that already trades is not a launch ahead, so bridges,
// liquid-staking products, versioned pools and exchange listings are left out of the early rows too.
// A protocol is pre-token when its record carries no token (no market cap, no CoinGecko id, no
// symbol); the live-token protocols are kept apart and shown with the market's own values.
//
// Implied value is derived from the snapshot's own figures, never from a hand-kept list of names:
//
//   multiple   = the category's launched comparables: the median mcap/TVL of the snapshot's
//                protocols in that category that already trade, with each ratio winsorized at
//                the 75th percentile of the launched set (a small-TVL token can trade at tens
//                of times its TVL, and one such ratio must not set a whole category's price),
//                shrunk toward the global median when the category has few comparables,
//                clamped to [0.02, 1.50]
//   base       = tvl_usd x multiple
//   growth     = clamp(change_7d, -50, 100) per cent (0 when unreported)
//   growthMult = 1 + (growth / 100) x 0.4
//   maturity   = 0.6 + 0.4 x sqrt(min(age_days, 1095) / 1095)   (age unknown: 365 days)
//   chains     = 1 + 0.03 x min(ln(chain count), ln(10))
//   implied    = max(1, round(base x growthMult x maturity x chains))
//
// The category multiple is the model's claim about what the market pays for a dollar of TVL in that
// kind of protocol. A DEX's token trades at a different multiple of its TVL than a lending market's,
// and the snapshot's own launched protocols say what those multiples are.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_weight: number;
  chain_cap: number;
  shrink_prior: number;
  winsor_pct: number;
  multiple_floor: number;
  multiple_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.4,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_weight: 0.03,
  chain_cap: 10,
  shrink_prior: 5,
  winsor_pct: 0.75,
  multiple_floor: 0.02,
  multiple_cap: 1.5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** The most pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple: number;
    multiple_category: string;
    comparables: number;
    category_median: number | null;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page derives the farm plan from the same record. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  comparables: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  mcap_tvl: number | null;
  change_7d: number | null;
}

/** One category's launched comparables, as the methodology panel shows them. */
export interface ComparableRow {
  category: string;
  n: number;
  median: number | null;
  multiple: number;
}

/** Everything the dashboard needs: the board, the live set, the comparables and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_median: number;
  comparables: ComparableRow[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted-or-unsorted list of numbers; null when the list is empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

// ---------------------------------------------------------------- comparables

/** The launched comparables of one category: how many, their median mcap/TVL, the multiple used. */
export interface CategoryMultiple {
  n: number;
  median: number | null;
  multiple: number;
}

/** The p-th percentile of a list of numbers, nearest-rank; null when the list is empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

/**
 * The category multiples, derived from the snapshot's own launched protocols: for each category the
 * median mcap/TVL of the protocols in it that already trade with a recorded market cap, with each
 * ratio winsorized at the 75th percentile of the launched set, shrunk toward the global median with
 * a pseudo-count of `shrink_prior` so a category with one or two comparables does not set the
 * board's prices on its own, then clamped to [multiple_floor, multiple_cap]. A category with no
 * launched protocol takes the global median.
 */
export function comparableMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { global: number; byCategory: Map<string, CategoryMultiple> } {
  const launched = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratios = launched.map((p) => p.mcap_usd! / p.tvl_usd);
  const cap = percentile(ratios, model.winsor_pct) ?? 1;
  const winsorized = ratios.map((r) => Math.min(r, cap));
  const global = median(winsorized) ?? 0.25;
  const byCategory = new Map<string, number[]>();
  launched.forEach((p, i) => {
    const key = p.category ?? 'Other';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [winsorized[i]!]);
    else list.push(winsorized[i]!);
  });
  const out = new Map<string, CategoryMultiple>();
  for (const [category, list] of byCategory) {
    const med = median(list)!;
    const weight = list.length / (list.length + model.shrink_prior);
    const shrunk = weight * med + (1 - weight) * global;
    out.set(category, { n: list.length, median: med, multiple: Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk)) });
  }
  return { global, byCategory: out };
}

/** The multiple one category gets: its shrunk median, or the global median when it has no comparables. */
export function multipleFor(category: string | null, multiples: { global: number; byCategory: Map<string, CategoryMultiple> }): { multiple: number; n: number; median: number | null } {
  const found = multiples.byCategory.get(category ?? 'Other');
  if (found === undefined) return { multiple: multiples.global, n: 0, median: null };
  return { multiple: found.multiple, n: found.n, median: found.median };
}

// ---------------------------------------------------------------- implied value

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { global: number; byCategory: Map<string, CategoryMultiple> },
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; comparables: number; categoryMedian: number | null; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, n, median: categoryMedian } = multipleFor(protocol.category, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + model.maturity_range * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const chainCount = Math.max(protocol.chains.length, 1);
  const chainMult = 1 + model.chain_weight * Math.min(Math.log(chainCount), Math.log(model.chain_cap));
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * chainMult));
  return { implied, multiple, comparables: n, categoryMedian, growthPct, growthMult, maturityMult, chainMult, age };
}

// ---------------------------------------------------------------- rankability

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A name beginning with an exchange's name is that exchange's product, not a protocol of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
/** A whole word wrapped, staked or staking marks a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories that are wrapped, staked or bridged products of tokens that already trade. */
const WRAPPED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades — the watchlist's own rule, applied to the early rows too.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

// ---------------------------------------------------------------- the board

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = comparableMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug in it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      // The multiple is carried at full precision: the page recomputes the row from it, and a
      // rounded multiple would make the recompute differ from the board by a few dollars.
      multiple: s.v.multiple,
      multiple_category: s.p.category ?? 'Other',
      comparables: s.v.comparables,
      category_median: s.v.categoryMedian === null ? null : round4(s.v.categoryMedian),
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      chain_multiplier: round4(s.v.chainMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

// ---------------------------------------------------------------- farm plans

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL: bigger pools, more competition for points. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  return 75;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 60;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** Rough gas for one transaction on a chain, in dollars: mainnet is dear, rollups and Solana are cheap. */
function gasFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 12;
  if (c.includes('solana')) return 0.05;
  if (c.includes('bitcoin')) return 3;
  if (['arbitrum', 'optimism', 'base', 'polygon', 'bsc', 'binance', 'linea', 'scroll', 'zksync', 'blast', 'mantle', 'mode', 'avalanche', 'fantom', 'gnosis'].some((k) => c.includes(k))) return 0.5;
  return 2;
}

/** A gas amount as dollars and cents. */
function gasUsd(gas: number): string {
  return gas < 1 ? `$${gas.toFixed(2)}` : `$${Math.round(gas)}`;
}

/** The category's main action: what a farmer's first position looks like. */
function primaryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and leave it earning.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the LP tokens.`;
  if (c.includes('leveraged farm') || c.includes('yield') || c.includes('farm')) return `Deposit $${capital} into ${name}'s highest-TVL vault on ${chain} and keep the receipt tokens.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and hold the position through one funding cycle.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('interest rate')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
  if (c.includes('curator') || c.includes('allocator')) return `Allocate $${capital} to a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC through ${name} to ${chain} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} on ${chain} and place one position on a market you follow.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the receipts.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name}'s shielded pool on ${chain} and keep the note.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index token on ${chain} and hold it.`;
  if (c.includes('otc')) return `Place one $${capital} order through ${name}'s desk on ${chain} and settle it.`;
  if (c.includes('card')) return `Order ${name}'s card and spend $${capital} through it on ${chain}.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${name}'s chain and use one of its native apps.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name}'s voting vault on ${chain} and cast one vote.`;
  if (c.includes('btc') || c.includes('anchor')) return `Deposit $${capital} of BTC-backed collateral with ${name} on ${chain} and hold the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second action: a different position that shows more than one kind of use. */
function secondaryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(25, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${half} against the supply on ${name}, use it once, and repay it within the week.`;
  if (c.includes('dex')) return `Stake the LP tokens in ${name}'s gauge or rewards contract on ${chain} so the position earns twice.`;
  if (c.includes('leveraged farm') || c.includes('yield') || c.includes('farm')) return `Split a second $${half} into a different ${name} vault on ${chain} so two strategies carry your address.`;
  if (c.includes('basis')) return `Add $${half} to a second ${name} market on ${chain} and compare the funding it pays.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('interest rate')) return `Place one limit order and one small market order on ${name} so both order types appear on your address.`;
  if (c.includes('rwa')) return `Hold the asset through one distribution from ${name} on ${chain} and record the payout.`;
  if (c.includes('curator') || c.includes('allocator')) return `Allocate $${half} to a second ${name} vault on a different chain so the address shows on two networks.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back the other way through ${name} to show round-trip use.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake or delegate the receipt token through ${name} once, if its app offers it.`;
  if (c.includes('prediction')) return `Take the other side of one small market on ${name} so your address trades both ways.`;
  if (c.includes('stable')) return `Swap $${half} between the stable asset and USDC on ${name} once to show mint and redeem use.`;
  if (c.includes('insurance')) return `File one test claim or quote request with ${name} so the policy is exercised, not just bought.`;
  if (c.includes('payment')) return `Send one payment out and receive one back through ${name} on ${chain}.`;
  if (c.includes('privacy')) return `Withdraw a small amount from ${name}'s pool to a fresh address to complete the private round trip.`;
  if (c.includes('index')) return `Rebalance once: sell a tenth of the index on ${name} and buy it back after a day.`;
  if (c.includes('otc')) return `Settle a second, smaller order through ${name} at a different price to show repeat use.`;
  if (c.includes('card')) return `Pay one bill or subscription with ${name}'s card so the spend is real, not a test.`;
  if (c.includes('chain')) return `Stake $${half} with a validator on ${name}'s chain and keep the delegation.`;
  if (c.includes('governance')) return `Vote on a second proposal on ${name} in a later week so the voting history is not one-off.`;
  if (c.includes('btc') || c.includes('anchor')) return `Use the receipt token as collateral once on ${name} and unwind it the same week.`;
  return `Use ${name} a second way on ${chain}: a swap, a vote or a second deposit of $${half}.`;
}

/** The category's weekly action: the small repeat that keeps the address active across snapshots. */
function weeklyAction(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `supply or borrow a small amount on ${name}`;
  if (c.includes('dex')) return `swap or add a little liquidity on ${name}`;
  if (c.includes('leveraged farm') || c.includes('yield') || c.includes('farm')) return `compound the rewards or top up the vault on ${name}`;
  if (c.includes('basis')) return `check the funding rate and top up the basis position on ${name}`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('interest rate')) return `adjust the hedge or place one small trade on ${name}`;
  if (c.includes('rwa')) return `check the distribution and hold the asset on ${name}`;
  if (c.includes('curator') || c.includes('allocator')) return `review the vault allocation on ${name} and rebalance a little`;
  if (c.includes('bridge')) return `bridge a small amount through ${name}`;
  if (c.includes('staking') || c.includes('restak')) return `claim and restake the staking rewards on ${name}`;
  if (c.includes('prediction')) return `place one small position on a fresh market on ${name}`;
  if (c.includes('stable')) return `mint or redeem a small amount on ${name}`;
  if (c.includes('insurance')) return `check the policy and renew or extend cover on ${name}`;
  if (c.includes('payment')) return `route one real payment through ${name}`;
  if (c.includes('privacy')) return `make one shielded deposit or withdrawal on ${name}`;
  if (c.includes('index')) return `check the index and top it up a little on ${name}`;
  if (c.includes('otc')) return `settle one small order through ${name}`;
  if (c.includes('card')) return `spend through ${name}'s card on something you would buy anyway`;
  if (c.includes('chain')) return `use one native app on ${name}'s chain`;
  if (c.includes('governance')) return `vote on any live proposal on ${name}`;
  if (c.includes('btc') || c.includes('anchor')) return `check the collateral ratio on ${name}`;
  return `make one deposit, swap or vote on ${name}`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names — the dashboard's farm.js derives the same plan from the same record.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Set up a fresh wallet on ${chain} holding only your farm funds, and fund it with $${capital} plus about ${gasUsd(gas)} for gas. Keep the seed phrase offline and never share it.`,
      cost: `about ${gasUsd(gas)} of gas for the first transactions`,
      time: '10 minutes',
    },
    {
      text: primaryAction(p, capital, chain),
      cost: `$${capital} of capital and about ${gasUsd(gas)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondaryAction(p, capital, chain),
      cost: `about ${gasUsd(gas)} of gas`,
      time: '15 minutes',
    },
    {
      text: `Repeat one qualifying action each week — ${weeklyAction(p)} — so your address stays active across snapshots.`,
      cost: `about ${gasUsd(gas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Open ${p.name}'s points or rewards page and confirm your position is counted; save a screenshot of the balance for your farm log.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `When you exit, claim only through the link ${p.name} itself publishes, then withdraw in one transaction and log the dates and amounts.`,
      cost: `about ${gasUsd(gas)} of gas to withdraw`,
      time: '15 minutes',
    },
  ];
}

// ---------------------------------------------------------------- live set and radar data

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan derived in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    multiple: row.model.multiple,
    comparables: row.model.comparables,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = comparableMultiples(snapshot, model);
  const comparables: ComparableRow[] = [...multiples.byCategory.entries()]
    .map(([category, v]) => ({ category, n: v.n, median: v.median === null ? null : round4(v.median), multiple: round4(v.multiple) }))
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : 1));
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_median: round4(multiples.global),
    comparables,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- snapshot parsing

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

// ---------------------------------------------------------------- validation and output

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
