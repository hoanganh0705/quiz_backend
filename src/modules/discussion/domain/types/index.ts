export type DiscussionThreadStatus = 'open' | 'closed' | 'hidden' | 'deleted';
export type DiscussionContentStatus = 'visible' | 'hidden' | 'deleted';
export type DiscussionVoteValue = 'upvote' | 'downvote';
export type DiscussionReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';
export type DiscussionReportTargetType = 'thread' | 'comment' | 'reply';

export interface DiscussionThreadAuthor {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface DiscussionThread {
  threadId: string;
  quizId: string;
  authorId: string;
  author: DiscussionThreadAuthor;
  title: string;
  body: string;
  status: DiscussionThreadStatus;
  commentsCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface QuizDiscussionCursor {
  createdAt: string;
  threadId: string;
}

export interface QuizDiscussionListItem {
  threadId: string;
  quizId: string;
  title: string;
  author: DiscussionThreadAuthor;
  commentCount: number;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MyDiscussionListItem {
  threadId: string;
  quizId: string;
  quizTitle: string;
  title: string;
  commentCount: number;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MyCommentCursor {
  createdAt: string;
  commentId: string;
}

export interface MyCommentListItem {
  commentId: string;
  threadId: string;
  threadTitle: string;
  quizId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  repliesCount: number;
  votesCount: number;
}

export interface TrendingDiscussionCursor {
  score: number;
  threadId: string;
}

export interface TrendingDiscussionListItem {
  threadId: string;
  quizId: string;
  title: string;
  author: DiscussionThreadAuthor;
  commentCount: number;
  replyCount: number;
  voteCount: number;
  latestActivityAt: string;
  createdAt: string;
  trendingScore: number;
}

export interface UnansweredDiscussionCursor {
  createdAt: string;
  threadId: string;
}

export interface UnansweredDiscussionListItem {
  threadId: string;
  quizId: string;
  title: string;
  author: DiscussionThreadAuthor;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchDiscussionsCursor {
  createdAt: string;
  threadId: string;
}

export interface SearchDiscussionListItem {
  threadId: string;
  quizId: string;
  title: string;
  author: DiscussionThreadAuthor;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadStats {
  threadId: string;
  totalComments: number;
  totalReplies: number;
  totalParticipants: number;
  upvotes: number;
  downvotes: number;
  latestActivityAt: string;
}

export interface MyDiscussionStats {
  totalThreadsCreated: number;
  totalCommentsCreated: number;
  totalRepliesCreated: number;
  totalDiscussionContributions: number;
  totalReceivedVotes: number;
  latestDiscussionActivityAt: string | null;
}

export interface DiscussionComment {
  commentId: string;
  threadId: string;
  authorId: string;
  author: DiscussionThreadAuthor;
  parentCommentId: string | null;
  body: string;
  status: DiscussionContentStatus;
  repliesCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DiscussionCommentWithReplies extends DiscussionComment {
  replies: DiscussionComment[];
  userVote: DiscussionVoteValue | null;
}

export interface DiscussionThreadDetail extends Omit<DiscussionThread, 'author'> {
  author: DiscussionThreadAuthor;
  userVote: DiscussionVoteValue | null;
  comments: DiscussionCommentWithReplies[];
}

export interface DiscussionVote {
  voteId: string;
  userId: string;
  targetType: DiscussionReportTargetType;
  targetId: string;
  value: DiscussionVoteValue;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionReport {
  reportId: string;
  reporterId: string;
  targetType: DiscussionReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: DiscussionReportStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  actionTaken: boolean;
  createdAt: string;
  updatedAt: string;
}

// Query types
export interface ListThreadsParams {
  quizId?: string;
  authorId?: string;
  status?: DiscussionThreadStatus;
  sortBy?: 'created_at' | 'votes_count' | 'comments_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string | null;
}

export interface ListCommentsParams {
  threadId: string;
  parentCommentId?: string | null;
  limit?: number;
  cursor?: string | null;
}

// Action params
export interface CreateThreadParams {
  quizId: string;
  authorId: string;
  title: string;
  body: string;
}

export interface UpdateThreadParams {
  threadId: string;
  authorId: string;
  title?: string;
  body?: string;
}

export interface DeleteThreadParams {
  threadId: string;
  authorId: string;
}

export interface CreateCommentParams {
  threadId: string;
  authorId: string;
  parentCommentId?: string | null;
  body: string;
}

export interface UpdateCommentParams {
  commentId: string;
  authorId: string;
  body: string;
}

export interface DeleteCommentParams {
  commentId: string;
  authorId: string;
}

export interface VoteParams {
  userId: string;
  targetType: DiscussionReportTargetType;
  targetId: string;
  value: DiscussionVoteValue;
}

export interface ReportParams {
  reporterId: string;
  targetType: DiscussionReportTargetType;
  targetId: string;
  reason: string;
  details?: string | null;
}

export interface ReviewReportParams {
  reportId: string;
  reviewerId: string;
  status: 'reviewed' | 'dismissed' | 'actioned';
  actionTaken?: boolean;
}

export interface ListReportsParams {
  status?: DiscussionReportStatus;
  limit?: number;
  cursor?: string | null;
}
