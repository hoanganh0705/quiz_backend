/**
 * Comment Application Service
 *
 * Wraps the domain service with:
 *   - JWT subject resolution for write paths
 *   - Per-viewer vote enrichment for read paths
 *   - Cursor (de)serialization at the transport boundary
 *   - Audit log writes for moderator actions
 *
 * The application service is the only collaborator the controllers
 * (and the presenter) import. The domain service is not exported
 * from the module, per the plan §8.4.
 */

import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentService } from '../domain/services/comment.service';
import { CommentModeratorAuditService } from '../infrastructure/audit/comment-moderator-audit.service';
import { parseCommentCursor, serializeCommentCursor } from '../mappers/comment-cursor.mapper';
import { parseReportCursor, serializeReportCursor } from '../mappers/report-cursor.mapper';
import type {
  CommentView,
  CommentWithRepliesView,
  CreateCommentParams,
  EditCommentParams,
  ModerationResult,
  MyCommentView,
  ReportCommentParams,
  ReportStatus,
  ReportView,
  ReviewReportParams,
  ReviewReportStatus,
  VoteParams,
  VoteValue,
} from '../domain/types';

@Injectable()
export class CommentApplicationService {
  constructor(
    private readonly commentService: CommentService,
    private readonly moderatorAudit: CommentModeratorAuditService,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  async getComment(
    _viewer: JwtPayload | undefined,
    commentId: string,
  ): Promise<CommentView | null> {
    return this.commentService.getComment({ commentId });
  }

  async listQuizComments(
    viewer: JwtPayload | undefined,
    quizId: string,
    query: { limit?: number; cursor?: string | null },
  ): Promise<{
    items: CommentWithRepliesView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const cursor = query.cursor ? parseCommentCursor(query.cursor) : null;
    const result = await this.commentService.listComments({
      quizId,
      limit: query.limit ?? 20,
      cursor,
      viewerId: viewer?.sub ?? null,
    });

    return {
      items: result.items,
      pagination: {
        limit: query.limit ?? 20,
        hasNextPage: result.hasNextPage,
        nextCursor: serializeCommentCursor(result.nextCursor),
      },
    };
  }

  async listMyComments(
    user: JwtPayload,
    query: { limit?: number; cursor?: string | null },
  ): Promise<{
    items: MyCommentView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const cursor = query.cursor ? parseCommentCursor(query.cursor) : null;
    const result = await this.commentService.listMyComments({
      userId: user.sub,
      limit: query.limit ?? 20,
      cursor,
    });

    return {
      items: result.items,
      pagination: {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        nextCursor: serializeCommentCursor(result.nextCursor),
      },
    };
  }

  async listUserComments(
    _viewer: JwtPayload | undefined,
    userId: string,
    query: { limit?: number; cursor?: string | null },
  ): Promise<{
    items: MyCommentView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const cursor = query.cursor ? parseCommentCursor(query.cursor) : null;
    const result = await this.commentService.listMyComments({
      userId,
      limit: query.limit ?? 20,
      cursor,
    });

    return {
      items: result.items,
      pagination: {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        nextCursor: serializeCommentCursor(result.nextCursor),
      },
    };
  }

  async listReports(
    _moderator: JwtPayload,
    filters: { status?: ReportStatus; limit?: number; cursor?: string | null },
  ): Promise<{
    items: ReportView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const cursor = filters.cursor ? parseReportCursor(filters.cursor) : null;
    const result = await this.commentService.listReports({
      status: filters.status,
      limit: filters.limit ?? 20,
      cursor,
    });

    return {
      items: result.items,
      pagination: {
        limit: filters.limit ?? 20,
        hasNextPage: result.hasNextPage,
        nextCursor: serializeReportCursor(result.nextCursor),
      },
    };
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  async createComment(
    user: JwtPayload,
    quizId: string,
    dto: { body: string; parentCommentId?: string | null },
  ): Promise<CommentView> {
    const params: CreateCommentParams = {
      quizId,
      authorId: user.sub,
      parentCommentId: dto.parentCommentId ?? null,
      body: dto.body,
    };
    return this.commentService.createComment(params);
  }

  async editComment(
    user: JwtPayload,
    commentId: string,
    dto: { body: string },
  ): Promise<CommentView> {
    const params: EditCommentParams = {
      commentId,
      authorId: user.sub,
      body: dto.body,
    };
    return this.commentService.editComment(params);
  }

  async deleteComment(user: JwtPayload, commentId: string): Promise<void> {
    return this.commentService.deleteComment({ commentId, authorId: user.sub });
  }

  // ─── Votes ────────────────────────────────────────────────────────────────

  async vote(user: JwtPayload, commentId: string, value: VoteValue): Promise<void> {
    const params: VoteParams = { userId: user.sub, commentId, value };
    return this.commentService.vote(params);
  }

  async removeVote(user: JwtPayload, commentId: string): Promise<void> {
    return this.commentService.removeVote({ userId: user.sub, commentId });
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  async reportComment(
    user: JwtPayload,
    commentId: string,
    dto: { reason: string; details?: string | null },
  ): Promise<ReportView> {
    const params: ReportCommentParams = {
      reporterId: user.sub,
      commentId,
      reason: dto.reason,
      details: dto.details ?? null,
    };
    return this.commentService.reportComment(params);
  }

  async reviewReport(
    moderator: JwtPayload,
    reportId: string,
    dto: { status: ReviewReportStatus; actionTaken?: boolean },
  ): Promise<ReportView> {
    const params: ReviewReportParams = {
      reportId,
      reviewerId: moderator.sub,
      status: dto.status,
      actionTaken: dto.actionTaken ?? false,
    };
    const updated = await this.commentService.reviewReport(params);
    await this.moderatorAudit.log({
      actorId: moderator.sub,
      actorRole: moderator.role,
      action: 'review_report',
      targetType: 'comment',
      targetId: updated.commentId,
      result: dto.status,
    });
    return updated;
  }

  // ─── Moderation ───────────────────────────────────────────────────────────

  async hideComment(moderator: JwtPayload, commentId: string): Promise<ModerationResult> {
    const result = await this.commentService.hideComment(
      { commentId, moderatorId: moderator.sub },
      moderator,
    );
    await this.moderatorAudit.log({
      actorId: moderator.sub,
      actorRole: moderator.role,
      action: 'hide_comment',
      targetType: 'comment',
      targetId: commentId,
    });
    return result;
  }

  async restoreComment(moderator: JwtPayload, commentId: string): Promise<ModerationResult> {
    const result = await this.commentService.restoreComment(
      { commentId, moderatorId: moderator.sub },
      moderator,
    );
    await this.moderatorAudit.log({
      actorId: moderator.sub,
      actorRole: moderator.role,
      action: 'restore_comment',
      targetType: 'comment',
      targetId: commentId,
    });
    return result;
  }
}

// Re-export the `VoteValue` type so the controller imports stay clean.
export type { VoteValue };
