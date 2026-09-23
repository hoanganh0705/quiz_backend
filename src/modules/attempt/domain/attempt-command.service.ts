import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ATTEMPT_REPOSITORY_PORT,
  type AttemptRepositoryPort,
} from './ports/attempt-repository.port';
import {
  ATTEMPT_ANSWER_REPOSITORY_PORT,
  type AttemptAnswerRepositoryPort,
} from './ports/attempt-answer-repository.port';
import type { AttemptContextType } from '../types/attempt.types';
import {
  AttemptNotFoundError,
  AttemptForbiddenError,
  AttemptNotActiveError,
  AttemptQuestionAlreadyAnsweredError,
  AttemptAlreadyStartedError,
  AttemptValidationError,
  QuizNotPublishedError,
  AttemptQuestionInvalidError,
  AttemptAnswerNotFoundError,
} from './errors';
import {
  QUIZ_NOT_PUBLISHED_MESSAGE,
  ATTEMPT_ALREADY_STARTED_MESSAGE,
  ATTEMPT_NOT_FOUND_MESSAGE,
  ATTEMPT_FORBIDDEN_MESSAGE,
  ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE,
  ATTEMPT_QUESTION_ALREADY_ANSWERED_MESSAGE,
  ATTEMPT_OPTION_INVALID_MESSAGE,
  ATTEMPT_QUESTION_INVALID_MESSAGE,
  ATTEMPT_ANSWER_NOT_FOUND_MESSAGE,
  QUIZ_COMPLETION_MILESTONES,
} from '../attempt.constants';
import { MIN_QUESTIONS_TO_PUBLISH } from '@/modules/quiz/quiz.constants';
import { AttemptQueryService } from './attempt-query.service';
import { AttemptScoringService } from './attempt-scoring.service';
import { assertAttemptTransition } from './attempt-transitions';
import { ATTEMPT_DOMAIN_EVENT_BUS } from './events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from './events/attempt-domain-event-bus.port';
import { AttemptCompletedEvent, QuizMilestoneEvent } from './events/attempt-domain.events';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { createCorrelationId } from '@/common/interceptors/correlation-id';
import { ReferentialValidatorService } from '@/common/database/referential-validator.service';
import { type QuizAttemptContextReference } from '@/common/database/references.types';

/**
 * AttemptCommandService — Mutation operations for the Attempt aggregate.
 *
 * Responsibilities:
 *  - Start, abandon, complete attempts
 *  - Submit answers
 *  - Enforce business rules and authorization
 *  - Coordinate transactional side effects
 */
@Injectable()
export class AttemptCommandService {
  constructor(
    @Inject(ATTEMPT_REPOSITORY_PORT)
    private readonly attemptRepository: AttemptRepositoryPort,
    @Inject(ATTEMPT_ANSWER_REPOSITORY_PORT)
    private readonly attemptAnswerRepository: AttemptAnswerRepositoryPort,
    private readonly attemptQueryService: AttemptQueryService,
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly eventBus: AttemptDomainEventBusPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getQuizWithPublishedVersionById: (quizId: string) => Promise<{
        publishedVersionId: string | null;
        title: string;
        slug: string;
      } | null>;
    },
    private readonly referentialValidator: ReferentialValidatorService,
    @InjectPinoLogger(AttemptCommandService.name)
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

    const questionCount = await this.attemptAnswerRepository.countQuestionsByVersionId(
      quiz.publishedVersionId,
    );
    if (questionCount < MIN_QUESTIONS_TO_PUBLISH) {
      this.logger.error({
        event: 'attempt_start_insufficient_questions',
        quizId,
        quizVersionId: quiz.publishedVersionId,
        questionCount,
        required: MIN_QUESTIONS_TO_PUBLISH,
        userId: user.sub,
        message:
          'Published quiz version has fewer questions than the publish-time minimum. Investigate publish validation.',
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

    const referenceEntity = mapAttemptContextReference(contextType, contextRefId);
    if (referenceEntity) {
      await this.referentialValidator.assertExists(referenceEntity);
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
      throw new AttemptNotActiveError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
    }

    const questionBelongs = await this.attemptAnswerRepository.checkQuestionBelongsToVersion(
      questionId,
      attempt.quizVersionId,
    );
    if (!questionBelongs) {
      this.logger.warn({
        event: 'attempt_submit_invalid_question',
        attemptId,
        questionId,
        quizVersionId: attempt.quizVersionId,
        userId: user.sub,
      });
      throw new AttemptQuestionInvalidError(ATTEMPT_QUESTION_INVALID_MESSAGE);
    }

    if (selectedOptionId) {
      const belongs = await this.attemptAnswerRepository.checkAnswerOptionBelongsToQuestion(
        questionId,
        selectedOptionId,
      );
      if (!belongs) {
        this.logger.warn({
          event: 'attempt_submit_invalid_option',
          attemptId,
          questionId,
          selectedOptionId,
          userId: user.sub,
        });
        throw new AttemptValidationError(ATTEMPT_OPTION_INVALID_MESSAGE);
      }
    }

    try {
      const answer = await this.attemptAnswerRepository.submitAnswer({
        attemptId,
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
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        this.logger.warn({
          event: 'attempt_submit_duplicate_question',
          attemptId,
          questionId,
          userId: user.sub,
        });
        throw new AttemptQuestionAlreadyAnsweredError(ATTEMPT_QUESTION_ALREADY_ANSWERED_MESSAGE);
      }
      throw error;
    }
  }

  async abandonAttempt(attemptId: string, user: JwtPayload) {
    const nowIso = new Date().toISOString();

    const attemptDetail = await this.attemptRepository.getAttemptDetailById(attemptId);

    if (!attemptDetail) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attemptDetail.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    assertAttemptTransition(attemptDetail.status, 'abandoned');

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

  async completeAttempt(attemptId: string, user: JwtPayload) {
    const nowIso = new Date().toISOString();

    const attemptDetail = await this.attemptRepository.getAttemptDetailById(attemptId);

    if (!attemptDetail) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attemptDetail.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    assertAttemptTransition(attemptDetail.status, 'completed');

    const scoringData = await this.attemptAnswerRepository.getAttemptAnswerScoringData(attemptId);

    const timeTakenMs = AttemptScoringService.calculateTimeTakenMs(attemptDetail.startedAt, nowIso);
    const scorePercent = AttemptScoringService.calculateScorePercent(
      scoringData.correctCount,
      scoringData.totalAnswers,
    );
    const xpEarned = AttemptScoringService.calculateXpEarned(
      scorePercent,
      attemptDetail.passingScorePercent,
      attemptDetail.rewardXp,
    );

    const xpIdempotencyKey = `xp:${attemptDetail.userId}:attempt:${attemptId}`;

    const { completed, preCompletionCount } =
      await this.attemptRepository.completeAttemptAndSideEffects({
        attemptId,
        scorePercent,
        correctCount: scoringData.correctCount,
        timeTakenMs,
        xpEarned,
        nowIso,
        quizId: attemptDetail.quizId,
        userId: attemptDetail.userId,
        xpOutbox:
          xpEarned > 0
            ? { idempotencyKey: xpIdempotencyKey, correlationId: createCorrelationId() }
            : undefined,
      });

    this.logger.info({
      event: 'attempt_completed',
      attemptId,
      userId: attemptDetail.userId,
      quizId: attemptDetail.quizId,
      correctCount: scoringData.correctCount,
      totalQuestions: scoringData.totalAnswers,
      scorePercent,
      xpEarned,
      passed: xpEarned > 0,
    });

    this.eventBus.emitAttemptCompleted(
      new AttemptCompletedEvent(
        attemptId,
        attemptDetail.userId,
        attemptDetail.quizId,
        attemptDetail.quizVersionId,
        scorePercent,
        scoringData.correctCount,
        scoringData.totalAnswers,
        timeTakenMs,
        xpEarned,
        nowIso,
      ),
    );

    if (xpEarned > 0) {
      this.logger.debug({
        event: 'external_xp_earned_outboxed',
        userId: attemptDetail.userId,
        amount: xpEarned,
        attemptId,
        idempotencyKey: xpIdempotencyKey,
      });
    }

    // Derive milestone crossing from the pre-completion count returned inside
    // the same transaction as the attempt completion. This avoids a race where
    // a concurrent completion could increment the count between the commit and
    // a separate count query.
    const newCompletedCount = preCompletionCount + 1;
    const crossedMilestone = QUIZ_COMPLETION_MILESTONES.find((m) => newCompletedCount === m);
    if (crossedMilestone !== undefined) {
      this.eventBus.emitQuizMilestone(
        new QuizMilestoneEvent(attemptDetail.userId, newCompletedCount, crossedMilestone, nowIso),
      );

      this.logger.debug({
        event: 'quiz_milestone_event_emitted',
        userId: attemptDetail.userId,
        completedCount: newCompletedCount,
        milestone: crossedMilestone,
      });
    }

    return { completed: { ...completed, quizId: attemptDetail.quizId }, preCompletionCount };
  }

  /**
   * Withdraws a previously submitted answer from an active attempt.
   * Allows users to skip a question or change their answer.
   */
  async withdrawAnswer(attemptId: string, questionId: string, user: JwtPayload) {
    const attempt = await this.attemptRepository.getAttemptById(attemptId);

    if (!attempt) {
      throw new AttemptNotFoundError(ATTEMPT_NOT_FOUND_MESSAGE);
    }

    if (attempt.userId !== user.sub && user.role !== 'admin') {
      throw new AttemptForbiddenError(ATTEMPT_FORBIDDEN_MESSAGE);
    }

    if (attempt.status !== 'started') {
      throw new AttemptNotActiveError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
    }

    const existingAnswer = await this.attemptAnswerRepository.getAnswerByAttemptAndQuestion(
      attemptId,
      questionId,
    );

    if (!existingAnswer) {
      throw new AttemptAnswerNotFoundError(ATTEMPT_ANSWER_NOT_FOUND_MESSAGE);
    }

    await this.attemptAnswerRepository.deleteAnswer({
      attemptId,
      questionId,
    });

    this.logger.info({
      event: 'answer_withdrawn',
      attemptId,
      questionId,
      userId: attempt.userId,
    });
  }
}

function mapAttemptContextReference(
  contextType: AttemptContextType,
  contextRefId: string | null,
): QuizAttemptContextReference | null {
  if (!contextRefId) return null;
  switch (contextType) {
    case 'tournament':
      return { kind: 'tournament', id: contextRefId };
    case 'solo':
      return null;
  }
}
