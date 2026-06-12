import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export type MySavedThreadCursor = {
  savedAt: string;
  threadId: string;
};

export class MySavedThreadCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): MySavedThreadCursor {
    const parsed = decodeBase64JsonCursor<MySavedThreadCursor>(cursor);
    if (!this.isIsoDateString(parsed.savedAt) || !this.isUuid(parsed.threadId)) {
      throw new Error('Invalid cursor');
    }
    return { savedAt: parsed.savedAt ?? '', threadId: parsed.threadId ?? '' };
  }

  static serialize(payload: MySavedThreadCursor): string {
    return encodeBase64JsonCursor({ savedAt: payload.savedAt, threadId: payload.threadId });
  }

  private static isUuid(value: unknown): value is string {
    return typeof value === 'string' && this.uuidPattern.test(value);
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}
