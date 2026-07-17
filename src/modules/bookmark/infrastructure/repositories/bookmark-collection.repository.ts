import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { bookmarkCollections, bookmarkedQuizzes } from '@/core/database/schema';
import type {
  BookmarkCollectionRow,
  BookmarkCollectionWithCountRow,
  BookmarkCollectionRepositoryPort,
} from '../../domain/ports/bookmark-collection-repository.port';

@Injectable()
export class BookmarkCollectionRepository implements BookmarkCollectionRepositoryPort {
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
    await this.db.transaction(async (tx) => {
      await tx.delete(bookmarkedQuizzes).where(eq(bookmarkedQuizzes.collectionId, collectionId));

      await tx
        .delete(bookmarkCollections)
        .where(eq(bookmarkCollections.collectionId, collectionId));
    });
  }
}
