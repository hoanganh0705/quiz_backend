import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type {
  AttemptListCursorPayload,
  AttemptListSortField,
} from '../mappers/attempt-cursor.mapper';
import {
  ATTEMPT_REPOSITORY_PORT,
  type AttemptRepositoryPort,
} from './ports/attempt-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { AttemptNotFoundError, AttemptForbiddenError, AttemptNotCompletedError } from './errors';
import {
  ATTEMPT_NOT_FOUND_MESSAGE,
  ATTEMPT_FORBIDDEN_MESSAGE,
  ATTEMPT_NOT_COMPLETED_MESSAGE,
} from '../attempt.constants';

/**
 * AttemptQueryService — Read operations for the Attempt aggregate.
 *
 * Responsibilities:
 *  - Fetch attempt records by ID
 *  - List attempts for a user (paginated)
 *  - Fetch answers for an attempt
 */
@Injectable()
export class AttemptQueryService {
  constructor(
    @Inject(ATTEMPT_REPOSITORY_PORT)
    private readonly attemptRepository: AttemptRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getQuizWithPublishedVersionById: (quizId: string) => Promise<{
        publishedVersionId: string | null;
        title: string;
        slug: string;
      } | null>;
    },
    @InjectPinoLogger(AttemptQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getAttemptById(attemptId: string, user: JwtPayload) {
    const attempt = await this.attemptRepository.getAttemptDetailById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    return attempt;
  }

  async listMyAttempts(
    user: JwtPayload,
    params: {
      limit: number;
      cursor?: AttemptListCursorPayload | null;
      status?: 'started' | 'completed' | 'abandoned';
      quizId?: string;
      categoryId?: string;
      tagId?: string;
      fromDate?: string;
      toDate?: string;
      sortBy: AttemptListSortField;
    },
  ) {
    const rows = await this.attemptRepository.listAttemptsByUser({
      userId: user.sub,
      limit: params.limit,
      cursor: params.cursor,
      status: params.status,
      quizId: params.quizId,
      categoryId: params.categoryId,
      tagId: params.tagId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      sortBy: params.sortBy,
    });

    return rows;
  }

  async getAnswersByAttemptId(attemptId: string) {
    return this.attemptRepository.getAttemptAnswersByAttemptId(attemptId);
  }

  /**
   * Returns all submitted answers for an attempt after verifying:
   *  1. The attempt exists.
   *  2. The caller owns the attempt (or is an admin).
   */
  async getAttemptAnswers(attemptId: string, user: JwtPayload) {
    const attempt = await this.attemptRepository.getAttemptById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    const answers = await this.attemptRepository.getAttemptAnswersByAttemptId(attemptId);

    return { attempt, answers };
  }

  /**
   * Returns analytics for a completed attempt after verifying:
   *  1. The attempt exists (as a base row — lightweight, no JOINs).
   *  2. The caller owns the attempt (or is an admin).
   *  3. The attempt status is 'completed'.
   *
   * Returns the analytics aggregation row alongside the answer count needed
   * by the mapper to derive `incorrectAnswers` and `unansweredQuestions`.
   */
  async getAttemptAnalytics(attemptId: string, user: JwtPayload) {
    const attempt = await this.attemptRepository.getAttemptById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    if (attempt.status !== 'completed') {
      throw new AttemptNotCompletedError(ATTEMPT_NOT_COMPLETED_MESSAGE);
    }

    const [analyticsRow, answers] = await Promise.all([
      this.attemptRepository.getAttemptAnalytics(attemptId),
      this.attemptRepository.getAttemptAnswersByAttemptId(attemptId),
    ]);

    // analyticsRow should always be present for a completed attempt, but guard defensively.
    if (!analyticsRow) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    return { analyticsRow, answeredCount: answers.length };
  }

  /**
   * Returns aggregated attempt statistics for the given user.
   *
   * No ownership guard needed — callers always pass `user.sub` (their own ID).
   * Delegates entirely to the repository aggregation query; no business logic here.
   */
  async getUserAttemptStats(userId: string) {
    return this.attemptRepository.getUserAttemptStats(userId);
  }

  async checkQuizPublishStatus(quizId: string) {
    return this.quizRepository.getQuizWithPublishedVersionById(quizId);
  }
}
