import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuizAnalyticsService } from '../analytics/quiz-analytics.service';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';

/**
 * Bridges Attempt domain events into the Quiz domain.
 *
 * This handler subscribes to `AttemptCompletedEvent` published by the Attempt module
 * and triggers analytics refresh in the Quiz module. This inverts the dependency
 * compared to the previous design where `AttemptCommandService` directly injected
 * `AnalyticsEventHandler` from the Quiz module.
 *
 * Registered in `QuizModule.onModuleInit` via `QuizAttemptEventBootstrapService`.
 */
@Injectable()
export class QuizAttemptEventHandler implements OnModuleInit {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(QuizAttemptEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.attemptEventBus.subscribe(this.handleAttemptCompleted.bind(this));

    this.logger.info({
      event: 'quiz_attempt_event_handler_subscribed',
    });
  }

  private handleAttemptCompleted(event: unknown): void {
    if (!(event instanceof AttemptCompletedEvent)) return;

    void this.refreshAnalytics(event);
  }

  private async refreshAnalytics(event: AttemptCompletedEvent): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshQuizMetrics(event.quizId);

      this.logger.debug({
        event: 'analytics_attempt_completed',
        quizId: event.quizId,
        attemptId: event.attemptId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_attempt_completed_failed',
        quizId: event.quizId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
