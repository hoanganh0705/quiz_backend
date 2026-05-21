import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BOOKMARK_REPOSITORY_PORT,
  type BookmarkRepositoryPort,
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

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{ quizId: string } | null>;
    },
    @InjectPinoLogger(BookmarkService.name)
    private readonly logger: PinoLogger,
  ) {}

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
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_pair') {
        this.logger.warn({ event: 'collection_create_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async addBookmark(
    collectionId: string,
    quizId: string,
    notes: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new CollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

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

      return bookmark;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_quizzes_pair') {
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
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new CollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

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
  }

  async listBookmarksInCollection(collectionId: string, user: JwtPayload) {
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new CollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    return this.bookmarkRepository.listBookmarksInCollection(collectionId);
  }
}
