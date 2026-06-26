import { ApiProperty } from '@nestjs/swagger';

// ─── Health module documentation-only wrapper DTOs ────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp: string } }
//
// Runtime DTO classes (HealthStatusDto) remain unchanged. These wrapper DTOs
// are used ONLY in @ApiOkResponse / @ApiServiceUnavailableResponse decorators
// to document the actual wrapped shape in the OpenAPI spec. They mirror the
// auth and quiz module conventions.
//
// Runtime shape key mapping for this module:
//   - check (GET /health) → { data: { status, database, redis }, meta }
//     where the HTTP status code is 200 for up/degraded or 503 for down
//     (the controller sets the status code via @Res({ passthrough: true })).

// ─── Runtime payload type (matches the HealthStatus TS type in the controller) ─

export type HealthStatusValue = 'up' | 'down' | 'degraded';

export class HealthStatusDto {
  @ApiProperty({
    description: 'Aggregate health status',
    enum: ['up', 'down', 'degraded'],
    example: 'up',
  })
  status!: HealthStatusValue;

  @ApiProperty({
    description: 'Database reachability',
    enum: ['up', 'down'],
    example: 'up',
  })
  database!: 'up' | 'down';

  @ApiProperty({
    description: 'Redis reachability',
    enum: ['up', 'down'],
    example: 'up',
  })
  redis!: 'up' | 'down';
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

/**
 * Runtime shape: { data: HealthStatusDto, meta: { timestamp } }
 * HTTP status code is 200 when overall status is `up` or `degraded`,
 * and 503 when overall status is `down`.
 * Used for: GET /health
 */
export class WrappedHealthResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => HealthStatusDto })
  data!: HealthStatusDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}
