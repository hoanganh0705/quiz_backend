import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  DiscussionThreadCreatedEvent,
  DiscussionThreadSolvedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { SocialService } from '../../domain/services/social.service';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';

@Injectable()
export class DiscussionFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(DISCUSSION_DOMAIN_EVENT_BUS)
    private readonly discussionEventBus: DiscussionDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(DiscussionFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.discussionEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: DiscussionDomainEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    if (event.eventType === 'comment_created') {
      await this.recordCommentCreated(event, correlationId);
      return;
    }

    if (event.eventType === 'discussion_thread_created') {
      await this.recordThreadCreated(event, correlationId);
      return;
    }

    if (event.eventType === 'discussion_thread_solved') {
      await this.recordThreadSolved(event, correlationId);
    }
  }

  private async recordCommentCreated(
    event: CommentCreatedEvent,
    correlationId: string,
  ): Promise<void> {
    this.logger.debug({
      event: 'social_feed_comment_created',
      correlationId,
      authorId: event.authorId,
      threadId: event.threadId,
    });

    await this.socialService.recordFeedActivity({
      userId: event.authorId,
      activityType: 'comment_created',
      occurredAt: event.timestamp.toISOString(),
      payload: {
        threadId: event.threadId,
        commentId: event.commentId,
      },
    });
  }

  private async recordThreadCreated(
    event: DiscussionThreadCreatedEvent,
    correlationId: string,
  ): Promise<void> {
    this.logger.debug({
      event: 'social_feed_thread_created',
      correlationId,
      authorId: event.authorId,
      threadId: event.threadId,
    });

    await this.socialService.recordFeedActivity({
      userId: event.authorId,
      activityType: 'discussion_created',
      occurredAt: event.timestamp.toISOString(),
      payload: {
        threadId: event.threadId,
        quizId: event.quizId,
        title: event.title,
      },
    });
  }

  private async recordThreadSolved(
    event: DiscussionThreadSolvedEvent,
    correlationId: string,
  ): Promise<void> {
    this.logger.debug({
      event: 'social_feed_thread_solved',
      correlationId,
      authorId: event.authorId,
      threadId: event.threadId,
    });

    await this.socialService.recordFeedActivity({
      userId: event.authorId,
      activityType: 'discussion_solved',
      occurredAt: event.timestamp.toISOString(),
      payload: {
        threadId: event.threadId,
        commentId: event.commentId,
        solverId: event.solverId,
      },
    });
  }
}
