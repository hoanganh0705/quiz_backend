import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

// Phase 1 (F-3): UUIDv7 is the only UUID version produced by the backend
// (`generateUuidV7()` + `pg_uuidv7`). The previous regex `[1-5]` rejected
// every UUIDv7 cursor and threw a native `Error`, surfacing as HTTP 500.
// The pattern below matches the project-wide UUIDv7 form used by
// `report-cursor.mapper.ts` and `review-cursor.mapper.ts`.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export class MyTournamentHistoryCursorMapper {
  static serialize(this: void, cursor: { completedAt: string; participantId: string }): string {
    return encodeBase64JsonCursor(cursor);
  }

  static parse(cursor: string): { completedAt: string; participantId: string } {
    const parsed = decodeBase64JsonCursor<{ completedAt: string; participantId: string }>(cursor);

    if (typeof parsed.completedAt !== 'string' || !ISO_DATE_PATTERN.test(parsed.completedAt)) {
      throw new BadRequestException('Invalid cursor: completedAt must be an ISO date string');
    }

    if (typeof parsed.participantId !== 'string' || !UUID_PATTERN.test(parsed.participantId)) {
      throw new BadRequestException('Invalid cursor: participantId must be a UUIDv7');
    }

    return {
      completedAt: parsed.completedAt,
      participantId: parsed.participantId,
    };
  }
}
