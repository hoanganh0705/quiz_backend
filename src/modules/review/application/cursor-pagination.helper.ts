export function sliceWithCursor<T extends { createdAt: string }>(
  rows: T[],
  limit: number,
  pickCursorKey: (row: T) => Record<string, string>,
): {
  items: T[];
  hasNextPage: boolean;
  nextCursor: Record<string, string> | null;
} {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    hasNextPage,
    nextCursor: hasNextPage && lastItem ? pickCursorKey(lastItem) : null,
  };
}
