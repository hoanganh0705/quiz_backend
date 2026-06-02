export class AuthorDto {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class ThreadDto {
  threadId: string;
  quizId: string;
  author: AuthorDto;
  title: string;
  body: string;
  status: string;
  commentsCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export class CommentDto {
  commentId: string;
  threadId: string;
  author: AuthorDto;
  parentCommentId: string | null;
  body: string;
  status: string;
  repliesCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export class CommentWithRepliesDto extends CommentDto {
  replies: CommentDto[];
  userVote: string | null;
}

export class ThreadDetailDto extends ThreadDto {
  userVote: string | null;
  comments: CommentWithRepliesDto[];
}

export class PaginatedThreadsDto {
  items: ThreadDto[];
  hasNextPage: boolean;
}

export class PaginatedCommentsDto {
  items: CommentWithRepliesDto[];
  hasNextPage: boolean;
}

export class ReportDto {
  reportId: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  actionTaken: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PaginatedReportsDto {
  items: ReportDto[];
  hasNextPage: boolean;
}
