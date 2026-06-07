import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export type TrendingDiscussionCursor = {
  score: number;
  threadId: string;
};

export class TrendingDiscussionCursorMapper {
  private static readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): TrendingDiscussionCursor {
    const parsed = decodeBase64JsonCursor<TrendingDiscussionCursor>(cursor);

    if (typeof parsed.score !== 'number' || !this.isUuid(parsed.threadId)) {
      throw new Error('Invalid cursor');
    }

    return {
      score: parsed.score ?? 0,
      threadId: parsed.threadId ?? '',
    };
  }

  static serialize(payload: TrendingDiscussionCursor): string {
    return encodeBase64JsonCursor({
      score: payload.score,
      threadId: payload.threadId,
    });
  }

  private static isUuid(value: unknown): boolean {
    return typeof value === 'string' && this.uuidPattern.test(value);
  }
}
