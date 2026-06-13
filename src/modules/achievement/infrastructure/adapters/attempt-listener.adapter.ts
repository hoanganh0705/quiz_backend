/**
 * Attempt Event Listener Adapter
 *
 * Listens to Attempt domain events and triggers achievement evaluation.
 * This adapter bridges the Attempt domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type {
  AttemptCompletedEvent,
  QuizMilestoneEvent,
} from '@/modules/attempt/domain/events/attempt-domain.events';

@Injectable()
export class AchievementAttemptEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    @InjectPinoLogger(AchievementAttemptEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.attemptEventBus.subscribe((event: unknown) => {
      if (this.isAttemptCompletedEvent(event)) {
        this.handleAttemptCompleted(event);
      } else if (this.isQuizMilestoneEvent(event)) {
        this.handleQuizMilestone(event);
      }
    });

    this.logger.info({
      event: 'achievement_attempt_listener_subscribed',
    });
  }

  private isAttemptCompletedEvent(event: unknown): event is AttemptCompletedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'attempt.completed'
    );
  }

  private isQuizMilestoneEvent(event: unknown): event is QuizMilestoneEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'quiz.milestone'
    );
  }

  private async handleAttemptCompleted(event: AttemptCompletedEvent): Promise<void> {
    const correlationId = event.attemptId;

    try {
      const scorePercent = parseFloat(event.scorePercent);
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'attempt.completed',
        eventData: {
          attemptId: event.attemptId,
          quizId: event.quizId,
          scorePercent,
          correctCount: event.correctCount,
          totalQuestions: event.totalQuestions,
          xpEarned: event.xpEarned,
        },
      });

      this.logger.info({
        event: 'attempt_completed_evaluated',
        correlationId,
        userId: event.userId,
        attemptId: event.attemptId,
        quizId: event.quizId,
        scorePercent,
        badgesAwarded: results.filter((r) => r.awarded).length,
      });

      if (scorePercent === 100) {
        const perfectResults = await this.ruleEngineService.evaluateEvent({
          userId: event.userId,
          eventType: 'perfect_score',
          eventData: {
            perfectScores: 1,
            scorePercent,
          },
        });

        if (perfectResults.some((r) => r.awarded)) {
          this.logger.info({
            event: 'perfect_score_achieved',
            correlationId,
            userId: event.userId,
            attemptId: event.attemptId,
            results: perfectResults,
          });
        }
      }
    } catch (error) {
      this.logger.error({
        event: 'attempt_evaluation_failed',
        correlationId,
        userId: event.userId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleQuizMilestone(event: QuizMilestoneEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'quiz.milestone',
        eventData: {
          quizCount: event.completedCount,
          milestone: event.milestone,
        },
      });

      this.logger.info({
        event: 'quiz_milestone_evaluated',
        correlationId,
        userId: event.userId,
        quizCount: event.completedCount,
        milestone: event.milestone,
        badgesAwarded: results.filter((r) => r.awarded).length,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_milestone_evaluation_failed',
        correlationId,
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
