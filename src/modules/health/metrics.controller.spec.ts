import { ConfigService } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import type { Request, Response } from 'express';

interface FakeDb {
  execute: jest.Mock;
}

interface FakeRedis {
  getCircuitMetrics: jest.Mock;
}

interface FakeTracing {
  getActiveSpanCount: jest.Mock;
}

interface FakeQueueProbe {
  probeEmailQueue: jest.Mock;
}

interface FakeMetrics {
  setRedisCircuitState: jest.Mock;
  incRedisCircuitShortCircuits: jest.Mock;
  setBullmqQueueDepth: jest.Mock;
  setTracingActiveSpans: jest.Mock;
  setOutboxLag: jest.Mock;
  setOutboxDlqCount: jest.Mock;
  render: jest.Mock;
}

interface FakeRes {
  status: jest.Mock;
}

function buildController(opts: { token?: string | null; nodeEnv: string }) {
  const db: FakeDb = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
  const redisService: FakeRedis = {
    getCircuitMetrics: jest.fn(() => ({
      state: 'closed',
      consecutiveFailures: 0,
      shortCircuitedCount: 0,
    })),
  };
  const tracing: FakeTracing = { getActiveSpanCount: jest.fn(() => 0) };
  const queueProbe: FakeQueueProbe = {
    probeEmailQueue: jest.fn().mockResolvedValue({ depth: 0, workerConnected: true }),
  };
  const metrics: FakeMetrics = {
    setRedisCircuitState: jest.fn(),
    incRedisCircuitShortCircuits: jest.fn(),
    setBullmqQueueDepth: jest.fn(),
    setTracingActiveSpans: jest.fn(),
    setOutboxLag: jest.fn(),
    setOutboxDlqCount: jest.fn(),
    render: jest.fn(() => 'metric_output'),
  };

  const config: { get: jest.Mock } = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return opts.nodeEnv;
      if (key === 'PROMETHEUS_SCRAPE_TOKEN') return opts.token ?? null;
      return null;
    }),
  };

  return {
    db,
    redisService,
    tracing,
    queueProbe,
    metrics,
    config,
    controller: new MetricsController(
      metrics as never,
      redisService as never,
      tracing as never,
      queueProbe as never,
      db as never,
      config as unknown as ConfigService,
    ),
  };
}

function buildResponse(): FakeRes {
  return { status: jest.fn().mockReturnThis() };
}

const buildRequest = (headerToken: string | undefined): Request =>
  ({
    headers: headerToken !== undefined ? { 'x-prometheus-token': headerToken } : {},
  }) as unknown as Request;

describe('MetricsController — Prometheus scrape token', () => {
  it('rejects with 401 when PROMETHEUS_SCRAPE_TOKEN is set in production and the header is missing', async () => {
    const ctx = buildController({
      token: 'super-secret-token',
      nodeEnv: 'production',
    });
    const res = buildResponse();

    await expect(
      ctx.controller.scrape(buildRequest(undefined), res as unknown as Response),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects with 401 when PROMETHEUS_SCRAPE_TOKEN is set in production and the header does not match', async () => {
    const ctx = buildController({
      token: 'super-secret-token',
      nodeEnv: 'production',
    });
    const res = buildResponse();

    await expect(
      ctx.controller.scrape(buildRequest('wrong-token'), res as unknown as Response),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns metrics when PROMETHEUS_SCRAPE_TOKEN matches in production', async () => {
    const ctx = buildController({
      token: 'super-secret-token',
      nodeEnv: 'production',
    });
    const res = buildResponse();

    const output = await ctx.controller.scrape(
      buildRequest('super-secret-token'),
      res as unknown as Response,
    );

    expect(output).toBe('metric_output');
    expect(ctx.metrics.render).toHaveBeenCalledTimes(1);
  });

  it('does not require the header when NODE_ENV is development', async () => {
    const ctx = buildController({ token: undefined, nodeEnv: 'development' });
    const res = buildResponse();

    const output = await ctx.controller.scrape(buildRequest(undefined), res as unknown as Response);

    expect(output).toBe('metric_output');
    expect(ctx.metrics.render).toHaveBeenCalledTimes(1);
  });

  it('does not require the header when NODE_ENV is test', async () => {
    const ctx = buildController({ token: undefined, nodeEnv: 'test' });
    const res = buildResponse();

    const output = await ctx.controller.scrape(buildRequest(undefined), res as unknown as Response);

    expect(output).toBe('metric_output');
    expect(ctx.metrics.render).toHaveBeenCalledTimes(1);
  });

  it('does not enforce the token in production when PROMETHEUS_SCRAPE_TOKEN is unset (fail-open at scrape layer; env validation catches this at boot)', async () => {
    const ctx = buildController({ token: undefined, nodeEnv: 'production' });
    const res = buildResponse();

    const output = await ctx.controller.scrape(buildRequest(undefined), res as unknown as Response);

    expect(output).toBe('metric_output');
  });

  it('rejects tokens that differ in length (no early-return timing channel)', async () => {
    const ctx = buildController({
      token: 'super-secret-token',
      nodeEnv: 'production',
    });
    const res = buildResponse();

    await expect(
      ctx.controller.scrape(buildRequest('super-secret-tok'), res as unknown as Response),
    ).rejects.toMatchObject({ status: 401 });

    await expect(
      ctx.controller.scrape(buildRequest('super-secret-tokenX'), res as unknown as Response),
    ).rejects.toMatchObject({ status: 401 });
  });
});
