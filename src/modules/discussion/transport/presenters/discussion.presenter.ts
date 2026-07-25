import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { CommentDto } from '../../dto/response/comment-response.dto';
import type { DiscussionSavedThreadActionResponseDto } from '../../dto/response/discussion-saved-thread-action-response.dto';
import type { DiscussionSubscriptionActionResponseDto } from '../../dto/response/discussion-subscription-action-response.dto';
import type {
  DiscussionThreadSolveResponseDto,
  DiscussionThreadUnsolveResponseDto,
} from '../../dto/response/discussion-thread-solve-response.dto';
import type { MyDiscussionStatsResponseDto } from '../../dto/response/my-discussion-stats-response.dto';
import type { PublicDiscussionProfileResponseDto } from '../../dto/response/public-discussion-profile-response.dto';
import type { ThreadDto } from '../../dto/response/thread-response.dto';
import type { ThreadStatsResponseDto } from '../../dto/response/thread-stats-response.dto';
import type { RelatedDiscussionItemResponseDto } from '../../dto/response/related-discussions-response.dto';
import type { ThreadParticipantItemResponseDto } from '../../dto/response/thread-participants-response.dto';
import type {
  DiscussionThread,
  DiscussionCommentWithReplies,
  DiscussionReport,
} from '../../domain/types';

/**
 * Wrap a `{ items: T[], pagination: { limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * This is the canonical shape produced by the response envelope, so it is the
 * shape we emit explicitly from every paginated endpoint instead of relying on
 * the interceptor's shape-heuristic.
 */
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => ({
  data: [...payload.items],
  meta: {
    timestamp: new Date().toISOString(),
    pagination: {
      kind: 'cursor' as const,
      limit: payload.pagination.limit,
      hasNextPage: payload.pagination.hasNextPage,
      nextCursor: payload.pagination.nextCursor,
    },
  },
});

/**
 * Presenter for the discussion module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Endpoints that return 204 No Content (close / reopen / hide / restore / vote /
 * report / review / delete) bypass the presenter entirely.
 */
@Injectable()
export class DiscussionPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Thread-level endpoints
  readonly listThreads = (payload: PaginatedResult<DiscussionThread>) =>
    ApiResponse.page(payload.items, payload.pagination);
  readonly createThread = DiscussionPresenter.ok<ThreadDto>;
  readonly getThread = DiscussionPresenter.ok<ThreadDto | null>;
  readonly updateThread = DiscussionPresenter.ok<ThreadDto>;
  readonly markThreadAsSolved = DiscussionPresenter.ok<DiscussionThreadSolveResponseDto>;
  readonly unsolveThread = DiscussionPresenter.ok<DiscussionThreadUnsolveResponseDto>;

  // Comments
  readonly createComment = DiscussionPresenter.ok<CommentDto>;
  readonly listComments = (payload: PaginatedResult<DiscussionCommentWithReplies>) =>
    ApiResponse.page(payload.items, payload.pagination);
  readonly getComment = DiscussionPresenter.ok<CommentDto | null>;
  readonly updateComment = DiscussionPresenter.ok<CommentDto>;

  // Subscriptions / saves
  readonly subscribeToThread = DiscussionPresenter.ok<DiscussionSubscriptionActionResponseDto>;
  readonly unsubscribeFromThread = DiscussionPresenter.ok<DiscussionSubscriptionActionResponseDto>;
  readonly saveThread = DiscussionPresenter.ok<DiscussionSavedThreadActionResponseDto>;
  readonly unsaveThread = DiscussionPresenter.ok<DiscussionSavedThreadActionResponseDto>;

  // Curated discussion lists (paginated response DTOs)
  readonly listTrendingDiscussions = wrapPaginatedDto;
  readonly listUnansweredDiscussions = wrapPaginatedDto;
  readonly searchDiscussions = wrapPaginatedDto;
  // Phase 7 (api-contract audit): these endpoints emit bounded bare
  // arrays and the controllers declare `ApiOkResourceArray` (not
  // paginated). The presenter must preserve that shape so the wire
  // contract matches the documented schema.
  readonly listRelatedDiscussions = (items: readonly RelatedDiscussionItemResponseDto[]) =>
    ApiResponse.ok([...items]);
  readonly listThreadParticipants = (items: readonly ThreadParticipantItemResponseDto[]) =>
    ApiResponse.ok([...items]);
  readonly getThreadStats = DiscussionPresenter.ok<ThreadStatsResponseDto | null>;
  readonly getMyDiscussionStats = DiscussionPresenter.ok<MyDiscussionStatsResponseDto>;

  // Quiz-anchored
  readonly listQuizDiscussions = wrapPaginatedDto;

  // User-anchored
  readonly listMyDiscussions = wrapPaginatedDto;
  readonly listDiscussionsByUser = wrapPaginatedDto;
  readonly listMyComments = wrapPaginatedDto;
  readonly listCommentsByUser = wrapPaginatedDto;
  readonly listMyUpvotedThreads = wrapPaginatedDto;
  readonly listMyUpvotedComments = wrapPaginatedDto;
  readonly listMyDiscussionSubscriptions = wrapPaginatedDto;
  readonly listMySavedThreads = wrapPaginatedDto;
  readonly getPublicDiscussionProfile = DiscussionPresenter.ok<PublicDiscussionProfileResponseDto>;

  // Reports (moderator-only)
  readonly listReports = (payload: PaginatedResult<DiscussionReport>) =>
    ApiResponse.page(payload.items, payload.pagination);
}
