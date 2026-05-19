import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY_PORT, type QuizRepositoryPort } from '../ports/quiz-repository.port';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
} from '../ports/quiz-question-repository.port';
import type { QuizWithPublishedVersionRow, QuizRecordRow } from '../ports/quiz-repository.port';
import type { QuizQuestionJoinRow } from '../ports/quiz-question-repository.port';
import { ListQuizzesQueryDto } from '../../dto/request/list-quizzes-query.dto';
import { QuizNotFoundError } from '../errors';
import { decodeQuizCursor, encodeQuizCursor, normalizeQuizSlug } from '../shared/quiz-utils';

@Injectable()
export class QuizReadService {
  constructor(
    @Inject(QUIZ_REPOSITORY_PORT) private readonly quizRepository: QuizRepositoryPort,
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
  ) {}

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new QuizNotFoundError();
    }

    return quiz;
  }

  async getQuizById(quizId: string): Promise<QuizWithPublishedVersionRow> {
    const row = await this.quizRepository.getQuizWithPublishedVersionById(quizId);

    if (!row) {
      throw new QuizNotFoundError();
    }

    return row;
  }

  async listQuizzes(query: ListQuizzesQueryDto): Promise<{
    rows: QuizWithPublishedVersionRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? decodeQuizCursor(cursorValue) : null;

    const rows = await this.quizRepository.listQuizzes({
      limit,
      cursor,
      filters: {
        difficulty: query.difficulty,
        categoryId: query.categoryId,
        tagId: query.tagId,
      },
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? encodeQuizCursor(lastItem) : null,
    };
  }

  async getQuizBySlug(
    slug: string,
  ): Promise<{ row: QuizWithPublishedVersionRow; questions: QuizQuestionJoinRow[] | null }> {
    const normalizedSlug = normalizeQuizSlug(slug);

    const row = await this.quizRepository.getQuizWithPublishedVersionBySlug(normalizedSlug);

    if (!row) {
      throw new QuizNotFoundError();
    }

    if (!row.publishedVersionQuizVersionId) {
      return { row, questions: null };
    }

    const questions = await this.quizQuestionRepository.getQuestionsByVersionId(
      row.publishedVersionQuizVersionId,
    );

    return { row, questions };
  }
}
