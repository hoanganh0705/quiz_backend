import { ApiProperty } from '@nestjs/swagger';

// ─── Health module documentation-only DTOs ───────────────────────────────────
//
// Runtime shape is produced by `HealthPresenter` + `ResponseFormatInterceptor`:
//   { data: HealthStatusDto, meta: { timestamp } }
//
// `HealthStatusDto` is referenced by the OpenAPI annotations on the
// controller. The wrapper envelope is composed centrally in `api-ok.ts`.

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
