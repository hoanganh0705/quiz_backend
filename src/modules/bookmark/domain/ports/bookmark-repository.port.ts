import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';

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

  // Bookmark operations
  getBookmarkedQuiz(collectionId: string, quizId: string): Promise<BookmarkedQuizRow | null>;

  listBookmarksInCollection(collectionId: string): Promise<BookmarkedQuizDetailRow[]>;

  addQuizToCollection(params: {
    collectionId: string;
    quizId: string;
    notes: string | null;
    nowIso: string;
  }): Promise<BookmarkedQuizRow>;

  removeBookmark(collectionId: string, quizId: string): Promise<void>;

  checkCollectionOwnership(
    collectionId: string,
    userId: string,
  ): Promise<BookmarkCollectionRow | null>;
}

export const BOOKMARK_REPOSITORY_PORT = Symbol('BOOKMARK_REPOSITORY_PORT');
