import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_REPOSITORY_PORT,
  QUIZ_EXISTENCE_PORT,
  type DiscussionRepositoryPort,
} from '../ports';
import type { QuizExistencePort } from '../ports/quiz-existence.port';
import { DISCUSSION_DOMAIN_EVENT_BUS, type DiscussionDomainEventBusPort } from '../events';
import type {
  DiscussionThread,
  DiscussionThreadDetail,
  DiscussionComment,
  DiscussionCommentWithReplies,
  DiscussionReport,
  CreateThreadParams,
  UpdateThreadParams,
  CreateCommentParams,
  UpdateCommentParams,
  VoteParams,
  ReportParams,
  ListThreadsParams,
  ListCommentsParams,
  ListReportsParams,
  QuizDiscussionCursor,
  QuizDiscussionListItem,
  MyDiscussionListItem,
  MyCommentCursor,
  MyCommentListItem,
  MyUpvotedThreadListItem,
  MyUpvotedCommentListItem,
  MyDiscussionSubscriptionListItem,
  MySavedThreadListItem,
  TrendingDiscussionCursor,
  TrendingDiscussionListItem,
  UnansweredDiscussionCursor,
  UnansweredDiscussionListItem,
  SearchDiscussionListItem,
  SearchDiscussionsCursor,
  ThreadStats,
  MyDiscussionStats,
  RelatedDiscussionListItem,
  ThreadParticipantListItem,
  PublicDiscussionProfile,
} from '../types';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';
import { UserNotFoundError } from '@/modules/user/domain/errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import {
  ThreadNotFoundError,
  CommentNotFoundError,
  ThreadForbiddenError,
  CommentForbiddenError,
  ThreadClosedError,
  ThreadNotActiveError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
} from '../errors';

@Injectable()
export class DiscussionService {
  constructor(
    @Inject(DISCUSSION_REPOSITORY_PORT)
    private readonly repo: DiscussionRepositoryPort,
    @Inject(QUIZ_EXISTENCE_PORT)
    private readonly quizExistence: QuizExistencePort,
    @Inject(forwardRef(() => USER_REPOSITORY_PORT))
    private readonly userRepository: UserRepositoryPort,
    @Inject(DISCUSSION_DOMAIN_EVENT_BUS)
    private readonly eventBus: DiscussionDomainEventBusPort,
    @InjectPinoLogger(DiscussionService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ─── THREADS ────────────────────────────────────────────────────────────────

  async createThread(params: CreateThreadParams): Promise<DiscussionThread> {
    const quizExists = await this.quizExistence.exists(params.quizId);
    if (!quizExists) {
      throw new Error('Quiz not found');
    }

    this.logger.debug({
      event: 'thread_created',
      quizId: params.quizId,
      authorId: params.authorId,
    });

    return this.repo.createThread(params);
  }

  async getThread(threadId: string, userId?: string): Promise<DiscussionThreadDetail | null> {
    return this.repo.getThreadDetail(threadId, userId ?? null);
  }

  async listThreads(params: ListThreadsParams): Promise<{
    items: DiscussionThread[];
    hasNextPage: boolean;
  }> {
    const items = await this.repo.listThreads({ ...params, limit: (params.limit ?? 20) + 1 });
    const hasNextPage = items.length > (params.limit ?? 20);
    return { items: hasNextPage ? items.slice(0, -1) : items, hasNextPage };
  }

  async listQuizDiscussions(
    quizId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: QuizDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: QuizDiscussionCursor | null;
  }> {
    const quizExists = await this.quizExistence.exists(quizId);
    if (!quizExists) {
      throw new Error('Quiz not found');
    }

    const limit = query.limit ?? 20;
    const rows = await this.repo.listQuizDiscussions({
      quizId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listMyDiscussions(
    userId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: MyDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: QuizDiscussionCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMyDiscussions({
      userId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listDiscussionsByUser(
    userId: string,
    query: { limit?: number; cursor?: QuizDiscussionCursor | null },
  ): Promise<{
    items: MyDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: QuizDiscussionCursor | null;
  }> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'discussion_user_not_found', userId });
      throw new UserNotFoundError();
    }

    const limit = query.limit ?? 20;
    const rows = await this.repo.listDiscussionsByUser({
      userId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listMyComments(
    userId: string,
    query: { limit?: number; cursor?: MyCommentCursor | null },
  ): Promise<{
    items: MyCommentListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MyCommentCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMyComments({
      userId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, commentId: lastItem.commentId }
          : null,
    };
  }

  async listMyUpvotedThreads(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<{ items: MyUpvotedThreadListItem[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repo.listMyUpvotedThreads({
      userId,
      page,
      limit,
    });

    this.logger.debug({
      event: 'my_upvoted_threads_listed',
      userId,
      page,
      limit,
      total: result.total,
      resultCount: result.items.length,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async listMyUpvotedComments(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<{ items: MyUpvotedCommentListItem[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repo.listMyUpvotedComments({
      userId,
      page,
      limit,
    });

    this.logger.debug({
      event: 'my_upvoted_comments_listed',
      userId,
      page,
      limit,
      total: result.total,
      resultCount: result.items.length,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async listMyDiscussionSubscriptions(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<{ items: MyDiscussionSubscriptionListItem[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repo.listMyDiscussionSubscriptions({
      userId,
      page,
      limit,
    });

    this.logger.debug({
      event: 'my_discussion_subscriptions_listed',
      userId,
      page,
      limit,
      total: result.total,
      resultCount: result.items.length,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async listMySavedThreads(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<{ items: MySavedThreadListItem[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repo.listMySavedThreads({
      userId,
      page,
      limit,
    });

    this.logger.debug({
      event: 'my_saved_threads_listed',
      userId,
      page,
      limit,
      total: result.total,
      resultCount: result.items.length,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async subscribeToThread(userId: string, threadId: string): Promise<{ success: true }> {
    const thread = await this.repo.getThreadById(threadId);

    if (!thread) {
      this.logger.warn({ event: 'discussion_thread_not_found', threadId, userId });
      throw new ThreadNotFoundError(threadId);
    }

    if (thread.status !== 'open') {
      this.logger.warn({ event: 'discussion_thread_not_active', threadId, userId, status: thread.status });
      throw new ThreadNotActiveError();
    }

    await this.repo.subscribeToThread({ userId, threadId });

    this.logger.info({ event: 'thread_subscribed', userId, threadId });

    return { success: true };
  }

  async unsubscribeFromThread(userId: string, threadId: string): Promise<{ success: true }> {
    const thread = await this.repo.getThreadById(threadId);

    if (!thread) {
      this.logger.warn({ event: 'discussion_thread_not_found', threadId, userId });
      throw new ThreadNotFoundError(threadId);
    }

    await this.repo.unsubscribeFromThread({ userId, threadId });

    this.logger.info({ event: 'thread_unsubscribed', userId, threadId });

    return { success: true };
  }

  async saveThread(userId: string, threadId: string): Promise<{ success: true }> {
    const thread = await this.repo.getThreadById(threadId);

    if (!thread) {
      this.logger.warn({ event: 'discussion_thread_not_found', threadId, userId });
      throw new ThreadNotFoundError(threadId);
    }

    if (thread.status !== 'open') {
      this.logger.warn({ event: 'discussion_thread_not_active', threadId, userId, status: thread.status });
      throw new ThreadNotActiveError();
    }

    await this.repo.saveThread({ userId, threadId });

    this.logger.info({ event: 'thread_saved', userId, threadId });

    return { success: true };
  }

  async unsaveThread(userId: string, threadId: string): Promise<{ success: true }> {
    const thread = await this.repo.getThreadById(threadId);

    if (!thread) {
      this.logger.warn({ event: 'discussion_thread_not_found', threadId, userId });
      throw new ThreadNotFoundError(threadId);
    }

    await this.repo.unsaveThread({ userId, threadId });

    this.logger.info({ event: 'thread_unsaved', userId, threadId });

    return { success: true };
  }

  async listTrendingDiscussions(
    query: { limit?: number; cursor?: TrendingDiscussionCursor | null },
  ): Promise<{
    items: TrendingDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: TrendingDiscussionCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listTrendingDiscussions({
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { score: lastItem.trendingScore, threadId: lastItem.threadId }
          : null,
    };
  }

  async listUnansweredDiscussions(
    query: { limit?: number; cursor?: UnansweredDiscussionCursor | null },
  ): Promise<{
    items: UnansweredDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: UnansweredDiscussionCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listUnansweredDiscussions({
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async searchDiscussions(
    query: { q?: string; limit?: number; cursor?: SearchDiscussionsCursor | null },
  ): Promise<{
    items: SearchDiscussionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: SearchDiscussionsCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.searchDiscussions({
      query: query.q ?? '',
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listRelatedDiscussions(
    threadId: string,
    query: { limit?: number },
  ): Promise<RelatedDiscussionListItem[]> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) {
      this.logger.warn({ event: 'related_discussion_thread_not_found', threadId });
      throw new ThreadNotFoundError(threadId);
    }

    const limit = Math.min(query.limit ?? 10, 10);
    const items = await this.repo.findRelatedThreads({ threadId, limit });

    this.logger.debug({
      event: 'related_discussions_listed',
      threadId,
      requestedLimit: query.limit ?? 10,
      appliedLimit: limit,
      resultCount: items.length,
    });

    return items;
  }

  async listThreadParticipants(threadId: string): Promise<ThreadParticipantListItem[]> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) {
      this.logger.warn({ event: 'thread_participants_thread_not_found', threadId });
      throw new ThreadNotFoundError(threadId);
    }

    const items = await this.repo.listThreadParticipants(threadId);

    this.logger.debug({
      event: 'thread_participants_listed',
      threadId,
      resultCount: items.length,
    });

    return items;
  }

  async getPublicDiscussionProfile(userId: string): Promise<PublicDiscussionProfile> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'discussion_profile_user_not_found', userId });
      throw new UserNotFoundError();
    }

    const profile = await this.repo.getPublicDiscussionProfile(userId);

    this.logger.debug({
      event: 'discussion_profile_returned',
      userId,
      threadsCreated: profile.threadsCreated,
      commentsCreated: profile.commentsCreated,
      acceptedAnswers: profile.acceptedAnswers,
      reputation: profile.reputation,
    });

    return profile;
  }

  async getThreadStats(threadId: string): Promise<ThreadStats | null> {
    return this.repo.getThreadStats(threadId);
  }

  async getMyDiscussionStats(userId: string): Promise<MyDiscussionStats> {
    return this.repo.getMyDiscussionStats(userId);
  }

  async listCommentsByUser(
    userId: string,
    query: { limit?: number; cursor?: MyCommentCursor | null },
  ): Promise<{
    items: MyCommentListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MyCommentCursor | null;
  }> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'discussion_comment_user_not_found', userId });
      throw new UserNotFoundError();
    }

    const limit = query.limit ?? 20;
    const rows = await this.repo.listCommentsByUser({
      userId,
      limit,
      cursor: query.cursor ?? null,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, commentId: lastItem.commentId }
          : null,
    };
  }

  async updateThread(params: UpdateThreadParams): Promise<DiscussionThread> {
    const thread = await this.repo.getThreadById(params.threadId);
    if (!thread) throw new ThreadNotFoundError(params.threadId);
    if (thread.status === 'deleted') throw new ThreadNotActiveError();
    if (thread.authorId !== params.authorId) throw new ThreadForbiddenError();

    const updated = await this.repo.updateThread(params);
    this.logger.info({ event: 'thread_updated', threadId: params.threadId });
    return updated;
  }

  async closeThread(threadId: string, userId: string): Promise<void> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    if (thread.status === 'deleted') throw new ThreadNotActiveError();
    if (thread.authorId !== userId) throw new ThreadForbiddenError();

    await this.repo.updateThreadStatus({ threadId, status: 'closed' });
    this.eventBus.emitThreadClosed({
      eventType: 'thread_closed',
      threadId,
      authorId: userId,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'thread_closed', threadId });
  }

  async reopenThread(threadId: string, userId: string): Promise<void> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    if (thread.status === 'deleted') throw new ThreadNotActiveError();
    if (thread.authorId !== userId) throw new ThreadForbiddenError();

    await this.repo.updateThreadStatus({ threadId, status: 'open' });
    this.logger.info({ event: 'thread_reopened', threadId });
  }

  async deleteThread(threadId: string, authorId: string): Promise<void> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    if (thread.authorId !== authorId) throw new ThreadForbiddenError();

    await this.repo.softDeleteCommentsByThread(threadId);
    await this.repo.softDeleteThread({ threadId, authorId });
    this.eventBus.emitThreadDeleted({
      eventType: 'thread_deleted',
      threadId,
      authorId,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'thread_deleted', threadId });
  }

  async hideThread(threadId: string, moderatorId: string): Promise<void> {
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) throw new ThreadNotFoundError(threadId);
    if (thread.status === 'deleted') throw new ThreadNotActiveError();

    await this.repo.updateThreadStatus({ threadId, status: 'hidden' });
    this.eventBus.emitThreadHidden({
      eventType: 'thread_hidden',
      threadId,
      moderatorId,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'thread_hidden', threadId, moderatorId });
  }

  // ─── COMMENTS ───────────────────────────────────────────────────────────────

  async createComment(params: CreateCommentParams): Promise<DiscussionComment> {
    const thread = await this.repo.getThreadById(params.threadId);
    if (!thread) throw new ThreadNotFoundError(params.threadId);
    if (thread.status === 'deleted') throw new ThreadNotActiveError();
    if (thread.status === 'closed') throw new ThreadClosedError();

    if (params.parentCommentId) {
      const parent = await this.repo.getCommentById(params.parentCommentId);
      if (!parent) throw new CommentNotFoundError(params.parentCommentId);
      if (parent.threadId !== params.threadId) {
        throw new Error('Parent comment does not belong to this thread');
      }
    }

    const comment = await this.repo.createComment(params);
    await this.repo.incrementThreadCommentCount(params.threadId, 1);

    if (params.parentCommentId) {
      await this.repo.incrementCommentRepliesCount(params.parentCommentId, 1);
    }

    this.logger.debug({
      event: 'comment_created',
      commentId: comment.commentId,
      threadId: params.threadId,
    });
    this.eventBus.emitCommentCreated({
      eventType: 'comment_created',
      commentId: comment.commentId,
      threadId: params.threadId,
      authorId: params.authorId,
      parentCommentId: params.parentCommentId ?? null,
      isReply: params.parentCommentId !== null,
      timestamp: new Date(),
    });

    return comment;
  }

  async getComment(commentId: string): Promise<DiscussionComment | null> {
    return this.repo.getCommentById(commentId);
  }

  async listComments(params: ListCommentsParams): Promise<{
    items: DiscussionCommentWithReplies[];
    hasNextPage: boolean;
  }> {
    const items = await this.repo.listComments({
      ...params,
      limit: (params.limit ?? 20) + 1,
    });
    const hasNextPage = items.length > (params.limit ?? 20);
    return { items: hasNextPage ? items.slice(0, -1) : items, hasNextPage };
  }

  async updateComment(params: UpdateCommentParams): Promise<DiscussionComment> {
    const comment = await this.repo.getCommentById(params.commentId);
    if (!comment) throw new CommentNotFoundError(params.commentId);
    if (comment.authorId !== params.authorId) throw new CommentForbiddenError();

    const updated = await this.repo.updateComment(params);
    this.logger.info({ event: 'comment_updated', commentId: params.commentId });
    return updated;
  }

  async deleteComment(commentId: string, authorId: string): Promise<void> {
    const comment = await this.repo.getCommentById(commentId);
    if (!comment) throw new CommentNotFoundError(commentId);
    if (comment.authorId !== authorId) throw new CommentForbiddenError();

    await this.repo.softDeleteComment({ commentId, authorId });
    await this.repo.incrementThreadCommentCount(comment.threadId, -1);

    if (comment.parentCommentId) {
      await this.repo.incrementCommentRepliesCount(comment.parentCommentId, -1);
    }

    this.eventBus.emitCommentDeleted({
      eventType: 'comment_deleted',
      commentId,
      threadId: comment.threadId,
      authorId,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'comment_deleted', commentId });
  }

  async hideComment(commentId: string, moderatorId: string): Promise<void> {
    const comment = await this.repo.getCommentById(commentId);
    if (!comment) throw new CommentNotFoundError(commentId);

    await this.repo.updateCommentStatus({ commentId, status: 'hidden' });
    this.eventBus.emitCommentHidden({
      eventType: 'comment_hidden',
      commentId,
      threadId: comment.threadId,
      moderatorId,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'comment_hidden', commentId, moderatorId });
  }

  // ─── VOTES ─────────────────────────────────────────────────────────────────

  async vote(params: VoteParams): Promise<void> {
    const { userId, targetType, targetId, value } = params;

    // Validate target exists and check self-vote
    if (targetType === 'thread') {
      const thread = await this.repo.getThreadById(targetId);
      if (!thread) throw new ThreadNotFoundError(targetId);
      if (thread.authorId === userId) throw new SelfVoteError();
    } else {
      const comment = await this.repo.getCommentById(targetId);
      if (!comment) throw new CommentNotFoundError(targetId);
      if (comment.authorId === userId) throw new SelfVoteError();
    }

    const existingVote = await this.repo.getUserVote(userId, targetType, targetId);

    if (existingVote === value) {
      await this.repo.removeVote({ userId, targetType, targetId });
      const delta = value === 'upvote' ? -1 : -1;
      const deltaDown = value === 'downvote' ? -1 : -1;
      await this.updateTargetVotes(targetType, targetId, -delta, -deltaDown);
    } else {
      await this.repo.upsertVote({ userId, targetType, targetId, value });

      if (existingVote) {
        const flipUp = value === 'upvote' ? 1 : -1;
        const flipDown = value === 'upvote' ? -1 : 1;
        await this.updateTargetVotes(targetType, targetId, flipUp, flipDown);
      } else {
        const upDelta = value === 'upvote' ? 1 : 0;
        const downDelta = value === 'downvote' ? 1 : 0;
        await this.updateTargetVotes(targetType, targetId, upDelta, downDelta);
      }
    }

    this.logger.debug({ event: 'vote_cast', userId, targetType, targetId, value });
  }

  async removeVote(params: {
    userId: string;
    targetType: 'thread' | 'comment' | 'reply';
    targetId: string;
  }): Promise<void> {
    const { userId, targetType, targetId } = params;
    const existingVote = await this.repo.getUserVote(userId, targetType, targetId);
    if (!existingVote) return;

    const deltaUp = existingVote === 'upvote' ? -1 : 0;
    const deltaDown = existingVote === 'downvote' ? -1 : 0;
    await this.updateTargetVotes(targetType, targetId, deltaUp, deltaDown);
    await this.repo.removeVote({ userId, targetType, targetId });
    this.logger.debug({ event: 'vote_removed', userId, targetType, targetId });
  }

  private async updateTargetVotes(
    targetType: string,
    targetId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
  ): Promise<void> {
    if (targetType === 'thread') {
      await this.repo.updateThreadVotes(targetId, deltaUpvotes, deltaDownvotes);
    } else {
      await this.repo.updateCommentVotes(targetId, deltaUpvotes, deltaDownvotes);
    }
  }

  // ─── REPORTS ────────────────────────────────────────────────────────────────

  async report(params: ReportParams): Promise<void> {
    const { reporterId, targetType, targetId } = params;

    if (targetType === 'thread') {
      const thread = await this.repo.getThreadById(targetId);
      if (!thread) throw new ThreadNotFoundError(targetId);
      if (thread.authorId === reporterId) throw new SelfReportError();
    } else {
      const comment = await this.repo.getCommentById(targetId);
      if (!comment) throw new CommentNotFoundError(targetId);
      if (comment.authorId === reporterId) throw new SelfReportError();
    }

    try {
      const report = await this.repo.createReport(params);
      this.eventBus.emitContentReported({
        eventType: 'content_reported',
        reportId: report.reportId,
        reporterId: params.reporterId,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        timestamp: new Date(),
      });
      this.logger.info({ event: 'content_reported', reporterId, targetType, targetId });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new DuplicateReportError();
      }
      throw error;
    }
  }

  async reviewReport(
    reportId: string,
    reviewerId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    actionTaken = false,
  ): Promise<void> {
    await this.repo.reviewReport({ reportId, reviewerId, status, actionTaken });
    this.eventBus.emitReportReviewed({
      eventType: 'report_reviewed',
      reportId,
      reviewerId,
      status,
      actionTaken,
      timestamp: new Date(),
    });
    this.logger.info({ event: 'report_reviewed', reportId, reviewerId, status });
  }

  async listReports(
    filters: ListReportsParams,
  ): Promise<{ items: DiscussionReport[]; hasNextPage: boolean }> {
    const items = await this.repo.listReports({
      ...filters,
      limit: (filters.limit ?? 20) + 1,
    });
    const hasNextPage = items.length > (filters.limit ?? 20);
    return { items: hasNextPage ? items.slice(0, -1) : items, hasNextPage };
  }
}
