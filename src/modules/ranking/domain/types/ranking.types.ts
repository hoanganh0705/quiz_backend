/**
 * Ranking Domain Types and Interfaces
 *
 * Defines all types used throughout the Ranking Domain implementation.
 */

// ============================================
// ENUMS
// ============================================

export enum RankingPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
}

export enum RankingMilestone {
  TOP_10000 = 'TOP_10000',
  TOP_1000 = 'TOP_1000',
  TOP_100 = 'TOP_100',
  TOP_50 = 'TOP_50',
  TOP_10 = 'TOP_10',
  TOP_3 = 'TOP_3',
  TOP_1 = 'TOP_1',
}

export enum RankTrend {
  UP = 'up',
  DOWN = 'down',
  SAME = 'same',
  NEW = 'new',
}

export enum UserRankingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// ============================================
// BASE TYPES
// ============================================

export interface UserRankingRecord {
  userId: string;
  allTimeXp: number;
  weeklyXp: number;
  monthlyXp: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  monthlyRank: number | null;
  lastWeeklyResetAt: Date | null;
  lastMonthlyResetAt: Date | null;
  peakAllTimeRank: number | null;
  peakWeeklyRank: number | null;
  peakMonthlyRank: number | null;
  peakRankAchievedAt: Date | null;
  lastActivityAt: Date | null;
  isDirty: boolean;
  updatedAt: Date;
}

export interface RankHistoryRecord {
  historyId: string;
  userId: string;
  period: RankingPeriod;
  snapshotDate: Date;
  rank: number;
  xp: number;
  recordedAt: Date;
}

export interface RankingMilestoneRecord {
  id: string;
  userId: string;
  milestone: RankingMilestone;
  rank: number;
  achievedAt: Date;
}

// ============================================
// EVENT TYPES
// ============================================

export interface XpEarnedEvent {
  userId: string;
  amount: number;
  source: 'quiz' | 'tournament' | 'bonus';
  attemptId?: string;
  categoryId?: string;
  timestamp: Date;
}

export interface RankUpdatedEvent {
  userId: string;
  period: RankingPeriod;
  previousRank: number | null;
  newRank: number;
  xp: number;
  timestamp: Date;
}

export interface RankMilestoneEvent {
  userId: string;
  period: RankingPeriod;
  milestone: RankingMilestone;
  rank: number;
  percentile: number;
  timestamp: Date;
}

// ============================================
// LEADERBOARD TYPES
// ============================================

export interface LeaderboardEntry {
  rank: number;
  denseRank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  isTied: boolean;
  isCurrentUser?: boolean;
}

export interface LeaderboardQuery {
  period: RankingPeriod;
  limit?: number;
  offset?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalParticipants: number;
  userPosition?: UserRankPosition;
  period: PeriodInfo;
}

export interface PeriodInfo {
  type: RankingPeriod;
  start: Date;
  end: Date | null;
  resetInSeconds: number;
}

// ============================================
// USER RANK TYPES
// ============================================

export interface UserRankPosition {
  rank: number;
  denseRank: number;
  percentile: number;
  percentileLabel: string;
  xp: number;
  xpToNextRank: number | null;
  nextRankXp: number | null;
  trend: RankTrend;
  trendAmount: number | null;
}

export interface UserRankInfo {
  weekly: UserRankPosition | null;
  monthly: UserRankPosition | null;
  allTime: UserRankPosition | null;
}

export interface UserRankResponse {
  global: UserRankInfo;
  peakRanks: {
    weekly: number | null;
    monthly: number | null;
    allTime: number | null;
  };
  lastActivityAt: Date | null;
  badges: {
    isNew: boolean;
    isRisingStar: boolean;
    isActive: boolean;
  };
}

// ============================================
// SERVICE TYPES
// ============================================

export interface RankCalculationResult {
  userId: string;
  period: RankingPeriod;
  rank: number;
  denseRank: number;
  xp: number;
}

export interface ConsistencyReport {
  totalIssues: number;
  fixed: number;
  issues: RankingIssue[];
}

export interface RankingIssue {
  type: 'xp_mismatch' | 'rank_gap' | 'missing_rank';
  userId?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PeriodResetResult {
  period: RankingPeriod;
  usersAffected: number;
  archivedRecords: number;
  resetAt: Date;
}

// ============================================
// INACTIVITY TYPES (Phase 4)
// ============================================

export enum InactivityStatus {
  ACTIVE = 'active',
  WARNING = 'warning', // 30-90 days inactive
  DORMANT = 'dormant', // 90+ days inactive
}

export interface InactivityInfo {
  status: InactivityStatus;
  daysSinceLastActivity: number;
  canAppearInWeeklyMonthly: boolean;
  canAppearInAllTime: boolean;
}

export interface ReturningUserInfo {
  isReturning: boolean;
  wasInactive: boolean;
  daysSinceLastActivity: number;
  welcomeBackMessage: boolean;
  lastRankBeforeInactivity: number | null;
}

// ============================================
// NOTIFICATION TYPES (Phase 4)
// ============================================

export enum RankNotificationType {
  TOP_10_ACHIEVED = 'rank.milestone.top10',
  TOP_100_ACHIEVED = 'rank.milestone.top100',
  TOP_1000_ACHIEVED = 'rank.milestone.top1000',
  RANK_1_ACHIEVED = 'rank.milestone.rank1',
  RANK_IMPROVEMENT = 'rank.improvement',
  WEEKLY_WINNER = 'rank.weekly.winner',
  MONTHLY_WINNER = 'rank.monthly.winner',
  NEW_PERSONAL_BEST = 'rank.personal.best',
}

export interface RankNotification {
  id: string;
  userId: string;
  type: RankNotificationType;
  title: string;
  body: string;
  period: RankingPeriod;
  rank: number;
  previousRank?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date;
}

// ============================================
// BADGE TYPES (Phase 4)
// ============================================

export interface UserRankingBadges {
  isNew: boolean; // < 7 days
  isRisingStar: boolean; // Top weekly gainer
  isActive: boolean; // Activity in last 7 days
  isReturning: boolean; // Returning from inactivity
  isVeteran: boolean; // > 1 year active
}

// ============================================
// CONSTANTS
// ============================================

export const RANKING_CONSTANTS = {
  // Cache TTLs in seconds
  LEADERBOARD_CACHE_TTL: 60,
  USER_RANK_CACHE_TTL: 10,
  TOTAL_USERS_CACHE_TTL: 300,

  // Batch sizes
  INCREMENTAL_BATCH_SIZE: 100,
  MAX_LEADERBOARD_LIMIT: 500,
  DEFAULT_LEADERBOARD_LIMIT: 100,

  // Grace periods in days
  NEW_USER_GRACE_DAYS: 7,
  INACTIVITY_WARNING_DAYS: 30,
  INACTIVITY_CUTOFF_DAYS: 90,
  VETERAN_THRESHOLD_DAYS: 365,

  // Rank thresholds for milestones
  TOP_10_THRESHOLD: 10,
  TOP_100_THRESHOLD: 100,
  TOP_1000_THRESHOLD: 1000,

  // Notification thresholds
  MIN_RANK_IMPROVEMENT_FOR_NOTIFICATION: 5,

  // Percentile labels
  PERCENTILE_LABELS: {
    100: 'Top 1%',
    95: 'Top 5%',
    90: 'Top 10%',
    75: 'Top 25%',
    50: 'Top Half',
    0: 'Keep Climbing!',
  } as Record<number, string>,

  // Inactivity thresholds (in days)
  INACTIVITY_STATUS: {
    ACTIVE_MAX: 7, // Active: within 7 days
    WARNING_MAX: 90, // Warning: 8-90 days
    // Dormant: 90+ days
  },

  // Notification templates
  NOTIFICATION_TITLES: {
    top10: "You're in the Top 10!",
    top100: 'New Personal Best!',
    top1000: 'Rank Milestone!',
    rank1: "You're #1!",
    improvement: '+{amount} positions!',
    weeklyWinner: 'Weekly Winner!',
    monthlyWinner: 'Monthly Winner!',
  } as Record<string, string>,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getPercentileLabel(percentile: number): string {
  if (percentile >= 99) return RANKING_CONSTANTS.PERCENTILE_LABELS[100];
  if (percentile >= 95) return RANKING_CONSTANTS.PERCENTILE_LABELS[95];
  if (percentile >= 90) return RANKING_CONSTANTS.PERCENTILE_LABELS[90];
  if (percentile >= 75) return RANKING_CONSTANTS.PERCENTILE_LABELS[75];
  if (percentile >= 50) return RANKING_CONSTANTS.PERCENTILE_LABELS[50];
  return RANKING_CONSTANTS.PERCENTILE_LABELS[0];
}

export function calculatePercentile(rank: number, totalUsers: number): number {
  if (rank <= 0 || totalUsers <= 0) return 0;
  return Math.round(((totalUsers - rank) / totalUsers) * 10000) / 100;
}

export function getXpField(period: RankingPeriod): 'allTimeXp' | 'weeklyXp' | 'monthlyXp' {
  const mapping: Partial<Record<RankingPeriod, 'allTimeXp' | 'weeklyXp' | 'monthlyXp'>> = {
    [RankingPeriod.ALL_TIME]: 'allTimeXp',
    [RankingPeriod.WEEKLY]: 'weeklyXp',
    [RankingPeriod.MONTHLY]: 'monthlyXp',
  };

  return mapping[period] ?? 'allTimeXp';
}

export function getRankField(period: RankingPeriod): 'allTimeRank' | 'weeklyRank' | 'monthlyRank' {
  const mapping: Partial<Record<RankingPeriod, 'allTimeRank' | 'weeklyRank' | 'monthlyRank'>> = {
    [RankingPeriod.ALL_TIME]: 'allTimeRank',
    [RankingPeriod.WEEKLY]: 'weeklyRank',
    [RankingPeriod.MONTHLY]: 'monthlyRank',
  };

  return mapping[period] ?? 'allTimeRank';
}

export function getPeakRankField(
  period: RankingPeriod,
): 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank' {
  const mapping: Partial<
    Record<RankingPeriod, 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank'>
  > = {
    [RankingPeriod.ALL_TIME]: 'peakAllTimeRank',
    [RankingPeriod.WEEKLY]: 'peakWeeklyRank',
    [RankingPeriod.MONTHLY]: 'peakMonthlyRank',
  };

  return mapping[period] ?? 'peakAllTimeRank';
}
