import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import { isUuidV7Strict } from '@/common/utils/id-generator';

type UserActivityCursorPayload = {
  createdAt: string;
  eventId: string;
};

export class UserActivityCursorMapper {
  static parse(cursor: string): UserActivityCursorPayload {
    const parsed = decodeBase64JsonCursor<UserActivityCursorPayload>(cursor);

    if (!isIsoDateString(parsed.createdAt) || !isUuidV7Strict(parsed.eventId)) {
      throw new BadRequestException('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      eventId: parsed.eventId,
    };
  }

  static serialize(this: void, payload: UserActivityCursorPayload): string {
    return encodeBase64JsonCursor({
      createdAt: payload.createdAt,
      eventId: payload.eventId,
    });
  }
}

const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
};
