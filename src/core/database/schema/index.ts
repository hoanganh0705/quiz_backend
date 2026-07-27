// =============================================================================
// Database Schema - Pure Barrel Re-export
//
// This file is the single entry point for the database schema. All tables,
// enums, and relations are re-exported from their respective domain modules.
//
// Domain structure:
// - shared:     Enums and types shared across domains
// - auth:       User authentication and sessions
// - quiz:       Quiz content management (includes review tables)
// - taxonomy:   Categories and tags
// - ranking:    User rankings and history
// - achievement: Badges and user achievements
// - user:       User profiles and settings
// - comment:    Per-quiz comment section (replaces the legacy comments
//               module: no threads, no subscriptions, no saved-threads)
// - social:     Social features (friends, follows, feed)
// - notification: User notifications
// - tournament: Tournament management
// - outbox:     Event outbox and idempotency
// =============================================================================

// Shared
export * from './shared/enums';
export * from './shared/types';

// Auth
export * from './auth/schema';
export * from './auth/relations';

// Quiz (includes review tables: reviewHelpfulVotes, reviewReports)
export * from './quiz/schema';
export * from './quiz/relations';

// Taxonomy
export * from './taxonomy/schema';
export * from './taxonomy/relations';

// Ranking
export * from './ranking/schema';
export * from './ranking/relations';

// Achievement
export * from './achievement/schema';
export * from './achievement/relations';

// User
export * from './user/schema';
export * from './user/relations';

// Comment (replaces the legacy comment module as of Phase 9.6;
// the old comments/ re-export has been removed in the same change.)
export * from './comment/schema';
export * from './comment/relations';

// Social
export * from './social/schema';
export * from './social/relations';

// Notification
export * from './notification/schema';
export * from './notification/relations';

// Tournament
export * from './tournament/schema';
export * from './tournament/relations';

// Outbox
export * from './outbox/schema';
