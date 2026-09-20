import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CommentService } from '../domain/services/comment.service';
import { parseCommentCursor, serializeCommentCursor } from '../mappers/comment-cursor.mapper';
import { parseReportCursor, serializeReportCursor } from '../mappers/report-cursor.mapper';
import { sliceWithCursor } from './pagination.helper';
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
  constructor(private readonly commentService: CommentService) {}

  async getComment(
    _viewer: JwtPayload | undefined,
    commentId: string,
  ): Promise<CommentView | null> {
    return this.commentService.getComment({ commentId, viewerId: _viewer?.sub ?? null });
  }

  async listQuizComments(
    viewer: JwtPayload | undefined,
    quizId: string,
    query: { limit?: number; cursor?: string | null },
  ): Promise<{
    items: CommentWithRepliesView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? parseCommentCursor(query.cursor) : null;
    const result = await this.commentService.listComments({
      quizId,
      limit,
      cursor,
      viewerId: viewer?.sub ?? null,
    });

    return {
      items: result.items,
      pagination: {
        limit,
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
    const limit = filters.limit ?? 20;
    const cursor = filters.cursor ? parseReportCursor(filters.cursor) : null;
    const result = await this.commentService.listReports({
      status: filters.status,
      limit,
      cursor,
    });
    const sliced = sliceWithCursor(result.items, limit, (row) => ({
      createdAt: row.createdAt,
      id: row.reportId,
    }));

    return {
      items: sliced.items,
      pagination: {
        limit,
        hasNextPage: sliced.hasNextPage,
        nextCursor: serializeReportCursor(
          sliced.nextCursor
            ? {
                createdAt: sliced.nextCursor.createdAt,
                id: sliced.nextCursor.id,
              }
            : null,
        ),
      },
    };
  }

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
    dto: { body: string; expectedUpdatedAt?: string },
  ): Promise<CommentView> {
    const params: EditCommentParams = {
      commentId,
      authorId: user.sub,
      body: dto.body,
      expectedUpdatedAt: dto.expectedUpdatedAt,
    };
    return this.commentService.editComment(params);
  }

  async deleteComment(user: JwtPayload, commentId: string): Promise<void> {
    return this.commentService.deleteComment({ commentId, authorId: user.sub });
  }

  async vote(user: JwtPayload, commentId: string, value: VoteValue): Promise<void> {
    const params: VoteParams = { userId: user.sub, commentId, value };
    return this.commentService.vote(params);
  }

  async removeVote(user: JwtPayload, commentId: string): Promise<void> {
    return this.commentService.removeVote({ userId: user.sub, commentId });
  }

  async reportComment(
    user: JwtPayload,
    commentId: string,
    dto: { reason: string; details?: string | null; idempotencyKey?: string },
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
    const { updated } = await this.commentService.reviewReport(params);
    return updated;
  }

  async hideComment(moderator: JwtPayload, commentId: string): Promise<ModerationResult> {
    return this.commentService.hideComment({ commentId, moderatorId: moderator.sub }, moderator);
  }

  async restoreComment(moderator: JwtPayload, commentId: string): Promise<ModerationResult> {
    return this.commentService.restoreComment({ commentId, moderatorId: moderator.sub }, moderator);
  }
}

export type { VoteValue };
