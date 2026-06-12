import { Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { DISCUSSION_REPOSITORY_PORT } from '../domain/ports';
import type { DiscussionRepositoryPort } from '../domain/ports';
import { DiscussionService } from '../domain/services/discussion.service';
import { DiscussionModeratorAuditService } from '../infrastructure/audit/discussion-moderator-audit.service';
import { QuizDiscussionCursorMapper } from '../mappers/quiz-discussion-cursor.mapper';
import { MyCommentCursorMapper } from '../mappers/my-comment-cursor.mapper';
import {
  MyUpvotedThreadCursorMapper,
  type MyUpvotedThreadCursor,
} from '../mappers/my-upvoted-thread-cursor.mapper';
import {
  MyUpvotedCommentCursorMapper,
  type MyUpvotedCommentCursor,
} from '../mappers/my-upvoted-comment-cursor.mapper';
import {
  MyDiscussionSubscriptionCursorMapper,
  type MyDiscussionSubscriptionCursor,
} from '../mappers/my-discussion-subscription-cursor.mapper';
import {
  MySavedThreadCursorMapper,
  type MySavedThreadCursor,
} from '../mappers/my-saved-thread-cursor.mapper';
import { TrendingDiscussionCursorMapper } from '../mappers/trending-discussion-cursor.mapper';
import { UnansweredDiscussionCursorMapper } from '../mappers/unanswered-discussion-cursor.mapper';
import { SearchDiscussionsCursorMapper } from '../mappers/search-discussions-cursor.mapper';
import {
  DiscussionThreadStatus,
  ThreadSortField,
  SortOrder,
  DiscussionReportStatus,
  DiscussionReportTargetType,
  DiscussionVoteValue,
} from '../domain/types';
import type {
  DiscussionThread,
  DiscussionThreadDetail,
  DiscussionComment,
  DiscussionCommentWithReplies,
  DiscussionReport,
  QuizDiscussionCursor,
  QuizDiscussionListItem,
  MyDiscussionListItem,
  MyCommentCursor,
  MyCommentListItem,
  TrendingDiscussionCursor,
  TrendingDiscussionListItem,
  UnansweredDiscussionCursor,
  UnansweredDiscussionListItem,
  SearchDiscussionListItem,
  RelatedDiscussionListItem,
  ThreadParticipantListItem,
  PublicDiscussionProfile,
  MyUpvotedThreadListItem,
  MyUpvotedCommentListItem,
  MyDiscussionSubscriptionListItem,
  MySavedThreadListItem,
  SearchDiscussionsCursor,
  ThreadStats,
  MyDiscussionStats,
} from '../domain/types';

@Injectable()
export class DiscussionApplicationService {
  constructor(
    private readonly discussionService: DiscussionService,
    @Inject(DISCUSSION_REPOSITORY_PORT)
    private readonly discussionRepository: DiscussionRepositoryPort,
    private readonly moderatorAudit: DiscussionModeratorAuditService,
  ) {}

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
      status?: DiscussionThreadStatus;
      sortBy?: ThreadSortField;
      sortOrder?: SortOrder;
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
    const { items, limit, hasNextPage, nextCursor } =
      await this.discussionService.listQuizDiscussions(quizId, query);

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
    const { items, limit, hasNextPage, nextCursor } =
      await this.discussionService.listMyDiscussions(userId, query);

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? QuizDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMyComments(
    userId: string,
    query: { limit?: number; cursor?: MyCommentCursor | null },
  ): Promise<{
    items: MyCommentListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMyComments(
      userId,
      query,
    );

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? MyCommentCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMyUpvotedThreads(
    user: JwtPayload,
    query: { limit?: number; cursor?: MyUpvotedThreadCursor | null },
  ): Promise<{
    items: MyUpvotedThreadListItem[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMyUpvotedThreads(user.sub, query);
    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? MyUpvotedThreadCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMyUpvotedComments(
    user: JwtPayload,
    query: { limit?: number; cursor?: MyUpvotedCommentCursor | null },
  ): Promise<{
    items: MyUpvotedCommentListItem[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMyUpvotedComments(user.sub, query);
    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? MyUpvotedCommentCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMyDiscussionSubscriptions(
    user: JwtPayload,
    query: { limit?: number; cursor?: MyDiscussionSubscriptionCursor | null },
  ): Promise<{
    items: MyDiscussionSubscriptionListItem[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMyDiscussionSubscriptions(user.sub, query);
    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? MyDiscussionSubscriptionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listMySavedThreads(
    user: JwtPayload,
    query: { limit?: number; cursor?: MySavedThreadCursor | null },
  ): Promise<{
    items: MySavedThreadListItem[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }> {
    const { items, limit, hasNextPage, nextCursor } = await this.discussionService.listMySavedThreads(user.sub, query);
    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? MySavedThreadCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async subscribeToThread(user: JwtPayload, threadId: string): Promise<{ success: true }> {
    return this.discussionService.subscribeToThread(user.sub, threadId);
  }

  async unsubscribeFromThread(user: JwtPayload, threadId: string): Promise<{ success: true }> {
    return this.discussionService.unsubscribeFromThread(user.sub, threadId);
  }

  async saveThread(user: JwtPayload, threadId: string): Promise<{ success: true }> {
    return this.discussionService.saveThread(user.sub, threadId);
  }

  async unsaveThread(user: JwtPayload, threadId: string): Promise<{ success: true }> {
    return this.discussionService.unsaveThread(user.sub, threadId);
  }

  async listCommentsByUser(
    userId: string,
    query: { limit?: number; cursor?: MyCommentCursor | null },
  ): Promise<{
    items: MyCommentListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.discussionRepository.listMyComments({
      userId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastItem
            ? MyCommentCursorMapper.serialize({ createdAt: lastItem.createdAt, commentId: lastItem.commentId })
            : null,
      },
    };
  }

  async listTrendingDiscussions(query: {
    limit?: number;
    cursor?: TrendingDiscussionCursor | null;
  }): Promise<{
    items: TrendingDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.discussionService.listTrendingDiscussions(query);

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? TrendingDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listUnansweredDiscussions(query: {
    limit?: number;
    cursor?: UnansweredDiscussionCursor | null;
  }): Promise<{
    items: UnansweredDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.discussionService.listUnansweredDiscussions(query);

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? UnansweredDiscussionCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async searchDiscussions(query: {
    q?: string;
    limit?: number;
    cursor?: SearchDiscussionsCursor | null;
  }): Promise<{
    items: SearchDiscussionListItem[];
    pagination: {
      limit: number;
      hasNextPage: boolean;
      nextCursor: string | null;
    };
  }> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.discussionService.searchDiscussions(query);

    return {
      items,
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? SearchDiscussionsCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listRelatedDiscussions(
    threadId: string,
    query: { limit?: number },
  ): Promise<{ items: RelatedDiscussionListItem[] }> {
    const items = await this.discussionService.listRelatedDiscussions(threadId, query);

    return { items };
  }

  async listThreadParticipants(threadId: string): Promise<{ items: ThreadParticipantListItem[] }> {
    const items = await this.discussionService.listThreadParticipants(threadId);

    return { items };
  }

  async getPublicDiscussionProfile(userId: string): Promise<PublicDiscussionProfile> {
    return this.discussionService.getPublicDiscussionProfile(userId);
  }

  async getThreadStats(threadId: string): Promise<ThreadStats | null> {
    return this.discussionService.getThreadStats(threadId);
  }

  async getMyDiscussionStats(user: JwtPayload): Promise<MyDiscussionStats> {
    return this.discussionService.getMyDiscussionStats(user.sub);
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

  async markThreadAsSolved(
    user: JwtPayload,
    threadId: string,
    commentId: string,
  ): Promise<DiscussionThread> {
    const usernames = await this.discussionRepository.getUsernamesForUsers([user.sub]);
    const solverUsername = usernames.get(user.sub) ?? '';

    return this.discussionService.markThreadAsSolved({
      threadId,
      commentId,
      actorId: user.sub,
      solverUsername,
    });
  }

  async unsolveThread(user: JwtPayload, threadId: string): Promise<DiscussionThread> {
    return this.discussionService.unsolveThread({
      threadId,
      actorId: user.sub,
    });
  }

  async deleteThread(user: JwtPayload, threadId: string): Promise<void> {
    return this.discussionService.deleteThread(threadId, user.sub);
  }

  async hideThread(user: JwtPayload, threadId: string): Promise<void> {
    await this.discussionService.hideThread(threadId, user.sub, user.role);
    await this.moderatorAudit.log({
      actorId: user.sub,
      actorRole: user.role,
      action: 'hide_thread',
      targetType: 'thread',
      targetId: threadId,
    });
  }

  async restoreThread(user: JwtPayload, threadId: string): Promise<void> {
    await this.discussionService.restoreThread(threadId, user.sub, user.role);
    await this.moderatorAudit.log({
      actorId: user.sub,
      actorRole: user.role,
      action: 'restore_thread',
      targetType: 'thread',
      targetId: threadId,
    });
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
    await this.discussionService.hideComment(commentId, user.sub, user.role);
    await this.moderatorAudit.log({
      actorId: user.sub,
      actorRole: user.role,
      action: 'hide_comment',
      targetType: 'comment',
      targetId: commentId,
    });
  }

  async restoreComment(user: JwtPayload, commentId: string): Promise<void> {
    await this.discussionService.restoreComment(commentId, user.sub, user.role);
    await this.moderatorAudit.log({
      actorId: user.sub,
      actorRole: user.role,
      action: 'restore_comment',
      targetType: 'comment',
      targetId: commentId,
    });
  }

  // ─── VOTES ─────────────────────────────────────────────────────────────────

  async vote(
    user: JwtPayload,
    targetType: DiscussionReportTargetType,
    targetId: string,
    value: DiscussionVoteValue,
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
    targetType: DiscussionReportTargetType,
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
    targetType: DiscussionReportTargetType,
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
    await this.discussionService.reviewReport(reportId, user.sub, status, actionTaken);
    await this.moderatorAudit.log({
      actorId: user.sub,
      actorRole: user.role,
      action: 'review_report',
      targetType: 'report',
      targetId: reportId,
      result: status,
    });
  }

  async listReports(
    user: JwtPayload,
    filters: {
      status?: DiscussionReportStatus;
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<{ items: DiscussionReport[]; hasNextPage: boolean }> {
    return this.discussionService.listReports(filters);
  }
}
