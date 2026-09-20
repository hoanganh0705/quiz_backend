import { desc, eq, and, or, sql, inArray, type SQL } from 'drizzle-orm';
import { quizStats, quizTags, quizVersions } from '@/core/database/schema';
import type { QuizListFilters } from '@/modules/quiz/domain/ports';
import type { QuizCursor } from '@/modules/quiz/domain/ports/quiz-repository.port';
import { QUIZ_COLUMNS } from './quiz.repository.columns';

export type ListQuerySortKey = 'newest' | 'popular' | 'top_rated' | 'trending';

export type ListQueryPlan = {
  filters: SQL[];
  orderBy: SQL[];
  sortKey: ListQuerySortKey;
};

/**
 * Builds the (filter, orderBy, sortKey) tuple shared by every list
 * endpoint (public, by-creator, drafts-by-creator,
 * published-by-creator).
 *
 * Centralising this in a module-private helper ensures that adding a
 * new filter to the public surface automatically flows through to the
 * per-creator routes, and removes a ~120-line duplication across the
 * four list methods on `QuizRepository`.
 *
 * @param filtersIn - caller-supplied filter object (nullable for the
 *                    unfiltered public list path)
 * @param cursor    - cursor-based pagination key
 */
export function buildQuizListQuery(
  filtersIn: QuizListFilters | undefined,
  cursor: QuizCursor | null | undefined,
): ListQueryPlan {
  const filters: SQL[] = [sql`${QUIZ_COLUMNS.deletedAt} IS NULL`];

  if (filtersIn?.isHidden !== undefined) {
    filters.push(eq(QUIZ_COLUMNS.isHidden, filtersIn.isHidden));
  } else {
    filters.push(eq(QUIZ_COLUMNS.isHidden, false));
  }

  if (filtersIn?.difficulty) {
    filters.push(
      sql`exists (
        select 1
        from ${quizVersions} qv_filter
        where qv_filter.quiz_id = ${QUIZ_COLUMNS.quizId}
          and qv_filter.quiz_version_id = ${QUIZ_COLUMNS.publishedVersionId}
          and qv_filter.difficulty = ${filtersIn.difficulty}
      )`,
    );
  }

  if (filtersIn?.categoryId) {
    filters.push(eq(QUIZ_COLUMNS.categoryId, filtersIn.categoryId));
  }

  if (filtersIn?.tagIds && filtersIn.tagIds.length > 0) {
    filters.push(
      sql`exists (
        select 1
        from ${quizTags}
        where ${quizTags.quizId} = ${QUIZ_COLUMNS.quizId}
          and ${inArray(quizTags.tagId, filtersIn.tagIds)}
      )`,
    );
  }

  if (filtersIn?.creatorId) {
    filters.push(eq(QUIZ_COLUMNS.creatorId, filtersIn.creatorId));
  }

  if (filtersIn?.q) {
    const tsquery = sql<string>`websearch_to_tsquery('simple', ${filtersIn.q})`;
    filters.push(sql`${QUIZ_COLUMNS.quizSearchVector} @@ ${tsquery}`);
  }

  if (filtersIn?.minRating !== undefined) {
    filters.push(
      sql`exists (
        select 1
        from ${quizStats}
        where ${quizStats.quizId} = ${QUIZ_COLUMNS.quizId}
          and ${quizStats.avgRating} >= ${filtersIn.minRating}
      )`,
    );
  }

  if (cursor) {
    filters.push(
      or(
        sql`${QUIZ_COLUMNS.createdAt} < ${cursor.createdAt}`,
        and(
          eq(QUIZ_COLUMNS.createdAt, cursor.createdAt),
          sql`${QUIZ_COLUMNS.quizId} < ${cursor.quizId}`,
        ),
      ) as SQL,
    );
  }

  const sortKey = filtersIn?.sort ?? 'newest';
  const orderBy: SQL[] =
    sortKey === 'popular'
      ? [
          sql`coalesce(${sql.raw('qs.popularity_score')}, 0) desc`,
          desc(QUIZ_COLUMNS.createdAt),
          desc(QUIZ_COLUMNS.quizId),
        ]
      : sortKey === 'top_rated'
        ? [
            sql`coalesce(${sql.raw('qs.avg_rating')}, 0) desc`,
            desc(QUIZ_COLUMNS.createdAt),
            desc(QUIZ_COLUMNS.quizId),
          ]
        : sortKey === 'trending'
          ? [
              sql`coalesce(${sql.raw('qs.trending_score')}, 0) desc`,
              desc(QUIZ_COLUMNS.createdAt),
              desc(QUIZ_COLUMNS.quizId),
            ]
          : [desc(QUIZ_COLUMNS.createdAt), desc(QUIZ_COLUMNS.quizId)];

  return { filters, orderBy, sortKey };
}
