import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  quizzes,
  categories,
  categoryFollows,
  quizCategories,
  quizStats,
} from '@/core/database/schema';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { and, desc, eq, isNull, or, sql, asc, ne } from 'drizzle-orm';
import { CategorySlugConflictError } from '../../domain/errors';
import type {
  CategoryFollowRow,
  CategoryRepositoryPort,
  CategoryRow,
  CategoryRowWithDeleted,
  FollowedCategoryRow,
  RankedCategoryRow,
} from '../../domain/ports/category-repository.port';

const CATEGORY_COLUMNS = {
  categoryId: categories.categoryId,
  name: categories.name,
  description: categories.description,
  slug: categories.slug,
  imageUrl: categories.imageUrl,
  createdAt: categories.createdAt,
  updatedAt: categories.updatedAt,
};

const CATEGORY_COLUMNS_WITH_DELETED = {
  ...CATEGORY_COLUMNS,
  deletedAt: categories.deletedAt,
};

const FOLLOW_COLUMNS = {
  followId: categoryFollows.followId,
  userId: categoryFollows.userId,
  categoryId: categoryFollows.categoryId,
  createdAt: categoryFollows.createdAt,
};

@Injectable()
export class CategoryRepository implements CategoryRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(categoryId: string): Promise<CategoryRow | null> {
    const [row] = await this.db
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  async findByIdIncludingDeleted(categoryId: string): Promise<CategoryRowWithDeleted | null> {
    const [row] = await this.db
      .select(CATEGORY_COLUMNS_WITH_DELETED)
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
      .limit(1);

    return row ?? null;
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    const [row] = await this.db
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .where(and(eq(categories.slug, slug), isNull(categories.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  async findMany(params: {
    limit: number;
    cursor?: { createdAt: string; categoryId: string } | null;
  }): Promise<CategoryRow[]> {
    const { limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${categories.createdAt} < ${cursor.createdAt}`,
          and(
            eq(categories.createdAt, cursor.createdAt),
            sql`${categories.categoryId} < ${cursor.categoryId}`,
          ),
        )
      : undefined;

    const rows = await this.db
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .where(
        cursorCondition
          ? and(isNull(categories.deletedAt), cursorCondition)
          : isNull(categories.deletedAt),
      )
      .orderBy(desc(categories.createdAt), desc(categories.categoryId))
      .limit(limit + 1);

    return rows;
  }

  async findRelatedBySlug(params: { slug: string; limit: number }): Promise<CategoryRow[]> {
    const { slug, limit } = params;

    const sourceCategory = this.db.$with('source_category').as(
      this.db
        .select({ categoryId: categories.categoryId })
        .from(categories)
        .where(and(eq(categories.slug, slug), isNull(categories.deletedAt)))
        .limit(1),
    );

    const sourceQuizIds = this.db
      .$with('source_quiz_ids')
      .as(
        this.db
          .selectDistinct({ quizId: quizCategories.quizId })
          .from(quizCategories)
          .innerJoin(sourceCategory, eq(quizCategories.categoryId, sourceCategory.categoryId)),
      );

    const rows = await this.db
      .with(sourceCategory, sourceQuizIds)
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .innerJoin(quizCategories, eq(quizCategories.categoryId, categories.categoryId))
      .innerJoin(sourceQuizIds, eq(sourceQuizIds.quizId, quizCategories.quizId))
      .where(
        and(
          isNull(categories.deletedAt),
          ne(categories.slug, slug),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .innerJoin(quizzes, eq((quizzes as { quizId: AnyPgColumn }).quizId, quizCategories.quizId))
      .groupBy(
        categories.categoryId,
        categories.name,
        categories.description,
        categories.slug,
        categories.imageUrl,
        categories.createdAt,
        categories.updatedAt,
      )
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${quizCategories.quizId})`), asc(categories.name))
      .limit(limit);

    return rows;
  }

  async create(params: {
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    nowIso: string;
  }): Promise<CategoryRow> {
    try {
      const [row] = await this.db
        .insert(categories)
        .values({
          name: params.name,
          slug: params.slug,
          description: params.description,
          imageUrl: params.imageUrl,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning(CATEGORY_COLUMNS);

      return row;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code === '23505') {
        throw new CategorySlugConflictError();
      }
      throw error;
    }
  }

  async update(params: {
    categoryId: string;
    patch: {
      name?: string;
      description?: string | null;
      slug?: string;
      imageUrl?: string | null;
    };
    nowIso: string;
  }): Promise<CategoryRow | null> {
    try {
      const [row] = await this.db
        .update(categories)
        .set({ ...params.patch, updatedAt: params.nowIso })
        .where(and(eq(categories.categoryId, params.categoryId), isNull(categories.deletedAt)))
        .returning(CATEGORY_COLUMNS);

      return row ?? null;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code === '23505') {
        throw new CategorySlugConflictError();
      }
      throw error;
    }
  }

  async softDelete(categoryId: string, nowIso: string): Promise<boolean> {
    const [row] = await this.db
      .update(categories)
      .set({ deletedAt: nowIso, updatedAt: nowIso })
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .returning({ categoryId: categories.categoryId });

    return Boolean(row);
  }

  async restore(categoryId: string, nowIso: string): Promise<CategoryRow | null> {
    const [row] = await this.db
      .update(categories)
      .set({ deletedAt: null, updatedAt: nowIso })
      .where(and(eq(categories.categoryId, categoryId), sql`${categories.deletedAt} IS NOT NULL`))
      .returning(CATEGORY_COLUMNS);

    return row ?? null;
  }

  async followCategory(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<CategoryFollowRow> {
    const { userId, categoryId, nowIso } = params;

    const [upserted] = await this.db
      .insert(categoryFollows)
      .values({ userId, categoryId, createdAt: nowIso })
      .onConflictDoUpdate({
        target: [categoryFollows.userId, categoryFollows.categoryId],
        set: { deletedAt: sql`NULL`, createdAt: nowIso },
      })
      .returning(FOLLOW_COLUMNS);

    if (upserted) {
      return upserted;
    }

    const [row] = await this.db
      .select(FOLLOW_COLUMNS)
      .from(categoryFollows)
      .where(and(eq(categoryFollows.userId, userId), eq(categoryFollows.categoryId, categoryId)))
      .limit(1);

    return row;
  }

  async unfollowCategory(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<void> {
    const { userId, categoryId, nowIso } = params;

    await this.db
      .update(categoryFollows)
      .set({ deletedAt: nowIso })
      .where(
        and(
          eq(categoryFollows.userId, userId),
          eq(categoryFollows.categoryId, categoryId),
          isNull(categoryFollows.deletedAt),
        ),
      );
  }

  async listFollowedCategories(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedCategoryRow[]> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${categoryFollows.createdAt} < ${cursor.followedAt}`,
          and(
            eq(categoryFollows.createdAt, cursor.followedAt),
            sql`${categoryFollows.followId} < ${cursor.followId}`,
          ),
        )
      : undefined;

    const baseCondition = and(
      eq(categoryFollows.userId, userId),
      isNull(categoryFollows.deletedAt),
      isNull(categories.deletedAt),
    );

    const whereClause = cursorCondition ? and(baseCondition, cursorCondition) : baseCondition;

    const rows = await this.db
      .select({
        ...CATEGORY_COLUMNS,
        followId: categoryFollows.followId,
        followedAt: categoryFollows.createdAt,
      })
      .from(categoryFollows)
      .innerJoin(categories, eq(categoryFollows.categoryId, categories.categoryId))
      .where(whereClause)
      .orderBy(desc(categoryFollows.createdAt), desc(categoryFollows.followId))
      .limit(limit + 1);

    return rows;
  }

  async getPopularCategories(limit: number): Promise<RankedCategoryRow[]> {
    return this.getRankedCategories('popularity_score', limit);
  }

  async getTrendingCategories(limit: number): Promise<RankedCategoryRow[]> {
    return this.getRankedCategories('trending_score', limit);
  }

  private async getRankedCategories(
    scoreColumn: 'popularity_score' | 'trending_score',
    limit: number,
  ): Promise<RankedCategoryRow[]> {
    const scoreCol =
      scoreColumn === 'popularity_score' ? quizStats.popularityScore : quizStats.trendingScore;

    const rows = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        totalScore: sql<string>`SUM(${scoreCol})`,
        totalAttempts: sql<string>`SUM(${quizStats.totalAttempts})`,
      })
      .from(categories)
      .innerJoin(quizCategories, eq(quizCategories.categoryId, categories.categoryId))
      .innerJoin(
        quizzes,
        and(
          eq((quizzes as { quizId: AnyPgColumn }).quizId, quizCategories.quizId),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .innerJoin(quizStats, eq(quizStats.quizId, (quizzes as { quizId: AnyPgColumn }).quizId))
      .where(isNull(categories.deletedAt))
      .groupBy(
        categories.categoryId,
        categories.name,
        categories.description,
        categories.slug,
        categories.imageUrl,
        categories.createdAt,
        categories.updatedAt,
      )
      .orderBy(
        desc(sql`SUM(${scoreCol})`),
        desc(sql`SUM(${quizStats.totalAttempts})`),
        asc(categories.categoryId),
      )
      .limit(limit);

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }
}
