import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import type { ReviewCursor, ReportCursor } from '../domain/ports';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value);
}

export class CursorMapper {
  static parseReview(cursor: string): ReviewCursor {
    const parsed = decodeBase64JsonCursor<{ createdAt?: string; reviewId?: string }>(cursor);

    if (!isIsoDateString(parsed.createdAt) || !isUuid(parsed.reviewId)) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt!,
      reviewId: parsed.reviewId!,
    };
  }

  static serializeReview(payload: ReviewCursor): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      reviewId: payload.reviewId,
    });
  }

  static parseReport(cursor: string): ReportCursor {
    const parsed = decodeBase64JsonCursor<{ createdAt?: string; reportId?: string }>(cursor);

    if (!isIsoDateString(parsed.createdAt) || !isUuid(parsed.reportId)) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt!,
      reportId: parsed.reportId!,
    };
  }

  static serializeReport(payload: ReportCursor): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      reportId: payload.reportId,
    });
  }
}
