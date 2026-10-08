import { BaseDomainEventBus } from './base-domain-event-bus';

type TestEvent = { readonly eventType: string; readonly value: number };

class TestLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

const makeBus = (): { bus: BaseDomainEventBus<TestEvent>; logger: TestLogger } => {
  const logger = new TestLogger();
  const bus = new BaseDomainEventBus<TestEvent>(logger as unknown as never, {
    logEventName: 'test_bus',
  });
  return { bus, logger };
};

describe('BaseDomainEventBus', () => {
  describe('dispatch', () => {
    it('runs every registered handler with the event', () => {
      const { bus } = makeBus();
      const calls: number[] = [];
      bus.subscribe((event) => {
        calls.push(event.value);
      });
      bus.subscribe((event) => {
        calls.push(event.value * 10);
      });

      bus.dispatch({ eventType: 'demo', value: 2 });

      expect(calls).toEqual([2, 20]);
    });

    it('logs a sync handler error and continues iterating remaining handlers', () => {
      const { bus, logger } = makeBus();
      const secondHandler = jest.fn();
      bus.subscribe(() => {
        throw new Error('boom-sync');
      });
      bus.subscribe(secondHandler);

      bus.dispatch({ eventType: 'demo', value: 1 });

      expect(secondHandler).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_bus_handler_error',
          eventType: 'demo',
        }),
      );
    });

    it('logs an async handler rejection and continues iterating remaining handlers', async () => {
      const { bus, logger } = makeBus();
      const secondHandler = jest.fn();
      bus.subscribe(() => Promise.reject(new Error('boom-async')));
      bus.subscribe(secondHandler);

      bus.dispatch({ eventType: 'demo', value: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(secondHandler).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_bus_handler_error',
          eventType: 'demo',
        }),
      );
    });
  });

  describe('dispatchToSubscribers', () => {
    it('logs sync handler errors with eventType and continues iterating', () => {
      const { bus, logger } = makeBus();
      const secondHandler = jest.fn();
      bus.subscribe(() => {
        throw new Error('sync-fail');
      });
      bus.subscribe(secondHandler);

      bus.dispatchToSubscribers({ eventType: 'sub.sync', value: 0 });

      expect(secondHandler).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_bus_handler_error',
          eventType: 'sub.sync',
        }),
      );
    });

    it('logs async handler rejections with eventType', async () => {
      const { bus, logger } = makeBus();
      bus.subscribe(() => Promise.reject(new Error('async-fail')));

      bus.dispatchToSubscribers({ eventType: 'sub.async', value: 0 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test_bus_handler_error',
          eventType: 'sub.async',
        }),
      );
    });

    it('continues to the next handler after one logs an error', () => {
      const { bus } = makeBus();
      const calls: string[] = [];
      bus.subscribe(() => {
        throw new Error('first-handler-fails');
      });
      bus.subscribe(() => {
        calls.push('second');
      });
      bus.subscribe(() => {
        calls.push('third');
      });

      bus.dispatchToSubscribers({ eventType: 'sub.cont', value: 0 });

      expect(calls).toEqual(['second', 'third']);
    });
  });

  describe('dispatchStrict', () => {
    it('awaits every handler before resolving (parallel execution, but all complete)', async () => {
      const { bus } = makeBus();
      const completed: string[] = [];
      bus.subscribe(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        completed.push('first');
      });
      bus.subscribe(() => {
        completed.push('second');
      });

      await bus.dispatchStrict({ eventType: 'strict.await', value: 0 });

      expect(completed.sort()).toEqual(['first', 'second']);
    });

    it('logs each handler rejection with its eventType', async () => {
      const { bus, logger } = makeBus();
      bus.subscribe(() => Promise.reject(new Error('first-rejects')));
      bus.subscribe(() => Promise.reject(new Error('second-rejects')));

      await bus.dispatchStrict({ eventType: 'strict.two', value: 0 });

      const errorEvents = logger.error.mock.calls.filter(
        ([payload]) => (payload as { event?: string }).event === 'test_bus_handler_error',
      );
      expect(errorEvents).toHaveLength(2);
      expect(
        errorEvents.every(
          ([payload]) => (payload as { eventType?: string }).eventType === 'strict.two',
        ),
      ).toBe(true);
    });

    it('does not reject when a single handler throws — Promise.allSettled semantics', async () => {
      const { bus } = makeBus();
      bus.subscribe(() => Promise.reject(new Error('will-not-propagate')));
      bus.subscribe(() => Promise.resolve());

      await expect(
        bus.dispatchStrict({ eventType: 'strict.allsettled', value: 0 }),
      ).resolves.toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function that removes the handler', () => {
      const { bus } = makeBus();
      const handler = jest.fn();
      const unsubscribe = bus.subscribe(handler);
      unsubscribe();

      bus.dispatch({ eventType: 'unsub', value: 1 });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
