import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export type MyDiscussionSubscriptionCursor = {
  subscribedAt: string;
  threadId: string;
};

export class MyDiscussionSubscriptionCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): MyDiscussionSubscriptionCursor {
    const parsed = decodeBase64JsonCursor<MyDiscussionSubscriptionCursor>(cursor);
    if (!this.isIsoDateString(parsed.subscribedAt) || !this.isUuid(parsed.threadId)) {
      throw new Error('Invalid cursor');
    }
    return { subscribedAt: parsed.subscribedAt ?? '', threadId: parsed.threadId ?? '' };
  }

  static serialize(payload: MyDiscussionSubscriptionCursor): string {
    return encodeBase64JsonCursor({ subscribedAt: payload.subscribedAt, threadId: payload.threadId });
  }

  private static isUuid(value: unknown): value is string {
    return typeof value === 'string' && this.uuidPattern.test(value);
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}
