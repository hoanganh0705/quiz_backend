import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto, ErrorResponseExamples } from './swagger-schemas';

// ─── Pre-configured response options ─────────────────────────────────────────────

const baseProblemDetail = (): ApiResponseOptions => ({
  type: ProblemDetailDto,
});

const unauthorizedOptions: ApiResponseOptions = {
  description: 'Missing or invalid authentication token',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.unauthorized,
    },
  },
};

const forbiddenOptions: ApiResponseOptions = {
  description: 'Authenticated user lacks required role or permission',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.forbidden,
    },
  },
};

const notFoundOptions: ApiResponseOptions = {
  description: 'The requested resource does not exist or has been deleted',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.notFound,
    },
  },
};

const badRequestOptions: ApiResponseOptions = {
  description: 'Request body, query, or params failed validation',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.badRequest,
    },
  },
};

const conflictOptions: ApiResponseOptions = {
  description: 'The request conflicts with the current state of the resource',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.conflict,
    },
  },
};

const tooManyRequestsOptions: ApiResponseOptions = {
  description: 'Rate limit exceeded',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.tooManyRequests,
    },
  },
};

const internalErrorOptions: ApiResponseOptions = {
  description: 'Unexpected server error',
  ...baseProblemDetail(),
  content: {
    'application/json': {
      example: ErrorResponseExamples.internalServerError,
    },
  },
};

// ─── Authentication decorators ───────────────────────────────────────────────────

/**
 * Marks an endpoint as protected with JWT Bearer authentication.
 * Documents 401 Unauthorized and 403 Forbidden responses.
 */
export const ApiAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse(unauthorizedOptions),
    ApiForbiddenResponse(forbiddenOptions),
  );

/**
 * Documents 401 Unauthorized and 403 Forbidden responses only.
 * Use alongside @ApiAuth() or on its own for endpoints that may throw auth errors.
 */
export const ApiAuthResponses = (): MethodDecorator =>
  applyDecorators(
    ApiUnauthorizedResponse(unauthorizedOptions),
    ApiForbiddenResponse(forbiddenOptions),
  );

// ─── Error response decorators ─────────────────────────────────────────────────

/**
 * Documents the 401 Unauthorized response.
 */
export const ApiUnauthorized = (): MethodDecorator => ApiUnauthorizedResponse(unauthorizedOptions);

/**
 * Documents the 403 Forbidden response.
 */
export const ApiForbidden = (): MethodDecorator => ApiForbiddenResponse(forbiddenOptions);

/**
 * Documents the 404 Not Found response.
 */
export const ApiNotFound = (description?: string): MethodDecorator =>
  ApiNotFoundResponse({
    description: description ?? notFoundOptions.description,
    ...notFoundOptions,
  });

/**
 * Documents the 400 Bad Request response for validation errors.
 * @param _description - Deprecated, kept for backward compatibility. Use examples in OpenAPI instead.
 */
export const ApiBadRequest = (): MethodDecorator => ApiBadRequestResponse(badRequestOptions);

/**
 * Documents the 409 Conflict response.
 * @param description - Optional description override
 */
export const ApiConflict = (description?: string): MethodDecorator =>
  ApiConflictResponse({
    description: description ?? conflictOptions.description,
    ...conflictOptions,
  });

/**
 * Documents the 429 Too Many Requests response.
 */
export const ApiTooManyRequests = (): MethodDecorator =>
  ApiTooManyRequestsResponse(tooManyRequestsOptions);

/**
 * Documents the 500 Internal Server Error response.
 * @param _description - Deprecated, kept for backward compatibility. Use examples in OpenAPI instead.
 */
export const ApiInternalError = (): MethodDecorator =>
  ApiInternalServerErrorResponse(internalErrorOptions);

/**
 * Documents validation errors for a POST/PATCH/PUT endpoint.
 */
export const ApiValidationRequest = (): MethodDecorator => ApiBadRequestResponse(badRequestOptions);

// ─── Standard error response sets ──────────────────────────────────────────────

/**
 * Common errors for authenticated endpoints: 401, 403, 500.
 */
export const ApiAuthErrors = (): MethodDecorator =>
  applyDecorators(ApiUnauthorized(), ApiForbidden(), ApiInternalError());

/**
 * Common errors for public endpoints: 400, 500.
 */
export const ApiPublicErrors = (): MethodDecorator =>
  applyDecorators(ApiBadRequest(), ApiInternalError());

/**
 * Common errors for endpoints with resource lookups: 400, 404, 500.
 */
export const ApiLookupErrors = (): MethodDecorator =>
  applyDecorators(ApiBadRequest(), ApiNotFound(), ApiInternalError());

/**
 * Full error suite: 401, 403, 404, 400, 500.
 */
export const ApiStandardErrors = (): MethodDecorator =>
  applyDecorators(
    ApiUnauthorized(),
    ApiForbidden(),
    ApiNotFound(),
    ApiBadRequest(),
    ApiInternalError(),
  );

// ─── Success response decorators ─────────────────────────────────────────────────

/**
 * Documents a successful 204 No Content response.
 */
export const ApiNoContent = (description = 'Operation completed successfully'): MethodDecorator =>
  ApiNoContentResponse({ description });

/**
 * Documents a successful 200 OK response.
 */
export const ApiOk = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  ApiOkResponse(responseOptions);

/**
 * Documents a successful 201 Created response.
 */
export const ApiCreated = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  ApiCreatedResponse(responseOptions);

// ─── Endpoint pattern decorators ─────────────────────────────────────────────────

/**
 * GET endpoint with authentication and internal error handling.
 * Use for: /me, /profile, /stats
 */
export const ApiAuthRead = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiInternalError());

/**
 * GET endpoint without authentication.
 * Use for: public listings, search results
 */
export const ApiPublicRead = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiOkResponse(responseOptions), ApiPublicErrors());

/**
 * GET endpoint that fetches by ID.
 * Use for: /quizzes/:id, /users/:id
 */
export const ApiPublicFetch = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiOkResponse(responseOptions), ApiLookupErrors());

/**
 * POST endpoint that creates a resource.
 * Use for: /quizzes, /comments
 */
export const ApiAuthCreate = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiCreatedResponse(responseOptions),
    ApiBadRequest(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * POST endpoint with state conflict checks.
 * Use for: /friend-requests, /follow
 */
export const ApiAuthCreateWithState = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiCreatedResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiConflict(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * PATCH endpoint for updating resources.
 * Use for: /quizzes/:id, /profile
 */
export const ApiAuthUpdate = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiOkResponse(responseOptions),
    ApiBadRequest(),
    ApiConflict(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * PATCH endpoint with ownership/resource checks.
 * Use for: /quizzes/:id (with owner check)
 */
export const ApiAuthUpdateWithState = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiForbidden(),
    ApiBadRequest(),
    ApiConflict(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * DELETE endpoint without existence check.
 */
export const ApiAuthDelete = (description = 'Resource deleted successfully'): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiNoContent(description), ApiInternalError());

/**
 * DELETE endpoint with existence check.
 */
export const ApiAuthDeleteWithState = (
  description = 'Resource deleted successfully',
): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiNoContent(description), ApiNotFound(), ApiInternalError());

/**
 * Action endpoint (POST) returning 200 OK.
 * Use for: follow, unfollow, like
 */
export const ApiAuthAction = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiConflict(),
    ApiForbidden(),
    ApiBadRequest(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * Action endpoint (POST) returning 204 No Content.
 * Use for: mark-as-read, bulk operations
 */
export const ApiAuthActionNoContent = (
  description = 'Operation completed successfully',
): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiNoContent(description),
    ApiNotFound(),
    ApiConflict(),
    ApiForbidden(),
    ApiBadRequest(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

// ─── Admin endpoint decorators ───────────────────────────────────────────────────

/**
 * Admin endpoint for system-level operations.
 */
export const ApiAdminEndpoint = (
  responseOptions: ApiResponseOptions = {},
): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiBadRequest(), ApiInternalError());

/**
 * Admin endpoint for resource management.
 */
export const ApiAdminResource = (
  responseOptions: ApiResponseOptions = {},
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiConflict(),
    ApiInternalError(),
  );

/**
 * Admin read-only endpoint.
 */
export const ApiAdminRead = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiNotFound(), ApiInternalError());

/**
 * Admin create endpoint.
 */
export const ApiAdminCreate = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiCreatedResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiConflict(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * Admin update endpoint.
 */
export const ApiAdminUpdate = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiAuth(),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiConflict(),
    ApiForbidden(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

/**
 * Admin delete endpoint.
 */
export const ApiAdminDelete = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiNotFound(), ApiInternalError());

// ─── Moderator endpoint decorators ─────────────────────────────────────────────

/**
 * Moderator endpoint with permission checks.
 */
export const ApiModeratorEndpoint = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiForbiddenResponse(forbiddenOptions),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiInternalError(),
  );

/**
 * Moderator action endpoint returning 204 No Content.
 */
export const ApiModeratorAction = (
  description = 'Operation completed successfully',
): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiForbiddenResponse(forbiddenOptions),
    ApiNoContent(description),
    ApiNotFound(),
    ApiBadRequest(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

// ─── Backward compatibility aliases ─────────────────────────────────────────────

/**
 * @deprecated Use ApiAuthRead instead. Alias preserved for backward compatibility.
 */
export const ApiAuthList = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  ApiAuthRead(responseOptions);

/**
 * @deprecated Use ApiPublicRead instead. Alias preserved for backward compatibility.
 */
export const ApiPublicList = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  ApiPublicRead(responseOptions);
