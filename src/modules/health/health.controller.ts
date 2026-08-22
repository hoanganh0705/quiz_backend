import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { RedisService } from '@/core/redis/redis.service';
import { Public } from '@/common/decorators/public.decorator';
import { ApiOkResource } from '@/common/swagger/api-ok';
import { sql } from 'drizzle-orm';
import { STORAGE_PORT } from '@/core/storage';
import type { StoragePort } from '@/core/storage';
import {
  HealthStatusDto,
  type HealthStatusValue,
  type ProbeResultDto,
} from './dto/health-status.dto';
import { HealthPresenter } from './health.presenter';
import { HealthQueueProbe } from './health-queue-probe';

/**
 * Health check endpoint.
 *
 * Phase 2 #3 — extended per-dependency health. The endpoint
 * surfaces four sub-probes (`database`, `redis`, `storage`,
 * `emailQueue`) plus the in-process Redis circuit-breaker state.
 * The aggregate `status` is:
 *   - `down` when the database is unreachable (no pod can serve).
 *   - `degraded` when any non-critical dependency is failing.
 *   - `up` otherwise.
 *
 * HTTP status: 200 for `up` and `degraded`, 503 for `down`. The
 * orchestrator should keep `degraded` pods in rotation — the
 * fallback paths (rate-limit fail-open, LSITEN/NOTIFY outbox
 * fallback poll, etc.) keep the API usable — but should page
 * on-call.
 */
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redisService: RedisService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly presenter: HealthPresenter,
    private readonly queueProbe: HealthQueueProbe,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Verifies database, Redis, storage, and email-queue health. Returns `up` when every probe is healthy, `degraded` when any non-critical dependency is failing, and `down` when the database is unreachable. The HTTP status is `200` for `up`/`degraded` and `503` for `down`.',
  })
  @ApiOkResource(HealthStatusDto, {
    description: 'Health status (per-dependency breakdown)',
  })
  @ApiServiceUnavailableResponse({
    description: 'Database is down — the pod cannot serve any request safely',
    type: HealthStatusDto,
  })
  async check(@Res({ passthrough: true }) res: Response) {
    // Probe every dependency in parallel. None of the probes has
    // a dependency on the others, so `Promise.all` keeps the
    // total wall-clock time at `max(probes)` rather than
    // `sum(probes)`. Each probe is bounded by a connection or
    // HTTP timeout — none of them can hang indefinitely.
    const [database, redis, storage, emailQueue, redisCircuit] = await Promise.all([
      this.probeDb(),
      this.probeRedis(),
      this.probeStorage(),
      this.queueProbe.probeEmailQueue(),
      Promise.resolve(this.redisService.getCircuitMetrics()),
    ]);

    const status = this.aggregateStatus({ database, redis, storage });
    const httpStatus =
      status === 'down' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    res.status(httpStatus);

    const payload: HealthStatusDto = {
      status,
      database,
      redis,
      storage,
      emailQueue,
      redisCircuit: {
        state: redisCircuit.state,
        consecutiveFailures: redisCircuit.consecutiveFailures,
        shortCircuitedCount: redisCircuit.shortCircuitedCount,
      },
    };
    return this.presenter.check(payload);
  }

  /**
   * Aggregate policy. The database is the single hard dependency
   * — when it is down, every write fails. Everything else can
   * degrade without taking the pod out of rotation.
   */
  private aggregateStatus(probes: {
    database: 'up' | 'down';
    redis: ProbeResultDto;
    storage: ProbeResultDto;
  }): HealthStatusValue {
    if (probes.database === 'down') return 'down';
    if (probes.redis.status !== 'up' || probes.storage.status !== 'up') return 'degraded';
    return 'up';
  }

  private async probeDb(): Promise<'up' | 'down'> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async probeRedis(): Promise<ProbeResultDto> {
    try {
      const reply = await this.redisService.ping();
      return reply === 'PONG' || typeof reply === 'string'
        ? { status: 'up', detail: null }
        : { status: 'degraded', detail: `unexpected reply: ${reply}` };
    } catch (error) {
      return {
        status: 'down',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async probeStorage(): Promise<ProbeResultDto> {
    try {
      await this.storage.ping();
      return { status: 'up', detail: null };
    } catch (error) {
      return {
        status: 'down',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}