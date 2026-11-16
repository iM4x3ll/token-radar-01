// Token Radar's farm plans, derived in the page from the same record board.json was built from.
//
// Every step follows from the protocol's own figures — its category, its chains, its TVL and its
// age — never from a hand-written list of names. lib/model.ts derives the same plan when it writes
// board.json, so the page and the board agree step for step.
//
//   farmSteps(row)  the protocol's seven steps, each "action. Cost: ... Time: ..."

(function () {
  'use strict';

  /** The first chain a protocol names, or a neutral phrase. */
  function chainOf(p) {
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }

  /** How much capital one farm position needs, from the protocol's own TVL. */
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 500;
    if (p.tvl_usd >= 1e9) return 250;
    if (p.tvl_usd >= 1e8) return 150;
    return 75;
  }

  /** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 60;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 30;
  }

  /** Rough gas for one transaction on a chain, in dollars. */
  function gasFor(chain) {
    var c = chain.toLowerCase();
    if (c.indexOf('ethereum') >= 0) return 12;
    if (c.indexOf('solana') >= 0) return 0.05;
    if (c.indexOf('bitcoin') >= 0) return 3;
    var cheap = ['arbitrum', 'optimism', 'base', 'polygon', 'bsc', 'binance', 'linea', 'scroll', 'zksync', 'blast', 'mantle', 'mode', 'avalanche', 'fantom', 'gnosis'];
    for (var i = 0; i < cheap.length; i++) if (c.indexOf(cheap[i]) >= 0) return 0.5;
    return 2;
  }

  /** A gas amount as dollars and cents. */
  function gasUsd(gas) {
    return gas < 1 ? '$' + gas.toFixed(2) : '$' + Math.round(gas);
  }

  /** The category's main action: what a farmer's first position looks like. */
  function primaryAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and leave it earning.';
    if (c.indexOf('dex') >= 0) return 'Provide $' + capital + " of liquidity to " + name + "'s deepest pool on " + chain + ' and keep the LP tokens.';
    if (c.indexOf('leveraged farm') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + " into " + name + "'s highest-TVL vault on " + chain + ' and keep the receipt tokens.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + " into " + name + "'s basis vault on " + chain + ' and hold the position through one funding cycle.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('interest rate') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in your wallet.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Allocate $' + capital + ' to a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC through ' + name + ' to ' + chain + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('prediction') >= 0) return 'Fund ' + name + ' with $' + capital + ' on ' + chain + ' and place one position on a market you follow.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + " into " + name + "'s shielded pool on " + chain + ' and keep the note.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + " of " + name + "'s index token on " + chain + ' and hold it.';
    if (c.indexOf('otc') >= 0) return 'Place one $' + capital + ' order through ' + name + "'s desk on " + chain + ' and settle it.';
    if (c.indexOf('card') >= 0) return 'Order ' + name + "'s card and spend $" + capital + ' through it on ' + chain + '.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' to ' + name + "'s chain and use one of its native apps.";
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + " into " + name + "'s voting vault on " + chain + ' and cast one vote.';
    if (c.indexOf('btc') >= 0 || c.indexOf('anchor') >= 0) return 'Deposit $' + capital + ' of BTC-backed collateral with ' + name + ' on ' + chain + ' and hold the receipt.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  /** The category's second action: a different position that shows more than one kind of use. */
  function secondaryAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var half = Math.max(25, Math.round(capital / 2));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $' + half + ' against the supply on ' + name + ', use it once, and repay it within the week.';
    if (c.indexOf('dex') >= 0) return 'Stake the LP tokens in ' + name + "'s gauge or rewards contract on " + chain + ' so the position earns twice.';
    if (c.indexOf('leveraged farm') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'Split a second $' + half + ' into a different ' + name + ' vault on ' + chain + ' so two strategies carry your address.';
    if (c.indexOf('basis') >= 0) return 'Add $' + half + ' to a second ' + name + ' market on ' + chain + ' and compare the funding it pays.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('interest rate') >= 0) return 'Place one limit order and one small market order on ' + name + ' so both order types appear on your address.';
    if (c.indexOf('rwa') >= 0) return 'Hold the asset through one distribution from ' + name + ' on ' + chain + ' and record the payout.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Allocate $' + half + ' to a second ' + name + ' vault on a different chain so the address shows on two networks.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a second, smaller amount back the other way through ' + name + ' to show round-trip use.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Restake or delegate the receipt token through ' + name + ' once, if its app offers it.';
    if (c.indexOf('prediction') >= 0) return 'Take the other side of one small market on ' + name + ' so your address trades both ways.';
    if (c.indexOf('stable') >= 0) return 'Swap $' + half + ' between the stable asset and USDC on ' + name + ' once to show mint and redeem use.';
    if (c.indexOf('insurance') >= 0) return 'File one test claim or quote request with ' + name + ' so the policy is exercised, not just bought.';
    if (c.indexOf('payment') >= 0) return 'Send one payment out and receive one back through ' + name + ' on ' + chain + '.';
    if (c.indexOf('privacy') >= 0) return 'Withdraw a small amount from ' + name + "'s pool to a fresh address to complete the private round trip.";
    if (c.indexOf('index') >= 0) return 'Rebalance once: sell a tenth of the index on ' + name + ' and buy it back after a day.';
    if (c.indexOf('otc') >= 0) return 'Settle a second, smaller order through ' + name + ' at a different price to show repeat use.';
    if (c.indexOf('card') >= 0) return 'Pay one bill or subscription with ' + name + "'s card so the spend is real, not a test.";
    if (c.indexOf('chain') >= 0) return 'Stake $' + half + ' with a validator on ' + name + "'s chain and keep the delegation.";
    if (c.indexOf('governance') >= 0) return 'Vote on a second proposal on ' + name + ' in a later week so the voting history is not one-off.';
    if (c.indexOf('btc') >= 0 || c.indexOf('anchor') >= 0) return 'Use the receipt token as collateral once on ' + name + ' and unwind it the same week.';
    return 'Use ' + name + ' a second way on ' + chain + ': a swap, a vote or a second deposit of $' + half + '.';
  }

  /** The category's weekly action: the small repeat that keeps the address active across snapshots. */
  function weeklyAction(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'supply or borrow a small amount on ' + name;
    if (c.indexOf('dex') >= 0) return 'swap or add a little liquidity on ' + name;
    if (c.indexOf('leveraged farm') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'compound the rewards or top up the vault on ' + name;
    if (c.indexOf('basis') >= 0) return 'check the funding rate and top up the basis position on ' + name;
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('interest rate') >= 0) return 'adjust the hedge or place one small trade on ' + name;
    if (c.indexOf('rwa') >= 0) return 'check the distribution and hold the asset on ' + name;
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'review the vault allocation on ' + name + ' and rebalance a little';
    if (c.indexOf('bridge') >= 0) return 'bridge a small amount through ' + name;
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'claim and restake the staking rewards on ' + name;
    if (c.indexOf('prediction') >= 0) return 'place one small position on a fresh market on ' + name;
    if (c.indexOf('stable') >= 0) return 'mint or redeem a small amount on ' + name;
    if (c.indexOf('insurance') >= 0) return 'check the policy and renew or extend cover on ' + name;
    if (c.indexOf('payment') >= 0) return 'route one real payment through ' + name;
    if (c.indexOf('privacy') >= 0) return 'make one shielded deposit or withdrawal on ' + name;
    if (c.indexOf('index') >= 0) return 'check the index and top it up a little on ' + name;
    if (c.indexOf('otc') >= 0) return 'settle one small order through ' + name;
    if (c.indexOf('card') >= 0) return 'spend through ' + name + "'s card on something you would buy anyway";
    if (c.indexOf('chain') >= 0) return 'use one native app on ' + name + "'s chain";
    if (c.indexOf('governance') >= 0) return 'vote on any live proposal on ' + name;
    if (c.indexOf('btc') >= 0 || c.indexOf('anchor') >= 0) return 'check the collateral ratio on ' + name;
    return 'make one deposit, swap or vote on ' + name;
  }

  /** A step as one string: its action, then its cost and time, within 20..600 characters. */
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }

  /** A protocol's farm plan: seven steps, each an action with a cost and a time. */
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(chain);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Set up a fresh wallet on ' + chain + ' holding only your farm funds, and fund it with $' + capital + ' plus about ' + gasUsd(gas) + ' for gas. Keep the seed phrase offline and never share it.', cost: 'about ' + gasUsd(gas) + ' of gas for the first transactions', time: '10 minutes' },
      { text: primaryAction(p, capital, chain), cost: '$' + capital + ' of capital and about ' + gasUsd(gas) + ' of gas', time: '15 minutes to set up' },
      { text: secondaryAction(p, capital, chain), cost: 'about ' + gasUsd(gas) + ' of gas', time: '15 minutes' },
      { text: 'Repeat one qualifying action each week — ' + weeklyAction(p) + ' — so your address stays active across snapshots.', cost: 'about ' + gasUsd(gas) + ' of gas a week', time: '10 minutes a week' },
      { text: "Open " + p.name + "'s points or rewards page and confirm your position is counted; save a screenshot of the balance for your farm log.", cost: 'no fee to check', time: '10 minutes' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'When you exit, claim only through the link ' + p.name + ' itself publishes, then withdraw in one transaction and log the dates and amounts.', cost: 'about ' + gasUsd(gas) + ' of gas to withdraw', time: '15 minutes' }
    ].map(stepText);
  }

  window.farmSteps = farmSteps;
})();
