import type { QuizCursor } from '../ports/quiz-repository.port';

/**
 * Phase 2 (S-12) extends the listing query with three first-class
 * filter / sort dimensions:
 *   - `q`         — Postgres full-text search over the
 *                   `quiz_search_vector` column (already maintained
 *                   by the schema's `GENERATED ALWAYS AS` expression).
 *                   Backed by the `simple` text-search config so it
 *                   matches the existing search module semantics
 *                   (case-insensitive prefix matching, no stemming).
 *   - `sort`      — server-controlled sort options. `'newest'` is
 *                   the default and was the only sort direction
 *                   before Phase 2; everything else is additive.
 *   - `isHidden`  — admin-only filter for the quizzes admin page.
 *                   Public listing endpoints ignore this; the
 *                   controller strips it from the request unless
 *                   the caller has `QUIZ_VIEW_HIDDEN`.
 *   - `minRating` — show only quizzes whose `quiz_stats.avg_rating`
 *                   is at or above the threshold. The frontend uses
 *                   it for the "Top rated" sort option.
 */
export type ListQuizzesSort = 'newest' | 'popular' | 'top_rated' | 'trending';

export type ListQuizzesQuery = {
  limit: number;
  cursor?: QuizCursor | null;
  filters?: {
    difficulty?: string;
    categoryId?: string;
    tagIds?: string[];
    creatorId?: string;
    q?: string;
    sort?: ListQuizzesSort;
    isHidden?: boolean;
    minRating?: number;
  };
};
