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
import type { DeleteCollectionResponseDto } from '../../dto/response/collection-response.dto';
import type { MoveBookmarkResponseDto } from '../../dto/response/bookmark-message-response.dto';
import type { RecentBookmarksResponseDto } from '../../dto/response/recent-bookmarks-response.dto';
import type { RemoveBookmarkResponseDto } from '../../dto/response/bookmark-message-response.dto';
import type { SearchBookmarksResponseDto } from '../../dto/response/search-bookmarks-response.dto';
import type { UpdateBookmarkResponseDto } from '../../dto/response/update-bookmark-response.dto';
import type { UpdateCollectionResponseDto } from '../../dto/response/collection-response.dto';

/**
 * Presenter for the bookmark module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * Currently a thin pass-through to {@link ApiResponse.ok}. The layer exists
 * separately from the controller so future module-specific shaping (sensitive
 * field redaction, conditional fields, additional meta) has a stable seam.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 */
@Injectable()
export class BookmarkPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly searchBookmarks = BookmarkPresenter.ok<SearchBookmarksResponseDto>;
  readonly getRecentBookmarks = BookmarkPresenter.ok<RecentBookmarksResponseDto>;
  readonly getBookmarkStatus = BookmarkPresenter.ok<BookmarkStatusResponseDto>;
  readonly listCollections = BookmarkPresenter.ok<BookmarkCollectionListResponseDto>;
  readonly createCollection = BookmarkPresenter.ok<CreateCollectionResponseDto>;
  readonly listBookmarksInCollection = BookmarkPresenter.ok<BookmarkListResponseDto>;
  readonly getCollectionAnalytics = BookmarkPresenter.ok<BookmarkCollectionAnalyticsResponseDto>;
  readonly addBookmark = BookmarkPresenter.ok<AddBookmarkResponseDto>;
  readonly addBookmarksBulk = BookmarkPresenter.ok<BulkAddBookmarksResponseDto>;
  readonly removeBookmarksBulk = BookmarkPresenter.ok<BulkRemoveBookmarksResponseDto>;
  readonly removeBookmark = BookmarkPresenter.ok<RemoveBookmarkResponseDto>;
  readonly updateBookmark = BookmarkPresenter.ok<UpdateBookmarkResponseDto>;
  readonly moveBookmark = BookmarkPresenter.ok<MoveBookmarkResponseDto>;
  readonly updateCollection = BookmarkPresenter.ok<UpdateCollectionResponseDto>;
  readonly getMyBookmarkStats = BookmarkPresenter.ok<BookmarkStatsResponseDto>;
  readonly deleteCollection = BookmarkPresenter.ok<DeleteCollectionResponseDto>;
}
