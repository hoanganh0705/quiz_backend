import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import {
  UnauthorizedErrorResponseDto,
  ForbiddenErrorResponseDto,
  NotFoundErrorResponseDto,
  ValidationErrorResponseDto,
  ErrorResponseDto,
} from './swagger-schemas';

// ─── Pre-configured response option constants ─────────────────────────────────────

const defaultUnauthorized: ApiResponseOptions = {
  description: 'Missing or invalid authentication token',
  type: UnauthorizedErrorResponseDto,
};

const defaultForbidden: ApiResponseOptions = {
  description: 'Authenticated user lacks required role or permission',
  type: ForbiddenErrorResponseDto,
};

const defaultNotFound: ApiResponseOptions = {
  description: 'The requested resource does not exist or has been deleted',
  type: NotFoundErrorResponseDto,
};

const defaultBadRequest: ApiResponseOptions = {
  description: 'Request body, query, or params failed validation',
  type: ValidationErrorResponseDto,
};

const defaultInternalError: ApiResponseOptions = {
  description: 'Unexpected server error',
  type: ErrorResponseDto,
};

const defaultConflict: ApiResponseOptions = {
  description: 'The request conflicts with the current state of the resource',
  type: ErrorResponseDto,
};

// ─── Core reusable decorators ───────────────────────────────────────────────────

/**
 * Documents a successful 204 No Content response (used for delete, mark-as-read, etc.).
 */
export const ApiNoContent = (description = 'Operation completed successfully'): MethodDecorator =>
  ApiNoContentResponse({ description });

/**
 * Marks an endpoint as protected with JWT Bearer authentication.
 * Adds 401 Unauthorized and 403 Forbidden response documentation.
 */
export const ApiAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse(defaultUnauthorized),
    ApiForbiddenResponse(defaultForbidden),
  );

/**
 * Documents the standard error responses for a protected endpoint.
 * Use alongside `@ApiAuth()` or on its own for endpoints that may throw auth errors.
 */
export const ApiAuthResponses = (): MethodDecorator =>
  applyDecorators(
    ApiUnauthorizedResponse(defaultUnauthorized),
    ApiForbiddenResponse(defaultForbidden),
  );

/**
 * Documents validation errors for a POST/PATCH/PUT endpoint.
 */
export const ApiValidationRequest = (): MethodDecorator => ApiBadRequestResponse(defaultBadRequest);

/**
 * Documents the full suite of common error responses.
 */
export const ApiStandardErrors = (): MethodDecorator =>
  applyDecorators(
    ApiUnauthorizedResponse(defaultUnauthorized),
    ApiForbiddenResponse(defaultForbidden),
    ApiNotFoundResponse(defaultNotFound),
    ApiBadRequestResponse(defaultBadRequest),
    ApiInternalServerErrorResponse(defaultInternalError),
  );

// ─── Pre-built error response decorators ───────────────────────────────────────

/**
 * Documents the 401 Unauthorized response for public endpoints that may still receive
 * invalid tokens (e.g., optional auth).
 */
export const ApiUnauthorized = (): MethodDecorator => ApiUnauthorizedResponse(defaultUnauthorized);

/**
 * Documents the 403 Forbidden response for permission-restricted endpoints.
 */
export const ApiForbidden = (): MethodDecorator => ApiForbiddenResponse(defaultForbidden);

/**
 * Documents the 404 Not Found response.
 */
export const ApiNotFound = (description?: string): MethodDecorator =>
  ApiNotFoundResponse({
    description: description ?? defaultNotFound.description,
    type: NotFoundErrorResponseDto,
  });

/**
 * Documents the 400 Bad Request response for validation errors.
 */
export const ApiBadRequest = (description?: string): MethodDecorator =>
  ApiBadRequestResponse({
    description: description ?? defaultBadRequest.description,
    type: ValidationErrorResponseDto,
  });

/**
 * Documents the 409 Conflict response.
 */
export const ApiConflict = (description?: string): MethodDecorator =>
  ApiConflictResponse({
    description: description ?? defaultConflict.description,
    type: ErrorResponseDto,
  });

/**
 * Documents the 500 Internal Server Error response.
 */
export const ApiInternalError = (description = 'Unexpected server error'): MethodDecorator =>
  ApiInternalServerErrorResponse({ description });

// ─── Common endpoint pattern decorators ─────────────────────────────────────────

/**
 * Combines auth + ok response + internal error.
 * Used by most authenticated GET endpoints (e.g., /me, /me/stats).
 */
export const ApiAuthList = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiInternalError());

/**
 * Combines ok response + bad request + internal error.
 * Used by public GET endpoints with validation (search, list with filters).
 */
export const ApiPublicList = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiOkResponse(responseOptions), ApiBadRequest(), ApiInternalError());

/**
 * Combines ok response + not found + bad request + internal error.
 * Used by public GET endpoints that fetch by ID and need validation.
 */
export const ApiNotFoundList = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiInternalError(),
  );

/**
 * Combines auth + created response + bad request + internal error.
 * Used by POST endpoints that create resources without resource-not-found check.
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
 * Combines auth + created response + not found + bad request + conflict + internal error.
 * Used by POST endpoints that create resources with state checks.
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
 * Combines auth + ok response + bad request + conflict + internal error.
 * Used by PATCH endpoints that update resources without not-found check.
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
 * Combines auth + ok response + not found + forbidden + bad request + conflict + internal error.
 * Used by PATCH endpoints that update resources with ownership checks.
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
 * Combines auth + no content + internal error.
 * Used by DELETE endpoints without not-found check.
 */
export const ApiAuthDelete = (description = 'Resource deleted successfully'): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiNoContent(description), ApiInternalError());

/**
 * Combines auth + no content + not found + internal error.
 * Used by DELETE endpoints that verify resource existence.
 */
export const ApiAuthDeleteWithState = (
  description = 'Resource deleted successfully',
): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiNoContent(description), ApiNotFound(), ApiInternalError());

/**
 * Combines auth + ok response + not found + conflict + forbidden + bad request + internal error.
 * Used by POST endpoints that perform idempotent actions (e.g., follow, join).
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
 * Combines auth + no content + not found + conflict + forbidden + bad request + internal error.
 * Used by POST endpoints that perform idempotent actions returning 204.
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
 * Combines auth + ok response + bad request + internal error.
 * Used by admin endpoints that manage system-level operations.
 */
export const ApiAdminEndpoint = (
  responseOptions: ApiResponseOptions = {},
): MethodDecorator & ClassDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiBadRequest(), ApiInternalError());

/**
 * Combines auth + ok response + not found + bad request + conflict + internal error.
 * Used by admin endpoints that manage specific resources.
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
 * Combines auth + ok response + not found + internal error.
 * Used by read-only admin endpoints (GET).
 */
export const ApiAdminRead = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiNotFound(), ApiInternalError());

/**
 * Combines auth + created response + not found + bad request + conflict + internal error.
 * Used by admin endpoints that create resources.
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
 * Combines auth + ok response + not found + bad request + conflict + forbidden + internal error.
 * Used by admin endpoints that update resources.
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
 * Combines auth + ok response + not found + internal error.
 * Used by admin endpoints that delete resources.
 */
export const ApiAdminDelete = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(ApiAuth(), ApiOkResponse(responseOptions), ApiNotFound(), ApiInternalError());

// ─── Moderator endpoint decorators ─────────────────────────────────────────────

/**
 * Combines bearer auth + forbidden + ok response + not found + bad request + internal error.
 * Used by moderator endpoints that need authorization without auth error docs.
 */
export const ApiModeratorEndpoint = (responseOptions: ApiResponseOptions = {}): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiForbiddenResponse(defaultForbidden),
    ApiOkResponse(responseOptions),
    ApiNotFound(),
    ApiBadRequest(),
    ApiInternalError(),
  );

/**
 * Combines bearer auth + forbidden + no content + not found + bad request + internal error.
 * Used by moderator endpoints that perform actions returning 204.
 */
export const ApiModeratorAction = (
  description = 'Operation completed successfully',
): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiForbiddenResponse(defaultForbidden),
    ApiNoContent(description),
    ApiNotFound(),
    ApiBadRequest(),
    ApiValidationRequest(),
    ApiInternalError(),
  );

// ─── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Builds a typed paginated list response schema.
 * OpenAPI generators will produce `PaginatedResponse<T>` with `items: T[]` and `pagination: PaginationMeta`.
 */
export const buildPaginatedSchema = <TItem extends object>(itemType: Type<TItem>) => {
  return {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: `#/components/schemas/${itemType.name}` } },
      pagination: { $ref: `#/components/schemas/PaginationMetaDto` },
    },
  };
};
