import { Controller, Get, Header, Inject, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
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
const PROMETHEUS_TOKEN_HEADER = 'x-prometheus-token';

type OutboxLagRow = { lag: string };
type OutboxLagResult = { rows: OutboxLagRow[] };

const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const readPrometheusToken = (req: Request): string | undefined => {
  const raw = req.headers[PROMETHEUS_TOKEN_HEADER];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
};

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
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header('Content-Type', METRICS_CONTENT_TYPE)
  async scrape(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<string> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const configuredToken = this.configService.get<string | null>('PROMETHEUS_SCRAPE_TOKEN');

    if (nodeEnv === 'production' && configuredToken) {
      const headerToken = readPrometheusToken(req);
      if (!headerToken || !constantTimeEquals(headerToken, configuredToken)) {
        throw new UnauthorizedException('Prometheus scrape token is missing or invalid');
      }
    }

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
