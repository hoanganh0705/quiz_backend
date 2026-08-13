/**
 * Comment Domain Events
 *
 * Defines every event the comment module emits on `CommentDomainEventBus`.
 * Producers are the domain service; consumers are the Notification and
 * Social modules (in-process subscriptions). The bus is process-local
 * and does not cross pod boundaries.
 *
 * Naming convention: `<verb>_<noun>` (e.g. `comment_created`, `vote_cast`).
 * The `eventType` literal discriminates the union.
 *
 * ## Realtime Payload Strategy
 *
 * Events include full comment data (`CommentSnapshot`) when available so
 * WebSocket clients can apply events directly to their local state without
 * requiring a subsequent REST refetch. This enables truly-live updates where:
 *   - New comments appear instantly
 *   - Edits reflect immediately
 *   - Vote counts update in real-time
 *   - Delete/hide/restore transitions happen live
 *
 * Events that cannot provide a full snapshot (e.g., reported, reviewed) still
 * include the minimum required fields for client-side reconciliation.
 */

/**
 * Full comment snapshot for realtime application.
 * Included in events so clients can update their local state directly.
 */
export interface CommentSnapshot {
  id: string;
  quizId: string;
  parentCommentId: string | null;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  isHidden: boolean;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  repliesCount: number;
  userVote: 'upvote' | 'downvote' | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isReply: boolean;
}

export interface CommentCreatedEvent {
  readonly eventType: 'comment_created';
  readonly commentId: string;
  readonly quizId: string;
  readonly parentCommentId: string | null;
  readonly authorId: string;
  readonly authorUsername: string;
  readonly parentCommentAuthorId: string | null;
  readonly isReply: boolean;
  readonly timestamp: Date;
  /** Full comment snapshot for direct state application */
  readonly snapshot?: CommentSnapshot;
}

export interface CommentEditedEvent {
  readonly eventType: 'comment_edited';
  readonly commentId: string;
  readonly quizId: string;
  readonly authorId: string;
  readonly timestamp: Date;
  /** Full comment snapshot for direct state application */
  readonly snapshot?: CommentSnapshot;
}

export interface CommentDeletedEvent {
  readonly eventType: 'comment_deleted';
  readonly commentId: string;
  readonly quizId: string;
  readonly authorId: string;
  readonly timestamp: Date;
  /** Parent comment ID for thread updates */
  readonly parentCommentId?: string | null;
}

export interface CommentHiddenEvent {
  readonly eventType: 'comment_hidden';
  readonly commentId: string;
  readonly quizId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
  /** Full comment snapshot for direct state application */
  readonly snapshot?: CommentSnapshot;
}

export interface CommentRestoredEvent {
  readonly eventType: 'comment_restored';
  readonly commentId: string;
  readonly quizId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
  /** Full comment snapshot for direct state application */
  readonly snapshot?: CommentSnapshot;
}

export interface CommentMentionedEvent {
  readonly eventType: 'comment_mentioned';
  readonly commentId: string;
  readonly quizId: string;
  readonly mentionedUserId: string;
  readonly mentionedUsername: string;
  readonly authorId: string;
  readonly authorUsername: string;
  readonly timestamp: Date;
}

export interface VoteCastEvent {
  readonly eventType: 'vote_cast';
  readonly commentId: string;
  /** Quiz the voted comment belongs to. */
  readonly quizId: string;
  readonly voterId: string;
  readonly value: 'upvote' | 'downvote';
  readonly timestamp: Date;
  /** Updated vote counts for direct state application */
  readonly votesCount: number;
  readonly upvotesCount: number;
  readonly downvotesCount: number;
}

export interface VoteRemovedEvent {
  readonly eventType: 'vote_removed';
  readonly commentId: string;
  /** Quiz the unvoted comment belongs to. */
  readonly quizId: string;
  readonly voterId: string;
  readonly timestamp: Date;
  /** Updated vote counts for direct state application */
  readonly votesCount: number;
  readonly upvotesCount: number;
  readonly downvotesCount: number;
}

export interface CommentReportedEvent {
  readonly eventType: 'comment_reported';
  readonly reportId: string;
  readonly commentId: string;
  /**
   * Quiz the reported comment belongs to. Included so the
   * notification listener can build a moderator-facing summary
   * without re-querying the comment module.
   */
  readonly quizId: string;
  /**
   * Short excerpt of the reported comment body. Self-contained on
   * the event so cross-module consumers (Notification, future
   * Audit) do not need to import the comment repository.
   */
  readonly commentExcerpt: string;
  readonly reporterId: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export interface ReportReviewedEvent {
  readonly eventType: 'report_reviewed';
  readonly reportId: string;
  readonly reviewerId: string;
  readonly status: 'reviewed' | 'dismissed' | 'actioned';
  readonly actionTaken: boolean;
  readonly timestamp: Date;
}

export type CommentDomainEvent =
  | CommentCreatedEvent
  | CommentEditedEvent
  | CommentDeletedEvent
  | CommentHiddenEvent
  | CommentRestoredEvent
  | CommentMentionedEvent
  | VoteCastEvent
  | VoteRemovedEvent
  | CommentReportedEvent
  | ReportReviewedEvent;

// Re-export CommentView for use in createCommentSnapshot
export type { CommentView } from '../types';
import type { CommentView } from '../types';

/**
 * Create a CommentSnapshot from a CommentView for use in WebSocket events.
 * The snapshot flattens the nested author object for easier client-side handling.
 */
export function createCommentSnapshot(
  view: CommentView,
  userVote: 'upvote' | 'downvote' | null = null,
): CommentSnapshot {
  return {
    id: view.id,
    quizId: view.quizId,
    parentCommentId: view.parentCommentId,
    authorId: view.author.userId,
    authorUsername: view.author.username,
    authorDisplayName: view.author.displayName,
    authorAvatarUrl: view.author.avatarUrl,
    body: view.body,
    isHidden: view.isHidden,
    votesCount: view.votesCount,
    upvotesCount: view.upvotesCount,
    downvotesCount: view.downvotesCount,
    repliesCount: view.repliesCount,
    userVote,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    deletedAt: view.deletedAt,
    isReply: view.parentCommentId !== null,
  };
}
