import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizzes, categories, quizStats } from '@/core/database/schema';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { CategoryRankingRepositoryPort } from '../../domain/ports/category-ranking-repository.port';
import type { CategoryRow, RankedCategoryRow } from '../../domain/ports/category-repository.types';

const CATEGORY_COLUMNS = {
  categoryId: categories.categoryId,
  name: categories.name,
  description: categories.description,
  slug: categories.slug,
  imageUrl: categories.imageUrl,
  createdAt: categories.createdAt,
  updatedAt: categories.updatedAt,
};

@Injectable()
export class CategoryRankingRepository implements CategoryRankingRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
          .selectDistinct({ quizId: quizzes.quizId })
          .from(quizzes)
          .innerJoin(sourceCategory, eq(quizzes.categoryId, sourceCategory.categoryId)),
      );

    const rows = await this.db
      .with(sourceCategory, sourceQuizIds)
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .innerJoin(quizzes, eq(quizzes.categoryId, categories.categoryId))
      .innerJoin(sourceQuizIds, eq(sourceQuizIds.quizId, quizzes.quizId))
      .where(
        and(
          isNull(categories.deletedAt),
          ne(categories.slug, slug),
          isNull((quizzes as { deletedAt: AnyPgColumn }).deletedAt),
          eq((quizzes as { isHidden: AnyPgColumn }).isHidden, false),
        ),
      )
      .groupBy(
        categories.categoryId,
        categories.name,
        categories.description,
        categories.slug,
        categories.imageUrl,
        categories.createdAt,
        categories.updatedAt,
      )
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${quizzes.quizId})`), asc(categories.name))
      .limit(limit);

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
      .innerJoin(
        quizzes,
        and(
          eq(quizzes.categoryId, categories.categoryId),
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
