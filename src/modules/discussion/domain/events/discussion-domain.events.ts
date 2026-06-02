/**
 * Discussion Domain Events
 *
 * Defines all events emitted by the Discussion Domain.
 */

export interface CommentCreatedEvent {
  readonly eventType: 'comment_created';
  readonly commentId: string;
  readonly threadId: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly isReply: boolean;
  readonly timestamp: Date;
}

export interface CommentDeletedEvent {
  readonly eventType: 'comment_deleted';
  readonly commentId: string;
  readonly threadId: string;
  readonly authorId: string;
  readonly timestamp: Date;
}

export interface CommentHiddenEvent {
  readonly eventType: 'comment_hidden';
  readonly commentId: string;
  readonly threadId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
}

export interface ThreadClosedEvent {
  readonly eventType: 'thread_closed';
  readonly threadId: string;
  readonly authorId: string;
  readonly timestamp: Date;
}

export interface ThreadDeletedEvent {
  readonly eventType: 'thread_deleted';
  readonly threadId: string;
  readonly authorId: string;
  readonly timestamp: Date;
}

export interface ThreadHiddenEvent {
  readonly eventType: 'thread_hidden';
  readonly threadId: string;
  readonly moderatorId: string;
  readonly timestamp: Date;
}

export interface ContentReportedEvent {
  readonly eventType: 'content_reported';
  readonly reportId: string;
  readonly reporterId: string;
  readonly targetType: 'thread' | 'comment' | 'reply';
  readonly targetId: string;
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

export type DiscussionDomainEvent =
  | CommentCreatedEvent
  | CommentDeletedEvent
  | CommentHiddenEvent
  | ThreadClosedEvent
  | ThreadDeletedEvent
  | ThreadHiddenEvent
  | ContentReportedEvent
  | ReportReviewedEvent;
