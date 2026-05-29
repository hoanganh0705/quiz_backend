import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ATTEMPT_REPOSITORY_PORT,
  type AttemptRepositoryPort,
} from './ports/attempt-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { AttemptNotFoundError, AttemptForbiddenError } from './errors';
import { ATTEMPT_NOT_FOUND_MESSAGE, ATTEMPT_FORBIDDEN_MESSAGE } from '../attempt.constants';

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
    limit: number,
    cursor?: { startedAt: string; attemptId: string } | null,
  ) {
    const rows = await this.attemptRepository.listAttemptsByUser({
      userId: user.sub,
      limit,
      cursor,
    });

    return rows;
  }

  async getAnswersByAttemptId(attemptId: string) {
    return this.attemptRepository.getAttemptAnswersByAttemptId(attemptId);
  }

  async checkQuizPublishStatus(quizId: string) {
    return this.quizRepository.getQuizWithPublishedVersionById(quizId);
  }
}
