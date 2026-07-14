import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export class MyTournamentHistoryCursorMapper {
  static serialize(cursor: { completedAt: string; participantId: string }): string {
    return encodeBase64JsonCursor(cursor);
  }

  static parse(cursor: string): { completedAt: string; participantId: string } {
    const parsed = decodeBase64JsonCursor<{ completedAt: string; participantId: string }>(cursor);

    if (typeof parsed.completedAt !== 'string' || !ISO_DATE_PATTERN.test(parsed.completedAt)) {
      throw new Error('Invalid cursor: completedAt must be an ISO date string');
    }

    if (typeof parsed.participantId !== 'string' || !UUID_PATTERN.test(parsed.participantId)) {
      throw new Error('Invalid cursor: participantId must be a UUID');
    }

    return {
      completedAt: parsed.completedAt,
      participantId: parsed.participantId,
    };
  }
}
