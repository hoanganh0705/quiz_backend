import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

interface UserBadgeCursorPayload {
  earnedAt: string;
  userBadgeId: string;
}

export class UserBadgeCursorMapper {
  // Phase 1 (F-3): UUIDv7 is the only UUID version produced by the backend
  // (`generateUuidV7()` + `pg_uuidv7`). The previous regex `[1-5]` rejected
  // every UUIDv7 cursor and threw a native `Error`, surfacing as HTTP 500.
  // The pattern below matches the project-wide UUIDv7 form used by
  // `report-cursor.mapper.ts` and `review-cursor.mapper.ts`.
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): UserBadgeCursorPayload {
    const parsed = decodeBase64JsonCursor<UserBadgeCursorPayload>(cursor);

    if (!this.isIsoDateString(parsed.earnedAt) || !this.isUuid(parsed.userBadgeId)) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      earnedAt: parsed.earnedAt ?? '',
      userBadgeId: parsed.userBadgeId ?? '',
    };
  }

  static serialize(this: void, payload: UserBadgeCursorPayload): string {
    return encodeBase64JsonCursor({
      earnedAt: payload.earnedAt,
      userBadgeId: payload.userBadgeId,
    });
  }

  private static isUuid(value: unknown): boolean {
    return typeof value === 'string' && this.uuidPattern.test(value);
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}
