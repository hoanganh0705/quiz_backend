/**
 * Notification Domain Types
 */

// ============================================
// ENUMS
// ============================================

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationType {
  RANK_ACHIEVEMENT = 'rank_achievement',
  RANK_IMPROVEMENT = 'rank_improvement',
  PERIOD_WINNER = 'period_winner',
  WEEKLY_SUMMARY = 'weekly_summary',
  SYSTEM = 'system',
}

// ============================================
// TYPES
// ============================================

export interface RankNotificationParams {
  userId: string;
  rank: number;
  period: string;
  milestone: 'top10' | 'top100' | 'top1000' | 'rank1';
  percentile: number;
}

export interface RankImprovementParams {
  userId: string;
  previousRank: number;
  newRank: number;
  period: string;
  improvement: number;
}

export interface PeriodWinnerParams {
  userId: string;
  period: string;
  isWeekly: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channel: NotificationChannel;
  readAt?: Date;
  createdAt: Date;
}

// ============================================
// CONSTANTS
// ============================================

export const RANK_NOTIFICATION_TITLES: Record<string, string> = {
  top10: "You're in the Top 10!",
  top100: 'New Personal Best!',
  top1000: 'Rank Milestone!',
  rank1: "You're #1!",
};

export const RANK_NOTIFICATION_BODIES: Record<string, string> = {
  top10: 'Congratulations! You have reached the top 10 rankings.',
  top100: 'Great job! You have achieved a new personal best rank.',
  top1000: 'Well done! You have reached a new rank milestone.',
  rank1: 'Congratulations! You are now the #1 ranked player!',
};
