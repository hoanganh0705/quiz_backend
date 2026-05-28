import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import type { TagRow } from '../domain/ports/tag-repository.port';
import type { TagCursorPayload } from '../types/tag.types';

export class TagCursorMapper {
  private static readonly tagIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): TagCursorPayload {
    const parsed = decodeBase64JsonCursor<TagCursorPayload>(cursor);

    if (
      !this.isIsoDateString(parsed.createdAt) ||
      !this.isStringMatchingPattern(parsed.tagId, this.tagIdPattern)
    ) {
      throw new Error('Invalid cursor');
    }

    return { createdAt: parsed.createdAt, tagId: parsed.tagId ?? '' };
  }

  static serialize(tag: Pick<TagRow, 'createdAt' | 'tagId'>): string {
    return encodeBase64JsonCursor({ createdAt: tag.createdAt, tagId: tag.tagId });
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  private static isStringMatchingPattern(value: unknown, pattern: RegExp): boolean {
    return typeof value === 'string' && pattern.test(value);
  }
}
