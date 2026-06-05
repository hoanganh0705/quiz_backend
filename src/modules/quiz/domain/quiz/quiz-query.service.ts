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
import { QUIZ_ANALYTICS_REPOSITORY_PORT, type QuizAnalyticsRepositoryPort } from '../analytics/ports';
import type { CreatorAnalytics } from '../analytics/types';
import type { QuizRecordRow } from '../ports/quiz-repository.port';
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
    @Inject(QUIZ_RECOMMENDATION_REPOSITORY_PORT)
    private readonly recommendationRepository: QuizRecommendationRepositoryPort,
    @Inject(QUIZ_ANALYTICS_REPOSITORY_PORT)
    private readonly quizAnalyticsRepository: QuizAnalyticsRepositoryPort,
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

  async getQuizStats(quizId: string): Promise<QuizStats> {
    await this.getQuizById(quizId);

    const stats = await this.quizRepository.getQuizStats(quizId);

    return {
      quizId,
      totalAttempts: Number(stats?.totalAttempts ?? 0),
      totalPlayers: Number(stats?.totalPlayers ?? 0),
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
    const relatedQuizzes = await this.quizRepository.findRelatedQuizzes({
      slug: normalizedSlug,
      limit: query.limit,
    });

    if (relatedQuizzes.length === 0) {
      await this.getQuizBySlug(normalizedSlug);
    }

    return relatedQuizzes;
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

  async listUserQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
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

  async listDraftQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listDraftsByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
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

  async listPublishedQuizzes(userId: string, query: ListQuizzesQuery): Promise<ListQuizzesResult> {
    const rows = await this.quizRepository.listPublishedByCreatorId({
      creatorId: userId,
      limit: query.limit,
      cursor: query.cursor,
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

  async getCreatorAnalytics(userId: string): Promise<CreatorAnalytics> {
    return this.quizAnalyticsRepository.getCreatorAnalytics(userId);
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
