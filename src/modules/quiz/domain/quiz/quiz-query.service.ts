import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY_PORT, type QuizRepositoryPort } from '../ports/quiz-repository.port';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
} from '../ports/quiz-question-repository.port';
import type { QuizWithPublishedVersionRow, QuizRecordRow } from '../ports/quiz-repository.port';
import type { QuizQuestionJoinRow } from '../ports/quiz-question-repository.port';
import type { ListQuizzesQuery } from '../types/list-quizzes.query';
import type { QuizCursor } from '../ports/quiz-repository.port';
import { QuizNotFoundError } from '../errors';
import { normalizeQuizSlug } from '../slug/quiz-slug';
import type { QuizDifficulty } from '../../types/quiz.types';

export type ListQuizzesResult = {
  rows: QuizWithPublishedVersionRow[];
  limit: number;
  hasNextPage: boolean;
  nextCursor: QuizCursor | null;
};

/**
 * QuizQueryService — Query orchestration for the Quiz aggregate.
 *
 * Responsibilities:
 *  - Load quiz records by ID or slug
 *  - Paginate quiz listings with cursor semantics
 *  - Fetch associated question sets for the published version
 *
 * Read-only: never mutates state. All write operations live in QuizCommandService.
 */
@Injectable()
export class QuizQueryService {
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

  async listQuizzes(query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listQuizzes({
      limit: query.limit,
      cursor: query.cursor,
      filters: query.filters
        ? {
            ...query.filters,
            difficulty: query.filters.difficulty as QuizDifficulty | undefined,
          }
        : undefined,
    });

    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit: query.limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem ? { createdAt: lastItem.createdAt, quizId: lastItem.quizId } : null,
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
