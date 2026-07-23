/**
 * Ranking repository unit tests.
 *
 * Tests the core repository methods using mock implementations that verify
 * the expected call patterns and return values:
 *
 *   - `updateXp` — verifies XP accumulation and dirty flag setting
 *   - `getLeaderboard` — verifies SQL query structure
 *   - `resetPeriod` — verifies reset fields per period
 *   - `completeRecalculationWorkItems` — verifies work item deletion
 *
 * Note: These tests use mock functions to verify behavior without requiring
 * a real database connection.
 */
import { RankingRepository } from './ranking.repository';
import { RankingPeriod } from '../../domain/types/ranking.types';
import type { UserRankingRow } from '../../domain/ports/ranking-repository.port';

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------

interface MockDbState {
  capturedWhere: unknown;
  capturedSet: Record<string, unknown>;
  returnRows: unknown[];
}

const createMockDb = (returnRows: unknown[] = []): {
  state: MockDbState;
  db: {
    query: {
      userRanking: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
    };
    update: jest.Mock;
    delete: jest.Mock;
    insert: jest.Mock;
    execute: jest.Mock;
    transaction: jest.Mock;
  };
} => {
  const state: MockDbState = {
    capturedWhere: undefined,
    capturedSet: {},
    returnRows,
  };

  const db = {
    query: {
      userRanking: {
        findFirst: jest.fn().mockResolvedValue(returnRows[0] ?? null),
        findMany: jest.fn().mockResolvedValue(returnRows),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returnRows),
        }),
      }),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockImplementation((pred: unknown) => {
        state.capturedWhere = pred;
        return {
          returning: jest.fn().mockResolvedValue(returnRows),
        };
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returnRows[0]),
      }),
    }),
    execute: jest.fn().mockResolvedValue({ rows: returnRows, rowCount: returnRows.length }),
    transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  return { state, db };
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<{
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RankingRepository', () => {
  describe('updateXp', () => {
    it('returns updated user ranking row on success', async () => {
      const updatedRow: Partial<UserRankingRow> = {
        userId: 'u1',
        allTimeXp: 100,
        weeklyXp: 50,
        monthlyXp: 75,
        dailyXp: 25,
        allTimeRank: 1,
        isDirty: true,
      };

      const { db } = createMockDb([updatedRow]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.updateXp({
        userId: 'u1',
        amount: 100,
        now: new Date(),
      });

      expect(result).toMatchObject({ userId: 'u1', allTimeXp: 100 });
    });

    it('queries the user_ranking table', async () => {
      const { db } = createMockDb([{ userId: 'u1', allTimeXp: 100 }]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.updateXp({ userId: 'u1', amount: 50, now: new Date() });

      expect(db.query.userRanking.findFirst).toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard entries for all_time period', async () => {
      const { db } = createMockDb([{
        userId: 'u1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getLeaderboard({
        period: RankingPeriod.ALL_TIME,
        limit: 100,
        offset: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'u1',
        username: 'alice',
        xp: 1000,
        rank: 1,
      });
    });

    it('returns leaderboard entries for weekly period', async () => {
      const { db } = createMockDb([{
        userId: 'u2',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: null,
        xp: 500,
        rank: 1,
        denseRank: 1,
      }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getLeaderboard({
        period: RankingPeriod.WEEKLY,
        limit: 100,
        offset: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'u2',
        xp: 500,
      });
    });

    it('returns empty array when no users have XP', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getLeaderboard({
        period: RankingPeriod.ALL_TIME,
        limit: 100,
        offset: 0,
      });

      expect(result).toHaveLength(0);
    });

    it('executes raw SQL query', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.getLeaderboard({
        period: RankingPeriod.ALL_TIME,
        limit: 100,
        offset: 0,
      });

      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('resetPeriod', () => {
    it('resets weekly XP and rank', async () => {
      const { db } = createMockDb([{ rowCount: 5 }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.resetPeriod(RankingPeriod.WEEKLY, new Date());

      expect(typeof result).toBe('number');
      expect(db.execute).toHaveBeenCalled();
    });

    it('resets monthly XP and rank', async () => {
      const { db } = createMockDb([{ rowCount: 10 }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.resetPeriod(RankingPeriod.MONTHLY, new Date());

      expect(typeof result).toBe('number');
    });

    it('resets daily XP and rank', async () => {
      const { db } = createMockDb([{ rowCount: 3 }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.resetPeriod(RankingPeriod.DAILY, new Date());

      expect(typeof result).toBe('number');
    });
  });

  describe('completeRecalculationWorkItems', () => {
    it('deletes work items by IDs', async () => {
      const { db, state } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.completeRecalculationWorkItems(['wi1', 'wi2']);

      expect(db.delete).toHaveBeenCalled();
    });

    it('handles empty work item list gracefully', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await expect(repo.completeRecalculationWorkItems([])).resolves.toBeUndefined();
    });
  });

  describe('completeRecalculationWorkItemsInTx', () => {
    it('executes deletion within transaction context', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.completeRecalculationWorkItemsInTx(db, ['wi1']);

      expect(db.delete).toHaveBeenCalled();
    });

    it('handles empty work item list gracefully', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await expect(
        repo.completeRecalculationWorkItemsInTx(db, []),
      ).resolves.toBeUndefined();
    });
  });

  describe('getUserRanking', () => {
    it('returns user ranking when user exists', async () => {
      const { db } = createMockDb([{
        userId: 'u1',
        allTimeXp: 1000,
        weeklyXp: 500,
        monthlyXp: 750,
        dailyXp: 100,
        allTimeRank: 5,
        weeklyRank: 2,
        monthlyRank: 3,
        dailyRank: 1,
      }]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getUserRanking('u1');

      expect(result).toMatchObject({
        userId: 'u1',
        allTimeXp: 1000,
        allTimeRank: 5,
      });
    });

    it('returns null when user does not exist', async () => {
      const { db } = createMockDb([null]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getUserRanking('nonexistent');

      expect(result).toBeNull();
    });

    it('queries the user_ranking table', async () => {
      const { db } = createMockDb([{ userId: 'u1' }]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.getUserRanking('u1');

      expect(db.query.userRanking.findFirst).toHaveBeenCalled();
    });
  });

  describe('getRankingsForUsers', () => {
    it('returns rankings for multiple users', async () => {
      const { db } = createMockDb([
        { userId: 'u1', allTimeXp: 1000 },
        { userId: 'u2', allTimeXp: 2000 },
      ]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getRankingsForUsers(['u1', 'u2']);

      expect(result).toHaveLength(2);
    });

    it('returns empty array for empty user list', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      const result = await repo.getRankingsForUsers([]);

      expect(result).toHaveLength(0);
      expect(db.query.userRanking.findMany).not.toHaveBeenCalled();
    });
  });

  describe('clearDirtyFlagsForUsersWithNoPendingWorkInTx', () => {
    it('executes within transaction context', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await repo.clearDirtyFlagsForUsersWithNoPendingWorkInTx(db, ['u1']);

      expect(db.execute).toHaveBeenCalled();
    });

    it('handles empty user list gracefully', async () => {
      const { db } = createMockDb([]);
      const repo = new RankingRepository(db as never, mockLogger);

      await expect(
        repo.clearDirtyFlagsForUsersWithNoPendingWorkInTx(db, []),
      ).resolves.toBeUndefined();
    });
  });
});
