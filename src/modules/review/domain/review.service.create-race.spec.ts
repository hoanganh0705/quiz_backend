/// <reference types="jest" />
import { ReviewService } from './review.service';
import { ReviewConflictError } from './errors/review-domain.errors';

describe('ReviewService.createReview — Phase 2 / Issue #2 (advisory-lock race fix)', () => {
  const QUIZ_ID = 'quiz-1';
  const USER_ID = 'user-1';

  function createService(opts: {
    quizReview?: { reviewId: string; userId: string } | null;
    completedAttempt?: boolean;
  }) {
    const reviewRepository = {
      getReviewById: jest.fn(),
      getReviewByQuizAndUser: jest.fn(),
      hasCompletedAttempt: jest.fn().mockResolvedValue(opts.completedAttempt ?? true),
    };
    const reportRepository = {
      hasUserReportedReview: jest.fn(),
      createReport: jest.fn(),
    };
    const quizRepository = {
      getActiveQuizRecordById: jest.fn().mockResolvedValue({
        quizId: QUIZ_ID,
        creatorId: 'creator-1',
        isHidden: false,
        publishedVersionId: 'version-1',
      }),
    };
    const quizAnalyticsService = {} as never;
    const reviewEventBus = {
      subscribe: jest.fn(() => () => {}),
      dispatchToSubscribers: jest.fn(),
    };
    const reviewOutbox = {
      scheduleReviewSubmitted: jest.fn().mockResolvedValue(undefined),
      scheduleReviewDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const dbCalls: unknown[] = [];
    const tx = {
      execute: jest.fn((sql: unknown) => {
        dbCalls.push(sql);
        return Promise.resolve(undefined);
      }),
      insert: jest.fn(() => ({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            reviewId: 'new-review',
            quizId: QUIZ_ID,
            userId: USER_ID,
            rating: 5,
            comment: null,
            createdAt: '2026-07-19T00:00:00.000Z',
            updatedAt: '2026-07-19T00:00:00.000Z',
          },
        ]),
      })),
    };
    const db = {
      transaction: jest.fn((cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    // Mock the duplicate-inside-lock check.
    reviewRepository.getReviewByQuizAndUser.mockResolvedValue(opts.quizReview ?? null);

    const service = new ReviewService(
      db as never,
      reviewRepository as never,
      reportRepository as never,
      quizRepository as never,
      quizAnalyticsService,
      reviewEventBus as never,
      reviewOutbox as never,
      logger as never,
    );

    return { service, dbCalls, tx, reviewRepository, db };
  }

  it('takes pg_advisory_xact_lock before inserting the review', async () => {
    const { service, dbCalls } = createService({ quizReview: null, completedAttempt: true });
    await service.createReview(QUIZ_ID, 5, null, { sub: USER_ID, role: 'user' });
    // Drizzle's `sql` template tag produces an object with a
    // `queryChunks` array. Each chunk is either a `{ value: string[] }`
    // fragment or a bound parameter (string/number). We flatten it
    // and assert that the advisory-lock function name appears at
    // least once.
    const lockCall = dbCalls.find((sql) => {
      const sqlObj = sql as { queryChunks?: unknown[] };
      const chunks = sqlObj?.queryChunks ?? [];
      const text = chunks
        .map((chunk) => {
          if (chunk && typeof chunk === 'object' && 'value' in chunk) {
            return (chunk as { value: string[] }).value.join('');
          }
          return String(chunk);
        })
        .join('');
      return text.includes('pg_advisory_xact_lock');
    });
    expect(lockCall).toBeDefined();
  });

  it('throws ReviewConflictError when a duplicate is observed INSIDE the advisory lock', async () => {
    const { service } = createService({
      quizReview: { reviewId: 'existing-review', userId: USER_ID },
      completedAttempt: true,
    });
    await expect(
      service.createReview(QUIZ_ID, 5, null, { sub: USER_ID, role: 'user' }),
    ).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it('does NOT query getReviewByQuizAndUser before the transaction (no pre-check)', async () => {
    const { service, reviewRepository } = createService({
      quizReview: null,
      completedAttempt: true,
    });
    await service.createReview(QUIZ_ID, 5, null, { sub: USER_ID, role: 'user' });
    // Phase 2 / Issue #2 — the pre-transaction duplicate check
    // was removed because it raced. The remaining call is the
    // in-transaction one inside the advisory lock.
    expect(reviewRepository.getReviewByQuizAndUser).toHaveBeenCalledTimes(1);
  });
});
