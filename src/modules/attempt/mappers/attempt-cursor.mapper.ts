import { BadRequestException } from '@nestjs/common';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
} from '@/common/utils/cursor.util';

export const ATTEMPT_LIST_SORT_FIELDS = ['createdAt', 'completedAt', 'score'] as const;
export type AttemptListSortField = (typeof ATTEMPT_LIST_SORT_FIELDS)[number];

export type AttemptListCursorPayload = {
  sortBy: AttemptListSortField;
  sortValue: string | number | null;
  attemptId: string;
};

export class AttemptCursorMapper {
  static parse(cursor: string): AttemptListCursorPayload {
    const parsed = decodeBase64JsonCursor<AttemptListCursorPayload>(cursor);

    if (!this.isSortField(parsed.sortBy)) {
      throw new BadRequestException('Invalid cursor');
    }

    if (typeof parsed.attemptId !== 'string' || parsed.attemptId.length === 0) {
      throw new BadRequestException('Invalid cursor');
    }

    if (!this.isValidSortValue(parsed.sortBy, parsed.sortValue)) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      sortBy: parsed.sortBy,
      sortValue: parsed.sortValue ?? null,
      attemptId: parsed.attemptId,
    };
  }

  static serialize(payload: AttemptListCursorPayload): string {
    return encodeBase64JsonCursor(payload);
  }

  private static isSortField(value: unknown): value is AttemptListSortField {
    return (
      typeof value === 'string' && ATTEMPT_LIST_SORT_FIELDS.includes(value as AttemptListSortField)
    );
  }

  private static isValidSortValue(sortBy: AttemptListSortField, value: unknown): boolean {
    if (sortBy === 'score') {
      return value === null || typeof value === 'number';
    }

    return value === null || isIsoDateString(value);
  }
}
