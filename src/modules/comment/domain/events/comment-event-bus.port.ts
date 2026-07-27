/**
 * Comment Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to comment domain
 * events. Producers (the domain service) and consumers (Notification,
 * Social) share the same union type so the bus surface is symmetric.
 */

import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentDomainEvent,
  CommentEditedEvent,
  CommentHiddenEvent,
  CommentMentionedEvent,
  CommentReportedEvent,
  CommentRestoredEvent,
  ReportReviewedEvent,
  VoteCastEvent,
  VoteRemovedEvent,
} from './comment.events';

export interface CommentDomainEventBusPort {
  subscribe(handler: (event: CommentDomainEvent) => void): () => void;

  emitCommentCreated(event: CommentCreatedEvent): void;
  emitCommentEdited(event: CommentEditedEvent): void;
  emitCommentDeleted(event: CommentDeletedEvent): void;
  emitCommentHidden(event: CommentHiddenEvent): void;
  emitCommentRestored(event: CommentRestoredEvent): void;
  emitCommentMentioned(event: CommentMentionedEvent): void;
  emitVoteCast(event: VoteCastEvent): void;
  emitVoteRemoved(event: VoteRemovedEvent): void;
  emitCommentReported(event: CommentReportedEvent): void;
  emitReportReviewed(event: ReportReviewedEvent): void;
}

export const COMMENT_DOMAIN_EVENT_BUS = Symbol('COMMENT_DOMAIN_EVENT_BUS');
