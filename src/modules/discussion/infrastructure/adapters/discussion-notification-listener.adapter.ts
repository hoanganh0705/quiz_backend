/**
 * Discussion Notification Listener
 *
 * Subscribes to Discussion domain events and dispatches notifications.
 * Hosted in DiscussionModule to avoid cross-module import cycles.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '../../domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  DiscussionThreadSolvedEvent,
} from '../../domain/events/discussion-domain.events';
import { NOTIFICATION_CHANNEL_SERVICE } from '@/modules/notification/domain/ports';
import type { NotificationChannelServicePort } from '@/modules/notification/domain/ports';

@Injectable()
export class DiscussionNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(DISCUSSION_DOMAIN_EVENT_BUS)
    private readonly discussionEventBus: DiscussionDomainEventBusPort,
    @Inject(NOTIFICATION_CHANNEL_SERVICE)
    private readonly channelService: NotificationChannelServicePort,
    @InjectPinoLogger(DiscussionNotificationListener.name)
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
      const title = 'New Reply';
      const body = `${event.authorUsername} replied to your question`;

      await this.channelService.send({
        userId: event.threadAuthorId,
        type: 'discussion_reply',
        title,
        body,
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
        },
      });

      this.logger.info({
        event: 'discussion_reply_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
      });
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
      const title = 'Your Question Was Solved';
      const body = `${event.solverUsername} marked your question as solved`;

      await this.channelService.send({
        userId: event.authorId,
        type: 'discussion_thread_solved',
        title,
        body,
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
        },
      });

      this.logger.info({
        event: 'discussion_solved_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
      });
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
