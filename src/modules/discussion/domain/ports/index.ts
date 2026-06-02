import type {
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
} from '../types';

export * from './quiz-existence.port';

export const DISCUSSION_REPOSITORY_PORT = Symbol('DISCUSSION_REPOSITORY_PORT');

export interface DiscussionRepositoryPort {
  // Threads
  createThread(params: CreateThreadParams): Promise<DiscussionThread>;
  getThreadById(threadId: string): Promise<DiscussionThread | null>;
  getThreadDetail(
    threadId: string,
    userId?: string | null,
  ): Promise<DiscussionThreadDetail | null>;
  listThreads(params: ListThreadsParams): Promise<DiscussionThread[]>;
  updateThread(params: UpdateThreadParams): Promise<DiscussionThread>;
  softDeleteThread(params: { threadId: string; authorId: string }): Promise<void>;
  updateThreadStatus(params: {
    threadId: string;
    status: 'open' | 'closed' | 'hidden' | 'deleted';
  }): Promise<void>;
  incrementThreadCommentCount(threadId: string, delta: number): Promise<void>;
  updateThreadVotes(
    threadId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
  ): Promise<void>;

  // Comments
  createComment(params: CreateCommentParams): Promise<DiscussionComment>;
  getCommentById(commentId: string): Promise<DiscussionComment | null>;
  listComments(params: ListCommentsParams): Promise<DiscussionCommentWithReplies[]>;
  getCommentReplies(
    parentCommentId: string,
    limit: number,
  ): Promise<DiscussionComment[]>;
  updateComment(params: UpdateCommentParams): Promise<DiscussionComment>;
  softDeleteComment(params: { commentId: string; authorId: string }): Promise<void>;
  updateCommentStatus(params: {
    commentId: string;
    status: 'visible' | 'hidden' | 'deleted';
  }): Promise<void>;
  softDeleteCommentsByThread(threadId: string): Promise<void>;
  incrementCommentRepliesCount(commentId: string, delta: number): Promise<void>;
  updateCommentVotes(
    commentId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
  ): Promise<void>;

  // Votes
  upsertVote(params: VoteParams): Promise<DiscussionVote>;
  removeVote(params: {
    userId: string;
    targetType: 'thread' | 'comment' | 'reply';
    targetId: string;
  }): Promise<void>;
  getUserVote(
    userId: string,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
  ): Promise<DiscussionVoteValue | null>;

  // Reports
  createReport(params: ReportParams): Promise<DiscussionReport>;
  getReportById(reportId: string): Promise<DiscussionReport | null>;
  listReports(params: {
    status?: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<DiscussionReport[]>;
  reviewReport(params: ReviewReportParams): Promise<DiscussionReport>;
}
