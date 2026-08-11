// =============================================================================
// Daily-challenge bounded context — schema
//
// Owns the daily-challenge rotation and per-user attempt tracking:
//
//   - dailyChallenge              (one row per UTC day; the day's quiz + version)
//   - dailyChallengeAttempt       (one row per user per day; the user's
//                                  answer log and final score)
//
// Cross-domain FKs
//   - quizzes, quizVersions       — the source quiz content for the day
//   - users (auth)                — the per-user attempt row
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  uuid,
  text,
  integer,
  timestamp,
  date,
  numeric,
  check,
  foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { quizzes, quizVersions } from '../quiz/schema';
import { users } from '../auth/schema';

// =============================================================================
// dailyChallenge
// =============================================================================

export const dailyChallenge = pgTable(
  'daily_challenge',
  {
    challengeId: uuid('challenge_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    /**
     * UTC date for the day's challenge. The cron (00:00 UTC) inserts
     * exactly one row per day; the unique index ensures duplicates
     * cannot accumulate if the cron is run more than once in the same
     * window (e.g. during manual recovery).
     */
    challengeDate: date('challenge_date').notNull(),
    quizId: uuid('quiz_id').notNull(),
    quizVersionId: uuid('quiz_version_id').notNull(),
    /**
     * XP awarded on completion. Mirrors `quiz_versions.reward_xp`
     * at the time of selection — denormalised so a future rotation
     * policy can keep the reward stable even if the source version's
     * XP is updated.
     */
    rewardXp: integer('reward_xp').notNull(),
    /**
     * Cron bookkeeping — `created_at` is the rotation timestamp;
     * `expires_at` mirrors `created_at + 24h` so the application
     * service can do a single equality check against `now()`.
     */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    // One challenge per UTC date — the cron relies on this constraint.
    uniqueIndex('uq_daily_challenge_date').using(
      'btree',
      table.challengeDate.asc().nullsLast().op('date_ops'),
    ),
    index('idx_daily_challenge_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [quizzes.quizId],
      name: 'daily_challenge_quiz_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.quizVersionId],
      foreignColumns: [(quizVersions as { quizVersionId: AnyPgColumn }).quizVersionId],
      name: 'daily_challenge_quiz_version_id_fkey',
    }).onDelete('cascade'),
    check('daily_challenge_reward_xp_nonneg', sql`${table.rewardXp} >= 0`),
  ],
);

// =============================================================================
// dailyChallengeAttempt
// =============================================================================

/**
 * One row per (user, day) pair. The application service guards
 * against double-submission by reading this row inside a transaction;
 * a second attempt for the same day returns 409 (Conflict).
 */
export const dailyChallengeAttempt = pgTable(
  'daily_challenge_attempt',
  {
    attemptId: uuid('attempt_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    challengeId: uuid('challenge_id').notNull(),
    userId: uuid('user_id').notNull(),
    /**
     * Per-question answer log: `optionId` per `questionIndex`. Stored
     * as `jsonb` so we can record partial submissions (the `POST
     * /daily-challenge/answer` endpoint is stateful). Final score
     * is computed by re-evaluating the log against the published
     * version; we do not maintain a denormalised `score_percent` here
     * because the cron re-roll of the day would have to invalidate
     * every attempt — easier to recompute on read.
     */
    answers: text('answers')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /**
     * The question index the user is currently on. `totalQuestions`
     * is set when the attempt completes so the post-attempt read
     * (`GET /daily-challenge/history`) can render "completed in N"
     * without re-fetching the version.
     */
    nextQuestionIndex: integer('next_question_index').notNull().default(0),
    totalQuestions: integer('total_questions'),
    /**
     * Final score (0–100). `null` while the attempt is in flight;
     * set on the answer that completes the attempt. The presence of
     * a value drives the public DTO's `status: 'completed'` discriminator.
     */
    scorePercent: numeric('score_percent', { precision: 5, scale: 2 }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One attempt per (user, day) — the second submission is rejected
    // at the application layer with 409.
    uniqueIndex('uq_daily_challenge_attempt_user_challenge').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.challengeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_daily_challenge_attempt_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('idx_daily_challenge_attempt_challenge').using(
      'btree',
      table.challengeId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.challengeId],
      foreignColumns: [dailyChallenge.challengeId],
      name: 'daily_challenge_attempt_challenge_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'daily_challenge_attempt_user_id_fkey',
    }).onDelete('cascade'),
    check('daily_challenge_attempt_index_nonneg', sql`${table.nextQuestionIndex} >= 0`),
    check(
      'daily_challenge_attempt_score_range',
      sql`${table.scorePercent} IS NULL OR (${table.scorePercent} >= 0 AND ${table.scorePercent} <= 100)`,
    ),
  ],
);
