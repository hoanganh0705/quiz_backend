import { EXAMPLE_TIMESTAMP } from './_timestamp';

/**
 * Bookmark module success-response examples.
 *
 * Each constant is named `<endpoint>Example` and matches the runtime
 * envelope shape produced by `BookmarkPresenter` (Phase 1 of the bookmark
 * API contract audit). Examples are referenced by `bookmark-swagger-decorators.ts`.
 *
 * The DTO contract is documented in `src/modules/bookmark/dto/response/`;
 * the JSON values below mirror those DTOs exactly so OpenAPI consumers can
 * see the wire format without leaving the docs.
 */

// ─── GET /bookmarks/search ────────────────────────────────────────────────────

export const BOOKMARK_SEARCH_EXAMPLE = {
  data: [
    {
      quizId: '660e8400-e29b-41d4-a716-446655440000',
      title: 'React Hooks Fundamentals',
      slug: 'react-hooks-fundamentals',
      imageUrl: 'https://example.com/covers/react-hooks.png',
      collectionId: '770e8400-e29b-41d4-a716-446655440000',
      collectionName: 'React Learning',
      bookmarkedAt: '2026-06-25T09:30:00.000Z',
    },
    {
      quizId: '660e8400-e29b-41d4-a716-446655440001',
      title: 'React Server Components',
      slug: 'react-server-components',
      imageUrl: null,
      collectionId: '770e8400-e29b-41d4-a716-446655440000',
      collectionName: 'React Learning',
      bookmarkedAt: '2026-06-20T11:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 10,
      hasNextPage: true,
      nextCursor:
        'eyJib29rbWFya2VkQXQiOiIyMDI2LTA2LTIwVDExOjAwOjAwLjAwMFoiLCJib29rbWFya0lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwOTk5In0=',
    },
  },
} as const;

// ─── GET /bookmarks/recent ────────────────────────────────────────────────────

export const BOOKMARK_RECENT_EXAMPLE = {
  data: [
    {
      quizId: '660e8400-e29b-41d4-a716-446655440000',
      title: 'JavaScript Fundamentals',
      slug: 'javascript-fundamentals',
      imageUrl: null,
      collectionId: '770e8400-e29b-41d4-a716-446655440000',
      collectionName: 'Updated Favorites',
      bookmarkedAt: '2026-07-10T11:51:20.265Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /bookmarks/quizzes/:quizId/status ───────────────────────────────────

export const BOOKMARK_STATUS_EXAMPLE = {
  data: {
    bookmarked: true,
    collections: [
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440000',
        name: 'Favorites',
      },
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440001',
        name: 'React Learning',
      },
    ],
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const BOOKMARK_STATUS_NOT_BOOKMARKED_EXAMPLE = {
  data: {
    bookmarked: false,
    collections: [],
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /bookmarks/collections ──────────────────────────────────────────────

export const BOOKMARK_COLLECTION_LIST_EXAMPLE = {
  data: {
    items: [
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Frontend Study List',
        description: 'A curated set of frontend interview quizzes',
        quizCount: 5,
        createdAt: '2026-05-01T12:00:00.000Z',
        updatedAt: '2026-07-12T08:30:00.000Z',
      },
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'React Learning',
        description: null,
        quizCount: 12,
        createdAt: '2026-04-15T09:00:00.000Z',
        updatedAt: '2026-07-01T16:45:00.000Z',
      },
    ],
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /bookmarks/collections ──────────────────────────────────────────────

export const BOOKMARK_COLLECTION_CREATED_EXAMPLE = {
  data: {
    collectionId: '770e8400-e29b-41d4-a716-446655440000',
    name: 'My Favorite Quizzes',
    description: 'A curated set of frontend interview quizzes',
    createdAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /bookmarks/collections/:collectionId (bookmarks inside) ─────────────

export const BOOKMARK_LIST_EXAMPLE = {
  data: {
    items: [
      {
        bookmarkId: '550e8400-e29b-41d4-a716-446655440099',
        quizId: '660e8400-e29b-41d4-a716-446655440000',
        quizTitle: 'JavaScript Fundamentals',
        quizSlug: 'javascript-fundamentals',
        quizImageUrl: 'https://example.com/covers/js.png',
        quizIsFeatured: true,
        notes: 'Review before the interview',
        bookmarkedAt: '2026-06-01T12:00:00.000Z',
      },
    ],
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /bookmarks/collections/:collectionId/analytics ──────────────────────

export const BOOKMARK_COLLECTION_ANALYTICS_EXAMPLE = {
  data: {
    collectionId: '770e8400-e29b-41d4-a716-446655440000',
    collectionName: 'Frontend Study List',
    summary: {
      totalBookmarks: 24,
      totalQuizzes: 24,
      averageQuizRating: 4.2,
      uniqueCategories: 6,
      uniqueTags: 11,
    },
    topCategories: [
      {
        categoryId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Science',
        slug: 'science',
        bookmarkCount: 8,
      },
    ],
    topTags: [
      {
        tagId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Physics',
        slug: 'physics',
        bookmarkCount: 5,
      },
    ],
    lastUpdated: '2026-07-15T01:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /bookmarks/collections/:collectionId/quizzes ──────────────────────

export const BOOKMARK_ADDED_EXAMPLE = {
  data: {
    bookmarkId: '550e8400-e29b-41d4-a716-446655440099',
    collectionId: '770e8400-e29b-41d4-a716-446655440000',
    quizId: '660e8400-e29b-41d4-a716-446655440000',
    notes: 'Review before the interview',
    bookmarkedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /bookmarks/collections/:collectionId/quizzes/bulk ──────────────────

export const BOOKMARK_BULK_ADDED_EXAMPLE = {
  data: {
    addedCount: 2,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/bulk ──────────────

export const BOOKMARK_BULK_REMOVED_EXAMPLE = {
  data: {
    removedCount: 2,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/:quizId ────────────

export const BOOKMARK_REMOVED_EXAMPLE = {
  data: {
    message: 'Bookmark removed successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── PATCH /bookmarks/collections/:collectionId/quizzes/:quizId ────────────

export const BOOKMARK_UPDATED_EXAMPLE = {
  data: {
    bookmarkId: '550e8400-e29b-41d4-a716-446655440099',
    collectionId: '770e8400-e29b-41d4-a716-446655440000',
    quizId: '660e8400-e29b-41d4-a716-446655440000',
    notes: 'Revised personal note',
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /bookmarks/collections/:collectionId/move ──────────────────────────

export const BOOKMARK_MOVED_EXAMPLE = {
  data: {
    message: 'Bookmark moved successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── PATCH /bookmarks/collections/:collectionId ──────────────────────────────

export const BOOKMARK_COLLECTION_UPDATED_EXAMPLE = {
  data: {
    collectionId: '770e8400-e29b-41d4-a716-446655440000',
    name: 'My Renamed Collection',
    description: 'A curated set of frontend interview quizzes',
    createdAt: '2026-05-01T12:00:00.000Z',
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /bookmarks/me/stats ─────────────────────────────────────────────────

export const BOOKMARK_STATS_EXAMPLE = {
  data: {
    totalCollections: 3,
    totalBookmarks: 27,
    favoriteCategory: {
      categoryId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Science',
      slug: 'science',
    },
    favoriteTag: {
      tagId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Physics',
      slug: 'physics',
    },
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── DELETE /bookmarks/collections/:collectionId ─────────────────────────────

export const BOOKMARK_COLLECTION_DELETED_EXAMPLE = {
  data: {
    message: 'Collection deleted successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
