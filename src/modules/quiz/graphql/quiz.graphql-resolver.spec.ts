import { QuizGraphqlResolver } from './quiz.graphql-resolver';
import { QuizzesBundleArgsGql, toQuizzesBundleFilters } from './quiz.graphql.args';

describe('QuizGraphqlResolver', () => {
  describe('quizzesBundle', () => {
    const bundleService = {
      getBundle: jest.fn(),
    };

    const createResolver = () => new QuizGraphqlResolver(bundleService as never);

    beforeEach(() => {
      bundleService.getBundle.mockReset();
    });

    it('returns the bundle presented for the transport', async () => {
      bundleService.getBundle.mockResolvedValue({
        items: {
          items: [
            {
              quizId: 'quiz-1',
              creatorId: 'user-1',
              creator: {
                userId: 'user-1',
                username: 'alice',
                displayName: 'Alice',
                avatarUrl: null,
              },
              title: 'JavaScript Fundamentals',
              description: 'Learn the basics',
              slug: 'javascript-fundamentals',
              imageUrl: null,
              isFeatured: true,
              questionCount: 10,
              averageRating: 4.5,
              reviewCount: 20,
              attemptCount: 100,
              categoryId: 'cat-1',
              categoryName: 'Web Development',
              categorySlug: 'web-development',
              tags: [{ tagId: 'tag-1', name: 'JavaScript', slug: 'javascript' }],
              publishedVersion: { difficulty: 'medium' },
            },
          ],
          pagination: { limit: 20, nextCursor: 'next', hasNextPage: true },
        },
        popular: [
          {
            rank: 1,
            quizId: 'quiz-1',
            title: 'JavaScript Fundamentals',
            slug: 'javascript-fundamentals',
            imageUrl: null,
            popularityScore: 99.5,
            totalAttempts: 100,
          },
        ],
        trending: [],
        categories: [
          { rank: 1, categoryId: 'cat-1', name: 'Web Development', slug: 'web-development' },
        ],
        tags: [{ rank: 1, tagId: 'tag-1', name: 'JavaScript', slug: 'javascript' }],
      });

      const result = await createResolver().quizzesBundle(new QuizzesBundleArgsGql());

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        quizId: 'quiz-1',
        title: 'JavaScript Fundamentals',
        difficulty: { label: 'medium' },
        category: {
          categoryId: 'cat-1',
          name: 'Web Development',
          slug: 'web-development',
        },
        tags: [{ tagId: 'tag-1', name: 'JavaScript', slug: 'javascript' }],
      });
      expect(result.pageInfo).toEqual({
        limit: 20,
        nextCursor: 'next',
        hasNextPage: true,
      });
      expect(result.popular[0].popularityScore).toBe(99.5);
    });

    it('forwards the arguments as a transport-agnostic filter', async () => {
      bundleService.getBundle.mockResolvedValue({
        items: { items: [], pagination: { limit: 20, nextCursor: null, hasNextPage: false } },
        popular: [],
        trending: [],
        categories: [],
        tags: [],
      });

      const args = Object.assign(new QuizzesBundleArgsGql(), {
        q: 'typescript',
        categoryId: 'cat-1',
        tagSlugs: ['javascript'],
        cursor: 'cursor-1',
        limit: 10,
      });

      await createResolver().quizzesBundle(args);

      expect(bundleService.getBundle).toHaveBeenCalledWith({
        filters: {
          q: 'typescript',
          sort: undefined,
          difficulty: undefined,
          categoryId: 'cat-1',
          tagSlugs: ['javascript'],
          cursor: 'cursor-1',
          limit: 10,
        },
        railLimit: undefined,
      });
    });
  });
});

describe('toQuizzesBundleFilters', () => {
  it('defaults the page size', () => {
    const filters = toQuizzesBundleFilters({});
    expect(filters.limit).toBe(20);
  });

  it('clamps a page size above the maximum', () => {
    const filters = toQuizzesBundleFilters({ limit: 500 });
    expect(filters.limit).toBe(50);
  });

  /**
   * The resolver is handed the arguments as a plain object, so the projection
   * must never reach for a prototype method to read them.
   */
  it('reads arguments from a plain object', () => {
    const filters = toQuizzesBundleFilters({ tagSlugs: ['javascript'] });
    expect(filters.tagSlugs).toEqual(['javascript']);
  });
});
