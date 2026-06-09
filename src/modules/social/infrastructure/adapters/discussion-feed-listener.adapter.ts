import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  type DiscussionDomainEventBusPort,
} from '@/modules/discussion/domain/events';
import type {
  DiscussionDomainEvent,
  DiscussionThreadCreatedEvent,
  DiscussionThreadSolvedEvent,
} from '@/modules/discussion/domain/events/discussion-domain.events';
import { SocialService } from '../../domain/services/social.service';

@Injectable()
export class DiscussionFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(DISCUSSION_DOMAIN_EVENT_BUS)
    private readonly discussionEventBus: DiscussionDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(DiscussionFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.discussionEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: DiscussionDomainEvent): Promise<void> {
    if (event.eventType === 'discussion_thread_created') {
      await this.recordThreadCreated(event);
      return;
    }

    if (event.eventType === 'discussion_thread_solved') {
      await this.recordThreadSolved(event);
    }
  }

  private async recordThreadCreated(event: DiscussionThreadCreatedEvent): Promise<void> {
    await this.socialService.recordFeedActivity({
      userId: event.authorId,
      activityType: 'discussion_created',
      occurredAt: event.timestamp.toISOString(),
      payload: {
        threadId: event.threadId,
        quizId: event.quizId,
        title: event.title,
      },
    });
  }

  private async recordThreadSolved(event: DiscussionThreadSolvedEvent): Promise<void> {
    await this.socialService.recordFeedActivity({
      userId: event.authorId,
      activityType: 'discussion_solved',
      occurredAt: event.timestamp.toISOString(),
      payload: {
        threadId: event.threadId,
        commentId: event.commentId,
        solverId: event.solverId,
      },
    });
  }
}
