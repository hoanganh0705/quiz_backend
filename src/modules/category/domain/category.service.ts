import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateCategoryDto } from '../dto/request/create-category.dto';
import { UpdateCategoryDto } from '../dto/request/update-category.dto';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { CATEGORY_SLUG_EMPTY_MESSAGE, CATEGORY_SLUG_INVALID_MESSAGE } from '../category.constants';
import {
  CATEGORY_REPOSITORY_PORT,
  type CategoryRepositoryPort,
  type CategoryRow,
} from '../domain/ports';
import { CategoryNotFoundError, CategorySlugConflictError } from '../domain/errors';
import type {
  CategoryPatch,
  CategoryCursorPayload,
  ListCategoriesCursorQuery,
} from '../types/category.types';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

@Injectable()
export class CategoryDomainService {
  private readonly categoryIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    @Inject(CATEGORY_REPOSITORY_PORT)
    private readonly categoryRepository: CategoryRepositoryPort,
    @InjectPinoLogger(CategoryDomainService.name) private readonly logger: PinoLogger,
  ) {}

  private normalizeSlug(slug: string): string {
    return normalizeSlugOrThrow(slug, {
      emptyMessage: CATEGORY_SLUG_EMPTY_MESSAGE,
      invalidMessage: CATEGORY_SLUG_INVALID_MESSAGE,
    });
  }

  private decodeCursor(cursor: string): CategoryCursorPayload {
    const parsed = decodeBase64JsonCursor<CategoryCursorPayload>(cursor);

    if (
      !this.isIsoDateString(parsed.createdAt) ||
      !this.isStringMatchingPattern(parsed.categoryId, this.categoryIdPattern)
    ) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      categoryId: parsed.categoryId ?? '',
    };
  }

  private encodeCursor(category: Pick<CategoryRow, 'createdAt' | 'categoryId'>): string {
    return encodeBase64JsonCursor({
      createdAt: category.createdAt,
      categoryId: category.categoryId,
    });
  }

  private isStringMatchingPattern(value: unknown, pattern: RegExp): boolean {
    return typeof value === 'string' && pattern.test(value);
  }

  private isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  async listCategories(query: ListCategoriesCursorQuery): Promise<{
    items: CategoryRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? this.decodeCursor(cursorValue) : null;

    const rows = await this.categoryRepository.findMany({ limit: limit + 1, cursor });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? this.encodeCursor(lastItem) : null,
    };
  }

  async getCategoryBySlug(slug: string): Promise<CategoryRow> {
    const normalizedSlug = this.normalizeSlug(slug);
    const category = await this.categoryRepository.findBySlug(normalizedSlug);

    if (!category) {
      this.logger.warn({ event: 'category_get_by_slug_not_found', slug: normalizedSlug });
      throw new CategoryNotFoundError();
    }

    return category;
  }

  async createCategory(payload: CreateCategoryDto): Promise<CategoryRow> {
    const name = payload.name.trim();
    const slug = this.normalizeSlug(payload.slug ?? buildSlug(name));
    const description = normalizeNullableText(payload.description) ?? null;
    const imageUrl = normalizeNullableText(payload.imageUrl) ?? null;
    const nowIso = new Date().toISOString();

    let category: CategoryRow;

    try {
      category = await this.categoryRepository.create({
        name,
        slug,
        description,
        imageUrl,
        nowIso,
      });
    } catch (error: unknown) {
      const pg = error as { code?: string };
      this.logger.error({
        event: 'category_create_failed',
        name,
        slug,
        errorCode: pg.code ?? 'UNKNOWN',
      });
      if (pg.code === '23505') {
        throw new CategorySlugConflictError();
      }
      throw error;
    }

    this.logger.info({ event: 'category_created', categoryId: category.categoryId, slug });

    return category;
  }

  async updateCategory(categoryId: string, payload: UpdateCategoryDto): Promise<CategoryRow> {
    const patch: CategoryPatch = {};

    if (hasOwn(payload, 'name') && payload.name !== undefined) {
      patch.name = payload.name.trim();
    }

    if (hasOwn(payload, 'description')) {
      patch.description = normalizeNullableText(payload.description);
    }

    if (hasOwn(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = this.normalizeSlug(payload.slug);
    }

    if (hasOwn(payload, 'imageUrl')) {
      patch.imageUrl = normalizeNullableText(payload.imageUrl);
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.categoryRepository.findById(categoryId);
      if (!existing) {
        this.logger.warn({ event: 'category_update_not_found', categoryId });
        throw new CategoryNotFoundError();
      }
      return existing;
    }

    const nowIso = new Date().toISOString();
    let updated: CategoryRow | null;

    try {
      updated = await this.categoryRepository.update({ categoryId, patch, nowIso });
    } catch (error: unknown) {
      const pg = error as { code?: string };
      this.logger.error({
        event: 'category_update_failed',
        categoryId,
        errorCode: pg.code ?? 'UNKNOWN',
      });
      if (pg.code === '23505') {
        throw new CategorySlugConflictError();
      }
      throw error;
    }

    if (!updated) {
      this.logger.warn({ event: 'category_update_not_found', categoryId });
      throw new CategoryNotFoundError();
    }

    this.logger.info({ event: 'category_updated', categoryId });

    return updated;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.categoryRepository.softDelete(categoryId, nowIso);
    this.logger.info({ event: 'category_deleted', categoryId });
  }
}
