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
// - discussion: Discussion threads and comments
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

// Discussion
export * from './discussion/schema';
export * from './discussion/relations';

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
