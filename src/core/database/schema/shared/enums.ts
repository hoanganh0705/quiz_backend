import { pgEnum } from 'drizzle-orm/pg-core';

// =============================================================================
// Shared enums
//
// All 20 PostgreSQL enums used across bounded contexts live here so that each
// domain schema file can import them from a single source of truth. Enums
// have no foreign key dependencies on tables, so centralising them does not
// introduce cross-domain import cycles.
//
// New enums should be appended to this file rather than declared in domain
// schema files.
// =============================================================================

// -- Discussion ---------------------------------------------------------------

export const discussionThreadStatus = pgEnum('discussion_thread_status', [
  'open',
  'closed',
  'hidden',
  'deleted',
]);

export const discussionContentStatus = pgEnum('discussion_content_status', [
  'visible',
  'hidden',
  'deleted',
]);

export const discussionVoteValue = pgEnum('discussion_vote_value', ['upvote', 'downvote']);

export const discussionReportStatus = pgEnum('discussion_report_status', [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
]);

export const discussionReportTargetType = pgEnum('discussion_report_target_type', [
  'thread',
  'comment',
  'reply',
]);

// Renamed in Phase 9.1. The new names correspond to the comment-only
// module identity. The old symbols above are retained so the schema
// file remains a single export surface for the migration in Phase 10
// and any cross-module consumers that still reference the old names.
// The database enum names (`discussion_*`) are also retained so the
// migration can drop the old enum types in a follow-up step rather
// than in this change.
export const discussionCommentVoteValue = pgEnum('discussion_comment_vote_value', [
  'upvote',
  'downvote',
]);

export const discussionCommentReportStatus = pgEnum('discussion_comment_report_status', [
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
  'discussion_created',
  'discussion_solved',
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
  'discussion_reply',
  'discussion_mention',
  'discussion_solved',
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
