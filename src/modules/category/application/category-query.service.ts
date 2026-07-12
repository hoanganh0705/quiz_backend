import { Inject, Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper, RankedCategoryResponseMapper } from '../mappers';
import { CategoryCursorMapper } from '../mappers/category-cursor.mapper';
import { FollowedCategoryCursorMapper } from '../mappers/followed-category-cursor.mapper';
import { CategoryAnalyticsResponseMapper } from '@/modules/quiz/mappers';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { QUIZ_ANALYTICS_PORT } from '@/modules/quiz/domain/analytics';
import type { QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { CursorPagination } from '@/common/responses/pagination';
import { paginated } from '@/common/responses/paginated-result';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { FollowedCategoryItemDto } from '../dto/response/followed-category-item.dto';
import type { RankedCategoryResponseDto } from '../dto/response/ranked-category-response.dto';
import type { CategoryAnalyticsResponseDto } from '../dto/response/category-analytics-response.dto';
import type {
  ListCategoriesQuery,
  ListFollowedCategoriesQuery,
  CategoryRankingQuery,
  RelatedCategoriesQuery,
} from '../domain/types/category-commands';
import type { ListCategoryQuizzesQueryDto } from '../dto/request/list-category-quizzes-query.dto';
import type { QuizResponseDto } from '@/modules/quiz/dto/response/quiz-response.dto';
import type { FollowedCategoryRow } from '../domain/ports';
import { CategoryAnalyticsNotFoundError } from '../domain/errors/category-domain.errors';

/**
 * Adapter: project the quiz module's `{ items, pagination: { limit, hasNextPage,
 * nextCursor } }` DTO into a domain-level {@link PaginatedResult}, attaching
 * the `kind: 'cursor'` discriminator that Phase 4 made mandatory.
 */
const cursorResultFromQuizDto = (
  payload: Awaited<ReturnType<QuizApplicationService['listQuizzes']>>,
): PaginatedResult<QuizResponseDto> => {
  const pagination: CursorPagination = {
    kind: 'cursor',
    limit: payload.pagination.limit,
    hasNextPage: payload.pagination.hasNextPage,
    nextCursor: payload.pagination.nextCursor,
  };
  return paginated<QuizResponseDto>(payload.items, pagination);
};

/**
 * Read side of the Category bounded context.
 *
 * CQRS: this service is responsible exclusively for query (read) operations.
 * It has no side effects and does not emit domain events.
 *
 * Layering contract: this service returns raw DTOs (`CategoryResponseDto`,
 * `FollowedCategoryItemDto`, `RankedCategoryResponseDto`, …) and domain-level
 * {@link PaginatedResult} values. It never returns HTTP envelopes; the
 * `transport/presenters/category.presenter.ts` performs wrapping via
 * `ApiResponse.ok(...)` / `ApiResponse.page(...)`.
 */
@Injectable()
export class CategoryQueryService {
  constructor(
    private readonly categoryDomainService: CategoryDomainService,
    private readonly quizApplicationService: QuizApplicationService,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalyticsService: QuizAnalyticsPort,
  ) {}

  async listCategories(query: ListCategoriesQuery): Promise<PaginatedResult<CategoryResponseDto>> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listCategories(query);

    const pagination: CursorPagination = {
      kind: 'cursor',
      limit,
      hasNextPage,
      nextCursor: nextCursor ? CategoryCursorMapper.serialize(nextCursor) : null,
    };
    return paginated<CategoryResponseDto>(
      items.map((item) => CategoryResponseMapper.toResponse(item)),
      pagination,
    );
  }

  async getCategoryById(categoryId: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryById(categoryId);
    return CategoryResponseMapper.toResponse(row);
  }

  async getCategoryBySlug(slug: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryBySlug(slug);
    return CategoryResponseMapper.toResponse(row);
  }

  async getRelatedCategories(
    slug: string,
    query: RelatedCategoriesQuery,
  ): Promise<CategoryResponseDto[]> {
    const items = await this.categoryDomainService.getRelatedCategories(slug, query);
    return items.map((item) => CategoryResponseMapper.toResponse(item));
  }

  async getCategoryQuizzesBySlug(
    slug: string,
    quizQuery: ListCategoryQuizzesQueryDto,
  ): Promise<PaginatedResult<QuizResponseDto>> {
    const category = await this.categoryDomainService.getCategoryBySlug(slug);

    const result = await this.quizApplicationService.listQuizzes({
      ...quizQuery,
      categoryId: category.categoryId,
    });

    return cursorResultFromQuizDto(result);
  }

  async listFollowedCategories(
    userId: string,
    query: ListFollowedCategoriesQuery,
  ): Promise<PaginatedResult<FollowedCategoryItemDto>> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listFollowedCategories(userId, query);

    const pagination: CursorPagination = {
      kind: 'cursor',
      limit,
      hasNextPage,
      nextCursor: nextCursor ? FollowedCategoryCursorMapper.serialize(nextCursor) : null,
    };
    return paginated<FollowedCategoryItemDto>(items.map(toFollowedCategoryItem), pagination);
  }

  async getPopularCategories(query: CategoryRankingQuery): Promise<RankedCategoryResponseDto[]> {
    const items = await this.categoryDomainService.getPopularCategories(query);
    return items.map((item) => RankedCategoryResponseMapper.toResponse(item));
  }

  async getTrendingCategories(query: CategoryRankingQuery): Promise<RankedCategoryResponseDto[]> {
    const items = await this.categoryDomainService.getTrendingCategories(query);
    return items.map((item) => RankedCategoryResponseMapper.toResponse(item));
  }

  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalyticsResponseDto> {
    await this.categoryDomainService.getCategoryById(categoryId);
    const analytics = await this.quizAnalyticsService.getCategoryAnalytics(categoryId);

    if (!analytics) {
      throw new CategoryAnalyticsNotFoundError();
    }

    return CategoryAnalyticsResponseMapper.toResponse(analytics);
  }
}

const toFollowedCategoryItem = (item: FollowedCategoryRow): FollowedCategoryItemDto => ({
  categoryId: item.categoryId,
  name: item.name,
  slug: item.slug,
  imageUrl: item.imageUrl,
  description: item.description,
  followedAt: item.followedAt,
});
