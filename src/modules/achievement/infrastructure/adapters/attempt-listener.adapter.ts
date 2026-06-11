/**
 * Attempt Event Listener Adapter
 *
 * Listens to Attempt domain events and triggers achievement evaluation.
 * This adapter bridges the Attempt domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptCompletedEvent as AttemptDomainCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';

export interface AttemptCompletedEvent {
  readonly eventType: 'attempt.completed';
  readonly userId: string;
  readonly attemptId: string;
  readonly quizId: string;
  readonly scorePercent: number;
  readonly correctCount: number;
  readonly totalQuestions: number;
  readonly timeTakenMs: number;
  readonly xpEarned: number;
  readonly timestamp: Date;
}

export interface PerfectScoreEvent {
  readonly eventType: 'perfect_score';
  readonly userId: string;
  readonly attemptId: string;
  readonly quizId: string;
  readonly scorePercent: number;
  readonly timestamp: Date;
}

export interface QuizMilestoneEvent {
  readonly eventType: 'quiz.milestone';
  readonly userId: string;
  readonly quizCount: number;
  readonly milestone: number;
  readonly timestamp: Date;
}

export type AttemptDomainEvent = AttemptCompletedEvent | PerfectScoreEvent | QuizMilestoneEvent;

@Injectable()
export class AttemptEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    @InjectPinoLogger(AttemptEventListenerAdapter.name)
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
      // Route based on event type discriminator
      if (this.isAttemptCompletedEvent(event)) {
        this.handleAttemptCompletedFromBus(event);
      } else if (this.isQuizMilestoneEvent(event)) {
        this.handleQuizMilestoneFromBus(event);
      }
    });

    this.logger.info({
      event: 'achievement_attempt_listener_subscribed',
    });
  }

  private isAttemptCompletedEvent(
    event: unknown,
  ): event is AttemptDomainCompletedEvent & { eventType: 'attempt.completed'; timestamp: Date } {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'attempt.completed' &&
      'timestamp' in event &&
      (event as { timestamp: unknown }).timestamp instanceof Date
    );
  }

  private isQuizMilestoneEvent(event: unknown): event is {
    eventType: 'quiz.milestone';
    userId: string;
    completedCount: number;
    milestone: number;
    timestamp: Date;
  } {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'quiz.milestone'
    );
  }

  private async handleQuizMilestoneFromBus(event: {
    eventType: 'quiz.milestone';
    userId: string;
    completedCount: number;
    milestone: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.handleQuizMilestone({
        eventType: 'quiz.milestone',
        userId: event.userId,
        quizCount: event.completedCount,
        milestone: event.milestone,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_milestone_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleAttemptCompletedFromBus(event: AttemptDomainCompletedEvent): Promise<void> {
    try {
      await this.handleAttemptCompleted({
        eventType: 'attempt.completed',
        userId: event.userId,
        attemptId: event.attemptId,
        quizId: event.quizId,
        scorePercent: parseFloat(String(event.scorePercent)),
        correctCount: event.correctCount,
        totalQuestions: event.totalQuestions,
        timeTakenMs: event.timeTakenMs,
        xpEarned: event.xpEarned,
        timestamp: new Date(event.timestamp),
      });
    } catch (error) {
      this.logger.error({
        event: 'attempt_evaluation_failed',
        userId: event.userId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle attempt completed event from external sources.
   * This method can be called by external event buses or directly.
   */
  async handleAttemptCompleted(event: AttemptCompletedEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'attempt.completed',
        eventData: {
          attemptId: event.attemptId,
          quizId: event.quizId,
          scorePercent: event.scorePercent,
          correctCount: event.correctCount,
          totalQuestions: event.totalQuestions,
          xpEarned: event.xpEarned,
        },
      });

      this.logger.info({
        event: 'attempt_completed_evaluated',
        userId: event.userId,
        attemptId: event.attemptId,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });

      // Handle perfect score
      if (event.scorePercent === 100) {
        await this.handlePerfectScore({
          eventType: 'perfect_score',
          userId: event.userId,
          attemptId: event.attemptId,
          quizId: event.quizId,
          scorePercent: event.scorePercent,
          timestamp: event.timestamp,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'attempt_evaluation_failed',
        userId: event.userId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle perfect score achievement.
   */
  private async handlePerfectScore(event: PerfectScoreEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'perfect_score',
        eventData: {
          perfectScores: 1,
          scorePercent: event.scorePercent,
        },
      });

      if (results.some((r) => r.awarded)) {
        this.logger.info({
          event: 'perfect_score_achieved',
          userId: event.userId,
          attemptId: event.attemptId,
          results,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'perfect_score_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle quiz milestone (e.g., completed 10, 50, 100 quizzes).
   */
  async handleQuizMilestone(event: QuizMilestoneEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'quiz.milestone',
        eventData: {
          quizCount: event.quizCount,
          milestone: event.milestone,
        },
      });

      this.logger.info({
        event: 'quiz_milestone_evaluated',
        userId: event.userId,
        quizCount: event.quizCount,
        milestone: event.milestone,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_milestone_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
