import { Inject, Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper } from '../mappers/category-response.mapper';
import { CategoryCursorMapper } from '../mappers/category-cursor.mapper';
import { FollowedCategoryCursorMapper } from '../mappers/followed-category-cursor.mapper';
import { CategoryAnalyticsResponseMapper } from '@/modules/quiz/mappers';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { QUIZ_ANALYTICS_PORT } from '@/modules/quiz/domain/analytics';
import type { QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { FollowedCategoryItemDto } from '../dto/response/followed-category-item.dto';
import type { CategoryAnalyticsResponseDto } from '../dto/response/category-analytics-response.dto';
import type {
  ListCategoriesQuery,
  ListFollowedCategoriesQuery,
  CategoryRankingQuery,
  RelatedCategoriesQuery,
} from '../domain/types/category-commands';
import type { ListCategoryQuizzesQueryDto } from '../dto/request/list-category-quizzes-query.dto';
import type { QuizResponseDto } from '@/modules/quiz/dto/response/quiz-response.dto';
import type { FollowedCategoryRow, CategoryRow, RankedCategoryRow } from '../domain/ports';
import { CategoryAnalyticsNotFoundError } from '../domain/errors/category-domain.errors';

/**
 * Canonical response envelope: `{ data, meta }`.
 *
 * All list/single-resource endpoints in the category module return this shape
 * directly so the response shape is identical regardless of whether the
 * endpoint paginates. The `ResponseFormatInterceptor` passes pre-formatted
 * payloads through unchanged.
 */
type CategoryEnvelope<T> = {
  data: T;
  meta: {
    timestamp: string;
    pagination?: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  };
};

/**
 * Read side of the Category bounded context.
 *
 * CQRS: this service is responsible exclusively for query (read) operations.
 * It has no side effects and does not emit domain events.
 */
@Injectable()
export class CategoryQueryService {
  constructor(
    private readonly categoryDomainService: CategoryDomainService,
    private readonly quizApplicationService: QuizApplicationService,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalyticsService: QuizAnalyticsPort,
  ) {}

  async listCategories(
    query: ListCategoriesQuery,
  ): Promise<CategoryEnvelope<CategoryResponseDto[]>> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listCategories(query);

    return this.paginatedEnvelope(
      items.map((item) => this.toCategoryResponse(item)),
      {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? CategoryCursorMapper.serialize(nextCursor) : null,
      },
    );
  }

  async getCategoryById(categoryId: string): Promise<CategoryEnvelope<CategoryResponseDto>> {
    const row = await this.categoryDomainService.getCategoryById(categoryId);
    return this.singleEnvelope(this.toCategoryResponse(row));
  }

  async getCategoryBySlug(slug: string): Promise<CategoryEnvelope<CategoryResponseDto>> {
    const row = await this.categoryDomainService.getCategoryBySlug(slug);
    return this.singleEnvelope(this.toCategoryResponse(row));
  }

  async getRelatedCategories(
    slug: string,
    query: RelatedCategoriesQuery,
  ): Promise<CategoryEnvelope<CategoryResponseDto[]>> {
    const items = await this.categoryDomainService.getRelatedCategories(slug, query);

    return this.arrayEnvelope(items.map((item) => this.toCategoryResponse(item)));
  }

  async getCategoryQuizzesBySlug(
    slug: string,
    quizQuery: ListCategoryQuizzesQueryDto,
  ): Promise<CategoryEnvelope<QuizResponseDto[]>> {
    const category = await this.categoryDomainService.getCategoryBySlug(slug);

    const result = await this.quizApplicationService.listQuizzes({
      ...quizQuery,
      categoryId: category.categoryId,
    });

    return this.paginatedEnvelope(result.items, result.pagination);
  }

  async listFollowedCategories(
    userId: string,
    query: ListFollowedCategoriesQuery,
  ): Promise<CategoryEnvelope<FollowedCategoryItemDto[]>> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listFollowedCategories(userId, query);

    return this.paginatedEnvelope(
      items.map((item) => this.toFollowedCategoryItem(item)),
      {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? FollowedCategoryCursorMapper.serialize(nextCursor) : null,
      },
    );
  }

  async getPopularCategories(
    query: CategoryRankingQuery,
  ): Promise<CategoryEnvelope<RankedCategoryRow[]>> {
    const items = await this.categoryDomainService.getPopularCategories(query);
    return this.arrayEnvelope(items);
  }

  async getTrendingCategories(
    query: CategoryRankingQuery,
  ): Promise<CategoryEnvelope<RankedCategoryRow[]>> {
    const items = await this.categoryDomainService.getTrendingCategories(query);
    return this.arrayEnvelope(items);
  }

  async getCategoryAnalytics(
    categoryId: string,
  ): Promise<CategoryEnvelope<CategoryAnalyticsResponseDto>> {
    await this.categoryDomainService.getCategoryById(categoryId);
    const analytics = await this.quizAnalyticsService.getCategoryAnalytics(categoryId);

    if (!analytics) {
      throw new CategoryAnalyticsNotFoundError();
    }

    return this.singleEnvelope(CategoryAnalyticsResponseMapper.toResponse(analytics));
  }

  private singleEnvelope<T>(data: T): CategoryEnvelope<T> {
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  private arrayEnvelope<T>(data: T[]): CategoryEnvelope<T[]> {
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  private paginatedEnvelope<T>(
    data: T[],
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null },
  ): CategoryEnvelope<T[]> {
    return {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination,
      },
    };
  }

  private toCategoryResponse(row: CategoryRow): CategoryResponseDto {
    return CategoryResponseMapper.toResponse(row);
  }

  private toFollowedCategoryItem(item: FollowedCategoryRow): FollowedCategoryItemDto {
    return {
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      imageUrl: item.imageUrl,
      description: item.description,
      followedAt: item.followedAt,
    };
  }
}
