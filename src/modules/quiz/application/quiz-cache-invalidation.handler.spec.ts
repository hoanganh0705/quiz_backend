/**
 * Unit tests for `QuizCacheInvalidationHandler`.
 *
 * The handler is a thin wrapper around `QuizDomainEventBus`. We
 * verify that the three documented mutation events trigger a
 * list-cache invalidation, that non-mutation events do not, and
 * that a failing invalidation does not throw (it is best-effort).
 */

import { QuizCacheInvalidationHandler } from './quiz-cache-invalidation.handler';
import type { QuizDomainEventBusPort } from '../domain/ports/quiz-domain-event-bus.port';
import type { QuizCacheService } from './quiz-cache.service';

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

describe('QuizCacheInvalidationHandler', () => {
  let bus: FakeEventBus;
  let cache: { invalidateList: jest.Mock };
  let handler: QuizCacheInvalidationHandler;

  beforeEach(() => {
    bus = new FakeEventBus();
    cache = { invalidateList: jest.fn().mockResolvedValue(undefined) };
    handler = new QuizCacheInvalidationHandler(bus, cache as unknown as QuizCacheService);
  });

  it('subscribes on init and unsubscribes on destroy', () => {
    handler.onModuleInit();
    expect(bus['handlers']).toHaveLength(1);
    handler.onModuleDestroy();
    expect(bus['handlers']).toHaveLength(0);
  });

  it('invalidates the list cache on QuizCreatedEvent', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.created', quizId: 'q1' });
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
  });

  it('invalidates the list cache on QuizUpdatedEvent', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.updated', quizId: 'q1' });
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
  });

  it('invalidates the list cache on QuizDeletedEvent', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.deleted', quizId: 'q1' });
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate the list cache for unrelated events', () => {
    handler.onModuleInit();
    bus.emit({ kind: 'quiz.viewed', quizId: 'q1' });
    bus.emit(null);
    bus.emit(undefined);
    bus.emit({ kind: 'attempt.completed' });
    expect(cache.invalidateList).not.toHaveBeenCalled();
  });

  it('swallows invalidation errors so domain dispatch is not blocked', async () => {
    cache.invalidateList.mockRejectedValue(new Error('redis down'));
    handler.onModuleInit();

    expect(() => bus.emit({ kind: 'quiz.created', quizId: 'q1' })).not.toThrow();
    // Allow the rejected promise to settle.
    await new Promise((resolve) => setImmediate(resolve));
    expect(cache.invalidateList).toHaveBeenCalledTimes(1);
  });
});