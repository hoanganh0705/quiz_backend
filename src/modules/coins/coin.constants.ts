// =============================================================================
// Coin economy constants — single source of truth
//
// Every reward and spend amount in the coin economy MUST come from this
// file. No magic numbers scattered across services. See design doc §6
// (Coin Earning Rules) and §7 (Coin Spending Rules) for the product
// rationale; this file is the implementation anchor.
//
// Consumers (post-Phase 3)
//   - `CoinIngestionService`          reads `COIN_REWARDS`
//   - `CoinSpendService`              reads `COIN_SPEND_AMOUNTS`
//   - `attempt-coin-listener`         reads `COIN_REWARDS.QUIZ_COMPLETION_*`
//   - `streak-coin-listener`          reads `COIN_REWARDS.STREAK_MILESTONE_*`
//   - `tournament-coin-listener`      reads `COIN_REWARDS.TOURNAMENT_TOP_N`
//   - `coin.controller` (POST tip)    reads `COIN_SPEND_AMOUNTS.TIP_QUIZ_AUTHOR`
//   - `coin.controller` (POST flair)  reads `COIN_SPEND_AMOUNTS.PROFILE_FLAIR_SLOT_7D`
//   - `coin.controller` (POST suppress) reads `COIN_SPEND_AMOUNTS.SUPPRESS_RECOMMENDED_30D`
// =============================================================================

/**
 * Coin amounts granted per earning event. Values are in whole coins
 * (integer). All amounts are positive; debits live in `COIN_SPEND_AMOUNTS`.
 *
 * Daily-cap enforcement
 *   - Only the QUIZ_* keys are subject to the 200-coin daily earning cap
 *     implemented in `CoinIngestionService`. All others are once-per-milestone
 *     and bypass the cap by construction.
 */
export const COIN_REWARDS = Object.freeze({
  QUIZ_COMPLETION_REWARD: 5,
  QUIZ_PERFECT_BONUS: 10,
  DAILY_CHALLENGE_REWARD: 15,
  STREAK_MILESTONE_3_DAYS: 25,
  STREAK_MILESTONE_5_DAYS: 50,
  STREAK_MILESTONE_7_DAYS: 75,
  STREAK_MILESTONE_14_DAYS: 150,
  BADGE_REWARD: 20,
  TOURNAMENT_PLACEMENT_REWARD: Object.freeze({
    1: 100,
    2: 60,
    3: 30,
  } as const),
} as const);

/**
 * Coin amounts debited per spending event. All values are positive
 * integers; callers pass them to `CoinSpendService` which is responsible
 * for flipping the sign before persisting.
 */
export const COIN_SPEND_AMOUNTS = Object.freeze({
  PROFILE_FLAIR_SLOT_7D: 100,
  TIP_QUIZ_AUTHOR: 25,
  SUPPRESS_RECOMMENDED_30D: 50,
} as const);

/**
 * Economy guard-rails. These are deliberately not config-driven — they
 * encode product policy (anti-abuse) and changing them is a deliberate
 * product decision that must go through code review.
 */
export const COIN_ECONOMY_LIMITS = Object.freeze({
  /** Soft daily earning cap on the QUIZ_* reasons. */
  DAILY_QUIZ_EARNINGS_CAP: 200,
  /** Hard ceiling enforced by `user_wallets.balance <= 1_000_000`. */
  WALLET_BALANCE_MAX: 1_000_000,
  /** Maximum tips a single user can send in a UTC day. */
  DAILY_TIP_COUNT_CAP: 3,
} as const);

/**
 * Idempotency-key prefixes. See design doc §9.5. Producers must use
 * the helper `buildCoinIdempotencyKey(prefix, ...parts)` (Phase 3)
 * to assemble the full key.
 */
export const COIN_IDEMPOTENCY_KEY_PREFIXES = Object.freeze({
  ATTEMPT_REWARD: 'coin:attempt',
  DAILY_CHALLENGE_REWARD: 'coin:daily',
  STREAK_MILESTONE: 'coin:streak',
  BADGE_REWARD: 'coin:badge',
  TOURNAMENT_PLACEMENT: 'coin:tournament',
  TIP_DEBIT: 'coin:tip',
  FLAIR_DEBIT: 'coin:flair',
  SUPPRESS_DEBIT: 'coin:suppress',
  ADMIN_ADJUSTMENT: 'coin:admin',
} as const);

export type CoinRewardKey = keyof typeof COIN_REWARDS;
export type CoinSpendKey = keyof typeof COIN_SPEND_AMOUNTS;
