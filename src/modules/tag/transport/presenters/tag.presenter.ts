import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { DeleteTagResponseDto } from '../../dto/response/delete-tag-response.dto';
import type {
  FollowedTagsResponseDto,
  RankedTagResponseDto,
  TagAnalyticsResponseDto,
  TagFollowMessageResponseDto,
} from '../../dto/response/parity-response.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { TagListResponseDto } from '../../dto/response/tag-list-response.dto';
import type { TagResponseDto } from '../../dto/response/tag-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, nextCursor, hasNextPage } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for cursor-paginated list endpoints whose application-service return is
 * a class-instance `{ items, pagination }` DTO. The canonical envelope has to
 * be a plain object (the interceptor's `isFormattedResponse()` guards on
 * `Object` prototype), so we deliberately project out the DTO fields here
 * instead of forwarding the class instance for the interceptor to re-wrap.
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
 * Presenter for the tag module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * The popular/trending/related endpoints unwrap their `{ items }` DTO to a
 * bare array — see the quiz module for the same convention.
 */
@Injectable()
export class TagPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getTagBySlug = TagPresenter.ok<TagResponseDto>;
  readonly getTagAnalytics = TagPresenter.ok<TagAnalyticsResponseDto>;
  readonly createTag = TagPresenter.ok<TagResponseDto>;
  readonly updateTag = TagPresenter.ok<TagResponseDto>;
  readonly restoreTag = TagPresenter.ok<TagResponseDto>;
  readonly followTag = TagPresenter.ok<TagFollowMessageResponseDto>;
  readonly unfollowTag = TagPresenter.ok<TagFollowMessageResponseDto>;
  readonly deleteTag = TagPresenter.ok<DeleteTagResponseDto>;
  readonly getTagQuizzes = TagPresenter.ok<QuizListResponseDto>;

  // Cursor-paginated lists — `{ items, pagination }` unwrapped.
  readonly listTags = wrapPaginatedDto<TagListResponseDto['items'][number]>;
  readonly listFollowedTags = wrapPaginatedDto<FollowedTagsResponseDto['items'][number]>;

  // Bare-array endpoints — `{ items }` unwrapped to a flat list.
  readonly getPopularTags = (items: RankedTagResponseDto[]) => ApiResponse.ok([...items]);
  readonly getTrendingTags = (items: RankedTagResponseDto[]) => ApiResponse.ok([...items]);
  readonly getRelatedTags = (items: TagResponseDto[]) => ApiResponse.ok([...items]);
}
