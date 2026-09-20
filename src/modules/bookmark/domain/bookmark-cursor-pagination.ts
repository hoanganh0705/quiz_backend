import { and, type SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { bookmarkedQuizzes } from '@/core/database/schema';
import type { RecentBookmarkCursor } from './ports/bookmark-repository.port';

export const buildBookmarkCursorCondition = (
  cursor: RecentBookmarkCursor | null | undefined,
): SQL | undefined => {
  if (!cursor) {
    return undefined;
  }
  return and(
    sql`${bookmarkedQuizzes.bookmarkedAt} <= ${cursor.bookmarkedAt}`,
    sql`(
      ${bookmarkedQuizzes.bookmarkedAt} < ${cursor.bookmarkedAt}
      OR (
        ${bookmarkedQuizzes.bookmarkedAt} = ${cursor.bookmarkedAt}
        AND ${bookmarkedQuizzes.bookmarkId} < ${cursor.bookmarkId}
      )
    )`,
  );
};

export interface PaginatedCursorResult<T> {
  items: T[];
  hasNextPage: boolean;
  nextCursor: RecentBookmarkCursor | null;
}

export const sliceWithCursor = <T extends { bookmarkedAt: string; bookmarkId: string }>(
  rows: T[],
  limit: number,
): PaginatedCursorResult<T> => {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    hasNextPage,
    nextCursor:
      hasNextPage && lastItem
        ? { bookmarkedAt: lastItem.bookmarkedAt, bookmarkId: lastItem.bookmarkId }
        : null,
  };
};

export const escapeSqlLikePattern = (raw: string): string => {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
};

export const buildSafeSearchPattern = (raw: string): string => {
  const trimmed = raw.trim();
  const escaped = escapeSqlLikePattern(trimmed);
  return `%${escaped}%`;
};

export const SEARCH_MIN_LENGTH = 3;
export const SEARCH_MAX_LENGTH = 64;
