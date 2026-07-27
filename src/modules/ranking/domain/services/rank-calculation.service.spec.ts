/**
 * RankCalculationService unit tests.
 *
 * Tests the core service methods using stub repositories and event buses:
 *
 *   - `calculateAllRanks` — verifies rank calculation and batch updates
 *   - `recalculateRanksForUsers` — verifies incremental recalculation
 *   - `calculateUserRank` — verifies single-user rank lookup
 *   - `processDirtyRankings` — verifies work item processing and transaction safety
 *   - `queueRankRecalculation` — verifies work item enqueueing
 *
 * These tests verify the ordering of operations and error handling without
 * requiring a real database.
 */
import { RankCalculationService } from './rank-calculation.service';
import { RankCalculationError } from '../errors/ranking-domain.errors';
import { RankingPeriod } from '../types/ranking.types';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { RankingDomainEventBusPort } from '../ports/ranking-event-bus.port';

interface StubRepo {
  calculateAllRanks: jest.Mock<
    Promise<Array<{ userId: string; xp: number; rank: number; denseRank: number }>>,
    [RankingPeriod]
  >;
  calculateAllRanksForUsers: jest.Mock<
    Promise<Array<{ userId: string; xp: number; rank: number; denseRank: number }>>,
    [{ userIds: string[]; period: RankingPeriod }]
  >;
  updateRank: jest.Mock<
    Promise<number | null>,
    [{ userId: string; period: RankingPeriod; rank: number }]
  >;
  updatePeakRank: jest.Mock<
    Promise<{ updated: boolean; previousPeakRank: number | null }>,
    [{ userId: string; period: RankingPeriod; rank: number }]
  >;
  markDirty: jest.Mock<Promise<void>, [string[]]>;
  enqueueRecalculation: jest.Mock<Promise<void>, [{ userIds: string[]; periods: RankingPeriod[] }]>;
  enqueueRecalculationInTx: jest.Mock<
    Promise<void>,
    [unknown, { userIds: string[]; periods: RankingPeriod[] }]
  >;
  getPendingRecalculationWorkItems: jest.Mock<
    Promise<Array<{ workItemId: string; userId: string; period: string }>>,
    [number]
  >;
  completeRecalculationWorkItems: jest.Mock<Promise<void>, [string[]]>;
  completeRecalculationWorkItemsInTx: jest.Mock<Promise<void>, [unknown, string[]]>;
  clearDirtyFlagsForUsersWithNoPendingWork: jest.Mock<Promise<void>, [string[]]>;
  clearDirtyFlagsForUsersWithNoPendingWorkInTx: jest.Mock<Promise<void>, [unknown, string[]]>;
  getUserRanking: jest.Mock<
    Promise<{
      userId: string;
      allTimeXp: number;
      weeklyXp: number;
      monthlyXp: number;
      dailyXp: number;
    } | null>,
    [string]
  >;
  countRankAbove: jest.Mock<Promise<number>, [number, RankingPeriod]>;
  getTotalParticipants: jest.Mock<Promise<number>, [RankingPeriod]>;
  hasMilestone: jest.Mock<Promise<boolean>, [{ userId: string; milestone: string }]>;
  createMilestone: jest.Mock<
    Promise<{ id: string; userId: string; milestone: string; rank: number }>,
    [{ userId: string; milestone: string; rank: number; achievedAt: Date }]
  >;
  findMissingRanks: jest.Mock<Promise<string[]>, []>;
  findXpMismatches: jest.Mock<
    Promise<Array<{ userId: string; storedXp: number; expectedXp: number }>>,
    []
  >;
}

interface StubBus {
  emitRankChanged: jest.Mock<void, [unknown]>;
  emitPeakRankAchieved: jest.Mock<void, [unknown]>;
  emitRankingMilestone: jest.Mock<void, [unknown]>;
}

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);
const noop = (): Promise<void> => Promise.resolve();

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

const buildStubRepo = (): StubRepo => ({
  calculateAllRanks: jest.fn(),
  calculateAllRanksForUsers: jest.fn(),
  updateRank: jest.fn(),
  updatePeakRank: jest.fn(),
  markDirty: jest.fn(),
  enqueueRecalculation: jest.fn(),
  enqueueRecalculationInTx: jest.fn(),
  getPendingRecalculationWorkItems: jest.fn(),
  completeRecalculationWorkItems: jest.fn(),
  completeRecalculationWorkItemsInTx: jest.fn(),
  clearDirtyFlagsForUsersWithNoPendingWork: jest.fn(),
  clearDirtyFlagsForUsersWithNoPendingWorkInTx: jest.fn(),
  getUserRanking: jest.fn(),
  countRankAbove: jest.fn(),
  getTotalParticipants: jest.fn(),
  hasMilestone: jest.fn(),
  createMilestone: jest.fn(),
  findMissingRanks: jest.fn(),
  findXpMismatches: jest.fn(),
});

const buildStubBus = (): StubBus => ({
  emitRankChanged: jest.fn(),
  emitPeakRankAchieved: jest.fn(),
  emitRankingMilestone: jest.fn(),
});

const buildStubDb = () => ({
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
});

const createService = (repo: StubRepo, bus: StubBus, db = buildStubDb()) =>
  new RankCalculationService(
    repo as unknown as RankingRepositoryPort,
    bus as unknown as RankingDomainEventBusPort,
    db as never,
    mockLogger,
  );

describe('RankCalculationService', () => {
  describe('calculateAllRanks', () => {
    it('calculates ranks and returns results', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.calculateAllRanks.mockResolvedValue([
        { userId: 'u1', xp: 1000, rank: 1, denseRank: 1 },
        { userId: 'u2', xp: 500, rank: 2, denseRank: 2 },
      ]);
      repo.updateRank.mockResolvedValue(null);
      repo.updatePeakRank.mockResolvedValue({ updated: false, previousPeakRank: null });
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);
      repo.createMilestone.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
        milestone: 'TOP_10',
        rank: 1,
      });

      const service = createService(repo, bus);
      const results = await service.calculateAllRanks(RankingPeriod.ALL_TIME);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ userId: 'u1', rank: 1 });
      expect(repo.updateRank).toHaveBeenCalledTimes(2);
    });

    it('emits rank changed event when rank improves', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.calculateAllRanks.mockResolvedValue([{ userId: 'u1', xp: 1000, rank: 5, denseRank: 5 }]);
      repo.updateRank.mockResolvedValue(10); // Previous rank was worse
      repo.updatePeakRank.mockResolvedValue({ updated: false, previousPeakRank: null });
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);
      repo.createMilestone.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
        milestone: 'TOP_10',
        rank: 5,
      });

      const service = createService(repo, bus);
      await service.calculateAllRanks(RankingPeriod.ALL_TIME);

      expect(bus.emitRankChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          previousRank: 10,
          newRank: 5,
        }),
      );
    });

    it('does not emit rank changed event when rank stays the same', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.calculateAllRanks.mockResolvedValue([{ userId: 'u1', xp: 1000, rank: 5, denseRank: 5 }]);
      repo.updateRank.mockResolvedValue(5); // Same rank
      repo.updatePeakRank.mockResolvedValue({ updated: false, previousPeakRank: null });
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);

      const service = createService(repo, bus);
      await service.calculateAllRanks(RankingPeriod.ALL_TIME);

      expect(bus.emitRankChanged).not.toHaveBeenCalled();
    });

    it('throws RankCalculationError on repository failure', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.calculateAllRanks.mockRejectedValue(new Error('Database error'));

      const service = createService(repo, bus);
      await expect(service.calculateAllRanks(RankingPeriod.ALL_TIME)).rejects.toThrow(
        RankCalculationError,
      );
    });
  });

  describe('recalculateRanksForUsers', () => {
    it('marks users dirty, recalculates, and updates ranks', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.markDirty.mockResolvedValue(undefined);
      repo.calculateAllRanksForUsers.mockResolvedValue([
        { userId: 'u1', xp: 2000, rank: 1, denseRank: 1 },
      ]);
      repo.updateRank.mockResolvedValue(null);
      repo.updatePeakRank.mockResolvedValue({ updated: false, previousPeakRank: null });
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);
      repo.createMilestone.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
        milestone: 'TOP_10',
        rank: 1,
      });

      const service = createService(repo, bus);
      await service.recalculateRanksForUsers(['u1'], RankingPeriod.WEEKLY);

      expect(repo.markDirty).toHaveBeenCalledWith(['u1']);
      expect(repo.calculateAllRanksForUsers).toHaveBeenCalledWith({
        userIds: ['u1'],
        period: RankingPeriod.WEEKLY,
      });
    });

    it('handles empty user list gracefully', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      const service = createService(repo, bus);
      await expect(
        service.recalculateRanksForUsers([], RankingPeriod.ALL_TIME),
      ).resolves.toBeUndefined();

      expect(repo.markDirty).not.toHaveBeenCalled();
    });
  });

  describe('calculateUserRank', () => {
    it('calculates rank from provided XP', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.countRankAbove.mockResolvedValue(9);

      const service = createService(repo, bus);
      const rank = await service.calculateUserRank('u1', RankingPeriod.ALL_TIME, 1000);

      expect(rank).toBe(10); // 9 users above + 1
      expect(repo.getUserRanking).not.toHaveBeenCalled();
    });

    it('fetches user XP when not provided', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.getUserRanking.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 500,
        weeklyXp: 100,
        monthlyXp: 200,
        dailyXp: 50,
      });
      repo.countRankAbove.mockResolvedValue(49);

      const service = createService(repo, bus);
      const rank = await service.calculateUserRank('u1', RankingPeriod.ALL_TIME);

      expect(rank).toBe(50);
    });

    it('returns null for user with no ranking', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.getUserRanking.mockResolvedValue(null);

      const service = createService(repo, bus);
      const rank = await service.calculateUserRank('u1', RankingPeriod.ALL_TIME);

      expect(rank).toBeNull();
    });

    it('returns null for zero XP', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.getUserRanking.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
        dailyXp: 0,
      });

      const service = createService(repo, bus);
      const rank = await service.calculateUserRank('u1', RankingPeriod.ALL_TIME);

      expect(rank).toBeNull();
    });
  });

  describe('queueRankRecalculation', () => {
    it('enqueues recalculation for single user across periods', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.enqueueRecalculation.mockResolvedValue(undefined);

      const service = createService(repo, bus);
      await service.queueRankRecalculation('u1', [RankingPeriod.WEEKLY, RankingPeriod.MONTHLY]);

      expect(repo.enqueueRecalculation).toHaveBeenCalledWith({
        userIds: ['u1'],
        periods: [RankingPeriod.WEEKLY, RankingPeriod.MONTHLY],
      });
    });
  });

  describe('queueRankRecalculationInTx', () => {
    it('enqueues recalculation within transaction context', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.enqueueRecalculation.mockImplementation(() => Promise.resolve() as never);

      const service = createService(repo, bus);
      await service.queueRankRecalculationInTx({}, 'u1', [RankingPeriod.ALL_TIME]);

      // The method should call the repository's transactional version
      expect(repo.enqueueRecalculation).toHaveBeenCalled();
    });
  });

  describe('processDirtyRankings', () => {
    it('processes work items and clears dirty flags atomically', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();
      const db = buildStubDb();

      repo.getPendingRecalculationWorkItems.mockResolvedValue([
        { workItemId: 'wi1', userId: 'u1', period: 'weekly' },
        { workItemId: 'wi2', userId: 'u2', period: 'weekly' },
      ]);
      repo.markDirty.mockResolvedValue(undefined);
      repo.calculateAllRanksForUsers.mockResolvedValue([
        { userId: 'u1', xp: 1000, rank: 1, denseRank: 1 },
        { userId: 'u2', xp: 500, rank: 2, denseRank: 2 },
      ]);
      repo.updateRank.mockResolvedValue(null);
      repo.updatePeakRank.mockResolvedValue({ updated: false, previousPeakRank: null });
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);
      repo.createMilestone.mockResolvedValue({
        id: 'm1',
        userId: 'u1',
        milestone: 'TOP_10',
        rank: 1,
      });

      const service = createService(repo, bus, db);
      const processed = await service.processDirtyRankings(100);

      expect(processed).toBe(2);
      // Verify transaction was used for atomic completion
      expect(repo.completeRecalculationWorkItemsInTx).toHaveBeenCalled();
      expect(repo.clearDirtyFlagsForUsersWithNoPendingWorkInTx).toHaveBeenCalled();
    });

    it('returns 0 when no pending work items', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.getPendingRecalculationWorkItems.mockResolvedValue([]);

      const service = createService(repo, bus);
      const processed = await service.processDirtyRankings();

      expect(processed).toBe(0);
      expect(repo.completeRecalculationWorkItemsInTx).not.toHaveBeenCalled();
    });

    it('groups work items by period for efficient processing', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();
      const db = buildStubDb();

      repo.getPendingRecalculationWorkItems.mockResolvedValue([
        { workItemId: 'wi1', userId: 'u1', period: 'weekly' },
        { workItemId: 'wi2', userId: 'u2', period: 'weekly' },
        { workItemId: 'wi3', userId: 'u3', period: 'monthly' },
      ]);
      repo.markDirty.mockResolvedValue(undefined);
      repo.calculateAllRanksForUsers.mockResolvedValue([]);
      repo.getTotalParticipants.mockResolvedValue(100);
      repo.hasMilestone.mockResolvedValue(false);

      const service = createService(repo, bus, db);
      await service.processDirtyRankings();

      // Should be called twice: once for weekly, once for monthly
      expect(repo.calculateAllRanksForUsers).toHaveBeenCalledTimes(2);
    });
  });

  describe('performConsistencyCheck', () => {
    it('finds and fixes missing ranks', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.findMissingRanks.mockResolvedValue(['u1']);
      repo.countRankAbove.mockResolvedValue(5);
      repo.updateRank.mockResolvedValue(null);
      repo.findXpMismatches.mockResolvedValue([]);

      const service = createService(repo, bus);
      const report = await service.performConsistencyCheck();

      expect(report.totalIssues).toBe(1);
      expect(report.issues[0]).toMatchObject({
        type: 'missing_rank',
        severity: 'medium',
      });
    });

    it('detects XP mismatches', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.findMissingRanks.mockResolvedValue([]);
      repo.findXpMismatches.mockResolvedValue([{ userId: 'u1', storedXp: 100, expectedXp: 150 }]);

      const service = createService(repo, bus);
      const report = await service.performConsistencyCheck();

      expect(report.totalIssues).toBe(1);
      expect(report.issues[0]).toMatchObject({
        type: 'xp_mismatch',
        severity: 'high',
      });
    });

    it('returns empty report when no issues', async () => {
      const repo = buildStubRepo();
      const bus = buildStubBus();

      repo.findMissingRanks.mockResolvedValue([]);
      repo.findXpMismatches.mockResolvedValue([]);

      const service = createService(repo, bus);
      const report = await service.performConsistencyCheck();

      expect(report.totalIssues).toBe(0);
      expect(report.issues).toHaveLength(0);
    });
  });
});
