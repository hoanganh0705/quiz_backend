import { SharedTournamentEventBusAdapter } from './shared-tournament-event-bus.adapter';
import type { SharedTournamentDomainEvent } from '@/common/events/tournament-shared-events';

function makeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

type CacheMock = {
  setIfNotExistsWithTtlSeconds: jest.Mock<Promise<boolean>, [string, string, number]>;
};

type ThrowingCacheMock = {
  setIfNotExistsWithTtlSeconds: jest.Mock<Promise<never>, [string, string, number]>;
};

function makeCache(setIfNotExistsResult: boolean): CacheMock {
  const mock = jest.fn<Promise<boolean>, [string, string, number]>(
    (_key: string, _value: string, _ttl: number) => Promise.resolve(setIfNotExistsResult),
  );
  return { setIfNotExistsWithTtlSeconds: mock };
}

function makeCacheThatThrows(): ThrowingCacheMock {
  const mock = jest.fn<Promise<never>, [string, string, number]>(
    (_key: string, _value: string, _ttl: number) => Promise.reject(new Error('redis down')),
  );
  return { setIfNotExistsWithTtlSeconds: mock };
}

const baseEvent = {
  eventType: 'tournament.joined' as const,
  tournamentId: 't-1',
  userId: 'u-1',
  tournamentTitle: 'Cup',
  categoryTitle: null,
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
};

describe('SharedTournamentEventBusAdapter', () => {
  it('dispatches to every subscribed handler when no cache is wired', () => {
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), null);
    const handler = jest.fn();
    adapter.subscribe(handler);

    adapter.publish(baseEvent);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(baseEvent);
  });

  it('dispatches once when the dedupe claim succeeds', async () => {
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), makeCache(true) as never);
    const handler = jest.fn();
    adapter.subscribe(handler);

    adapter.publish(baseEvent);

    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('skips the fanout when an earlier publish already claimed the slot', async () => {
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), makeCache(false) as never);
    const handler = jest.fn();
    adapter.subscribe(handler);

    adapter.publish(baseEvent);

    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).not.toHaveBeenCalled();
  });

  it('fails open (still dispatches) when the cache throws', async () => {
    const cache = makeCacheThatThrows();
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), cache as never);
    const handler = jest.fn();
    adapter.subscribe(handler);

    adapter.publish(baseEvent);

    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('passes the per-event fanout key to the cache', async () => {
    const cache = makeCache(true);
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), cache as never);
    adapter.subscribe(jest.fn());

    adapter.publish(baseEvent);

    await new Promise((resolve) => setImmediate(resolve));

    expect(cache.setIfNotExistsWithTtlSeconds).toHaveBeenCalledWith(
      'shared:tournament:fanout:tournament.joined:u-1:t-1',
      '1',
      30,
    );
  });

  it('swallows handler errors and continues dispatching the remaining handlers', () => {
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), null);
    const second = jest.fn();
    adapter.subscribe(() => {
      throw new Error('boom');
    });
    adapter.subscribe(second);

    adapter.publish(baseEvent);

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('only fires the duplicate-call guard for events with a tournamentId', async () => {
    const cache = makeCache(true);
    const adapter = new SharedTournamentEventBusAdapter(makeLogger(), cache as never);
    const handler = jest.fn();
    adapter.subscribe(handler);

    const malformed = {
      ...(baseEvent as object),
      tournamentId: undefined,
    } as unknown as SharedTournamentDomainEvent;

    adapter.publish(malformed);

    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(cache.setIfNotExistsWithTtlSeconds).not.toHaveBeenCalled();
  });
});
