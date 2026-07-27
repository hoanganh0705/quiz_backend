/**
 * Comment Repository Port
 *
 * The single read/write surface the comment domain depends on for
 * persistent state. The implementation lives at
 * `src/modules/comment/infrastructure/repositories/comment.repository.ts`
 * and is the only place in the module that imports `drizzle-orm` or the
 * Drizzle schema. Every other layer (domain service, application
 * service, transport, cross-module listeners) goes through this port.
 *
 * The port does not expose Drizzle types — `tx` is opaque from the
 * caller's perspective. Callers pass it through the `tx?: Db` parameter
 * for transactional writes that participate in a larger domain
 * transaction (see `CommentService.transactionally`).
 *
 * Surface: 14 root methods on the `CommentRepositoryPort` interface
 * (comments + votes + reports + counters + helpers). The transport /
 * application layer never reaches in directly — every persistence call
 * routes through the domain service or the {@link reconcileCounters}
 * scheduler entry point.
 */

import type {
  CommentView,
  CommentWithRepliesView,
  CreateCommentParams,
  EditCommentParams,
  ListMyCommentsParams,
  ListReportsParams,
  MyCommentView,
  ReportView,
  ReviewReportParams,
  VoteValue,
} from '../types';
import type { AuthorView } from '../types';

export const COMMENT_REPOSITORY_PORT = Symbol('COMMENT_REPOSITORY_PORT');

/**
 * Opaque database client. The full Drizzle type leaks into the
 * implementation but is collapsed to a brand-typed alias here so
 * call-sites do not need to import drizzle-orm.
 */
export type Db = unknown & {
  // Brand field keeps the type nominal so `unknown` callers cannot
  // accidentally pass a non-Drizzle value as `tx`.
  readonly __brand: 'Db';
};

export interface CommentRepositoryPort {
  // ─── Comments ────────────────────────────────────────────────────────────
  /**
   * Insert a new comment. When `tx` is supplied the insert is part of the
   * caller's transaction (the parent-validation lock + replies-count
   * increment path). The returned comment is the row enriched with the
   * author's display profile so the application layer can pass it
   * straight to the presenter.
   */
  createComment(params: CreateCommentParams, tx?: Db): Promise<CommentView>;
  getCommentById(commentId: string): Promise<CommentView | null>;
  /**
   * Row-locking variant of `getCommentById`. Issues `SELECT … FOR UPDATE`
   * inside the supplied `tx` so the row is locked until the calling
   * transaction commits/rolls back. Closes the TOCTOU window on the
   * counter mutation paths (vote increment + parent validation).
   */
  getCommentByIdForUpdate(commentId: string, tx: Db): Promise<CommentView | null>;

  /**
   * List top-level comments for a quiz, with the first page of replies
   * inlined and the requesting viewer's vote projected per-row.
   * Cursor is `(createdAt, commentId)`; the repository returns one
   * extra row so the service can detect `hasNextPage`.
   */
  listComments(params: ListCommentsParamsForPort): Promise<CommentWithRepliesView[]>;

  /**
   * List the caller's own comments for the "my-activity" feed. Joined
   * to `quizzes` so the response includes `quizTitle`.
   */
  listMyComments(params: ListMyCommentsParams): Promise<MyCommentView[]>;

  editComment(params: EditCommentParams): Promise<CommentView>;
  softDeleteComment(
    params: { commentId: string; authorId: string },
    tx?: Db,
  ): Promise<void>;
  setHiddenState(
    params: { commentId: string; hidden: boolean; moderatorId: string },
    tx?: Db,
  ): Promise<void>;

  // ─── Counters (run inside the service's own transactional scope) ────────
  incrementVoteCount(
    commentId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
    tx: Db,
  ): Promise<void>;
  incrementRepliesCount(commentId: string, delta: number, tx: Db): Promise<void>;
  countReplies(parentCommentId: string): Promise<number>;

  // ─── Votes ───────────────────────────────────────────────────────────────
  upsertVote(
    params: { userId: string; commentId: string; value: VoteValue },
    tx: Db,
  ): Promise<void>;
  removeVote(
    params: { userId: string; commentId: string },
    tx: Db,
  ): Promise<void>;
  /**
   * Look up the requesting viewer's vote on a comment. Returns the
   * non-transactional state when called without `tx` (used for the
   * `userVote` projection on `CommentWithRepliesView`); with `tx` it
   * issues a row-locking read used by `CommentService.vote`.
   */
  getUserVoteForComment(
    userId: string,
    commentId: string,
    tx?: Db,
  ): Promise<VoteValue | null>;

  // ─── Reports ─────────────────────────────────────────────────────────────
  createReport(params: {
    reporterId: string;
    commentId: string;
    reason: string;
    details: string | null;
  }): Promise<ReportView>;
  listReports(params: ListReportsParams): Promise<ReportView[]>;
  reviewReport(params: ReviewReportParams): Promise<ReportView>;

  // ─── Counter reconciler ──────────────────────────────────────────────────
  /**
   * Recompute the denormalized `comments_count` /
   * `comments.comments_count` aggregates from the underlying rows.
   * Idempotent (each pass uses `IS DISTINCT FROM`); safe to re-run.
   */
  reconcileCounters(): Promise<{ comments: number; replies: number }>;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  /**
   * Resolve an `AuthorView` (username, displayName, avatarUrl) for a
   * comment. Used by the service to populate event payloads and
   * presenter output. Returns `null` if the comment no longer exists.
   */
  getAuthorForComment(commentId: string, tx?: Db): Promise<AuthorView | null>;
  getUsername(userId: string): Promise<string | null>;
  getUsernamesForUsers(userIds: string[]): Promise<Map<string, string>>;
  /**
   * Run `fn` inside a database transaction. The `tx` passed to `fn`
   * is the same opaque `Db` shape that write methods accept.
   */
  transactionally<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/**
 * Service-side parameter shape for `listComments`. Mirrors the
 * `ListQuizCommentsParams` query params with the optional viewer id
 * appended so the repository can join on the per-viewer vote.
 */
export interface ListCommentsParamsForPort {
  quizId: string;
  limit?: number;
  cursor?:
    | {
        createdAt: string;
        commentId: string;
      }
    | null;
  /**
   * The viewer id, used to populate the per-comment `userVote`
   * projection. `undefined` means the call is anonymous and the
   * repository omits the `userVote` join.
   */
  viewerId?: string | null;
}