import type { PinoLogger } from 'nestjs-pino';
import { RankingApplicationService } from './ranking.application.service';
import { RankingPeriod } from '../domain/types/ranking.types';
import type { RankingRepositoryPort } from '../domain/ports/ranking-repository.port';
import type { RankCalculationService } from '../domain/services';
import type { PeriodResetService } from '../domain/services';
import type { ConsistencyReport } from '../domain/types/ranking.types';

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

describe('RankingApplicationService.getStatus', () => {
  it('returns the dirty queue count, schedulerRunning=true, and computed next reset timestamps', async () => {
    const rankingRepository: Pick<RankingRepositoryPort, 'countDirtyUsers'> = {
      countDirtyUsers: jest.fn().mockResolvedValue(42),
    };

    const nextReset = new Date('2030-01-01T00:00:00.000Z');
    const periodResetService: Pick<PeriodResetService, 'getNextResetTime'> = {
      getNextResetTime: jest.fn().mockReturnValue(nextReset),
    };

    const rankCalculationService = {} as RankCalculationService;

    const service = new RankingApplicationService(
      rankCalculationService,
      periodResetService as PeriodResetService,
      rankingRepository as RankingRepositoryPort,
      makeLogger(),
    );

    const now = new Date('2026-09-20T10:00:00.000Z');
    const status = await service.getStatus(now);

    expect(status.dirtyQueueSize).toBe(42);
    expect(status.schedulerRunning).toBe(true);
    expect(status.nextPeriodReset.weekly).toBe(nextReset.toISOString());
    expect(status.nextPeriodReset.monthly).toBe(nextReset.toISOString());
    expect(status.nextPeriodReset.daily).toBe(nextReset.toISOString());
    expect(new Date(status.nextConsistencyCheck).getTime()).toBe(now.getTime() + 60 * 60 * 1000);

    expect(periodResetService.getNextResetTime).toHaveBeenCalledWith(RankingPeriod.WEEKLY, now);
    expect(periodResetService.getNextResetTime).toHaveBeenCalledWith(RankingPeriod.MONTHLY, now);
    expect(periodResetService.getNextResetTime).toHaveBeenCalledWith(RankingPeriod.DAILY, now);
  });

  it('returns 0 when there are no dirty users', async () => {
    const rankingRepository: Pick<RankingRepositoryPort, 'countDirtyUsers'> = {
      countDirtyUsers: jest.fn().mockResolvedValue(0),
    };
    const periodResetService: Pick<PeriodResetService, 'getNextResetTime'> = {
      getNextResetTime: jest.fn().mockReturnValue(new Date()),
    };
    const service = new RankingApplicationService(
      {} as RankCalculationService,
      periodResetService as PeriodResetService,
      rankingRepository as RankingRepositoryPort,
      makeLogger(),
    );

    const status = await service.getStatus();
    expect(status.dirtyQueueSize).toBe(0);
  });
});

describe('RankingApplicationService.triggerImmediateRecalculation', () => {
  it('recalculates only the requested period', async () => {
    const calculateAllRanks = jest.fn().mockResolvedValue(undefined);
    const rankCalculationService = { calculateAllRanks } as unknown as RankCalculationService;
    const service = new RankingApplicationService(
      rankCalculationService,
      {} as PeriodResetService,
      {} as RankingRepositoryPort,
      makeLogger(),
    );

    await service.triggerImmediateRecalculation(RankingPeriod.WEEKLY);

    expect(calculateAllRanks).toHaveBeenCalledTimes(1);
    expect(calculateAllRanks).toHaveBeenCalledWith(RankingPeriod.WEEKLY);
  });

  it('recalculates every period when none is provided', async () => {
    const calculateAllRanks = jest.fn().mockResolvedValue(undefined);
    const rankCalculationService = { calculateAllRanks } as unknown as RankCalculationService;
    const service = new RankingApplicationService(
      rankCalculationService,
      {} as PeriodResetService,
      {} as RankingRepositoryPort,
      makeLogger(),
    );

    await service.triggerImmediateRecalculation();

    expect(calculateAllRanks).toHaveBeenCalledTimes(4);
    expect(calculateAllRanks).toHaveBeenCalledWith(RankingPeriod.ALL_TIME);
    expect(calculateAllRanks).toHaveBeenCalledWith(RankingPeriod.WEEKLY);
    expect(calculateAllRanks).toHaveBeenCalledWith(RankingPeriod.MONTHLY);
    expect(calculateAllRanks).toHaveBeenCalledWith(RankingPeriod.DAILY);
  });
});

describe('RankingApplicationService.triggerConsistencyCheck', () => {
  it('delegates to RankCalculationService and returns the report', async () => {
    const report: ConsistencyReport = {
      totalIssues: 1,
      fixed: 1,
      issues: [
        {
          type: 'xp_mismatch',
          userId: 'user-1',
          description: 'mismatch',
          severity: 'low',
        },
      ],
    };
    const performConsistencyCheck = jest.fn().mockResolvedValue(report);
    const rankCalculationService = {
      performConsistencyCheck,
    } as unknown as RankCalculationService;

    const service = new RankingApplicationService(
      rankCalculationService,
      {} as PeriodResetService,
      {} as RankingRepositoryPort,
      makeLogger(),
    );

    const result = await service.triggerConsistencyCheck();

    expect(performConsistencyCheck).toHaveBeenCalledTimes(1);
    expect(result).toBe(report);
  });
});
