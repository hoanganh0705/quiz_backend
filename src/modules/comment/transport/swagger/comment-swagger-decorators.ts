import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam as ApiParamCore,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { CommentDto, CommentWithRepliesDto } from '../../dto/response/comment.dto';
import { MyCommentDto } from '../../dto/response/my-comment.dto';
import { ReportDto } from '../../dto/response/report.dto';

import {
  // Success
  COMMENT_CREATED_EXAMPLE,
  COMMENT_DETAIL_EXAMPLE,
  COMMENT_REPORT_CREATED_EXAMPLE,
  COMMENT_REPORT_REVIEWED_EXAMPLE,
  COMMENT_REPORTS_LIST_EXAMPLE,
  COMMENT_UPDATED_EXAMPLE,
  MY_COMMENTS_LIST_EXAMPLE,
  QUIZ_COMMENTS_LIST_EXAMPLE,
  USER_COMMENTS_LIST_EXAMPLE,
  // Errors
  createCommentBadRequestExample,
  createCommentInternalErrorExample,
  createCommentParentCrossThreadExample,
  createCommentParentNotFoundExample,
  createCommentQuizNotFoundExample,
  createCommentReplyLimitExample,
  createCommentTooManyRequestsExample,
  createCommentUnauthorizedExample,
  deleteCommentForbiddenExample,
  deleteCommentInternalErrorExample,
  deleteCommentNotFoundExample,
  deleteCommentUnauthorizedExample,
  editCommentBadRequestExample,
  editCommentForbiddenExample,
  editCommentInternalErrorExample,
  editCommentNotFoundExample,
  editCommentUnauthorizedExample,
  getCommentBadRequestExample,
  getCommentInternalErrorExample,
  getCommentNotFoundExample,
  hideCommentInternalErrorExample,
  hideCommentModeratorRequiredExample,
  hideCommentNotFoundExample,
  hideCommentUnauthorizedExample,
  listMyCommentsBadRequestExample,
  listMyCommentsInternalErrorExample,
  listMyCommentsUnauthorizedExample,
  listQuizCommentsBadRequestExample,
  listQuizCommentsInternalErrorExample,
  listReportsBadRequestExample,
  listReportsForbiddenExample,
  listReportsInternalErrorExample,
  listReportsUnauthorizedExample,
  listUserCommentsBadRequestExample,
  listUserCommentsInternalErrorExample,
  removeVoteBadRequestExample,
  removeVoteInternalErrorExample,
  removeVoteNotFoundExample,
  removeVoteUnauthorizedExample,
  reportCommentBadRequestExample,
  reportCommentDuplicateExample,
  reportCommentInternalErrorExample,
  reportCommentNotFoundExample,
  reportCommentSelfReportExample,
  reportCommentTooManyRequestsExample,
  reportCommentUnauthorizedExample,
  restoreCommentInternalErrorExample,
  restoreCommentModeratorRequiredExample,
  restoreCommentNotFoundExample,
  restoreCommentUnauthorizedExample,
  reviewReportBadRequestExample,
  reviewReportForbiddenExample,
  reviewReportInternalErrorExample,
  reviewReportNotFoundExample,
  reviewReportUnauthorizedExample,
  voteBadRequestExample,
  voteInternalErrorExample,
  voteNotFoundExample,
  voteSelfVoteExample,
  voteUnauthorizedExample,
} from './examples';

// ─── Shared problem helpers ──────────────────────────────────────────────────
//
// Each helper returns an options object that includes both a typed
// `ProblemDetailDto` schema (so generated SDKs see real fields) and a
// concrete example (so docs UI shows what the runtime payload looks like).

const problem = {
  badRequest: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Request body, query, or path parameters failed validation',
    type: ProblemDetailDto,
    example,
  }),
  unauthorized: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Missing or invalid authentication token',
    type: ProblemDetailDto,
    example,
  }),
  forbidden: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Authenticated user lacks the required permission',
    type: ProblemDetailDto,
    example,
  }),
  notFound: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'The requested resource does not exist or has been deleted',
    type: ProblemDetailDto,
    example,
  }),
  conflict: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'The request conflicts with the current state of the resource',
    type: ProblemDetailDto,
    example,
  }),
  tooManyRequests: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Rate limit exceeded. Please try again later',
    type: ProblemDetailDto,
    example,
  }),
  internalError: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Unexpected server error',
    type: ProblemDetailDto,
    example,
  }),
};

// ─── Resource response helpers ──────────────────────────────────────────────
//
// Thin wrappers over the common envelope composers (`ApiOkResource`,
// `ApiOkResourceList`, `ApiCreatedResource`) so the per-endpoint decorators
// below stay declarative. The cast through `unknown` is the same escape
// hatch used by `review-swagger-decorators.ts`.

const resourceOk = <T>(
  model: new () => T,
  description: string,
  example?: unknown,
): MethodDecorator =>
  ApiOkResource(
    model as new () => unknown as Parameters<typeof ApiOkResource>[0],
    {
      description,
      example,
    } as ApiResponseOptions,
  );

const resourceCreated = <T>(
  model: new () => T,
  description: string,
  example?: unknown,
): MethodDecorator =>
  ApiCreatedResource(
    model as new () => unknown as Parameters<typeof ApiCreatedResource>[0],
    {
      description,
      example,
    } as ApiResponseOptions,
  );

const resourceList = <T>(
  model: new () => T,
  kind: 'cursor' | 'offset',
  description: string,
  example?: unknown,
): MethodDecorator =>
  ApiOkResourceList(model as new () => unknown as Parameters<typeof ApiOkResourceList>[0], kind, {
    description,
    example,
  });

// ─── Bearer auth + 401 helper ───────────────────────────────────────────────

const authThen = (next: MethodDecorator): MethodDecorator =>
  applyDecorators(ApiBearerAuth(AUTH_SECURITY_NAME), next);

// ─── GET /quizzes/:quizId/comments ──────────────────────────────────────────

export const ApiListQuizCommentsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(
      CommentWithRepliesDto,
      'cursor',
      'Quiz comments returned',
      QUIZ_COMMENTS_LIST_EXAMPLE,
    ),
    ApiOperation({
      summary: 'List comments for a quiz',
      description:
        'Returns a cursor-paginated list of top-level comments on a quiz. The ' +
        'first page of replies is inlined on each top-level comment when the ' +
        "viewer is authenticated, and the requester's vote is projected as " +
        "`userVote`. This endpoint is public; the viewer's vote is `null` " +
        'for unauthenticated requests.',
    }),
    ApiUuidParam('quizId'),
    ApiBadRequestResponse(problem.badRequest(listQuizCommentsBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(listQuizCommentsInternalErrorExample)),
  );

// ─── POST /quizzes/:quizId/comments ─────────────────────────────────────────

export const ApiCreateCommentResponses = (): MethodDecorator =>
  applyDecorators(
    resourceCreated(CommentDto, 'Comment created', COMMENT_CREATED_EXAMPLE),
    ApiOperation({
      summary: 'Create a top-level comment or reply on a quiz',
      description:
        'Creates a top-level comment when `parentCommentId` is omitted, or a ' +
        'reply when `parentCommentId` references a top-level comment on the ' +
        'same quiz. Replies to replies are rejected with `COMMENT_PARENT_COMMENT_CROSS_THREAD`.',
    }),
    ApiBadRequestResponse(problem.badRequest(createCommentBadRequestExample)),
    ApiBadRequestResponse(
      problem.badRequest(
        createCommentParentCrossThreadExample,
        'The parent comment is invalid (cross-thread or itself a reply)',
      ),
    ),
    ApiUnauthorizedResponse(problem.unauthorized(createCommentUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(createCommentQuizNotFoundExample, 'Quiz not found')),
    ApiNotFoundResponse(
      problem.notFound(createCommentParentNotFoundExample, 'Parent comment not found'),
    ),
    ApiConflictResponse(
      problem.conflict(
        createCommentReplyLimitExample,
        'Reply limit reached for the parent comment',
      ),
    ),
    ApiTooManyRequestsResponse(
      problem.tooManyRequests(
        createCommentTooManyRequestsExample,
        'You can create at most 20 comments per minute',
      ),
    ),
    ApiInternalServerErrorResponse(problem.internalError(createCommentInternalErrorExample)),
  );

// ─── GET /comments/:commentId ───────────────────────────────────────────────

export const ApiGetCommentResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(CommentDto, 'Comment returned', COMMENT_DETAIL_EXAMPLE),
    ApiOperation({
      summary: 'Get a comment by id',
      description:
        'Returns the comment when it exists and is not soft-deleted. Throws ' +
        '`CommentNotFoundError` (404) for hidden or deleted comments.',
    }),
    ApiBadRequestResponse(
      problem.badRequest(getCommentBadRequestExample, '`commentId` must be a UUID'),
    ),
    ApiNotFoundResponse(problem.notFound(getCommentNotFoundExample, 'Comment not found')),
    ApiInternalServerErrorResponse(problem.internalError(getCommentInternalErrorExample)),
  );

// ─── PATCH /comments/:commentId ─────────────────────────────────────────────

export const ApiEditCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        resourceOk(CommentDto, 'Comment updated', COMMENT_UPDATED_EXAMPLE),
        ApiOperation({
          summary: 'Edit a comment you authored',
          description:
            'Replaces the body of a comment you authored. Returns 403 ' +
            '`COMMENT_FORBIDDEN` when the caller is not the author.',
        }),
        ApiBadRequestResponse(
          problem.badRequest(editCommentBadRequestExample, 'Request body validation failed'),
        ),
        ApiUnauthorizedResponse(problem.unauthorized(editCommentUnauthorizedExample)),
        ApiForbiddenResponse(problem.forbidden(editCommentForbiddenExample)),
        ApiNotFoundResponse(problem.notFound(editCommentNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(editCommentInternalErrorExample)),
      ),
    ),
  );

// ─── DELETE /comments/:commentId ────────────────────────────────────────────

export const ApiDeleteCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        ApiNoContentResponse({ description: 'Comment soft-deleted' }),
        ApiOperation({
          summary: 'Soft-delete a comment you authored',
          description:
            'Sets `deletedAt` on a comment you authored. The row is preserved ' +
            'for moderator audit; subsequent reads return 404 `CommentNotFoundError`.',
        }),
        ApiUnauthorizedResponse(problem.unauthorized(deleteCommentUnauthorizedExample)),
        ApiForbiddenResponse(problem.forbidden(deleteCommentForbiddenExample)),
        ApiNotFoundResponse(problem.notFound(deleteCommentNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(deleteCommentInternalErrorExample)),
      ),
    ),
  );

// ─── PUT /comments/:commentId/vote ──────────────────────────────────────────

export const ApiVoteCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        ApiNoContentResponse({ description: 'Vote recorded' }),
        ApiOperation({
          summary: 'Cast, change, or flip your vote on a comment',
          description:
            'Idempotent. Replaying the same value removes the vote. Posting ' +
            'the opposite value flips the tally without a separate remove call.',
        }),
        ApiBadRequestResponse(
          problem.badRequest(voteBadRequestExample, '`value` must be `upvote` or `downvote`'),
        ),
        ApiUnauthorizedResponse(problem.unauthorized(voteUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(voteSelfVoteExample, 'You cannot vote on your own comment'),
        ),
        ApiNotFoundResponse(problem.notFound(voteNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(voteInternalErrorExample)),
      ),
    ),
  );

// ─── DELETE /comments/:commentId/vote ───────────────────────────────────────

export const ApiRemoveVoteResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        ApiNoContentResponse({ description: 'Vote removed' }),
        ApiOperation({ summary: 'Remove your vote from a comment' }),
        ApiBadRequestResponse(
          problem.badRequest(removeVoteBadRequestExample, '`commentId` must be a UUID'),
        ),
        ApiUnauthorizedResponse(problem.unauthorized(removeVoteUnauthorizedExample)),
        ApiNotFoundResponse(problem.notFound(removeVoteNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(removeVoteInternalErrorExample)),
      ),
    ),
  );

// ─── POST /comments/:commentId/reports ──────────────────────────────────────

export const ApiReportCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        resourceCreated(ReportDto, 'Report opened', COMMENT_REPORT_CREATED_EXAMPLE),
        ApiOperation({
          summary: 'Report a comment to moderators',
          description:
            'Throttled at 5 requests per minute per IP. Returns 409 ' +
            '`COMMENT_DUPLICATE_REPORT` when you already have an open report ' +
            'against the same comment, and 403 `COMMENT_SELF_REPORT` if you ' +
            'are the author of the comment.',
        }),
        ApiBadRequestResponse(
          problem.badRequest(reportCommentBadRequestExample, 'Request body validation failed'),
        ),
        ApiUnauthorizedResponse(problem.unauthorized(reportCommentUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(reportCommentSelfReportExample, 'You cannot report your own comment'),
        ),
        ApiNotFoundResponse(problem.notFound(reportCommentNotFoundExample, 'Comment not found')),
        ApiConflictResponse(
          problem.conflict(reportCommentDuplicateExample, 'You have already reported this comment'),
        ),
        ApiTooManyRequestsResponse(problem.tooManyRequests(reportCommentTooManyRequestsExample)),
        ApiInternalServerErrorResponse(problem.internalError(reportCommentInternalErrorExample)),
      ),
    ),
  );

// ─── POST /comments/:commentId/hide  &  POST /comments/:commentId/restore ──

export const ApiHideCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        ApiNoContentResponse({ description: 'Comment hidden by moderator' }),
        ApiOperation({
          summary: 'Hide a comment as a moderator',
          description:
            'Sets `isHidden = true` and records `hiddenById` / `hiddenAt`. The ' +
            'comment remains in the database but disappears from public reads. ' +
            'Requires the `COMMENT_MODERATE` permission.',
        }),
        ApiUnauthorizedResponse(problem.unauthorized(hideCommentUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(
            hideCommentModeratorRequiredExample,
            'Moderator or admin role is required',
          ),
        ),
        ApiNotFoundResponse(problem.notFound(hideCommentNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(hideCommentInternalErrorExample)),
      ),
    ),
  );

export const ApiRestoreCommentResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        ApiNoContentResponse({ description: 'Comment restored by moderator' }),
        ApiOperation({
          summary: 'Restore a previously hidden comment',
          description:
            'Clears `isHidden`, `hiddenById`, and `hiddenAt`. Requires the ' +
            '`COMMENT_MODERATE` permission. No-op if the comment was not hidden.',
        }),
        ApiUnauthorizedResponse(problem.unauthorized(restoreCommentUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(
            restoreCommentModeratorRequiredExample,
            'Moderator or admin role is required',
          ),
        ),
        ApiNotFoundResponse(problem.notFound(restoreCommentNotFoundExample, 'Comment not found')),
        ApiInternalServerErrorResponse(problem.internalError(restoreCommentInternalErrorExample)),
      ),
    ),
  );

// ─── GET /comments/reports ──────────────────────────────────────────────────

export const ApiListCommentReportsResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        resourceList(ReportDto, 'cursor', 'Comment reports returned', COMMENT_REPORTS_LIST_EXAMPLE),
        ApiOperation({
          summary: 'List open and historical comment reports (moderator only)',
          description:
            'Cursor-paginated feed of reports. Use the `status` query parameter ' +
            'to narrow the feed to `open`, `reviewed`, `dismissed`, or ' +
            '`actioned` reports. Requires the `COMMENT_MODERATE` permission.',
        }),
        ApiUnauthorizedResponse(problem.unauthorized(listReportsUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(listReportsForbiddenExample, 'Moderator or admin role is required'),
        ),
        ApiBadRequestResponse(
          problem.badRequest(listReportsBadRequestExample, 'Query parameters failed validation'),
        ),
        ApiInternalServerErrorResponse(problem.internalError(listReportsInternalErrorExample)),
      ),
    ),
  );

// ─── POST /comments/reports/:reportId/review ────────────────────────────────

export const ApiReviewCommentReportResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        resourceOk(ReportDto, 'Report reviewed', COMMENT_REPORT_REVIEWED_EXAMPLE),
        ApiOperation({
          summary: 'Review and close a comment report (moderator only)',
          description:
            'Transitions a report from `open` to `reviewed`, `dismissed`, or ' +
            '`actioned`. Set `actionTaken = true` when the moderator also hid ' +
            'the underlying comment. Requires the `COMMENT_MODERATE` permission.',
        }),
        ApiBadRequestResponse(
          problem.badRequest(
            reviewReportBadRequestExample,
            '`status` must be `reviewed`, `dismissed`, or `actioned`',
          ),
        ),
        ApiUnauthorizedResponse(problem.unauthorized(reviewReportUnauthorizedExample)),
        ApiForbiddenResponse(
          problem.forbidden(reviewReportForbiddenExample, 'Moderator or admin role is required'),
        ),
        ApiNotFoundResponse(problem.notFound(reviewReportNotFoundExample, 'Report not found')),
        ApiInternalServerErrorResponse(problem.internalError(reviewReportInternalErrorExample)),
      ),
    ),
  );

// ─── GET /users/me/comments  &  GET /users/:userId/comments ─────────────────

export const ApiListMyCommentsResponses = (): MethodDecorator =>
  applyDecorators(
    authThen(
      applyDecorators(
        resourceList(
          MyCommentDto,
          'cursor',
          "Authenticated viewer's comment history returned",
          MY_COMMENTS_LIST_EXAMPLE,
        ),
        ApiOperation({
          summary: "List the authenticated viewer's comment history",
          description:
            'Cursor-paginated; the quiz title is denormalized into each ' +
            'item to make a profile page render in one round-trip.',
        }),
        ApiUnauthorizedResponse(problem.unauthorized(listMyCommentsUnauthorizedExample)),
        ApiBadRequestResponse(
          problem.badRequest(listMyCommentsBadRequestExample, 'Query parameters failed validation'),
        ),
        ApiInternalServerErrorResponse(problem.internalError(listMyCommentsInternalErrorExample)),
      ),
    ),
  );

export const ApiListUserCommentsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(
      MyCommentDto,
      'cursor',
      "User's public comment history returned",
      USER_COMMENTS_LIST_EXAMPLE,
    ),
    ApiOperation({
      summary: "List any user's public comment history",
      description:
        'Public endpoint. Hidden and soft-deleted comments are filtered ' +
        'out; only `isHidden = false` and `deletedAt IS NULL` rows are returned.',
    }),
    ApiBadRequestResponse(
      problem.badRequest(listUserCommentsBadRequestExample, 'Query parameters failed validation'),
    ),
    ApiInternalServerErrorResponse(problem.internalError(listUserCommentsInternalErrorExample)),
  );

// ─── Local helper ───────────────────────────────────────────────────────────
//
// `@ApiParam` from `@nestjs/swagger` is re-exported with a description so
// each controller stays free of inline Swagger imports. Each path-param
// UUID is documented as v7 to match the `ParseUUIDPipe({ version: '7' })`
// configuration on every controller route.

const ApiUuidParam = (name: 'quizId' | 'userId' | 'commentId' | 'reportId'): MethodDecorator =>
  ApiParamCore({
    name,
    required: true,
    description: `UUID v7 of the ${name.replace('Id', '')}`,
    schema: { type: 'string', format: 'uuid' },
  });
