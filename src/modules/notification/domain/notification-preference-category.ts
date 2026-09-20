import type { NotificationType, NotificationChannel } from './types/notification.types';
import type { NotificationPreferencesRow } from './types/notification.types';

export type NotificationPreferenceCategory =
  | 'achievement'
  | 'tournament'
  | 'rank'
  | 'friend'
  | 'comment'
  | 'summary'
  | 'security'
  | 'system';

export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationPreferenceCategory> =
  {
    achievement_earned: 'achievement',
    badge_unlocked: 'achievement',
    badge_earned: 'achievement',
    badge_revoked: 'achievement',
    streak_milestone: 'achievement',
    rank_achievement: 'rank',
    rank_improvement: 'rank',
    rank_improved: 'rank',
    rank_milestone: 'rank',
    period_winner: 'rank',
    tournament_invite: 'tournament',
    tournament_starting: 'tournament',
    tournament_started: 'tournament',
    tournament_completed: 'tournament',
    tournament_won: 'tournament',
    tournament_reminder: 'tournament',
    friend_request: 'friend',
    friend_accepted: 'friend',
    followed: 'friend',
    comment_reply: 'comment',
    comment_mention: 'comment',
    comment_created: 'comment',
    quiz_review_received: 'system',
    weekly_summary: 'summary',
    system_announcement: 'system',
    instance_player_joined: 'system',
    instance_started: 'system',
    instance_xp_earned: 'system',
    instance_closed: 'system',
    instance_player_disconnected: 'system',
    profile_updated: 'security',
    settings_updated: 'security',
    password_changed: 'security',
    password_reset_requested: 'security',
    password_reset_completed: 'security',
    account_deleted: 'security',
    session_revoked: 'security',
    all_other_sessions_revoked: 'security',
    oauth_linked: 'security',
    oauth_unlinked: 'security',
  };

export const NOTIFICATION_CHANNEL_GATE: Record<
  NotificationChannel,
  keyof NotificationPreferencesRow
> = {
  in_app: 'inAppEnabled',
  email: 'emailEnabled',
  push: 'pushEnabled',
};
