import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BOOKMARK_REPOSITORY_PORT,
  type BookmarkRepositoryPort,
  type BookmarkCollectionRow,
} from './ports/bookmark-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  CollectionNotFoundError,
  CollectionForbiddenError,
  CollectionConflictError,
  BookmarkNotFoundError,
  BookmarkConflictError,
} from './errors';
import {
  COLLECTION_NOT_FOUND_MESSAGE,
  COLLECTION_FORBIDDEN_MESSAGE,
  COLLECTION_NAME_CONFLICT_MESSAGE,
  BOOKMARK_NOT_FOUND_MESSAGE,
  BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE,
} from '../bookmark.constants';
import type { AnalyticsEventHandler } from '@/modules/quiz/domain/analytics/analytics-event-handler';

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{ quizId: string } | null>;
    },
    @Inject(forwardRef(() => require('@/modules/quiz/quiz.module').AnalyticsEventHandler))
    private readonly analyticsEventHandler: AnalyticsEventHandler,
    @InjectPinoLogger(BookmarkService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getOwnedCollectionOrThrow(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionRow> {
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new CollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    return collection;
  }

  // ---------------------------------------------------------------------------
  // Collection operations
  // ---------------------------------------------------------------------------

  async listCollections(user: JwtPayload) {
    return this.bookmarkRepository.listCollectionsByUser(user.sub);
  }

  async createCollection(user: JwtPayload, name: string, description: string | null | undefined) {
    const nowIso = new Date().toISOString();

    try {
      const collection = await this.bookmarkRepository.createCollection({
        userId: user.sub,
        name,
        description: description ?? null,
        nowIso,
      });

      this.logger.info({
        event: 'collection_created',
        collectionId: collection.collectionId,
        userId: user.sub,
      });

      return collection;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_user_name') {
        this.logger.warn({ event: 'collection_create_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async updateCollection(
    collectionId: string,
    user: JwtPayload,
    name: string | undefined,
    description: string | null | undefined,
  ) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const nowIso = new Date().toISOString();

    try {
      const updated = await this.bookmarkRepository.updateCollection({
        collectionId,
        name,
        description,
        nowIso,
      });

      this.logger.info({
        event: 'collection_updated',
        collectionId,
        userId: user.sub,
      });

      return updated;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_user_name') {
        this.logger.warn({ event: 'collection_update_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async deleteCollection(collectionId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    await this.bookmarkRepository.deleteCollection(collectionId);

    this.logger.info({
      event: 'collection_deleted',
      collectionId,
      userId: user.sub,
    });
  }

  // ---------------------------------------------------------------------------
  // Bookmark operations
  // ---------------------------------------------------------------------------

  async addBookmark(
    collectionId: string,
    quizId: string,
    notes: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    await this.getOwnedCollectionOrThrow(collectionId, user);

    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz) {
      throw new CollectionNotFoundError('Quiz not found');
    }

    try {
      const bookmark = await this.bookmarkRepository.addQuizToCollection({
        collectionId,
        quizId,
        notes: notes ?? null,
        nowIso,
      });

      this.logger.info({
        event: 'quiz_bookmarked',
        collectionId,
        quizId,
        userId: user.sub,
      });

      // Refresh quiz analytics
      await this.analyticsEventHandler.onBookmarkAdded(quizId);

      return bookmark;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmarked_quizzes_pair') {
        this.logger.warn({
          event: 'bookmark_duplicate',
          collectionId,
          quizId,
          userId: user.sub,
        });
        throw new BookmarkConflictError(BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  async removeBookmark(collectionId: string, quizId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const existing = await this.bookmarkRepository.getBookmarkedQuiz(collectionId, quizId);
    if (!existing) {
      throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
    }

    await this.bookmarkRepository.removeBookmark(collectionId, quizId);

    this.logger.info({
      event: 'quiz_unbookmarked',
      collectionId,
      quizId,
      userId: user.sub,
    });

    // Refresh quiz analytics
    await this.analyticsEventHandler.onBookmarkRemoved(quizId);
  }

  async listBookmarksInCollection(collectionId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    return this.bookmarkRepository.listBookmarksInCollection(collectionId);
  }
}
