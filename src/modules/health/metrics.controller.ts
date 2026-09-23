import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { ApiExcludeController } from '@nestjs/swagger';
import { METRICS_REGISTRY, type MetricsRegistry } from '@/core/observability/metrics.registry';
import { RedisService } from '@/core/redis/redis.service';
import { TracingProvider } from '@/core/observability/tracing.provider';
import { TRACING_PROVIDER } from '@/core/observability/tracing.provider';
import { HealthQueueProbe } from './health-queue-probe';
import { DRIZZLE_READ } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';

const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

type OutboxLagRow = { lag: string };
type OutboxLagResult = { rows: OutboxLagRow[] };

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
    this.refreshCircuitGauge();
    await this.refreshQueueDepthGauge();
    this.refreshTracingGauge();
    await this.refreshOutboxLagGauge();
    await this.refreshOutboxDlqGauge();

    res.status(200);
    return this.metrics.render();
  }

  private refreshCircuitGauge(): void {
    const m = this.redisService.getCircuitMetrics();
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
      const result = (await this.db.execute(sql`
        SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))::text AS lag
        FROM outbox_events
        WHERE processed_at IS NULL
      `)) as unknown as OutboxLagResult;
      const lagSeconds = parseFloat(String(result.rows[0]?.lag ?? '0'));
      this.metrics.setOutboxLag(Number.isFinite(lagSeconds) ? lagSeconds : 0);
    } catch {
      this.metrics.setOutboxLag(0);
    }
  }

  private async refreshOutboxDlqGauge(): Promise<void> {
    try {
      const result = (await this.db.execute(sql`
        SELECT aggregate_type, COUNT(*)::int AS count
        FROM outbox_events
        WHERE processed_at IS NULL
          AND failed_at IS NOT NULL
          AND dlq_reason IS NOT NULL
        GROUP BY aggregate_type
      `)) as unknown as { rows: Array<{ aggregate_type: string; count: number }> };
      for (const row of result.rows) {
        this.metrics.setOutboxDlqCount(row.aggregate_type, row.count);
      }
    } catch {
      // best-effort — non-zero DLQ counts will just be absent from the scrape
    }
  }
}
