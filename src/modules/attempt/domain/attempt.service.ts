import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ATTEMPT_REPOSITORY_PORT,
  type AttemptRepositoryPort,
} from './ports/attempt-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { AttemptContextType } from '../types/attempt.types';
import {
  AttemptNotFoundError,
  AttemptForbiddenError,
  AttemptAlreadyStartedError,
  AttemptAlreadyFinishedError,
  QuizNotPublishedError,
} from './errors';
import {
  QUIZ_NOT_PUBLISHED_MESSAGE,
  ATTEMPT_ALREADY_STARTED_MESSAGE,
  ATTEMPT_ALREADY_FINISHED_MESSAGE,
  ATTEMPT_NOT_FOUND_MESSAGE,
  ATTEMPT_FORBIDDEN_MESSAGE,
  ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE,
  ATTEMPT_QUESTION_ALREADY_ANSWERED_MESSAGE,
  ATTEMPT_OPTION_INVALID_MESSAGE,
} from '../attempt.constants';

@Injectable()
export class AttemptService {
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
    @InjectPinoLogger(AttemptService.name)
    private readonly logger: PinoLogger,
  ) {}

  async startAttempt(
    quizId: string,
    user: JwtPayload,
    contextType: AttemptContextType = 'solo',
    contextRefId: string | null = null,
  ) {
    const nowIso = new Date().toISOString();

    const quiz = await this.quizRepository.getQuizWithPublishedVersionById(quizId);
    if (!quiz || !quiz.publishedVersionId) {
      this.logger.warn({
        event: 'attempt_start_quiz_not_published',
        quizId,
        userId: user.sub,
      });
      throw new QuizNotPublishedError(QUIZ_NOT_PUBLISHED_MESSAGE);
    }

    const existingActiveAttempt = await this.attemptRepository.getActiveAttemptByUserAndVersion(
      user.sub,
      quiz.publishedVersionId,
    );

    if (existingActiveAttempt) {
      this.logger.warn({
        event: 'attempt_start_duplicate_active',
        userId: user.sub,
        quizId,
        quizVersionId: quiz.publishedVersionId,
        existingAttemptId: existingActiveAttempt.attemptId,
      });
      throw new AttemptAlreadyStartedError(ATTEMPT_ALREADY_STARTED_MESSAGE);
    }

    const attempt = await this.attemptRepository.createAttempt({
      userId: user.sub,
      quizVersionId: quiz.publishedVersionId,
      contextType,
      contextRefId,
      nowIso,
    });

    this.logger.info({
      event: 'attempt_started',
      attemptId: attempt.attemptId,
      userId: user.sub,
      quizId,
      quizVersionId: quiz.publishedVersionId,
    });

    return attempt;
  }

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

  async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionId: string | null,
    user: JwtPayload,
    timeTakenMs?: number | null,
  ) {
    const nowIso = new Date().toISOString();

    const attempt = await this.attemptRepository.getAttemptById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    if (attempt.status !== 'started') {
      throw new AttemptAlreadyFinishedError(ATTEMPT_ALREADY_FINISHED_MESSAGE);
    }

    if (selectedOptionId) {
      const belongs = await this.attemptRepository.checkAnswerOptionBelongsToQuestion(
        questionId,
        selectedOptionId,
      );
      if (!belongs) {
        this.logger.warn({
          event: 'attempt_submit_invalid_option',
          attemptId,
          questionId,
          selectedOptionId,
        });
        throw new AttemptAlreadyFinishedError(ATTEMPT_OPTION_INVALID_MESSAGE);
      }
    }

    const alreadyAnswered = await this.attemptRepository.checkAnswerExists(attemptId, questionId);
    if (alreadyAnswered) {
      this.logger.warn({
        event: 'attempt_submit_duplicate_question',
        attemptId,
        questionId,
      });
      throw new AttemptAlreadyFinishedError(ATTEMPT_QUESTION_ALREADY_ANSWERED_MESSAGE);
    }

    const answer = await this.attemptRepository.submitAnswer({
      attemptId,
      userId: user.sub,
      questionId,
      selectedOptionId,
      nowIso,
      timeTakenMs,
    });

    this.logger.info({
      event: 'attempt_answer_submitted',
      attemptId,
      questionId,
      selectedOptionId,
      answeredAt: answer.answeredAt,
    });

    return answer;
  }

  async abandonAttempt(attemptId: string, user: JwtPayload) {
    const nowIso = new Date().toISOString();

    const attempt = await this.attemptRepository.getAttemptById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    if (attempt.status !== 'started') {
      throw new AttemptAlreadyFinishedError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
    }

    const abandoned = await this.attemptRepository.abandonAttempt({
      attemptId,
      userId: user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'attempt_abandoned',
      attemptId,
      userId: user.sub,
    });

    return abandoned;
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
}
