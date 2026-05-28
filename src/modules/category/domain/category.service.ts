import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { normalizeNullableText } from '@/common/utils/text.util';
import { CATEGORY_SLUG_EMPTY_MESSAGE, CATEGORY_SLUG_INVALID_MESSAGE } from '../category.constants';
import {
  CATEGORY_REPOSITORY_PORT,
  type CategoryRepositoryPort,
  type CategoryRow,
} from '../domain/ports';
import { CategoryNotFoundError } from '../domain/errors';
import type { CategoryPatch } from '../types/category.types';
import type {
  CreateCategoryCommand,
  ListCategoriesQuery,
  UpdateCategoryCommand,
} from './types/category-commands';

@Injectable()
export class CategoryDomainService {
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

  async listCategories(query: ListCategoriesQuery): Promise<{
    items: CategoryRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: Pick<CategoryRow, 'createdAt' | 'categoryId'> | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.categoryRepository.findMany({ limit: limit + 1, cursor });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? lastItem : null,
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

  async createCategory(payload: CreateCategoryCommand): Promise<CategoryRow> {
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
      this.logger.error({
        event: 'category_create_failed',
        name,
        slug,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
      throw error;
    }

    this.logger.info({ event: 'category_created', categoryId: category.categoryId, slug });

    return category;
  }

  async updateCategory(categoryId: string, payload: UpdateCategoryCommand): Promise<CategoryRow> {
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
      this.logger.error({
        event: 'category_update_failed',
        categoryId,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
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
    const deleted = await this.categoryRepository.softDelete(categoryId, nowIso);
    if (!deleted) {
      this.logger.warn({ event: 'category_delete_not_found', categoryId });
      throw new CategoryNotFoundError();
    }
    this.logger.info({ event: 'category_deleted', categoryId });
  }
}
