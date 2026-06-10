import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';

export const QUIZ_LISTING_PORT = Symbol('QUIZ_LISTING_PORT');

export interface QuizListingPort {
  listQuizzesByTag(params: {
    tagId: string;
    dto: ListQuizzesQueryDto;
  }): Promise<QuizListResponseDto>;
}
