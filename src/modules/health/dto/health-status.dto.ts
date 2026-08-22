import { ApiProperty } from '@nestjs/swagger';

/**
 * Health module runtime DTO.
 *
 * Phase 2 #3 — extended per-dependency health. The original DTO
 * only exposed `database` and `redis`. The new shape adds:
 *   - `redis`: same as before, but always present (replaces the
 *     previous boolean with a structured `ProbeResultDto`).
 *   - `storage`: per-adapter reachability (Cloudinary `api.ping`).
 *   - `emailQueue`: BullMQ queue depth + whether the worker is
 *     draining.
 *   - `redisCircuit`: the in-process circuit breaker state, so
 *     operators can see exactly *why* a request was short-circuited.
 *
 * Status of the overall response is downgraded to `degraded` (vs.
 * `up`) when any non-critical dependency is failing. The aggregator
 * in `HealthController` decides the policy.
 */
export type HealthStatusValue = 'up' | 'down' | 'degraded';

export type DependencyStatus = 'up' | 'down' | 'degraded';

export class ProbeResultDto {
  @ApiProperty({
    description: 'Reachability status of the dependency',
    enum: ['up', 'down', 'degraded'],
    example: 'up',
  })
  status!: DependencyStatus;

  @ApiProperty({
    description: 'Optional human-readable detail (e.g. error message)',
    required: false,
    example: null,
  })
  detail?: string | null;
}

export class RedisCircuitProbeDto {
  @ApiProperty({
    description: 'Current circuit-breaker state',
    enum: ['closed', 'open', 'half-open'],
    example: 'closed',
  })
  state!: 'closed' | 'open' | 'half-open';

  @ApiProperty({
    description: 'Number of consecutive Redis failures',
    example: 0,
  })
  consecutiveFailures!: number;

  @ApiProperty({
    description: 'Total number of requests short-circuited by the breaker since process start',
    example: 0,
  })
  shortCircuitedCount!: number;
}

export class EmailQueueProbeDto {
  @ApiProperty({
    description: 'Current BullMQ queue depth (waiting + active + delayed)',
    example: 0,
  })
  depth!: number;

  @ApiProperty({
    description: 'Whether the worker is connected to the queue',
    example: true,
  })
  workerConnected!: boolean;
}

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

  @ApiProperty({ description: 'Redis reachability', type: ProbeResultDto })
  redis!: ProbeResultDto;

  @ApiProperty({ description: 'Cloud storage reachability', type: ProbeResultDto })
  storage!: ProbeResultDto;

  @ApiProperty({ description: 'Email queue depth and worker state', type: EmailQueueProbeDto })
  emailQueue!: EmailQueueProbeDto;

  @ApiProperty({ description: 'In-process Redis circuit-breaker state', type: RedisCircuitProbeDto })
  redisCircuit!: RedisCircuitProbeDto;
}