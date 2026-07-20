/// <reference types="jest" />
/**
 * Unit tests for `ReviewReportRepository.createReport` error
 * translation. Specifically the defense-in-depth path introduced
 * by migration `0016_review_reports_self_report_guard.sql`:
 * the DB trigger raises `23514` with the canonical message
 * `review_reports_self_report_forbidden`, and the repository
 * translates it back into `ReviewValidationError` so the
 * controller layer can return a clean 400.
 *
 * These tests are mocked at the Drizzle client boundary so they
 * run without a live Postgres.
 */

import { ReviewReportRepository } from './review-report.repository';
import { ReviewAlreadyReportedError } from '../../domain/errors';
import { ReviewValidationError } from '../../domain/errors';

type InsertResult = Array<Record<string, unknown>>;

function makeDrizzleStub(returning: InsertResult) {
  return {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returning),
      }),
    }),
  };
}

describe('ReviewReportRepository.createReport — error translation', () => {
  const baseParams = {
    reviewId: '01923456-7890-7abc-9def-0123456789ab',
    reporterId: '01923456-7890-7abc-9def-0123456789ac',
    reason: 'spam',
    details: null,
    nowIso: '2026-07-20T07:00:00.000Z',
  };

  it('returns the inserted row on the happy path', async () => {
    const row = {
      reportId: 'r-1',
      reviewId: baseParams.reviewId,
      reporterId: baseParams.reporterId,
      reason: 'spam',
      details: null,
      status: 'open',
      createdAt: baseParams.nowIso,
      updatedAt: baseParams.nowIso,
    };

    const repo = new ReviewReportRepository(makeDrizzleStub([row]) as never);

    const result = await repo.createReport(baseParams);

    expect(result.reportId).toBe('r-1');
    expect(result.reason).toBe('spam');
  });

  it('translates the unique-constraint violation into ReviewAlreadyReportedError', async () => {
    const db = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue({
            code: '23505',
            constraint: 'uq_review_reports_review_reporter',
          }),
        }),
      }),
    };

    const repo = new ReviewReportRepository(db as never);

    await expect(repo.createReport(baseParams)).rejects.toBeInstanceOf(ReviewAlreadyReportedError);
  });

  it('translates the self-report 23514 trigger into ReviewValidationError', async () => {
    const db = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue({
            code: '23514',
            message:
              'review_reports_self_report_forbidden — new row for relation "review_reports" violates check constraint',
          }),
        }),
      }),
    };

    const repo = new ReviewReportRepository(db as never);

    await expect(repo.createReport(baseParams)).rejects.toBeInstanceOf(ReviewValidationError);
    await expect(repo.createReport(baseParams)).rejects.toMatchObject({
      message: 'You cannot report your own review',
    });
  });

  it('re-throws 23514 with a non-self-report message unchanged', async () => {
    const pgError = new Error('some other check violation') as Error & { code?: string };
    pgError.code = '23514';

    const db = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(pgError),
        }),
      }),
    };

    const repo = new ReviewReportRepository(db as never);

    await expect(repo.createReport(baseParams)).rejects.toBe(pgError);
  });

  it('re-throws unrelated errors unchanged', async () => {
    const dbError = new Error('connection refused');

    const db = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(dbError),
        }),
      }),
    };

    const repo = new ReviewReportRepository(db as never);

    await expect(repo.createReport(baseParams)).rejects.toBe(dbError);
  });
});
