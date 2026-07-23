import {
  notificationType,
  notificationChannel,
  type notifications,
  type notificationPreferences,
} from '@/core/database/schema';

export type NotificationType = (typeof notificationType.enumValues)[number];
export type NotificationChannel = (typeof notificationChannel.enumValues)[number];

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  channel: NotificationChannel;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface NotificationPreferencesRow {
  preferencesId: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  achievementEnabled: boolean;
  tournamentEnabled: boolean;
  rankEnabled: boolean;
  friendEnabled: boolean;
  discussionEnabled: boolean;
  summaryEnabled: boolean;
  marketingEnabled: boolean;
  rankImprovementThreshold: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  channel?: NotificationChannel;
  expiresAt?: string;
}

export interface NotificationListParams {
  limit: number;
  cursor?: { createdAt: string; notificationId: string } | null;
  unreadOnly?: boolean;
  includeArchived?: boolean;
  type?: NotificationType;
  fromDate?: string;
  toDate?: string;
}

export interface UpdatePreferencesParams {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  achievementEnabled?: boolean;
  tournamentEnabled?: boolean;
  rankEnabled?: boolean;
  friendEnabled?: boolean;
  discussionEnabled?: boolean;
  summaryEnabled?: boolean;
  marketingEnabled?: boolean;
  rankImprovementThreshold?: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

// Rank notification params
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

export const RANK_NOTIFICATION_TITLES: Record<string, string> = {
  top10: 'Top 10 Achieved!',
  top100: 'Top 100 Achieved!',
  top1000: 'Top 1000 Achieved!',
  rank1: 'You are #1!',
};

export const RANK_NOTIFICATION_BODIES: Record<string, string> = {
  top10: 'Congratulations! You have reached the top 10!',
  top100: 'Amazing! You have reached the top 100!',
  top1000: 'Great job! You have reached the top 1000!',
  rank1: 'You are the top ranked player!',
};

export const NOTIFICATION_TYPE_VALUES = notificationType.enumValues;
export const NOTIFICATION_CHANNEL_VALUES = notificationChannel.enumValues;
export type NotificationCategory = 'badge' | 'discussion' | 'social' | 'ranking' | 'tournament';

export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationPreferencesDbRow = typeof notificationPreferences.$inferSelect;
