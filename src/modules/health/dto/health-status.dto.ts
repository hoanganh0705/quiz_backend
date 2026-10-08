import { ApiProperty } from '@nestjs/swagger';
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

export class QueueProbeDto {
  @ApiProperty({
    description: 'Total BullMQ queue depth (waiting + active + delayed)',
    example: 0,
  })
  depth!: number;

  @ApiProperty({
    description: 'Number of jobs currently in the active state',
    example: 0,
  })
  active!: number;

  @ApiProperty({
    description: 'Number of jobs currently in the waiting state',
    example: 0,
  })
  waiting!: number;

  @ApiProperty({
    description: 'Number of jobs currently in the delayed state',
    example: 0,
  })
  delayed!: number;

  @ApiProperty({
    description: 'Number of jobs in the failed state',
    example: 0,
  })
  failed!: number;

  @ApiProperty({
    description: 'Number of jobs that BullMQ considers stalled (workers not making progress)',
    example: 0,
  })
  stalled!: number;

  @ApiProperty({
    description: 'Whether the worker is connected to the queue',
    example: true,
  })
  workerConnected!: boolean;
}

export class EmailQueueProbeDto extends QueueProbeDto {}

export class TournamentQueueProbeDto extends QueueProbeDto {}

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

  @ApiProperty({
    description: 'Email queue depth, stalled jobs, and worker state',
    type: EmailQueueProbeDto,
  })
  emailQueue!: EmailQueueProbeDto;

  @ApiProperty({
    description: 'Tournament-events queue depth, stalled jobs, and worker state',
    type: TournamentQueueProbeDto,
  })
  tournamentEventsQueue!: TournamentQueueProbeDto;

  @ApiProperty({
    description: 'In-process Redis circuit-breaker state',
    type: RedisCircuitProbeDto,
  })
  redisCircuit!: RedisCircuitProbeDto;
}
