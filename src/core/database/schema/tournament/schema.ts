import {
  pgTable,
  index,
  unique,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  smallint,
  numeric,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { quizDifficulty, tournamentStatus, tournamentRoundStatus } from '../shared';
import { quizVersions, quizAttempts } from '../quiz/schema';
import { categories } from '../taxonomy/schema';
import { users } from '../auth/schema';

// =============================================================================
// Tournament Domain Schema
//
// Tables: tournaments, tournamentRounds, tournamentParticipants,
//         tournamentRoundParticipants, tournamentStats
//
// FKs to other domains:
// - tournaments.categoryId → categories (taxonomy)
// - tournamentRounds.quizVersionId → quizVersions (quiz)
// - tournamentParticipants.userId → users (auth)
// - tournamentRoundParticipants.attemptId → quizAttempts (quiz)
// =============================================================================

// -----------------------------------------------------------------------------
// tournaments
// -----------------------------------------------------------------------------

export const tournaments = pgTable(
  'tournaments',
  {
    tournamentId: uuid('tournament_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    title: text().notNull(),
    description: text(),
    difficulty: quizDifficulty().notNull(),
    status: tournamentStatus().default('upcoming').notNull(),
    prize: text(),
    startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
    maxParticipants: integer('max_participants'),
    categoryId: uuid('category_id'),
    // Phase 1 / Issue #2 — tournament ownership column. The FK targets
    // `users.user_id` with `ON DELETE RESTRICT`: dropping a user who
    // still owns tournaments must fail at the DB layer in addition
    // to the application-layer ownership policy. The migration that
    // introduced this column (`0017_tournaments_owner_user_id.sql`)
    // backfilled every pre-existing row to a seeded `system` actor so
    // the column is `NOT NULL` from day one.
    //
    // The partial index `idx_tournaments_owner_active` on this column
    // (same shape as the existing category-active index) covers the
    // ownership reads added by Phase 1: "list tournaments I own" plus
    // the `PATCH` / `DELETE` ownership checks.
    ownerUserId: uuid('owner_user_id').notNull(),
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
    // Phase 1 / Issue #2 — partial index that matches the existing
    // category-active shape so ownership reads can use the same scan
    // plan. Created by migration 0017.
    index('idx_tournaments_owner_active')
      .using('btree', table.ownerUserId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.categoryId],
      name: 'tournaments_category_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.ownerUserId],
      foreignColumns: [users.userId],
      name: 'tournaments_owner_user_id_fkey',
    }).onDelete('restrict'),
    check(
      'tournaments_max_participants_positive',
      sql`(max_participants IS NULL) OR (max_participants > 0)`,
    ),
    check('tournaments_start_end_order', sql`end_at > start_at`),
    check('tournaments_title_nonblank', sql`length(btrim(title)) > 0`),
  ],
);

// -----------------------------------------------------------------------------
// tournamentRounds
// -----------------------------------------------------------------------------

export const tournamentRounds = pgTable(
  'tournament_rounds',
  {
    roundId: uuid('round_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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
      foreignColumns: [quizVersions.quizVersionId],
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

// -----------------------------------------------------------------------------
// tournamentParticipants
// -----------------------------------------------------------------------------

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    participantId: uuid('participant_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// -----------------------------------------------------------------------------
// tournamentRoundParticipants
// -----------------------------------------------------------------------------

export const tournamentRoundParticipants = pgTable(
  'tournament_round_participants',
  {
    roundParticipantId: uuid('round_participant_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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

// -----------------------------------------------------------------------------
// tournamentStats
// -----------------------------------------------------------------------------

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
