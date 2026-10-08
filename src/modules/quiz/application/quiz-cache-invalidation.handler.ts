import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  QUIZ_DOMAIN_EVENT_BUS,
  type QuizDomainEventBusPort,
} from '../domain/ports/quiz-domain-event-bus.port';
import {
  QuizCreatedEvent,
  QuizUpdatedEvent,
  QuizDeletedEvent,
} from '../domain/events/quiz-domain.events';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import { QuizCacheService } from './quiz-cache.service';

type AffectedQuiz = { quizId: string };

@Injectable()
export class QuizCacheInvalidationHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(QUIZ_DOMAIN_EVENT_BUS)
    private readonly eventBus: QuizDomainEventBusPort,
    private readonly cache: QuizCacheService,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(QuizCacheInvalidationHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      if (this.isMutationEvent(event)) {
        this.cache.invalidateList().catch((error: unknown) => {
          this.recordFailure('quiz-list', error);
        });

        const quizId = this.quizIdOf(event);
        if (quizId) {
          this.cache.invalidateStats(quizId).catch((error: unknown) => {
            this.recordFailure('quiz-stats', error, { quizId });
          });
        }
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private recordFailure(
    cache: string,
    error: unknown,
    context: Record<string, unknown> = {},
  ): void {
    this.metrics?.incCacheInvalidationFailed(cache);
    this.logger.warn({
      event: 'quiz_cache_invalidation_failed',
      cache,
      message: error instanceof Error ? error.message : 'unknown',
      ...context,
    });
  }

  private isMutationEvent(
    event: unknown,
  ): event is QuizCreatedEvent | QuizUpdatedEvent | QuizDeletedEvent {
    if (event === null || typeof event !== 'object') return false;
    const kind = (event as { kind?: unknown }).kind;
    if (kind === 'quiz.created' || kind === 'quiz.updated' || kind === 'quiz.deleted') {
      return true;
    }
    return (
      event instanceof QuizCreatedEvent ||
      event instanceof QuizUpdatedEvent ||
      event instanceof QuizDeletedEvent
    );
  }

  private quizIdOf(event: unknown): string | null {
    if (event === null || typeof event !== 'object') return null;
    const candidate = event as AffectedQuiz & { quizId?: unknown };
    return typeof candidate.quizId === 'string' ? candidate.quizId : null;
  }
}
