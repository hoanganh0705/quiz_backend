/// <reference types="jest" />
import { ReviewService } from './review.service';
import { ReviewValidationError } from './errors/review-domain.errors';

describe('ReviewService.reportReview — self-report guard', () => {
  const REVIEW_ID = 'review-1';
  const REPORTER_ID = 'user-1';

  function createService() {
    const reviewRepository = {
      getReviewById: jest.fn(),
    };
    const reportRepository = {
      hasUserReportedReview: jest.fn(),
      createReport: jest.fn(),
    };
    const quizRepository = {
      // Phase 1 / Issue #1 — `reportReview` calls
      // `assertQuizVisibleById` after fetching the review, so the
      // mock must return a visible quiz or the spec would fail with
      // a `Quiz not found` error instead of the self-report guard.
      getActiveQuizRecordById: jest.fn().mockResolvedValue({
        quizId: 'quiz-1',
        creatorId: 'creator-1',
        isHidden: false,
        publishedVersionId: 'version-1',
      }),
    };
    const quizAnalyticsService = { refreshForQuiz: jest.fn() } as never;
    const reviewEventBus = {
      subscribe: jest.fn(() => () => {}),
      dispatchToSubscribers: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const reviewOutbox = {
      scheduleReviewSubmitted: jest.fn().mockResolvedValue(undefined),
      scheduleReviewDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ReviewService(
      {} as never,
      reviewRepository as never,
      reportRepository as never,
      quizRepository as never,
      quizAnalyticsService,
      reviewEventBus as never,
      reviewOutbox as never,
      logger as never,
    );

    return { service, reviewRepository, reportRepository };
  }

  it('rejects when the reporter is the review author (no row inserted, no duplicate check)', async () => {
    const { service, reviewRepository, reportRepository } = createService();
    reviewRepository.getReviewById.mockResolvedValue({
      reviewId: REVIEW_ID,
      quizId: 'quiz-1',
      userId: REPORTER_ID,
      rating: 5,
      comment: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(service.reportReview(REVIEW_ID, REPORTER_ID, 'spam', null)).rejects.toBeInstanceOf(
      ReviewValidationError,
    );

    await expect(service.reportReview(REVIEW_ID, REPORTER_ID, 'spam', null)).rejects.toMatchObject({
      code: 'REVIEW_VALIDATION',
      message: 'You cannot report your own review',
    });

    expect(reportRepository.hasUserReportedReview).not.toHaveBeenCalled();
    expect(reportRepository.createReport).not.toHaveBeenCalled();
  });

  it('still reports when a different user reports the review', async () => {
    const { service, reviewRepository, reportRepository } = createService();
    reviewRepository.getReviewById.mockResolvedValue({
      reviewId: REVIEW_ID,
      quizId: 'quiz-1',
      userId: 'reviewer-author',
      rating: 5,
      comment: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    reportRepository.hasUserReportedReview.mockResolvedValue(false);
    reportRepository.createReport.mockResolvedValue({
      reportId: 'report-1',
      reviewId: REVIEW_ID,
      reporterId: REPORTER_ID,
      reason: 'spam',
      details: null,
      status: 'open',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    await expect(
      service.reportReview(REVIEW_ID, REPORTER_ID, 'spam', null),
    ).resolves.toBeUndefined();

    expect(reportRepository.hasUserReportedReview).toHaveBeenCalledWith(REVIEW_ID, REPORTER_ID);
    expect(reportRepository.createReport).toHaveBeenCalledWith({
      reviewId: REVIEW_ID,
      reporterId: REPORTER_ID,
      reason: 'spam',
      details: null,
      nowIso: expect.any(String),
    });
  });
});
