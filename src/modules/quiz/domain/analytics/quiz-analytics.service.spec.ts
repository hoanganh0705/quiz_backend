/// <reference types="jest" />
import { QuizAnalyticsService } from './quiz-analytics.service';

describe('QuizAnalyticsService', () => {
  function createService() {
    const analyticsRepository = {
      getAllActiveQuizIds: jest.fn(),
      upsertQuizStats: jest.fn(),
    };
    const metricsRepository = {
      calculateBookmarkCount: jest.fn(),
      calculateTotalAttempts: jest.fn(),
      calculateUniquePlayers: jest.fn(),
      calculateAverageScore: jest.fn(),
      calculateCompletionRate: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    const service = new QuizAnalyticsService(
      analyticsRepository as never,
      metricsRepository as never,
      {} as never,
      {} as never,
      logger as never,
    );

    return { service, analyticsRepository, metricsRepository, logger };
  }

  it('refreshes bookmark metrics for every active quiz', async () => {
    const { service, analyticsRepository, metricsRepository } = createService();
    analyticsRepository.getAllActiveQuizIds.mockResolvedValue(['quiz-a', 'quiz-b']);
    metricsRepository.calculateBookmarkCount.mockResolvedValueOnce(3).mockResolvedValueOnce(7);

    await expect(service.refreshAllBookmarkMetrics()).resolves.toEqual({
      quizzesEvaluated: 2,
      quizzesRefreshed: 2,
      errorCount: 0,
    });
    expect(analyticsRepository.upsertQuizStats).toHaveBeenNthCalledWith(
      1,
      'quiz-a',
      expect.objectContaining({ bookmarkCount: 3 }),
    );
    expect(analyticsRepository.upsertQuizStats).toHaveBeenNthCalledWith(
      2,
      'quiz-b',
      expect.objectContaining({ bookmarkCount: 7 }),
    );
  });

  it('continues refreshing after an individual quiz fails', async () => {
    const { service, analyticsRepository, metricsRepository, logger } = createService();
    analyticsRepository.getAllActiveQuizIds.mockResolvedValue(['quiz-a', 'quiz-b']);
    metricsRepository.calculateBookmarkCount
      .mockRejectedValueOnce(new Error('query failed'))
      .mockResolvedValueOnce(5);

    await expect(service.refreshAllBookmarkMetrics()).resolves.toEqual({
      quizzesEvaluated: 2,
      quizzesRefreshed: 1,
      errorCount: 1,
    });
    expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledTimes(1);
    expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledWith(
      'quiz-b',
      expect.objectContaining({ bookmarkCount: 5 }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'bookmark_metrics_backfill_quiz_failed',
        quizId: 'quiz-a',
        error: 'query failed',
      }),
    );
  });

  describe('reconcileAllQuizMetrics (Fix #7)', () => {
    it('refreshes attempt metrics for every active quiz', async () => {
      const { service, analyticsRepository, metricsRepository } = createService();
      analyticsRepository.getAllActiveQuizIds.mockResolvedValue(['quiz-a', 'quiz-b']);
      metricsRepository.calculateTotalAttempts.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      metricsRepository.calculateUniquePlayers.mockResolvedValue(2);
      metricsRepository.calculateAverageScore.mockResolvedValue(72.5);
      metricsRepository.calculateCompletionRate.mockResolvedValue(100);

      await expect(service.reconcileAllQuizMetrics()).resolves.toEqual({
        quizzesEvaluated: 2,
        quizzesRefreshed: 2,
        errorCount: 0,
      });

      expect(metricsRepository.calculateTotalAttempts).toHaveBeenCalledWith('quiz-a');
      expect(metricsRepository.calculateTotalAttempts).toHaveBeenCalledWith('quiz-b');
      expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledWith(
        'quiz-a',
        expect.objectContaining({
          totalAttempts: 3,
          totalPlayers: 2,
          avgScorePercent: '72.50',
          completionRate: '100.00',
        }),
      );
      expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledWith(
        'quiz-b',
        expect.objectContaining({
          totalAttempts: 7,
          totalPlayers: 2,
          avgScorePercent: '72.50',
          completionRate: '100.00',
        }),
      );
    });

    it('continues reconciling after an individual quiz fails (Fix #7 defense-in-depth)', async () => {
      const { service, analyticsRepository, metricsRepository, logger } = createService();
      analyticsRepository.getAllActiveQuizIds.mockResolvedValue(['quiz-a', 'quiz-b']);
      metricsRepository.calculateTotalAttempts
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(4);
      metricsRepository.calculateUniquePlayers.mockResolvedValue(1);
      metricsRepository.calculateAverageScore.mockResolvedValue(80);
      metricsRepository.calculateCompletionRate.mockResolvedValue(100);

      await expect(service.reconcileAllQuizMetrics()).resolves.toEqual({
        quizzesEvaluated: 2,
        quizzesRefreshed: 1,
        errorCount: 1,
      });

      expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledTimes(1);
      expect(analyticsRepository.upsertQuizStats).toHaveBeenCalledWith(
        'quiz-b',
        expect.objectContaining({ totalAttempts: 4 }),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'quiz_metrics_reconcile_quiz_failed',
          quizId: 'quiz-a',
          error: 'boom',
        }),
      );
    });
  });
});
