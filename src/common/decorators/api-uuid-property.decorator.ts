import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

/**
 * Shared UUID property decorators for API DTOs.
 *
 * Combines `@ApiProperty({ format: 'uuid' })` for Swagger/OpenAPI docs with
 * `@IsUUID()` for runtime validation so the framework rejects malformed
 * identifiers at the controller boundary instead of letting them reach the
 * database (where Postgres throws `22P02 invalid input syntax for type uuid`).
 *
 * Use for any string field that documents a user / target identifier.
 *
 * Project requirement: PROJECT_CONSTITUTION.md mandates UUIDv7 for all
 * primary identifiers, so we declare `format: 'uuid'` rather than a looser
 * string type.
 */

interface ApiUuidOptions {
  description?: string;
  example?: string;
  nullable?: boolean;
}

const UUID_EXAMPLE = '01900000-0000-7000-8000-000000000001';

export function ApiUuidProperty(options: ApiUuidOptions = {}) {
  return applyDecorators(
    ApiProperty({
      description: options.description ?? 'UUIDv7 identifier',
      format: 'uuid',
      example: options.example ?? UUID_EXAMPLE,
      nullable: options.nullable,
    }),
    IsUUID(),
  );
}

export function ApiOptionalUuidProperty(options: ApiUuidOptions = {}) {
  return applyDecorators(
    ApiPropertyOptional({
      description: options.description ?? 'UUIDv7 identifier',
      format: 'uuid',
      example: options.example ?? UUID_EXAMPLE,
      nullable: options.nullable,
    }),
    IsOptional(),
    IsUUID(),
  );
}
