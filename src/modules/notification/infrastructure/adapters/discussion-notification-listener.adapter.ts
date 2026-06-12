/**
 * Discussion Notification Listener
 *
 * Subscribes to Discussion domain events and dispatches notifications.
 * Hosted in NotificationModule — DiscussionModule no longer imports NotificationModule.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DISCUSSION_REPOSITORY_PORT, type DiscussionRepositoryPort } from '@/modules/discussion/domain/ports';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  CommentHiddenEvent,
  CommentMentionedEvent,
  CommentRestoredEvent,
  DiscussionThreadSolvedEvent,
  ThreadHiddenEvent,
  ThreadRestoredEvent,
  ThreadReopenedEvent,
  ContentReportedEvent,
  ReportReviewedEvent,
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
    @Inject(DISCUSSION_REPOSITORY_PORT)
    private readonly discussionRepository: DiscussionRepositoryPort,
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
    switch (event.eventType) {
      case 'comment_created':
        await this.handleCommentCreated(event);
        break;
      case 'discussion_thread_solved':
        await this.handleThreadSolved(event);
        break;
      case 'comment_mentioned':
        await this.handleCommentMentioned(event);
        break;
      case 'comment_hidden':
        await this.handleCommentHidden(event);
        break;
      case 'comment_restored':
        await this.handleCommentRestored(event);
        break;
      case 'thread_hidden':
        await this.handleThreadHidden(event);
        break;
      case 'thread_restored':
        await this.handleThreadRestored(event);
        break;
      case 'thread_reopened':
        await this.handleThreadReopened(event);
        break;
      case 'content_reported':
        await this.handleContentReported(event);
        break;
      case 'report_reviewed':
        await this.handleReportReviewed(event);
        break;
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

    await this.notifyThreadSubscribers(event);
  }

  private async notifyThreadSubscribers(event: CommentCreatedEvent): Promise<void> {
    try {
      const subscribers = await this.discussionRepository.listThreadSubscribers(event.threadId);

      const notified = subscribers.filter(
        (s) => s.userId !== event.authorId && s.userId !== event.threadAuthorId,
      );

      if (notified.length === 0) return;

      await Promise.allSettled(
        notified.map((s) =>
          this.channelService.send({
            userId: s.userId,
            type: 'discussion_reply',
            title: 'New comment on a subscribed thread',
            body: `${event.authorUsername} commented on a thread you're subscribed to`,
            metadata: {
              threadId: event.threadId,
              commentId: event.commentId,
            },
          }),
        ),
      );

      this.logger.info({
        event: 'thread_subscription_notifications_sent',
        threadId: event.threadId,
        commentId: event.commentId,
        count: notified.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_subscription_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadSolved(event: DiscussionThreadSolvedEvent): Promise<void> {
    try {
      if (event.authorId === event.solverId) {
        return;
      }

      await this.channelService.send({
        userId: event.authorId,
        type: 'discussion_solved',
        title: 'Discussion Solved',
        body: `${event.solverUsername} marked your discussion as solved`,
        metadata: {
          discussionId: event.threadId,
          commentId: event.commentId,
          solverId: event.solverId,
          solverUsername: event.solverUsername,
        },
      });

      this.logger.info({
        event: 'discussion_solved_notification_sent',
        threadId: event.threadId,
        authorId: event.authorId,
        solverId: event.solverId,
      });
    } catch (error) {
      this.logger.error({
        event: 'discussion_solved_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleCommentMentioned(event: CommentMentionedEvent): Promise<void> {
    try {
      if (event.authorId === event.mentionedUserId) {
        return;
      }

      await this.channelService.send({
        userId: event.mentionedUserId,
        type: 'discussion_mention',
        title: 'You were mentioned',
        body: `${event.authorUsername} mentioned you in "${event.threadTitle}"`,
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
          mentionedUsername: event.mentionedUsername,
          authorUsername: event.authorUsername,
        },
      });

      this.logger.info({
        event: 'discussion_mention_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
        mentionedUserId: event.mentionedUserId,
      });
    } catch (error) {
      this.logger.error({
        event: 'discussion_mention_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleCommentHidden(event: CommentHiddenEvent): Promise<void> {
    try {
      const comment = await this.getCommentInfo(event.commentId);
      if (!comment || !comment.authorId) return;

      await this.channelService.send({
        userId: comment.authorId,
        type: 'discussion_reply',
        title: 'Your comment was hidden',
        body: 'A moderator has hidden one of your comments for review',
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
        },
      });

      this.logger.info({
        event: 'comment_hidden_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_hidden_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleCommentRestored(event: CommentRestoredEvent): Promise<void> {
    try {
      const comment = await this.getCommentInfo(event.commentId);
      if (!comment || !comment.authorId) return;

      await this.channelService.send({
        userId: comment.authorId,
        type: 'discussion_reply',
        title: 'Your comment was restored',
        body: 'A moderator has restored your hidden comment',
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
        },
      });

      this.logger.info({
        event: 'comment_restored_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_restored_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadHidden(event: ThreadHiddenEvent): Promise<void> {
    try {
      const thread = await this.getThreadInfo(event.threadId);
      if (!thread || !thread.authorId) return;

      await this.channelService.send({
        userId: thread.authorId,
        type: 'discussion_reply',
        title: 'Your discussion was hidden',
        body: 'A moderator has hidden your discussion for review',
        metadata: {
          threadId: event.threadId,
        },
      });

      this.logger.info({
        event: 'thread_hidden_notification_sent',
        threadId: event.threadId,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_hidden_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadRestored(event: ThreadRestoredEvent): Promise<void> {
    try {
      await this.channelService.send({
        userId: event.authorId,
        type: 'discussion_reply',
        title: 'Your discussion was restored',
        body: 'A moderator has restored your hidden discussion',
        metadata: {
          threadId: event.threadId,
        },
      });

      this.logger.info({
        event: 'thread_restored_notification_sent',
        threadId: event.threadId,
        authorId: event.authorId,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_restored_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadReopened(event: ThreadReopenedEvent): Promise<void> {
    try {
      if (event.authorId) {
        await this.channelService.send({
          userId: event.authorId,
          type: 'discussion_reply',
          title: 'Discussion reopened',
          body: 'Your discussion has been reopened for new replies',
          metadata: {
            threadId: event.threadId,
          },
        });
      }

      this.logger.info({
        event: 'thread_reopened_notification_sent',
        threadId: event.threadId,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_reopened_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleContentReported(event: ContentReportedEvent): Promise<void> {
    this.logger.debug({
      event: 'content_reported_notification_received',
      reportId: event.reportId,
      targetType: event.targetType,
      targetId: event.targetId,
    });
  }

  async handleReportReviewed(event: ReportReviewedEvent): Promise<void> {
    try {
      const report = await this.getReportInfo(event.reportId);
      if (!report || !report.reporterId) return;

      let body: string;
      switch (event.status) {
        case 'actioned':
          body = 'A report you submitted was reviewed and action was taken on the content';
          break;
        case 'dismissed':
          body = 'A report you submitted was reviewed and dismissed';
          break;
        default:
          body = 'A report you submitted has been reviewed';
      }

      await this.channelService.send({
        userId: report.reporterId,
        type: 'system_announcement',
        title: 'Report reviewed',
        body,
        metadata: {
          reportId: event.reportId,
          status: event.status,
          actionTaken: event.actionTaken,
        },
      });

      this.logger.info({
        event: 'report_reviewed_notification_sent',
        reportId: event.reportId,
        status: event.status,
      });
    } catch (error) {
      this.logger.error({
        event: 'report_reviewed_notification_failed',
        reportId: event.reportId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getCommentInfo(commentId: string): Promise<{ authorId: string | null } | null> {
    return { authorId: null };
  }

  private async getThreadInfo(threadId: string): Promise<{ authorId: string | null } | null> {
    return { authorId: null };
  }

  private async getReportInfo(reportId: string): Promise<{ reporterId: string | null } | null> {
    return { reporterId: null };
  }
}
