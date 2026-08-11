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
import { MAX_REPLIES_PER_COMMENT } from '../constants';
import { CommentAuthorizationPolicy } from '../policies/comment-authorization.policy';
import {
  CommentNotFoundError,
  CommentForbiddenError,
  ParentCommentCrossThreadError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
  QuizNotFoundError,
  ReplyLimitExceededError,
} from '../errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type {
  AuthorView,
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
    @InjectPinoLogger(CommentService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

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
    const rows = await this.repo.listComments({
      quizId: params.quizId,
      limit: limit + 1,
      cursor: repoCursor,
      viewerId: params.viewerId ?? undefined,
    });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
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

  // ─── Writes ───────────────────────────────────────────────────────────────

  async createComment(params: CreateCommentParams): Promise<CommentView> {
    const quizExists = await this.quizExistence.exists(params.quizId);
    if (!quizExists) {
      throw new QuizNotFoundError(params.quizId);
    }

    // One transaction owns the parent-validation read (`FOR UPDATE`),
    // the insert, and the replies-count increment. The read-then-write
    // pattern outside a transaction would leave a TOCTOU window where a
    // concurrent delete or hide on the parent could race the increment.
    const created = await this.repo.transactionally(async (tx) => {
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
          // Two-level rule: the parent itself must be a top-level comment.
          // Replying to a reply is not allowed.
          throw new ParentCommentCrossThreadError();
        }
        if (parent.isHidden || parent.deletedAt !== null) {
          // The parent is no longer accepting replies.
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

      return comment;
    });

    this.logger.debug({
      event: 'comment_created',
      commentId: created.id,
      quizId: created.quizId,
      parentCommentId: created.parentCommentId,
    });

    const author = await this.repo.getAuthorForComment(created.id);
    if (author === null) {
      // The author should always be resolvable for a just-created comment.
      // Treat it as a developer-time invariant violation rather than a
      // silent skip — the create path would otherwise surface to callers
      // as a missing author on the read projection.
      throw new CommentNotFoundError(created.id);
    }

    const parentAuthorId =
      params.parentCommentId !== null
        ? await this.resolveParentAuthorId(params.parentCommentId)
        : null;

    this.eventBus.emitCommentCreated({
      eventType: 'comment_created',
      commentId: created.id,
      quizId: created.quizId,
      parentCommentId: created.parentCommentId,
      authorId: created.authorId,
      authorUsername: author.username,
      parentCommentAuthorId: parentAuthorId,
      isReply: created.parentCommentId !== null,
      timestamp: new Date(),
    });

    await this.emitMentionEvents(params.body, created.quizId, created.id, author);

    return created;
  }

  private async resolveParentAuthorId(parentCommentId: string): Promise<string | null> {
    const parent = await this.repo.getCommentById(parentCommentId);
    return parent?.authorId ?? null;
  }

  /**
   * Resolves `@username` mentions in a comment body and emits a
   * `comment_mentioned` event for each known recipient other than the
   * author. The author never receives a mention event for themselves.
   */
  private async emitMentionEvents(
    body: string,
    quizId: string,
    commentId: string,
    author: AuthorView,
  ): Promise<void> {
    const usernames = this.parseMentionUsernames(body);
    if (usernames.length === 0) return;

    const mentionedUsers = await this.userExistence.findByUsernames(usernames);

    for (const user of mentionedUsers) {
      if (user.userId === author.userId) continue;

      this.eventBus.emitCommentMentioned({
        eventType: 'comment_mentioned',
        commentId,
        quizId,
        mentionedUserId: user.userId,
        mentionedUsername: user.username,
        authorId: author.userId,
        authorUsername: author.username,
        timestamp: new Date(),
      });
    }

    if (mentionedUsers.length > 0) {
      this.logger.info({
        event: 'comment_mentions_parsed',
        commentId,
        quizId,
        mentionedUsernames: mentionedUsers.map((u) => u.username),
      });
    }
  }

  private parseMentionUsernames(content: string): string[] {
    const matches = content.match(/@(\w{1,30})/g);
    if (!matches) return [];

    const usernames = matches.map((m) => m.slice(1).toLowerCase());
    return [...new Set(usernames)];
  }

  async editComment(params: EditCommentParams): Promise<CommentView> {
    const existing = await this.repo.getCommentById(params.commentId);
    if (!existing) {
      throw new CommentNotFoundError(params.commentId);
    }
    if (existing.authorId !== params.authorId) {
      throw new CommentForbiddenError();
    }
    if (existing.isHidden || existing.deletedAt !== null) {
      throw new CommentNotFoundError(params.commentId);
    }

    const updated = await this.repo.editComment(params);

    this.eventBus.emitCommentEdited({
      eventType: 'comment_edited',
      commentId: updated.id,
      quizId: updated.quizId,
      authorId: updated.authorId,
      timestamp: new Date(),
    });

    this.logger.info({ event: 'comment_edited', commentId: updated.id });
    return updated;
  }

  async deleteComment(params: DeleteCommentParams): Promise<void> {
    // Lock the row for the read so a concurrent delete cannot race the
    // replies-count decrement on the parent.
    const result = await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(params.commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(params.commentId);
      }
      if (comment.authorId !== params.authorId) {
        throw new CommentForbiddenError();
      }
      if (comment.deletedAt !== null) {
        // Already deleted; idempotent no-op so callers can retry safely.
        return null;
      }

      await this.repo.softDeleteComment(
        { commentId: params.commentId, authorId: params.authorId },
        tx,
      );

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
    });

    this.logger.info({ event: 'comment_deleted', commentId: params.commentId });
  }

  // ─── Votes ────────────────────────────────────────────────────────────────

  async vote(params: VoteParams): Promise<void> {
    const { userId, commentId, value } = params;

    await this.repo.transactionally(async (tx) => {
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

      if (existing === value) {
        // Same value re-applied → toggle off.
        await this.repo.removeVote({ userId, commentId }, tx);
        const deltaUp = value === 'upvote' ? -1 : 0;
        const deltaDown = value === 'downvote' ? -1 : 0;
        await this.repo.incrementVoteCount(commentId, deltaUp, deltaDown, tx);
      } else if (existing !== null) {
        // Flipping vote: subtract from the old bucket, add to the new.
        await this.repo.upsertVote({ userId, commentId, value }, tx);
        const flipUp = value === 'upvote' ? 1 : -1;
        const flipDown = value === 'upvote' ? -1 : 1;
        await this.repo.incrementVoteCount(commentId, flipUp, flipDown, tx);
      } else {
        await this.repo.upsertVote({ userId, commentId, value }, tx);
        const upDelta = value === 'upvote' ? 1 : 0;
        const downDelta = value === 'downvote' ? 1 : 0;
        await this.repo.incrementVoteCount(commentId, upDelta, downDelta, tx);
      }
    });

    this.eventBus.emitVoteCast({
      eventType: 'vote_cast',
      commentId,
      voterId: userId,
      value,
      timestamp: new Date(),
    });

    this.logger.debug({ event: 'vote_cast', userId, commentId, value });
  }

  async removeVote(params: { userId: string; commentId: string }): Promise<void> {
    const { userId, commentId } = params;

    await this.repo.transactionally(async (tx) => {
      const comment = await this.repo.getCommentByIdForUpdate(commentId, tx);
      if (!comment) {
        throw new CommentNotFoundError(commentId);
      }
      if (comment.isHidden || comment.deletedAt !== null) {
        throw new CommentNotFoundError(commentId);
      }

      const existing = await this.repo.getUserVoteForComment(userId, commentId, tx);
      if (existing === null) return;

      const deltaUp = existing === 'upvote' ? -1 : 0;
      const deltaDown = existing === 'downvote' ? -1 : 0;

      await this.repo.incrementVoteCount(commentId, deltaUp, deltaDown, tx);
      await this.repo.removeVote({ userId, commentId }, tx);
    });

    this.eventBus.emitVoteRemoved({
      eventType: 'vote_removed',
      commentId,
      voterId: userId,
      timestamp: new Date(),
    });

    this.logger.debug({ event: 'vote_removed', userId, commentId });
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

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

  async reviewReport(params: ReviewReportParams): Promise<ReportView> {
    const updated = await this.repo.reviewReport(params);

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

    return updated;
  }

  // ─── Moderation ───────────────────────────────────────────────────────────

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
      }
    });

    const comment = await this.repo.getCommentById(params.commentId);
    if (comment === null) {
      throw new CommentNotFoundError(params.commentId);
    }

    this.eventBus.emitCommentHidden({
      eventType: 'comment_hidden',
      commentId: params.commentId,
      quizId: comment.quizId,
      moderatorId: params.moderatorId,
      timestamp: new Date(),
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
    });

    const comment = await this.repo.getCommentById(params.commentId);
    if (comment === null) {
      throw new CommentNotFoundError(params.commentId);
    }

    this.eventBus.emitCommentRestored({
      eventType: 'comment_restored',
      commentId: params.commentId,
      quizId: comment.quizId,
      moderatorId: params.moderatorId,
      timestamp: new Date(),
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

// Re-export the `UserPublicInfo` so existing callers that imported the
// type from the service file keep compiling until Phase 9.7 retires
// the cross-module listener re-exports.
export type { UserPublicInfo };
