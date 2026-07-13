import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type {
  CreatorQuizAnalyticsDto,
  PopularQuizItemDto,
  TrendingQuizItemDto,
} from '../../dto/response/quiz-analytics.dto';
import type { DeleteQuizResponseDto } from '../../dto/response/delete-quiz-response.dto';
import type { QuizStatsResponseDto } from '../../dto/response/quiz-stats-response.dto';
import type { RelatedQuizzesResponseDto } from '../../dto/response/related-quizzes-response.dto';
import type { QuizQuestionResponseDto } from '../../dto/response/quiz-question-response.dto';
import type {
  QuizVersionDetailResponseDto,
  QuizVersionResponseDto,
} from '../../dto/response/quiz-version-response.dto';
import type { QuizResponseDto } from '../../dto/response/quiz-response.dto';
import type { QuizListItemDto } from '../../dto/response/quiz-list-item.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, nextCursor, hasNextPage } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for paginated list endpoints whose application-service return is a
 * class-instance `{ items, pagination }` DTO. The canonical envelope has to be
 * a plain object (the interceptor's `isFormattedResponse()` guards on `Object`
 * prototype), so we deliberately project out the DTO fields here instead of
 * forwarding the class instance for the interceptor to re-wrap.
 */
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => ({
  data: [...payload.items],
  meta: {
    timestamp: new Date().toISOString(),
    pagination: {
      kind: 'cursor' as const,
      limit: payload.pagination.limit,
      hasNextPage: payload.pagination.hasNextPage,
      nextCursor: payload.pagination.nextCursor,
    },
  },
});

/**
 * Presenter for the quiz module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 */
@Injectable()
export class QuizPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Quiz CRUD
  readonly createQuiz = QuizPresenter.ok<QuizResponseDto>;
  readonly updateQuiz = QuizPresenter.ok<QuizResponseDto>;
  readonly getQuiz = QuizPresenter.ok<QuizResponseDto>;
  readonly deleteQuiz = QuizPresenter.ok<DeleteQuizResponseDto>;

  // Quiz lists
  readonly listQuizzes = wrapPaginatedDto<QuizListItemDto>;
  readonly listMyQuizzes = wrapPaginatedDto<QuizListItemDto>;
  readonly listMyDraftQuizzes = wrapPaginatedDto<QuizListItemDto>;
  readonly listMyPublishedQuizzes = wrapPaginatedDto<QuizListItemDto>;

  // Quiz analytics / trending / popular
  readonly getTrendingQuizzes = (items: TrendingQuizItemDto[]) => ApiResponse.ok([...items]);
  readonly getPopularQuizzes = (items: PopularQuizItemDto[]) => ApiResponse.ok([...items]);
  readonly getMyQuizAnalytics = QuizPresenter.ok<CreatorQuizAnalyticsDto>;
  readonly getQuizStats = QuizPresenter.ok<QuizStatsResponseDto>;

  // Related (related / featured / similar): items-only DTOs unwrapped to bare array
  readonly getFeaturedQuizzes = (dto: RelatedQuizzesResponseDto) => ApiResponse.ok([...dto.items]);
  readonly getRelatedQuizzes = (dto: RelatedQuizzesResponseDto) => ApiResponse.ok([...dto.items]);
  readonly getSimilarQuizzes = (dto: RelatedQuizzesResponseDto) => ApiResponse.ok([...dto.items]);

  // Quiz versions
  readonly createQuizVersion = QuizPresenter.ok<QuizVersionResponseDto>;
  readonly updateQuizVersion = QuizPresenter.ok<QuizVersionResponseDto>;
  readonly publishQuizVersion = QuizPresenter.ok<QuizVersionResponseDto>;
  readonly listQuizVersions = wrapPaginatedDto<QuizVersionResponseDto>;
  readonly getQuizVersionDetail = QuizPresenter.ok<QuizVersionDetailResponseDto>;

  // Questions
  readonly createQuizQuestion = QuizPresenter.ok<QuizQuestionResponseDto>;
  readonly createQuizQuestions = (result: { questions: QuizQuestionResponseDto[] }) =>
    ApiResponse.ok([...result.questions]);
}
