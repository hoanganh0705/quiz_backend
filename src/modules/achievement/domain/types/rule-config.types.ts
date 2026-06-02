/**
 * Rule Configuration Types and Validation
 *
 * Defines the structure and validation for badge rule configurations.
 * Supports extensibility without schema changes.
 */

// ============================================
// RULE TYPE DEFINITIONS
// ============================================

export enum RuleType {
  COUNT = 'count',
  RANK = 'rank',
  RANK_PERIOD = 'rank_period',
  STREAK = 'streak',
  TOURNAMENT_WIN = 'tournament_win',
  PERFECT_SCORE = 'perfect_score',
  XP_TOTAL = 'xp_total',
  SEASONAL = 'seasonal',
  SOCIAL = 'social',
}

// ============================================
// OPERATOR DEFINITIONS
// ============================================

export enum RuleOperator {
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN_OR_EQUAL = '<=',
  EQUAL = '==',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  NOT_EQUAL = '!=',
}

// ============================================
// METRIC DEFINITIONS
// ============================================

export enum RuleMetric {
  // Count-based metrics
  QUIZZES_COMPLETED = 'quizzes_completed',
  PERFECT_SCORES = 'perfect_scores',
  TOURNAMENTS_WON = 'tournaments_won',
  TOURNAMENTS_PARTICIPATED = 'tournaments_participated',

  // Rank-based metrics
  PERIOD_RANK = 'period_rank',
  ALL_TIME_RANK = 'all_time_rank',
  CURRENT_RANK = 'current_rank',
  BEST_RANK = 'best_rank',

  // Streak-based metrics
  STREAK_DAYS = 'streak_days',
  CURRENT_STREAK = 'current_streak',
  LONGEST_STREAK = 'longest_streak',

  // XP-based metrics
  XP_TOTAL = 'xp_total',
  XP_EARNED = 'xp_earned',
  WEEKLY_XP = 'weekly_xp',
  MONTHLY_XP = 'monthly_xp',

  // Score-based metrics
  SCORE_PERCENTAGE = 'score_percentage',
  BEST_SCORE = 'best_score',
  AVERAGE_SCORE = 'average_score',

  // Time-based metrics
  TIME_TAKEN_MS = 'time_taken_ms',
  AVG_TIME_PER_QUESTION = 'avg_time_per_question',

  // Social metrics
  FRIENDS_COUNT = 'friends_count',
  CHALLENGES_WON = 'challenges_won',

  // Event metrics
  EVENTS_PARTICIPATED = 'events_participated',
  SEASONAL_COMPLETION = 'seasonal_completion',
}

// ============================================
// RULE CONFIGURATION INTERFACES
// ============================================

/**
 * Base rule configuration.
 */
export interface BaseRuleConfig {
  metric: RuleMetric;
  threshold: number;
  operator: RuleOperator;
}

/**
 * Count-based rule: "Complete X quizzes"
 */
export interface CountRuleConfig extends BaseRuleConfig {
  metric:
    | RuleMetric.QUIZZES_COMPLETED
    | RuleMetric.PERFECT_SCORES
    | RuleMetric.TOURNAMENTS_WON
    | RuleMetric.TOURNAMENTS_PARTICIPATED;
}

/**
 * Rank-based rule: "Reach rank X"
 */
export interface RankRuleConfig extends BaseRuleConfig {
  metric:
    | RuleMetric.PERIOD_RANK
    | RuleMetric.ALL_TIME_RANK
    | RuleMetric.CURRENT_RANK
    | RuleMetric.BEST_RANK;
  period?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

/**
 * Rank period rule: "Reach top X in period"
 */
export interface RankPeriodRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.PERIOD_RANK;
  period: 'daily' | 'weekly' | 'monthly';
}

/**
 * Streak-based rule: "Maintain X day streak"
 */
export interface StreakRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.STREAK_DAYS | RuleMetric.CURRENT_STREAK | RuleMetric.LONGEST_STREAK;
  gracePeriodDays?: number;
}

/**
 * Tournament win rule: "Win X tournaments"
 */
export interface TournamentWinRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.TOURNAMENTS_WON;
  tournamentType?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Perfect score rule: "Get X perfect scores"
 */
export interface PerfectScoreRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.PERFECT_SCORES;
  quizCategory?: string;
}

/**
 * XP total rule: "Earn X total XP"
 */
export interface XpTotalRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.XP_TOTAL | RuleMetric.WEEKLY_XP | RuleMetric.MONTHLY_XP;
}

/**
 * Seasonal rule: "Complete seasonal event"
 */
export interface SeasonalRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.SEASONAL_COMPLETION | RuleMetric.EVENTS_PARTICIPATED;
  seasonId?: string;
  eventType?: string;
}

/**
 * Social rule: "Have X friends" or "Win X challenges"
 */
export interface SocialRuleConfig extends BaseRuleConfig {
  metric: RuleMetric.FRIENDS_COUNT | RuleMetric.CHALLENGES_WON;
}

// ============================================
// UNION TYPE
// ============================================

export type RuleConfig =
  | CountRuleConfig
  | RankRuleConfig
  | RankPeriodRuleConfig
  | StreakRuleConfig
  | TournamentWinRuleConfig
  | PerfectScoreRuleConfig
  | XpTotalRuleConfig
  | SeasonalRuleConfig
  | SocialRuleConfig;

// ============================================
// VALIDATION
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a rule configuration.
 */
export function validateRuleConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate metric
  if (!cfg.metric || typeof cfg.metric !== 'string') {
    errors.push('metric is required and must be a string');
  } else if (!Object.values(RuleMetric).includes(cfg.metric as RuleMetric)) {
    errors.push(`Invalid metric: ${cfg.metric}`);
  }

  // Validate threshold
  if (cfg.threshold === undefined || typeof cfg.threshold !== 'number') {
    errors.push('threshold is required and must be a number');
  } else if (cfg.threshold < 0) {
    errors.push('threshold must be non-negative');
  }

  // Validate operator
  if (!cfg.operator || typeof cfg.operator !== 'string') {
    errors.push('operator is required and must be a string');
  } else if (!Object.values(RuleOperator).includes(cfg.operator as RuleOperator)) {
    errors.push(`Invalid operator: ${cfg.operator}`);
  }

  // Validate period for rank-based rules
  const metric = cfg.metric as RuleMetric;
  if (
    metric === RuleMetric.PERIOD_RANK ||
    metric === RuleMetric.WEEKLY_XP ||
    metric === RuleMetric.MONTHLY_XP
  ) {
    if (cfg.period && !['daily', 'weekly', 'monthly', 'all_time'].includes(cfg.period as string)) {
      const periodValue =
        typeof cfg.period === 'string' ? cfg.period : (JSON.stringify(cfg.period) ?? 'unknown');
      errors.push(`Invalid period: ${periodValue}`);
    }
  }

  // Validate grace period for streak rules
  if (
    metric === RuleMetric.STREAK_DAYS ||
    metric === RuleMetric.CURRENT_STREAK ||
    metric === RuleMetric.LONGEST_STREAK
  ) {
    if (cfg.gracePeriodDays !== undefined && typeof cfg.gracePeriodDays !== 'number') {
      errors.push('gracePeriodDays must be a number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// CONFIGURATION BUILDER
// ============================================

export interface RuleConfigBuilder {
  withMetric(metric: RuleMetric): this;
  withThreshold(threshold: number): this;
  withOperator(operator: RuleOperator): this;
  withPeriod(period: 'daily' | 'weekly' | 'monthly' | 'all_time'): this;
  withGracePeriod(days: number): this;
  build(): RuleConfig;
}

export function createRuleConfigBuilder(): RuleConfigBuilder {
  let metric: RuleMetric = RuleMetric.QUIZZES_COMPLETED;
  let threshold: number = 1;
  let operator: RuleOperator = RuleOperator.GREATER_THAN_OR_EQUAL;
  let period: 'daily' | 'weekly' | 'monthly' | 'all_time' | undefined;
  let gracePeriodDays: number | undefined;

  const builder: RuleConfigBuilder = {
    withMetric(this: RuleConfigBuilder, m: RuleMetric): RuleConfigBuilder {
      metric = m;
      return this;
    },
    withThreshold(this: RuleConfigBuilder, t: number): RuleConfigBuilder {
      threshold = t;
      return this;
    },
    withOperator(this: RuleConfigBuilder, o: RuleOperator): RuleConfigBuilder {
      operator = o;
      return this;
    },
    withPeriod(
      this: RuleConfigBuilder,
      p: 'daily' | 'weekly' | 'monthly' | 'all_time',
    ): RuleConfigBuilder {
      period = p;
      return this;
    },
    withGracePeriod(this: RuleConfigBuilder, days: number): RuleConfigBuilder {
      gracePeriodDays = days;
      return this;
    },
    build(): RuleConfig {
      const config: Record<string, unknown> = {
        metric,
        threshold,
        operator,
      };

      if (period) {
        config.period = period;
      }

      if (gracePeriodDays !== undefined) {
        config.gracePeriodDays = gracePeriodDays;
      }

      return config as unknown as RuleConfig;
    },
  };

  return builder;
}

// ============================================
// EXAMPLE CONFIGURATIONS
// ============================================

export const EXAMPLE_RULE_CONFIGS = {
  // Complete 10 quizzes
  quizCount: createRuleConfigBuilder()
    .withMetric(RuleMetric.QUIZZES_COMPLETED)
    .withThreshold(10)
    .withOperator(RuleOperator.GREATER_THAN_OR_EQUAL)
    .build(),

  // Reach top 10 weekly rank
  topWeeklyRank: createRuleConfigBuilder()
    .withMetric(RuleMetric.PERIOD_RANK)
    .withThreshold(10)
    .withOperator(RuleOperator.LESS_THAN_OR_EQUAL)
    .withPeriod('weekly')
    .build(),

  // Maintain 7 day streak
  weekStreak: createRuleConfigBuilder()
    .withMetric(RuleMetric.STREAK_DAYS)
    .withThreshold(7)
    .withOperator(RuleOperator.GREATER_THAN_OR_EQUAL)
    .build(),

  // Win 3 tournaments
  tournamentWins: createRuleConfigBuilder()
    .withMetric(RuleMetric.TOURNAMENTS_WON)
    .withThreshold(3)
    .withOperator(RuleOperator.GREATER_THAN_OR_EQUAL)
    .build(),

  // Get 5 perfect scores
  perfectScores: createRuleConfigBuilder()
    .withMetric(RuleMetric.PERFECT_SCORES)
    .withThreshold(5)
    .withOperator(RuleOperator.GREATER_THAN_OR_EQUAL)
    .build(),

  // Earn 1000 XP
  xpTotal: createRuleConfigBuilder()
    .withMetric(RuleMetric.XP_TOTAL)
    .withThreshold(1000)
    .withOperator(RuleOperator.GREATER_THAN_OR_EQUAL)
    .build(),
};
