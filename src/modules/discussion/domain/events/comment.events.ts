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
 */

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
}

export interface CommentEditedEvent {
  readonly eventType: 'comment_edited';
  readonly commentId: string;
  readonly quizId: string;
  readonly authorId: string;
  readonly timestamp: Date;
}

export interface CommentDeletedEvent {
  readonly eventType: 'comment_deleted';
  readonly commentId: string;
  readonly quizId: string;
  readonly authorId: string;
  readonly timestamp: Date;
}

export interface CommentHiddenEvent {
  readonly eventType: 'comment_hidden';
  readonly commentId: string;
  readonly quizId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
}

export interface CommentRestoredEvent {
  readonly eventType: 'comment_restored';
  readonly commentId: string;
  readonly quizId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
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
  readonly voterId: string;
  readonly value: 'upvote' | 'downvote';
  readonly timestamp: Date;
}

export interface VoteRemovedEvent {
  readonly eventType: 'vote_removed';
  readonly commentId: string;
  readonly voterId: string;
  readonly timestamp: Date;
}

export interface CommentReportedEvent {
  readonly eventType: 'comment_reported';
  readonly reportId: string;
  readonly commentId: string;
  /**
   * Quiz the reported comment belongs to. Included so the
   * notification listener can build a moderator-facing summary
   * without re-querying the discussion module.
   */
  readonly quizId: string;
  /**
   * Short excerpt of the reported comment body. Self-contained on
   * the event so cross-module consumers (Notification, future
   * Audit) do not need to import the discussion repository.
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