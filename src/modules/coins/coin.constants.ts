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

export const COIN_SPEND_AMOUNTS = Object.freeze({
  PROFILE_FLAIR_SLOT_7D: 100,
  TIP_QUIZ_AUTHOR: 25,
  SUPPRESS_RECOMMENDED_30D: 50,
} as const);

export const COIN_ECONOMY_LIMITS = Object.freeze({
  DAILY_QUIZ_EARNINGS_CAP: 200,
  WALLET_BALANCE_MAX: 1_000_000,
  DAILY_TIP_COUNT_CAP: 3,
} as const);

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
