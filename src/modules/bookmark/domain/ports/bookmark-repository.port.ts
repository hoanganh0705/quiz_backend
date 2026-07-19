import type { BookmarkCollectionAnalytics } from '../types/bookmark-collection-analytics';

export type BookmarkedQuizRow = {
  bookmarkId: string;
  collectionId: string;
  quizId: string;
  notes: string | null;
  bookmarkedAt: string;
  updatedAt: string;
};

export type BulkBookmarkMutationRow = {
  bookmarkId: string;
  quizId: string;
};

export type BookmarkedQuizDetailRow = BookmarkedQuizRow & {
  quizTitle: string;
  quizSlug: string;
  quizImageUrl: string | null;
  quizIsFeatured: boolean;
  quizPublishedVersionId: string | null;
};

export type RecentBookmarkRow = {
  bookmarkId: string;
  quizId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  collectionId: string;
  collectionName: string;
  bookmarkedAt: string;
};

export type SearchBookmarkRow = {
  bookmarkId: string;
  quizId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  collectionId: string;
  collectionName: string;
  bookmarkedAt: string;
};

export type BookmarkStatusRow = {
  bookmarked: boolean;
  collections: Array<{
    collectionId: string;
    name: string;
  }>;
};

export type BookmarkSearchResult = {
  items: SearchBookmarkRow[];
  limit: number;
  hasNextPage: boolean;
  nextCursor: RecentBookmarkCursor | null;
};

export interface BookmarkRepositoryPort {
  // Bookmark operations
  getBookmarkedQuiz(collectionId: string, quizId: string): Promise<BookmarkedQuizRow | null>;

  listBookmarksInCollection(collectionId: string): Promise<BookmarkedQuizDetailRow[]>;

  listRecentBookmarks(params: {
    userId: string;
    limit: number;
    cursor?: { bookmarkedAt: string; bookmarkId: string } | null;
  }): Promise<RecentBookmarkRow[]>;

  searchBookmarks(params: {
    userId: string;
    query: string;
    limit: number;
    cursor?: { bookmarkedAt: string; bookmarkId: string } | null;
  }): Promise<SearchBookmarkRow[]>;

  getBookmarkStatus(userId: string, quizId: string): Promise<BookmarkStatusRow>;

  addQuizToCollection(params: {
    collectionId: string;
    quizId: string;
    notes: string | null;
    nowIso: string;
  }): Promise<BookmarkedQuizRow>;

  addBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
    nowIso: string;
  }): Promise<BulkBookmarkMutationRow[]>;

  removeBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
  }): Promise<BulkBookmarkMutationRow[]>;

  moveBookmark(params: {
    userId: string;
    sourceCollectionId: string;
    targetCollectionId: string;
    quizId: string;
    nowIso: string;
    /** When true, verifies the bookmark exists in source before moving; throws if not found. */
    verifySource?: boolean;
  }): Promise<void>;

  removeBookmark(collectionId: string, quizId: string): Promise<void>;

  updateBookmark(params: {
    collectionId: string;
    quizId: string;
    notes: string | null;
    nowIso: string;
  }): Promise<BookmarkedQuizRow>;

  getCollectionAnalytics(collectionId: string): Promise<BookmarkCollectionAnalytics | null>;

  getUserBookmarkStats(userId: string): Promise<UserBookmarkStatsRow>;
}

export type UserBookmarkStatsRow = {
  totalCollections: number;
  totalBookmarks: number;
  favoriteCategory: {
    categoryId: string;
    name: string;
    slug: string;
  } | null;
  favoriteTag: {
    tagId: string;
    name: string;
    slug: string;
  } | null;
};

export type RecentBookmarkCursor = {
  bookmarkedAt: string;
  bookmarkId: string;
};

export const BOOKMARK_REPOSITORY_PORT = Symbol('BOOKMARK_REPOSITORY_PORT');
