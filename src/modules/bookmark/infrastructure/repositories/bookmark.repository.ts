import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { bookmarkCollections, bookmarkedQuizzes, quizzes } from '@/core/database/schema';
import type {
  BookmarkCollectionRow,
  BookmarkCollectionWithCountRow,
  BookmarkedQuizRow,
  BookmarkedQuizDetailRow,
  BookmarkRepositoryPort,
} from '@/modules/bookmark/domain/ports';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  title: AnyPgColumn;
  slug: AnyPgColumn;
  imageUrl: AnyPgColumn;
  isFeatured: AnyPgColumn;
  publishedVersionId: AnyPgColumn;
};

@Injectable()
export class BookmarkRepository implements BookmarkRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getCollectionById(collectionId: string): Promise<BookmarkCollectionRow | null> {
    const [row] = await this.db
      .select({
        collectionId: bookmarkCollections.collectionId,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
      })
      .from(bookmarkCollections)
      .where(eq(bookmarkCollections.collectionId, collectionId))
      .limit(1);

    return (row as BookmarkCollectionRow | undefined) ?? null;
  }

  async listCollectionsByUser(userId: string): Promise<BookmarkCollectionWithCountRow[]> {
    const rows = await this.db
      .select({
        collectionId: bookmarkCollections.collectionId,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
        quizCount: sql<number>`count(${bookmarkedQuizzes.bookmarkId})`.as('quiz_count'),
      })
      .from(bookmarkCollections)
      .leftJoin(
        bookmarkedQuizzes,
        eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
      )
      .where(eq(bookmarkCollections.userId, userId))
      .groupBy(bookmarkCollections.collectionId)
      .orderBy(bookmarkCollections.createdAt);

    return rows as BookmarkCollectionWithCountRow[];
  }

  async createCollection(params: {
    userId: string;
    name: string;
    description: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow> {
    const [created] = await this.db
      .insert(bookmarkCollections)
      .values({
        userId: params.userId,
        name: params.name,
        description: params.description,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        collectionId: bookmarkCollections.collectionId,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
      });

    return created as BookmarkCollectionRow;
  }

  async updateCollection(params: {
    collectionId: string;
    name?: string;
    description?: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow> {
    const setValues: Record<string, unknown> = { updatedAt: params.nowIso };

    if (params.name !== undefined) {
      setValues['name'] = params.name;
    }

    if (params.description !== undefined) {
      setValues['description'] = params.description;
    }

    const [updated] = await this.db
      .update(bookmarkCollections)
      .set(setValues)
      .where(eq(bookmarkCollections.collectionId, params.collectionId))
      .returning({
        collectionId: bookmarkCollections.collectionId,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
      });

    return updated as BookmarkCollectionRow;
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.db
      .delete(bookmarkCollections)
      .where(eq(bookmarkCollections.collectionId, collectionId));
  }

  async getBookmarkedQuiz(collectionId: string, quizId: string): Promise<BookmarkedQuizRow | null> {
    const [row] = await this.db
      .select({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
        collectionId: bookmarkedQuizzes.collectionId,
        quizId: bookmarkedQuizzes.quizId,
        notes: bookmarkedQuizzes.notes,
        bookmarkedAt: bookmarkedQuizzes.bookmarkedAt,
        updatedAt: bookmarkedQuizzes.updatedAt,
      })
      .from(bookmarkedQuizzes)
      .where(
        and(eq(bookmarkedQuizzes.collectionId, collectionId), eq(bookmarkedQuizzes.quizId, quizId)),
      )
      .limit(1);

    return (row as BookmarkedQuizRow | undefined) ?? null;
  }

  async listBookmarksInCollection(collectionId: string): Promise<BookmarkedQuizDetailRow[]> {
    const rows = await this.db
      .select({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
        collectionId: bookmarkedQuizzes.collectionId,
        quizId: bookmarkedQuizzes.quizId,
        notes: bookmarkedQuizzes.notes,
        bookmarkedAt: bookmarkedQuizzes.bookmarkedAt,
        updatedAt: bookmarkedQuizzes.updatedAt,
        quizTitle: QUIZ_COLUMNS.title,
        quizSlug: QUIZ_COLUMNS.slug,
        quizImageUrl: QUIZ_COLUMNS.imageUrl,
        quizIsFeatured: QUIZ_COLUMNS.isFeatured,
        quizPublishedVersionId: QUIZ_COLUMNS.publishedVersionId,
        quizDifficulty: sql<string | null>`NULL`.as('quiz_difficulty'),
      })
      .from(bookmarkedQuizzes)
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, QUIZ_COLUMNS.quizId))
      .where(eq(bookmarkedQuizzes.collectionId, collectionId))
      .orderBy(bookmarkedQuizzes.bookmarkedAt);

    return rows as BookmarkedQuizDetailRow[];
  }

  async addQuizToCollection(params: {
    collectionId: string;
    quizId: string;
    notes: string | null;
    nowIso: string;
  }): Promise<BookmarkedQuizRow> {
    const [created] = await this.db
      .insert(bookmarkedQuizzes)
      .values({
        collectionId: params.collectionId,
        quizId: params.quizId,
        notes: params.notes,
        bookmarkedAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
        collectionId: bookmarkedQuizzes.collectionId,
        quizId: bookmarkedQuizzes.quizId,
        notes: bookmarkedQuizzes.notes,
        bookmarkedAt: bookmarkedQuizzes.bookmarkedAt,
        updatedAt: bookmarkedQuizzes.updatedAt,
      });

    return created as BookmarkedQuizRow;
  }

  async removeBookmark(collectionId: string, quizId: string): Promise<void> {
    await this.db
      .delete(bookmarkedQuizzes)
      .where(
        and(eq(bookmarkedQuizzes.collectionId, collectionId), eq(bookmarkedQuizzes.quizId, quizId)),
      );
  }

  async checkCollectionOwnership(
    collectionId: string,
    userId: string,
  ): Promise<BookmarkCollectionRow | null> {
    const [row] = await this.db
      .select({
        collectionId: bookmarkCollections.collectionId,
        userId: bookmarkCollections.userId,
        name: bookmarkCollections.name,
        description: bookmarkCollections.description,
        createdAt: bookmarkCollections.createdAt,
        updatedAt: bookmarkCollections.updatedAt,
      })
      .from(bookmarkCollections)
      .where(
        and(
          eq(bookmarkCollections.collectionId, collectionId),
          eq(bookmarkCollections.userId, userId),
        ),
      )
      .limit(1);

    return (row as BookmarkCollectionRow | undefined) ?? null;
  }
}
