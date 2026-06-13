export interface ReviewDomainEvent {
  readonly occurredAt: string;
}

export interface ReviewSubmittedPayload {
  quizId: string;
  reviewId: string;
  userId: string;
  rating: number;
}

export class ReviewSubmittedEvent implements ReviewDomainEvent {
  readonly occurredAt: string;
  constructor(public readonly payload: ReviewSubmittedPayload) {
    this.occurredAt = new Date().toISOString();
  }

  get eventType(): 'review.submitted' {
    return 'review.submitted';
  }
}

export interface ReviewDeletedPayload {
  quizId: string;
  reviewId: string;
}

export class ReviewDeletedEvent implements ReviewDomainEvent {
  readonly occurredAt: string;
  constructor(public readonly payload: ReviewDeletedPayload) {
    this.occurredAt = new Date().toISOString();
  }

  get eventType(): 'review.deleted' {
    return 'review.deleted';
  }
}
