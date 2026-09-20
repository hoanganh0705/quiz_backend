import { BadRequestException } from '@nestjs/common';
import {
  decodeBase64JsonCursor,
  encodeBase64JsonCursor,
  isIsoDateString,
  isStringMatchingPattern,
} from '@/common/utils/cursor.util';
import { isUuidV7Strict } from '@/common/utils/id-generator';

const UUID_V7_STRICT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ReportCursor {
  readonly createdAt: string;
  readonly id: string;
}

export function serializeReportCursor(cursor: ReportCursor | null): string | null {
  if (cursor === null) return null;
  return encodeBase64JsonCursor({ createdAt: cursor.createdAt, id: cursor.id });
}

export function parseReportCursor(cursor: string): ReportCursor {
  const parsed = decodeBase64JsonCursor<Partial<ReportCursor>>(cursor);

  if (
    !isIsoDateString(parsed.createdAt) ||
    !isUuidV7Strict(parsed.id) ||
    !isStringMatchingPattern(parsed.id, UUID_V7_STRICT_PATTERN)
  ) {
    throw new BadRequestException('Invalid cursor');
  }

  return { createdAt: parsed.createdAt, id: parsed.id };
}
