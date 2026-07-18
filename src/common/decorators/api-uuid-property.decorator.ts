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

const UUID_V7_EXAMPLE = '01900000-0000-7000-8000-000000000001';

export function ApiUuidProperty(options: ApiUuidOptions = {}) {
  return applyDecorators(
    ApiProperty({
      description: options.description ?? 'UUIDv7 identifier',
      format: 'uuid',
      example: options.example ?? UUID_V7_EXAMPLE,
      nullable: options.nullable,
    }),
    IsUUID('7'),
  );
}

export function ApiOptionalUuidProperty(options: ApiUuidOptions = {}) {
  return applyDecorators(
    ApiPropertyOptional({
      description: options.description ?? 'UUIDv7 identifier',
      format: 'uuid',
      example: options.example ?? UUID_V7_EXAMPLE,
      nullable: options.nullable,
    }),
    IsOptional(),
    IsUUID('7'),
  );
}

/**
 * Shared timestamp property decorators for API DTOs.
 *
 * Combines `@ApiProperty({ format: 'date-time' })` for Swagger/OpenAPI docs
 * with `@IsISO8601()` for runtime validation. `PROJECT_CONSTITUTION.md`
 * mandates ISO 8601 timestamps and `api.md` requires `format: 'date-time'`
 * for all date-time fields.
 *
 * Use for any field that represents an instant in time (not a local date
 * or time-of-day only). Examples: `createdAt`, `updatedAt`, `achievedAt`,
 * `recordedAt`, `lastActivityAt`, `nextConsistencyCheck`.
 *
 * NOTE: Fields named `start` / `end` / `date` / `snapshotDate` that represent
 * date-only boundaries (not instants) should NOT use this — use a plain
 * `@ApiProperty({ example: '2026-06-30' })` with `@IsDateString()` instead.
 */

interface ApiTimestampOptions {
  description?: string;
  example?: string;
  nullable?: boolean;
}

const ISO8601_EXAMPLE = '2026-06-30T10:00:00.000Z';

export function ApiTimestampProperty(options: ApiTimestampOptions = {}) {
  return ApiProperty({
    description: options.description ?? 'ISO 8601 timestamp',
    format: 'date-time',
    example: options.example ?? ISO8601_EXAMPLE,
    nullable: options.nullable,
  });
}

export function ApiOptionalTimestampProperty(options: ApiTimestampOptions = {}) {
  return applyDecorators(
    ApiPropertyOptional({
      description: options.description ?? 'ISO 8601 timestamp',
      format: 'date-time',
      example: options.example ?? ISO8601_EXAMPLE,
      nullable: options.nullable,
    }),
    IsOptional(),
  );
}
