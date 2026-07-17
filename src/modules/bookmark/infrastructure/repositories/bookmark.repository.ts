import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  bookmarkCollections,
  bookmarkedQuizzes,
  categories,
  quizzes,
  quizReviews,
  quizTags,
  tags,
} from '@/core/database/schema';
import type {
  BookmarkedQuizRow,
  BookmarkedQuizDetailRow,
  BookmarkRepositoryPort,
  UserBookmarkStatsRow,
  BookmarkStatusRow,
  SearchBookmarkRow,
  RecentBookmarkRow,
} from '@/modules/bookmark/domain/ports';
import type { BookmarkCollectionAnalytics } from '@/modules/bookmark/domain/types/bookmark-collection-analytics';

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
      })
      .from(bookmarkedQuizzes)
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, QUIZ_COLUMNS.quizId))
      .where(and(eq(bookmarkedQuizzes.collectionId, collectionId), isNull(quizzes.deletedAt)))
      .orderBy(bookmarkedQuizzes.bookmarkedAt);

    return rows as BookmarkedQuizDetailRow[];
  }

  async getBookmarkStatus(userId: string, quizId: string): Promise<BookmarkStatusRow> {
    const collections = await this.db
      .select({
        collectionId: bookmarkCollections.collectionId,
        name: bookmarkCollections.name,
      })
      .from(bookmarkCollections)
      .innerJoin(
        bookmarkedQuizzes,
        eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
      )
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
      .where(
        and(
          eq(bookmarkCollections.userId, userId),
          eq(bookmarkedQuizzes.quizId, quizId),
          isNull(quizzes.deletedAt),
        ),
      )
      .orderBy(bookmarkCollections.name);

    return {
      bookmarked: collections.length > 0,
      collections,
    };
  }

  async listRecentBookmarks(params: {
    userId: string;
    limit: number;
    cursor?: { bookmarkedAt: string; bookmarkId: string } | null;
  }): Promise<RecentBookmarkRow[]> {
    const cursorCondition = params.cursor
      ? and(
          sql`${bookmarkedQuizzes.bookmarkedAt} <= ${params.cursor.bookmarkedAt}`,
          sql`(
            ${bookmarkedQuizzes.bookmarkedAt} < ${params.cursor.bookmarkedAt}
            OR (
              ${bookmarkedQuizzes.bookmarkedAt} = ${params.cursor.bookmarkedAt}
              AND ${bookmarkedQuizzes.bookmarkId} < ${params.cursor.bookmarkId}
            )
          )`,
        )
      : undefined;

    const baseCondition = eq(bookmarkCollections.userId, params.userId);
    const whereClause = cursorCondition ? and(baseCondition, cursorCondition) : baseCondition;

    const rows = await this.db
      .select({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
        quizId: bookmarkedQuizzes.quizId,
        title: quizzes.title,
        slug: quizzes.slug,
        imageUrl: quizzes.imageUrl,
        collectionId: bookmarkCollections.collectionId,
        collectionName: bookmarkCollections.name,
        bookmarkedAt: bookmarkedQuizzes.bookmarkedAt,
      })
      .from(bookmarkedQuizzes)
      .innerJoin(
        bookmarkCollections,
        eq(bookmarkedQuizzes.collectionId, bookmarkCollections.collectionId),
      )
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
      .where(and(whereClause, isNull(quizzes.deletedAt)))
      .orderBy(desc(bookmarkedQuizzes.bookmarkedAt), desc(bookmarkedQuizzes.bookmarkId))
      .limit(params.limit + 1);

    return rows;
  }

  async searchBookmarks(params: {
    userId: string;
    query: string;
    limit: number;
    cursor?: { bookmarkedAt: string; bookmarkId: string } | null;
  }): Promise<SearchBookmarkRow[]> {
    const cursorCondition = params.cursor
      ? and(
          sql`${bookmarkedQuizzes.bookmarkedAt} <= ${params.cursor.bookmarkedAt}`,
          sql`(
            ${bookmarkedQuizzes.bookmarkedAt} < ${params.cursor.bookmarkedAt}
            OR (
              ${bookmarkedQuizzes.bookmarkedAt} = ${params.cursor.bookmarkedAt}
              AND ${bookmarkedQuizzes.bookmarkId} < ${params.cursor.bookmarkId}
            )
          )`,
        )
      : undefined;

    const searchPattern = `%${params.query}%`;
    const searchCondition = sql`(
      ${quizzes.title} ILIKE ${searchPattern}
      OR ${quizzes.slug} ILIKE ${searchPattern}
    )`;
    const ownershipCondition = eq(bookmarkCollections.userId, params.userId);

    const whereClause = cursorCondition
      ? and(ownershipCondition, searchCondition, cursorCondition)
      : and(ownershipCondition, searchCondition);

    const rows = await this.db
      .select({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
        quizId: bookmarkedQuizzes.quizId,
        title: quizzes.title,
        slug: quizzes.slug,
        imageUrl: quizzes.imageUrl,
        collectionId: bookmarkCollections.collectionId,
        collectionName: bookmarkCollections.name,
        bookmarkedAt: bookmarkedQuizzes.bookmarkedAt,
      })
      .from(bookmarkedQuizzes)
      .innerJoin(
        bookmarkCollections,
        eq(bookmarkedQuizzes.collectionId, bookmarkCollections.collectionId),
      )
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
      .where(and(whereClause, isNull(quizzes.deletedAt)))
      .orderBy(desc(bookmarkedQuizzes.bookmarkedAt), desc(bookmarkedQuizzes.bookmarkId))
      .limit(params.limit + 1);

    return rows;
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

  async addBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
    nowIso: string;
  }): Promise<number> {
    if (params.quizIds.length === 0) {
      return 0;
    }

    const insertedRows = await this.db
      .insert(bookmarkedQuizzes)
      .values(
        params.quizIds.map((quizId) => ({
          collectionId: params.collectionId,
          quizId,
          bookmarkedAt: params.nowIso,
          updatedAt: params.nowIso,
        })),
      )
      .onConflictDoNothing({
        target: [bookmarkedQuizzes.collectionId, bookmarkedQuizzes.quizId],
      })
      .returning({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
      });

    return insertedRows.length;
  }

  async removeBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
  }): Promise<number> {
    if (params.quizIds.length === 0) {
      return 0;
    }

    const deletedRows = await this.db
      .delete(bookmarkedQuizzes)
      .where(
        and(
          eq(bookmarkedQuizzes.collectionId, params.collectionId),
          inArray(bookmarkedQuizzes.quizId, params.quizIds),
        ),
      )
      .returning({
        bookmarkId: bookmarkedQuizzes.bookmarkId,
      });

    return deletedRows.length;
  }

  async moveBookmark(params: {
    userId: string;
    sourceCollectionId: string;
    targetCollectionId: string;
    quizId: string;
    nowIso: string;
    verifySource?: boolean;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (params.verifySource) {
        const [existing] = await tx
          .select({ bookmarkId: bookmarkedQuizzes.bookmarkId })
          .from(bookmarkedQuizzes)
          .where(
            and(
              eq(bookmarkedQuizzes.collectionId, params.sourceCollectionId),
              eq(bookmarkedQuizzes.quizId, params.quizId),
            ),
          )
          .limit(1);

        if (!existing) {
          throw new Error('Bookmark not found in source collection');
        }
      }

      await tx
        .delete(bookmarkedQuizzes)
        .where(
          and(
            eq(bookmarkedQuizzes.collectionId, params.sourceCollectionId),
            eq(bookmarkedQuizzes.quizId, params.quizId),
          ),
        );

      await tx.insert(bookmarkedQuizzes).values({
        collectionId: params.targetCollectionId,
        quizId: params.quizId,
        bookmarkedAt: params.nowIso,
        updatedAt: params.nowIso,
      });
    });
  }

  async removeBookmark(collectionId: string, quizId: string): Promise<void> {
    await this.db
      .delete(bookmarkedQuizzes)
      .where(
        and(eq(bookmarkedQuizzes.collectionId, collectionId), eq(bookmarkedQuizzes.quizId, quizId)),
      );
  }

  async updateBookmark(params: {
    collectionId: string;
    quizId: string;
    notes: string | null;
    nowIso: string;
  }): Promise<BookmarkedQuizRow> {
    const [updated] = await this.db
      .update(bookmarkedQuizzes)
      .set({ notes: params.notes, updatedAt: params.nowIso })
      .where(
        and(
          eq(bookmarkedQuizzes.collectionId, params.collectionId),
          eq(bookmarkedQuizzes.quizId, params.quizId),
        ),
      )
      .returning();

    return updated as BookmarkedQuizRow;
  }

  async getCollectionAnalytics(collectionId: string): Promise<BookmarkCollectionAnalytics | null> {
    const [collection] = await this.db
      .select({
        collectionId: bookmarkCollections.collectionId,
        collectionName: bookmarkCollections.name,
        updatedAt: bookmarkCollections.updatedAt,
      })
      .from(bookmarkCollections)
      .where(eq(bookmarkCollections.collectionId, collectionId))
      .limit(1);

    if (!collection) {
      return null;
    }

    const [summary, topCategories, topTags] = await Promise.all([
      this.db
        .select({
          totalBookmarks: sql<number>`COUNT(${bookmarkedQuizzes.bookmarkId})::int`,
          totalQuizzes: sql<number>`COUNT(DISTINCT ${bookmarkedQuizzes.quizId})::int`,
          averageQuizRating: sql<number>`ROUND(COALESCE(AVG(${quizReviews.rating}::numeric), 0), 2)`,
          uniqueCategories: sql<number>`COUNT(DISTINCT ${quizzes.categoryId})::int`,
          uniqueTags: sql<number>`COUNT(DISTINCT ${quizTags.tagId})::int`,
        })
        .from(bookmarkCollections)
        .leftJoin(
          bookmarkedQuizzes,
          eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
        )
        .leftJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
        .leftJoin(quizReviews, eq(quizzes.quizId, quizReviews.quizId))
        .leftJoin(quizTags, eq(quizzes.quizId, quizTags.quizId))
        .where(and(eq(bookmarkCollections.collectionId, collectionId), isNull(quizzes.deletedAt))),
      this.db
        .select({
          categoryId: categories.categoryId,
          name: categories.name,
          slug: categories.slug,
          bookmarkCount: sql<number>`COUNT(${bookmarkedQuizzes.bookmarkId})::int`,
        })
        .from(bookmarkedQuizzes)
        .innerJoin(
          bookmarkCollections,
          eq(bookmarkedQuizzes.collectionId, bookmarkCollections.collectionId),
        )
        .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
        .innerJoin(categories, eq(quizzes.categoryId, categories.categoryId))
        .where(
          and(
            eq(bookmarkCollections.collectionId, collectionId),
            isNull(quizzes.deletedAt),
            isNull(categories.deletedAt),
          ),
        )
        .groupBy(categories.categoryId, categories.name, categories.slug)
        .orderBy(desc(sql`COUNT(${bookmarkedQuizzes.bookmarkId})`), categories.name),
      this.db
        .select({
          tagId: tags.tagId,
          name: tags.name,
          slug: tags.slug,
          bookmarkCount: sql<number>`COUNT(${bookmarkedQuizzes.bookmarkId})::int`,
        })
        .from(bookmarkedQuizzes)
        .innerJoin(
          bookmarkCollections,
          eq(bookmarkedQuizzes.collectionId, bookmarkCollections.collectionId),
        )
        .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
        .innerJoin(quizTags, eq(quizzes.quizId, quizTags.quizId))
        .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
        .where(
          and(
            eq(bookmarkCollections.collectionId, collectionId),
            isNull(quizzes.deletedAt),
            isNull(tags.deletedAt),
          ),
        )
        .groupBy(tags.tagId, tags.name, tags.slug)
        .orderBy(desc(sql`COUNT(${bookmarkedQuizzes.bookmarkId})`), tags.name),
    ]);

    return {
      collectionId: collection.collectionId,
      collectionName: collection.collectionName,
      summary: {
        totalBookmarks: Number(summary[0]?.totalBookmarks ?? 0),
        totalQuizzes: Number(summary[0]?.totalQuizzes ?? 0),
        averageQuizRating: Number(summary[0]?.averageQuizRating ?? 0),
        uniqueCategories: Number(summary[0]?.uniqueCategories ?? 0),
        uniqueTags: Number(summary[0]?.uniqueTags ?? 0),
      },
      topCategories: topCategories.map((category) => ({
        categoryId: category.categoryId,
        name: category.name,
        slug: category.slug,
        bookmarkCount: Number(category.bookmarkCount),
      })),
      topTags: topTags.map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
        slug: tag.slug,
        bookmarkCount: Number(tag.bookmarkCount),
      })),
      lastUpdated: collection.updatedAt,
    };
  }

  async getUserBookmarkStats(userId: string): Promise<UserBookmarkStatsRow> {
    const [summary] = await this.db
      .select({
        totalCollections: sql<number>`COUNT(DISTINCT ${bookmarkCollections.collectionId})::int`,
        totalBookmarks: count(bookmarkedQuizzes.bookmarkId),
      })
      .from(bookmarkCollections)
      .leftJoin(
        bookmarkedQuizzes,
        eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
      )
      .where(eq(bookmarkCollections.userId, userId));

    const [favoriteCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        slug: categories.slug,
      })
      .from(bookmarkCollections)
      .innerJoin(
        bookmarkedQuizzes,
        eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
      )
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
      .innerJoin(categories, eq(quizzes.categoryId, categories.categoryId))
      .where(
        and(
          eq(bookmarkCollections.userId, userId),
          isNull(quizzes.deletedAt),
          isNull(categories.deletedAt),
        ),
      )
      .groupBy(categories.categoryId, categories.name, categories.slug)
      .orderBy(desc(count()), categories.name)
      .limit(1);

    const [favoriteTag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        slug: tags.slug,
      })
      .from(bookmarkCollections)
      .innerJoin(
        bookmarkedQuizzes,
        eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
      )
      .innerJoin(quizzes, eq(bookmarkedQuizzes.quizId, quizzes.quizId))
      .innerJoin(quizTags, eq(quizzes.quizId, quizTags.quizId))
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .where(
        and(
          eq(bookmarkCollections.userId, userId),
          isNull(quizzes.deletedAt),
          isNull(tags.deletedAt),
        ),
      )
      .groupBy(tags.tagId, tags.name, tags.slug)
      .orderBy(desc(count()), tags.name)
      .limit(1);

    return {
      totalCollections: Number(summary?.totalCollections ?? 0),
      totalBookmarks: Number(summary?.totalBookmarks ?? 0),
      favoriteCategory: favoriteCategory
        ? {
            categoryId: favoriteCategory.categoryId,
            name: favoriteCategory.name,
            slug: favoriteCategory.slug,
          }
        : null,
      favoriteTag: favoriteTag
        ? {
            tagId: favoriteTag.tagId,
            name: favoriteTag.name,
            slug: favoriteTag.slug,
          }
        : null,
    };
  }
}
