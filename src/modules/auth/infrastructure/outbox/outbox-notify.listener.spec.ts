/**
 * Unit tests for the `OutboxNotifyListener` happy path.
 *
 * The listener owns the LISTEN connection lifecycle and the
 * fallback poll. We exercise the public dispatch entry points
 * (`handleNotify`, `fallbackPoll`) with stubbed dependencies so
 * we don't need a real Postgres server in unit tests.
 *
 * Dispatch contract verified:
 *   - `handleNotify(payload)` delegates to the processor exactly
 *     once.
 *   - Notifications with an empty payload are ignored.
 *   - `fallbackPoll` invokes the processor.
 *   - The processor error in either path is swallowed by the
 *     `catch` chain so the listener does not throw.
 */

import { OutboxNotifyListener } from './outbox-notify.listener';
import type { OutboxProcessorService } from './outbox-processor.service';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeDrizzleStub = () => {
  const pool = { options: { connectionString: 'postgres://test/test' } };
  return { $client: pool };
};

describe('OutboxNotifyListener', () => {
  it('delegates handleNotify to the processor exactly once', async () => {
    const processor = {
      processPendingEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const handleNotify = (
      listener as unknown as {
        handleNotify(this: void, p: string): Promise<void>;
      }
    ).handleNotify;

    await handleNotify.call(listener as unknown as void, 'event-id-1');

    const processPendingEvents = (
      processor as unknown as {
        processPendingEvents(this: void): Promise<unknown>;
      }
    ).processPendingEvents;
    expect(processPendingEvents).toHaveBeenCalledTimes(1);
  });

  it('ignores notifications with an empty payload', async () => {
    const processor = {
      processPendingEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const handleNotify = (
      listener as unknown as {
        handleNotify(this: void, p: string | undefined): Promise<void>;
      }
    ).handleNotify;

    await handleNotify.call(listener as unknown as void, '');
    await handleNotify.call(listener as unknown as void, undefined);

    const processPendingEvents = (
      processor as unknown as {
        processPendingEvents(this: void): Promise<unknown>;
      }
    ).processPendingEvents;
    expect(processPendingEvents).not.toHaveBeenCalled();
  });

  it('runs the fallback poll on demand', async () => {
    const processor = {
      processPendingEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const fallbackPoll = (
      listener as unknown as {
        fallbackPoll(this: void): Promise<void>;
      }
    ).fallbackPoll;

    await fallbackPoll.call(listener as unknown as void);

    const processPendingEvents = (
      processor as unknown as {
        processPendingEvents(this: void): Promise<unknown>;
      }
    ).processPendingEvents;
    expect(processPendingEvents).toHaveBeenCalledTimes(1);
  });

  it('lets handleNotify errors propagate (they are caught at the pg listener wrapper)', async () => {
    const processor = {
      processPendingEvents: jest.fn().mockRejectedValue(new Error('processor down')),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const handleNotify = (
      listener as unknown as {
        handleNotify(this: void, p: string): Promise<void>;
      }
    ).handleNotify;

    // The `pg.Client` `notification` listener attaches a
    // `.catch()` to swallow errors. `handleNotify` itself is
    // allowed to reject — the wrapper around it is the
    // responsibility boundary.
    await expect(handleNotify.call(listener as unknown as void, 'x')).rejects.toThrow(
      'processor down',
    );
  });

  it('swallows processor errors from the cron-triggered fallback poll', async () => {
    const processor = {
      processPendingEvents: jest.fn().mockRejectedValue(new Error('processor down')),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const fallbackPoll = (
      listener as unknown as {
        fallbackPoll(this: void): Promise<void>;
      }
    ).fallbackPoll;

    // The fallback poll wraps the dispatch in try/catch so a
    // single failure does not stop subsequent ticks.
    await expect(fallbackPoll.call(listener as unknown as void)).resolves.toBeUndefined();
  });

  it('is single-flight: a second notification while one is in flight is skipped', async () => {
    let resolveProcessor!: () => void;
    const processor = {
      processPendingEvents: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveProcessor = resolve;
          }),
      ),
    } as unknown as OutboxProcessorService;

    const listener = new OutboxNotifyListener(
      makeDrizzleStub() as never,
      processor,
      makeLogger() as never,
    );

    const handleNotify = (
      listener as unknown as {
        handleNotify(this: void, p: string): Promise<void>;
      }
    ).handleNotify;

    // `Function.prototype.call` types `thisArg` as `any`, so the
    // return is widened to `any`. Wrap in an explicit cast to the
    // real Promise shape so the lint rule does not see the unsafe
    // intermediate value.
    const first = handleNotify.call(listener, 'x') as Promise<void>;
    const second = handleNotify.call(listener, 'y') as Promise<void>;
    resolveProcessor();
    await Promise.all([first, second]);

    const processPendingEvents = (
      processor as unknown as {
        processPendingEvents(this: void): Promise<unknown>;
      }
    ).processPendingEvents;
    expect(processPendingEvents).toHaveBeenCalledTimes(1);
  });
});
