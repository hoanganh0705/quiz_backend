import { decodeBase64JsonCursor, encodeBase64JsonCursor } from '@/common/utils/cursor.util';
import type { CategoryRow } from '../domain/ports/category-repository.port';
import type { CategoryCursorPayload } from '../types/category.types';

export class CategoryCursorMapper {
  private static readonly categoryIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static parse(cursor: string): CategoryCursorPayload {
    const parsed = decodeBase64JsonCursor<CategoryCursorPayload>(cursor);

    if (
      !this.isIsoDateString(parsed.createdAt) ||
      !this.isStringMatchingPattern(parsed.categoryId, this.categoryIdPattern)
    ) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt: parsed.createdAt,
      categoryId: parsed.categoryId ?? '',
    };
  }

  static serialize(category: Pick<CategoryRow, 'createdAt' | 'categoryId'>): string {
    return encodeBase64JsonCursor({
      createdAt: category.createdAt,
      categoryId: category.categoryId,
    });
  }

  private static isStringMatchingPattern(value: unknown, pattern: RegExp): boolean {
    return typeof value === 'string' && pattern.test(value);
  }

  private static isIsoDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}
