/**
 * Comment WebSocket Listener
 *
 * Subscribes to CommentDomainEventBus lifecycle events and pushes them
 * to connected WebSocket clients via CommentGateway.
 *
 * Events are broadcast to quiz-scoped rooms so all viewers of a quiz
 * receive live comment updates. Personal events (mentions, replies)
 * are also pushed to the target user's room.
 *
 * Registered in CommentModule as an @Injectable, so it can receive
 * CommentGateway as a constructor dependency and subscribe on init.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { COMMENT_DOMAIN_EVENT_BUS, type CommentDomainEvent } from '@/modules/comment/domain/events';
import type { CommentDomainEventBusPort } from '@/modules/comment/domain/events';
import { CommentGateway } from '../../transport/gateway/comment.gateway';

@Injectable()
export class CommentWebSocketListener implements OnModuleInit, OnModuleDestroy {
  private subscriptions: Array<() => void> = [];

  constructor(
    @Inject(COMMENT_DOMAIN_EVENT_BUS)
    private readonly eventBus: CommentDomainEventBusPort,
    private readonly commentGateway: CommentGateway,
    @InjectPinoLogger(CommentWebSocketListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe();
  }

  private subscribe(): void {
    // Subscribe to all comment domain events
    const handler = (event: CommentDomainEvent) => {
      void this.handleEvent(event);
    };

    const unsubscribe = this.eventBus.subscribe(handler);
    this.subscriptions.push(unsubscribe);

    this.logger.info({
      event: 'comment_ws_listener_subscribed',
      module: 'comment',
    });
  }

  private unsubscribe(): void {
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];

    this.logger.info({
      event: 'comment_ws_listener_unsubscribed',
    });
  }

  private handleEvent(event: CommentDomainEvent): void {
    try {
      // Only broadcast events with quizId to the quiz room
      if ('quizId' in event && event.quizId) {
        this.commentGateway.pushToQuiz(event);
      }

      // Additionally push personal notifications to specific users
      switch (event.eventType) {
        case 'comment_created':
          // Notify the parent comment author if this is a reply
          if (event.isReply && event.parentCommentAuthorId) {
            // Don't notify the author if they're replying to their own comment
            if (event.authorId !== event.parentCommentAuthorId) {
              this.commentGateway.pushToUser(event.parentCommentAuthorId, event);
            }
          }
          break;

        case 'comment_mentioned':
          // Notify the mentioned user
          this.commentGateway.pushToUser(event.mentionedUserId, event);
          break;

        // Note: comment_reported is handled separately by NotificationModule
        // for moderator notifications
      }
    } catch (error) {
      this.logger.error({
        event: 'comment_ws_push_failed',
        eventType: event.eventType,
        quizId: 'quizId' in event ? event.quizId : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
