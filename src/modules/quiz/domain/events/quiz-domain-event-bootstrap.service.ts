import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QUIZ_DOMAIN_EVENT_BUS, type QuizEventHandler } from '../ports/quiz-domain-event-bus.port';
import type { QuizDomainEventBusPort } from '../ports/quiz-domain-event-bus.port';
import { QuizAnalyticsService } from '../analytics/quiz-analytics.service';
import {
  QuizCreatedEvent,
  QuizUpdatedEvent,
  QuizDeletedEvent,
  QuizVersionCreatedEvent,
  QuizVersionPublishedEvent,
} from './quiz-domain.events';

/**
 * Bootstraps in-process event subscriptions between the quiz domain event bus
 * and downstream handlers.
 *
 * All subscriptions are registered once in `onModuleInit`. Handlers run
 * synchronously within the same request lifecycle — keep them fast and
 * fault-tolerant (errors are caught and logged by QuizDomainEventBus).
 */
@Injectable()
export class QuizDomainEventBootstrapService implements OnModuleInit {
  constructor(
    @Inject(QUIZ_DOMAIN_EVENT_BUS) private readonly eventBus: QuizDomainEventBusPort,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(QuizDomainEventBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  private readonly unsubscribers: Array<() => void> = [];

  onModuleInit(): void {
    this.subscribe(this.handleQuizCreated.bind(this));
    this.subscribe(this.handleQuizUpdated.bind(this));
    this.subscribe(this.handleQuizDeleted.bind(this));
    this.subscribe(this.handleQuizVersionCreated.bind(this));
    this.subscribe(this.handleQuizVersionPublished.bind(this));

    this.logger.info({ event: 'quiz_event_subscriptions_initialized' });
  }

  private subscribe(handler: QuizEventHandler): void {
    this.unsubscribers.push(this.eventBus.subscribe(handler));
  }

  private handleQuizCreated(event: unknown): void {
    if (!(event instanceof QuizCreatedEvent)) {
      return;
    }

    void this.runAnalyticsRefresh('quiz_created_received', event.quizId, [
      () => this.quizAnalyticsService.refreshQuizMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshReviewMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshBookmarkMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshTrendingScore(event.quizId),
      () => this.quizAnalyticsService.refreshPopularityScore(event.quizId),
    ]);
  }

  private handleQuizUpdated(event: unknown): void {
    if (!(event instanceof QuizUpdatedEvent)) {
      return;
    }

    void this.runAnalyticsRefresh('quiz_updated_received', event.quizId, [
      () => this.quizAnalyticsService.refreshTrendingScore(event.quizId),
      () => this.quizAnalyticsService.refreshPopularityScore(event.quizId),
    ]);
  }

  private handleQuizDeleted(event: unknown): void {
    if (!(event instanceof QuizDeletedEvent)) {
      return;
    }

    void this.quizAnalyticsService.invalidateQuizMetrics(event.quizId);

    this.logger.info({
      event: 'quiz_deleted_analytics_invalidated',
      quizId: event.quizId,
      deletedBy: event.deletedByUserId,
    });
  }

  private handleQuizVersionCreated(event: unknown): void {
    if (!(event instanceof QuizVersionCreatedEvent)) {
      return;
    }

    void this.runAnalyticsRefresh('quiz_version_created_received', event.quizId, [
      () => this.quizAnalyticsService.refreshTrendingScore(event.quizId),
      () => this.quizAnalyticsService.refreshPopularityScore(event.quizId),
    ]);
  }

  private handleQuizVersionPublished(event: unknown): void {
    if (!(event instanceof QuizVersionPublishedEvent)) {
      return;
    }

    void this.runAnalyticsRefresh('quiz_version_published_received', event.quizId, [
      () => this.quizAnalyticsService.refreshQuizMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshReviewMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshBookmarkMetrics(event.quizId),
      () => this.quizAnalyticsService.refreshTrendingScore(event.quizId),
      () => this.quizAnalyticsService.refreshPopularityScore(event.quizId),
    ]);
  }

  private async runAnalyticsRefresh(
    eventName: string,
    quizId: string,
    tasks: Array<() => Promise<void>>,
  ): Promise<void> {
    this.logger.debug({ event: eventName, quizId });
    await Promise.all(tasks.map((task) => task()));
  }
}
