import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildSlug, normalizeSlugOrThrow } from '@/common/utils/slug.util';
import { hasOwn } from '@/common/utils/object.util';
import { normalizeNullableText } from '@/common/utils/text.util';
import { CATEGORY_SLUG_EMPTY_MESSAGE, CATEGORY_SLUG_INVALID_MESSAGE } from '../category.constants';
import {
  CATEGORY_DOMAIN_EVENT_BUS,
  CATEGORY_REPOSITORY_PORT,
  type CategoryDomainEventBusPort,
  type CategoryRepositoryPort,
  type CategoryRow,
  type FollowedCategoryRow,
  type RankedCategoryRow,
} from '../domain/ports';
import {
  CategoryAlreadyActiveError,
  CategoryNotFoundError,
  CategoryRestoreInvariantError,
} from '../domain/errors';
import type {
  CategoryPatch,
  CreateCategoryCommand,
  ListCategoriesQuery,
  ListFollowedCategoriesQuery,
  CategoryRankingQuery,
  RelatedCategoriesQuery,
  UpdateCategoryCommand,
} from './types/category-commands';

@Injectable()
export class CategoryDomainService {
  constructor(
    @Inject(CATEGORY_REPOSITORY_PORT)
    private readonly categoryRepository: CategoryRepositoryPort,
    @Inject(CATEGORY_DOMAIN_EVENT_BUS)
    private readonly eventBus: CategoryDomainEventBusPort,
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

    const rows = await this.categoryRepository.findMany({ limit, cursor });

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

  async getCategoryById(categoryId: string): Promise<CategoryRow> {
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      this.logger.warn({ event: 'category_get_by_id_not_found', categoryId });
      throw new CategoryNotFoundError();
    }

    return category;
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

  async getRelatedCategories(slug: string, query: RelatedCategoriesQuery): Promise<CategoryRow[]> {
    const normalizedSlug = this.normalizeSlug(slug);
    const relatedCategories = await this.categoryRepository.findRelatedBySlug({
      slug: normalizedSlug,
      limit: query.limit,
    });

    if (relatedCategories.length === 0) {
      await this.getCategoryBySlug(normalizedSlug);
    }

    return relatedCategories;
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
    this.eventBus.emitCategoryCreated({ categoryId: category.categoryId, slug, nowIso });

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
      return this.getCategoryById(categoryId);
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
    this.eventBus.emitCategoryUpdated({ categoryId, slug: updated.slug, nowIso });

    return updated;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findByIdIncludingDeleted(categoryId);
    if (!category) {
      this.logger.warn({ event: 'category_delete_not_found', categoryId });
      throw new CategoryNotFoundError();
    }

    const nowIso = new Date().toISOString();
    await this.categoryRepository.softDelete(categoryId, nowIso);
    this.logger.info({ event: 'category_deleted', categoryId });
    this.eventBus.emitCategoryDeleted({ categoryId, slug: category.slug, nowIso });
  }

  async restoreCategory(categoryId: string): Promise<CategoryRow> {
    const existing = await this.categoryRepository.findByIdIncludingDeleted(categoryId);

    if (!existing) {
      this.logger.warn({ event: 'category_restore_not_found', categoryId });
      throw new CategoryNotFoundError();
    }

    if (existing.deletedAt === null) {
      this.logger.warn({ event: 'category_restore_already_active', categoryId });
      throw new CategoryAlreadyActiveError();
    }

    const nowIso = new Date().toISOString();

    const restored = await this.categoryRepository.restore(categoryId, nowIso);
    if (!restored) {
      this.logger.error({ event: 'category_restore_invariant_violation', categoryId });
      throw new CategoryRestoreInvariantError();
    }

    this.logger.info({ event: 'category_restored', categoryId });
    this.eventBus.emitCategoryRestored({ categoryId, slug: restored.slug, nowIso });
    return restored;
  }

  async followCategory(userId: string, categoryId: string): Promise<void> {
    await this.getCategoryById(categoryId);

    const nowIso = new Date().toISOString();

    try {
      const follow = await this.categoryRepository.followCategory({ userId, categoryId, nowIso });

      this.logger.info({
        event: 'category_followed',
        userId,
        categoryId,
        followId: follow.followId,
      });
    } catch (error: unknown) {
      this.logger.error({
        event: 'category_follow_failed',
        userId,
        categoryId,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
      throw error;
    }
  }

  async unfollowCategory(userId: string, categoryId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    try {
      await this.categoryRepository.unfollowCategory({ userId, categoryId, nowIso });
      this.logger.info({ event: 'category_unfollowed', userId, categoryId });
    } catch (error: unknown) {
      this.logger.error({
        event: 'category_unfollow_failed',
        userId,
        categoryId,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
      throw error;
    }
  }

  async listFollowedCategories(
    userId: string,
    query: ListFollowedCategoriesQuery,
  ): Promise<{
    items: FollowedCategoryRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { followedAt: string; followId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.categoryRepository.listFollowedCategories({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { followedAt: lastItem.followedAt, followId: lastItem.followId }
          : null,
    };
  }

  async getPopularCategories(query: CategoryRankingQuery): Promise<RankedCategoryRow[]> {
    return this.categoryRepository.getPopularCategories(query.limit);
  }

  async getTrendingCategories(query: CategoryRankingQuery): Promise<RankedCategoryRow[]> {
    return this.categoryRepository.getTrendingCategories(query.limit);
  }
}
