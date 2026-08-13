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
import { isUuid } from '@/common/pipes/parse-uuid-or-slug.pipe';
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
    return applyCursorPagination<
      QuizWithPublishedVersionRow,
      { createdAt: string; quizId: string }
    >(rows, limit, (row) => ({ createdAt: row.createdAt, quizId: row.quizId }));
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
    questions: QuizQuestionJoinRow[] | null;
    tags: QuizTagRow[];
  }> {
    const row = await this.quizRepository.getQuizWithPublishedVersionById(quizId);

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

  async getQuizStats(quizId: string | undefined, slug: string): Promise<QuizStats> {
    // Resolve the canonical quizId and slug once. The aggregate path
    // accepts either a UUID or a kebab-case slug at the `:id` route
    // param; the application service forwards `quizId` (the parsed
    // UUID, if any) alongside the original `slug` arg. When the input
    // is a UUID, looking it up via `getQuizBySlug` throws because the
    // value does not satisfy the slug pattern, which propagates as a
    // spurious 404 — even though `quizId` is already in hand.
    //
    // Resolution order:
    //   1. If `quizId` is given (parsed UUID), trust it directly.
    //   2. Otherwise, fall back to the slug lookup.
    const { resolvedQuizId } = await this.resolveQuizLookup(quizId, slug);

    const stats = await this.quizRepository.getQuizStats(resolvedQuizId);

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

  /**
   * Resolve a quiz lookup key to its canonical `quizId`.
   *
   * Accepts either a UUID (preferred when supplied) or a kebab-case
   * slug. Used by stats / stats-history / preview aggregations where
   * both forms can be presented at the route boundary.
   */
  private async resolveQuizLookup(
    quizId: string | undefined,
    slug: string,
  ): Promise<{ resolvedQuizId: string }> {
    if (quizId && isUuid(quizId)) {
      return { resolvedQuizId: quizId };
    }
    // Fall back to slug-based lookup. `normalizeQuizSlug` throws for
    // non-slug inputs (e.g. a raw UUID was passed without a quizId);
    // surface that as a not-found so callers see a stable 404 instead
    // of a 500.
    try {
      const result = await this.getQuizBySlug(slug);
      return { resolvedQuizId: result.row.quizId };
    } catch (err) {
      if (err instanceof QuizNotFoundError) throw err;
      throw new QuizNotFoundError();
    }
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
