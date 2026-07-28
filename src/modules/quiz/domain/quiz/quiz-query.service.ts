import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY_PORT, type QuizRepositoryPort } from '../ports/quiz-repository.port';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
} from '../ports/quiz-question-repository.port';
import type {
  QuizStats,
  FeaturedQuizzesQuery,
  RelatedQuizzesQuery,
  RecommendedQuizzesQuery,
} from '../types';
import {
  QUIZ_ANALYTICS_REPOSITORY_PORT,
  type QuizAnalyticsRepositoryPort,
} from '../analytics/ports';
import type { CreatorAnalytics } from '../analytics/types';
import type { QuizRecordRow } from '../ports/quiz-repository.port';
import type { QuizTagRow } from '../ports/quiz-repository.port';
import type { QuizQuestionJoinRow } from '../ports/quiz-question-repository.port';
import type { ListQuizzesQuery } from '../types/list-quizzes.query';
import type { QuizCursor } from '../ports/quiz-repository.port';
import { QuizNotFoundError } from '../errors';
import { normalizeQuizSlug } from '../slug/quiz-slug';
import type { QuizDifficulty } from '../../types/quiz.types';
import type { QuizWithPublishedVersionRow } from '../ports';
import type { ScoredQuizRow } from '../analytics/ports/quiz-recommendation.repository-port';
import {
  QUIZ_RECOMMENDATION_REPOSITORY_PORT,
  type QuizRecommendationRepositoryPort,
} from '../analytics';
import { applyCursorPagination, type CursorPaginationResult } from '@/common/utils/pagination.util';

export type PaginatedQuizRow = {
  createdAt: string;
  quizId: string;
};

export type ListQuizzesResult = CursorPaginationResult<
  QuizWithPublishedVersionRow,
  { createdAt: string; quizId: string }
>;

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
    @Inject(QUIZ_RECOMMENDATION_REPOSITORY_PORT)
    private readonly recommendationRepository: QuizRecommendationRepositoryPort,
    @Inject(QUIZ_ANALYTICS_REPOSITORY_PORT)
    private readonly quizAnalyticsRepository: QuizAnalyticsRepositoryPort,
  ) {}

  /**
   * Applies cursor-based pagination over a fetched row array.
   * Fetches one extra row to detect `hasNextPage` and builds the next cursor
   * from the last item's ordering keys.
   */
  private buildPaginatedResult(
    rows: QuizWithPublishedVersionRow[],
    limit: number,
  ): ListQuizzesResult {
    return applyCursorPagination<QuizWithPublishedVersionRow, { createdAt: string; quizId: string }>(
      rows,
      limit,
      (row) => ({ createdAt: row.createdAt, quizId: row.quizId }),
    );
  }

  async getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new QuizNotFoundError();
    }

    return quiz;
  }

  async getQuizById(quizId: string): Promise<{
    row: QuizWithPublishedVersionRow;
    tags: QuizTagRow[];
  }> {
    const row = await this.quizRepository.getQuizWithPublishedVersionById(quizId);

    if (!row) {
      throw new QuizNotFoundError();
    }

    const tags = await this.quizRepository.getTagsForQuiz(row.quizId);
    return { row, tags };
  }

  async getQuizStats(quizId: string | undefined, slug: string): Promise<QuizStats> {
    const result = await this.getQuizBySlug(slug);
    const resolvedQuizId = result.row.quizId;

    const stats = await this.quizRepository.getQuizStats(quizId ?? resolvedQuizId);

    return {
      quizId: resolvedQuizId,
      totalAttempts: Number(stats?.totalAttempts ?? 0),
      uniquePlayers: Number(stats?.totalPlayers ?? 0),
      averageScore: Number(stats?.avgScorePercent ?? 0),
      averageRating: Number(stats?.avgRating ?? 0),
      bookmarkCount: Number(stats?.bookmarkCount ?? 0),
      completionRate: Number(stats?.completionRate ?? 0),
      popularityScore: Number(stats?.popularityScore ?? 0),
      trendingScore: Number(stats?.trendingScore ?? 0),
    };
  }

  async getFeaturedQuizzes(query: FeaturedQuizzesQuery): Promise<QuizWithPublishedVersionRow[]> {
    return this.quizRepository.findFeaturedQuizzes(query.limit);
  }

  async getRelatedQuizzes(
    slug: string,
    query: RelatedQuizzesQuery,
  ): Promise<QuizWithPublishedVersionRow[]> {
    const normalizedSlug = normalizeQuizSlug(slug);
    return this.quizRepository.findRelatedQuizzes({
      slug: normalizedSlug,
      limit: query.limit,
    });
  }

  async getRecommendedQuizzes(
    userId: string,
    query: RecommendedQuizzesQuery,
  ): Promise<ScoredQuizRow[]> {
    return this.recommendationRepository.findRecommendedQuizzes({
      userId,
      limit: query.limit,
    });
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

    return this.buildPaginatedResult(rows, query.limit);
  }

  async listUserQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
    });

    return this.buildPaginatedResult(rows, query.limit);
  }

  async listDraftQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listDraftsByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
    });

    return this.buildPaginatedResult(rows, query.limit);
  }

  async listPublishedQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listPublishedByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
    });

    return this.buildPaginatedResult(rows, query.limit);
  }

  async getCreatorAnalytics(userId: string): Promise<CreatorAnalytics> {
    return this.quizAnalyticsRepository.getCreatorAnalytics(userId);
  }

  async getQuizBySlug(slug: string): Promise<{
    row: QuizWithPublishedVersionRow;
    questions: QuizQuestionJoinRow[] | null;
    tags: QuizTagRow[];
  }> {
    const normalizedSlug = normalizeQuizSlug(slug);

    const row = await this.quizRepository.getQuizWithPublishedVersionBySlug(normalizedSlug);

    if (!row) {
      throw new QuizNotFoundError();
    }

    const tags = await this.quizRepository.getTagsForQuiz(row.quizId);

    if (!row.publishedVersionQuizVersionId) {
      return { row, questions: null, tags };
    }

    const questions = await this.quizQuestionRepository.getQuestionsByVersionId(
      row.publishedVersionQuizVersionId,
    );

    return { row, questions, tags };
  }
}
