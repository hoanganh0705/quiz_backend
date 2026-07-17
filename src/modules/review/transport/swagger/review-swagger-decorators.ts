import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ApiResponseOptions } from '@nestjs/swagger';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';

// Request DTOs
// Note: These DTOs are exported for type usage but not directly used in decorators
// The decorators use ApiResponseOptions for documentation

// Response DTOs
import {
  CreateReviewResponseDto,
  DeleteReviewResponseDto,
  HelpfulReviewResponseDto,
  MyReviewsResponseDto,
  PlatformReportsResponseDto,
  ReportReviewResponseDto,
  ReportedReviewsResponseDto,
  ReviewDashboardResponseDto,
  ReviewDetailResponseDto,
  ReviewListResponseDto,
  ReviewStatsResponseDto,
  UpdateReportStatusResponseDto,
  UpdateReviewResponseDto,
} from '../../dto/response';

// Success examples
import {
  ADMIN_REPORT_UPDATED_EXAMPLE,
  ADMIN_REPORTS_LIST_EXAMPLE,
  MY_REVIEW_FOR_QUIZ_EXAMPLE,
  MY_REVIEWS_LIST_EXAMPLE,
  REPORTED_REVIEWS_LIST_EXAMPLE,
  REVIEW_ANALYTICS_EXAMPLE,
  REVIEW_CREATED_EXAMPLE,
  REVIEW_DASHBOARD_EXAMPLE,
  REVIEW_DELETED_EXAMPLE,
  REVIEW_DETAIL_EXAMPLE,
  REVIEW_HELPFUL_EXAMPLE,
  REVIEW_HELPFUL_REMOVED_EXAMPLE,
  REVIEW_LIST_EXAMPLE,
  REVIEW_MY_FOR_QUIZ_EXAMPLE,
  REVIEW_REPORTED_EXAMPLE,
  REVIEW_STATS_EXAMPLE,
  REVIEW_UPDATED_EXAMPLE,
  USER_REVIEWS_LIST_EXAMPLE,
} from './examples/review.examples';

// Error examples
import {
  quizNotFoundExample,
  reviewAlreadyReportedExample,
  reviewAttemptRequiredExample,
  reviewBadRequestExample,
  reviewConflictExample,
  reviewForbiddenAnalyticsExample,
  reviewForbiddenExample,
  reviewForbiddenPermissionExample,
  reviewInternalErrorExample,
  reviewNotFoundExample,
  reviewSelfVoteExample,
  reviewUnauthorizedExample,
} from './examples/errors.examples';

// ─── Shared problem helpers ──────────────────────────────────────────────

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
    description: description ?? 'Authenticated user lacks required role or permission',
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
  internalError: (example: object, description?: string): ApiResponseOptions => ({
    description: description ?? 'Unexpected server error',
    type: ProblemDetailDto,
    example,
  }),
};

// ─── Resource helpers ─────────────────────────────────────────────────

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
  } as ApiResponseOptions);

// ─── GET /reviews/me ─────────────────────────────────────────────────

export const ApiReviewDashboardResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(ReviewDashboardResponseDto, 'Review dashboard returned', REVIEW_DASHBOARD_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── POST /quizzes/:quizId/reviews ────────────────────────────────────

export const ApiCreateReviewResponses = (): MethodDecorator =>
  applyDecorators(
    resourceCreated(CreateReviewResponseDto, 'Review created', REVIEW_CREATED_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiBadRequestResponse(
      problem.badRequest(
        reviewAttemptRequiredExample,
        'You must complete at least one attempt before reviewing this quiz',
      ),
    ),
    ApiNotFoundResponse(problem.notFound(quizNotFoundExample, 'Quiz not found')),
    ApiConflictResponse(
      problem.conflict(reviewConflictExample, 'You have already reviewed this quiz'),
    ),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /quizzes/:quizId/reviews ─────────────────────────────────────

export const ApiListReviewsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(ReviewListResponseDto, 'cursor', 'Reviews returned', REVIEW_LIST_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /quizzes/:quizId/reviews/stats ───────────────────────────────

export const ApiQuizReviewStatsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(ReviewStatsResponseDto, 'Quiz review statistics returned', REVIEW_STATS_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(quizNotFoundExample, 'Quiz not found')),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /quizzes/:quizId/reviews/analytics ──────────────────────────

export const ApiCreatorQuizReviewAnalyticsResponses = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceOk(
      QuizAnalyticsResponseDto,
      'Quiz review analytics returned',
      REVIEW_ANALYTICS_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(reviewForbiddenAnalyticsExample)),
    ApiNotFoundResponse(problem.notFound(quizNotFoundExample, 'Quiz not found')),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /quizzes/:quizId/reviews/me ─────────────────────────────────

export const ApiMyQuizReviewResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(
      ReviewDetailResponseDto,
      'My review for the quiz. `data` is `null` when the user has not reviewed the quiz.',
      REVIEW_MY_FOR_QUIZ_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── PATCH /quizzes/:quizId/reviews ───────────────────────────────────

export const ApiUpdateReviewResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(UpdateReviewResponseDto, 'Review updated', REVIEW_UPDATED_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample, 'Review not found')),
    ApiForbiddenResponse(problem.forbidden(reviewForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── DELETE /quizzes/:quizId/reviews ─────────────────────────────────

export const ApiDeleteReviewResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(DeleteReviewResponseDto, 'Review deleted', REVIEW_DELETED_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample, 'Review not found')),
    ApiForbiddenResponse(problem.forbidden(reviewForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── POST /reviews/:reviewId/helpful ──────────────────────────────────

export const ApiMarkReviewHelpfulResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(HelpfulReviewResponseDto, 'Helpful vote recorded', REVIEW_HELPFUL_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiBadRequestResponse(
      problem.badRequest(reviewSelfVoteExample, 'You cannot vote on your own review'),
    ),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── DELETE /reviews/:reviewId/helpful ────────────────────────────────

export const ApiRemoveHelpfulVoteResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(HelpfulReviewResponseDto, 'Helpful vote removed', REVIEW_HELPFUL_REMOVED_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── POST /reviews/:reviewId/report ───────────────────────────────────

export const ApiReportReviewResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(ReportReviewResponseDto, 'Review reported successfully', REVIEW_REPORTED_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample)),
    ApiConflictResponse(
      problem.conflict(reviewAlreadyReportedExample, 'You have already reported this review'),
    ),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /reviews/:reviewId ──────────────────────────────────────────

export const ApiGetReviewByIdResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(ReviewDetailResponseDto, 'Review detail returned', REVIEW_DETAIL_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(reviewNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /users/me/reviews ─────────────────────────────────────────────

export const ApiListMyReviewsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(MyReviewsResponseDto, 'cursor', 'My reviews returned', MY_REVIEWS_LIST_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /users/me/reported-reviews ──────────────────────────────────

export const ApiListMyReportedReviewsResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(
      ReportedReviewsResponseDto,
      'cursor',
      'Reported reviews returned',
      REPORTED_REVIEWS_LIST_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /users/me/reviews/:quizId ──────────────────────────────────

export const ApiGetMyReviewForQuizResponses = (): MethodDecorator =>
  applyDecorators(
    resourceOk(
      ReviewDetailResponseDto,
      'My review for the quiz. `data` is `null` when the user has not reviewed the quiz.',
      MY_REVIEW_FOR_QUIZ_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /users/:userId/reviews ───────────────────────────────────────

export const ApiListReviewsByUserResponses = (): MethodDecorator =>
  applyDecorators(
    resourceList(
      MyReviewsResponseDto,
      'cursor',
      'User reviews returned',
      USER_REVIEWS_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── GET /admin/reviews/reports ────────────────────────────────────────

export const ApiListPlatformReportsResponses = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceList(
      PlatformReportsResponseDto,
      'cursor',
      'Paginated list of platform-wide reports',
      ADMIN_REPORTS_LIST_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(reviewForbiddenPermissionExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── PATCH /admin/reviews/reports/:reportId ───────────────────────────

export const ApiUpdateReportStatusResponses = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceOk(
      UpdateReportStatusResponseDto,
      'Report status updated successfully',
      ADMIN_REPORT_UPDATED_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(reviewUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(reviewForbiddenPermissionExample)),
    ApiBadRequestResponse(problem.badRequest(reviewBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(reviewInternalErrorExample)),
  );

// ─── Path parameter decorators ──────────────────────────────────────────

export const ApiQuizIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'quizId',
    description: 'UUID of the quiz',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  });

export const ApiReviewIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'reviewId',
    description: 'UUID of the review',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  });

export const ApiUserIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'userId',
    description: 'UUID of the user',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  });

export const ApiReportIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'reportId',
    description: 'UUID of the report',
    format: 'uuid',
    example: '990e8400-e29b-41d4-a716-446655440001',
  });
