import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

/**
 * Wire-shape cursor for `GET /comments/reports`. The cursor is an
 * opaque base64url-encoded JSON `{ createdAt, id }` — same shape as
 * the comment cursor, distinguished by the `id` field being a report
 * identifier.
 */
export interface ReportCursor {
  readonly createdAt: string;
  readonly id: string;
}

// RFC 9562 UUIDv7: third group's first hex digit is `7`
// (version), fourth group's first hex digit is `8`, `9`, `a`, or
// `b` (variant). The previous pattern enforced `[1-7]` for the
// version digit which could accept non-v7 UUIDs. Tier 2 cursors use
// the same lower-cased hyphenated form as `generateUuidV7()`
// and `pg_uuidv7`, so the regex mirrors that.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function serializeReportCursor(cursor: ReportCursor | null): string | null {
  if (cursor === null) return null;
  return encodeBase64JsonCursor({ createdAt: cursor.createdAt, id: cursor.id });
}

export function parseReportCursor(cursor: string): ReportCursor {
  const parsed = decodeBase64JsonCursor<Partial<ReportCursor>>(cursor);

  if (typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) {
    throw new BadRequestException('Invalid cursor');
  }
  if (typeof parsed.id !== 'string' || !UUID_PATTERN.test(parsed.id)) {
    throw new BadRequestException('Invalid cursor');
  }

  return { createdAt: parsed.createdAt, id: parsed.id };
}
