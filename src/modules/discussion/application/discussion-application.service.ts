import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DiscussionService } from '../domain/services/discussion.service';
import { QuizDiscussionCursorMapper } from '../mappers/quiz-discussion-cursor.mapper';
import type {
  DiscussionThread,
  DiscussionThreadDetail,
  DiscussionComment,
  DiscussionCommentWithReplies,
  DiscussionReport,
  QuizDiscussionCursor,
  QuizDiscussionListItem,
  MyDiscussionListItem,
} from '../domain/types';

@Injectable()
export class DiscussionApplicationService {
  constructor(private readonly discussionService: DiscussionService) {}

  // ─── THREADS ────────────────────────────────────────────────────────────────

  async createThread(
    user: JwtPayload,
    quizId: string,
    title: string,
    body: string,
  ): Promise<DiscussionThread> {
    return this.discussionService.createThread({
      quizId,
      authorId: user.sub,
      title,
      body,
    });
  }

  async getThread(user: JwtPayload, threadId: string): Promise<DiscussionThreadDetail | null> {
    return this.discussionService.getThread(threadId, user.sub);
  }

  async listThreads(
    user: JwtPayload,
    filters: {
      quizId?: string;
      authorId?: string;
      status?: 'open' | 'closed' | 'hidden' | 'deleted';
      sortBy?: 'created_at' | 'votes_count' | 'comments_count';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<{ items: DiscussionThread[]; hasNextPage: boolean }> {
    return this.discussionService.listThreads(filters);
  }

  async listQuizDiscussions(
    quizId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: QuizDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listQuizDiscussions(
      quizId,
      query,
    );

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? QuizDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMyDiscussions(
    userId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: MyDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMyDiscussions(
      userId,
      query,
    );

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? QuizDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listDiscussionsByUser(
    userId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: MyDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listDiscussionsByUser(
      userId,
      query,
    );

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? QuizDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async updateThread(
    user: JwtPayload,
    threadId: string,
    dto: { title?: string; body?: string },
  ): Promise<DiscussionThread> {
    return this.discussionService.updateThread({
      threadId,
      authorId: user.sub,
      title: dto.title,
      body: dto.body,
    });
  }

  async closeThread(user: JwtPayload, threadId: string): Promise<void> {
    return this.discussionService.closeThread(threadId, user.sub);
  }

  async reopenThread(user: JwtPayload, threadId: string): Promise<void> {
    return this.discussionService.reopenThread(threadId, user.sub);
  }

  async deleteThread(user: JwtPayload, threadId: string): Promise<void> {
    return this.discussionService.deleteThread(threadId, user.sub);
  }

  async hideThread(user: JwtPayload, threadId: string): Promise<void> {
    return this.discussionService.hideThread(threadId, user.sub);
  }

  // ─── COMMENTS ───────────────────────────────────────────────────────────────

  async createComment(
    user: JwtPayload,
    threadId: string,
    body: string,
    parentCommentId?: string | null,
  ): Promise<DiscussionComment> {
    return this.discussionService.createComment({
      threadId,
      authorId: user.sub,
      parentCommentId: parentCommentId ?? null,
      body,
    });
  }

  async getComment(user: JwtPayload, commentId: string): Promise<DiscussionComment | null> {
    return this.discussionService.getComment(commentId);
  }

  async listComments(
    user: JwtPayload,
    threadId: string,
    options?: { parentCommentId?: string | null; limit?: number; cursor?: string | null },
  ): Promise<{ items: DiscussionCommentWithReplies[]; hasNextPage: boolean }> {
    return this.discussionService.listComments({
      threadId,
      parentCommentId: options?.parentCommentId ?? null,
      limit: options?.limit ?? 20,
      cursor: options?.cursor ?? null,
    });
  }

  async updateComment(
    user: JwtPayload,
    commentId: string,
    body: string,
  ): Promise<DiscussionComment> {
    return this.discussionService.updateComment({
      commentId,
      authorId: user.sub,
      body,
    });
  }

  async deleteComment(user: JwtPayload, commentId: string): Promise<void> {
    return this.discussionService.deleteComment(commentId, user.sub);
  }

  async hideComment(user: JwtPayload, commentId: string): Promise<void> {
    return this.discussionService.hideComment(commentId, user.sub);
  }

  // ─── VOTES ─────────────────────────────────────────────────────────────────

  async vote(
    user: JwtPayload,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
    value: 'upvote' | 'downvote',
  ): Promise<void> {
    return this.discussionService.vote({
      userId: user.sub,
      targetType,
      targetId,
      value,
    });
  }

  async removeVote(
    user: JwtPayload,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
  ): Promise<void> {
    return this.discussionService.removeVote({
      userId: user.sub,
      targetType,
      targetId,
    });
  }

  // ─── REPORTS ───────────────────────────────────────────────────────────────

  async report(
    user: JwtPayload,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
    reason: string,
    details?: string | null,
  ): Promise<void> {
    return this.discussionService.report({
      reporterId: user.sub,
      targetType,
      targetId,
      reason,
      details: details ?? null,
    });
  }

  async reviewReport(
    user: JwtPayload,
    reportId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    actionTaken = false,
  ): Promise<void> {
    return this.discussionService.reviewReport(reportId, user.sub, status, actionTaken);
  }

  async listReports(
    user: JwtPayload,
    filters: {
      status?: 'open' | 'reviewed' | 'dismissed' | 'actioned';
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<{ items: DiscussionReport[]; hasNextPage: boolean }> {
    return this.discussionService.listReports(filters);
  }
}
