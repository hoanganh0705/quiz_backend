import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';

interface RecentlyPlayedCursorPayload {
  playedAt: string;
  attemptId: string;
}

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Cursor codec for the `GET /users/me/recently-played-quizzes` endpoint.
 *
 * Mirrors `UserBadgeCursorMapper` / `UserActivityCursorMapper`: the cursor is
 * a base64url-encoded `{ playedAt: ISO-8601, attemptId: UUIDv7 }` payload.
 * Tampered cursors throw `BadRequestException('Invalid cursor')` rather
 * than propagating `undefined` into the SQL cursor comparison.
 */
export class RecentlyPlayedCursorMapper {
  static parse(cursor: string): RecentlyPlayedCursorPayload {
    const parsed = decodeBase64JsonCursor<RecentlyPlayedCursorPayload>(cursor);

    if (
      !isIsoDateString(parsed.playedAt) ||
      !isStringMatchingPattern(parsed.attemptId, uuidV7Pattern)
    ) {
      throw new Error('Invalid cursor');
    }

    return { playedAt: parsed.playedAt, attemptId: parsed.attemptId };
  }

  static serialize(this: void, payload: RecentlyPlayedCursorPayload): string {
    return encodeBase64JsonCursor({
      playedAt: payload.playedAt,
      attemptId: payload.attemptId,
    });
  }
}
