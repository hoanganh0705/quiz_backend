/**
 * Shared, internal types for the user-module repository aggregates.
 *
 * This file exists to:
 *  1. Type the result of raw `db.execute(sql\`\`)` calls (Drizzle types
 *     them as `unknown`, so we declare the exact row shape once and
 *     pass it via the `sql<T>` generic).
 *  2. Avoid repeating leaky `Parameters<Parameters<typeof db.transaction>[0]>[0]`
 *     type expressions in every aggregate that participates in a
 *     transaction.
 *  3. Provide a single source of truth for the partial `users` row
 *     returned by transactional `UPDATE … RETURNING` so multiple
 *     aggregates can share an assembler callback type.
 */

import type { DrizzleDB } from '@/core/database/database.module';

/**
 * The `tx` parameter of any `DrizzleDB.transaction((tx) => …)` call.
 * Drizzle does not export this alias, so we derive it locally.
 */
export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

/**
 * Row shape returned by the streak-cache UPDATE … RETURNING statement
 * in `UserAccountRepository.updateStreakCache`.
 */
export interface UserStreakRawRow extends Record<string, unknown> {
  current_streak: number | string;
  longest_streak: number | string;
  last_streak_day: string | null;
}

/**
 * Row shape returned by the combined analytics CTE in
 * `UserAnalyticsRepository.getUserAnalytics`.
 */
export interface UserAnalyticsRawRow extends Record<string, unknown> {
  totalAttempts: number | string;
  completedQuizzes: number | string;
  averageScore: number | string;
  lastUpdated: string | null;
  favoriteCategoryId: string | null;
  favoriteCategoryName: string | null;
  favoriteTagId: string | null;
  favoriteTagName: string | null;
}

/**
 * Shape of the `users` row that the settings/preferences flows return
 * from their transactional `UPDATE … RETURNING`. Combined with a
 * re-fetched profile + ranking via {@link UserMeRowAssembler}, it
 * produces a full `UserMeRow`.
 */
export interface UpdatedUserCoreRow {
  userId: string;
  username: string;
  email: string;
  currentStreak: number;
  longestStreak: number;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * Callback used by `UserSettingsRepository` to re-assemble a full
 * `UserMeRow` after a transactional update. Hoisted to a named type so
 * the repository signatures don't repeat the leaky
 * `Parameters<Parameters<typeof db.transaction>[0]>[0]` expression.
 */
export type UserMeRowAssembler = (tx: DrizzleTx, updated: UpdatedUserCoreRow) => Promise<unknown>;
