/**
 * Discussion Notification Listener
 *
 * Subscribes to Discussion domain events and dispatches notifications.
 * Hosted in NotificationModule — DiscussionModule no longer imports NotificationModule.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { NOTIFICATION_CHANNEL_SERVICE } from '../../domain/ports';
import type { NotificationChannelServicePort } from '../../domain/ports';

@Injectable()
export class DiscussionNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => DISCUSSION_DOMAIN_EVENT_BUS))
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
    this.logger.info({ event: 'discussion_notification_listener_ready' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: DiscussionDomainEvent): Promise<void> {
    if (event.eventType === 'comment_created') {
      await this.handleCommentCreated(event);
    }
  }

  async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    try {
      if (event.isReply && event.parentCommentId && event.parentCommentAuthorId) {
        await this.channelService.send({
          userId: event.parentCommentAuthorId,
          type: 'discussion_reply',
          title: 'New Reply to Your Comment',
          body: `${event.authorUsername} replied to your comment`,
          metadata: {
            threadId: event.threadId,
            commentId: event.commentId,
            parentCommentId: event.parentCommentId,
          },
        });
      } else {
        await this.channelService.send({
          userId: event.threadAuthorId,
          type: 'discussion_reply',
          title: 'New Reply',
          body: `${event.authorUsername} replied to your question`,
          metadata: {
            threadId: event.threadId,
            commentId: event.commentId,
          },
        });
      }

      this.logger.info({
        event: 'discussion_reply_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
        isReply: event.isReply,
        parentCommentId: event.parentCommentId,
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
}
