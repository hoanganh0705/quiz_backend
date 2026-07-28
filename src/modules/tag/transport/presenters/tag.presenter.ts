import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginationMeta } from '@/common/responses/pagination';
import type { DeleteTagResponseDto } from '../../dto/response/delete-tag-response.dto';
import type {
  FollowedTagsResponseDto,
  RankedTagResponseDto,
  TagAnalyticsResponseDto,
} from '../../dto/response/parity-response.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { TagListResponseDto } from '../../dto/response/tag-list-response.dto';
import type { TagResponseDto } from '../../dto/response/tag-response.dto';

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
  readonly getTagById = TagPresenter.ok<TagResponseDto>;
  readonly getTagBySlug = TagPresenter.ok<TagResponseDto>;
  readonly getTagAnalytics = TagPresenter.ok<TagAnalyticsResponseDto>;
  readonly createTag = TagPresenter.ok<TagResponseDto>;
  readonly updateTag = TagPresenter.ok<TagResponseDto>;
  readonly restoreTag = TagPresenter.ok<TagResponseDto>;
  readonly deleteTag = TagPresenter.ok<DeleteTagResponseDto>;

  // Cursor-paginated lists.
  readonly getTagQuizzes = (payload: QuizListResponseDto) =>
    ApiResponse.page(payload.items, payload.pagination as PaginationMeta);

  readonly listTags = (payload: TagListResponseDto) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly listFollowedTags = (payload: FollowedTagsResponseDto) =>
    ApiResponse.page(payload.items, payload.pagination);

  // Bare-array endpoints — `{ items }` unwrapped to a flat list.
  readonly getPopularTags = (items: RankedTagResponseDto[]) => ApiResponse.ok([...items]);
  readonly getTrendingTags = (items: RankedTagResponseDto[]) => ApiResponse.ok([...items]);
  readonly getRelatedTags = (items: TagResponseDto[]) => ApiResponse.ok([...items]);
}
