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
  jsonb,
  foreignKey,
  boolean,
  smallint,
  bigint,
  numeric,
  pgEnum,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const badgeConditionType = pgEnum('badge_condition_type', [
  'quizzes_completed',
  'quizzes_passed',
  'streak_days',
  'xp_earned',
  'tournaments_won',
  'perfect_score',
]);
export const badgeType = pgEnum('badge_type', ['diamond', 'platinum', 'gold', 'silver', 'bronze']);
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

export const userRole = pgEnum('user_role', ['admin', 'moderator', 'creator', 'user']);

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
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    role: userRole().default('user').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text(),
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

export const userBadges = pgTable(
  'user_badges',
  {
    userBadgeId: uuid('user_badge_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    badgeId: uuid('badge_id').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    metadata: jsonb().default({}).notNull(),
  },
  (table) => [
    index('idx_user_badges_badge_id').using(
      'btree',
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_badges_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
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
    unique('uq_user_badges_user_badge').on(table.badgeId, table.userId),
    check('user_badges_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

export const badges = pgTable(
  'badges',
  {
    badgeId: uuid('badge_id').defaultRandom().primaryKey().notNull(),
    slug: text().notNull(),
    type: badgeType().notNull(),
    name: text().notNull(),
    description: text(),
    conditionType: badgeConditionType('condition_type').notNull(),
    conditionValue: integer('condition_value').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_badges_condition_type').using(
      'btree',
      table.conditionType.asc().nullsLast().op('enum_ops'),
    ),
    unique('uq_badges_slug').on(table.slug),
    check('badges_condition_value_positive', sql`condition_value > 0`),
    check('badges_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'badges_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
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
  },
  (table) => [
    index('idx_quiz_reviews_quiz_created_at_desc').using(
      'btree',
      table.quizId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
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
      sql`status = ANY (ARRAY['joined'::text, 'ready'::text, 'playing'::text, 'disconnected'::text, 'finished'::text])`,
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
