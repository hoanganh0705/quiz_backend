import { BadRequestException } from '@nestjs/common';
import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import { isUuidV7Strict } from '@/common/utils/id-generator';

type UserActivityCursorPayload = {
  createdAt: string;
  eventId: string;
};

export class UserActivityCursorMapper {
  // Phase 7 (F-26): the local `isUuid` + UUID regex have been removed
  // in favour of the shared `isUuidV7Strict` from
  // `@/common/utils/id-generator`. The shared helper is the single
  // source of truth for the UUIDv7 shape (version=7 nibble + variant
  // bits) across the codebase. Future bug-fixes / version bumps now
  // only have to touch one place — the local copy here was a duplicate
  // of the same regex used by `report-cursor.mapper.ts`,
  // `review-cursor.mapper.ts`, and the tournament-history mapper.

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
