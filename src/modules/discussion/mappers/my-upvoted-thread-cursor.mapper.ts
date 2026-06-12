import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export type MyUpvotedThreadCursor = {
  upvotedAt: string;
  threadId: string;
};

export class MyUpvotedThreadCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): MyUpvotedThreadCursor {
    const parsed = decodeBase64JsonCursor<MyUpvotedThreadCursor>(cursor);
    if (!this.isIsoDateString(parsed.upvotedAt) || !this.isUuid(parsed.threadId)) {
      throw new Error('Invalid cursor');
    }
    return { upvotedAt: parsed.upvotedAt ?? '', threadId: parsed.threadId ?? '' };
  }

  static serialize(payload: MyUpvotedThreadCursor): string {
    return encodeBase64JsonCursor({ upvotedAt: payload.upvotedAt, threadId: payload.threadId });
  }

  private static isUuid(value: unknown): value is string {
    return typeof value === 'string' && this.uuidPattern.test(value);
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}
