export enum ThreadSortField {
  CREATED_AT = 'created_at',
  VOTES_COUNT = 'votes_count',
  COMMENTS_COUNT = 'comments_count',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ThreadStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  HIDDEN = 'hidden',
  DELETED = 'deleted',
}

export enum ReportStatus {
  OPEN = 'open',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
  ACTIONED = 'actioned',
}

export enum VoteTargetType {
  THREAD = 'thread',
  COMMENT = 'comment',
  REPLY = 'reply',
}

export enum VoteValue {
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
}
