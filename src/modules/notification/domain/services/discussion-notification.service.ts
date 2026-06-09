import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  CommentCreatedEvent,
  DiscussionThreadSolvedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { DISCUSSION_REPOSITORY_PORT, type DiscussionRepositoryPort } from '@/modules/discussion/domain/ports';
import type { DiscussionComment } from '@/modules/discussion/domain/types';
import { NotificationChannelService } from './channel.service';

@Injectable()
export class DiscussionNotificationService {
  constructor(
    @Inject(DISCUSSION_REPOSITORY_PORT)
    private readonly discussionRepository: DiscussionRepositoryPort,
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(DiscussionNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async notifyCommentCreated(event: CommentCreatedEvent): Promise<void> {
    const comment = await this.discussionRepository.getCommentById(event.commentId);
    if (!comment) {
      return;
    }

    const thread = await this.discussionRepository.getThreadById(event.threadId);
    if (!thread) {
      return;
    }

    const targetUserId = await this.resolveReplyRecipient(comment, thread.authorId);
    if (!targetUserId || targetUserId === event.authorId) {
      return;
    }

    await this.channelService.send({
      userId: targetUserId,
      type: 'discussion_reply',
      title: 'New Reply',
      body: `${comment.author.username} replied to your discussion`,
      metadata: {
        discussionId: event.threadId,
        commentId: event.commentId,
        parentCommentId: event.parentCommentId,
        actorId: event.authorId,
        actorUsername: comment.author.username,
        isReply: event.isReply,
      },
    });

    this.logger.info({
      event: 'discussion_reply_notification_sent',
      userId: targetUserId,
      threadId: event.threadId,
      commentId: event.commentId,
    });
  }

  async notifyThreadSolved(event: DiscussionThreadSolvedEvent): Promise<void> {
    if (event.authorId === event.solverId) {
      return;
    }

    await this.channelService.send({
      userId: event.authorId,
      type: 'discussion_solved',
      title: 'Discussion Solved',
      body: 'Your discussion was marked as solved',
      metadata: {
        discussionId: event.threadId,
        commentId: event.commentId,
        solverId: event.solverId,
      },
    });

    this.logger.info({
      event: 'discussion_solved_notification_sent',
      userId: event.authorId,
      threadId: event.threadId,
      commentId: event.commentId,
    });
  }

  private async resolveReplyRecipient(
    comment: DiscussionComment,
    threadAuthorId: string,
  ): Promise<string | null> {
    if (!comment.parentCommentId) {
      return threadAuthorId;
    }

    const parentComment = await this.discussionRepository.getCommentById(comment.parentCommentId);
    return parentComment?.authorId ?? threadAuthorId;
  }
}
