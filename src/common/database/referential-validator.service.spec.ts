/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { ReferentialValidatorService } from './referential-validator.service';
import type { DrizzleDB } from '@/core/database/database.module';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { ReferencedEntityNotFoundError } from './references.types';

function makeSelectChain(rows: unknown[]) {
  const chain: any = {};
  for (const m of ['from', 'where', 'limit']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  // Terminal await resolves to rows
  chain.then = (resolve: (r: unknown[]) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeDb(rowsForLastSelect: unknown[]): { db: DrizzleDB; selectMock: jest.Mock } {
  const selectMock = jest.fn().mockReturnValue(makeSelectChain(rowsForLastSelect));
  const db = { select: selectMock } as unknown as DrizzleDB;
  return { db, selectMock };
}

function makeCache(values: Record<string, string | null> = {}): {
  cache: CacheProvider;
  store: Map<string, string | null>;
  setCalls: Array<[string, string, number]>;
  delCalls: string[];
} {
  const store = new Map<string, string | null>(Object.entries(values));
  const setCalls: Array<[string, string, number]> = [];
  const delCalls: string[] = [];
  const cache: CacheProvider = {
    get: jest.fn((key: string): Promise<string | null> => {
      return Promise.resolve(store.has(key) ? store.get(key)! : null);
    }),
    set: jest.fn((key: string, value: string, ttlMs: number): Promise<void> => {
      setCalls.push([key, value, ttlMs]);
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string): Promise<boolean> => {
      delCalls.push(key);
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed);
    }),
    incrementWindowCounter: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    getOrSet: jest.fn(),
    getOrSetWithStampedeProtection: jest.fn(),
    getDel: jest.fn(),
    rpushJson: jest.fn(),
    lpopJson: jest.fn(),
    lrangeJson: jest.fn(),
    acquireAdvisoryLock: jest.fn(),
    releaseAdvisoryLock: jest.fn(),
  };
  return { cache, store, setCalls, delCalls };
}

describe('ReferentialValidatorService', () => {
  it('returns true on cache hit without hitting the DB', async () => {
    const { cache } = makeCache({ 'ref:v1:attempt:a1': '1' });
    const { db, selectMock } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'a1' })).resolves.toBe(true);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('returns false on negative cache hit without hitting the DB', async () => {
    const { cache } = makeCache({ 'ref:v1:attempt:a1': '0' });
    const { db, selectMock } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'a1' })).resolves.toBe(false);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('checks the DB on a cache miss and caches the positive verdict with a long TTL', async () => {
    const { cache, setCalls } = makeCache();
    const { db, selectMock } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'a1' })).resolves.toBe(true);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]?.[0]).toBe('ref:v1:attempt:a1');
    expect(setCalls[0]?.[1]).toBe('1');
    expect((setCalls[0]?.[2] ?? 0) > 1000).toBe(true);
  });

  it('caches the negative verdict with a short TTL', async () => {
    const { cache, setCalls } = makeCache();
    const { db } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'missing' })).resolves.toBe(false);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]?.[1]).toBe('0');
    expect((setCalls[0]?.[2] ?? 0) < 10_000).toBe(true);
  });

  it('falls through to the DB when the cache throws on get', async () => {
    const { cache } = makeCache();
    const baseGet = cache.get as unknown as jest.Mock;
    baseGet.mockRejectedValueOnce(new Error('redis-down'));
    const { db, selectMock } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'a1' })).resolves.toBe(true);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it('falls through to the DB when the cache throws on set', async () => {
    const { cache } = makeCache();
    const baseSet = cache.set as unknown as jest.Mock;
    baseSet.mockRejectedValueOnce(new Error('redis-down'));
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'attempt', id: 'a1' })).resolves.toBe(true);
  });

  it('assertExists throws ReferencedEntityNotFoundError when missing', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.assertExists({ kind: 'attempt', id: 'missing' })).rejects.toBeInstanceOf(
      ReferencedEntityNotFoundError,
    );
  });

  it('validates streak references as positive integers (no DB call)', async () => {
    const { cache } = makeCache();
    const { db, selectMock } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'streak', id: '7' })).resolves.toBe(true);
    await expect(svc.exists({ kind: 'streak', id: '0' })).resolves.toBe(false);
    await expect(svc.exists({ kind: 'streak', id: '-1' })).resolves.toBe(false);
    await expect(svc.exists({ kind: 'streak', id: 'abc' })).resolves.toBe(false);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('validates tip/admin references against the users table', async () => {
    const { cache } = makeCache();
    const { db, selectMock } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'tip', id: 'u1' })).resolves.toBe(true);
    await expect(svc.exists({ kind: 'admin', id: 'u1' })).resolves.toBe(true);
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it('validates flair references against userBadges', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'flair', id: 'ub1' })).resolves.toBe(true);
  });

  it('validates suppress references against quizzes', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'suppress', id: 'q1' })).resolves.toBe(true);
  });

  it('validates tournament references against the tournaments table', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'tournament', id: 't1' })).resolves.toBe(true);
  });

  it('validates daily_challenge references against dailyChallengeAttempt', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'daily_challenge', id: 'dc1' })).resolves.toBe(true);
  });

  it('validates badge references against userBadges', async () => {
    const { cache } = makeCache();
    const { db } = makeDb([{}]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.exists({ kind: 'badge', id: 'b1' })).resolves.toBe(true);
  });

  it('invalidate removes the cached verdict', async () => {
    const { cache, delCalls } = makeCache({ 'ref:v1:attempt:a1': '1' });
    const { db } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await svc.invalidate({ kind: 'attempt', id: 'a1' });
    expect(delCalls).toEqual(['ref:v1:attempt:a1']);
  });

  it('invalidate swallows cache errors', async () => {
    const { cache } = makeCache();
    const baseDel = cache.del as unknown as jest.Mock;
    baseDel.mockRejectedValueOnce(new Error('redis-down'));
    const { db } = makeDb([]);
    const svc = new ReferentialValidatorService(db, cache);

    await expect(svc.invalidate({ kind: 'attempt', id: 'a1' })).resolves.toBeUndefined();
  });
});
