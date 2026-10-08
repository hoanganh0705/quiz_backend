import type { DrizzleDB } from '@/core/database/database.module';

import { SoftDeletePurgeService, type PurgeResult } from './soft-delete-purge.service';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';

class FakeDrizzle {
  readonly calls: Array<{ sql: string; params: unknown[] }> = [];
  readonly executeResponses = new Map<string, Array<{ id: string }>>();
  throwOnTables: ReadonlySet<string> = new Set();
  executeCallCount = 0;
  deleteCallCount = 0;

  delete(table: unknown): {
    where: (cond: unknown) => {
      then: (onFulfilled: (v: { rowCount: number }) => unknown) => Promise<unknown>;
    };
  } {
    const ref = table as { name?: string } & Record<string, unknown>;
    const symbolKey = Object.getOwnPropertySymbols(table ?? {}).find(
      (s) => s.description === 'drizzle:Name',
    );
    const tableName =
      typeof ref?.name === 'string'
        ? ref.name
        : symbolKey
          ? String((table as Record<symbol, string>)[symbolKey])
          : 'unknown';
    const executeDelete = (): Promise<{ rowCount: number }> => {
      this.deleteCallCount += 1;
      this.calls.push({ sql: `DELETE FROM ${tableName}`, params: [] });
      if (this.throwOnTables.has(tableName)) {
        return Promise.reject(new Error(`forced failure for ${tableName}`));
      }
      const configured = this.executeResponses.get(tableName);
      const rowCount = Array.isArray(configured) ? configured.length : 1;
      return Promise.resolve({ rowCount });
    };
    return {
      where: () => ({
        then: (onFulfilled: (v: { rowCount: number }) => unknown) =>
          executeDelete().then(onFulfilled),
      }),
    };
  }

  execute(sql: unknown): Promise<{ rows: Array<{ id: string }> }> {
    this.executeCallCount += 1;
    const sqlText = String(sql);
    this.calls.push({ sql: sqlText, params: [] });

    const lower = sqlText.toLowerCase();
    for (const table of this.throwOnTables) {
      if (lower.includes(`from ${table}`)) {
        return Promise.reject(new Error(`forced failure for ${table}`));
      }
    }

    for (const [table, rows] of this.executeResponses.entries()) {
      if (lower.includes(`from ${table}`)) {
        return Promise.resolve({ rows: rows.slice() });
      }
    }

    if (this.executeResponses.size > 0) {
      const firstEntry = this.executeResponses.entries().next().value;
      if (firstEntry) {
        return Promise.resolve({ rows: firstEntry[1].slice() });
      }
    }
    return Promise.resolve({ rows: [] });
  }
}

function makeLogger() {
  const log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
  return log;
}

function makeCache(opts: { acquired?: boolean } = { acquired: true }) {
  return {
    acquireAdvisoryLock: jest.fn().mockResolvedValue(opts.acquired ? 'token-1' : null),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
    renewAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;
}

function makeCircuit() {
  return {
    getCircuitState: jest.fn().mockReturnValue('closed'),
  } as unknown as RedisCircuitPort;
}

describe('SoftDeletePurgeService', () => {
  let fakeDb: FakeDrizzle;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    fakeDb = new FakeDrizzle();
    logger = makeLogger();
  });

  function newService(opts: { acquired?: boolean } = { acquired: true }): SoftDeletePurgeService {
    return new SoftDeletePurgeService(
      fakeDb as unknown as DrizzleDB,
      makeCache(opts),
      makeCircuit(),
      undefined,
      logger as unknown as ConstructorParameters<typeof SoftDeletePurgeService>[4],
    );
  }

  describe('parallel table purging', () => {
    it('purges all 5 tables concurrently', async () => {
      fakeDb.executeResponses.set('quizzes', [{ id: 'q-1' }]);
      fakeDb.executeResponses.set('quiz_reviews', [{ id: 'r-1' }, { id: 'r-2' }]);
      fakeDb.executeResponses.set('comments', [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }]);
      fakeDb.executeResponses.set('notifications', [
        { id: 'n-1' },
        { id: 'n-2' },
        { id: 'n-3' },
        { id: 'n-4' },
      ]);
      fakeDb.executeResponses.set('tournaments', [
        { id: 't-1' },
        { id: 't-2' },
        { id: 't-3' },
        { id: 't-4' },
        { id: 't-5' },
      ]);
      fakeDb.throwOnTables = new Set();

      const start = Date.now();
      const results = await newService().purgeOnce();
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(5);
      expect(results.reduce((acc, r) => acc + r.deleted, 0)).toBe(15);
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('retention day clamping', () => {
    const baseRetentionDaysTests = [
      { value: undefined, expected: 30 },
      { value: '15', expected: 15 },
      { value: 'abc', expected: 30 },
      { value: '0', expected: 30 },
      { value: '500', expected: 365 },
    ];

    for (const { value, expected } of baseRetentionDaysTests) {
      it(`clamps SOFT_DELETE_RETENTION_DAYS='${value ?? '(unset)'}' to ${expected}`, async () => {
        process.env.SOFT_DELETE_RETENTION_DAYS = value;
        fakeDb.executeResponses.set('quizzes', []);
        fakeDb.executeResponses.set('quiz_reviews', []);
        fakeDb.executeResponses.set('comments', []);
        fakeDb.executeResponses.set('notifications', []);
        fakeDb.executeResponses.set('tournaments', []);

        await newService().purgeOnce();
        const started = logger.info.mock.calls.find(
          ([ctx]) => (ctx as { event?: string })?.event === 'soft_delete_purge_manual_started',
        );
        expect(started?.[0].retentionDays).toBe(expected);
      });
    }
  });

  describe('per-table isolation', () => {
    it('continues purging the remaining tables when one throws', async () => {
      fakeDb.executeResponses.set('quizzes', [{ id: 'q-1' }, { id: 'q-2' }]);
      fakeDb.executeResponses.set('quiz_reviews', []);
      fakeDb.executeResponses.set('comments', []);
      fakeDb.executeResponses.set('notifications', []);
      fakeDb.executeResponses.set('tournaments', []);
      fakeDb.throwOnTables = new Set(['comments']);
      const service = newService();
      const results: PurgeResult[] = await service.purgeOnce();
      const comments = results.find((r) => r.table === 'comments');
      expect(comments?.deleted).toBe(0);
      const quizzes = results.find((r) => r.table === 'quizzes');
      expect(quizzes?.deleted).toBe(2);
    });
  });

  describe('row counting', () => {
    it('sums deleted rows across tables', async () => {
      fakeDb.executeResponses.set('quizzes', [{ id: 'q-1' }, { id: 'q-2' }, { id: 'q-3' }]);
      fakeDb.executeResponses.set('quiz_reviews', [
        { id: 'r-1' },
        { id: 'r-2' },
        { id: 'r-3' },
        { id: 'r-4' },
        { id: 'r-5' },
      ]);
      fakeDb.executeResponses.set('comments', [{ id: 'c-1' }]);
      fakeDb.executeResponses.set('notifications', []);
      fakeDb.executeResponses.set('tournaments', []);
      const results = await newService().purgeOnce();
      const total = results.reduce((acc, r) => acc + r.deleted, 0);
      expect(total).toBe(9);
    });
  });

  describe('SQL fragment includes the cutoff', () => {
    it('issues one SELECT+DELETE per purgeable table', async () => {
      fakeDb.executeResponses.set('quizzes', [{ id: 'q-1' }]);
      fakeDb.executeResponses.set('quiz_reviews', [{ id: 'r-1' }]);
      fakeDb.executeResponses.set('comments', [{ id: 'c-1' }]);
      fakeDb.executeResponses.set('notifications', [{ id: 'n-1' }]);
      fakeDb.executeResponses.set('tournaments', [{ id: 't-1' }]);
      await newService().purgeOnce();
      expect(fakeDb.executeCallCount).toBe(5);
      const deleteCalls = fakeDb.calls.filter((c) => c.sql.startsWith('DELETE FROM '));
      expect(deleteCalls.length).toBe(5);
    });
  });

  describe('distributed locking', () => {
    it('runs the cron path and releases the lock when acquired', async () => {
      fakeDb.executeResponses.set('quizzes', [{ id: 'q-1' }]);
      fakeDb.executeResponses.set('quiz_reviews', [{ id: 'r-1' }]);
      fakeDb.executeResponses.set('comments', [{ id: 'c-1' }]);
      fakeDb.executeResponses.set('notifications', [{ id: 'n-1' }]);
      fakeDb.executeResponses.set('tournaments', [{ id: 't-1' }]);

      const cache = makeCache({ acquired: true });
      const service = new SoftDeletePurgeService(
        fakeDb as unknown as DrizzleDB,
        cache,
        makeCircuit(),
        undefined,
        logger as never,
      );
      await service.nightlyPurge();
      const deleteCalls = fakeDb.calls.filter((c) => c.sql.startsWith('DELETE FROM '));
      expect(deleteCalls.length).toBe(5);
    });

    it('skips the cron path when another replica holds the lock', async () => {
      fakeDb.executeResponses.set('quizzes', []);
      fakeDb.executeResponses.set('quiz_reviews', []);
      fakeDb.executeResponses.set('comments', []);
      fakeDb.executeResponses.set('notifications', []);
      fakeDb.executeResponses.set('tournaments', []);

      const cache = makeCache({ acquired: false });
      const service = new SoftDeletePurgeService(
        fakeDb as unknown as DrizzleDB,
        cache,
        makeCircuit(),
        undefined,
        logger as never,
      );
      await service.nightlyPurge();
      expect(fakeDb.calls.length).toBe(0);
    });
  });
});
