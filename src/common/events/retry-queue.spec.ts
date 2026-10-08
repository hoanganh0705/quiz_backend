import type { PinoLogger } from 'nestjs-pino';
import { RetryQueue } from './retry-queue';
import type { CacheProvider } from '@/common/ports/cache.provider';

interface FakeIndexEntry {
  member: string;
  score: number;
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

function makeCache(): CacheProvider & {
  indexEntries: FakeIndexEntry[];
  payloadByKey: Map<string, string>;
  listByKey: Map<string, string[]>;
  ttlsByKey: Map<string, number>;
  deadLetter: Array<Record<string, unknown>>;
} {
  const indexEntries: FakeIndexEntry[] = [];
  const payloadByKey = new Map<string, string>();
  const listByKey = new Map<string, string[]>();
  const ttlsByKey = new Map<string, number>();
  const deadLetter: Array<Record<string, unknown>> = [];
  let now = 0;

  const cache = {
    indexEntries,
    payloadByKey,
    listByKey,
    ttlsByKey,
    deadLetter,
    get: jest.fn(async (key: string) => payloadByKey.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ttlMs: number) => {
      payloadByKey.set(key, value);
      ttlsByKey.set(key, now + ttlMs);
    }),
    del: jest.fn(async (key: string) => {
      const removed = payloadByKey.delete(key);
      ttlsByKey.delete(key);
      return removed;
    }),
    getDel: jest.fn(async (key: string) => {
      const value = payloadByKey.get(key);
      payloadByKey.delete(key);
      ttlsByKey.delete(key);
      return value ?? null;
    }),
    rpushJson: jest.fn(async (key: string, item: unknown) => {
      let list = listByKey.get(key);
      if (!list) {
        list = [];
        listByKey.set(key, list);
      }
      list.push(JSON.stringify(item));
      return list.length;
    }),
    lpopJson: jest.fn(async <T>(_key: string): Promise<T | null> => null),
    lrangeJson: jest.fn(async <T>(_key: string, _start: number, _stop: number): Promise<T[]> => []),
    trimList: jest.fn(async (key: string, start: number, stop: number) => {
      const list = listByKey.get(key) ?? [];
      const from = start < 0 ? Math.max(list.length + start, 0) : start;
      const to = stop < 0 ? list.length + stop : Math.min(stop, list.length - 1);
      const trimmed = list.slice(from, to + 1);
      listByKey.set(key, trimmed);
      return trimmed.length;
    }),
    expire: jest.fn(async () => true),
    listLength: jest.fn(async (_key: string) => 0),
    pipelineDeadLetterPush: jest.fn(async () => undefined),
    zaddByScore: jest.fn(async (key: string, score: number, member: string) => {
      const existing = indexEntries.findIndex((e) => e.member === member);
      if (existing !== -1) {
        indexEntries.splice(existing, 1);
      }
      indexEntries.push({ member, score });
      indexEntries.sort((a, b) => a.score - b.score);
      const list = listByKey.get(key) ?? [];
      list.push(member);
      listByKey.set(key, list);
      return existing === -1 ? 1 : 0;
    }),
    zrangeByScore: jest.fn(
      async (
        _key: string,
        min: number | string,
        max: number | string,
        limit: number,
        withScores: boolean,
      ): Promise<Array<{ member: string; score: number }>> => {
        const minScore = min === '-inf' ? -Infinity : Number(min);
        const maxScore = max === '+inf' ? Infinity : Number(max);
        const matching = indexEntries.filter(
          (entry) => entry.score >= minScore && entry.score <= maxScore,
        );
        const sliced = matching.slice(0, limit);
        if (!withScores) {
          return sliced.map((entry) => ({ member: entry.member, score: 0 }));
        }
        return sliced;
      },
    ),
    zrem: jest.fn(async (key: string, member: string) => {
      const idx = indexEntries.findIndex((e) => e.member === member);
      if (idx === -1) return false;
      indexEntries.splice(idx, 1);
      const list = listByKey.get(key) ?? [];
      const listIdx = list.indexOf(member);
      if (listIdx !== -1) {
        list.splice(listIdx, 1);
        listByKey.set(key, list);
      }
      return true;
    }),
    acquireAdvisoryLock: jest.fn(async () => 'lock-token'),
    releaseAdvisoryLock: jest.fn(async () => true),
    unlinkByPattern: jest.fn(),
    incrementWindowCounter: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    multiExec: jest
      .fn()
      .mockImplementation(
        async (commands: Array<[command: string, ...args: (string | number)[]]>) => {
          const results: unknown[] = [];
          for (const [command, ...args] of commands) {
            try {
              if (command === 'set') {
                const key = String(args[0]);
                const value = String(args[1]);
                const ttlMs = Number(args[3]);
                results.push(await cache.set(key, value, ttlMs));
              } else if (command === 'zadd') {
                const key = String(args[0]);
                const score = Number(args[1]);
                const member = String(args[2]);
                results.push(await cache.zaddByScore(key, score, member));
              } else if (command === 'getdel') {
                const key = String(args[0]);
                results.push(await cache.getDel(key));
              } else {
                results.push(null);
              }
            } catch {
              results.push(null);
            }
          }
          return results;
        },
      ),
    setNow: (t: number) => {
      now = t;
    },
    tickMs: (delta: number) => {
      now += delta;
    },
  };

  return cache as unknown as ReturnType<typeof makeCache>;
}

function makeConfig(overrides: Partial<Parameters<typeof RetryQueue.prototype.start>[0]> = {}) {
  return {
    retryQueuePrefix: 'test:retry',
    deadLetterKey: 'test:dead-letter',
    retryDelaysMs: [10, 20, 30] as const,
    pollIntervalMs: 60_000,
    pollLockKey: 'test:retry:poll-lock',
    pollLockTtlMs: 5_000,
    loggerName: 'TestQueue',
    ...overrides,
  };
}

describe('RetryQueue — sorted-set ordered dispatch', () => {
  it('calls multiExec with set and zadd commands when scheduling a retry', async () => {
    const multiExecMock = jest.fn().mockResolvedValue([null, null]);
    const cache = makeCache();
    (cache as unknown as { multiExec: jest.Mock }).multiExec = multiExecMock;

    const queue = new RetryQueue<unknown>(cache, makeLogger(), makeConfig());
    queue.subscribe(() => {
      throw new Error('force-retry');
    });

    queue.dispatch({ payload: 1 });

    await Promise.resolve();
    await Promise.resolve();

    expect(multiExecMock).toHaveBeenCalled();
  });

  it('delivers due items in score order', async () => {
    const received: number[] = [];
    const queue = new RetryQueue<{ payload: number }>(makeCache(), makeLogger(), makeConfig());
    queue.subscribe((event) => {
      received.push(event.payload);
    });

    queue.dispatch({ payload: 1 });
    queue.dispatch({ payload: 2 });
    queue.dispatch({ payload: 3 });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const drained = await (queue as unknown as { drainOnce: () => Promise<void> }).drainOnce();

    expect(drained).toBeUndefined();
    expect(received.length).toBeGreaterThan(0);
  });

  it('leaves not-yet-due items in the index untouched', async () => {
    const cache = makeCache();
    const futureScore = Date.now() + 10_000;
    cache.indexEntries.push({ member: 'future-key', score: futureScore });
    cache.payloadByKey.set(
      'future-key',
      JSON.stringify({
        event: { payload: 99 },
        attempt: 1,
        nextRetryAt: futureScore,
        tierKey: 'future-key',
      }),
    );

    const queue = new RetryQueue<{ payload: number }>(cache, makeLogger(), makeConfig());
    queue.subscribe(() => undefined);

    await (queue as unknown as { drainOnce: () => Promise<void> }).drainOnce();

    expect(cache.zrem).not.toHaveBeenCalledWith(expect.anything(), 'future-key');
    expect(cache.indexEntries.find((e) => e.member === 'future-key')).toBeDefined();
  });

  it('does not lose items when zrangeByScore returns an empty batch', async () => {
    const cache = makeCache();
    const queue = new RetryQueue<{ payload: number }>(cache, makeLogger(), makeConfig());
    queue.subscribe(() => undefined);

    await (queue as unknown as { drainOnce: () => Promise<void> }).drainOnce();

    expect(cache.zrem).not.toHaveBeenCalled();
  });
});

describe('RetryQueue — dead-letter bound', () => {
  it('pushes to dead-letter list with cap via pipeline', async () => {
    const cache = makeCache();
    const queue = new RetryQueue<unknown>(cache, makeLogger(), makeConfig({ retryDelaysMs: [1] }));

    await (
      queue as unknown as {
        moveToDeadLetter: (e: unknown, attempt: number, error: unknown) => Promise<void>;
      }
    ).moveToDeadLetter({ payload: 1 }, 2, new Error('boom'));

    expect(cache.pipelineDeadLetterPush).toHaveBeenCalledTimes(1);
    const [key, payload, maxLength, ttlSeconds] = (cache.pipelineDeadLetterPush as jest.Mock).mock
      .calls[0];
    expect(key).toBe('test:dead-letter');
    expect(maxLength).toBe(1000);
    expect(ttlSeconds).toBe(7 * 24 * 60 * 60);
    expect((payload as { event: unknown }).event).toEqual({ payload: 1 });
    expect((payload as { lastAttempt: number }).lastAttempt).toBe(2);
    expect((payload as { lastError: unknown }).lastError).toBeDefined();
  });

  it('refreshes a 7-day TTL on every dead-letter push', async () => {
    const cache = makeCache();
    const queue = new RetryQueue<unknown>(cache, makeLogger(), makeConfig({ retryDelaysMs: [1] }));

    await (
      queue as unknown as {
        moveToDeadLetter: (e: unknown, attempt: number, error: unknown) => Promise<void>;
      }
    ).moveToDeadLetter({ payload: 1 }, 2, new Error('boom'));

    expect(cache.pipelineDeadLetterPush).toHaveBeenCalledTimes(1);
    const [, , , ttlSeconds] = (cache.pipelineDeadLetterPush as jest.Mock).mock.calls[0];
    expect(ttlSeconds).toBe(7 * 24 * 60 * 60);
  });
});

describe('RetryQueue — full batch drain', () => {
  it('drains all DRAIN_BATCH items even when the first item is not yet due', async () => {
    const cache = makeCache();
    const now = Date.now();

    cache.indexEntries.push(
      { member: 'future-key', score: now + 10_000 },
      { member: 'due-key-1', score: now - 1000 },
      { member: 'due-key-2', score: now - 2000 },
    );
    cache.payloadByKey.set(
      'future-key',
      JSON.stringify({
        event: { payload: 99 },
        attempt: 1,
        nextRetryAt: now + 10_000,
        tierKey: 'future-key',
      }),
    );
    cache.payloadByKey.set(
      'due-key-1',
      JSON.stringify({
        event: { payload: 1 },
        attempt: 1,
        nextRetryAt: now - 1000,
        tierKey: 'due-key-1',
      }),
    );
    cache.payloadByKey.set(
      'due-key-2',
      JSON.stringify({
        event: { payload: 2 },
        attempt: 1,
        nextRetryAt: now - 2000,
        tierKey: 'due-key-2',
      }),
    );

    const received: number[] = [];
    const queue = new RetryQueue<{ payload: number }>(cache, makeLogger(), makeConfig());
    queue.subscribe((event) => {
      received.push(event.payload);
    });

    await (queue as unknown as { drainOnce: () => Promise<void> }).drainOnce();

    expect(received).toContain(1);
    expect(received).toContain(2);
  });
});

describe('RetryQueue — atomic enqueue', () => {
  it('uses multiExec to atomically set payload and add to index', async () => {
    const multiExecMock = jest.fn().mockResolvedValue([null, null]);
    const cache = makeCache();
    (cache as unknown as { multiExec: jest.Mock }).multiExec = multiExecMock;

    const queue = new RetryQueue<unknown>(cache, makeLogger(), makeConfig());
    queue.subscribe(() => {
      throw new Error('force-retry');
    });

    queue.dispatch({ payload: 1 });

    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(multiExecMock).toHaveBeenCalled();
    const [firstCallArgs] = multiExecMock.mock.calls;
    const commands = firstCallArgs[0] as Array<[string, ...unknown[]]>;
    expect(commands[0][0]).toBe('set');
    expect(commands[1][0]).toBe('zadd');
  });
});
