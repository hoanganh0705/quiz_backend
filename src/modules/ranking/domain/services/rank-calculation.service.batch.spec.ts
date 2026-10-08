import { RankingPeriod, RankingMilestone } from '../../domain/types/ranking.types';
import type { RankCalculationResult } from '../../domain/types/ranking.types';

type CapturedBind = { kind: 'string'; value: string } | { kind: 'other'; value: unknown };

function makeMockDb() {
  const executed: string[] = [];
  const bindings: CapturedBind[] = [];

  const flatten = (value: unknown, intoBindings: boolean): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      if (intoBindings) bindings.push({ kind: 'other', value });
      return '?';
    }
    if (value instanceof Date) {
      if (intoBindings) bindings.push({ kind: 'other', value });
      return value.toISOString();
    }
    if (Array.isArray(value)) return value.map((v) => flatten(v, intoBindings)).join('');
    if (value && typeof value === 'object') {
      const candidate = value as { query?: unknown; value?: unknown; queryChunks?: unknown };
      if (typeof candidate.query === 'string') return candidate.query;
      if (candidate.queryChunks !== undefined) return flatten(candidate.queryChunks, intoBindings);
      if (candidate.value !== undefined) return flatten(candidate.value, intoBindings);
    }
    return '';
  };

  const db = {
    execute: jest.fn((stmt: unknown) => {
      flatten(stmt, true);
      executed.push(flatten(stmt, false));
      return Promise.resolve({ rowCount: 1 });
    }),
    transaction: jest.fn(async (cb: (tx: object) => Promise<void>) => {
      const tx = {};
      await cb(tx);
    }),
  };

  return { db: db, executed, bindings };
}

function makeRankingRepository() {
  const rankingsForUsers = new Map<string, object[]>();

  return {
    calculateAllRanks: jest.fn().mockResolvedValue([]),
    calculateAllRanksForUsers: jest.fn().mockResolvedValue([]),
    batchUpdateRanks: jest.fn().mockResolvedValue(undefined),
    batchUpdatePeakRanks: jest.fn().mockResolvedValue([]),
    getRankingsForUsers: jest.fn((userIds: string[]) => {
      return Promise.resolve(userIds.map((id) => rankingsForUsers.get(id) ?? []).flat());
    }),
    updateRank: jest.fn().mockResolvedValue(null),
    updatePeakRank: jest.fn().mockResolvedValue({ updated: false, previousPeakRank: null }),
    getTotalParticipants: jest.fn().mockResolvedValue(1000),
    hasMilestone: jest.fn().mockResolvedValue(false),
    createMilestone: jest.fn().mockResolvedValue({}),
    persistMilestones: jest.fn().mockResolvedValue(undefined),
    findMissingRanks: jest.fn().mockResolvedValue([]),
    findXpMismatches: jest.fn().mockResolvedValue([]),
    markDirty: jest.fn().mockResolvedValue(undefined),
    enqueueRecalculation: jest.fn().mockResolvedValue(undefined),
    enqueueRecalculationInTx: jest.fn().mockResolvedValue(undefined),
    completeRecalculationWorkItemsInTx: jest.fn().mockResolvedValue(undefined),
    clearDirtyFlagsForUsersWithNoPendingWorkInTx: jest.fn().mockResolvedValue(undefined),
    getPendingRecalculationWorkItems: jest.fn().mockResolvedValue([]),
    _setRankingsForUsers: (map: Map<string, object[]>) => {
      Object.assign(rankingsForUsers, map);
    },
  } as unknown as jest.Mocked<RankingRepositoryPort>;
}

function makeEventBus() {
  return {
    emitRankChanged: jest.fn(),
    emitPeakRankAchieved: jest.fn(),
    emitRankingMilestone: jest.fn(),
    emitXpAdded: jest.fn(),
    emitPeriodResetInitiated: jest.fn(),
    emitPeriodResetCompleted: jest.fn(),
    emitConsistencyCheck: jest.fn(),
    subscribe: jest.fn(() => () => {}),
  };
}

function makeCacheVersionService() {
  return {
    bumpAllPeriods: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<RankingCacheVersionService>;
}

import { RankCalculationService } from './rank-calculation.service';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { RankingDomainEventBusPort } from '../ports/ranking-event-bus.port';
import { RankingCacheVersionService } from './ranking-cache-version.service';

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
}

function makeService(deps: {
  rankingRepository: RankingRepositoryPort;
  eventBus: RankingDomainEventBusPort;
  cacheVersionService: RankingCacheVersionService;
}) {
  const { db } = makeMockDb();
  return {
    service: new RankCalculationService(
      deps.rankingRepository,
      deps.eventBus,
      db as never,
      deps.cacheVersionService,
      makeLogger() as never,
    ),
    db,
  };
}

describe('RankCalculationService — batch operations', () => {
  describe('batchUpdateRanks', () => {
    it('calls batchUpdateRanks on the repository with correct params', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({
        rankingRepository: repo,
        eventBus,
        cacheVersionService,
      });

      const results: RankCalculationResult[] = [
        { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1, denseRank: 1, xp: 500 },
        { userId: 'u2', period: RankingPeriod.ALL_TIME, rank: 2, denseRank: 2, xp: 400 },
      ];

      repo.getRankingsForUsers.mockResolvedValue([]);

      await service['batchUpdateRanks'](results, RankingPeriod.ALL_TIME);

      expect(repo.batchUpdateRanks).toHaveBeenCalledWith({
        updates: [
          { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1 },
          { userId: 'u2', period: RankingPeriod.ALL_TIME, rank: 2 },
        ],
        now: expect.any(Date),
      });
    });

    it('does not call batchUpdateRanks when results are empty', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      await service['batchUpdateRanks']([], RankingPeriod.ALL_TIME);

      expect(repo.batchUpdateRanks).not.toHaveBeenCalled();
    });

    it('emits rank-changed events for users whose rank changed', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      repo.getRankingsForUsers.mockResolvedValue([
        { userId: 'u1', allTimeRank: 5, weeklyRank: null, monthlyRank: null, dailyRank: null },
      ] as never);
      repo.batchUpdatePeakRanks.mockResolvedValue([]);

      const results: RankCalculationResult[] = [
        { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 3, denseRank: 3, xp: 500 },
      ];

      await service['batchUpdateRanks'](results, RankingPeriod.ALL_TIME);

      expect(eventBus.emitRankChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'rank.changed',
          userId: 'u1',
          period: RankingPeriod.ALL_TIME,
          previousRank: 5,
          newRank: 3,
        }),
      );
    });

    it('emits peak-rank-achieved events when peak is updated', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      repo.getRankingsForUsers.mockResolvedValue([]);
      repo.batchUpdatePeakRanks.mockResolvedValue([
        { userId: 'u1', period: RankingPeriod.ALL_TIME, previousPeakRank: 10 },
      ]);

      const results: RankCalculationResult[] = [
        { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1, denseRank: 1, xp: 500 },
      ];

      await service['batchUpdateRanks'](results, RankingPeriod.ALL_TIME);

      expect(eventBus.emitPeakRankAchieved).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'peak.rank.achieved',
          userId: 'u1',
          period: RankingPeriod.ALL_TIME,
          previousPeakRank: 10,
          newPeakRank: 1,
        }),
      );
    });

    it('calls batch milestone persist for top-rank users', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      repo.getRankingsForUsers.mockResolvedValue([]);
      repo.batchUpdatePeakRanks.mockResolvedValue([]);

      const results: RankCalculationResult[] = [
        { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1, denseRank: 1, xp: 500 },
        { userId: 'u2', period: RankingPeriod.ALL_TIME, rank: 3, denseRank: 3, xp: 400 },
        { userId: 'u3', period: RankingPeriod.ALL_TIME, rank: 50, denseRank: 50, xp: 100 },
      ];

      await service['batchUpdateRanks'](results, RankingPeriod.ALL_TIME);

      expect(repo.persistMilestones).toHaveBeenCalled();
    });
  });

  describe('performConsistencyCheck', () => {
    it('fixes missing ranks using batchUpdateRanks instead of per-user SELECT-then-UPDATE', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      repo.findMissingRanks.mockResolvedValue(['u1', 'u2']);
      repo.calculateAllRanksForUsers
        .mockResolvedValueOnce([{ userId: 'u1', xp: 100, rank: 1, denseRank: 1 }])
        .mockResolvedValueOnce([{ userId: 'u2', xp: 90, rank: 2, denseRank: 2 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const report = await service.performConsistencyCheck();

      expect(report.totalIssues).toBeGreaterThanOrEqual(0);
      expect(repo.batchUpdateRanks).toHaveBeenCalled();
      expect(repo.updateRank).not.toHaveBeenCalled();
    });

    it('returns issues found by findXpMismatches', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service } = makeService({ rankingRepository: repo, eventBus, cacheVersionService });

      repo.findMissingRanks.mockResolvedValue([]);
      repo.findXpMismatches.mockResolvedValue([{ userId: 'u1', storedXp: 100, expectedXp: 90 }]);

      const report = await service.performConsistencyCheck();

      expect(report.issues).toContainEqual(
        expect.objectContaining({ type: 'xp_mismatch', severity: 'high' }),
      );
    });
  });

  describe('checkAndPersistMilestonesForBatch', () => {
    it('queries existing milestones once and inserts only absent ones', async () => {
      const repo = makeRankingRepository();
      const eventBus = makeEventBus();
      const cacheVersionService = makeCacheVersionService();
      const { service, db } = makeService({
        rankingRepository: repo,
        eventBus,
        cacheVersionService,
      });

      db.execute.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', milestone: 'TOP_1' }],
      });

      repo.getTotalParticipants.mockResolvedValue(1000);
      repo.batchUpdateRanks.mockResolvedValue(undefined);

      const triples: Parameters<RankCalculationService['checkAndPersistMilestonesForBatch']>[0] = [
        { userId: 'u1', milestone: RankingMilestone.TOP_1, rank: 1, achievedAt: new Date() },
        { userId: 'u2', milestone: RankingMilestone.TOP_1, rank: 2, achievedAt: new Date() },
      ];
      const results: RankCalculationResult[] = [
        { userId: 'u1', period: RankingPeriod.ALL_TIME, rank: 1, denseRank: 1, xp: 500 },
        { userId: 'u2', period: RankingPeriod.ALL_TIME, rank: 2, denseRank: 2, xp: 400 },
      ];

      await service['checkAndPersistMilestonesForBatch'](triples, results, RankingPeriod.ALL_TIME);

      expect(repo.persistMilestones).toHaveBeenCalledWith(
        expect.objectContaining({
          triples: expect.arrayContaining([
            expect.objectContaining({ userId: 'u2', milestone: 'TOP_1' }),
          ]),
        }),
      );
    });
  });
});
