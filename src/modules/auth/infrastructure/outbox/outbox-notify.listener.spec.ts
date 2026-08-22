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

    await (listener as unknown as { handleNotify(p: string): Promise<void> }).handleNotify(
      'event-id-1',
    );

    expect(processor.processPendingEvents).toHaveBeenCalledTimes(1);
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

    await (listener as unknown as { handleNotify(p: string): Promise<void> }).handleNotify('');
    await (listener as unknown as { handleNotify(p: string | undefined): Promise<void> }).handleNotify(
      undefined,
    );

    expect(processor.processPendingEvents).not.toHaveBeenCalled();
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

    await (listener as unknown as { fallbackPoll(): Promise<void> }).fallbackPoll();
    expect(processor.processPendingEvents).toHaveBeenCalledTimes(1);
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

    // The `pg.Client` `notification` listener attaches a
    // `.catch()` to swallow errors. `handleNotify` itself is
    // allowed to reject — the wrapper around it is the
    // responsibility boundary.
    await expect(
      (listener as unknown as { handleNotify(p: string): Promise<void> }).handleNotify('x'),
    ).rejects.toThrow('processor down');
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

    // The fallback poll wraps the dispatch in try/catch so a
    // single failure does not stop subsequent ticks.
    await expect(
      (listener as unknown as { fallbackPoll(): Promise<void> }).fallbackPoll(),
    ).resolves.toBeUndefined();
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

    const handleNotify = (listener as unknown as {
      handleNotify(p: string): Promise<void>;
    }).handleNotify.bind(listener);

    const first = handleNotify('x');
    const second = handleNotify('y');
    resolveProcessor();
    await Promise.all([first, second]);

    expect(processor.processPendingEvents).toHaveBeenCalledTimes(1);
  });
});