import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  COMMENT_DOMAIN_EVENT_BUS,
  type CommentDomainEventBusPort,
} from '@/modules/comment/domain/events/comment-event-bus.port';
import type { CommentDomainEvent } from '@/modules/comment/domain/events/comment.events';
import { QUIZ_ANALYTICS_PORT, type QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';

@Injectable()
export class QuizCommentCountUpdater implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => COMMENT_DOMAIN_EVENT_BUS))
    private readonly commentEventBus: CommentDomainEventBusPort,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalytics: QuizAnalyticsPort,
    @InjectPinoLogger(QuizCommentCountUpdater.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.commentEventBus.subscribe((event: CommentDomainEvent) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: CommentDomainEvent): Promise<void> {
    const quizId = this.extractQuizId(event);
    if (quizId === null) {
      return;
    }

    try {
      await this.quizAnalytics.invalidateQuizMetrics(quizId);
      this.logger.debug({
        event: 'quiz_comment_event_invalidated_metrics',
        eventType: event.eventType,
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_comment_event_invalidation_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private extractQuizId(event: CommentDomainEvent): string | null {
    const candidate = (event as { quizId?: unknown }).quizId;
    return typeof candidate === 'string' ? candidate : null;
  }
}
