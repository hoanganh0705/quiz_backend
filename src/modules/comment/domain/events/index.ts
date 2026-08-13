/**
 * Comment module — domain events public surface.
 *
 * Re-exports the event types, the bus port, and the bus symbol so the
 * application layer can depend on a single import path.
 */

export { COMMENT_DOMAIN_EVENT_BUS, type CommentDomainEventBusPort } from './comment-event-bus.port';

export { CommentDomainEventBus } from './comment-event-bus';

export {
  createCommentSnapshot,
  type CommentSnapshot,
  type CommentCreatedEvent,
  type CommentDeletedEvent,
  type CommentDomainEvent,
  type CommentEditedEvent,
  type CommentHiddenEvent,
  type CommentMentionedEvent,
  type CommentReportedEvent,
  type CommentRestoredEvent,
  type ReportReviewedEvent,
  type VoteCastEvent,
  type VoteRemovedEvent,
} from './comment.events';
