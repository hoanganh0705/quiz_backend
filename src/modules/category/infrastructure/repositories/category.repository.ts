import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { categories } from '@/core/database/schema';
import { CategorySlugConflictError } from '../../domain/errors';
import type { CategoryRepositoryPort } from '../../domain/ports/category-repository.port';
import type {
  CategoryRow,
  CategoryRowWithDeleted,
} from '../../domain/ports/category-repository.types';

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
}
