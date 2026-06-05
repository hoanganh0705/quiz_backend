import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

interface UserBadgeCursorPayload {
  earnedAt: string;
  userBadgeId: string;
}

export class UserBadgeCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): UserBadgeCursorPayload {
    const parsed = decodeBase64JsonCursor<UserBadgeCursorPayload>(cursor);

    if (!this.isIsoDateString(parsed.earnedAt) || !this.isUuid(parsed.userBadgeId)) {
      throw new Error('Invalid cursor');
    }

    return {
      earnedAt: parsed.earnedAt ?? '',
      userBadgeId: parsed.userBadgeId ?? '',
    };
  }

  static serialize(payload: UserBadgeCursorPayload): string {
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
