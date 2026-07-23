/**
 * Discussion Notification Listener
 *
 * Subscribes to Discussion domain events and dispatches notifications.
 * Hosted in NotificationModule — DiscussionModule no longer imports NotificationModule.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_REPOSITORY_PORT,
  type DiscussionRepositoryPort,
} from '@/modules/discussion/domain/ports';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentHiddenEvent,
  CommentMentionedEvent,
  CommentRestoredEvent,
  DiscussionThreadSolvedEvent,
  ThreadClosedEvent,
  ThreadDeletedEvent,
  ThreadHiddenEvent,
  ThreadRestoredEvent,
  ThreadReopenedEvent,
  ContentReportedEvent,
  ReportReviewedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { NOTIFICATION_CHANNEL_SERVICE } from '../../domain/ports';
import type { NotificationChannelServicePort } from '../../domain/ports';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '@/modules/user/domain/ports/user-repository.port';

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
    @Inject(forwardRef(() => USER_REPOSITORY_PORT))
    private readonly userRepository: UserRepositoryPort,
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
      case 'comment_deleted':
        await this.handleCommentDeleted(event);
        break;
      case 'thread_closed':
        await this.handleThreadClosed(event);
        break;
      case 'thread_deleted':
        await this.handleThreadDeleted(event);
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

      const notifiedUserIds = subscribers
        .map((s) => s.userId)
        .filter((userId) => userId !== event.authorId && userId !== event.threadAuthorId);

      if (notifiedUserIds.length === 0) return;

      const channelServiceWithBatch = this.channelService as {
        sendBatch?: (
          params: {
            type: string;
            title: string;
            body: string;
            metadata?: Record<string, unknown>;
          },
          userIds: string[],
        ) => Promise<{ sent: number; skipped: number }>;
      };

      if (channelServiceWithBatch.sendBatch) {
        await channelServiceWithBatch.sendBatch(
          {
            type: 'discussion_reply',
            title: 'New comment on a subscribed thread',
            body: `${event.authorUsername} commented on a thread you're subscribed to`,
            metadata: {
              threadId: event.threadId,
              commentId: event.commentId,
            },
          },
          notifiedUserIds,
        );
      } else {
        await Promise.allSettled(
          notifiedUserIds.map((userId) =>
            this.channelService.send({
              userId,
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
      }

      this.logger.info({
        event: 'thread_subscription_notifications_sent',
        threadId: event.threadId,
        commentId: event.commentId,
        count: notifiedUserIds.length,
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
    try {
      const summary = await this.discussionRepository.getReportTargetSummary({
        reportId: event.reportId,
        targetType: event.targetType,
        targetId: event.targetId,
      });

      if (!summary) {
        this.logger.warn({
          event: 'content_reported_target_missing',
          reportId: event.reportId,
          targetType: event.targetType,
          targetId: event.targetId,
        });
        return;
      }

      const moderators = await this.userRepository.findUsersByRole(['admin', 'moderator']);

      if (moderators.length === 0) {
        this.logger.warn({
          event: 'content_reported_no_moderators',
          reportId: event.reportId,
        });
        return;
      }

      const targetLabel = this.formatTargetLabel(event.targetType);
      const body = `${targetLabel} reported in "${summary.threadTitle}": ${event.reason}`;

      await Promise.allSettled(
        moderators.map((m) =>
          this.channelService.send({
            userId: m.userId,
            type: 'system_announcement',
            title: 'New content report',
            body,
            metadata: {
              reportId: event.reportId,
              targetType: event.targetType,
              targetId: event.targetId,
              threadId: summary.threadId,
              threadTitle: summary.threadTitle,
              reporterId: event.reporterId,
              reason: event.reason,
              excerpt: summary.excerpt,
            },
          }),
        ),
      );

      this.logger.info({
        event: 'content_reported_moderator_notifications_sent',
        reportId: event.reportId,
        targetType: event.targetType,
        threadId: summary.threadId,
        moderatorCount: moderators.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'content_reported_moderator_notification_failed',
        reportId: event.reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatTargetLabel(targetType: 'thread' | 'comment' | 'reply'): string {
    switch (targetType) {
      case 'thread':
        return 'A discussion thread';
      case 'comment':
        return 'A comment';
      case 'reply':
        return 'A reply';
    }
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
    const result = await this.discussionRepository.getCommentAuthor(commentId);
    return result;
  }

  private async getThreadInfo(threadId: string): Promise<{ authorId: string | null } | null> {
    const result = await this.discussionRepository.getThreadAuthor(threadId);
    return result;
  }

  private async getReportInfo(reportId: string): Promise<{ reporterId: string | null } | null> {
    const result = await this.discussionRepository.getReportReporter(reportId);
    return result;
  }

  async handleCommentDeleted(event: CommentDeletedEvent): Promise<void> {
    try {
      const comment = await this.getCommentInfo(event.commentId);
      if (!comment || !comment.authorId) return;
      if (comment.authorId === event.authorId) return;

      await this.channelService.send({
        userId: comment.authorId,
        type: 'discussion_reply',
        title: 'Your comment was deleted',
        body: 'A moderator has deleted one of your comments',
        metadata: {
          threadId: event.threadId,
          commentId: event.commentId,
        },
      });

      this.logger.info({
        event: 'comment_deleted_notification_sent',
        threadId: event.threadId,
        commentId: event.commentId,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_deleted_notification_failed',
        threadId: event.threadId,
        commentId: event.commentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadClosed(event: ThreadClosedEvent): Promise<void> {
    try {
      const thread = await this.getThreadInfo(event.threadId);
      if (!thread || !thread.authorId) return;

      await this.channelService.send({
        userId: thread.authorId,
        type: 'discussion_reply',
        title: 'Your discussion was closed',
        body: 'Your discussion has been closed for new replies',
        metadata: {
          threadId: event.threadId,
        },
      });

      this.logger.info({
        event: 'thread_closed_notification_sent',
        threadId: event.threadId,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_closed_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleThreadDeleted(event: ThreadDeletedEvent): Promise<void> {
    try {
      const thread = await this.getThreadInfo(event.threadId);
      if (!thread || !thread.authorId) return;

      await this.channelService.send({
        userId: thread.authorId,
        type: 'discussion_reply',
        title: 'Your discussion was deleted',
        body: 'A moderator has deleted your discussion',
        metadata: {
          threadId: event.threadId,
        },
      });

      this.logger.info({
        event: 'thread_deleted_notification_sent',
        threadId: event.threadId,
      });
    } catch (error) {
      this.logger.error({
        event: 'thread_deleted_notification_failed',
        threadId: event.threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
