import { encodeBase64JsonCursor } from '@/common/utils/cursor.util';

export interface CursorSlicedPage<T> {
  items: T[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export const CURSOR_LIMIT_FETCH_OVERHEAD = 1;

export function sliceWithCursor<T>(
  rows: T[],
  limit: number,
  encodeCursor: (lastItem: T) => string,
): CursorSlicedPage<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor = hasNextPage && lastItem ? encodeCursor(lastItem) : null;
  return { items, hasNextPage, nextCursor };
}

export { encodeBase64JsonCursor };

export const encodeFollowCursor = (payload: { followedAt: string; followId: string }): string =>
  encodeBase64JsonCursor(payload);

export const encodeUsernameCursor = (payload: { username: string }): string =>
  encodeBase64JsonCursor(payload);
