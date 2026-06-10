import type { ReviewCursor, ReportCursor } from '../domain/ports';

export interface CursorItem {
  createdAt: string;
  [key: string]: unknown;
}

export interface PaginationResult<T extends CursorItem> {
  items: T[];
  limit: number;
  hasNextPage: boolean;
  nextCursor: { createdAt: string; [key: string]: string } | null;
}

export function buildPagination<T extends CursorItem>(
  rows: T[],
  limit: number,
  cursorKey: keyof T,
): PaginationResult<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1) as T | undefined;

  return {
    items,
    limit,
    hasNextPage,
    nextCursor:
      hasNextPage && lastItem
        ? { createdAt: lastItem.createdAt, [cursorKey]: String(lastItem[cursorKey]) }
        : null,
  };
}
