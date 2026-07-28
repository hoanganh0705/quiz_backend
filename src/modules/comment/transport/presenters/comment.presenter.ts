/**
 * Comment Presenter
 *
 * Wraps every application-service response in the canonical
 * `{ data, meta.timestamp }` envelope (or `{ data: T[], meta.pagination }`
 * for paginated lists). One method per controller endpoint keeps
 * `git grep presenter.<name>` a reliable index of which controllers
 * have been migrated.
 *
 * Endpoints that return 204 No Content (delete / vote / remove-vote /
 * report / hide / restore / review) bypass the presenter entirely.
 */

import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { CommentDto, CommentWithRepliesDto } from '../../dto/response/comment.dto';
import type { ModerationResultDto } from '../../dto/response/moderation-result.dto';
import type { MyCommentDto } from '../../dto/response/my-comment.dto';
import type { ReportDto } from '../../dto/response/report.dto';
import type {
  CommentView,
  CommentWithRepliesView,
  MyCommentView,
  ReportView,
} from '../../domain/types';
import {
  toCommentDto,
  toCommentWithRepliesDto,
  toMyCommentDto,
  toReportDto,
} from './comment-mappers';

const wrapPaginated = <T>(payload: {
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

@Injectable()
export class CommentPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // ─── Single-resource responses ───────────────────────────────────────────
  readonly getComment = (view: CommentView | null): ApiResponseEnvelope<CommentDto | null> =>
    ApiResponse.ok(view ? toCommentDto(view) : null);
  readonly createComment = (view: CommentView): ApiResponseEnvelope<CommentDto> =>
    ApiResponse.ok(toCommentDto(view));
  readonly editComment = (view: CommentView): ApiResponseEnvelope<CommentDto> =>
    ApiResponse.ok(toCommentDto(view));
  readonly createReport = (view: ReportView): ApiResponseEnvelope<ReportDto> =>
    ApiResponse.created(toReportDto(view));
  readonly reviewReport = (view: ReportView): ApiResponseEnvelope<ReportDto> =>
    ApiResponse.ok(toReportDto(view));

  readonly hideComment = (result: ModerationResultDto): ApiResponseEnvelope<ModerationResultDto> =>
    ApiResponse.ok(result);

  readonly restoreComment = (
    result: ModerationResultDto,
  ): ApiResponseEnvelope<ModerationResultDto> => ApiResponse.ok(result);

  // ─── Paginated lists ─────────────────────────────────────────────────────
  readonly listQuizComments = (payload: {
    items: readonly CommentWithRepliesView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }): ApiResponseEnvelope<CommentWithRepliesDto[]> =>
    wrapPaginated<CommentWithRepliesDto>({
      items: payload.items.map(toCommentWithRepliesDto),
      pagination: payload.pagination,
    });

  readonly listMyComments = (payload: {
    items: readonly MyCommentView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }): ApiResponseEnvelope<MyCommentDto[]> =>
    wrapPaginated<MyCommentDto>({
      items: payload.items.map(toMyCommentDto),
      pagination: payload.pagination,
    });

  readonly listUserComments = (payload: {
    items: readonly MyCommentView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }): ApiResponseEnvelope<MyCommentDto[]> =>
    wrapPaginated<MyCommentDto>({
      items: payload.items.map(toMyCommentDto),
      pagination: payload.pagination,
    });

  readonly listReports = (payload: {
    items: readonly ReportView[];
    pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
  }): ApiResponseEnvelope<ReportDto[]> =>
    wrapPaginated<ReportDto>({
      items: payload.items.map(toReportDto),
      pagination: payload.pagination,
    });
}
