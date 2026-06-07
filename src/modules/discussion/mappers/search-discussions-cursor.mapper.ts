import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export type SearchDiscussionsCursor = {
  createdAt: string;
  threadId: string;
};

export class SearchDiscussionsCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): SearchDiscussionsCursor {
    const parsed = decodeBase64JsonCursor<SearchDiscussionsCursor>(cursor);

    if (!this.isIsoDateString(parsed.createdAt) || !this.isUuid(parsed.threadId)) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt ?? '',
      threadId: parsed.threadId ?? '',
    };
  }

  static serialize(payload: SearchDiscussionsCursor): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      threadId: payload.threadId,
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
