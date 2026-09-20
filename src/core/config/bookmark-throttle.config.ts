export const BOOKMARK_THROTTLE_VALUES = {
  createCollection: { limit: 5, ttl: 60_000 },
  updateCollection: { limit: 10, ttl: 60_000 },
  deleteCollection: { limit: 5, ttl: 60_000 },
  addBookmark: { limit: 30, ttl: 60_000 },
  bulkAddBookmarks: { limit: 10, ttl: 60_000 },
  bulkRemoveBookmarks: { limit: 10, ttl: 60_000 },
  removeBookmark: { limit: 30, ttl: 60_000 },
  updateBookmark: { limit: 30, ttl: 60_000 },
  moveBookmark: { limit: 10, ttl: 60_000 },
  searchBookmarks: { limit: 60, ttl: 60_000 },
  getRecentBookmarks: { limit: 60, ttl: 60_000 },
  getBookmarkStatus: { limit: 120, ttl: 60_000 },
  listCollections: { limit: 60, ttl: 60_000 },
  listBookmarksInCollection: { limit: 60, ttl: 60_000 },
  getCollectionAnalytics: { limit: 60, ttl: 60_000 },
  getMyBookmarkStats: { limit: 30, ttl: 60_000 },
} as const;

export type BookmarkThrottleConfig = typeof BOOKMARK_THROTTLE_VALUES;
