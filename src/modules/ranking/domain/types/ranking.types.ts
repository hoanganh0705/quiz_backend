/**
 * Ranking Domain Types and Interfaces
 *
 * Defines all types used throughout the Ranking Domain implementation.
 */

// ============================================
// ENUMS
// ============================================

export enum RankingPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
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
  periodStart: Date | null;
  periodEnd: Date | null;
  xpAtStart: number;
  xpAtEnd: number;
  rankAtEnd: number | null;
  peakRank: number | null;
  peakXp: number | null;
  createdAt: Date;
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
  milestone: 'top10' | 'top100' | 'top1000' | 'rank1';
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

  // Rank thresholds for milestones
  TOP_10_THRESHOLD: 10,
  TOP_100_THRESHOLD: 100,
  TOP_1000_THRESHOLD: 1000,

  // Percentile labels
  PERCENTILE_LABELS: {
    100: 'Top 1%',
    95: 'Top 5%',
    90: 'Top 10%',
    75: 'Top 25%',
    50: 'Top Half',
    0: 'Keep Climbing!',
  } as Record<number, string>,
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
  const mapping: Record<RankingPeriod, 'allTimeXp' | 'weeklyXp' | 'monthlyXp'> = {
    [RankingPeriod.ALL_TIME]: 'allTimeXp',
    [RankingPeriod.WEEKLY]: 'weeklyXp',
    [RankingPeriod.MONTHLY]: 'monthlyXp',
  };
  return mapping[period];
}

export function getRankField(period: RankingPeriod): 'allTimeRank' | 'weeklyRank' | 'monthlyRank' {
  const mapping: Record<RankingPeriod, 'allTimeRank' | 'weeklyRank' | 'monthlyRank'> = {
    [RankingPeriod.ALL_TIME]: 'allTimeRank',
    [RankingPeriod.WEEKLY]: 'weeklyRank',
    [RankingPeriod.MONTHLY]: 'monthlyRank',
  };
  return mapping[period];
}

export function getPeakRankField(period: RankingPeriod): 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank' {
  const mapping: Record<RankingPeriod, 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank'> = {
    [RankingPeriod.ALL_TIME]: 'peakAllTimeRank',
    [RankingPeriod.WEEKLY]: 'peakWeeklyRank',
    [RankingPeriod.MONTHLY]: 'peakMonthlyRank',
  };
  return mapping[period];
}
