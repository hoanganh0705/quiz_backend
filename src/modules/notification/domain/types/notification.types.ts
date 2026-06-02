import type { notificationType, notificationChannel } from '@/modules/notification/infrastructure/notification.schema';

export interface Notification {
  notificationId: string;
  userId: string;
  type: typeof notificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  channel: typeof notificationChannel;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  preferencesId: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  achievementEnabled: boolean;
  tournamentEnabled: boolean;
  rankEnabled: boolean;
  friendEnabled: boolean;
  summaryEnabled: boolean;
  marketingEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: 'achievement_earned' | 'badge_unlocked' | 'tournament_invite' | 'tournament_starting' | 'tournament_completed' | 'rank_improved' | 'streak_milestone' | 'friend_request' | 'friend_accepted' | 'quiz_commented' | 'weekly_summary' | 'system_announcement';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  channel?: 'in_app' | 'email' | 'push';
  expiresAt?: string;
}

export interface NotificationListParams {
  limit: number;
  cursor?: { createdAt: string; notificationId: string } | null;
  unreadOnly?: boolean;
}
