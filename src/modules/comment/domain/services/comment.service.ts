import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  QUIZ_EXISTENCE_PORT,
  USER_EXISTENCE_PORT,
  type QuizExistencePort,
  type UserExistencePort,
} from '../ports';
import type { UserPublicInfo } from '../ports/user-existence.port';
import {
  COMMENT_REPOSITORY_PORT,
  type CommentRepositoryPort,
} from '../ports/comment-repository.port';
import { COMMENT_DOMAIN_EVENT_BUS } from '../events';
import type { CommentDomainEventBusPort } from '../events';
import { createCommentSnapshot } from '../events/comment.events';
import { MAX_REPLIES_PER_COMMENT } from '../constants';
import { CommentAuthorizationPolicy } from '../policies/comment-authorization.policy';
import {
  CommentConflictError,
  CommentNotFoundError,
  CommentForbiddenError,
  ParentCommentCrossThreadError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
  QuizNotFoundError,
  ReplyLimitExceededError,
  ReportNotFoundError,
} from '../errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type {
  CommentCursor,
  CommentView,
  CommentWithRepliesView,
  CreateCommentParams,
  DeleteCommentParams,
  EditCommentParams,
  GetCommentParams,
  HideCommentParams,
  ListMyCommentsParams,
  ListQuizCommentsParams,
  ListReportsParams,
  ModerationResult,
  MyCommentView,
  ReportCommentParams,
  ReportCursor,
  ReportView,
  RestoreCommentParams,
  ReviewReportParams,
  VoteParams,
} from '../types';
import type { ModerationAuditTx, ModerationAuditPort } from '../ports/moderation-audit.port';

@Injectable()
export class CommentService {
  constructor(
    @Inject(COMMENT_REPOSITORY_PORT)
    private readonly repo: CommentRepositoryPort,
    @Inject(QUIZ_EXISTENCE_PORT)
    private readonly quizExistence: QuizExistencePort,
    @Inject(USER_EXISTENCE_PORT)
    private readonly userExistence: UserExistencePort,
    @Inject(COMMENT_DOMAIN_EVENT_BUS)
    private readonly eventBus: CommentDomainEventBusPort,
    @Inject('COMMENT_MODERATION_AUDIT_PORT')
    private readonly moderationAudit: ModerationAuditPort,
    @InjectPinoLogger(CommentService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getComment(params: GetCommentParams): Promise<CommentView | null> {
    return this.repo.getCommentById(params.commentId);
  }

  async listComments(params: ListQuizCommentsParams & { viewerId?: string | null }): Promise<{
    items: CommentWithRepliesView[];
    hasNextPage: boolean;
    nextCursor: CommentCursor | null;
  }> {
    const limit = params.limit ?? 20;
    const repoCursor = params.cursor
      ? { createdAt: params.cursor.createdAt, commentId: params.cursor.id }
      : null;
    const items = await this.repo.listComments({
      quizId: params.quizId,
      limit: limit + 1,
      cursor: repoCursor,
      viewerId: params.viewerId ?? undefined,
    });
    const hasNextPage = items.length > limit;
    const pageItems = hasNextPage ? items.slice(0, limit) : items;
    const lastItem = pageItems.at(-1);
    return {
      items: pageItems,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem ? { createdAt: lastItem.createdAt, id: lastItem.id } : null,
    };
  }

  async listMyComments(params: ListMyCommentsParams): Promise<{
    items: MyCommentView[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: CommentCursor | null;
  }> {
    const limit = params.limit ?? 20;
    const rows = await this.repo.listMyComments({ ...params, limit: limit + 1 });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem ? { createdAt: lastItem.createdAt, id: lastItem.commentId } : null,
    };
  }

  async listReports(
    params: ListReportsParams,
  ): Promise<{ items: ReportView[]; hasNextPage: boolean; nextCursor: ReportCursor | null }> {
    const limit = params.limit ?? 20;
    const rows = await this.repo.listReports({ ...params, limit: limit + 1 });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem ? { createdAt: lastItem.createdAt, id: lastItem.reportId } : null,
    };
  }

  async createComment(params: CreateCommentParams): Promise<CommentView> {
    const quizExists = await this.quizExistence.exists(params.quizId);
    if (!quizExists) {
      throw new QuizNotFoundError(params.quizId);
    }

    const txResult = await this.repo.transactionally(async (tx) => {
      let parent: CommentView | null = null;

      if (params.parentCommentId !== null) {
        parent = await this.repo.getCommentByIdForUpdate(params.parentCommentId, tx);
        if (!parent) {
          throw new CommentNotFoundError(params.parentCommentId);
        }
        if (parent.quizId !== params.quizId) {
          throw new ParentCommentCrossThreadError();
        }
        if (parent.parentCommentId !== null) {
          throw new ParentCommentCrossThreadError();
        }
        if (parent.isHidden || parent.deletedAt !== null) {
          throw new CommentNotFoundError(params.parentCommentId);
        }

        const replyCount = await this.repo.countReplies(params.parentCommentId);
        if (replyCount >= MAX_REPLIES_PER_COMMENT) {
          throw new ReplyLimitExceededError(MAX_REPLIES_PER_COMMENT);
        }
      }

      const comment = await this.repo.createComment(params, tx);

      if (params.parentCommentId !== null) {
        await this.repo.incrementRepliesCount(params.parentCommentId, 1, tx);
      }

      const author = await this.repo.getAuthorForComment(comment.id, tx);
      if (author === null) {
        throw new CommentNotFoundError(comment.id);
      }

      const parsedMentions = this.parseMentionUsernames(params.body);
      let mentionedUsers: UserPublicInfo[] = [];
      if (parsedMentions.length > 0) {
        mentionedUsers = await this.userExistence.findByUsernames(parsedMentions);
      }

      return {
        comment,
        author,
        parentAuthorId: parent?.authorId ?? null,
        mentionedUsers,
      };
    });

    const { comment, author, parentAuthorId, mentionedUsers } = txResult;

    this.logger.debug({
      event: 'comment_created',
      commentId: comment.id,
      quizId: comment.quizId,
      parentCommentId: comment.parentCommentId,
    });

    const fullCommentView: CommentView = {
      ...comment,
      author,
    };

    this.eventBus.emitCommentCreated({
      eventType: 'comment_created',
      commentId: comment.id,
      quizId: comment.quizId,
      parentCommentId: comment.parentCommentId,
      authorId: comment.authorId,
      authorUsername: author.username,
      parentCommentAuthorId: parentAuthorId,
      isReply: comment.parentCommentId !== null,
      timestamp: new Date(),
      snapshot: createCommentSnapshot(fullCommentView),
    });

    if (mentionedUsers.length > 0) {
      for (const user of mentionedUsers) {
        if (user.userId === author.userId) continue;
        this.eventBus.emitCommentMentioned({
          eventType: 'comment_mentioned',
          commentId: comment.id,
          quizId: comment.quizId,
          mentionedUserId: user.userId,
          mentionedUsername: user.username,
          authorId: author.userId,
          authorUsername: author.username,
          timestamp: new Date(),
        });
      }
      this.logger.info({
        event: 'comment_mentions_parsed',
        commentId: comment.id,
        quizId: comment.quizId,
        mentionedUsernames: mentionedUsers.map((u) => u.username),
      });
    }

    return comment;
  }

  private parseMentionUsernames(content: string): string[] {
    const matches = content.match(/@(\w{1,30})/g);
    if (!matches) return [];

    const usernames = matches.map((m) => m.slice(1).toLowerCase());
    return [...new Set(usernames)];
  }

  async editComment(params: EditCommentParams): Promise<CommentView> {
    return this.repo.transactionally(async (tx) => {
      const existing = await this.repo.getCommentByIdForUpdate(params.commentId, tx);
      if (!existing) {
        throw new CommentNotFoundError(params.commentId);
      }
      if (existing.authorId !== params.authorId) {
        throw new CommentForbiddenError();
      }
      if (existing.isHidden || existing.deletedAt !== null) {
        throw new CommentNotFoundError(params.commentId);
      }
      if (
        params.expectedUpdatedAt !== undefined &&
        existing.updatedAt !== params.expectedUpdatedAt
      ) {
        throw new CommentConflictError(
          'Comment was modified concurrently; please refetch and retry',
        );
      }

      const updated = await this.repo.editComment(params);
      const author = await this.repo.getAuthorForComment(updated.id, tx);
      if (author === null) {
        throw new CommentNotFoundError(updated.id);
      }
      const fullCommentView: CommentView = {
        ...updated,
        author,
      };

      this.eventBus.emitCommentEdited({
        eventType: 'comment_edited',
        commentId: updated.id,
        quizId: updated.quizId,
        authorId: updated.authorId,
        timestamp: new Date(),
        snapshot: createCommentSnapshot(fullCommentView),
      });

      this.logger.info({ event: 'comment_edited', commentId: updated.id });
      return updated;
    });
  }

  async deleteComment(params: DeleteCommentParams): Promise<void> {
    const result = await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(params.commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(params.commentId);
      }
      if (comment.authorId !== params.authorId) {
        throw new CommentForbiddenError();
      }
      if (comment.deletedAt !== null) {
        return null;
      }

      const { deleted } = await this.repo.softDeleteComment(
        { commentId: params.commentId, authorId: params.authorId },
        tx,
      );
      if (!deleted) {
        throw new CommentNotFoundError(params.commentId);
      }

      if (comment.parentCommentId !== null) {
        await this.repo.incrementRepliesCount(comment.parentCommentId, -1, tx);
      }

      return comment;
    });

    if (result === null) return;

    this.eventBus.emitCommentDeleted({
      eventType: 'comment_deleted',
      commentId: params.commentId,
      quizId: result.quizId,
      authorId: params.authorId,
      timestamp: new Date(),
      parentCommentId: result.parentCommentId,
    });

    this.logger.info({ event: 'comment_deleted', commentId: params.commentId });
  }

  async vote(params: VoteParams): Promise<void> {
    const { userId, commentId, value } = params;

    const txResult = await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(commentId);
      }
      if (comment.isHidden || comment.deletedAt !== null) {
        throw new CommentNotFoundError(commentId);
      }
      if (comment.authorId === userId) {
        throw new SelfVoteError();
      }

      const existing = await this.repo.getUserVoteForComment(userId, commentId, tx);

      let counts: { votesCount: number; upvotesCount: number; downvotesCount: number };

      if (existing === value) {
        await this.repo.removeVote({ userId, commentId }, tx);
        counts = await this.repo.incrementVoteCount(
          commentId,
          value === 'upvote' ? -1 : 0,
          value === 'downvote' ? -1 : 0,
          tx,
        );
      } else if (existing !== null) {
        await this.repo.upsertVote({ userId, commentId, value }, tx);
        const flipUp = value === 'upvote' ? 1 : -1;
        const flipDown = value === 'upvote' ? -1 : 1;
        counts = await this.repo.incrementVoteCount(commentId, flipUp, flipDown, tx);
      } else {
        await this.repo.upsertVote({ userId, commentId, value }, tx);
        counts = await this.repo.incrementVoteCount(
          commentId,
          value === 'upvote' ? 1 : 0,
          value === 'downvote' ? 1 : 0,
          tx,
        );
      }

      return {
        quizId: comment.quizId,
        counts,
      };
    });

    const votesCount = txResult.counts.votesCount;

    this.eventBus.emitVoteCast({
      eventType: 'vote_cast',
      commentId,
      quizId: txResult.quizId,
      voterId: userId,
      value,
      timestamp: new Date(),
      votesCount,
      upvotesCount: txResult.counts.upvotesCount,
      downvotesCount: txResult.counts.downvotesCount,
    });

    this.logger.debug({ event: 'vote_cast', userId, commentId, value });
  }

  async removeVote(params: { userId: string; commentId: string }): Promise<void> {
    const { userId, commentId } = params;

    const removed = await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(commentId);
      }
      if (comment.isHidden || comment.deletedAt !== null) {
        throw new CommentNotFoundError(commentId);
      }

      const existing = await this.repo.getUserVoteForComment(userId, commentId, tx);
      if (existing === null) {
        return null;
      }

      const deltaUp = existing === 'upvote' ? -1 : 0;
      const deltaDown = existing === 'downvote' ? -1 : 0;

      const counts = await this.repo.incrementVoteCount(commentId, deltaUp, deltaDown, tx);
      await this.repo.removeVote({ userId, commentId }, tx);

      return {
        quizId: comment.quizId,
        votesCount: counts.votesCount,
        upvotesCount: counts.upvotesCount,
        downvotesCount: counts.downvotesCount,
      };
    });

    if (removed === null) {
      return;
    }

    this.eventBus.emitVoteRemoved({
      eventType: 'vote_removed',
      commentId,
      quizId: removed.quizId,
      voterId: userId,
      timestamp: new Date(),
      votesCount: removed.votesCount,
      upvotesCount: removed.upvotesCount,
      downvotesCount: removed.downvotesCount,
    });

    this.logger.debug({ event: 'vote_removed', userId, commentId });
  }

  async reportComment(params: ReportCommentParams): Promise<ReportView> {
    const comment = await this.repo.getCommentById(params.commentId);
    if (!comment) {
      throw new CommentNotFoundError(params.commentId);
    }
    if (comment.authorId === params.reporterId) {
      throw new SelfReportError();
    }
    if (comment.isHidden || comment.deletedAt !== null) {
      throw new CommentNotFoundError(params.commentId);
    }

    try {
      const report = await this.repo.createReport(params);

      this.eventBus.emitCommentReported({
        eventType: 'comment_reported',
        reportId: report.reportId,
        commentId: params.commentId,
        quizId: comment.quizId,
        commentExcerpt: comment.body,
        reporterId: params.reporterId,
        reason: params.reason,
        timestamp: new Date(),
      });

      this.logger.info({
        event: 'comment_reported',
        reporterId: params.reporterId,
        commentId: params.commentId,
      });

      return report;
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new DuplicateReportError();
      }
      throw error;
    }
  }

  async reviewReport(
    params: ReviewReportParams,
  ): Promise<{ updated: ReportView; previousStatus: ReportView['status'] | null }> {
    const txResult = await this.repo.transactionally(async (tx) => {
      const previous = await this.repo.getReportByIdForUpdate(params.reportId, tx);
      if (previous === null) {
        throw new ReportNotFoundError(params.reportId);
      }

      const updated = await this.repo.reviewReport(params, tx);
      await this.moderationAudit.logInsideTx(tx as unknown as ModerationAuditTx, {
        actorId: params.reviewerId,
        action: 'review_report',
        targetType: 'comment',
        targetId: updated.commentId,
        result: params.status,
      });
      return { updated, previousStatus: previous.status };
    });

    this.eventBus.emitReportReviewed({
      eventType: 'report_reviewed',
      reportId: params.reportId,
      reviewerId: params.reviewerId,
      status: params.status,
      actionTaken: params.actionTaken,
      timestamp: new Date(),
    });

    this.logger.info({
      event: 'report_reviewed',
      reportId: params.reportId,
      reviewerId: params.reviewerId,
      status: params.status,
    });

    return txResult;
  }

  async hideComment(
    params: HideCommentParams,
    actor: Pick<JwtPayload, 'role'>,
  ): Promise<ModerationResult> {
    CommentAuthorizationPolicy.assertCanModerate({ sub: params.moderatorId, role: actor.role });

    let wasHidden = false;

    await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(params.commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(params.commentId);
      }
      if (comment.deletedAt !== null) {
        throw new CommentNotFoundError(params.commentId);
      }

      wasHidden = comment.isHidden;
      if (!wasHidden) {
        await this.repo.setHiddenState(
          { commentId: params.commentId, hidden: true, moderatorId: params.moderatorId },
          tx,
        );
        await this.moderationAudit.logInsideTx(tx as unknown as ModerationAuditTx, {
          actorId: params.moderatorId,
          action: 'hide_comment',
          targetType: 'comment',
          targetId: params.commentId,
        });
      }
    });

    const comment = await this.repo.getCommentById(params.commentId);
    if (comment === null) {
      throw new CommentNotFoundError(params.commentId);
    }

    const author = await this.repo.getAuthorForComment(comment.id);
    if (author === null) {
      throw new CommentNotFoundError(comment.id);
    }
    const fullCommentView: CommentView = {
      ...comment,
      author,
    };

    this.eventBus.emitCommentHidden({
      eventType: 'comment_hidden',
      commentId: params.commentId,
      quizId: comment.quizId,
      moderatorId: params.moderatorId,
      timestamp: new Date(),
      snapshot: createCommentSnapshot(fullCommentView),
    });

    this.logger.info({
      event: 'comment_hidden',
      commentId: params.commentId,
      moderatorId: params.moderatorId,
    });

    return {
      commentId: params.commentId,
      isHidden: true,
      changed: !wasHidden,
    };
  }

  async restoreComment(
    params: RestoreCommentParams,
    actor: Pick<JwtPayload, 'role'>,
  ): Promise<ModerationResult> {
    CommentAuthorizationPolicy.assertCanModerate({ sub: params.moderatorId, role: actor.role });

    let wasVisible = false;

    await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(params.commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(params.commentId);
      }

      wasVisible = !comment.isHidden;
      if (wasVisible) {
        return;
      }

      await this.repo.setHiddenState(
        { commentId: params.commentId, hidden: false, moderatorId: params.moderatorId },
        tx,
      );
      await this.moderationAudit.logInsideTx(tx as unknown as ModerationAuditTx, {
        actorId: params.moderatorId,
        action: 'restore_comment',
        targetType: 'comment',
        targetId: params.commentId,
      });
    });

    const comment = await this.repo.getCommentById(params.commentId);
    if (comment === null) {
      throw new CommentNotFoundError(params.commentId);
    }

    const author = await this.repo.getAuthorForComment(comment.id);
    if (author === null) {
      throw new CommentNotFoundError(comment.id);
    }
    const fullCommentView: CommentView = {
      ...comment,
      author,
    };

    this.eventBus.emitCommentRestored({
      eventType: 'comment_restored',
      commentId: params.commentId,
      quizId: comment.quizId,
      moderatorId: params.moderatorId,
      timestamp: new Date(),
      snapshot: createCommentSnapshot(fullCommentView),
    });

    this.logger.info({
      event: 'comment_restored',
      commentId: params.commentId,
      moderatorId: params.moderatorId,
    });

    return {
      commentId: params.commentId,
      isHidden: false,
      changed: wasVisible,
    };
  }
}

export type { UserPublicInfo };
