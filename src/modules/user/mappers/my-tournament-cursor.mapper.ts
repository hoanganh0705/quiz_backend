import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export class MyTournamentCursorMapper {
  static serialize(this: void, cursor: { registeredAt: string; participantId: string }): string {
    return encodeBase64JsonCursor(cursor);
  }

  static parse(cursor: string): { registeredAt: string; participantId: string } {
    const parsed = decodeBase64JsonCursor<{ registeredAt: string; participantId: string }>(cursor);

    if (typeof parsed.registeredAt !== 'string' || !ISO_DATE_PATTERN.test(parsed.registeredAt)) {
      throw new BadRequestException('Invalid cursor: registeredAt must be an ISO date string');
    }

    if (typeof parsed.participantId !== 'string' || !UUID_PATTERN.test(parsed.participantId)) {
      throw new BadRequestException('Invalid cursor: participantId must be a UUIDv7');
    }

    return {
      registeredAt: parsed.registeredAt,
      participantId: parsed.participantId,
    };
  }
}
