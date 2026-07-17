/**
 * Attempt Feed Listener
 *
 * Subscribes to AttemptDomainEventBus to record attempt and quiz milestone events
 * in the social feed, enabling users to see their friends' quiz activity.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type {
  AttemptCompletedEvent,
  QuizMilestoneEvent,
} from '@/modules/attempt/domain/events/attempt-domain.events';
import { SocialService } from '../../domain/services/social.service';

type AttemptFeedEvent = AttemptCompletedEvent | QuizMilestoneEvent;

@Injectable()
export class AttemptFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(AttemptFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.attemptEventBus.subscribe((event: unknown) => {
      void this.handleEvent(event as AttemptFeedEvent);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: AttemptFeedEvent): Promise<void> {
    switch (event.eventType) {
      case 'attempt.completed':
        await this.recordAttemptCompleted(event);
        break;
      case 'quiz.milestone':
        await this.recordQuizMilestone(event);
        break;
    }
  }

  private async recordAttemptCompleted(event: AttemptCompletedEvent): Promise<void> {
    try {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'quiz_completed',
        occurredAt: event.timestamp.toISOString(),
        payload: {
          attemptId: event.attemptId,
          quizId: event.quizId,
          scorePercent: event.scorePercent,
          correctCount: event.correctCount,
          totalQuestions: event.totalQuestions,
          xpEarned: event.xpEarned,
        },
      });

      this.logger.debug({
        event: 'attempt_feed_activity_recorded',
        userId: event.userId,
        attemptId: event.attemptId,
        quizId: event.quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'attempt_feed_activity_failed',
        userId: event.userId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async recordQuizMilestone(event: QuizMilestoneEvent): Promise<void> {
    try {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'quiz_milestone',
        occurredAt: event.timestamp.toISOString(),
        payload: {
          completedCount: event.completedCount,
          milestone: event.milestone,
        },
      });

      this.logger.debug({
        event: 'quiz_milestone_feed_activity_recorded',
        userId: event.userId,
        completedCount: event.completedCount,
        milestone: event.milestone,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_milestone_feed_activity_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
