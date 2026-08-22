/// <reference types="jest" />
/**
 * Phase 5 #2 — `/metrics` endpoint E2E test (no DB / Redis).
 *
 * Boots a lightweight module with stub probes and asserts:
 *   - `GET /metrics` returns 200 with `text/plain; version=0.0.4`.
 *   - The body contains the canonical `# HELP` and `# TYPE` lines.
 *   - Gauges are refreshed on every scrape.
 *   - No DB / Redis / BullMQ dependency is required for the test
 *     itself — the controller calls probe methods, and we stub
 *     them with in-memory fakes that return deterministic values.
 */
import {
  Controller,
  Get,
  INestApplication,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { ApiResponse } from '@/common/responses/api-response';
import { MetricsController } from '@/modules/health/metrics.controller';
import {
  MetricsRegistry,
  METRICS_REGISTRY,
} from '@/core/observability/metrics.registry';
import { TracingProvider } from '@/core/observability/tracing.provider';
import { TRACING_PROVIDER } from '@/core/observability/tracing.provider';
import { DRIZZLE, DRIZZLE_READ } from '@/core/database/drizzle.constants';
import { RedisService } from '@/core/redis/redis.service';
import { HealthQueueProbe } from '@/modules/health/health-queue-probe';

class StubTracingProvider extends TracingProvider {
  constructor() {
    super({} as never);
  }
}

const stubQueueProbe = {
  probeEmailQueue: async () => ({ depth: 7, workerConnected: true }),
};

const stubRedisService = {
  getCircuitMetrics: () => ({
    state: 'open' as const,
    consecutiveFailures: 3,
    shortCircuitedCount: 12,
  }),
  ping: async () => 'PONG',
};

@Controller('health')
class StubHealthController {
  @Get()
  check() {
    return ApiResponse.ok({ status: 'up' });
  }
}

@Module({
  controllers: [MetricsController, StubHealthController],
  providers: [
    MetricsRegistry,
    { provide: METRICS_REGISTRY, useExisting: MetricsRegistry },
    { provide: TRACING_PROVIDER, useClass: StubTracingProvider },
    { provide: RedisService, useValue: stubRedisService },
    { provide: HealthQueueProbe, useValue: stubQueueProbe },
    { provide: DRIZZLE, useValue: { execute: async () => [] } },
    { provide: DRIZZLE_READ, useValue: { execute: async () => [] } },
  ],
})
class StubAppModule {}

describe('Phase 5 #2 — /metrics endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), StubAppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with Prometheus text format', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# HELP quiz_http_request_duration_seconds');
    expect(res.text).toContain('# TYPE quiz_redis_circuit_state gauge');
    expect(res.text).toContain('quiz_redis_circuit_state{state="open"} 1');
  });

  it('refreshes the BullMQ queue depth gauge on every scrape', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.text).toMatch(/quiz_bullmq_queue_depth\{queue="email"\} 7/);
  });

  it('refreshes the Redis circuit state gauge on every scrape', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.text).toMatch(/quiz_redis_circuit_state\{state="open"\} 1/);
    expect(res.text).toMatch(/quiz_redis_circuit_state\{state="closed"\} 0/);
  });

  it('exposes tracing-active-spans gauge', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.text).toMatch(/quiz_tracing_active_spans\{series="active"\} \d+/);
  });

  it('exposes outbox-lag-seconds gauge', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.text).toMatch(/quiz_outbox_lag_seconds/);
  });
});