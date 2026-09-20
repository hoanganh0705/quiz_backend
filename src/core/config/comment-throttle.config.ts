export const COMMENT_THROTTLE_VALUES = {
  createComment: { limit: 20, ttl: 60_000 },
  editComment: { limit: 20, ttl: 60_000 },
  deleteComment: { limit: 10, ttl: 60_000 },
  vote: { limit: 60, ttl: 60_000 },
  removeVote: { limit: 60, ttl: 60_000 },
  reportComment: { limit: 5, ttl: 60_000 },
  listQuizComments: { limit: 120, ttl: 60_000 },
  listMyComments: { limit: 60, ttl: 60_000 },
  listUserComments: { limit: 60, ttl: 60_000 },
  listReports: { limit: 60, ttl: 60_000 },
  reviewReport: { limit: 30, ttl: 60_000 },
  hideComment: { limit: 30, ttl: 60_000 },
  restoreComment: { limit: 30, ttl: 60_000 },
  getCommentById: { limit: 120, ttl: 60_000 },
} as const;

export type CommentThrottleConfig = typeof COMMENT_THROTTLE_VALUES;
