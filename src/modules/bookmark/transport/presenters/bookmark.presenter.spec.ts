import { BookmarkPresenter } from './bookmark.presenter';

describe('BookmarkPresenter', () => {
  let presenter: BookmarkPresenter;

  beforeEach(() => {
    presenter = new BookmarkPresenter();
  });

  describe('searchBookmarks / getRecentBookmarks', () => {
    const paginatedPayload = {
      items: [
        {
          quizId: '00000000-0000-0000-0000-000000000001',
          title: 'React Hooks Fundamentals',
          slug: 'react-hooks-fundamentals',
          imageUrl: null,
          collectionId: '00000000-0000-0000-0000-000000000002',
          collectionName: 'React Learning',
          bookmarkedAt: '2025-06-01T12:00:00.000Z',
        },
      ],
      pagination: {
        kind: 'cursor' as const,
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      },
    };

    it('searchBookmarks unwraps to { data: T[], meta: { timestamp, pagination } }', () => {
      const out = presenter.searchBookmarks(paginatedPayload);
      expect(Array.isArray(out.data)).toBe(true);
      expect(out.data).toHaveLength(1);
      expect(out.data[0]).toMatchObject({
        quizId: '00000000-0000-0000-0000-000000000001',
        title: 'React Hooks Fundamentals',
      });
      expect(out.meta.pagination).toEqual({
        kind: 'cursor',
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      });
      expect(typeof out.meta.timestamp).toBe('string');
    });

    it('getRecentBookmarks unwraps to { data: T[], meta: { timestamp, pagination } }', () => {
      const out = presenter.getRecentBookmarks(paginatedPayload);
      expect(Array.isArray(out.data)).toBe(true);
      expect(out.data).toHaveLength(1);
      expect(out.meta.pagination?.kind).toBe('cursor');
    });

    it('preserves nextCursor when there are more pages', () => {
      const out = presenter.searchBookmarks({
        ...paginatedPayload,
        pagination: {
          kind: 'cursor',
          limit: 10,
          hasNextPage: true,
          nextCursor: 'cursor-encoded',
        },
      });
      expect(out.meta.pagination).toEqual({
        kind: 'cursor',
        limit: 10,
        hasNextPage: true,
        nextCursor: 'cursor-encoded',
      });
    });

    it('returns an empty array when items is empty', () => {
      const out = presenter.searchBookmarks({
        items: [],
        pagination: { kind: 'cursor', limit: 10, hasNextPage: false, nextCursor: null },
      });
      expect(out.data).toEqual([]);
      expect(out.meta.pagination?.kind).toBe('cursor');
    });
  });

  describe('single-resource endpoints', () => {
    it('addBookmark wraps the whole DTO as data', () => {
      const out = presenter.addBookmark({ bookmarkId: 'bm-1' } as never);
      expect(out.data).toEqual({ bookmarkId: 'bm-1' });
      expect(typeof out.meta.timestamp).toBe('string');
    });
  });
});
