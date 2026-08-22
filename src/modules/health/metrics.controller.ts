/**
 * Phase 5 #2 — Prometheus `/metrics` endpoint.
 *
 * Exposes the in-process `MetricsRegistry` in the Prometheus
 * text exposition format. The endpoint is `@Public()` so an
 * unauthenticated Prometheus scrape can reach it without
 * needing a JWT — the standard Prometheus deployment pattern
 * is to filter by network policy, not by auth.
 *
 * The metrics endpoint also updates the *gauge* series
 * (`quiz_redis_circuit_state`, `quiz_bullmq_queue_depth`,
 * `quiz_tracing_active_spans`, `quiz_outbox_lag_seconds`)
 * from the latest probe results so a Prometheus scrape sees
 * point-in-time data, not stale cache.
 */

import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  METRICS_REGISTRY,
  type MetricsRegistry,
} from '@/core/observability/metrics.registry';
import { RedisService } from '@/core/redis/redis.service';
import { TracingProvider } from '@/core/observability/tracing.provider';
import { TRACING_PROVIDER } from '@/core/observability/tracing.provider';
import { HealthQueueProbe } from './health-queue-probe';
import { DRIZZLE_READ } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';

const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

@Public()
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(METRICS_REGISTRY)
    private readonly metrics: MetricsRegistry,
    private readonly redisService: RedisService,
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
    private readonly queueProbe: HealthQueueProbe,
    @Inject(DRIZZLE_READ) private readonly db: DrizzleDB,
  ) {}

  @Get()
  @Header('Content-Type', METRICS_CONTENT_TYPE)
  async scrape(@Res({ passthrough: true }) res: Response): Promise<string> {
    // Refresh the gauges in parallel. Each is independent.
    await Promise.all([
      this.refreshCircuitGauge(),
      this.refreshQueueDepthGauge(),
      this.refreshTracingGauge(),
      this.refreshOutboxLagGauge(),
    ]);

    res.status(200);
    return this.metrics.render();
  }

  private async refreshCircuitGauge(): Promise<void> {
    const m = this.redisService.getCircuitMetrics();
    // `CircuitState` is `'closed' | 'open' | 'half_open'`. The
    // `MetricsRegistry` accepts the same vocabulary, so no
    // mapping is needed.
    const state = m.state as 'closed' | 'open' | 'half_open';
    this.metrics.setRedisCircuitState(state);
    if (m.shortCircuitedCount > 0) {
      this.metrics.incRedisCircuitShortCircuits();
    }
  }

  private async refreshQueueDepthGauge(): Promise<void> {
    try {
      const probe = await this.queueProbe.probeEmailQueue();
      this.metrics.setBullmqQueueDepth('email', probe.depth);
    } catch {
      this.metrics.setBullmqQueueDepth('email', -1);
    }
  }

  private refreshTracingGauge(): void {
    this.metrics.setTracingActiveSpans(this.tracing.getActiveSpanCount());
  }

  private async refreshOutboxLagGauge(): Promise<void> {
    try {
      const result = await this.db.execute<{ lag: string }>(sql`
        SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))::text AS lag
        FROM outbox_events
        WHERE processed_at IS NULL
      `);
      const lagSeconds = parseFloat(String(result?.[0]?.lag ?? '0'));
      this.metrics.setOutboxLag(Number.isFinite(lagSeconds) ? lagSeconds : 0);
    } catch {
      // Outbox table may not exist in test environments; report
      // zero lag so the metrics endpoint remains operational.
      this.metrics.setOutboxLag(0);
    }
  }
}