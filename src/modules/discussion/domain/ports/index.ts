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

export const DISCUSSION_REPOSITORY_PORT = Symbol('DISCUSSION_REPOSITORY_PORT');

export interface DiscussionRepositoryPort {
  // Threads
  createThread(params: CreateThreadParams): Promise<DiscussionThread>;
  getThreadById(threadId: string): Promise<DiscussionThread | null>;
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
  listDiscussionsByUser(params: {
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
    page: number;
    limit: number;
  }): Promise<{ items: MyUpvotedThreadListItem[]; total: number }>;
  listMyUpvotedComments(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyUpvotedCommentListItem[]; total: number }>;
  listMyDiscussionSubscriptions(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyDiscussionSubscriptionListItem[]; total: number }>;
  listMySavedThreads(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MySavedThreadListItem[]; total: number }>;
  subscribeToThread(params: { userId: string; threadId: string }): Promise<void>;
  unsubscribeFromThread(params: { userId: string; threadId: string }): Promise<void>;
  saveThread(params: { userId: string; threadId: string }): Promise<void>;
  unsaveThread(params: { userId: string; threadId: string }): Promise<void>;
  listCommentsByUser(params: {
    userId: string;
    limit: number;
    cursor?: MyCommentCursor | null;
  }): Promise<MyCommentListItem[]>;
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
  getPublicDiscussionProfile(userId: string): Promise<PublicDiscussionProfile>;
  getThreadStats(threadId: string): Promise<ThreadStats | null>;
  getMyDiscussionStats(userId: string): Promise<MyDiscussionStats>;
  updateThread(params: UpdateThreadParams): Promise<DiscussionThread>;
  markThreadAsSolved(params: MarkThreadAsSolvedParams): Promise<DiscussionThread>;
  unsolveThread(params: UnsolveThreadParams): Promise<DiscussionThread>;
  softDeleteThread(params: { threadId: string; authorId: string }): Promise<void>;
  updateThreadStatus(params: {
    threadId: string;
    status: 'open' | 'closed' | 'hidden' | 'deleted';
  }): Promise<void>;
  incrementThreadCommentCount(threadId: string, delta: number): Promise<void>;
  updateThreadVotes(threadId: string, deltaUpvotes: number, deltaDownvotes: number): Promise<void>;

  // Comments
  createComment(params: CreateCommentParams): Promise<DiscussionComment>;
  getCommentById(commentId: string): Promise<DiscussionComment | null>;
  listComments(params: ListCommentsParams): Promise<DiscussionCommentWithReplies[]>;
  getCommentReplies(parentCommentId: string, limit: number): Promise<DiscussionComment[]>;
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

  // Helpers
  getUsernamesForUsers(userIds: string[]): Promise<Map<string, string>>;
}
