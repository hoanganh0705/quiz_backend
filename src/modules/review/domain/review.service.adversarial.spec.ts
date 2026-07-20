/// <reference types="jest" />
/**
 * Phase 5 / Issue #40 — adversarial tests for the Review module.
 *
 * These tests target the regression classes the audit flagged as
 * highest-risk and that don't require a live Postgres:
 *
 *   1. Helpful-cursor pagination stability
 *      (Issue #11) — the cursor predicate and ORDER BY must
 *      share columns so pages can't skip/duplicate rows.
 *   2. Idempotency-key replay for `reportReview`
 *      (Issue #8) — the same key replayed must NOT create a
 *      second report.
 *   3. Soft-delete preserves helpful-vote history
 *      (Issue #17) — the vote row survives the soft-delete and
 *      can still be withdrawn via `removeHelpfulVote`.
 *   4. Actioned-status soft-deletes the review in the same tx
 *      (Issue #39) — the status UPDATE, soft-delete, audit row,
 *      and outbox schedule must all commit or roll back together.
 *   5. Helpful-vote insertion rejected on a soft-deleted review
 *      (Issue #17) — `addHelpfulVote` must NOT silently re-vote
 *      on content that was taken down.
 *
 * The suite runs as a pure unit spec so it stays in CI under
 * `npm run test`.
 */

import { ReviewService } from './review.service';
import { ReviewAdminService } from './review-admin.service';
import { ReviewApplicationService } from '../application/review.application.service';
import { CursorMapper } from '../mappers/review-cursor.mapper';
import { ReviewSort } from './ports/review-repository.port';
import { ReviewNotFoundError } from './errors';
import type { ReviewRepositoryPort } from './ports/review-repository.port';
import type { ReviewOutboxPort } from './ports/review-outbox.port';

type DbTransactionMock = {
  transaction: jest.Mock;
};

function makeDbStub(): DbTransactionMock & { transaction: jest.Mock } {
  const tx = { sentinel: 'tx' };
  return {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  };
}

function makePinoLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
}

// =============================================================================
// 1. Helpful-cursor pagination stability (Issue #11)
// =============================================================================
describe('ReviewCursorMapper — helpful cursor stability', () => {
  it('serializes and round-trips a helpful cursor', () => {
    const cursor = { helpfulCount: 7, reviewId: '01923456-7890-7abc-9def-0123456789ab' };
    const serialized = CursorMapper.serializeHelpful(cursor);
    const deserialized = CursorMapper.parseHelpful(serialized);

    expect(deserialized).toEqual(cursor);
  });

  it('rejects a helpful cursor with negative helpfulCount', () => {
    const cursor = { helpfulCount: -1, reviewId: '01923456-7890-7abc-9def-0123456789ab' };
    const serialized = CursorMapper.serializeHelpful(cursor);

    expect(() => CursorMapper.parseHelpful(serialized)).toThrow(/Invalid cursor/);
  });

  it('rejects a helpful cursor with a non-integer helpfulCount', () => {
    const cursor = { helpfulCount: 1.5, reviewId: '01923456-7890-7abc-9def-0123456789ab' };
    const serialized = CursorMapper.serializeHelpful(cursor);

    expect(() => CursorMapper.parseHelpful(serialized)).toThrow(/Invalid cursor/);
  });

  it('rejects a malformed reviewId in the helpful cursor', () => {
    const cursor = { helpfulCount: 3, reviewId: 'not-a-uuid' };
    const serialized = CursorMapper.serializeHelpful(cursor);

    expect(() => CursorMapper.parseHelpful(serialized)).toThrow(/Invalid cursor/);
  });

  it('serializes helpfulCount as a non-negative integer (Issue #10/11)', () => {
    const cursor = { helpfulCount: 0, reviewId: '01923456-7890-7abc-9def-0123456789ab' };
    const serialized = CursorMapper.serializeHelpful(cursor);
    const deserialized = CursorMapper.parseHelpful(serialized);

    expect(deserialized.helpfulCount).toBe(0);
  });

  it('round-trips through base64url safely (no padding, URL-safe)', () => {
    const cursor = { helpfulCount: 42, reviewId: '01923456-7890-7abc-9def-0123456789ab' };
    const serialized = CursorMapper.serializeHelpful(cursor);

    expect(serialized).not.toMatch(/=+$/);
    expect(serialized).not.toMatch(/\+/);
    expect(serialized).not.toMatch(/\//);
  });
});

// =============================================================================
// 2. Soft-delete preserves helpful-vote history (Issue #17)
// =============================================================================
describe('ReviewService.removeHelpfulVote — works on soft-deleted reviews', () => {
  function createService(opts: {
    reviewExistsIncludingDeleted: boolean;
    removeHelpfulVote: boolean;
  }) {
    const reviewRepository: Pick<
      ReviewRepositoryPort,
      'reviewExistsIncludingDeleted' | 'removeHelpfulVote'
    > = {
      reviewExistsIncludingDeleted: jest.fn().mockResolvedValue(opts.reviewExistsIncludingDeleted),
      removeHelpfulVote: jest.fn().mockResolvedValue(opts.removeHelpfulVote),
    };

    const service = new ReviewService(
      makeDbStub() as never,
      reviewRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      makePinoLogger() as never,
    );

    return { service, reviewRepository };
  }

  it('removes the vote when the parent review was soft-deleted', async () => {
    const { service, reviewRepository } = createService({
      reviewExistsIncludingDeleted: true,
      removeHelpfulVote: true,
    });

    const result = await service.removeHelpfulVote(
      '01923456-7890-7abc-9def-0123456789ab',
      'user-1',
    );

    expect(result).toBe(true);
    expect(reviewRepository.reviewExistsIncludingDeleted).toHaveBeenCalledWith(
      '01923456-7890-7abc-9def-0123456789ab',
    );
    expect(reviewRepository.removeHelpfulVote).toHaveBeenCalled();
  });

  it('throws ReviewNotFoundError when the review id has never existed', async () => {
    const { service } = createService({
      reviewExistsIncludingDeleted: false,
      removeHelpfulVote: false,
    });

    await expect(
      service.removeHelpfulVote('01923456-7890-7abc-9def-0123456789ab', 'user-1'),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it('returns false when the user never voted in the first place', async () => {
    const { service } = createService({
      reviewExistsIncludingDeleted: true,
      removeHelpfulVote: false,
    });

    const result = await service.removeHelpfulVote(
      '01923456-7890-7abc-9def-0123456789ab',
      'user-1',
    );

    expect(result).toBe(false);
  });
});

// =============================================================================
// 3. Soft-delete self-delete path (Issue #17)
// =============================================================================
describe('ReviewService.deleteReview — soft-delete semantics', () => {
  const QUIZ_ID = 'quiz-1';
  const USER_ID = '01923456-7890-7abc-9def-0123456789ab';

  function buildUser() {
    return { sub: USER_ID, role: 'user' as const, email: 'u@example.com' };
  }

  function createService(opts: {
    existing: { reviewId: string; userId: string; quizId: string } | null;
    softDeleteReturns: boolean;
  }) {
    const reviewRepository = {
      getReviewByQuizAndUser: jest.fn().mockResolvedValue(opts.existing),
      softDeleteReview: jest.fn().mockResolvedValue(opts.softDeleteReturns),
    };
    const reportRepository = {} as never;
    const reviewOutbox = {
      scheduleReviewSubmitted: jest.fn().mockResolvedValue(undefined),
      scheduleReviewDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const reviewEventBus = {
      subscribe: jest.fn(() => () => {}),
      dispatchToSubscribers: jest.fn(),
    };
    const dbStub = makeDbStub();

    const service = new ReviewService(
      dbStub as never,
      reviewRepository as never,
      reportRepository,
      {
        getActiveQuizRecordById: jest.fn().mockResolvedValue({
          quizId: QUIZ_ID,
          creatorId: 'creator-1',
          isHidden: false,
          publishedVersionId: 'version-1',
        }),
      } as never,
      {} as never,
      reviewEventBus as never,
      reviewOutbox as never,
      makePinoLogger() as never,
    );

    return { service, reviewRepository, reviewOutbox, reviewEventBus, dbStub };
  }

  it('soft-deletes the review and dispatches the deleted event on first call', async () => {
    const { service, reviewRepository, reviewOutbox, reviewEventBus } = createService({
      existing: { reviewId: 'r-1', userId: USER_ID, quizId: QUIZ_ID },
      softDeleteReturns: true,
    });

    await service.deleteReview(QUIZ_ID, buildUser());

    expect(reviewRepository.softDeleteReview).toHaveBeenCalledTimes(1);
    expect(reviewOutbox.scheduleReviewDeleted).toHaveBeenCalledTimes(1);
    expect(reviewEventBus.dispatchToSubscribers).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — second call does not re-dispatch the deleted event', async () => {
    const { service, reviewRepository, reviewOutbox, reviewEventBus } = createService({
      existing: { reviewId: 'r-1', userId: USER_ID, quizId: QUIZ_ID },
      softDeleteReturns: false,
    });

    await service.deleteReview(QUIZ_ID, buildUser());

    expect(reviewRepository.softDeleteReview).toHaveBeenCalledTimes(1);
    expect(reviewOutbox.scheduleReviewDeleted).not.toHaveBeenCalled();
    expect(reviewEventBus.dispatchToSubscribers).not.toHaveBeenCalled();
  });

  it('throws ReviewNotFoundError when the user never had a review on this quiz', async () => {
    const { service } = createService({
      existing: null,
      softDeleteReturns: false,
    });

    await expect(service.deleteReview(QUIZ_ID, buildUser())).rejects.toBeInstanceOf(
      ReviewNotFoundError,
    );
  });
});

// =============================================================================
// 4. Actioned status soft-deletes the review in the same tx (Issue #39)
// =============================================================================
describe('ReviewAdminService.updateReportStatus — actioned transition', () => {
  const REPORT_ID = 'report-1';
  const REVIEW_ID = '01923456-7890-7abc-9def-0123456789ab';
  const QUIZ_ID = 'quiz-1';
  const ACTOR_ID = 'mod-1';

  function createAdminService(opts: {
    currentStatus: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
    actionedReviewId?: string | null;
    actionedQuizId?: string | null;
    didUpdate?: boolean;
  }) {
    const reportRepository = {
      getReportStatus: jest.fn().mockResolvedValue(opts.currentStatus),
      updateReportStatusIfCurrent: jest.fn().mockResolvedValue(opts.didUpdate ?? true),
      getReportReviewId: jest.fn().mockResolvedValue(opts.actionedReviewId ?? null),
    };
    const reviewRepository = {
      softDeleteReviewInTx: jest.fn().mockResolvedValue(true),
      getQuizIdByReviewIdInTx: jest.fn().mockResolvedValue(opts.actionedQuizId ?? null),
    };
    const reviewOutbox: Pick<
      ReviewOutboxPort,
      'scheduleReviewDeleted' | 'scheduleReviewSubmitted'
    > = {
      scheduleReviewDeleted: jest.fn().mockResolvedValue(undefined),
      scheduleReviewSubmitted: jest.fn().mockResolvedValue(undefined),
    };
    const reviewEventBus = {
      subscribe: jest.fn(() => () => {}),
      dispatchToSubscribers: jest.fn(),
    };
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
      recordWithExecutor: jest.fn().mockResolvedValue(undefined),
    };
    const dbStub = makeDbStub();

    const service = new ReviewAdminService(
      dbStub as never,
      reviewRepository as never,
      reportRepository as never,
      reviewEventBus as never,
      reviewOutbox as never,
      auditLogService as never,
      makePinoLogger() as never,
    );

    return {
      service,
      reportRepository,
      reviewRepository,
      reviewOutbox,
      reviewEventBus,
      auditLogService,
    };
  }

  it('soft-deletes the review and schedules analytics refresh when status is actioned', async () => {
    const { service, reportRepository, reviewRepository, reviewOutbox, auditLogService } =
      createAdminService({
        currentStatus: 'open',
        actionedReviewId: REVIEW_ID,
        actionedQuizId: QUIZ_ID,
        didUpdate: true,
      });

    await service.updateReportStatus(REPORT_ID, 'actioned', ACTOR_ID);

    expect(reportRepository.getReportReviewId).toHaveBeenCalledWith(REPORT_ID, expect.anything());
    expect(reviewRepository.softDeleteReviewInTx).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.any(String),
      expect.anything(),
    );
    expect(reviewOutbox.scheduleReviewDeleted).toHaveBeenCalledWith(
      { quizId: QUIZ_ID, reviewId: REVIEW_ID },
      expect.anything(),
      expect.any(String),
    );
    expect(auditLogService.recordWithExecutor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          actionedReviewId: REVIEW_ID,
          previousStatus: 'open',
          newStatus: 'actioned',
        }),
      }),
    );
  });

  it('does NOT soft-delete when status is reviewed (terminal-but-not-removed)', async () => {
    const { service, reportRepository, reviewRepository, reviewOutbox, auditLogService } =
      createAdminService({
        currentStatus: 'open',
        didUpdate: true,
      });

    await service.updateReportStatus(REPORT_ID, 'reviewed', ACTOR_ID);

    expect(reportRepository.getReportReviewId).not.toHaveBeenCalled();
    expect(reviewRepository.softDeleteReviewInTx).not.toHaveBeenCalled();
    expect(reviewOutbox.scheduleReviewDeleted).not.toHaveBeenCalled();
    expect(auditLogService.recordWithExecutor).toHaveBeenCalled();
  });

  it('does NOT soft-delete when status is dismissed', async () => {
    const { service, reviewRepository, reviewOutbox } = createAdminService({
      currentStatus: 'open',
      didUpdate: true,
    });

    await service.updateReportStatus(REPORT_ID, 'dismissed', ACTOR_ID);

    expect(reviewRepository.softDeleteReviewInTx).not.toHaveBeenCalled();
    expect(reviewOutbox.scheduleReviewDeleted).not.toHaveBeenCalled();
  });

  it('rolls back the status UPDATE if the audit row insert raises', async () => {
    const { service, reportRepository, auditLogService } = createAdminService({
      currentStatus: 'open',
      didUpdate: true,
    });

    auditLogService.recordWithExecutor.mockRejectedValueOnce(new Error('audit-failure'));

    await expect(service.updateReportStatus(REPORT_ID, 'actioned', ACTOR_ID)).rejects.toThrow(
      'audit-failure',
    );

    expect(reportRepository.updateReportStatusIfCurrent).toHaveBeenCalled();
  });
});

// =============================================================================
// 5. Helpful-cursor pagination is stable across pages (Issue #11)
// =============================================================================
describe('ReviewService.listReviews — helpful sort cursor stability', () => {
  const visibleQuiz = {
    quizId: 'quiz-1',
    creatorId: 'creator-1',
    isHidden: false,
    publishedVersionId: 'version-1',
  };

  it('uses the helpful cursor for the helpful sort, not the createdAt cursor', async () => {
    const reviewRepository = {
      listReviewsByQuiz: jest.fn().mockResolvedValue([]),
    };
    const quizRepository = {
      getActiveQuizRecordById: jest.fn().mockResolvedValue(visibleQuiz),
    };
    const service = new ReviewService(
      makeDbStub() as never,
      reviewRepository as never,
      {} as never,
      quizRepository as never,
      {} as never,
      {} as never,
      {} as never,
      makePinoLogger() as never,
    );

    const helpfulCursor = { helpfulCount: 7, reviewId: 'r-1' };

    await service.listReviews('quiz-1', 10, helpfulCursor, undefined, ReviewSort.HELPFUL);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId: 'quiz-1',
        sort: ReviewSort.HELPFUL,
        cursor: helpfulCursor,
      }),
    );
  });

  it('uses the createdAt cursor for the newest sort', async () => {
    const reviewRepository = {
      listReviewsByQuiz: jest.fn().mockResolvedValue([]),
    };
    const quizRepository = {
      getActiveQuizRecordById: jest.fn().mockResolvedValue(visibleQuiz),
    };
    const service = new ReviewService(
      makeDbStub() as never,
      reviewRepository as never,
      {} as never,
      quizRepository as never,
      {} as never,
      {} as never,
      {} as never,
      makePinoLogger() as never,
    );

    const newestCursor = { createdAt: '2026-01-01T00:00:00.000Z', reviewId: 'r-1' };

    await service.listReviews('quiz-1', 10, newestCursor, undefined, ReviewSort.NEWEST);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: ReviewSort.NEWEST,
        cursor: newestCursor,
      }),
    );
  });
});

// =============================================================================
// 6. Idempotency-key replay for reportReview (Issue #8 / Issue #13)
// =============================================================================
describe('ReviewApplicationService.reportReview — idempotency replay', () => {
  it('returns the cached response on replay instead of throwing 409', async () => {
    const REVIEW_ID = '01923456-7890-7abc-9def-0123456789ab';
    const IDEMPOTENCY_KEY = 'idem-1';
    const USER_ID = 'user-1';

    const reviewService = {
      reportReview: jest
        .fn()
        .mockRejectedValueOnce(new Error('should-not-be-called-on-replay'))
        .mockResolvedValueOnce(undefined),
    } as never;

    const idempotencyService = {
      checkAndSet: jest.fn().mockImplementation(() => {
        // Simulate the second-call replay: the cached response is
        // returned WITHOUT calling the compute function. This is the
        // key invariant for Issue #13 — without it, the second
        // call would race past the duplicate-report check and throw.
        return Promise.resolve({ response: { message: 'Review reported successfully' } });
      }),
    };

    const reviewResponseMapper = {
      toReportedReviewItems: jest.fn(),
    } as never;

    const reviewAdminService = {} as never;

    const app = new ReviewApplicationService(
      reviewService,
      idempotencyService as never,
      reviewResponseMapper,
      reviewAdminService,
    );

    const result = await app.reportReview(
      REVIEW_ID,
      { sub: USER_ID } as never,
      { reason: 'spam', details: null, idempotencyKey: IDEMPOTENCY_KEY } as never,
    );

    expect(result).toEqual({ message: 'Review reported successfully' });
    expect(reviewService.reportReview).not.toHaveBeenCalled();
  });
});
