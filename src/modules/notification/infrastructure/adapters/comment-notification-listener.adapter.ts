/**
 * Comment Notification Listener
 *
 * Subscribes to Comment domain events and dispatches notifications.
 * Hosted in NotificationModule — DiscussionModule no longer imports
 * NotificationModule. All event payloads are self-contained: this
 * listener does not import the discussion repository, the discussion
 * service, or any other discussion-side adapter, so the dependency
 * graph between the two modules stays a one-way arrow
 * (Notification → Discussion for the bus token only).
 *
 * Handled events:
 *   - `comment_created`  → notify the parent comment's author when
 *     the new comment is a reply. Top-level comments do not generate
 *     a notification because there is no "thread author" to ping
 *     (threads were removed in the comment-only refactor).
 *   - `comment_mentioned` → notify the mentioned user.
 *   - `comment_reported` → fan out a moderator alert to every user
 *     with the `admin` or `moderator` role, using the existing
 *     `system_announcement` channel.
 *
 * Every other comment event (`vote_cast`, `vote_removed`,
 * `comment_edited`, `comment_deleted`, `comment_hidden`,
 * `comment_restored`, `report_reviewed`) is intentionally ignored.
 * Those either have no user-facing notification today or the
 * notification is fired by the application service directly.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  COMMENT_DOMAIN_EVENT_BUS,
  type CommentDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  CommentCreatedEvent,
  CommentDomainEvent,
  CommentMentionedEvent,
  CommentReportedEvent,
} from '@/modules/discussion/domain/events/comment.events';
import { NOTIFICATION_CHANNEL_SERVICE } from '../../domain/ports';
import type { NotificationChannelServicePort } from '../../domain/ports';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '@/modules/user/domain/ports/user-repository.port';

@Injectable()
export class CommentNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(COMMENT_DOMAIN_EVENT_BUS)
    private readonly commentEventBus: CommentDomainEventBusPort,
    @Inject(NOTIFICATION_CHANNEL_SERVICE)
    private readonly channelService: NotificationChannelServicePort,
    @Inject(forwardRef(() => USER_REPOSITORY_PORT))
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(CommentNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.commentEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
    this.logger.info({ event: 'comment_notification_listener_ready' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: CommentDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'comment_created':
        await this.handleCommentCreated(event);
        break;
      case 'comment_mentioned':
        await this.handleCommentMentioned(event);
        break;
      case 'comment_reported':
        await this.handleCommentReported(event);
        break;
    }
  }

  private async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    if (!event.isReply || !event.parentCommentId || !event.parentCommentAuthorId) {
      return;
    }

    try {
      await this.channelService.send({
        userId: event.parentCommentAuthorId,
        type: 'discussion_reply',
        title: 'New reply to your comment',
        body: `${event.authorUsername} replied to your comment`,
        metadata: {
          commentId: event.commentId,
          parentCommentId: event.parentCommentId,
          quizId: event.quizId,
        },
      });

      this.logger.info({
        event: 'comment_reply_notification_sent',
        commentId: event.commentId,
        parentCommentId: event.parentCommentId,
        parentCommentAuthorId: event.parentCommentAuthorId,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_reply_notification_failed',
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleCommentMentioned(event: CommentMentionedEvent): Promise<void> {
    if (event.authorId === event.mentionedUserId) {
      return;
    }

    try {
      await this.channelService.send({
        userId: event.mentionedUserId,
        type: 'discussion_mention',
        title: 'You were mentioned',
        body: `${event.authorUsername} mentioned you in a comment`,
        metadata: {
          commentId: event.commentId,
          quizId: event.quizId,
          mentionedUsername: event.mentionedUsername,
          authorUsername: event.authorUsername,
        },
      });

      this.logger.info({
        event: 'comment_mention_notification_sent',
        commentId: event.commentId,
        mentionedUserId: event.mentionedUserId,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_mention_notification_failed',
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleCommentReported(event: CommentReportedEvent): Promise<void> {
    try {
      const moderators = await this.userRepository.findUsersByRole(['admin', 'moderator']);

      if (moderators.length === 0) {
        this.logger.warn({
          event: 'comment_reported_no_moderators',
          reportId: event.reportId,
        });
        return;
      }

      const body = `Comment reported: ${event.reason}`;
      const excerpt = event.commentExcerpt;

      await Promise.allSettled(
        moderators.map((m) =>
          this.channelService.send({
            userId: m.userId,
            type: 'system_announcement',
            title: 'New comment report',
            body,
            metadata: {
              reportId: event.reportId,
              commentId: event.commentId,
              quizId: event.quizId,
              reporterId: event.reporterId,
              reason: event.reason,
              excerpt,
            },
          }),
        ),
      );

      this.logger.info({
        event: 'comment_reported_moderator_notifications_sent',
        reportId: event.reportId,
        commentId: event.commentId,
        moderatorCount: moderators.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_reported_moderator_notification_failed',
        reportId: event.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
