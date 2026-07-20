/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { CursorMapper } from './review-cursor.mapper';

describe('CursorMapper — Phase 5 / Issues #10 and #11', () => {
  // The repository uses UUIDv7, where the third group's first
  // hex digit is `7`. The mapper's UUID regex enforces that —
  // any test below must use a v7-shaped UUID.
  const VALID_REVIEW_ID = '550e8400-e29b-71d4-a716-446655440099';
  const VALID_REPORT_ID = '990e8400-e29b-71d4-a716-446655440001';

  describe('parseReview / serializeReview (default createdAt cursor)', () => {
    it('accepts a full ISO-8601 cursor with milliseconds and Z timezone', () => {
      const cursor = CursorMapper.serializeReview({
        createdAt: '2026-01-01T00:00:00.000Z',
        reviewId: VALID_REVIEW_ID,
      });

      expect(CursorMapper.parseReview(cursor)).toEqual({
        createdAt: '2026-01-01T00:00:00.000Z',
        reviewId: VALID_REVIEW_ID,
      });
    });

    it('accepts an ISO-8601 cursor with a numeric offset', () => {
      const cursor = CursorMapper.serializeReview({
        createdAt: '2026-01-01T08:30:00+08:00',
        reviewId: VALID_REVIEW_ID,
      });

      expect(CursorMapper.parseReview(cursor).createdAt).toBe('2026-01-01T08:30:00+08:00');
    });

    it('rejects a malformed ISO date prefix (Issue #10 regression guard)', () => {
      // Construct a base64 cursor with a `createdAt` that lacks a
      // timezone. The previous regex accepted any 19-char prefix,
      // which then crashed SQL with a Postgres error and surfaced
      // as a 500. Tightened regex must surface as a 400.
      const cursor = Buffer.from(
        JSON.stringify({
          createdAt: '2026-01-01T99:99:99', // invalid time, no timezone
          reviewId: VALID_REVIEW_ID,
        }),
        'utf8',
      ).toString('base64url');

      expect(() => CursorMapper.parseReview(cursor)).toThrow(BadRequestException);
    });

    it('rejects a cursor with a non-UUID reviewId', () => {
      const cursor = CursorMapper.serializeReview({
        createdAt: '2026-01-01T00:00:00.000Z',
        reviewId: 'not-a-uuid',
      });

      expect(() => CursorMapper.parseReview(cursor)).toThrow(BadRequestException);
    });
  });

  describe('parseHelpful / serializeHelpful (Issue #11 helpful-count cursor)', () => {
    it('round-trips a helpful cursor with positive count', () => {
      const cursor = CursorMapper.serializeHelpful({
        helpfulCount: 7,
        reviewId: VALID_REVIEW_ID,
      });

      expect(CursorMapper.parseHelpful(cursor)).toEqual({
        helpfulCount: 7,
        reviewId: VALID_REVIEW_ID,
      });
    });

    it('rejects a cursor with a non-integer helpful count', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          helpfulCount: 7.5,
          reviewId: VALID_REVIEW_ID,
        }),
        'utf8',
      ).toString('base64url');

      expect(() => CursorMapper.parseHelpful(cursor)).toThrow(BadRequestException);
    });

    it('rejects a cursor with a negative helpful count', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          helpfulCount: -1,
          reviewId: VALID_REVIEW_ID,
        }),
        'utf8',
      ).toString('base64url');

      expect(() => CursorMapper.parseHelpful(cursor)).toThrow(BadRequestException);
    });
  });

  describe('parseReport', () => {
    it('round-trips a report cursor', () => {
      const cursor = CursorMapper.serializeReport({
        createdAt: '2026-01-01T00:00:00.000Z',
        reportId: VALID_REPORT_ID,
      });

      expect(CursorMapper.parseReport(cursor)).toEqual({
        createdAt: '2026-01-01T00:00:00.000Z',
        reportId: VALID_REPORT_ID,
      });
    });
  });
});
