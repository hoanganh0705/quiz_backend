/**
 * Discussion Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to discussion domain events.
 */

import type {
  DiscussionDomainEvent,
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentHiddenEvent,
  ThreadClosedEvent,
  ThreadDeletedEvent,
  ThreadReopenedEvent,
  ThreadHiddenEvent,
  ContentReportedEvent,
  DiscussionThreadCreatedEvent,
  DiscussionThreadSolvedEvent,
  ReportReviewedEvent,
} from '../events/discussion-domain.events';

export interface DiscussionDomainEventBusPort {
  subscribe(handler: (event: DiscussionDomainEvent) => void): () => void;

  emitCommentCreated(event: CommentCreatedEvent): void;
  emitCommentDeleted(event: CommentDeletedEvent): void;
  emitCommentHidden(event: CommentHiddenEvent): void;
  emitThreadCreated(event: DiscussionThreadCreatedEvent): void;
  emitThreadSolved(event: DiscussionThreadSolvedEvent): void;
  emitThreadClosed(event: ThreadClosedEvent): void;
  emitThreadDeleted(event: ThreadDeletedEvent): void;
  emitThreadReopened(event: ThreadReopenedEvent): void;
  emitThreadHidden(event: ThreadHiddenEvent): void;
  emitContentReported(event: ContentReportedEvent): void;
  emitReportReviewed(event: ReportReviewedEvent): void;
}

export const DISCUSSION_DOMAIN_EVENT_BUS = Symbol('DISCUSSION_DOMAIN_EVENT_BUS');
