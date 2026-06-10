import { Inject, Injectable } from '@nestjs/common';
import { CategoryDomainService } from '../domain/category.service';
import { CategoryResponseMapper } from '../mappers/category-response.mapper';
import { CategoryCursorMapper } from '../mappers/category-cursor.mapper';
import { FollowedCategoryCursorMapper } from '../mappers/followed-category-cursor.mapper';
import { CategoryAnalyticsResponseMapper } from '@/modules/quiz/mappers';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { QUIZ_ANALYTICS_PORT } from '@/modules/quiz/domain/analytics';
import type { QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';
import type { CategoryListResponseDto } from '../dto/response/category-list-response.dto';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';
import type { RankedCategoriesResponseDto } from '../dto/response/ranked-categories-response.dto';
import type { FollowedCategoriesResponseDto } from '../dto/response/followed-categories-response.dto';
import type { CategoryAnalyticsResponseDto } from '../dto/response/category-analytics-response.dto';
import type { RelatedCategoriesResponseDto } from '../dto/response/related-categories-response.dto';
import type {
  ListCategoriesQuery,
  ListFollowedCategoriesQuery,
  CategoryRankingQuery,
  RelatedCategoriesQuery,
} from '../domain/types/category-commands';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { FollowedCategoryRow, CategoryRow } from '../domain/ports';
import { CategoryAnalyticsNotFoundError } from '../domain/errors/category-domain.errors';

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

  async listCategories(query: ListCategoriesQuery): Promise<CategoryListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listCategories(query);

    return {
      items: items.map((item) => this.toCategoryResponse(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? CategoryCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getCategoryById(categoryId: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryById(categoryId);
    return this.toCategoryResponse(row);
  }

  async getCategoryBySlug(slug: string): Promise<CategoryResponseDto> {
    const row = await this.categoryDomainService.getCategoryBySlug(slug);
    return this.toCategoryResponse(row);
  }

  async getRelatedCategories(
    slug: string,
    query: RelatedCategoriesQuery,
  ): Promise<RelatedCategoriesResponseDto> {
    const items = await this.categoryDomainService.getRelatedCategories(slug, query);

    return {
      items: items.map((item) => this.toCategoryResponse(item)),
    };
  }

  async getCategoryQuizzesBySlug(
    slug: string,
    quizQuery: ListQuizzesQueryDto,
  ): Promise<QuizListResponseDto> {
    const category = await this.categoryDomainService.getCategoryBySlug(slug);

    return this.quizApplicationService.listQuizzes({
      ...quizQuery,
      categoryId: category.categoryId,
    });
  }

  async listFollowedCategories(
    userId: string,
    query: ListFollowedCategoriesQuery,
  ): Promise<FollowedCategoriesResponseDto> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.categoryDomainService.listFollowedCategories(userId, query);

    return {
      items: items.map((item) => this.toFollowedCategoryItem(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? FollowedCategoryCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getPopularCategories(query: CategoryRankingQuery): Promise<RankedCategoriesResponseDto> {
    const items = await this.categoryDomainService.getPopularCategories(query);
    return { items };
  }

  async getTrendingCategories(query: CategoryRankingQuery): Promise<RankedCategoriesResponseDto> {
    const items = await this.categoryDomainService.getTrendingCategories(query);
    return { items };
  }

  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalyticsResponseDto> {
    await this.categoryDomainService.getCategoryById(categoryId);
    const analytics = await this.quizAnalyticsService.getCategoryAnalytics(categoryId);

    if (!analytics) {
      throw new CategoryAnalyticsNotFoundError();
    }

    return CategoryAnalyticsResponseMapper.toResponse(analytics);
  }

  private toCategoryResponse(row: CategoryRow): CategoryResponseDto {
    return CategoryResponseMapper.toResponse(row);
  }

  private toFollowedCategoryItem(
    item: FollowedCategoryRow,
  ): FollowedCategoriesResponseDto['items'][number] {
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
