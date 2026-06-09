import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  DiscussionThreadSolvedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { DiscussionNotificationService } from '../../domain/services/discussion-notification.service';

@Injectable()
export class DiscussionListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(DISCUSSION_DOMAIN_EVENT_BUS)
    private readonly discussionEventBus: DiscussionDomainEventBusPort,
    private readonly discussionNotificationService: DiscussionNotificationService,
    @InjectPinoLogger(DiscussionListenerAdapter.name)
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
    switch (event.eventType) {
      case 'comment_created':
        await this.handleCommentCreated(event);
        break;
      case 'discussion_thread_solved':
        await this.handleThreadSolved(event);
        break;
      default:
        this.logger.debug({
          event: 'unhandled_discussion_notification_event',
          eventType: event.eventType,
        });
    }
  }

  async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    try {
      await this.discussionNotificationService.notifyCommentCreated(event);
    } catch (error) {
      this.logger.error({
        event: 'discussion_reply_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadSolved(event: DiscussionThreadSolvedEvent): Promise<void> {
    try {
      await this.discussionNotificationService.notifyThreadSolved(event);
    } catch (error) {
      this.logger.error({
        event: 'discussion_solved_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
