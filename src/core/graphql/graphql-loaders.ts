/**
 * Per-request DataLoader set.
 *
 * A GraphQL response tree is resolved breadth-first, so every quiz on a page
 * asks for its creator, category, and tags at the same moment. Without
 * batching that becomes one query per field per row. Each loader collapses
 * those calls into a single repository read keyed by the requested ids.
 *
 * Loaders are instantiated per request and therefore never share a cache
 * across the requests of two different users.
 */
import DataLoader from 'dataloader';

import type {
  AuthorSummaryRow,
  CategorySummaryRow,
  QuizTagRow,
} from '@/modules/quiz/domain/ports/quiz-repository.port';

export type GqlLoaders = {
  authorById: DataLoader<string, AuthorSummaryRow | null>;
  categoryById: DataLoader<string, CategorySummaryRow | null>;
  tagsByQuizId: DataLoader<string, readonly QuizTagRow[]>;
};

type LoaderDeps = {
  getAuthorSummaries(userIds: string[]): Promise<Map<string, AuthorSummaryRow>>;
  getCategorySummaries(categoryIds: string[]): Promise<Map<string, CategorySummaryRow>>;
  getTagsForQuizIds(quizIds: string[]): Promise<Map<string, QuizTagRow[]>>;
};

/**
 * A missing row resolves to `null` rather than rejecting, so one absent
 * creator does not fail the entire page. `DataLoader` requires every key to
 * be answered, which is why the batch read is mapped back onto the input.
 */
const toBatchLookup =
  <T>(
    read: (keys: string[]) => Promise<Map<string, T>>,
  ): ((keys: readonly string[]) => Promise<(T | null)[]>) =>
  async (keys) => {
    const found = await read([...keys]);
    return keys.map((key) => found.get(key) ?? null);
  };

export const createGqlLoaders = (deps: LoaderDeps): GqlLoaders => ({
  authorById: new DataLoader<string, AuthorSummaryRow | null>(
    toBatchLookup((keys) => deps.getAuthorSummaries(keys)),
  ),
  categoryById: new DataLoader<string, CategorySummaryRow | null>(
    toBatchLookup((keys) => deps.getCategorySummaries(keys)),
  ),
  tagsByQuizId: new DataLoader<string, readonly QuizTagRow[]>(async (quizIds) => {
    const found = await deps.getTagsForQuizIds([...quizIds]);
    return quizIds.map((quizId) => found.get(quizId) ?? []);
  }),
});
