import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '@/core/database/database.module';
import { categories } from '@/core/database/schema';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryListResponseDto } from './dto/response/category-list-response.dto';
import { CategoryResponseDto } from './dto/response/category-response.dto';
import { DeleteCategoryResponseDto } from './dto/response/delete-category-response.dto';
import {
  CategoryCursorPayload,
  CategoryPatch,
  ListCategoriesCursorQuery,
} from './types/category.types';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { normalizeNullableText } from '@/common/utils/text.util';
import { hasOwn } from '@/common/utils/object.util';
import {
  CATEGORY_SLUG_EMPTY_MESSAGE,
  CATEGORY_SLUG_INVALID_MESSAGE,
  CATEGORY_UNIQUE_CONFLICT_MESSAGE,
} from './category.constants';

type CategoryRow = {
  categoryId: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

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
export class CategoryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly categoryIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private mapUniqueConflict(error: unknown, fallbackMessage: string): never {
    const maybePgError = error as { code?: string };

    if (maybePgError.code === '23505') {
      throw new ConflictException(fallbackMessage);
    }

    throw new InternalServerErrorException('Category operation failed');
  }

  private decodeCursor(cursor: string): CategoryCursorPayload {
    const parsed = decodeBase64JsonCursor<CategoryCursorPayload>(cursor);

    if (
      !isIsoDateString(parsed.createdAt) ||
      !isStringMatchingPattern(parsed.categoryId, this.categoryIdPattern)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      categoryId: parsed.categoryId,
    };
  }

  private encodeCursor(category: Pick<CategoryRow, 'createdAt' | 'categoryId'>): string {
    return encodeBase64JsonCursor({
      createdAt: category.createdAt,
      categoryId: category.categoryId,
    });
  }

  private toCategoryResponse(category: CategoryRow): CategoryResponseDto {
    return {
      categoryId: category.categoryId,
      name: category.name,
      description: category.description,
      slug: category.slug,
      imageUrl: category.imageUrl,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private normalizeCategorySlug(slug: string): string {
    return normalizeSlugOrThrow(slug, {
      emptyMessage: CATEGORY_SLUG_EMPTY_MESSAGE,
      invalidMessage: CATEGORY_SLUG_INVALID_MESSAGE,
    });
  }

  private async getActiveCategoryById(categoryId: string): Promise<CategoryRow> {
    const [category] = await this.db
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category as CategoryRow;
  }

  async listActiveCategories(query: ListCategoriesCursorQuery): Promise<CategoryListResponseDto> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeCursor(cursorValue) : null;

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

    const hasNextPage = rows.length > limit;
    const itemRows = hasNextPage ? rows.slice(0, limit) : rows;
    const items = itemRows.map((row) => this.toCategoryResponse(row as CategoryRow));
    const lastItem = items.at(-1);
    const nextCursor = hasNextPage && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items,
      pagination: {
        limit,
        nextCursor,
        hasNextPage,
      },
    };
  }

  async getActiveCategoryBySlug(slug: string): Promise<CategoryResponseDto> {
    const normalizedSlug = this.normalizeCategorySlug(slug);

    const [category] = await this.db
      .select(CATEGORY_COLUMNS)
      .from(categories)
      .where(and(eq(categories.slug, normalizedSlug), isNull(categories.deletedAt)))
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.toCategoryResponse(category as CategoryRow);
  }

  async createCategory(payload: CreateCategoryDto): Promise<CategoryResponseDto> {
    const name = payload.name.trim();
    const slug = this.normalizeCategorySlug(payload.slug ?? buildSlug(name));

    const description = normalizeNullableText(payload.description);
    const imageUrl = normalizeNullableText(payload.imageUrl);

    const nowIso = new Date().toISOString();

    const [createdCategory] = await this.db
      .insert(categories)
      .values({
        name,
        slug,
        description,
        imageUrl,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning(CATEGORY_COLUMNS)
      .catch((error: unknown) => this.mapUniqueConflict(error, CATEGORY_UNIQUE_CONFLICT_MESSAGE));

    return this.toCategoryResponse(createdCategory as CategoryRow);
  }

  async updateCategoryById(
    categoryId: string,
    payload: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const patch: CategoryPatch = {};

    if (hasOwn(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (hasOwn(payload, 'description')) {
      patch.description = normalizeNullableText(payload.description);
    }

    if (hasOwn(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = this.normalizeCategorySlug(payload.slug);
    }

    if (hasOwn(payload, 'imageUrl')) {
      patch.imageUrl = normalizeNullableText(payload.imageUrl);
    }

    if (Object.keys(patch).length === 0) {
      const category = await this.getActiveCategoryById(categoryId);
      return this.toCategoryResponse(category);
    }

    const [updatedCategory] = await this.db
      .update(categories)
      .set({
        ...patch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .returning(CATEGORY_COLUMNS)
      .catch((error: unknown) => this.mapUniqueConflict(error, CATEGORY_UNIQUE_CONFLICT_MESSAGE));

    if (!updatedCategory) {
      throw new NotFoundException('Category not found');
    }

    return this.toCategoryResponse(updatedCategory as CategoryRow);
  }

  async softDeleteCategoryById(categoryId: string): Promise<DeleteCategoryResponseDto> {
    await this.getActiveCategoryById(categoryId);

    const nowIso = new Date().toISOString();

    await this.db
      .update(categories)
      .set({
        deletedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)));

    return {
      message: 'Category deleted successfully',
    };
  }
}
