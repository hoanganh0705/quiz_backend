import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

/**
 * Wire-shape cursor for `GET /quizzes/:quizId/comments` and
 * `GET /users/:userId/comments` (and the `/me` variant). The cursor is
 * an opaque base64url-encoded JSON `{ createdAt, id }` so the client
 * never has to interpret its internals.
 *
 * The `id` field is intentionally named to match the resource (a
 * comment), not the legacy `commentId` field from the pre-refactor
 * module. The shape is identical to the list-my-comments cursor.
 */
export interface CommentCursor {
  readonly createdAt: string;
  readonly id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Serialize a `CommentCursor` to its opaque wire form. `null` is
 * passed through unchanged so callers can forward a `nextCursor`
 * directly without branching.
 */
export function serializeCommentCursor(cursor: CommentCursor | null): string | null {
  if (cursor === null) return null;
  return encodeBase64JsonCursor({ createdAt: cursor.createdAt, id: cursor.id });
}

/**
 * Parse the opaque cursor back to a `CommentCursor`. Throws a 400
 * `BadRequestException` on any malformed input so a tampered cursor
 * cannot feed `undefined` into the SQL cursor comparison.
 */
export function parseCommentCursor(cursor: string): CommentCursor {
  const parsed = decodeBase64JsonCursor<Partial<CommentCursor>>(cursor);

  if (typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) {
    throw new BadRequestException('Invalid cursor');
  }
  if (typeof parsed.id !== 'string' || !UUID_PATTERN.test(parsed.id)) {
    throw new BadRequestException('Invalid cursor');
  }

  return { createdAt: parsed.createdAt, id: parsed.id };
}
