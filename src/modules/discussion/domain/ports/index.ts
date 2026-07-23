import type { DrizzleDB } from '@/core/database/database.module';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';

export type TransactionClient = PgTransaction<
  NodePgQueryResultHKT,
  Record<string, never>,
  Record<string, never>
>;
import {
  DiscussionThread,
  DiscussionThreadDetail,
  DiscussionComment,
  DiscussionCommentWithReplies,
  DiscussionVote,
  DiscussionReport,
  ListThreadsParams,
  ListCommentsParams,
  CreateThreadParams,
  UpdateThreadParams,
  CreateCommentParams,
  UpdateCommentParams,
  VoteParams,
  ReportParams,
  ReviewReportParams,
  DiscussionVoteValue,
  QuizDiscussionListItem,
  QuizDiscussionCursor,
  MyDiscussionListItem,
  MyCommentListItem,
  MyCommentCursor,
  MyUpvotedThreadListItem,
  MyUpvotedCommentListItem,
  MyDiscussionSubscriptionListItem,
  MySavedThreadListItem,
  MyUpvotedThreadCursor,
  MyUpvotedCommentCursor,
  MyDiscussionSubscriptionCursor,
  MySavedThreadCursor,
  TrendingDiscussionListItem,
  TrendingDiscussionCursor,
  UnansweredDiscussionListItem,
  UnansweredDiscussionCursor,
  SearchDiscussionListItem,
  SearchDiscussionsCursor,
  RelatedDiscussionListItem,
  ThreadParticipantListItem,
  PublicDiscussionProfile,
  MyDiscussionStats,
  ThreadStats,
  MarkThreadAsSolvedParams,
  UnsolveThreadParams,
} from '../types';

export * from './quiz-existence.port';
export * from './user-existence.port';

export const DISCUSSION_REPOSITORY_PORT = Symbol('DISCUSSION_REPOSITORY_PORT');

export interface DiscussionRepositoryPort {
  // Threads
  createThread(params: CreateThreadParams): Promise<DiscussionThread>;
  getThreadById(threadId: string): Promise<DiscussionThread | null>;
  /**
   * Transactional row-locking variant of `getThreadById`. Issues
   * `SELECT … FOR UPDATE` against `discussion_threads` so the row stays
   * locked until the calling transaction commits/rolls back. Closes the
   * TOCTOU window on Fix #2 (counter mutation under `comments_count`)
   * against a concurrent `softDeleteThread` / `updateThreadStatus`.
   * Must be called inside a transaction (`tx` is the only client
   * accepted, no implicit `this.db` fallback).
   */
  getThreadByIdForUpdate(
    threadId: string,
    tx: DrizzleDB | TransactionClient,
  ): Promise<DiscussionThread | null>;
  getThreadDetail(threadId: string, userId?: string | null): Promise<DiscussionThreadDetail | null>;
  listThreads(params: ListThreadsParams): Promise<DiscussionThread[]>;
  listQuizDiscussions(params: {
    quizId: string;
    limit: number;
    cursor?: QuizDiscussionCursor | null;
  }): Promise<QuizDiscussionListItem[]>;
  listMyDiscussions(params: {
    userId: string;
    limit: number;
    cursor?: QuizDiscussionCursor | null;
  }): Promise<MyDiscussionListItem[]>;
  listMyComments(params: {
    userId: string;
    limit: number;
    cursor?: MyCommentCursor | null;
  }): Promise<MyCommentListItem[]>;
  listMyUpvotedThreads(params: {
    userId: string;
    limit: number;
    cursor: MyUpvotedThreadCursor | null;
  }): Promise<MyUpvotedThreadListItem[]>;
  listMyUpvotedComments(params: {
    userId: string;
    limit: number;
    cursor: MyUpvotedCommentCursor | null;
  }): Promise<MyUpvotedCommentListItem[]>;
  listMyDiscussionSubscriptions(params: {
    userId: string;
    limit: number;
    cursor: MyDiscussionSubscriptionCursor | null;
  }): Promise<MyDiscussionSubscriptionListItem[]>;
  listMySavedThreads(params: {
    userId: string;
    limit: number;
    cursor: MySavedThreadCursor | null;
  }): Promise<MySavedThreadListItem[]>;
  subscribeToThread(params: { userId: string; threadId: string }): Promise<void>;
  unsubscribeFromThread(params: { userId: string; threadId: string }): Promise<void>;
  saveThread(params: { userId: string; threadId: string }): Promise<void>;
  unsaveThread(params: { userId: string; threadId: string }): Promise<void>;
  listTrendingDiscussions(params: {
    limit: number;
    cursor?: TrendingDiscussionCursor | null;
  }): Promise<TrendingDiscussionListItem[]>;
  listUnansweredDiscussions(params: {
    limit: number;
    cursor?: UnansweredDiscussionCursor | null;
  }): Promise<UnansweredDiscussionListItem[]>;
  searchDiscussions(params: {
    query: string;
    limit: number;
    cursor?: SearchDiscussionsCursor | null;
  }): Promise<SearchDiscussionListItem[]>;
  findRelatedThreads(params: {
    threadId: string;
    limit: number;
  }): Promise<RelatedDiscussionListItem[]>;
  listThreadParticipants(threadId: string): Promise<ThreadParticipantListItem[]>;
  listThreadSubscribers(threadId: string): Promise<{ userId: string }[]>;
  getPublicDiscussionProfile(userId: string): Promise<PublicDiscussionProfile>;
  getThreadStats(threadId: string): Promise<ThreadStats | null>;
  getMyDiscussionStats(userId: string): Promise<MyDiscussionStats>;
  updateThread(params: UpdateThreadParams): Promise<DiscussionThread>;
  markThreadAsSolved(params: MarkThreadAsSolvedParams): Promise<DiscussionThread>;
  unsolveThread(params: UnsolveThreadParams): Promise<DiscussionThread>;
  softDeleteThread(params: { threadId: string; authorId: string }, db?: DrizzleDB): Promise<void>;
  updateThreadStatus(params: {
    threadId: string;
    status: 'open' | 'closed' | 'hidden' | 'deleted';
  }): Promise<void>;
  incrementThreadCommentCount(
    threadId: string,
    delta: number,
    db?: DrizzleDB | TransactionClient,
  ): Promise<void>;
  updateThreadVotes(
    threadId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
    db?: DrizzleDB,
  ): Promise<void>;

  // Comments
  createComment(
    params: CreateCommentParams,
    db?: DrizzleDB | TransactionClient,
  ): Promise<DiscussionComment>;
  getCommentById(commentId: string): Promise<DiscussionComment | null>;
  /**
   * Transactional row-locking variant of `getCommentById`. Issues
   * `SELECT … FOR UPDATE` against `discussion_comments` so the row
   * stays locked until the calling transaction commits/rolls back.
   * Closes the TOCTOU window on Fix #2 (counter mutation under
   * `comments_count` / `replies_count`) against concurrent deletes
   * of the same comment.
   */
  getCommentByIdForUpdate(
    commentId: string,
    tx: DrizzleDB | TransactionClient,
  ): Promise<DiscussionComment | null>;
  listComments(params: ListCommentsParams): Promise<DiscussionCommentWithReplies[]>;
  updateComment(params: UpdateCommentParams): Promise<DiscussionComment>;
  softDeleteComment(
    params: { commentId: string; authorId: string },
    db?: DrizzleDB | TransactionClient,
  ): Promise<void>;
  updateCommentStatus(params: {
    commentId: string;
    status: 'visible' | 'hidden' | 'deleted';
  }): Promise<void>;
  softDeleteCommentsByThread(threadId: string, db?: DrizzleDB): Promise<void>;
  incrementCommentRepliesCount(
    commentId: string,
    delta: number,
    db?: DrizzleDB | TransactionClient,
  ): Promise<void>;
  updateCommentVotes(
    commentId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
    db?: DrizzleDB | TransactionClient,
  ): Promise<void>;

  // Votes
  upsertVote(params: VoteParams, db?: DrizzleDB): Promise<DiscussionVote>;
  removeVote(
    params: {
      userId: string;
      targetType: 'thread' | 'comment';
      targetId: string;
    },
    db?: DrizzleDB,
  ): Promise<void>;
  getUserVote(
    userId: string,
    targetType: 'thread' | 'comment',
    targetId: string,
  ): Promise<DiscussionVoteValue | null>;
  getUserVoteForUpdate(
    userId: string,
    targetType: 'thread' | 'comment',
    targetId: string,
    db: DrizzleDB,
  ): Promise<DiscussionVoteValue | null>;

  // Reports
  createReport(params: ReportParams): Promise<DiscussionReport>;
  listReports(params: {
    status?: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<DiscussionReport[]>;
  reviewReport(params: ReviewReportParams): Promise<DiscussionReport>;

  // Helpers
  getUsernamesForUsers(userIds: string[]): Promise<Map<string, string>>;
  transactionally<T>(fn: (tx: DrizzleDB) => Promise<T>): Promise<T>;
  countReplies(parentCommentId: string): Promise<number>;

  // Author/reporter lookups for notification listeners
  getCommentAuthor(commentId: string): Promise<{ authorId: string } | null>;
  getThreadAuthor(threadId: string): Promise<{ authorId: string } | null>;
  getReportReporter(reportId: string): Promise<{ reporterId: string } | null>;

  /**
   * Fetches a short summary of the reported content for moderator notifications.
   * Returns null if the target no longer exists.
   */
  getReportTargetSummary(params: {
    reportId: string;
    targetType: 'thread' | 'comment';
    targetId: string;
  }): Promise<{
    targetType: 'thread' | 'comment';
    targetId: string;
    threadId: string;
    threadTitle: string;
    excerpt: string;
  } | null>;
}
