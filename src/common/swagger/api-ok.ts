import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  OffsetPaginationMetaDto,
  PaginatedResponseMetaDto,
  PaginationMetaDto,
  ResponseMetaDto,
  WrappedDto,
  WrappedPaginatedDto,
} from './swagger-schemas';

export type ApiResourceOptions = {
  description?: string;
  example?: unknown;
  examples?: Record<string, { summary: string; value: unknown }>;
  headers?: Record<string, unknown>;
  links?: Record<string, unknown>;
};

const buildResourceSchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    { properties: { data: { $ref: getSchemaPath(model) } } },
  ],
});

const buildResourceArraySchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    {
      properties: {
        data: {
          type: 'array' as const,
          items: { $ref: getSchemaPath(model) },
        },
      },
    },
  ],
});

const buildPaginatedSchema = <T extends Type>(
  model: T,
  paginationMetaSchema: typeof PaginationMetaDto | typeof OffsetPaginationMetaDto,
) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedPaginatedDto) },
    {
      properties: {
        data: {
          type: 'array' as const,
          items: { $ref: getSchemaPath(model) },
        },
        meta: {
          properties: {
            pagination: { $ref: getSchemaPath(paginationMetaSchema) },
          },
        },
      },
    },
  ],
});

export const ApiOkResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiOkResponse>[0]),
  );

export const ApiCreatedResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiCreatedResponse({
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiCreatedResponse>[0]),
  );

export const ApiAcceptedResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiResponse({
      status: 202,
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiResponse>[0]),
  );

export const ApiOkResourceList = <T extends Type>(
  model: T,
  kind: 'cursor' | 'offset',
  options: ApiResourceOptions = {},
): MethodDecorator => {
  const paginationMetaSchema = kind === 'cursor' ? PaginationMetaDto : OffsetPaginationMetaDto;

  return applyDecorators(
    ApiExtraModels(WrappedPaginatedDto, PaginatedResponseMetaDto, paginationMetaSchema, model),
    ApiOkResponse({
      ...options,
      schema: buildPaginatedSchema(model, paginationMetaSchema),
    } as Parameters<typeof ApiOkResponse>[0]),
  );
};

export const ApiOkResourceArray = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({
      ...options,
      schema: buildResourceArraySchema(model),
    } as Parameters<typeof ApiOkResponse>[0]),
  );
