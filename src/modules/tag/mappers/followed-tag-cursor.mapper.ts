import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import type { FollowedTagCursorPayload } from '../types/tag.types';

export class FollowedTagCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): FollowedTagCursorPayload {
    const parsed = decodeBase64JsonCursor<FollowedTagCursorPayload>(cursor);

    if (!this.isIsoDateString(parsed.followedAt) || !this.isUuid(parsed.followId)) {
      throw new Error('Invalid cursor');
    }

    return {
      followedAt: parsed.followedAt ?? '',
      followId: parsed.followId ?? '',
    };
  }

  static serialize(payload: FollowedTagCursorPayload): string {
    return encodeBase64JsonCursor({
      followedAt: payload.followedAt,
      followId: payload.followId,
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
