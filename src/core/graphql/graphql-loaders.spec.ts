import { createGqlLoaders } from './graphql-loaders';
import type {
  AuthorSummaryRow,
  CategorySummaryRow,
  QuizTagRow,
} from '@/modules/quiz/domain/ports/quiz-repository.port';

type AuthorRow = AuthorSummaryRow;
type CategoryRow = CategorySummaryRow;
type TagRow = QuizTagRow;

/**
 * DataLoader batches within a single microtask tick, so a test that awaits
 * the individual `load` calls would observe one batch per call. The loaders
 * are primed and then flushed together to reproduce the breadth-first
 * resolution a real response tree produces.
 */
describe('createGqlLoaders', () => {
  const authorRows: AuthorRow[] = [
    {
      userId: 'u1',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      avatarPublicId: null,
    },
    {
      userId: 'u2',
      username: 'bob',
      displayName: 'Bob',
      avatarUrl: null,
      avatarPublicId: null,
    },
  ];
  const categoryRows: CategoryRow[] = [{ categoryId: 'c1', name: 'Web', slug: 'web' }];
  const tagRows: Record<string, TagRow[]> = {
    q1: [{ tagId: 't1', name: 'JavaScript', slug: 'javascript' }],
    q2: [],
  };

  const deps = {
    getAuthorSummaries: jest.fn(
      async (ids: string[]) =>
        new Map(
          authorRows.filter((row) => ids.includes(row.userId)).map((row) => [row.userId, row]),
        ),
    ),
    getCategorySummaries: jest.fn(
      async (ids: string[]) =>
        new Map(
          categoryRows
            .filter((row) => ids.includes(row.categoryId))
            .map((row) => [row.categoryId, row]),
        ),
    ),
    getTagsForQuizIds: jest.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, tagRows[id] ?? []])),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collapses one page of creators into a single repository read', async () => {
    const loaders = createGqlLoaders(deps);

    const results = await Promise.all([
      loaders.authorById.load('u1'),
      loaders.authorById.load('u2'),
      loaders.authorById.load('u1'),
    ]);

    expect(deps.getAuthorSummaries).toHaveBeenCalledTimes(1);
    expect(deps.getAuthorSummaries).toHaveBeenCalledWith(['u1', 'u2']);
    expect(results).toEqual([authorRows[0], authorRows[1], authorRows[0]]);
  });

  it('serves a repeated key from cache without a second read', async () => {
    const loaders = createGqlLoaders(deps);

    await loaders.authorById.load('u1');
    // A later tick reuses the cached value for the same key.
    const again = await loaders.authorById.load('u1');

    expect(deps.getAuthorSummaries).toHaveBeenCalledTimes(1);
    expect(again).toEqual(authorRows[0]);
  });

  it('batches categories alongside creators independently', async () => {
    const loaders = createGqlLoaders(deps);

    await Promise.all([
      loaders.authorById.load('u1'),
      loaders.categoryById.load('c1'),
      loaders.categoryById.load('c1'),
    ]);

    expect(deps.getAuthorSummaries).toHaveBeenCalledTimes(1);
    expect(deps.getCategorySummaries).toHaveBeenCalledTimes(1);
  });

  /**
   * A missing row must resolve to null rather than reject, because DataLoader
   * requires every key to be answered and one absent creator should not fail
   * the whole page.
   */
  it('resolves a missing row to null instead of failing the batch', async () => {
    const loaders = createGqlLoaders(deps);

    const [found, missing] = await Promise.all([
      loaders.authorById.load('u1'),
      loaders.authorById.load('missing'),
    ]);

    expect(found).toEqual(authorRows[0]);
    expect(missing).toBeNull();
  });

  it('resolves a quiz with no tags to an empty list', async () => {
    const loaders = createGqlLoaders(deps);

    const [withTags, withoutTags] = await Promise.all([
      loaders.tagsByQuizId.load('q1'),
      loaders.tagsByQuizId.load('q2'),
    ]);

    expect(withTags).toEqual(tagRows.q1);
    expect(withoutTags).toEqual([]);
  });

  it('keeps one loader set from leaking into another', async () => {
    const first = createGqlLoaders(deps);
    const second = createGqlLoaders(deps);

    await first.authorById.load('u1');
    await second.authorById.load('u1');

    // A shared cache would have answered the second load from the first.
    expect(deps.getAuthorSummaries).toHaveBeenCalledTimes(2);
  });
});
