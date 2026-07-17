import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { categories, categoryFollows } from '@/core/database/schema';
import type { CategoryFollowRepositoryPort } from '../../domain/ports/category-follow-repository.port';
import type { FollowedCategoryRow } from '../../domain/ports/category-repository.types';

const CATEGORY_COLUMNS = {
  categoryId: categories.categoryId,
  name: categories.name,
  description: categories.description,
  slug: categories.slug,
  imageUrl: categories.imageUrl,
  createdAt: categories.createdAt,
  updatedAt: categories.updatedAt,
};

const FOLLOW_COLUMNS = {
  followId: categoryFollows.followId,
  userId: categoryFollows.userId,
  categoryId: categoryFollows.categoryId,
  createdAt: categoryFollows.createdAt,
};

@Injectable()
export class CategoryFollowRepository implements CategoryFollowRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async follow(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<{ followId: string; userId: string; categoryId: string; createdAt: string }> {
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

  async unfollow(params: { userId: string; categoryId: string; nowIso: string }): Promise<void> {
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
}
