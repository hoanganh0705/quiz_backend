/**
 * Comment module — domain types.
 *
 * Single source of truth for the comment-only domain:
 *  - the `Comment` aggregate and its read-projection shapes,
 *  - the `AuthorView` value object,
 *  - the `VoteValue` and `ReportStatus` enums,
 *  - the command and query parameter shapes consumed by the
 *    domain service and repository port,
 *  - the cursor shapes used by the list endpoints.
 *
 * Each `type` alias is paired with a `const` tuple of the same name so
 * that the same source of truth can be used at compile time (for
 * domain / service / repository code) and at runtime (for DTO
 * validation and Swagger). This is the project's "single source of
 * truth" convention.
 *
 * Note: CommentSortField, COMMENT_SORT_FIELD, and CommentVotesCursor
 * were removed in Phase 2 audit as dead code. The `votes_count` sort
 * option was defined but never connected to query parameters. These
 * can be re-added when popularity sorting is implemented.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type VoteValue = 'upvote' | 'downvote';
export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export const VOTE_VALUE = ['upvote', 'downvote'] as const;
export const REPORT_STATUS = ['open', 'reviewed', 'dismissed', 'actioned'] as const;

// Subset of REPORT_STATUS — only valid statuses when reviewing a report.
export const REVIEW_REPORT_STATUS = ['reviewed', 'dismissed', 'actioned'] as const;
export type ReviewReportStatus = 'reviewed' | 'dismissed' | 'actioned';

// ─── Value objects ──────────────────────────────────────────────────────────

export interface AuthorView {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// ─── Aggregate ──────────────────────────────────────────────────────────────

/**
 * Canonical comment shape used by the domain service, the repository
 * port, and the application service. The `id` field is the comment
 * identifier. The `isHidden` boolean replaces the prior
 * `CommentContentStatus` enum: there are exactly two moderation
 * states.
 */
export interface Comment {
  id: string;
  quizId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  isHidden: boolean;
  hiddenById: string | null;
  hiddenAt: string | null;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  repliesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Read projection of a comment with the author pre-joined. The
 * repository returns this shape so the application layer can pass it
 * straight to the presenter without re-issuing an author lookup.
 */
export interface CommentView extends Comment {
  author: AuthorView;
}

/**
 * Read projection of a comment with its first-page replies. Returned
 * by `listComments` along with the `userVote` of the requesting
 * viewer (when authenticated).
 */
export interface CommentWithRepliesView extends CommentView {
  replies: CommentView[];
  userVote: VoteValue | null;
}

/**
 * Read projection for `listMyComments` and `users/:userId/comments`.
 * The `quizTitle` is denormalized for display; the repository JOINs
 * `comments` to `quizzes` to populate it.
 */
export interface MyCommentView {
  commentId: string;
  quizId: string;
  quizTitle: string;
  body: string;
  votesCount: number;
  repliesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportView {
  reportId: string;
  reporterId: string;
  commentId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  actionTaken: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a moderation action (hide/restore).
 * Returned so the application layer can construct the API response.
 */
export interface ModerationResult {
  commentId: string;
  isHidden: boolean;
  changed: boolean;
}

// ─── Command parameters ─────────────────────────────────────────────────────

export interface CreateCommentParams {
  quizId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
}

export interface EditCommentParams {
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
  commentId: string;
  value: VoteValue;
}

export interface ReportCommentParams {
  reporterId: string;
  commentId: string;
  reason: string;
  details: string | null;
}

export interface ReviewReportParams {
  reportId: string;
  reviewerId: string;
  status: ReviewReportStatus;
  actionTaken: boolean;
}

export interface HideCommentParams {
  commentId: string;
  moderatorId: string;
}

export interface RestoreCommentParams {
  commentId: string;
  moderatorId: string;
}

// ─── Query parameters ───────────────────────────────────────────────────────

export interface ListQuizCommentsParams {
  quizId: string;
  limit?: number;
  cursor?: CommentCursor | null;
}

export interface ListMyCommentsParams {
  userId: string;
  limit?: number;
  cursor?: CommentCursor | null;
}

export interface ListReportsParams {
  status?: ReportStatus;
  limit?: number;
  cursor?: ReportCursor | null;
}

export interface GetCommentParams {
  commentId: string;
  viewerId?: string | null;
}

// ─── Cursors ────────────────────────────────────────────────────────────────

/**
 * Cursor for the `created_at` sort. The cursor's `id` is the
 * tiebreaker for the stable secondary sort.
 */
export interface CommentCursor {
  createdAt: string;
  id: string;
}

export interface ReportCursor {
  createdAt: string;
  id: string;
}
