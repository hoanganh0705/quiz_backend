/**
 * Quiz cache invalidation handler.
 *
 * Wires the `QuizDomainEventBus` to the `QuizCacheService`. Every
 * `QuizCreatedEvent` / `QuizUpdatedEvent` / `QuizDeletedEvent`
 * triggers a single `invalidateList()` call so the next
 * `GET /quizzes` call sees fresh data.
 *
 * The handler is registered in `QuizModule` and subscribes in
 * `OnModuleInit`. The subscription is kept in a private field so
 * the unsubscribe function can be called in `OnModuleDestroy` —
 * this matters for the test harness which re-creates the module
 * between cases.
 *
 * Phase 3 #1 of the resilience roadmap (see `BACKEND_AUDIT_REPORT.md`
 * §23 Phase 3).
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  QUIZ_DOMAIN_EVENT_BUS,
  type QuizDomainEventBusPort,
} from '../domain/ports/quiz-domain-event-bus.port';
import type {
  QuizCreatedEvent,
  QuizUpdatedEvent,
  QuizDeletedEvent,
} from '../domain/events/quiz-domain.events';
import { QuizCacheService } from './quiz-cache.service';

@Injectable()
export class QuizCacheInvalidationHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(QUIZ_DOMAIN_EVENT_BUS)
    private readonly eventBus: QuizDomainEventBusPort,
    private readonly cache: QuizCacheService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      if (this.isQuizMutationEvent(event)) {
        this.cache.invalidateList().catch(() => {
          // Invalidation is best-effort: a stale cache entry will
          // expire on its own TTL (60s). The next event will
          // retry. We intentionally swallow the error so a
          // transient Redis blip cannot block the domain event
          // dispatch.
        });
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private isQuizMutationEvent(
    event: unknown,
  ): event is QuizCreatedEvent | QuizUpdatedEvent | QuizDeletedEvent {
    if (event === null || typeof event !== 'object') return false;
    const kind = (event as { kind?: unknown }).kind;
    return kind === 'quiz.created' || kind === 'quiz.updated' || kind === 'quiz.deleted';
  }
}