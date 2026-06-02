/**
 * Discussion Domain Event Bus Implementation
 *
 * Simple in-process event bus using the observer pattern.
 */

import { Injectable } from '@nestjs/common';
import type {
  DiscussionDomainEventBusPort,
  DiscussionDomainEvent,
} from './discussion-event-bus.port';
import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentHiddenEvent,
  ThreadClosedEvent,
  ThreadDeletedEvent,
  ThreadHiddenEvent,
  ContentReportedEvent,
  ReportReviewedEvent,
} from './discussion-domain.events';

@Injectable()
export class DiscussionDomainEventBus implements DiscussionDomainEventBusPort {
  private handlers: Array<(event: DiscussionDomainEvent) => void> = [];

  subscribe(handler: (event: DiscussionDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: DiscussionDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in discussion event handler:', error);
      }
    }
  }

  emitCommentCreated(event: CommentCreatedEvent): void {
    this.emit(event);
  }

  emitCommentDeleted(event: CommentDeletedEvent): void {
    this.emit(event);
  }

  emitCommentHidden(event: CommentHiddenEvent): void {
    this.emit(event);
  }

  emitThreadClosed(event: ThreadClosedEvent): void {
    this.emit(event);
  }

  emitThreadDeleted(event: ThreadDeletedEvent): void {
    this.emit(event);
  }

  emitThreadHidden(event: ThreadHiddenEvent): void {
    this.emit(event);
  }

  emitContentReported(event: ContentReportedEvent): void {
    this.emit(event);
  }

  emitReportReviewed(event: ReportReviewedEvent): void {
    this.emit(event);
  }
}
