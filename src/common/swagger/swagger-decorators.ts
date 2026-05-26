import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
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
