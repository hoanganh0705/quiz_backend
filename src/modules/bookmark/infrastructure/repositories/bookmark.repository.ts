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
  BulkBookmarkMutationRow,
} from '@/modules/bookmark/domain/ports';
import type { BookmarkCollectionAnalytics } from '@/modules/bookmark/domain/types/bookmark-collection-analytics';
import { BookmarkNotFoundError } from '@/modules/bookmark/domain/errors';
import { BOOKMARK_NOT_FOUND_MESSAGE } from '@/modules/bookmark/bookmark.constants';
import {
  buildBookmarkCursorCondition,
  buildSafeSearchPattern,
} from '@/modules/bookmark/domain/bookmark-cursor-pagination';

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
      .orderBy(bookmarkCollections.name)
      .limit(100);

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
    const cursorCondition = buildBookmarkCursorCondition(params.cursor);
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
    const cursorCondition = buildBookmarkCursorCondition(params.cursor);

    const searchPattern = buildSafeSearchPattern(params.query);
    const searchCondition = sql`(
      ${quizzes.title} ILIKE ${searchPattern} ESCAPE '\\'
      OR ${quizzes.slug} ILIKE ${searchPattern} ESCAPE '\\'
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
  }): Promise<BulkBookmarkMutationRow[]> {
    if (params.quizIds.length === 0) {
      return [];
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
        quizId: bookmarkedQuizzes.quizId,
      });

    return insertedRows;
  }

  async removeBookmarksBulk(params: {
    userId: string;
    collectionId: string;
    quizIds: string[];
  }): Promise<BulkBookmarkMutationRow[]> {
    if (params.quizIds.length === 0) {
      return [];
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
        quizId: bookmarkedQuizzes.quizId,
      });

    return deletedRows;
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
          throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
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
      this.db.execute<{
        category_id: string;
        name: string;
        slug: string;
        bookmark_count: number | string;
      }>(sql`
        SELECT category_id, name, slug, bookmark_count
        FROM (
          SELECT
            ${categories.categoryId} AS category_id,
            ${categories.name} AS name,
            ${categories.slug} AS slug,
            COUNT(${bookmarkedQuizzes.bookmarkId})::int AS bookmark_count
          FROM ${bookmarkedQuizzes}
          INNER JOIN ${bookmarkCollections}
            ON ${bookmarkedQuizzes.collectionId} = ${bookmarkCollections.collectionId}
          INNER JOIN ${quizzes}
            ON ${bookmarkedQuizzes.quizId} = ${quizzes.quizId}
          INNER JOIN ${categories}
            ON ${quizzes.categoryId} = ${categories.categoryId}
          WHERE ${bookmarkCollections.collectionId} = ${collectionId}::uuid
            AND ${quizzes.deletedAt} IS NULL
            AND ${categories.deletedAt} IS NULL
          GROUP BY ${categories.categoryId}, ${categories.name}, ${categories.slug}
        ) ranked
        ORDER BY bookmark_count DESC, name ASC
        LIMIT 20
      `),
      this.db.execute<{
        tag_id: string;
        name: string;
        slug: string;
        bookmark_count: number | string;
      }>(sql`
        SELECT tag_id, name, slug, bookmark_count
        FROM (
          SELECT
            ${tags.tagId} AS tag_id,
            ${tags.name} AS name,
            ${tags.slug} AS slug,
            COUNT(${bookmarkedQuizzes.bookmarkId})::int AS bookmark_count
          FROM ${bookmarkedQuizzes}
          INNER JOIN ${bookmarkCollections}
            ON ${bookmarkedQuizzes.collectionId} = ${bookmarkCollections.collectionId}
          INNER JOIN ${quizzes}
            ON ${bookmarkedQuizzes.quizId} = ${quizzes.quizId}
          INNER JOIN ${quizTags}
            ON ${quizzes.quizId} = ${quizTags.quizId}
          INNER JOIN ${tags}
            ON ${quizTags.tagId} = ${tags.tagId}
          WHERE ${bookmarkCollections.collectionId} = ${collectionId}::uuid
            AND ${quizzes.deletedAt} IS NULL
            AND ${tags.deletedAt} IS NULL
          GROUP BY ${tags.tagId}, ${tags.name}, ${tags.slug}
        ) ranked
        ORDER BY bookmark_count DESC, name ASC
        LIMIT 20
      `),
    ]);

    type TopCategoryRow = {
      category_id: string;
      name: string;
      slug: string;
      bookmark_count: number | string;
    };
    type TopTagRow = {
      tag_id: string;
      name: string;
      slug: string;
      bookmark_count: number | string;
    };
    type SummaryRow = {
      totalBookmarks: number | null;
      totalQuizzes: number | null;
      averageQuizRating: number | null;
      uniqueCategories: number | null;
      uniqueTags: number | null;
    };
    const topCategoryRows = (topCategories as unknown as { rows: TopCategoryRow[] }).rows ?? [];
    const topTagRows = (topTags as unknown as { rows: TopTagRow[] }).rows ?? [];
    const summaryRow = (summary as SummaryRow[])[0];

    return {
      collectionId: collection.collectionId,
      collectionName: collection.collectionName,
      summary: {
        totalBookmarks: Number(summaryRow?.totalBookmarks ?? 0),
        totalQuizzes: Number(summaryRow?.totalQuizzes ?? 0),
        averageQuizRating: Number(summaryRow?.averageQuizRating ?? 0),
        uniqueCategories: Number(summaryRow?.uniqueCategories ?? 0),
        uniqueTags: Number(summaryRow?.uniqueTags ?? 0),
      },
      topCategories: topCategoryRows.map((category) => ({
        categoryId: category.category_id,
        name: category.name,
        slug: category.slug,
        bookmarkCount: Number(category.bookmark_count),
      })),
      topTags: topTagRows.map((tag) => ({
        tagId: tag.tag_id,
        name: tag.name,
        slug: tag.slug,
        bookmarkCount: Number(tag.bookmark_count),
      })),
      lastUpdated: collection.updatedAt,
    };
  }

  async getUserBookmarkStats(userId: string): Promise<UserBookmarkStatsRow> {
    const [summary, favoriteCategory, favoriteTag] = await Promise.all([
      this.db
        .select({
          totalCollections: sql<number>`COUNT(DISTINCT ${bookmarkCollections.collectionId})::int`,
          totalBookmarks: count(bookmarkedQuizzes.bookmarkId),
        })
        .from(bookmarkCollections)
        .leftJoin(
          bookmarkedQuizzes,
          eq(bookmarkCollections.collectionId, bookmarkedQuizzes.collectionId),
        )
        .where(eq(bookmarkCollections.userId, userId)),
      this.db
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
        .limit(1),
      this.db
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
        .limit(1),
    ]);

    const summaryRow = summary[0];
    const categoryRow = favoriteCategory[0];
    const tagRow = favoriteTag[0];

    return {
      totalCollections: Number(summaryRow?.totalCollections ?? 0),
      totalBookmarks: Number(summaryRow?.totalBookmarks ?? 0),
      favoriteCategory: categoryRow
        ? {
            categoryId: categoryRow.categoryId,
            name: categoryRow.name,
            slug: categoryRow.slug,
          }
        : null,
      favoriteTag: tagRow
        ? {
            tagId: tagRow.tagId,
            name: tagRow.name,
            slug: tagRow.slug,
          }
        : null,
    };
  }
}
