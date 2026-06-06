import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';
import type { BookmarkCollectionAnalytics } from '../types/bookmark-collection-analytics';

export type BookmarkCollectionRow = {
  collectionId: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkCollectionWithCountRow = BookmarkCollectionRow & {
  quizCount: number;
};

export type BookmarkedQuizRow = {
  bookmarkId: string;
  collectionId: string;
  quizId: string;
  notes: string | null;
  bookmarkedAt: string;
  updatedAt: string;
};

export type BookmarkedQuizDetailRow = BookmarkedQuizRow & {
  quizTitle: string;
  quizSlug: string;
  quizImageUrl: string | null;
  quizIsFeatured: boolean;
  quizDifficulty: QuizDifficulty | null;
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
  // Collection operations
  getCollectionById(collectionId: string): Promise<BookmarkCollectionRow | null>;

  listCollectionsByUser(userId: string): Promise<BookmarkCollectionWithCountRow[]>;

  createCollection(params: {
    userId: string;
    name: string;
    description: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow>;

  updateCollection(params: {
    collectionId: string;
    name?: string;
    description?: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow>;

  deleteCollection(collectionId: string): Promise<void>;

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
  }): Promise<number>;

  removeBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
  }): Promise<number>;

  moveBookmark(params: {
    userId: string;
    sourceCollectionId: string;
    targetCollectionId: string;
    quizId: string;
    nowIso: string;
  }): Promise<void>;

  removeBookmark(collectionId: string, quizId: string): Promise<void>;

  checkCollectionOwnership(
    collectionId: string,
    userId: string,
  ): Promise<BookmarkCollectionRow | null>;

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
