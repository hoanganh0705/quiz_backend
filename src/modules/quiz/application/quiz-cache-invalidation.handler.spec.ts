/**
 * Unit tests for `QuizCacheInvalidationHandler`.
 *
 * The handler is a thin wrapper around `QuizDomainEventBus`. We
 * verify that the three documented mutation events trigger both
 * list-cache and stats-cache invalidation, that non-mutation
 * events do neither, and that a failing invalidation does not
 * throw (it is best-effort) and emits a metric increment + warn log.
 */

import { QuizCacheInvalidationHandler } from './quiz-cache-invalidation.handler';
import type { QuizDomainEventBusPort } from '../domain/ports/quiz-domain-event-bus.port';
import type { QuizCacheService } from './quiz-cache.service';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';
import type { PinoLogger } from 'nestjs-pino';
import {
  QuizCreatedEvent,
  QuizUpdatedEvent,
  QuizDeletedEvent,
} from '../domain/events/quiz-domain.events';

type Handler = (event: unknown) => void;

class FakeEventBus implements QuizDomainEventBusPort {
  private handlers: Handler[] = [];

  subscribe(handler: Handler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: unknown): void {
    for (const handler of this.handlers) handler(event);
  }

  emitQuizCreated(): void {
    /* unused in tests */
  }
  emitQuizUpdated(): void {
    /* unused in tests */
  }
  emitQuizDeleted(): void {
    /* unused in tests */
  }
  emitQuizVersionCreated(): void {
    /* unused in tests */
  }
  emitQuizVersionPublished(): void {
    /* unused in tests */
  }
}

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makeMetrics(): MetricsRegistry {
  return {
    incCacheInvalidationFailed: jest.fn(),
  } as unknown as MetricsRegistry;
}

describe('QuizCacheInvalidationHandler', () => {
  let bus: FakeEventBus;
  let cache: {
    invalidateList: jest.Mock;
    invalidateStats: jest.Mock;
  };
  let metrics: MetricsRegistry;
  let logger: PinoLogger;
  let handler: QuizCacheInvalidationHandler;

  beforeEach(() => {
    bus = new FakeEventBus();
    cache = {
      invalidateList: jest.fn().mockResolvedValue(undefined),
      invalidateStats: jest.fn().mockResolvedValue(undefined),
    };
    metrics = makeMetrics();
    logger = makeLogger();
    handler = new QuizCacheInvalidationHandler(
      bus,
      cache as unknown as QuizCacheService,
      metrics,
      logger,
    );
  });

  it('subscribes on init and unsubscribes on destroy', () => {
    handler.onModuleInit();
    expect(bus['handlers']).toHaveLength(1);
    handler.onModuleDestroy();
    expect(bus['handlers']).toHaveLength(0);
  });

  it('invalidates the list and stats caches on a QuizCreatedEvent instance', () => {
    handler.onModuleInit();
    const event = new QuizCreatedEvent('q1', 'creator-1', 'quiz-1', '2026-01-01T00:00:00.000Z');
    bus.emit(event);
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledWith('q1');
  });

  it('invalidates the list and stats caches on a QuizUpdatedEvent instance', () => {
    handler.onModuleInit();
    const event = new QuizUpdatedEvent('q1', 'updater-1', '2026-01-01T00:00:00.000Z');
    bus.emit(event);
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledWith('q1');
  });

  it('invalidates the list and stats caches on a QuizDeletedEvent instance', () => {
    handler.onModuleInit();
    const event = new QuizDeletedEvent('q1', 'deleter-1', '2026-01-01T00:00:00.000Z');
    bus.emit(event);
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledWith('q1');
  });

  it('also accepts the legacy plain-object event shape (kind + quizId)', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.updated', quizId: 'q2' });
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledWith('q2');
  });

  it('does not invalidate any cache for unrelated events', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.viewed', quizId: 'q1' });
    bus.emit(null);
    bus.emit(undefined);
    bus.emit({ kind: 'attempt.completed' });
    expect(cache.invalidateList).not.toHaveBeenCalled();
    expect(cache.invalidateStats).not.toHaveBeenCalled();
  });

  it('does not invalidate stats when the mutation event has no quizId', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.updated' });
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).not.toHaveBeenCalled();
  });

  it('swallows list invalidation errors, increments the metric, and logs a warning', async () => {
    cache.invalidateList.mockRejectedValue(new Error('redis down'));
    handler.onModuleInit();

    expect(() =>
      bus.emit(new QuizUpdatedEvent('q1', 'updater-1', '2026-01-01T00:00:00.000Z')),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledTimes(1);
    expect(metrics.incCacheInvalidationFailed).toHaveBeenCalledWith('quiz-list');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'quiz_cache_invalidation_failed',
        cache: 'quiz-list',
        message: 'redis down',
      }),
    );
  });

  it('swallows stats invalidation errors, increments the metric, and logs a warning', async () => {
    cache.invalidateStats.mockRejectedValue(new Error('redis down'));
    handler.onModuleInit();

    expect(() =>
      bus.emit(new QuizDeletedEvent('q1', 'deleter-1', '2026-01-01T00:00:00.000Z')),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
    expect(cache.invalidateStats).toHaveBeenCalledTimes(1);
    expect(metrics.incCacheInvalidationFailed).toHaveBeenCalledWith('quiz-stats');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'quiz_cache_invalidation_failed',
        cache: 'quiz-stats',
        quizId: 'q1',
      }),
    );
  });
});
