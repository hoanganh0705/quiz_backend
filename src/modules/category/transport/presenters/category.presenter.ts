import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { CategoryAnalyticsResponseDto } from '../../dto/response/category-analytics-response.dto';
import type { CategoryResponseDto } from '../../dto/response/category-response.dto';
import type { FollowedCategoryItemDto } from '../../dto/response/followed-category-item.dto';
import type { MessageResponseDto } from '../../dto/response/message-response.dto';
import type { RankedCategoriesResponseDto } from '../../dto/response/ranked-categories-response.dto';
import type { QuizResponseDto } from '@/modules/quiz/dto/response/quiz-response.dto';

/**
 * Presenter for the category module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * Currently a thin pass-through to {@link ApiResponse.ok} and {@link ApiResponse.page}.
 * The layer exists separately from the controller so future module-specific
 * shaping (sensitive field redaction, conditional fields, additional meta) has a
 * stable seam.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 */
@Injectable()
export class CategoryPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly listCategories = (payload: PaginatedResult<CategoryResponseDto>) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly getCategoryById = CategoryPresenter.ok<CategoryResponseDto>;
  readonly getCategoryBySlug = CategoryPresenter.ok<CategoryResponseDto>;
  readonly getRelatedCategories = (payload: CategoryResponseDto[]) => ApiResponse.ok(payload);
  readonly getCategoryQuizzesBySlug = (payload: PaginatedResult<QuizResponseDto>) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly listFollowedCategories = (payload: PaginatedResult<FollowedCategoryItemDto>) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly getPopularCategories = (payload: RankedCategoriesResponseDto) => ApiResponse.ok(payload);
  readonly getTrendingCategories = (payload: RankedCategoriesResponseDto) =>
    ApiResponse.ok(payload);
  readonly getCategoryAnalytics = CategoryPresenter.ok<CategoryAnalyticsResponseDto>;
  readonly createCategory = CategoryPresenter.ok<CategoryResponseDto>;
  readonly updateCategory = CategoryPresenter.ok<CategoryResponseDto>;
  readonly restoreCategory = CategoryPresenter.ok<CategoryResponseDto>;
  readonly deleteCategory = CategoryPresenter.ok<MessageResponseDto>;
  readonly followCategory = CategoryPresenter.ok<MessageResponseDto>;
  readonly unfollowCategory = CategoryPresenter.ok<MessageResponseDto>;
}
