import { RankingPeriod, RankingMilestone } from '../../../domain/types/ranking.types';

type DrizzleLike = { execute: jest.Mock; query?: object };

type CapturedStmt = { text: string };

function makeMockDb() {
  const statements: CapturedStmt[] = [];

  const db = {
    execute: jest.fn(async (_stmt: unknown) => {
      return { rowCount: 1, rows: [] };
    }),
    query: {},
  };

  const origExecute = db.execute.getMockImplementation()!;

  db.execute = jest.fn(async (stmt: unknown) => {
    let text: string;
    const rawify = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return v.toString();
      if (typeof v === 'boolean') return v.toString();
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) return v.map(rawify).join('');
      if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (o.raw !== undefined) return JSON.stringify(o.raw);
        if (Array.isArray(o.queryChunks)) return o.queryChunks.map(rawify).join('');
        if (o.query !== undefined) return rawify(o.query);
        if (o.value !== undefined) {
          if (Array.isArray(o.value)) return o.value.map(rawify).join('');
          return rawify(o.value);
        }
      }
      return '';
    };
    try {
      text = rawify(stmt);
    } catch {
      text = '[raw statement]';
    }
    statements.push({ text });
    return origExecute(stmt);
  });

  return { db: db as unknown as DrizzleLike, statements };
}

function makeMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
}

import { UserRankingRepository } from './user-ranking.repository';

function makeRepo(db: DrizzleLike) {
  return new UserRankingRepository(db as never, makeMockLogger() as never, undefined);
}

describe('UserRankingRepository — batch methods', () => {
  describe('batchUpdateRanks', () => {
    it('emits a single UPDATE statement with VALUES for all rows', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.batchUpdateRanks({
        updates: [
          { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1 },
          { userId: 'u2', period: RankingPeriod.ALL_TIME, rank: 2 },
        ],
        now: new Date('2026-01-01'),
      });

      expect(statements).toHaveLength(1);
      expect(statements[0].text).toContain('UPDATE');
      expect(statements[0].text).toContain('all_time_rank');
    });

    it('skips execution when updates array is empty', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.batchUpdateRanks({
        updates: [],
        now: new Date(),
      });

      expect(statements).toHaveLength(0);
    });

    it('uses the correct rank column for each period', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.batchUpdateRanks({
        updates: [{ userId: 'u1', period: RankingPeriod.DAILY, rank: 5 }],
        now: new Date(),
      });

      expect(statements[0].text).toContain('daily_rank');
    });
  });

  describe('updateRank', () => {
    it('uses UPDATE … RETURNING without a separate SELECT', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.updateRank({
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
        rank: 10,
      });

      expect(statements).toHaveLength(1);
      expect(statements[0].text).toContain('UPDATE');
      expect(statements[0].text).toContain('RETURNING');
    });
  });

  describe('persistMilestones', () => {
    it('emits a single INSERT statement', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.persistMilestones({
        triples: [
          {
            userId: 'u1',
            milestone: RankingMilestone.TOP_1,
            rank: 1,
            achievedAt: new Date('2026-01-01'),
          },
          {
            userId: 'u2',
            milestone: RankingMilestone.TOP_3,
            rank: 3,
            achievedAt: new Date('2026-01-01'),
          },
        ],
      });

      expect(statements).toHaveLength(1);
      expect(statements[0].text).toContain('INSERT INTO');
      expect(statements[0].text).toContain('ranking_milestones');
    });

    it('skips execution when triples array is empty', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.persistMilestones({ triples: [] });

      expect(statements).toHaveLength(0);
    });
  });

  describe('processXpEventsBatch', () => {
    it('emits a single UPDATE statement with UNNEST arrays', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.processXpEventsBatch({
        events: [
          { userId: 'u1', amount: 50, now: new Date('2026-01-01') },
          { userId: 'u2', amount: 30, now: new Date('2026-01-01') },
        ],
      });

      expect(statements).toHaveLength(1);
      expect(statements[0].text).toContain('UPDATE');
      expect(statements[0].text).toContain('unnest');
    });

    it('skips execution when events array is empty', async () => {
      const { db, statements } = makeMockDb();
      const repo = makeRepo(db);

      await repo.processXpEventsBatch({ events: [] });

      expect(statements).toHaveLength(0);
    });
  });

  describe('batchUpdatePeakRanks', () => {
    it('returns an empty array when updates are empty', async () => {
      const { db } = makeMockDb();
      const repo = makeRepo(db);

      const result = await repo.batchUpdatePeakRanks({
        updates: [],
        now: new Date(),
      });

      expect(result).toEqual([]);
    });
  });
});
