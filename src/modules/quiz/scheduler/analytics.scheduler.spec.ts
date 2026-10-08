import type { PinoLogger } from 'nestjs-pino';
import { AnalyticsSchedulerService } from './analytics.scheduler';
import type { QuizAnalyticsService } from '../domain/analytics/quiz-analytics.service';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';

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

type LockBehavior = { kind: 'acquired' } | { kind: 'held-by-another' } | { kind: 'circuit-open' };

function makeScheduler(behavior: LockBehavior): {
  service: AnalyticsSchedulerService;
  quizAnalyticsService: {
    refreshAllTrendingScores: jest.Mock;
    refreshAllPopularityScores: jest.Mock;
    rebuildAllMetrics: jest.Mock;
    validateMetrics: jest.Mock;
    reconcileAllQuizMetrics: jest.Mock;
    reconcileAllReviewMetrics: jest.Mock;
  };
  lockKeys: string[];
} {
  const quizAnalyticsService = {
    refreshAllTrendingScores: jest.fn().mockResolvedValue(undefined),
    refreshAllPopularityScores: jest.fn().mockResolvedValue(undefined),
    rebuildAllMetrics: jest.fn().mockResolvedValue(undefined),
    validateMetrics: jest.fn().mockResolvedValue(undefined),
    reconcileAllQuizMetrics: jest.fn().mockResolvedValue({ quizzesReconciled: 0 }),
    reconcileAllReviewMetrics: jest.fn().mockResolvedValue({ reviewsReconciled: 0 }),
  };

  const lockKeys: string[] = [];
  const cache = {
    acquireAdvisoryLock: jest.fn().mockImplementation((key: string, _ttl: number) => {
      lockKeys.push(key);
      if (behavior.kind === 'acquired') return Promise.resolve('token-x');
      return Promise.resolve(null);
    }),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;

  const circuit = {
    getCircuitState: jest
      .fn()
      .mockImplementation(() => (behavior.kind === 'circuit-open' ? 'open' : 'closed')),
  } as unknown as RedisCircuitPort;

  const service = new AnalyticsSchedulerService(
    quizAnalyticsService as unknown as QuizAnalyticsService,
    cache,
    circuit,
    undefined,
    makeLogger(),
  );

  return { service, quizAnalyticsService, lockKeys };
}

describe('AnalyticsSchedulerService — distributed locking', () => {
  it('runs every cron handler body when the lock is acquired', async () => {
    const { service, quizAnalyticsService } = makeScheduler({ kind: 'acquired' });
    await service.handleTrendingRefresh();
    await service.handlePopularityRefresh();
    await service.handleFullRebuild();
    await service.handleDailyValidation();
    await service.handleQuizMetricsReconcile();
    await service.handleReviewMetricsReconcile();

    expect(quizAnalyticsService.refreshAllTrendingScores).toHaveBeenCalledTimes(1);
    expect(quizAnalyticsService.refreshAllPopularityScores).toHaveBeenCalledTimes(1);
    expect(quizAnalyticsService.rebuildAllMetrics).toHaveBeenCalledTimes(1);
    expect(quizAnalyticsService.validateMetrics).toHaveBeenCalledTimes(1);
    expect(quizAnalyticsService.reconcileAllQuizMetrics).toHaveBeenCalledTimes(1);
    expect(quizAnalyticsService.reconcileAllReviewMetrics).toHaveBeenCalledTimes(1);
  });

  it('skips the cron body when another replica holds the lock', async () => {
    const { service, quizAnalyticsService } = makeScheduler({ kind: 'held-by-another' });
    await service.handleTrendingRefresh();
    await service.handlePopularityRefresh();
    await service.handleFullRebuild();
    await service.handleDailyValidation();
    await service.handleQuizMetricsReconcile();
    await service.handleReviewMetricsReconcile();

    expect(quizAnalyticsService.refreshAllTrendingScores).not.toHaveBeenCalled();
    expect(quizAnalyticsService.refreshAllPopularityScores).not.toHaveBeenCalled();
    expect(quizAnalyticsService.rebuildAllMetrics).not.toHaveBeenCalled();
    expect(quizAnalyticsService.validateMetrics).not.toHaveBeenCalled();
    expect(quizAnalyticsService.reconcileAllQuizMetrics).not.toHaveBeenCalled();
    expect(quizAnalyticsService.reconcileAllReviewMetrics).not.toHaveBeenCalled();
  });

  it('uses distinct lock keys per cron handler', async () => {
    const { service, lockKeys } = makeScheduler({ kind: 'acquired' });
    await service.handleTrendingRefresh();
    await service.handlePopularityRefresh();
    await service.handleFullRebuild();
    await service.handleDailyValidation();
    await service.handleQuizMetricsReconcile();
    await service.handleReviewMetricsReconcile();

    expect(lockKeys.length).toBe(6);
    expect(new Set(lockKeys).size).toBe(6);
  });
});
