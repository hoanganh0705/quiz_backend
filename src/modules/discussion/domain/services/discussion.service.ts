import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserRole } from '@/common/types/user-role.type';
import { DISCUSSION_REPOSITORY_PORT, QUIZ_EXISTENCE_PORT } from '../ports';
import type { DiscussionRepositoryPort, QuizExistencePort } from '../ports';
import { DISCUSSION_DOMAIN_EVENT_BUS } from '../events';
import type { DiscussionDomainEventBusPort } from '../events';
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
  MyUpvotedThreadCursor,
  MyUpvotedCommentCursor,
  MyDiscussionSubscriptionCursor,
  MySavedThreadCursor,
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
  MarkThreadAsSolvedParams,
  UnsolveThreadParams,
} from '../types';
import { USER_REPOSITORY_PORT } from '@/modules/user/domain/ports/user-repository.port';
import type { UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';
import { UserNotFoundError } from '@/modules/user/domain/errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import {
  ThreadNotFoundError,
  CommentNotFoundError,
  ThreadForbiddenError,
  CommentForbiddenError,
  ThreadClosedError,
  ThreadNotActiveError,
  CommentThreadMismatchError,
  SelfVoteError,
  SelfReportError,
  DuplicateReportError,
  QuizNotFoundError,
  ModeratorRequiredError,
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
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @InjectPinoLogger(DiscussionService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ─── THREADS ────────────────────────────────────────────────────────────────

  async createThread(params: CreateThreadParams): Promise<DiscussionThread> {
    const quizExists = await this.quizExistence.exists(params.quizId);
    if (!quizExists) {
      throw new QuizNotFoundError(params.quizId);
    }

    this.logger.debug({
      event: 'thread_created',
      quizId: params.quizId,
      authorId: params.authorId,
    });

    const thread = await this.repo.createThread(params);

    this.eventBus.emitThreadCreated({
      eventType: 'discussion_thread_created',
      threadId: thread.threadId,
      quizId: params.quizId,
      authorId: params.authorId,
      title: thread.title,
      timestamp: new Date(),
    });

    return thread;
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
      throw new QuizNotFoundError(quizId);
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
    const user = await this.userRepository.findMeById(userId);
    if (!user) {
      this.logger.warn({ event: 'discussion_user_not_found', userId });
      throw new UserNotFoundError();
    }
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
    query: { limit?: number; cursor?: MyUpvotedThreadCursor | null },
  ): Promise<{
    items: MyUpvotedThreadListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MyUpvotedThreadCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMyUpvotedThreads({
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
          ? { upvotedAt: lastItem.upvotedAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listMyUpvotedComments(
    userId: string,
    query: { limit?: number; cursor?: MyUpvotedCommentCursor | null },
  ): Promise<{
    items: MyUpvotedCommentListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MyUpvotedCommentCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMyUpvotedComments({
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
          ? { upvotedAt: lastItem.upvotedAt, commentId: lastItem.commentId }
          : null,
    };
  }

  async listMyDiscussionSubscriptions(
    userId: string,
    query: { limit?: number; cursor?: MyDiscussionSubscriptionCursor | null },
  ): Promise<{
    items: MyDiscussionSubscriptionListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MyDiscussionSubscriptionCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMyDiscussionSubscriptions({
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
          ? { subscribedAt: lastItem.subscribedAt, threadId: lastItem.threadId }
          : null,
    };
  }

  async listMySavedThreads(
    userId: string,
    query: { limit?: number; cursor?: MySavedThreadCursor | null },
  ): Promise<{
    items: MySavedThreadListItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: MySavedThreadCursor | null;
  }> {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listMySavedThreads({
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
        hasNextPage && lastItem ? { savedAt: lastItem.savedAt, threadId: lastItem.threadId } : null,
    };
  }

  async subscribeToThread(userId: string, threadId: string): Promise<{ success: true }> {
    const thread = await this.repo.getThreadById(threadId);

    if (!thread) {
      this.logger.warn({ event: 'discussion_thread_not_found', threadId, userId });
      throw new ThreadNotFoundError(threadId);
    }

    if (thread.status !== 'open') {
      this.logger.warn({
        event: 'discussion_thread_not_active',
        threadId,
        userId,
        status: thread.status,
      });
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
      this.logger.warn({
        event: 'discussion_thread_not_active',
        threadId,
        userId,
        status: thread.status,
      });
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

  async markThreadAsSolved(params: MarkThreadAsSolvedParams): Promise<DiscussionThread> {
    const thread = await this.repo.getThreadById(params.threadId);

    if (!thread) {
      this.logger.warn({
        event: 'discussion_thread_not_found',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadNotFoundError(params.threadId);
    }

    if (thread.status === 'deleted') {
      this.logger.warn({
        event: 'discussion_thread_not_active',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadNotActiveError();
    }

    if (thread.authorId !== params.actorId) {
      this.logger.warn({
        event: 'discussion_thread_forbidden',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadForbiddenError();
    }

    const comment = await this.repo.getCommentById(params.commentId);

    if (!comment) {
      this.logger.warn({
        event: 'discussion_comment_not_found',
        commentId: params.commentId,
        threadId: params.threadId,
      });
      throw new CommentNotFoundError(params.commentId);
    }

    if (comment.threadId !== params.threadId) {
      this.logger.warn({
        event: 'discussion_solve_comment_thread_mismatch',
        threadId: params.threadId,
        commentId: params.commentId,
        commentThreadId: comment.threadId,
        actorId: params.actorId,
      });
      throw new CommentThreadMismatchError();
    }

    const updated = await this.repo.markThreadAsSolved(params);

    const usernames = await this.repo.getUsernamesForUsers([params.actorId]);
    const solverUsername = usernames.get(params.actorId) ?? '';

    this.eventBus.emitThreadSolved({
      eventType: 'discussion_thread_solved',
      threadId: params.threadId,
      threadTitle: updated.title,
      commentId: params.commentId,
      authorId: thread.authorId,
      authorUsername: thread.author.username,
      solverId: params.actorId,
      solverUsername,
      timestamp: new Date(),
    });

    this.logger.info({
      event: 'thread_marked_solved',
      threadId: params.threadId,
      commentId: params.commentId,
      actorId: params.actorId,
    });

    return updated;
  }

  async unsolveThread(params: UnsolveThreadParams): Promise<DiscussionThread> {
    const thread = await this.repo.getThreadById(params.threadId);

    if (!thread) {
      this.logger.warn({
        event: 'discussion_thread_not_found',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadNotFoundError(params.threadId);
    }

    if (thread.status === 'deleted') {
      this.logger.warn({
        event: 'discussion_thread_not_active',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadNotActiveError();
    }

    if (thread.authorId !== params.actorId) {
      this.logger.warn({
        event: 'discussion_thread_forbidden',
        threadId: params.threadId,
        actorId: params.actorId,
      });
      throw new ThreadForbiddenError();
    }

    const updated = await this.repo.unsolveThread(params);

    this.logger.info({
      event: 'thread_unsolved',
      threadId: params.threadId,
      actorId: params.actorId,
    });

    return updated;
  }

  async listTrendingDiscussions(query: {
    limit?: number;
    cursor?: TrendingDiscussionCursor | null;
  }): Promise<{
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
          ? {
              score: lastItem.trendingScore,
              createdAt: lastItem.createdAt,
              threadId: lastItem.threadId,
            }
          : null,
    };
  }

  async listUnansweredDiscussions(query: {
    limit?: number;
    cursor?: UnansweredDiscussionCursor | null;
  }): Promise<{
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

  async searchDiscussions(query: {
    q?: string;
    limit?: number;
    cursor?: SearchDiscussionsCursor | null;
  }): Promise<{
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
    this.eventBus.emitThreadReopened({
      eventType: 'thread_reopened',
      threadId,
      authorId: userId,
      timestamp: new Date(),
    });
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

  async hideThread(threadId: string, moderatorId: string, role: UserRole): Promise<void> {
    if (role !== 'admin' && role !== 'moderator') {
      throw new ModeratorRequiredError();
    }

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

    const parent = params.parentCommentId
      ? await this.repo.getCommentById(params.parentCommentId)
      : null;
    if (params.parentCommentId && !parent) {
      throw new CommentNotFoundError(params.parentCommentId);
    }
    if (parent && parent.threadId !== params.threadId) {
      throw new CommentThreadMismatchError();
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
      threadTitle: thread.title,
      authorId: params.authorId,
      authorUsername: comment.author.username,
      threadAuthorId: thread.author.userId,
      parentCommentId: params.parentCommentId ?? null,
      parentCommentAuthorId: parent?.author.userId ?? null,
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

  async hideComment(commentId: string, moderatorId: string, role: UserRole): Promise<void> {
    if (role !== 'admin' && role !== 'moderator') {
      throw new ModeratorRequiredError();
    }

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

    await this.db.transaction(async (tx: any) => {
      const [existingVote] = await Promise.all([
        this.repo.getUserVote(userId, targetType, targetId),
      ]);

      if (existingVote === value) {
        await this.repo.removeVote({ userId, targetType, targetId }, tx);
        const deltaUp = value === 'upvote' ? -1 : 0;
        const deltaDown = value === 'downvote' ? -1 : 0;
        if (targetType === 'thread') {
          await this.repo.updateThreadVotes(targetId, deltaUp, deltaDown, tx);
        } else {
          await this.repo.updateCommentVotes(targetId, deltaUp, deltaDown, tx);
        }
      } else {
        await this.repo.upsertVote({ userId, targetType, targetId, value }, tx);
        if (existingVote) {
          const flipUp = value === 'upvote' ? 1 : -1;
          const flipDown = value === 'upvote' ? -1 : 1;
          if (targetType === 'thread') {
            await this.repo.updateThreadVotes(targetId, flipUp, flipDown, tx);
          } else {
            await this.repo.updateCommentVotes(targetId, flipUp, flipDown, tx);
          }
        } else {
          const upDelta = value === 'upvote' ? 1 : 0;
          const downDelta = value === 'downvote' ? 1 : 0;
          if (targetType === 'thread') {
            await this.repo.updateThreadVotes(targetId, upDelta, downDelta, tx);
          } else {
            await this.repo.updateCommentVotes(targetId, upDelta, downDelta, tx);
          }
        }
      }
    });

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
