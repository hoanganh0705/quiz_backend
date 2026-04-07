import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { categories } from '../../core/database/schema';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryListResponseDto } from './dto/response/category-list-response.dto';
import { CategoryResponseDto } from './dto/response/category-response.dto';
import { DeleteCategoryResponseDto } from './dto/response/delete-category-response.dto';

type CategoryPatch = {
  name?: string;
  description?: string | null;
  slug?: string;
  imageUrl?: string | null;
};

type CategoryCursorPayload = {
  createdAt: string;
  categoryId: string;
};

type ListCategoriesCursorQuery = {
  cursor?: string;
  limit?: number;
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

  private buildSlug(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeNullableText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private decodeCursor(cursor: string): CategoryCursorPayload {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<CategoryCursorPayload>;

      if (
        typeof parsed.createdAt !== 'string' ||
        Number.isNaN(Date.parse(parsed.createdAt)) ||
        typeof parsed.categoryId !== 'string' ||
        !this.categoryIdPattern.test(parsed.categoryId)
      ) {
        throw new Error('Invalid cursor payload');
      }

      return {
        createdAt: parsed.createdAt,
        categoryId: parsed.categoryId,
      };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private encodeCursor(category: Pick<CategoryResponseDto, 'createdAt' | 'categoryId'>): string {
    return Buffer.from(
      JSON.stringify({ createdAt: category.createdAt, categoryId: category.categoryId }),
      'utf8',
    ).toString('base64url');
  }

  private async getActiveCategoryById(categoryId: string): Promise<CategoryResponseDto> {
    const [category] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
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
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(
        cursorCondition
          ? and(isNull(categories.deletedAt), cursorCondition)
          : isNull(categories.deletedAt),
      )
      .orderBy(desc(categories.createdAt), desc(categories.categoryId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
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
    const normalizedSlug = slug.trim().toLowerCase();

    const [category] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(and(eq(categories.slug, normalizedSlug), isNull(categories.deletedAt)))
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createCategory(payload: CreateCategoryDto): Promise<CategoryResponseDto> {
    const name = payload.name.trim();
    const slug = (payload.slug?.trim().toLowerCase() ?? this.buildSlug(name)).trim();

    if (!slug) {
      throw new BadRequestException('Category slug cannot be empty');
    }

    const description = this.normalizeNullableText(payload.description);
    const imageUrl = this.normalizeNullableText(payload.imageUrl);

    const [duplicateCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
      })
      .from(categories)
      .where(
        and(
          isNull(categories.deletedAt),
          or(sql`lower(${categories.name}) = ${name.toLowerCase()}`, eq(categories.slug, slug)),
        ),
      )
      .limit(1);

    if (duplicateCategory) {
      throw new ConflictException('Category name or slug already exists');
    }

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
      .returning({
        categoryId: categories.categoryId,
        name: categories.name,
        description: categories.description,
        slug: categories.slug,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .catch((error: unknown) =>
        this.mapUniqueConflict(error, 'Category name or slug already exists'),
      );

    return createdCategory;
  }

  async updateCategoryById(
    categoryId: string,
    payload: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const existingCategory = await this.getActiveCategoryById(categoryId);

    const patch: CategoryPatch = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      patch.description = this.normalizeNullableText(payload.description);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = payload.slug.trim().toLowerCase();
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'imageUrl')) {
      patch.imageUrl = this.normalizeNullableText(payload.imageUrl);
    }

    if (Object.keys(patch).length === 0) {
      return existingCategory;
    }

    const nextName = patch.name ?? existingCategory.name;
    const nextSlug = patch.slug ?? existingCategory.slug;

    const [duplicateCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
      })
      .from(categories)
      .where(
        and(
          isNull(categories.deletedAt),
          ne(categories.categoryId, categoryId),
          or(
            sql`lower(${categories.name}) = ${nextName.toLowerCase()}`,
            eq(categories.slug, nextSlug),
          ),
        ),
      )
      .limit(1);

    if (duplicateCategory) {
      throw new ConflictException('Category name or slug already exists');
    }

    await this.db
      .update(categories)
      .set({
        ...patch,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(categories.categoryId, categoryId), isNull(categories.deletedAt)))
      .catch((error: unknown) =>
        this.mapUniqueConflict(error, 'Category name or slug already exists'),
      );

    return this.getActiveCategoryById(categoryId);
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
