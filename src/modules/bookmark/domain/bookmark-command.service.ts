import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isPostgresForeignKeyViolation, resolvePgError } from '@/common/utils/db-error.util';
import {
  BOOKMARK_REPOSITORY_PORT,
  type BookmarkRepositoryPort,
} from './ports/bookmark-repository.port';
import {
  BOOKMARK_COLLECTION_REPOSITORY_PORT,
  type BookmarkCollectionRepositoryPort,
  type BookmarkCollectionRow,
} from './ports/bookmark-collection-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { QuizNotFoundError } from '@/modules/quiz/domain/errors';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  BookmarkCollectionNotFoundError,
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
import {
  BOOKMARK_DOMAIN_EVENT_BUS,
  type BookmarkDomainEventBusPort,
} from './events/bookmark-domain-event-bus.port';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './events/bookmark-domain.events';

/**
 * BookmarkCommandService — Mutation operations for the Bookmark aggregate.
 *
 * Responsibilities:
 *  - Create, update, delete bookmark collections
 *  - Add and remove bookmarks
 *  - Move bookmarks between collections
 *  - Enforce business rules and authorization
 *  - Emit domain events after successful state transitions
 */
@Injectable()
export class BookmarkCommandService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(BOOKMARK_COLLECTION_REPOSITORY_PORT)
    private readonly collectionRepository: BookmarkCollectionRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{ quizId: string } | null>;
    },
    @Inject(BOOKMARK_DOMAIN_EVENT_BUS)
    private readonly eventBus: BookmarkDomainEventBusPort,
    @InjectPinoLogger(BookmarkCommandService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async getOwnedCollectionOrThrow(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionRow> {
    const collection = await this.collectionRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new BookmarkCollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    return collection;
  }

  async createCollection(user: JwtPayload, name: string, description: string | null | undefined) {
    const nowIso = new Date().toISOString();

    try {
      const collection = await this.collectionRepository.createCollection({
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
      const pgError = resolvePgError(error);
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
      const updated = await this.collectionRepository.updateCollection({
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
      const pgError = resolvePgError(error);
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_user_name') {
        this.logger.warn({ event: 'collection_update_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async deleteCollection(collectionId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    await this.collectionRepository.deleteCollection(collectionId);

    this.logger.info({
      event: 'collection_deleted',
      collectionId,
      userId: user.sub,
    });
  }

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
      throw new QuizNotFoundError();
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

      this.eventBus.emitBookmarkAdded(
        new BookmarkAddedEvent(bookmark.bookmarkId, collectionId, quizId, user.sub, nowIso),
      );

      return bookmark;
    } catch (error) {
      const pgError = resolvePgError(error);
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

  async addBookmarksBulk(userId: string, collectionId: string, quizIds: string[]): Promise<number> {
    const user = { sub: userId, role: 'user' } as JwtPayload;
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const uniqueQuizIds = [...new Set(quizIds)];
    if (uniqueQuizIds.length === 0) {
      return 0;
    }

    const nowIso = new Date().toISOString();
    let addedCount: number;

    try {
      addedCount = await this.bookmarkRepository.addBookmarksBulk({
        userId,
        collectionId,
        quizIds: uniqueQuizIds,
        nowIso,
      });
    } catch (error) {
      if (isPostgresForeignKeyViolation(error)) {
        this.logger.warn({
          event: 'bulk_add_bookmarks_collection_deleted',
          collectionId,
          userId,
          requestedCount: quizIds.length,
        });
        throw new BookmarkCollectionNotFoundError(
          'Collection was deleted while processing this request. Please retry.',
        );
      }
      throw error;
    }

    this.logger.info({
      event: 'bulk_bookmarks_added',
      collectionId,
      userId,
      requestedCount: quizIds.length,
      uniqueCount: uniqueQuizIds.length,
      addedCount,
    });

    return addedCount;
  }

  async removeBookmarksBulk(
    userId: string,
    collectionId: string,
    quizIds: string[],
  ): Promise<number> {
    const user = { sub: userId, role: 'user' } as JwtPayload;
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const uniqueQuizIds = [...new Set(quizIds)];
    if (uniqueQuizIds.length === 0) {
      return 0;
    }

    const removedCount = await this.bookmarkRepository.removeBookmarksBulk({
      userId,
      collectionId,
      quizIds: uniqueQuizIds,
    });

    this.logger.info({
      event: 'bulk_bookmarks_removed',
      collectionId,
      userId,
      requestedCount: quizIds.length,
      uniqueCount: uniqueQuizIds.length,
      removedCount,
    });

    return removedCount;
  }

  async removeBookmark(collectionId: string, quizId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const existing = await this.bookmarkRepository.getBookmarkedQuiz(collectionId, quizId);
    if (!existing) {
      throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
    }

    const nowIso = new Date().toISOString();

    await this.bookmarkRepository.removeBookmark(collectionId, quizId);

    this.logger.info({
      event: 'quiz_unbookmarked',
      collectionId,
      quizId,
      userId: user.sub,
    });

    this.eventBus.emitBookmarkRemoved(
      new BookmarkRemovedEvent(existing.bookmarkId, collectionId, quizId, user.sub, nowIso),
    );
  }

  async moveBookmark(
    userId: string,
    sourceCollectionId: string,
    targetCollectionId: string,
    quizId: string,
  ): Promise<void> {
    const sourceCollection = await this.collectionRepository.getCollectionById(sourceCollectionId);
    if (!sourceCollection) {
      throw new BookmarkCollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (sourceCollection.userId !== userId) {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    const targetCollection = await this.collectionRepository.getCollectionById(targetCollectionId);
    if (!targetCollection) {
      throw new BookmarkCollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (targetCollection.userId !== userId) {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    const existingTargetBookmark = await this.bookmarkRepository.getBookmarkedQuiz(
      targetCollectionId,
      quizId,
    );
    if (existingTargetBookmark) {
      throw new BookmarkConflictError(BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE);
    }

    const nowIso = new Date().toISOString();

    await this.bookmarkRepository.moveBookmark({
      userId,
      sourceCollectionId,
      targetCollectionId,
      quizId,
      nowIso,
      verifySource: true,
    });

    this.logger.info({
      event: 'bookmark_moved',
      userId,
      sourceCollectionId,
      targetCollectionId,
      quizId,
    });
  }

  async updateBookmark(
    collectionId: string,
    quizId: string,
    notes: string | null | undefined,
    user: JwtPayload,
  ) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const existing = await this.bookmarkRepository.getBookmarkedQuiz(collectionId, quizId);
    if (!existing) {
      throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    const updated = await this.bookmarkRepository.updateBookmark({
      collectionId,
      quizId,
      notes: notes ?? null,
      nowIso,
    });

    this.logger.info({
      event: 'bookmark_updated',
      collectionId,
      quizId,
      userId: user.sub,
    });

    return updated;
  }
}
