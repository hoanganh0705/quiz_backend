import { pgEnum } from 'drizzle-orm/pg-core';

// =============================================================================
// Shared enums
//
// PostgreSQL enums used across bounded contexts live here so that each
// domain schema file can import them from a single source of truth. Enums
// have no foreign key dependencies on tables, so centralising them does not
// introduce cross-domain import cycles.
//
// New enums should be appended to this file rather than declared in domain
// schema files.
// =============================================================================

export const commentVoteValue = pgEnum('comment_vote_value', ['upvote', 'downvote']);

export const commentReportStatus = pgEnum('comment_report_status', [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
]);

// -- Review -------------------------------------------------------------------

export const reviewReportStatus = pgEnum('review_report_status', [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
]);

// -- Achievement / Badges ------------------------------------------------------

export const badgeType = pgEnum('badge_type', ['diamond', 'platinum', 'gold', 'silver', 'bronze']);

export const badgeRuleType = pgEnum('badge_rule_type', [
  'count',
  'rank',
  'rank_period',
  'streak',
  'tournament_win',
  'perfect_score',
  'xp_total',
  'seasonal',
  'social',
]);

export const badgeCategory = pgEnum('badge_category', [
  'quiz',
  'xp',
  'ranking',
  'tournament',
  'consistency',
  'event',
  'special',
  'seasonal',
]);

// -- Quiz ---------------------------------------------------------------------

export const quizDifficulty = pgEnum('quiz_difficulty', ['easy', 'medium', 'hard']);

export const quizInstanceStatus = pgEnum('quiz_instance_status', [
  'open',
  'countdown',
  'running',
  'closed',
  'finished',
]);

export const quizVersionStatus = pgEnum('quiz_version_status', ['draft', 'published', 'archived']);

// -- Tournament ---------------------------------------------------------------

export const tournamentRoundStatus = pgEnum('tournament_round_status', [
  'pending',
  'open',
  'running',
  'finished',
]);

export const tournamentStatus = pgEnum('tournament_status', [
  'upcoming',
  'registration',
  'ongoing',
  'finished',
  'cancelled',
]);

// -- User / Auth --------------------------------------------------------------

export const userRole = pgEnum('user_role', ['admin', 'moderator', 'user']);

// -- Activity / Social --------------------------------------------------------

export const activityEventType = pgEnum('activity_event_type', [
  'attempt_completed',
  'achievement_awarded',
  'tournament_joined',
  'tournament_completed',
  'tournament_won',
  'rank_improved',
  'rank_milestone',
  'streak_milestone',
]);

export const socialFeedActivityType = pgEnum('social_feed_activity_type', [
  'badge_earned',
  'badge_revoked',
  'rank_milestone',
  'peak_rank_achieved',
  'tournament_joined',
  'tournament_completed',
  'tournament_won',
  'comment_created',
  'quiz_completed',
  'quiz_milestone',
  'instance_created',
  'instance_joined',
  'instance_completed',
]);

export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'rejected',
  'blocked',
]);

// -- Notification -------------------------------------------------------------

export const notificationType = pgEnum('notification_type', [
  'achievement_earned',
  'badge_unlocked',
  'rank_achievement',
  'rank_improvement',
  'period_winner',
  'tournament_invite',
  'tournament_starting',
  'tournament_completed',
  'tournament_won',
  'streak_milestone',
  'friend_request',
  'friend_accepted',
  'quiz_review_received',
  'weekly_summary',
  'system_announcement',
  'followed',
  'comment_reply',
  'comment_mention',
  'comment_created',
  'badge_earned',
  'badge_revoked',
  'tournament_started',
  'tournament_reminder',
  'rank_improved',
  'rank_milestone',
  'instance_player_joined',
  'instance_started',
  'instance_xp_earned',
  'instance_closed',
  'instance_player_disconnected',
  'profile_updated',
  'settings_updated',
  'password_changed',
  'password_reset_requested',
  'password_reset_completed',
  'account_deleted',
  'session_revoked',
  'all_other_sessions_revoked',
  'oauth_linked',
  'oauth_unlinked',
]);

export const notificationChannel = pgEnum('notification_channel', ['in_app', 'email', 'push']);

// -- Coins -------------------------------------------------------------------
//
// Enumerates every business reason a `coin_transactions` row can be
// recorded for. Kept narrow on purpose — see design doc §9.2 — so that
// (a) the daily-cap SUM-by-reason query can rely on a fixed enum_ops
// index, and (b) new producers cannot silently mint a new earning
// surface without an enum change. Producers that need a new reason
// MUST add it here AND to `COIN_REWARDS` / `COIN_SPEND_AMOUNTS` in
// `src/modules/coins/coin.constants.ts`.
export const coinReason = pgEnum('coin_reason', [
  'QUIZ_COMPLETION_REWARD',
  'QUIZ_PERFECT_BONUS',
  'DAILY_CHALLENGE_REWARD',
  'STREAK_MILESTONE_REWARD',
  'BADGE_REWARD',
  'TOURNAMENT_PLACEMENT_REWARD',
  'TIP_SENT',
  'FLAIR_PURCHASED',
  'SUPPRESS_RECOMMENDED_PURCHASED',
  'ADMIN_ADJUSTMENT',
  'REFUND',
]);
