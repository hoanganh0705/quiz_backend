import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ATTEMPT_REPOSITORY_PORT,
  type AttemptRepositoryPort,
} from './ports/attempt-repository.port';
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
} from '../attempt.constants';
import { MIN_QUESTIONS_TO_PUBLISH } from '@/modules/quiz/quiz.constants';
import { AttemptQueryService } from './attempt-query.service';
import { AttemptScoringService } from './attempt-scoring.service';
import { ATTEMPT_DOMAIN_EVENT_BUS } from './events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from './events/attempt-domain-event-bus.port';
import {
  AttemptStartedEvent,
  AttemptAnswerSubmittedEvent,
  AttemptAbandonedEvent,
  AttemptCompletedEvent,
  QuizMilestoneEvent,
} from './events/attempt-domain.events';
import { EXTERNAL_EVENT_BUS } from '@/common/events';
import type { CommonExternalEventBus } from '@/common/events/common-external-event-bus';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';

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
    private readonly attemptQueryService: AttemptQueryService,
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly eventBus: AttemptDomainEventBusPort,
    @Inject(EXTERNAL_EVENT_BUS)
    private readonly externalEventBus: CommonExternalEventBus,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getQuizWithPublishedVersionById: (quizId: string) => Promise<{
        publishedVersionId: string | null;
        title: string;
        slug: string;
      } | null>;
    },
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

    const questionCount = await this.attemptRepository.countQuestionsByVersionId(
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

    this.eventBus.emitAttemptStarted(
      new AttemptStartedEvent(
        attempt.attemptId,
        user.sub,
        quizId,
        quiz.publishedVersionId,
        contextType,
        contextRefId,
        nowIso,
      ),
    );

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

    const questionBelongs = await this.attemptRepository.checkQuestionBelongsToVersion(
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
          userId: user.sub,
        });
        throw new AttemptValidationError(ATTEMPT_OPTION_INVALID_MESSAGE);
      }
    }

    try {
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

      this.eventBus.emitAttemptAnswerSubmitted(
        new AttemptAnswerSubmittedEvent(
          attemptId,
          user.sub,
          questionId,
          selectedOptionId,
          nowIso,
        ),
      );

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

    if (attemptDetail.status !== 'started') {
      throw new AttemptNotActiveError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
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

    this.eventBus.emitAttemptAbandoned(
      new AttemptAbandonedEvent(attemptId, user.sub, attemptDetail.quizId, nowIso),
    );

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

    if (attemptDetail.status !== 'started') {
      throw new AttemptNotActiveError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
    }

    const scoringData = await this.attemptRepository.getAttemptAnswerScoringData(attemptId);

    const timeTakenMs = AttemptScoringService.calculateTimeTakenMs(
      attemptDetail.startedAt,
      nowIso,
    );
    const scorePercent = AttemptScoringService.calculateScorePercent(
      scoringData.correctCount,
      scoringData.totalAnswers,
    );
    const xpEarned = AttemptScoringService.calculateXpEarned(
      scorePercent,
      attemptDetail.passingScorePercent,
      attemptDetail.rewardXp,
    );

    const completed = await this.attemptRepository.completeAttemptAndSideEffects({
      attemptId,
      scorePercent,
      correctCount: scoringData.correctCount,
      timeTakenMs,
      xpEarned,
      nowIso,
      quizId: attemptDetail.quizId,
      userId: attemptDetail.userId,
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
      this.externalEventBus.publishXpEarned({
        eventType: 'external.xp.earned',
        userId: attemptDetail.userId,
        amount: xpEarned,
        source: 'quiz_attempt',
        attemptId,
        timestamp: new Date(nowIso),
      });

      this.logger.debug({
        event: 'external_xp_earned_published',
        userId: attemptDetail.userId,
        amount: xpEarned,
        attemptId,
      });
    }

    // Emit quiz.milestone event if the user crossed a milestone threshold
    const completedCount = await this.attemptRepository.countCompletedAttempts(attemptDetail.userId);
    const MILESTONE_THRESHOLDS = [10, 50, 100, 250, 500, 1000];
    const crossedMilestone = MILESTONE_THRESHOLDS.find((m) => completedCount === m);
    if (crossedMilestone !== undefined) {
      this.eventBus.emitQuizMilestone(
        new QuizMilestoneEvent(attemptDetail.userId, completedCount, crossedMilestone, nowIso),
      );

      this.logger.debug({
        event: 'quiz_milestone_event_emitted',
        userId: attemptDetail.userId,
        completedCount,
        milestone: crossedMilestone,
      });
    }

    return { ...completed, quizId: attemptDetail.quizId };
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

    await this.attemptRepository.deleteAnswer({
      attemptId,
      userId: attempt.userId,
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
