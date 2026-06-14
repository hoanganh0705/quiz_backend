import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  unique,
  integer,
  varchar,
  jsonb,
  foreignKey,
  boolean,
  smallint,
  bigint,
  numeric,
  pgEnum,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

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

export const reviewReportStatus = pgEnum('review_report_status', [
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

export const discussionThreads = pgTable(
  'discussion_threads',
  {
    threadId: uuid('thread_id').defaultRandom().primaryKey().notNull(),
    quizId: uuid('quiz_id').notNull(),
    authorId: uuid('author_id').notNull(),
    title: text().notNull(),
    body: text().notNull(),
    discussionSearchVector: tsvector('discussion_search_vector').generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`,
    ),
    status: discussionThreadStatus().default('open').notNull(),
    commentsCount: integer('comments_count').default(0).notNull(),
    votesCount: integer('votes_count').default(0).notNull(),
    upvotesCount: integer('upvotes_count').default(0).notNull(),
    downvotesCount: integer('downvotes_count').default(0).notNull(),
    isSolved: boolean('is_solved').default(false).notNull(),
    solvedAt: timestamp('solved_at', { withTimezone: true, mode: 'string' }),
    solvedCommentId: uuid('solved_comment_id'),
    solvedBy: uuid('solved_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_discussion_threads_quiz_created')
      .using(
        'btree',
        table.quizId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_threads_author_created')
      .using(
        'btree',
        table.authorId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_threads_search_vector')
      .using('gin', table.discussionSearchVector)
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_threads_status_created')
      .using(
        'btree',
        table.status.asc().nullsLast().op('enum_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_threads_trending')
      .using(
        'btree',
        table.votesCount.desc().nullsLast().op('int4_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_threads_unanswered')
      .using(
        'btree',
        table.commentsCount.asc().nullsLast().op('int4_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`comments_count = 0 AND deleted_at IS NULL`),
    uniqueIndex('uq_discussion_threads_quiz_author_title_active')
      .using('btree', table.quizId.asc().nullsLast().op('uuid_ops'), sql`lower(title)`)
      .where(sql`deleted_at IS NULL`),
    check('discussion_threads_title_nonblank', sql`length(btrim(title)) > 0`),
    check('discussion_threads_body_nonblank', sql`length(btrim(body)) > 0`),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'discussion_threads_quiz_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.userId],
      name: 'discussion_threads_author_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.solvedCommentId],
      foreignColumns: [discussionComments.commentId],
      name: 'discussion_threads_solved_comment_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.solvedBy],
      foreignColumns: [users.userId],
      name: 'discussion_threads_solved_by_fkey',
    }).onDelete('set null'),
  ],
);

export const discussionComments = pgTable(
  'discussion_comments',
  {
    commentId: uuid('comment_id').defaultRandom().primaryKey().notNull(),
    threadId: uuid('thread_id').notNull(),
    authorId: uuid('author_id').notNull(),
    parentCommentId: uuid('parent_comment_id'),
    body: text().notNull(),
    status: discussionContentStatus().default('visible').notNull(),
    repliesCount: integer('replies_count').default(0).notNull(),
    votesCount: integer('votes_count').default(0).notNull(),
    upvotesCount: integer('upvotes_count').default(0).notNull(),
    downvotesCount: integer('downvotes_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_discussion_comments_thread_created')
      .using(
        'btree',
        table.threadId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_comments_parent_created')
      .using(
        'btree',
        table.parentCommentId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_discussion_comments_author_created')
      .using(
        'btree',
        table.authorId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    check('discussion_comments_body_nonblank', sql`length(btrim(body)) > 0`),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [discussionThreads.threadId],
      name: 'discussion_comments_thread_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.userId],
      name: 'discussion_comments_author_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.commentId],
      name: 'discussion_comments_parent_comment_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const discussionVotes = pgTable(
  'discussion_votes',
  {
    voteId: uuid('vote_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    targetType: discussionReportTargetType('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    value: discussionVoteValue().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_discussion_votes_user_target').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.targetType.asc().nullsLast().op('enum_ops'),
      table.targetId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_discussion_votes_target').using(
      'btree',
      table.targetType.asc().nullsLast().op('enum_ops'),
      table.targetId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'discussion_votes_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const discussionThreadSubscriptions = pgTable(
  'discussion_thread_subscriptions',
  {
    userId: uuid('user_id').notNull(),
    threadId: uuid('thread_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_discussion_thread_subscriptions_user_thread').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.threadId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_discussion_thread_subscriptions_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_discussion_thread_subscriptions_thread').using(
      'btree',
      table.threadId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'discussion_thread_subscriptions_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [discussionThreads.threadId],
      name: 'discussion_thread_subscriptions_thread_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const discussionSavedThreads = pgTable(
  'discussion_saved_threads',
  {
    userId: uuid('user_id').notNull(),
    threadId: uuid('thread_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_discussion_saved_threads_user_thread').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.threadId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_discussion_saved_threads_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_discussion_saved_threads_thread').using(
      'btree',
      table.threadId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'discussion_saved_threads_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.threadId],
      foreignColumns: [discussionThreads.threadId],
      name: 'discussion_saved_threads_thread_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const discussionReports = pgTable(
  'discussion_reports',
  {
    reportId: uuid('report_id').defaultRandom().primaryKey().notNull(),
    reporterId: uuid('reporter_id').notNull(),
    targetType: discussionReportTargetType('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text().notNull(),
    details: text('details'),
    status: discussionReportStatus().default('open').notNull(),
    reviewedByUserId: uuid('reviewed_by_user_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
    actionTaken: boolean('action_taken').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_discussion_reports_status_created').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_discussion_reports_target').using(
      'btree',
      table.targetType.asc().nullsLast().op('enum_ops'),
      table.targetId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('uq_discussion_reports_reporter_target').using(
      'btree',
      table.reporterId.asc().nullsLast().op('uuid_ops'),
      table.targetType.asc().nullsLast().op('enum_ops'),
      table.targetId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.reporterId],
      foreignColumns: [users.userId],
      name: 'discussion_reports_reporter_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reviewedByUserId],
      foreignColumns: [users.userId],
      name: 'discussion_reports_reviewed_by_user_id_fkey',
    }).onDelete('set null'),
    check('discussion_reports_reason_nonblank', sql`length(btrim(reason)) > 0`),
  ],
);

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
export const quizDifficulty = pgEnum('quiz_difficulty', ['easy', 'medium', 'hard']);
export const quizInstanceStatus = pgEnum('quiz_instance_status', [
  'open',
  'running',
  'closed',
  'finished',
]);
export const quizVersionStatus = pgEnum('quiz_version_status', ['draft', 'published', 'archived']);
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

export const userRole = pgEnum('user_role', ['admin', 'moderator', 'user']);

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

export const tags = pgTable(
  'tags',
  {
    tagId: uuid('tag_id').defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_tags_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_tags_name_active')
      .using('btree', sql`lower(name)`)
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_tags_slug_active')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    check('tags_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'tags_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
  ],
);

export const users = pgTable(
  'users',
  {
    userId: uuid('user_id').defaultRandom().primaryKey().notNull(),
    username: text().notNull(),
    userSearchVector: tsvector('user_search_vector'),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole().default('user').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    emailVerificationTokenHash: text('email_verification_token_hash'),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'string' }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'string' }),
    xpTotal: integer('xp_total').default(0).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    settings: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_users_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_users_email_active')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('uq_users_username_active')
      .using('btree', table.username.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL`),
    index('idx_users_email_verification_token_active')
      .using('btree', table.emailVerificationTokenHash.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL AND is_verified = false`),
    index('idx_users_search_vector')
      .using('gin', table.userSearchVector)
      .where(sql`deleted_at IS NULL`),
    check('users_email_len', sql`(length((email)::text) >= 3) AND (length((email)::text) <= 255)`),
    check('users_email_like', sql`POSITION(('@'::text) IN (email)) > 1`),
    check('users_settings_object', sql`jsonb_typeof(settings) = 'object'::text`),
    check('users_streak_nonneg', sql`(current_streak >= 0) AND (longest_streak >= 0)`),
    check('users_streak_order', sql`longest_streak >= current_streak`),
    check(
      'users_username_len',
      sql`(length((username)::text) >= 3) AND (length((username)::text) <= 50)`,
    ),
    check('users_xp_nonneg', sql`xp_total >= 0`),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    sessionId: uuid('session_id').defaultRandom().primaryKey().notNull(),
    jti: uuid('jti').notNull(),
    userId: uuid('user_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceBrowser: text('device_browser'),
    deviceOs: text('device_os'),
    deviceType: text('device_type').default('unknown').notNull(),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    unique('uq_user_sessions_jti').on(table.jti),
    index('idx_user_sessions_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_sessions_jti_user').using(
      'btree',
      table.jti.asc().nullsLast().op('uuid_ops'),
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_sessions_active')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`revoked_at IS NULL`),
    index('idx_user_sessions_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_sessions_user_last_used_at').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.lastUsedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_sessions_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    passwordResetTokenId: uuid('password_reset_token_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    index('idx_password_reset_tokens_user_active')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`is_active = true AND used_at IS NULL AND revoked_at IS NULL`),
    index('idx_password_reset_tokens_hash_active')
      .using('btree', table.tokenHash.asc().nullsLast().op('text_ops'))
      .where(sql`is_active = true AND used_at IS NULL AND revoked_at IS NULL`),
  ],
);

export const passwordHistory = pgTable(
  'password_history',
  {
    historyId: uuid('history_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_password_history_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'password_history_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey().notNull(),
    aggregateType: text('aggregate_type').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'string' }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lastError: text('last_error'),
    /** Client-provided key for XP event deduplication. */
    idempotencyKey: text('idempotency_key'),
    /** Timestamp when the event exhausted all retry attempts and moved to DLQ. */
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'string' }),
    /** Human-readable reason for DLQ placement. */
    dlqReason: text('dlq_reason'),
    /** Tracks the HTTP correlation ID chain through async processing. */
    correlationId: text('correlation_id'),
  },
  (table) => [
    index('idx_outbox_events_unprocessed').using(
      'btree',
      table.processedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_created').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_next_attempt').using(
      'btree',
      table.processedAt.asc().nullsLast().op('timestamptz_ops'),
      table.nextAttemptAt.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_idempotency_unprocessed').using(
      'btree',
      table.idempotencyKey.asc().nullsLast().op('text_ops'),
    ),
  ],
);

export const authAuditLogs = pgTable(
  'auth_audit_logs',
  {
    auditLogId: uuid('audit_log_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id'),
    eventType: text('event_type').notNull(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_auth_audit_logs_created').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_auth_audit_logs_expires').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_auth_audit_logs_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'auth_audit_logs_user_id_fkey',
    }).onDelete('set null'),
    check('auth_audit_logs_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

export const userBadges = pgTable(
  'user_badges',
  {
    userBadgeId: uuid('user_badge_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    badgeId: uuid('badge_id').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    badgeVersion: text('badge_version').default('1.0.0').notNull(),
    progress: jsonb('progress').default({}).notNull(),
    metadata: jsonb().default({}).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    revocationReason: text('revocation_reason'),
  },
  (table) => [
    index('idx_user_badges_badge_id').using(
      'btree',
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_badges_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_user_badges_earned_at').using(
      'btree',
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_active').using(
      'btree',
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_user_active_earned').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_user_badge_active').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.badgeId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    // Partial unique constraint on (userId, badgeId) for active records.
    // Prevents race-condition duplicate awards — the DB rejects the second concurrent INSERT.
    // Uses .on() because uniqueIndex().where() only supports a single column via sql`` syntax.
    uniqueIndex('uq_user_badges_user_badge_active')
      .on(
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.badgeId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`${table.revokedAt} IS NULL`),
    // Composite B-tree with (userId, badgeId) leading key — covers the hasBadge()
    // query: WHERE user_id = $1 AND badge_id = $2 AND revoked_at IS NULL.
    index('idx_user_badges_user_badge').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_badges_cursor_pagination').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
      table.userBadgeId.desc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.badgeId],
      foreignColumns: [badges.badgeId],
      name: 'user_badges_badge_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_badges_user_id_fkey',
    }).onDelete('cascade'),
    check('user_badges_progress_object', sql`jsonb_typeof(progress) = 'object'::text`),
    check('user_badges_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

export const userRanking = pgTable(
  'user_ranking',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    allTimeXp: integer('all_time_xp').default(0).notNull(),
    weeklyXp: integer('weekly_xp').default(0).notNull(),
    monthlyXp: integer('monthly_xp').default(0).notNull(),
    allTimeRank: integer('all_time_rank'),
    weeklyRank: integer('weekly_rank'),
    monthlyRank: integer('monthly_rank'),
    dailyRank: integer('daily_rank'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // Phase 1 enhancements
    lastWeeklyResetAt: timestamp('last_weekly_reset_at', { withTimezone: true, mode: 'string' }),
    lastMonthlyResetAt: timestamp('last_monthly_reset_at', { withTimezone: true, mode: 'string' }),
    lastDailyResetAt: timestamp('last_daily_reset_at', { withTimezone: true, mode: 'string' }),
    peakAllTimeRank: integer('peak_all_time_rank'),
    peakAllTimeRankAchievedAt: timestamp('peak_all_time_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakWeeklyRank: integer('peak_weekly_rank'),
    peakWeeklyRankAchievedAt: timestamp('peak_weekly_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakMonthlyRank: integer('peak_monthly_rank'),
    peakMonthlyRankAchievedAt: timestamp('peak_monthly_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakDailyRank: integer('peak_daily_rank'),
    peakDailyRankAchievedAt: timestamp('peak_daily_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    dailyXp: integer('daily_xp').default(0).notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true, mode: 'string' }),
    isDirty: boolean('is_dirty').default(false).notNull(),
  },
  (table) => [
    index('idx_user_ranking_all_time_rank').using(
      'btree',
      table.allTimeRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_weekly_rank').using(
      'btree',
      table.weeklyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_monthly_rank').using(
      'btree',
      table.monthlyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_daily_rank').using(
      'btree',
      table.dailyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_dirty').using('btree', table.isDirty.asc().nullsLast().op('bool_ops')),
    index('idx_user_ranking_user_dirty_updated').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.isDirty.asc().nullsLast().op('bool_ops'),
      table.updatedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_ranking_user_id_fkey',
    }).onDelete('cascade'),
    check('user_ranking_all_time_xp_nonneg', sql`all_time_xp >= 0`),
    check('user_ranking_weekly_xp_nonneg', sql`weekly_xp >= 0`),
    check('user_ranking_monthly_xp_nonneg', sql`monthly_xp >= 0`),
    check('user_ranking_daily_xp_nonneg', sql`daily_xp >= 0`),
    check(
      'user_ranking_all_time_rank_positive',
      sql`(all_time_rank IS NULL) OR (all_time_rank > 0)`,
    ),
    check('user_ranking_weekly_rank_positive', sql`(weekly_rank IS NULL) OR (weekly_rank > 0)`),
    check('user_ranking_monthly_rank_positive', sql`(monthly_rank IS NULL) OR (monthly_rank > 0)`),
    check('user_ranking_daily_rank_positive', sql`(daily_rank IS NULL) OR (daily_rank > 0)`),
  ],
);

/**
 * Rank History Table - Stores persisted ranking snapshots over time.
 */
export const rankHistory = pgTable(
  'rank_history',
  {
    historyId: uuid('history_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    period: text('period').notNull(), // 'daily' | 'weekly' | 'monthly' | 'all_time'
    snapshotDate: timestamp('snapshot_date', { withTimezone: true, mode: 'string' }).notNull(),
    rank: integer('rank').notNull(),
    xp: integer('xp').default(0).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_rank_history_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_rank_history_period').using('btree', table.period.asc().nullsLast().op('text_ops')),
    index('idx_rank_history_user_period').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.period.asc().nullsLast().op('text_ops'),
    ),
    index('idx_rank_history_snapshot_date').using(
      'btree',
      table.snapshotDate.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_rank_history_user_period_snapshot').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.period.asc().nullsLast().op('text_ops'),
      table.snapshotDate.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'rank_history_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'rank_history_period_valid',
      sql`period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text])`,
    ),
  ],
);

export const rankingMilestones = pgTable(
  'ranking_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    milestone: text('milestone').notNull(),
    rank: integer('rank').notNull(),
    achievedAt: timestamp('achieved_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_ranking_milestones_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_ranking_milestones_achieved_at').using(
      'btree',
      table.achievedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_ranking_milestones_user_milestone').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.milestone.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'ranking_milestones_user_id_fkey',
    }).onDelete('cascade'),
    check('ranking_milestones_rank_positive', sql`rank > 0`),
    check(
      'ranking_milestones_milestone_valid',
      sql`milestone = ANY (ARRAY['TOP_10000'::text, 'TOP_1000'::text, 'TOP_100'::text, 'TOP_50'::text, 'TOP_10'::text, 'TOP_3'::text, 'TOP_1'::text])`,
    ),
  ],
);

export const badges = pgTable(
  'badges',
  {
    badgeId: uuid('badge_id').defaultRandom().primaryKey().notNull(),
    slug: text().notNull(),
    type: badgeType().notNull(),
    category: badgeCategory().notNull(),
    name: text().notNull(),
    description: text(),
    iconUrl: text('icon_url'),
    isActive: boolean('is_active').default(true).notNull(),
    isHidden: boolean('is_hidden').default(false).notNull(),
    version: text('version').default('1.0.0').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'string' }),
    validUntil: timestamp('valid_until', { withTimezone: true, mode: 'string' }),
    evaluationMode: text('evaluation_mode').default('immediate').notNull(), // 'immediate' | 'deferred' | 'both'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_badges_slug').on(table.slug),
    index('idx_badges_type').using('btree', table.type.asc().nullsLast().op('enum_ops')),
    index('idx_badges_category').using('btree', table.category.asc().nullsLast().op('enum_ops')),
    index('idx_badges_active').using('btree', table.isActive.asc().nullsLast().op('bool_ops')),
    index('idx_badges_evaluation_mode').using(
      'btree',
      table.evaluationMode.asc().nullsLast().op('text_ops'),
    ),
    check('badges_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'badges_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
    check(
      'badges_evaluation_mode_check',
      sql`evaluation_mode = ANY (ARRAY['immediate'::text, 'deferred'::text, 'both'::text])`,
    ),
  ],
);

/**
 * Badge Rules Table
 *
 * Flexible rule configuration for badge conditions.
 * Each badge can have multiple rules that must all be satisfied.
 *
 * Rule config examples:
 * - { "metric": "quizzes_completed", "threshold": 10, "operator": ">=" }
 * - { "metric": "period_rank", "period": "weekly", "threshold": 10, "operator": "<=" }
 * - { "metric": "streak_days", "threshold": 30, "operator": ">=" }
 * - { "metric": "tournaments_won", "threshold": 3, "operator": ">=" }
 * - { "metric": "perfect_scores", "threshold": 10, "operator": ">=" }
 * - { "metric": "xp_total", "threshold": 5000, "operator": ">=" }
 */
export const badgeRules = pgTable(
  'badge_rules',
  {
    ruleId: uuid('rule_id').defaultRandom().primaryKey().notNull(),
    badgeId: uuid('badge_id').notNull(),
    ruleType: badgeRuleType('rule_type').notNull(),
    priority: integer('priority').default(0).notNull(),
    config: jsonb().notNull().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_badge_rules_badge_id').using(
      'btree',
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_badge_rules_rule_type').using(
      'btree',
      table.ruleType.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_badge_rules_active_priority').using(
      'btree',
      table.isActive.asc().nullsLast().op('bool_ops'),
      table.priority.desc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.badgeId],
      foreignColumns: [badges.badgeId],
      name: 'badge_rules_badge_id_fkey',
    }).onDelete('cascade'),
    check(
      'badge_rules_config_not_null',
      sql`config IS NOT NULL AND jsonb_typeof(config) = 'object'`,
    ),
  ],
);

export const categories = pgTable(
  'categories',
  {
    categoryId: uuid('category_id').defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text(),
    slug: text().notNull(),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_categories_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_categories_name_active')
      .using('btree', sql`lower(name)`)
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_categories_slug_active')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    check('categories_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'categories_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
  ],
);

export const quizzes = pgTable(
  'quizzes',
  {
    quizId: uuid('quiz_id').defaultRandom().primaryKey().notNull(),
    creatorId: uuid('creator_id'),
    title: text().notNull(),
    description: text(),
    slug: text().notNull(),
    quizSearchVector: tsvector('quiz_search_vector').generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B') || setweight(to_tsvector('simple', coalesce(slug, '')), 'A')`,
    ),
    requirements: text(),
    imageUrl: text('image_url'),
    isFeatured: boolean('is_featured').default(false).notNull(),
    isHidden: boolean('is_hidden').default(false).notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    publishedVersionId: uuid('published_version_id').references(
      () => (quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId,
      {
        onDelete: 'set null',
      },
    ),
  },
  (table) => [
    index('idx_quizzes_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_quizzes_creator_active')
      .using('btree', table.creatorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_quizzes_published_version_id')
      .using('btree', table.publishedVersionId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(published_version_id IS NOT NULL)`),
    index('idx_quizzes_search_vector')
      .using('gin', table.quizSearchVector)
      .where(sql`deleted_at IS NULL AND is_hidden = false`),
    uniqueIndex('uq_quizzes_slug_active')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [users.userId],
      name: 'quizzes_creator_id_fkey',
    }).onDelete('set null'),
    check(
      'quizzes_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
    check('quizzes_title_nonblank', sql`length(btrim(title)) > 0`),
  ],
);

export const quizVersions = pgTable(
  'quiz_versions',
  {
    quizVersionId: uuid('quiz_version_id').defaultRandom().primaryKey().notNull(),
    quizId: uuid('quiz_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    status: quizVersionStatus().default('draft').notNull(),
    difficulty: quizDifficulty().notNull(),
    durationMs: integer('duration_ms').notNull(),
    passingScorePercent: smallint('passing_score_percent').notNull(),
    rewardXp: integer('reward_xp').notNull(),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_versions_quiz_id').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_versions_quiz_status').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.userId],
      name: 'quiz_versions_created_by_user_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'quiz_versions_quiz_id_fkey',
    }).onDelete('cascade'),
    unique('uq_quiz_versions_quiz_version').on(table.quizId, table.versionNumber),
    check('quiz_versions_duration_ms_positive', sql`duration_ms > 0`),
    check(
      'quiz_versions_passing_score_percent_range',
      sql`(passing_score_percent >= 0) AND (passing_score_percent <= 100)`,
    ),
    check('quiz_versions_reward_xp_nonneg', sql`reward_xp >= 0`),
    check('quiz_versions_version_number_positive', sql`version_number > 0`),
  ],
);

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    questionId: uuid('question_id').defaultRandom().primaryKey().notNull(),
    quizVersionId: uuid('quiz_version_id').notNull(),
    position: integer().notNull(),
    questionText: text('question_text').notNull(),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.quizVersionId],
      foreignColumns: [(quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId],
      name: 'quiz_questions_quiz_version_id_fkey',
    }).onDelete('cascade'),
    unique('uq_quiz_questions_version_position').on(table.position, table.quizVersionId),
    check('quiz_questions_position_positive', sql`"position" > 0`),
    check('quiz_questions_text_nonblank', sql`length(btrim(question_text)) > 0`),
  ],
);

export const quizAnswerOptions = pgTable(
  'quiz_answer_options',
  {
    optionId: uuid('option_id').defaultRandom().primaryKey().notNull(),
    questionId: uuid('question_id').notNull(),
    position: integer().notNull(),
    value: text().notNull(),
    isCorrect: boolean('is_correct').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_quiz_answer_options_one_correct')
      .using('btree', table.questionId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(is_correct = true)`),
    foreignKey({
      columns: [table.questionId],
      foreignColumns: [quizQuestions.questionId],
      name: 'quiz_answer_options_question_id_fkey',
    }).onDelete('cascade'),
    unique('uq_quiz_answer_options_question_position').on(table.position, table.questionId),
    check('quiz_answer_options_position_positive', sql`"position" > 0`),
    check('quiz_answer_options_value_nonblank', sql`length(btrim(value)) > 0`),
  ],
);

export const quizCategories = pgTable(
  'quiz_categories',
  {
    quizCategoryId: uuid('quiz_category_id').defaultRandom().primaryKey().notNull(),
    quizId: uuid('quiz_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_categories_category_id').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_categories_category_quiz').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops'),
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_categories_quiz_id').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.categoryId],
      name: 'quiz_categories_category_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'quiz_categories_quiz_id_fkey',
    }).onDelete('cascade'),
    unique('uq_quiz_categories_pair').on(table.categoryId, table.quizId),
  ],
);

export const quizTags = pgTable(
  'quiz_tags',
  {
    quizTagId: uuid('quiz_tag_id').defaultRandom().primaryKey().notNull(),
    quizId: uuid('quiz_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_tags_quiz_id').using('btree', table.quizId.asc().nullsLast().op('uuid_ops')),
    index('idx_quiz_tags_tag_id').using('btree', table.tagId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'quiz_tags_quiz_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.tagId],
      name: 'quiz_tags_tag_id_fkey',
    }).onDelete('cascade'),
    unique('uq_quiz_tags_pair').on(table.quizId, table.tagId),
  ],
);

export const quizStats = pgTable(
  'quiz_stats',
  {
    quizId: uuid('quiz_id').primaryKey().notNull(),
    totalAttempts: bigint('total_attempts', { mode: 'number' }).default(0).notNull(),
    totalPlayers: bigint('total_players', { mode: 'number' }).default(0).notNull(),
    avgScorePercent: numeric('avg_score_percent', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // Analytics extension fields
    avgRating: numeric('avg_rating', { precision: 3, scale: 2 }).default('0').notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),
    bookmarkCount: integer('bookmark_count').default(0).notNull(),
    completionRate: numeric('completion_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    popularityScore: numeric('popularity_score', { precision: 10, scale: 4 })
      .default('0')
      .notNull(),
    trendingScore: numeric('trending_score', { precision: 10, scale: 4 }).default('0').notNull(),
    lastCalculatedAt: timestamp('last_calculated_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('idx_quiz_stats_avg_score_percent_desc').using(
      'btree',
      table.avgScorePercent.desc().nullsFirst().op('numeric_ops'),
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_stats_last_attempt_at_desc').using(
      'btree',
      table.lastAttemptAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('idx_quiz_stats_total_attempts_desc').using(
      'btree',
      table.totalAttempts.desc().nullsFirst().op('int8_ops'),
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_stats_popularity_score_desc').using(
      'btree',
      table.popularityScore.desc().nullsFirst().op('numeric_ops'),
    ),
    index('idx_quiz_stats_trending_score_desc').using(
      'btree',
      table.trendingScore.desc().nullsFirst().op('numeric_ops'),
    ),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'quiz_stats_quiz_id_fkey',
    }).onDelete('cascade'),
    check(
      'quiz_stats_avg_score_percent_range',
      sql`(avg_score_percent >= (0)::numeric) AND (avg_score_percent <= (100)::numeric)`,
    ),
    check('quiz_stats_total_attempts_nonneg', sql`total_attempts >= 0`),
    check('quiz_stats_total_players_nonneg', sql`total_players >= 0`),
    check(
      'quiz_stats_avg_rating_range',
      sql`(avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric)`,
    ),
    check('quiz_stats_rating_count_nonneg', sql`rating_count >= 0`),
    check('quiz_stats_bookmark_count_nonneg', sql`bookmark_count >= 0`),
    check(
      'quiz_stats_completion_rate_range',
      sql`(completion_rate >= (0)::numeric) AND (completion_rate <= (100)::numeric)`,
    ),
  ],
);

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    attemptId: uuid('attempt_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    quizVersionId: uuid('quiz_version_id').notNull(),
    contextType: text('context_type').default('solo').notNull(),
    contextRefId: uuid('context_ref_id'),
    status: text().default('started').notNull(),
    scorePercent: numeric('score_percent', { precision: 5, scale: 2 }),
    correctCount: integer('correct_count'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    timeTakenMs: integer('time_taken_ms'),
    xpEarned: integer('xp_earned').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_attempts_quiz_version_id').using(
      'btree',
      table.quizVersionId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_attempts_user_started_at_desc').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.startedAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('idx_quiz_attempts_user_status').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('text_ops'),
    ),
    index('idx_quiz_attempts_version_status_created').using(
      'btree',
      table.quizVersionId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('text_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.quizVersionId],
      foreignColumns: [(quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId],
      name: 'quiz_attempts_quiz_version_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'quiz_attempts_user_id_fkey',
    }).onDelete('restrict'),
    check(
      'quiz_attempts_status_check',
      sql`status = ANY (ARRAY['started'::text, 'completed'::text, 'abandoned'::text])`,
    ),
    check(
      'quiz_attempts_score_percent_range',
      sql`score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)`,
    ),
    check('quiz_attempts_correct_count_nonneg', sql`correct_count IS NULL OR correct_count >= 0`),
  ],
);

export const quizAttemptAnswers = pgTable(
  'quiz_attempt_answers',
  {
    attemptAnswerId: uuid('attempt_answer_id').defaultRandom().primaryKey().notNull(),
    attemptId: uuid('attempt_id').notNull(),
    questionId: uuid('question_id').notNull(),
    selectedOptionId: uuid('selected_option_id'),
    answeredAt: timestamp('answered_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    timeTakenMs: integer('time_taken_ms'),
  },
  (table) => [
    index('idx_quiz_attempt_answers_attempt_id').using(
      'btree',
      table.attemptId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_quiz_attempt_answers_question_id').using(
      'btree',
      table.questionId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.attemptId],
      foreignColumns: [quizAttempts.attemptId],
      name: 'quiz_attempt_answers_attempt_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.questionId],
      foreignColumns: [quizQuestions.questionId],
      name: 'quiz_attempt_answers_question_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.selectedOptionId],
      foreignColumns: [quizAnswerOptions.optionId],
      name: 'quiz_attempt_answers_selected_option_id_fkey',
    }).onDelete('restrict'),
    unique('uq_attempt_question').on(table.attemptId, table.questionId),
  ],
);

export const quizAttemptEvents = pgTable(
  'quiz_attempt_events',
  {
    eventId: bigint('event_id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({
      name: 'quiz_attempt_events_event_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: '9223372036854775807',
      cache: 1,
    }),
    attemptId: uuid('attempt_id').notNull(),
    eventType: text('event_type').notNull(),
    questionId: uuid('question_id'),
    selectedOptionId: uuid('selected_option_id'),
    payload: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_attempt_events_attempt_created_at').using(
      'btree',
      table.attemptId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.attemptId],
      foreignColumns: [quizAttempts.attemptId],
      name: 'quiz_attempt_events_attempt_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.questionId],
      foreignColumns: [quizQuestions.questionId],
      name: 'quiz_attempt_events_question_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.selectedOptionId],
      foreignColumns: [quizAnswerOptions.optionId],
      name: 'quiz_attempt_events_selected_option_id_fkey',
    }).onDelete('set null'),
    check('quiz_attempt_events_payload_object', sql`jsonb_typeof(payload) = 'object'::text`),
  ],
);

export const quizReviews = pgTable(
  'quiz_reviews',
  {
    reviewId: uuid('review_id').defaultRandom().primaryKey().notNull(),
    quizId: uuid('quiz_id').notNull(),
    userId: uuid('user_id').notNull(),
    rating: smallint().notNull(),
    comment: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    helpfulCount: smallint('helpful_count').notNull().default(0),
  },
  (table) => [
    index('idx_quiz_reviews_quiz_created_at_desc').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('idx_quiz_reviews_quiz_rating').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
      table.rating.desc().nullsLast().op('int2_ops'),
    ),
    index('idx_quiz_reviews_user_created_at_desc').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'quiz_reviews_quiz_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'quiz_reviews_user_id_fkey',
    }).onDelete('restrict'),
    unique('uq_quiz_reviews_quiz_user').on(table.quizId, table.userId),
    check('quiz_reviews_rating_range', sql`(rating >= 1) AND (rating <= 5)`),
  ],
);

export const bookmarkCollections = pgTable(
  'bookmark_collections',
  {
    collectionId: uuid('collection_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'bookmark_collections_user_id_fkey',
    }).onDelete('cascade'),
    unique('uq_bookmark_collections_user_name').on(table.name, table.userId),
    check('bookmark_collections_name_nonblank', sql`length(btrim(name)) > 0`),
  ],
);

export const bookmarkedQuizzes = pgTable(
  'bookmarked_quizzes',
  {
    bookmarkId: uuid('bookmark_id').defaultRandom().primaryKey().notNull(),
    collectionId: uuid('collection_id').notNull(),
    quizId: uuid('quiz_id').notNull(),
    bookmarkedAt: timestamp('bookmarked_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    notes: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_bookmarked_quizzes_collection_id').using(
      'btree',
      table.collectionId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_bookmarked_quizzes_quiz_id').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.collectionId],
      foreignColumns: [bookmarkCollections.collectionId],
      name: 'bookmarked_quizzes_collection_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [(quizzes as { quizId: AnyPgColumn }).quizId],
      name: 'bookmarked_quizzes_quiz_id_fkey',
    }).onDelete('cascade'),
    unique('uq_bookmarked_quizzes_pair').on(table.collectionId, table.quizId),
  ],
);

export const quizInstances = pgTable(
  'quiz_instances',
  {
    instanceId: uuid('instance_id').defaultRandom().primaryKey().notNull(),
    quizVersionId: uuid('quiz_version_id').notNull(),
    hostUserId: uuid('host_user_id').notNull(),
    maxPlayers: integer('max_players'),
    status: quizInstanceStatus().default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_quiz_instances_host_status').using(
      'btree',
      table.hostUserId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_quiz_instances_version_status').using(
      'btree',
      table.quizVersionId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    foreignKey({
      columns: [table.hostUserId],
      foreignColumns: [users.userId],
      name: 'quiz_instances_host_user_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.quizVersionId],
      foreignColumns: [(quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId],
      name: 'quiz_instances_quiz_version_id_fkey',
    }).onDelete('restrict'),
    check('quiz_instances_max_players_positive', sql`(max_players IS NULL) OR (max_players > 0)`),
    check(
      'quiz_instances_started_closed_order',
      sql`(started_at IS NULL) OR (closed_at IS NULL) OR (closed_at >= started_at)`,
    ),
  ],
);

export const quizInstancePlayers = pgTable(
  'quiz_instance_players',
  {
    instancePlayerId: uuid('instance_player_id').defaultRandom().primaryKey().notNull(),
    instanceId: uuid('instance_id').notNull(),
    userId: uuid('user_id').notNull(),
    attemptId: uuid('attempt_id'),
    status: text().default('joined').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    leftAt: timestamp('left_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_quiz_instance_players_attempt_id').using(
      'btree',
      table.attemptId.asc().nullsLast().op('uuid_ops'),
    ),

    index('idx_quiz_instance_players_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),

    // Supports:
    // SELECT count(*) FROM quiz_instance_players
    // WHERE instance_id = ? AND status = ?
    //
    // Also useful for leaderboard and player-state filtering.
    index('idx_quiz_instance_players_instance_status').using(
      'btree',
      table.instanceId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('text_ops'),
    ),

    foreignKey({
      columns: [table.attemptId],
      foreignColumns: [quizAttempts.attemptId],
      name: 'quiz_instance_players_attempt_id_fkey',
    }).onDelete('set null'),

    foreignKey({
      columns: [table.instanceId],
      foreignColumns: [quizInstances.instanceId],
      name: 'quiz_instance_players_instance_id_fkey',
    }).onDelete('cascade'),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'quiz_instance_players_user_id_fkey',
    }).onDelete('restrict'),

    unique('uq_quiz_instance_players_instance_user').on(table.instanceId, table.userId),

    check(
      'quiz_instance_players_status_check',
      sql`status = ANY (
        ARRAY[
          'joined'::text,
          'ready'::text,
          'playing'::text,
          'disconnected'::text,
          'finished'::text
        ]
      )`,
    ),
  ],
);

export const tournaments = pgTable(
  'tournaments',
  {
    tournamentId: uuid('tournament_id').defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    description: text(),
    difficulty: quizDifficulty().notNull(),
    status: tournamentStatus().default('upcoming').notNull(),
    prize: text(),
    startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
    maxParticipants: integer('max_participants'),
    categoryId: uuid('category_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_tournaments_category_active')
      .using('btree', table.categoryId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tournaments_status_start_at').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
      table.startAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.categoryId],
      name: 'tournaments_category_id_fkey',
    }).onDelete('set null'),
    check(
      'tournaments_max_participants_positive',
      sql`(max_participants IS NULL) OR (max_participants > 0)`,
    ),
    check('tournaments_start_end_order', sql`end_at > start_at`),
    check('tournaments_title_nonblank', sql`length(btrim(title)) > 0`),
  ],
);

export const tournamentRounds = pgTable(
  'tournament_rounds',
  {
    roundId: uuid('round_id').defaultRandom().primaryKey().notNull(),
    tournamentId: uuid('tournament_id').notNull(),
    roundNumber: smallint('round_number').notNull(),
    name: text().notNull(),
    description: text(),
    quizVersionId: uuid('quiz_version_id').notNull(),
    startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }),
    durationMs: integer('duration_ms'),
    status: tournamentRoundStatus().default('pending').notNull(),
    isElimination: boolean('is_elimination').default(false).notNull(),
    participantLimit: integer('participant_limit'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_tournament_rounds_quiz_version_id').using(
      'btree',
      table.quizVersionId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_rounds_tournament_status').using(
      'btree',
      table.tournamentId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    foreignKey({
      columns: [table.quizVersionId],
      foreignColumns: [(quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId],
      name: 'tournament_rounds_quiz_version_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tournamentId],
      foreignColumns: [tournaments.tournamentId],
      name: 'tournament_rounds_tournament_id_fkey',
    }).onDelete('cascade'),
    unique('uq_tournament_rounds_tournament_round_number').on(
      table.roundNumber,
      table.tournamentId,
    ),
    check(
      'tournament_rounds_duration_ms_positive',
      sql`(duration_ms IS NULL) OR (duration_ms > 0)`,
    ),
    check('tournament_rounds_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'tournament_rounds_participant_limit_positive',
      sql`(participant_limit IS NULL) OR (participant_limit > 0)`,
    ),
    check('tournament_rounds_round_number_positive', sql`round_number > 0`),
    check(
      'tournament_rounds_start_end_order',
      sql`(start_at IS NULL) OR (end_at IS NULL) OR (end_at > start_at)`,
    ),
  ],
);

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    participantId: uuid('participant_id').defaultRandom().primaryKey().notNull(),
    tournamentId: uuid('tournament_id').notNull(),
    userId: uuid('user_id').notNull(),
    registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    totalScore: integer('total_score').default(0).notNull(),
    totalTimeMs: integer('total_time_ms').default(0).notNull(),
    rankFinal: smallint('rank_final'),
    status: text().default('active').notNull(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true, mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_tournament_participants_leaderboard').using(
      'btree',
      table.tournamentId.asc().nullsLast().op('uuid_ops'),
      table.totalScore.desc().nullsFirst().op('int4_ops'),
      table.totalTimeMs.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_tournament_participants_tournament_id').using(
      'btree',
      table.tournamentId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_participants_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_participants_user_rank_final')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.rankFinal.asc().nullsLast().op('int2_ops'),
      )
      .where(sql`rank_final IS NOT NULL`),
    index('idx_tournament_participants_user_registered').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.registeredAt.desc().nullsLast().op('timestamptz_ops'),
      table.participantId.desc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_participants_user_completed')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.participantId.desc().nullsLast().op('uuid_ops'),
      )
      .where(sql`rank_final IS NOT NULL`),
    foreignKey({
      columns: [table.tournamentId],
      foreignColumns: [tournaments.tournamentId],
      name: 'tournament_participants_tournament_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'tournament_participants_user_id_fkey',
    }).onDelete('restrict'),
    unique('uq_tournament_participants_tournament_user').on(table.tournamentId, table.userId),
    check(
      'tournament_participants_rank_final_positive',
      sql`(rank_final IS NULL) OR (rank_final > 0)`,
    ),
    check('tournament_participants_total_score_nonneg', sql`total_score >= 0`),
    check('tournament_participants_total_time_ms_nonneg', sql`total_time_ms >= 0`),
  ],
);

export const tournamentRoundParticipants = pgTable(
  'tournament_round_participants',
  {
    roundParticipantId: uuid('round_participant_id').defaultRandom().primaryKey().notNull(),
    roundId: uuid('round_id').notNull(),
    participantId: uuid('participant_id').notNull(),
    attemptId: uuid('attempt_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    roundScore: integer('round_score').default(0).notNull(),
    roundTimeMs: integer('round_time_ms').default(0).notNull(),
    rankInRound: smallint('rank_in_round'),
    isQualified: boolean('is_qualified').default(true).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_tournament_round_participants_attempt_id').using(
      'btree',
      table.attemptId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_round_participants_participant_id').using(
      'btree',
      table.participantId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_round_participants_round_id').using(
      'btree',
      table.roundId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_tournament_round_participants_round_leaderboard').using(
      'btree',
      table.roundId.asc().nullsLast().op('uuid_ops'),
      table.roundScore.desc().nullsFirst().op('int4_ops'),
      table.roundTimeMs.asc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.attemptId],
      foreignColumns: [quizAttempts.attemptId],
      name: 'tournament_round_participants_attempt_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [tournamentParticipants.participantId],
      name: 'tournament_round_participants_participant_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.roundId],
      foreignColumns: [tournamentRounds.roundId],
      name: 'tournament_round_participants_round_id_fkey',
    }).onDelete('cascade'),
    unique('uq_round_participant').on(table.participantId, table.roundId),
    check(
      'tournament_round_participants_rank_positive',
      sql`(rank_in_round IS NULL) OR (rank_in_round > 0)`,
    ),
    check('tournament_round_participants_round_score_nonneg', sql`round_score >= 0`),
    check('tournament_round_participants_round_time_ms_nonneg', sql`round_time_ms >= 0`),
  ],
);

export const tournamentStats = pgTable('tournament_stats', {
  tournamentId: uuid('tournament_id')
    .primaryKey()
    .references(() => tournaments.tournamentId, { onDelete: 'cascade' }),
  participants: integer('participants').notNull().default(0),
  completedParticipants: integer('completed_participants').notNull().default(0),
  averageScore: numeric('average_score', { precision: 10, scale: 2 }).default('0'),
  highestScore: integer('highest_score'),
  lowestScore: integer('lowest_score'),
  completionRate: numeric('completion_rate', { precision: 5, scale: 2 }).default('0'),
  averageRank: numeric('average_rank', { precision: 10, scale: 2 }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const userProfiles = pgTable(
  'user_profiles',
  {
    profileId: uuid('profile_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text(),
    tagline: text('tagline'),
    pinnedBadgeIds: jsonb('pinned_badge_ids').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_profiles_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_profiles_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'user_profiles_display_name_len',
      sql`(display_name IS NULL) OR (length(btrim(display_name)) >= 1 AND length(btrim(display_name)) <= 100)`,
    ),
    check('user_profiles_tagline_len', sql`(tagline IS NULL) OR (length(btrim(tagline)) <= 160)`),
    check('user_profiles_pinned_badges_array', sql`jsonb_typeof(pinned_badge_ids) = 'array'`),
  ],
);

export const userProfileSettings = pgTable(
  'user_profile_settings',
  {
    settingsId: uuid('settings_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull().unique(),
    isPublic: boolean('is_public').default(true).notNull(),
    showStatistics: boolean('show_statistics').default(true).notNull(),
    showAchievements: boolean('show_achievements').default(true).notNull(),
    showActivity: boolean('show_activity').default(true).notNull(),
    showRankImprovement: boolean('show_rank_improvement').default(true).notNull(),
    showTournamentActivity: boolean('show_tournament_activity').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_profile_settings_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_profile_settings_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const userActivityEvents = pgTable(
  'user_activity_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    eventType: activityEventType().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    visibility: text('visibility').default('public').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_activity_events_user_occurred').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_user_type').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.eventType.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_user_activity_events_visibility').using(
      'btree',
      table.visibility.asc().nullsLast().op('text_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_cursor_pagination').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      table.eventId.desc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_activity_events_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'user_activity_events_visibility_check',
      sql`visibility = ANY (ARRAY['public'::text, 'private'::text])`,
    ),
    check('user_activity_events_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
    check('user_activity_events_metadata_not_empty', sql`metadata <> '{}'::jsonb`),
  ],
);

export const socialFeedActivities = pgTable(
  'social_feed_activities',
  {
    activityId: uuid('activity_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    activityType: socialFeedActivityType('activity_type').notNull(),
    payload: jsonb('payload').default({}).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_social_feed_activities_occurred').using(
      'btree',
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
      table.activityId.desc().nullsLast().op('uuid_ops'),
    ),
    index('idx_social_feed_activities_user_occurred').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_social_feed_activities_type_occurred').using(
      'btree',
      table.activityType.asc().nullsLast().op('enum_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'social_feed_activities_user_id_fkey',
    }).onDelete('cascade'),
    check('social_feed_activities_payload_object', sql`jsonb_typeof(payload) = 'object'::text`),
    check('social_feed_activities_payload_not_empty', sql`payload <> '{}'::jsonb`),
  ],
);

// Social Domain Tables

export const friendships = pgTable(
  'friendships',
  {
    friendshipId: uuid('friendship_id').defaultRandom().primaryKey().notNull(),
    requesterId: uuid('requester_id').notNull(),
    addresseeId: uuid('addressee_id').notNull(),
    status: friendshipStatus().default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_friendships_requester').using(
      'btree',
      table.requesterId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_friendships_addressee').using(
      'btree',
      table.addresseeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_friendships_status').using('btree', table.status.asc().nullsLast().op('enum_ops')),
    index('idx_friendships_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_friendships_pair')
      .on(
        table.requesterId.asc().nullsLast().op('uuid_ops'),
        table.addresseeId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.requesterId],
      foreignColumns: [users.userId],
      name: 'friendships_requester_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.addresseeId],
      foreignColumns: [users.userId],
      name: 'friendships_addressee_id_fkey',
    }).onDelete('cascade'),
    check('friendships_no_self_request', sql`requester_id != addressee_id`),
  ],
);

export const blockedUsers = pgTable(
  'blocked_users',
  {
    blockId: uuid('block_id').defaultRandom().primaryKey().notNull(),
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_blocked_users_blocker').using(
      'btree',
      table.blockerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_blocked_users_blocked').using(
      'btree',
      table.blockedId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_blocked_users_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_blocked_users_pair')
      .on(
        table.blockerId.asc().nullsLast().op('uuid_ops'),
        table.blockedId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.blockerId],
      foreignColumns: [users.userId],
      name: 'blocked_users_blocker_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.blockedId],
      foreignColumns: [users.userId],
      name: 'blocked_users_blocked_id_fkey',
    }).onDelete('cascade'),
    check('blocked_users_no_self_block', sql`blocker_id != blocked_id`),
  ],
);

export const userFollows = pgTable(
  'user_follows',
  {
    followId: uuid('follow_id').defaultRandom().primaryKey().notNull(),
    followerId: uuid('follower_id').notNull(),
    followingId: uuid('following_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_user_follows_follower').using(
      'btree',
      table.followerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_follows_following').using(
      'btree',
      table.followingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_user_follows_pair')
      .on(
        table.followerId.asc().nullsLast().op('uuid_ops'),
        table.followingId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.followerId],
      foreignColumns: [users.userId],
      name: 'user_follows_follower_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.followingId],
      foreignColumns: [users.userId],
      name: 'user_follows_following_id_fkey',
    }).onDelete('cascade'),
    check('user_follows_no_self_follow', sql`follower_id != following_id`),
  ],
);

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

export const notifications = pgTable(
  'notifications',
  {
    notificationId: uuid('notification_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    type: notificationType().notNull(),
    title: text().notNull(),
    message: text().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    channel: notificationChannel().default('in_app').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_notifications_user_created')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_user_unread')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.isRead.asc().nullsLast().op('bool_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_user_type')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.type.asc().nullsLast().op('enum_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_expires_at')
      .using('btree', table.expiresAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`expires_at IS NOT NULL`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'notifications_user_id_fkey',
    }).onDelete('cascade'),
    check('notifications_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    preferencesId: uuid('preferences_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull().unique(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    emailEnabled: boolean('email_enabled').default(true).notNull(),
    pushEnabled: boolean('push_enabled').default(true).notNull(),
    achievementEnabled: boolean('achievement_enabled').default(true).notNull(),
    tournamentEnabled: boolean('tournament_enabled').default(true).notNull(),
    rankEnabled: boolean('rank_enabled').default(true).notNull(),
    friendEnabled: boolean('friend_enabled').default(true).notNull(),
    discussionEnabled: boolean('discussion_enabled').default(true).notNull(),
    summaryEnabled: boolean('summary_enabled').default(true).notNull(),
    marketingEnabled: boolean('marketing_enabled').default(false).notNull(),
    rankImprovementThreshold: integer('rank_improvement_threshold').default(5).notNull(),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_notification_preferences_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'notification_preferences_user_id_fkey',
    }).onDelete('cascade'),
    check('notification_preferences_threshold_positive', sql`rank_improvement_threshold > 0`),
  ],
);

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * OAuth account links: connects an external identity (Google, GitHub, Apple, Microsoft)
 * to an internal user. The `oauth_accounts.email` is intentionally omitted — email
 * is always sourced from `users.email`.
 *
 * Provider validity is enforced at the application layer, not via a database CHECK
 * constraint. This keeps the schema future-proof for new providers.
 */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    oauthAccountId: uuid('oauth_account_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_oauth_accounts_provider_provider_user_id').using(
      'btree',
      table.provider.asc().nullsLast().op('text_ops'),
      table.providerUserId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('uq_oauth_accounts_user_id_provider').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.provider.asc().nullsLast().op('text_ops'),
    ),
    index('idx_oauth_accounts_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'oauth_accounts_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

// ─── Category Follows ──────────────────────────────────────────────────────────

/**
 * Tracks which users follow which categories.
 * Soft-delete is used for unfollowing so that re-follows are distinguishable
 * from first-time follows and audit history is preserved.
 *
 * The partial unique index enforces at most one *active* follow per (user, category)
 * pair without preventing the same pair from having a historical deleted row.
 */
export const categoryFollows = pgTable(
  'category_follows',
  {
    followId: uuid('follow_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // Enforce at most one active follow per (user, category)
    uniqueIndex('uq_category_follows_user_category_active')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.categoryId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_category_follows_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_category_follows_category_id').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_category_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'category_follows_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.categoryId],
      name: 'category_follows_category_id_fkey',
    }).onDelete('cascade'),
  ],
);

/**
 * User → Tag follow-through table.
 * Supports soft-delete so re-following a previously unfollowed tag restores
 * the existing row instead of inserting a duplicate. A partial unique index
 * enforces at most one *active* follow per (user, tag) pair without preventing
 * historical deleted rows.
 */
export const tagFollows = pgTable(
  'tag_follows',
  {
    followId: uuid('follow_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('uq_tag_follows_user_tag_active')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.tagId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_tag_follows_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_tag_follows_tag_id').using('btree', table.tagId.asc().nullsLast().op('uuid_ops')),
    index('idx_tag_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'tag_follows_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.tagId],
      name: 'tag_follows_tag_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const reviewHelpfulVotes = pgTable(
  'review_helpful_votes',
  {
    voteId: uuid('vote_id').defaultRandom().primaryKey().notNull(),
    reviewId: uuid('review_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_review_helpful_votes_review_user').using(
      'btree',
      table.reviewId.asc().nullsLast().op('uuid_ops'),
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_review_helpful_votes_review_id').using(
      'btree',
      table.reviewId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_review_helpful_votes_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.reviewId],
      foreignColumns: [quizReviews.reviewId],
      name: 'review_helpful_votes_review_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'review_helpful_votes_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const reviewReports = pgTable(
  'review_reports',
  {
    reportId: uuid('report_id').defaultRandom().primaryKey().notNull(),
    reviewId: uuid('review_id').notNull(),
    reporterId: uuid('reporter_id').notNull(),
    reason: text().notNull(),
    details: text('details'),
    status: reviewReportStatus('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_review_reports_review_reporter').using(
      'btree',
      table.reviewId.asc().nullsLast().op('uuid_ops'),
      table.reporterId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_review_reports_status_created').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_review_reports_review_id').using(
      'btree',
      table.reviewId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_review_reports_reporter_id').using(
      'btree',
      table.reporterId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.reviewId],
      foreignColumns: [quizReviews.reviewId],
      name: 'review_reports_review_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reporterId],
      foreignColumns: [users.userId],
      name: 'review_reports_reporter_id_fkey',
    }).onDelete('cascade'),
    check('review_reports_reason_nonblank', sql`length(btrim(reason)) > 0`),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 255 }).primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    operation: varchar('operation', { length: 64 }).notNull(),
    response: jsonb('response'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_idempotency_keys_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_idempotency_keys_user_operation').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.operation.asc().nullsLast().op('text_ops'),
    ),
  ],
);
