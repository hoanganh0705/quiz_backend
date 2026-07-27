// =============================================================================
// Comment bounded context — schema
//
// Owns the per-quiz comment surface. Each quiz has a flat comment tree
// (top-level comments + one-level deep replies).
//
//   - comments                  (top-level comments + one-level replies;
//                                self-referential via parent_comment_id)
//   - comment_votes             (per-user upvote/downvote on a comment)
//   - comment_reports           (moderation reports on comments)
//
// Cross-domain FKs are intentionally absent (the project enforces
// quiz/user existence via application-layer ports, not DB constraints);
// see plan §4.2 for the rationale and the in-context FKs that survive.
//
// Internal ordering note
//   `comments` has a self-referential FK on `parent_comment_id`
//   (`foreignColumns: [table.id]` resolved at FK build time). The schema
//   exports it first so the `repliesCount` field can reference it without
//   a forward declaration.
//
// Migration note
//   The previous identifier `comments_comments` (and its sibling tables)
//   was dropped in the post-comments rename. See
//   `src/core/database/migrations/0000_initial.sql` for the canonical
//   table definition; the symbol `commentRows` here intentionally keeps
//   the JavaScript name distinct from the singular `Comment` class so a
//   casual grep does not mistake one for the other.
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
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { commentVoteValue, commentReportStatus } from '../shared/enums';
import { users } from '../auth/schema';

// =============================================================================
// comments
// =============================================================================

export const commentRows = pgTable(
  'comments',
  {
    commentId: uuid('comment_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    quizId: uuid('quiz_id').notNull(),
    authorId: uuid('author_id').notNull(),
    parentCommentId: uuid('parent_comment_id'),
    body: text().notNull(),
    isHidden: boolean('is_hidden').default(false).notNull(),
    hiddenById: uuid('hidden_by_id'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true, mode: 'string' }),
    votesCount: integer('votes_count').default(0).notNull(),
    upvotesCount: integer('upvotes_count').default(0).notNull(),
    downvotesCount: integer('downvotes_count').default(0).notNull(),
    repliesCount: integer('replies_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // Quiz feed: top-level comments on a quiz, newest first.
    index('idx_comments_quiz_created')
      .using(
        'btree',
        table.quizId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    // "My activity" feed: a user's comments, newest first.
    index('idx_comments_author_created')
      .using(
        'btree',
        table.authorId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    // Reply listing: top-level replies grouped by parent.
    index('idx_comments_parent_created')
      .using(
        'btree',
        table.parentCommentId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    // Two-level index: replies inlined in the parent's feed.
    // Supports the listComments(left-join) path so the planner can
    // satisfy "for each top-level comment on quiz X, fetch its
    // non-deleted replies in created order" with a single index scan.
    index('idx_comments_quiz_parent_created')
      .using(
        'btree',
        table.quizId.asc().nullsLast().op('uuid_ops'),
        table.parentCommentId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    check('comments_body_nonblank', sql`length(btrim(body)) > 0`),
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.commentId],
      name: 'comments_parent_comment_id_fkey',
    }).onDelete('cascade'),
  ],
);

// =============================================================================
// comment_votes
//
// One row per (user, comment). `value` distinguishes upvote vs downvote.
// The polymorphic target from the Q/A era is gone — votes only target
// comments now, so the unique index is a plain (user_id, comment_id)
// pair (no `target_type` discriminator).
// =============================================================================

export const commentVotes = pgTable(
  'comment_votes',
  {
    voteId: uuid('vote_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    commentId: uuid('comment_id').notNull(),
    value: commentVoteValue().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_comment_votes_user_comment').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.commentId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_comment_votes_comment').using(
      'btree',
      table.commentId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
);

// =============================================================================
// comment_reports
//
// One row per (reporter, comment). The unique index on
// (reporter_id, comment_id) enforces "no duplicate open reports" at
// the DB level — the application maps the unique-violation to
// `DuplicateReportError`.
// =============================================================================

export const commentReports = pgTable(
  'comment_reports',
  {
    reportId: uuid('report_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    reporterId: uuid('reporter_id').notNull(),
    commentId: uuid('comment_id').notNull(),
    reason: text().notNull(),
    details: text('details'),
    status: commentReportStatus().default('open').notNull(),
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
    index('idx_comment_reports_status_created').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_comment_reports_comment').using(
      'btree',
      table.commentId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('uq_comment_reports_reporter_comment').using(
      'btree',
      table.reporterId.asc().nullsLast().op('uuid_ops'),
      table.commentId.asc().nullsLast().op('uuid_ops'),
    ),
    check('comment_reports_reason_nonblank', sql`length(btrim(reason)) > 0`),
  ],
);