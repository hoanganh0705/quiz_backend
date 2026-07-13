import type { CreatorQuizAnalyticsDto } from '../../../dto/response/quiz-analytics.dto';
import type { RecommendedQuizzesQueryDto } from '../../../dto/request/recommended-quizzes-query.dto';
import type { ListQuizzesQueryDto } from '../../../dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '../../../dto/response/quiz-list-response.dto';
import type { RelatedQuizzesResponseDto } from '../../../dto/response/related-quizzes-response.dto';

export const QUIZ_LISTING_PORT = Symbol('QUIZ_LISTING_PORT');

export interface QuizListingPort {
  listQuizzesByTag(params: {
    tagIds: string[];
    dto: ListQuizzesQueryDto;
  }): Promise<QuizListResponseDto>;

  getRecommendedQuizzes(
    userId: string,
    dto: RecommendedQuizzesQueryDto,
  ): Promise<RelatedQuizzesResponseDto>;

  getMyQuizAnalytics(userId: string): Promise<CreatorQuizAnalyticsDto>;

  listQuizzesByCreator(userId: string, dto: ListQuizzesQueryDto): Promise<QuizListResponseDto>;
}
