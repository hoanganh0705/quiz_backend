import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { quizVersions, quizzes } from '@/core/database/schema';

/**
 * Strongly-typed column handle for the `quizzes` table.
 *
 * Cast from the Drizzle inferred type to a `Record<string, AnyPgColumn>`
 * shape so call-sites can pluck individual columns by name. The Drizzle
 * inferred type has every column under `quizzes`, but the cast is
 * necessary to make this a portable module-private constant — Drizzle's
 * Table inference yields a `PgTableWithColumns<...>` whose column
 * accessor types are wider than what we want to expose here.
 */
export const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  creatorId: AnyPgColumn;
  title: AnyPgColumn;
  description: AnyPgColumn;
  slug: AnyPgColumn;
  quizSearchVector: AnyPgColumn;
  requirements: AnyPgColumn;
  imageUrl: AnyPgColumn;
  imagePublicId: AnyPgColumn;
  isFeatured: AnyPgColumn;
  isHidden: AnyPgColumn;
  isVerified: AnyPgColumn;
  publishedVersionId: AnyPgColumn;
  categoryId: AnyPgColumn;
  createdAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
  deletedAt: AnyPgColumn;
};

/**
 * Strongly-typed column handle for the `quiz_versions` table.
 * See {@link QUIZ_COLUMNS} for the cast rationale.
 */
export const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  versionNumber: AnyPgColumn;
  status: AnyPgColumn;
  difficulty: AnyPgColumn;
  durationMs: AnyPgColumn;
  passingScorePercent: AnyPgColumn;
  rewardXp: AnyPgColumn;
  createdByUserId: AnyPgColumn;
  createdAt: AnyPgColumn;
  publishedAt: AnyPgColumn;
  archivedAt: AnyPgColumn;
  updatedAt: AnyPgColumn;
  quizId: AnyPgColumn;
};
