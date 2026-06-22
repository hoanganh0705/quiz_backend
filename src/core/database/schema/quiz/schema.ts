// =============================================================================
// Quiz bounded context — schema
//
// Owns the full quiz lifecycle, from authoring through playback to review:
//   - quizzes                       (top-level quiz record; the creator's intent)
//   - quizVersions                  (immutable content snapshots per quiz)
//   - quizQuestions                 (questions belonging to a quiz version)
//   - quizAnswerOptions             (multiple-choice options per question)
//   - quizCategories                (quiz ↔ taxonomy join; many-to-many)
//   - quizTags                      (quiz ↔ taxonomy join; many-to-many)
//   - quizStats                     (denormalised analytics per quiz)
//   - quizAttempts                  (a single user's play-through of a version)
//   - quizAttemptAnswers            (per-question response within an attempt)
//   - quizAttemptEvents             (fine-grained event log for an attempt)
//   - quizReviews                   (user-submitted ratings + comments)
//   - bookmarkCollections           (user-owned folders for saved quizzes)
//   - bookmarkedQuizzes             (collection ↔ quiz join)
//   - quizInstances                 (live, multi-player sessions)
//   - quizInstancePlayers           (per-player state within a session)
//
// Plus the review-domain tables (co-located here in Phase 3 — the FKs they
// hold point at `quizReviews`, which is the natural join surface):
//   - reviewHelpfulVotes            (a user's "this review was helpful" vote)
//   - reviewReports                 (moderation reports against a review)
//
// Cross-domain FKs
//   - users (auth)                  — all creator / host / reviewer columns
//   - categories, tags (taxonomy)   — still inline in schema/index.ts for
//                                     now; the FKs below temporarily resolve
//                                     them via the barrel. Once Phase 5
//                                     extracts taxonomy, the imports in this
//                                     file are updated to point at the
//                                     taxonomy domain directly.
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  unique,
  check,
  uuid,
  text,
  timestamp,
  integer,
  smallint,
  boolean,
  bigint,
  numeric,
  jsonb,
  foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { quizDifficulty, quizInstanceStatus, quizVersionStatus, reviewReportStatus, tsvector } from '../shared';
import { users } from '../auth/schema';
import { categories, tags } from '..';

// =============================================================================
// quizzes
// =============================================================================

export const quizzes = pgTable(
  'quizzes',
  {
    quizId: uuid('quiz_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizVersions
// =============================================================================

export const quizVersions = pgTable(
  'quiz_versions',
  {
    quizVersionId: uuid('quiz_version_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizQuestions
// =============================================================================

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    questionId: uuid('question_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizAnswerOptions
// =============================================================================

export const quizAnswerOptions = pgTable(
  'quiz_answer_options',
  {
    optionId: uuid('option_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizCategories (quiz ↔ taxonomy join)
// =============================================================================

export const quizCategories = pgTable(
  'quiz_categories',
  {
    quizCategoryId: uuid('quiz_category_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizTags (quiz ↔ taxonomy join)
// =============================================================================

export const quizTags = pgTable(
  'quiz_tags',
  {
    quizTagId: uuid('quiz_tag_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizStats
// =============================================================================

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

// =============================================================================
// quizAttempts
// =============================================================================

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    attemptId: uuid('attempt_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizAttemptAnswers
// =============================================================================

export const quizAttemptAnswers = pgTable(
  'quiz_attempt_answers',
  {
    attemptAnswerId: uuid('attempt_answer_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizAttemptEvents
// =============================================================================

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

// =============================================================================
// quizReviews
// =============================================================================

export const quizReviews = pgTable(
  'quiz_reviews',
  {
    reviewId: uuid('review_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// bookmarkCollections
// =============================================================================

export const bookmarkCollections = pgTable(
  'bookmark_collections',
  {
    collectionId: uuid('collection_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// bookmarkedQuizzes
// =============================================================================

export const bookmarkedQuizzes = pgTable(
  'bookmarked_quizzes',
  {
    bookmarkId: uuid('bookmark_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizInstances
// =============================================================================

export const quizInstances = pgTable(
  'quiz_instances',
  {
    instanceId: uuid('instance_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// quizInstancePlayers
// =============================================================================

export const quizInstancePlayers = pgTable(
  'quiz_instance_players',
  {
    instancePlayerId: uuid('instance_player_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// reviewHelpfulVotes (review domain, co-located in quiz/schema.ts in Phase 3)
// =============================================================================

export const reviewHelpfulVotes = pgTable(
  'review_helpful_votes',
  {
    voteId: uuid('vote_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// =============================================================================
// reviewReports (review domain, co-located in quiz/schema.ts in Phase 3)
// =============================================================================

export const reviewReports = pgTable(
  'review_reports',
  {
    reportId: uuid('report_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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
