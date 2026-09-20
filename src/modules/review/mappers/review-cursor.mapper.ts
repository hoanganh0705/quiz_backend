import { BadRequestException } from '@nestjs/common';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
} from '@/common/utils/cursor.util';
import { isUuidV7Strict } from '@/common/utils/id-generator';
import type { ReviewCursor, ReviewHelpfulCursor, ReportCursor } from '../domain/ports';

export class CursorMapper {
  static parseReview(cursor: string): ReviewCursor {
    const parsed = decodeBase64JsonCursor<{ createdAt?: string; reviewId?: string }>(cursor);

    if (!isIsoDateString(parsed.createdAt) || !isUuidV7Strict(parsed.reviewId)) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      reviewId: parsed.reviewId,
    };
  }

  static serializeReview(payload: ReviewCursor): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      reviewId: payload.reviewId,
    });
  }

  static parseHelpful(cursor: string): ReviewHelpfulCursor {
    const parsed = decodeBase64JsonCursor<{
      helpfulCount?: number;
      reviewId?: string;
    }>(cursor);

    if (
      typeof parsed.helpfulCount !== 'number' ||
      !Number.isInteger(parsed.helpfulCount) ||
      parsed.helpfulCount < 0 ||
      !isUuidV7Strict(parsed.reviewId)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      helpfulCount: parsed.helpfulCount,
      reviewId: parsed.reviewId,
    };
  }

  static serializeHelpful(payload: ReviewHelpfulCursor): string {
    return encodeBase64JsonCursor({
      helpfulCount: payload.helpfulCount,
      reviewId: payload.reviewId,
    });
  }

  static parseReport(cursor: string): ReportCursor {
    const parsed = decodeBase64JsonCursor<{ createdAt?: string; reportId?: string }>(cursor);

    if (!isIsoDateString(parsed.createdAt) || !isUuidV7Strict(parsed.reportId)) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      reportId: parsed.reportId,
    };
  }

  static serializeReport(payload: ReportCursor): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      reportId: payload.reportId,
    });
  }
}
