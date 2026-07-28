import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { AddBookmarkResponseDto } from '../../dto/response/add-bookmark-response.dto';
import type { BookmarkCollectionAnalyticsResponseDto } from '../../dto/response/collection-analytics-response.dto';
import type { BookmarkCollectionListResponseDto } from '../../dto/response/bookmark-collection-response.dto';
import type { BookmarkListResponseDto } from '../../dto/response/bookmark-list-response.dto';
import type { BookmarkStatsResponseDto } from '../../dto/response/bookmark-stats-response.dto';
import type { BookmarkStatusResponseDto } from '../../dto/response/bookmark-status-response.dto';
import type { BulkAddBookmarksResponseDto } from '../../dto/response/bookmark-bulk-response.dto';
import type { BulkRemoveBookmarksResponseDto } from '../../dto/response/bookmark-bulk-response.dto';
import type { CreateCollectionResponseDto } from '../../dto/response/create-collection-response.dto';
import type { MessageResponseDto } from '../../dto/response/bookmark-message-response.dto';
import type { RecentBookmarkItemDto } from '../../dto/response/recent-bookmarks-response.dto';
import type { SearchBookmarkItemDto } from '../../dto/response/search-bookmarks-response.dto';
import type { UpdateBookmarkResponseDto } from '../../dto/response/update-bookmark-response.dto';
import type { UpdateCollectionResponseDto } from '../../dto/response/collection-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { kind, limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Mirrors `src/modules/tag/transport/presenters/tag.presenter.ts:wrapPaginatedDto`.
 * Used for the cursor-paginated search and recent-bookmarks endpoints whose
 * application-service return is a `{ items, pagination }` DTO. The canonical
 * envelope has to be a plain object (the interceptor's `isFormattedResponse()`
 * guards on `Object` prototype), so we deliberately project out the DTO
 * fields here instead of forwarding the class instance for the interceptor
 * to re-wrap.
 */
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { kind: 'cursor'; limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => {
  return {
    data: [...payload.items] as T[],
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        kind: 'cursor' as const,
        limit: payload.pagination.limit,
        hasNextPage: payload.pagination.hasNextPage,
        nextCursor: payload.pagination.nextCursor,
      },
    },
  };
};

/**
 * Presenter for the bookmark module. Wraps every application-service response
 * in the canonical `{ data, meta }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 */
@Injectable()
export class BookmarkPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Cursor-paginated lists — `{ items, pagination }` unwrapped to
  // `{ data: T[], meta: { timestamp, pagination: { kind: 'cursor', ... } } }`.
  readonly searchBookmarks = wrapPaginatedDto<SearchBookmarkItemDto>;
  readonly getRecentBookmarks = wrapPaginatedDto<RecentBookmarkItemDto>;

  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getBookmarkStatus = BookmarkPresenter.ok<BookmarkStatusResponseDto>;
  // Phase 7 (api-contract audit): the OpenAPI documents these endpoints
  // with a single-resource envelope `{ data: { items: [...] }, meta }`
  // because the lists are bounded by the user-owned resource count.
  // The presenter must emit the wrapper, not a bare array, so the
  // runtime matches the documented wire shape.
  readonly listCollections = BookmarkPresenter.ok<BookmarkCollectionListResponseDto>;
  readonly createCollection = BookmarkPresenter.ok<CreateCollectionResponseDto>;
  readonly listBookmarksInCollection = BookmarkPresenter.ok<BookmarkListResponseDto>;
  readonly getCollectionAnalytics = BookmarkPresenter.ok<BookmarkCollectionAnalyticsResponseDto>;
  readonly addBookmark = BookmarkPresenter.ok<AddBookmarkResponseDto>;
  readonly addBookmarksBulk = BookmarkPresenter.ok<BulkAddBookmarksResponseDto>;
  readonly removeBookmarksBulk = BookmarkPresenter.ok<BulkRemoveBookmarksResponseDto>;
  readonly updateBookmark = BookmarkPresenter.ok<UpdateBookmarkResponseDto>;
  readonly moveBookmark = BookmarkPresenter.ok<MessageResponseDto>;
  readonly updateCollection = BookmarkPresenter.ok<UpdateCollectionResponseDto>;
  readonly getMyBookmarkStats = BookmarkPresenter.ok<BookmarkStatsResponseDto>;
}
