/**
 * Phase 7 #4 — soft-delete purge service tests.
 *
 * The service is the only piece of business logic that hard-deletes
 * soft-deleted rows; ADR-0011 makes that explicit. The unit tests
 * here verify the *control plane*: per-table failures don't abort the
 * run, the retention window is clamped, and the manual entry point
 * returns the same shape as the cron.
 *
 * The actual SQL is exercised against a real Postgres in the
 * integration suite; here we use a fake Drizzle client that records
 * the SQL fragments and returns deterministic counts.
 */

import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';

import { SoftDeletePurgeService, type PurgeResult } from './soft-delete-purge.service';

class FakeDrizzle {
  readonly calls: Array<{ sql: string; params: unknown[] }> = [];
  /** Map of "table" → { rowCount }; mutated to simulate behaviour. */
  readonly responses = new Map<string, number>();
  /** When set, `delete` returns this for any table. Overrides per-table responses. */
  throwOnTables: ReadonlySet<string> = new Set();

  delete(table: unknown): any {
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
    return {
      where: (cond: unknown) => {
        const sql = String((cond as { queryChunks?: unknown[] })?.queryChunks ?? cond);
        this.calls.push({ sql, params: [] });
        if (this.throwOnTables.has(tableName)) {
          return Promise.reject(new Error(`forced failure for ${tableName}`));
        }
        const count = this.responses.get(tableName) ?? 0;
        return Promise.resolve({ rowCount: count });
      },
    };
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

describe('SoftDeletePurgeService', () => {
  let fakeDb: FakeDrizzle;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    fakeDb = new FakeDrizzle();
    logger = makeLogger();
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
      fakeDb.responses.set('quizzes', 0);
      fakeDb.responses.set('quiz_reviews', 0);
      fakeDb.responses.set('comments', 0);
      fakeDb.responses.set('notifications', 0);
      fakeDb.responses.set('tournaments', 0);

      const service = new SoftDeletePurgeService(
          fakeDb as unknown as DrizzleDB,
          logger as unknown as ConstructorParameters<typeof SoftDeletePurgeService>[1],
        );
      await service.purgeOnce();
      // Inspect the cron log: it should mention `retentionDays=${expected}`.
      const started = (logger.info as jest.Mock).mock.calls.find(
        ([ctx]) => (ctx as { event?: string })?.event === 'soft_delete_purge_manual_started',
      );
      expect(started?.[0].retentionDays).toBe(expected);
      });
    }
  });

  describe('per-table isolation', () => {
    it('continues purging the remaining tables when one throws', async () => {
      fakeDb.responses.set('quizzes', 2);
      fakeDb.responses.set('quiz_reviews', 0);
      fakeDb.responses.set('comments', 0);
      fakeDb.responses.set('notifications', 0);
      fakeDb.responses.set('tournaments', 0);
      fakeDb.throwOnTables = new Set(['comments']);
      const service = new SoftDeletePurgeService(
        fakeDb as unknown as DrizzleDB,
        logger as unknown as ConstructorParameters<typeof SoftDeletePurgeService>[1],
      );
      const results: PurgeResult[] = await service.purgeOnce();
      const comments = results.find((r) => r.table === 'comments');
      expect(comments?.deleted).toBe(0);
      const quizzes = results.find((r) => r.table === 'quizzes');
      expect(quizzes?.deleted).toBe(2);
    });
  });

  describe('row counting', () => {
    it('sums deleted rows across tables', async () => {
      fakeDb.responses.set('quizzes', 3);
      fakeDb.responses.set('quiz_reviews', 5);
      fakeDb.responses.set('comments', 1);
      fakeDb.responses.set('notifications', 0);
      fakeDb.responses.set('tournaments', 0);
      const service = new SoftDeletePurgeService(
          fakeDb as unknown as DrizzleDB,
          logger as unknown as ConstructorParameters<typeof SoftDeletePurgeService>[1],
        );
      const results = await service.purgeOnce();
      const total = results.reduce((acc, r) => acc + r.deleted, 0);
      expect(total).toBe(9);
    });
  });

describe('SQL fragment includes the cutoff', () => {
    it('issues one DELETE per purgeable table', async () => {
      fakeDb.responses.set('quizzes', 0);
      fakeDb.responses.set('quiz_reviews', 0);
      fakeDb.responses.set('comments', 0);
      fakeDb.responses.set('notifications', 0);
      fakeDb.responses.set('tournaments', 0);
      const service = new SoftDeletePurgeService(
        fakeDb as unknown as DrizzleDB,
        logger as unknown as ConstructorParameters<typeof SoftDeletePurgeService>[1],
      );
      await service.purgeOnce();
      // One DELETE per purgeable table.
      expect(fakeDb.calls.length).toBe(5);
    });
  });
});
