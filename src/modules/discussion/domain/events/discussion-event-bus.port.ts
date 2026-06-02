/**
 * Discussion Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to discussion domain events.
 */

import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentHiddenEvent,
  ThreadClosedEvent,
  ThreadDeletedEvent,
  ThreadHiddenEvent,
  ContentReportedEvent,
  ReportReviewedEvent,
} from '../events/discussion-domain.events';

export interface DiscussionDomainEventBusPort {
  subscribe(handler: (event: DiscussionDomainEvent) => void): () => void;

  emitCommentCreated(event: CommentCreatedEvent): void;
  emitCommentDeleted(event: CommentDeletedEvent): void;
  emitCommentHidden(event: CommentHiddenEvent): void;
  emitThreadClosed(event: ThreadClosedEvent): void;
  emitThreadDeleted(event: ThreadDeletedEvent): void;
  emitThreadHidden(event: ThreadHiddenEvent): void;
  emitContentReported(event: ContentReportedEvent): void;
  emitReportReviewed(event: ReportReviewedEvent): void;
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

export const DISCUSSION_DOMAIN_EVENT_BUS = Symbol('DISCUSSION_DOMAIN_EVENT_BUS');
