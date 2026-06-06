import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export interface RecentBookmarkCursorPayload {
  bookmarkedAt: string;
  bookmarkId: string;
}

export class RecentBookmarkCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): RecentBookmarkCursorPayload {
    const parsed = decodeBase64JsonCursor<RecentBookmarkCursorPayload>(cursor);

    if (!this.isIsoDateString(parsed.bookmarkedAt) || !this.isUuid(parsed.bookmarkId)) {
      throw new Error('Invalid cursor');
    }

    return {
      bookmarkedAt: parsed.bookmarkedAt ?? '',
      bookmarkId: parsed.bookmarkId ?? '',
    };
  }

  static serialize(payload: RecentBookmarkCursorPayload): string {
    return encodeBase64JsonCursor({
      bookmarkedAt: payload.bookmarkedAt,
      bookmarkId: payload.bookmarkId,
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
