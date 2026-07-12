import { ApiProperty } from '@nestjs/swagger';

/**
 * Health module runtime DTO.
 *
 * Runtime shape (produced by `HealthPresenter`):
 *   { data: HealthStatusDto, meta: { timestamp } }
 *
 * Previously lived in `dto/health-response-docs.dto.ts` alongside
 * `WrappedMessageResponseDto`-style documentation wrappers. Moved here during
 * Phase 5 of the response-envelope migration (see
 * `docs/migrations/PHASE_5_SUBPLAN.md` §4 Step 1.3) so the controller import
 * path stays valid after the docs file is deleted.
 */
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
