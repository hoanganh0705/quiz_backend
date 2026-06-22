// =============================================================================
// Discussion bounded context — schema
//
// Owns the per-quiz discussion surface:
//   - discussionThreads             (top-level Q/A threads anchored on a quiz)
//   - discussionComments            (replies; self-referential via parentCommentId)
//   - discussionVotes               (per-user upvote/downvote on a thread or
//                                    comment — polymorphic via targetType +
//                                    targetId)
//   - discussionReports             (moderation reports on threads/comments)
//   - discussionThreadSubscriptions (per-user "notify me" follow)
//   - discussionSavedThreads        (per-user "saved for later" bookmarks)
//
// Cross-domain FKs
//   - quizzes (quiz)      — discussionThreads.quizId
//   - users (auth)        — author / solvedBy / reporter / subscriber / saver
//
// Internal ordering note
//   `discussionComments` has a self-referential FK on `parentCommentId`.
//   `discussionThreads` has a forward FK on `solvedCommentId` that points
//   at `discussionComments.commentId`. The lazy FK evaluation pattern
//   (the `ForeignKeyBuilder` config is stored as a callback and only
//   invoked at table-build time) means we can declare `discussionThreads`
//   first and still resolve the `solvedCommentId` reference at build time.
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  discussionContentStatus,
  discussionReportStatus,
  discussionReportTargetType,
  discussionThreadStatus,
  discussionVoteValue,
  tsvector,
} from '../shared';
import { quizzes } from '../quiz/schema';
import { users } from '../auth/schema';

// =============================================================================
// discussionThreads
// =============================================================================

export const discussionThreads = pgTable(
  'discussion_threads',
  {
    threadId: uuid('thread_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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
      foreignColumns: [(discussionComments as { commentId: AnyPgColumn }).commentId],
      name: 'discussion_threads_solved_comment_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.solvedBy],
      foreignColumns: [users.userId],
      name: 'discussion_threads_solved_by_fkey',
    }).onDelete('set null'),
  ],
);

// =============================================================================
// discussionComments
//
// `parentCommentId` is self-referential (a comment can reply to another
// comment). Drizzle supports this via `foreignColumns: [table.commentId]`,
// which is a same-table reference resolved at FK build time.
// =============================================================================

export const discussionComments = pgTable(
  'discussion_comments',
  {
    commentId: uuid('comment_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// discussionVotes
//
// Polymorphic vote: a row targets either a thread or a comment. The
// `targetType` enum discriminates the target, and `targetId` references
// the chosen target. No DB-level FK is enforced on `targetId` (Postgres
// can't express polymorphic FKs), so referential integrity is the
// application's responsibility.
// =============================================================================

export const discussionVotes = pgTable(
  'discussion_votes',
  {
    voteId: uuid('vote_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// discussionThreadSubscriptions
// =============================================================================

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

// =============================================================================
// discussionSavedThreads
// =============================================================================

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

// =============================================================================
// discussionReports
// =============================================================================

export const discussionReports = pgTable(
  'discussion_reports',
  {
    reportId: uuid('report_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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
