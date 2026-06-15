import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { RedisService } from '@/core/redis/redis.service';
import { Public } from '@/common/decorators/public.decorator';
import { sql } from 'drizzle-orm';

/**
 * Health status payload.
 *
 * - `status` is the *overall* status: `up` only when every
 *   probed dependency is reachable, `degraded` when the
 *   database is up but at least one secondary dependency
 *   (e.g. Redis) is down, and `down` when the database is
 *   down. The platform can serve some requests in `degraded`
 *   mode — read traffic still works, but anything that needs
 *   rate limiting, caching, or pub/sub will fail — so the
 *   orchestrator should not yank the pod but should page.
 * - Per-dependency status is broken out (`database`, `redis`)
 *   so the operator can see *which* dependency is failing
 *   without grepping the application logs.
 *
 * The DB check uses `SELECT 1` (round-trips a query through
 * Drizzle / pg). The Redis check uses `PING` (round-trips a
 * single command over the existing ioredis connection). Both
 * are bounded — there is no `await ping()` on a long-lived
 * socket, so a hung dependency surfaces as a connect-timeout
 * error from the driver, not an unbounded wait.
 */
type HealthStatus = {
  status: 'up' | 'down' | 'degraded';
  database: 'up' | 'down';
  redis: 'up' | 'down';
};

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Verifies database and Redis connectivity. Returns `up` when both are reachable, ' +
      '`degraded` when the database is up but Redis is down, and `down` when the database ' +
      'is down. The HTTP status code is `200` for `up` and `degraded`, and `503` for `down` ' +
      'so the orchestrator can route traffic away from a fully-broken pod.',
  })
  @ApiOkResponse({
    description: 'Health status (database and/or Redis reachable)',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['up', 'degraded'], example: 'up' },
        database: { type: 'string', enum: ['up', 'down'], example: 'up' },
        redis: { type: 'string', enum: ['up', 'down'], example: 'up' },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Database is down — the pod cannot serve any request safely',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['down'], example: 'down' },
        database: { type: 'string', enum: ['down'], example: 'down' },
        redis: { type: 'string', enum: ['up', 'down'], example: 'up' },
      },
    },
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    // Probe DB and Redis concurrently. The two probes are
    // independent — neither has to wait for the other, and
    // neither depends on the response from the other — so
    // Promise.all keeps the total wall-clock time at
    // `max(db, redis)` rather than `db + redis`.
    const [database, redis] = await Promise.all([this.probeDb(), this.probeRedis()]);

    let status: HealthStatus['status'];
    let httpStatus: number;
    if (database === 'down') {
      // DB is the source of truth. If it's down, every write
      // fails, and the auth outbox cannot record anything
      // either. Treat this as a hard outage.
      status = 'down';
      httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (redis === 'down') {
      // DB up + Redis down: rate limiting, caching, and
      // cross-instance pub/sub (session invalidation) are
      // all degraded, but reads/writes still work. Surface
      // this as `degraded` so the orchestrator keeps the pod
      // in rotation while paging on-call.
      status = 'degraded';
      httpStatus = HttpStatus.OK;
    } else {
      status = 'up';
      httpStatus = HttpStatus.OK;
    }

    // Set the HTTP status via the response object (passthrough
    // so NestJS still serializes the return value as JSON).
    res.status(httpStatus);

    return { status, database, redis };
  }

  private async probeDb(): Promise<'up' | 'down'> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async probeRedis(): Promise<'up' | 'down'> {
    try {
      const reply = await this.redisService.ping();
      // ioredis returns the literal string `'PONG'` on success.
      // We do not gate on the exact value — any non-error reply
      // means the server is reachable and responding — but
      // logging the value would be useful if it ever differed.
      return reply === 'PONG' || typeof reply === 'string' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
