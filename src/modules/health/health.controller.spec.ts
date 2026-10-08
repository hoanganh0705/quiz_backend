/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Response } from 'express';
import { HealthController } from './health.controller';

interface FakeDb {
  execute: jest.Mock;
}

interface FakeRedis {
  ping: jest.Mock;
  getCircuitMetrics: jest.Mock;
}

interface FakeStorage {
  ping: jest.Mock;
}

interface FakePresenter {
  check: jest.Mock;
}

interface FakeQueueProbe {
  probeEmailQueue: jest.Mock;
  probeTournamentQueue: jest.Mock;
}

interface FakeRes {
  status: jest.Mock;
}

const HEALTHY_EMAIL_QUEUE = {
  depth: 0,
  active: 0,
  waiting: 0,
  delayed: 0,
  failed: 0,
  stalled: 0,
  workerConnected: true,
};

const HEALTHY_TOURNAMENT_QUEUE = {
  depth: 0,
  active: 0,
  waiting: 0,
  delayed: 0,
  failed: 0,
  stalled: 0,
  workerConnected: true,
};

function buildController() {
  const db: FakeDb = { execute: jest.fn() };
  const redisService: FakeRedis = {
    ping: jest.fn(),
    getCircuitMetrics: jest.fn(() => ({
      state: 'closed',
      consecutiveFailures: 0,
      shortCircuitedCount: 0,
    })),
  };
  const storage: FakeStorage = { ping: jest.fn() };
  const presenter: FakePresenter = { check: jest.fn((p) => ({ data: p })) };
  const queueProbe: FakeQueueProbe = {
    probeEmailQueue: jest.fn().mockResolvedValue({ ...HEALTHY_EMAIL_QUEUE }),
    probeTournamentQueue: jest.fn().mockResolvedValue({ ...HEALTHY_TOURNAMENT_QUEUE }),
  };

  return {
    db,
    redisService,
    storage,
    presenter,
    queueProbe,
    controller: new HealthController(
      db as never,
      redisService as never,
      storage as never,
      presenter,
      queueProbe as never,
    ),
  };
}

function buildResponse(): FakeRes {
  return { status: jest.fn().mockReturnThis() };
}

describe('HealthController', () => {
  it('reports up when every probe is healthy and returns 200', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(ctx.presenter.check).toHaveBeenCalledTimes(1);
    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.status).toBe('up');
    expect(payload.database).toBe('up');
    expect(payload.redis.status).toBe('up');
    expect(payload.storage.status).toBe('up');
    expect(payload.emailQueue).toEqual({ ...HEALTHY_EMAIL_QUEUE });
    expect(payload.tournamentEventsQueue).toEqual({ ...HEALTHY_TOURNAMENT_QUEUE });
    expect(payload.redisCircuit).toEqual({
      state: 'closed',
      consecutiveFailures: 0,
      shortCircuitedCount: 0,
    });
  });

  it('surfaces the email-queue depth and stalled count in the payload', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    ctx.queueProbe.probeEmailQueue.mockResolvedValue({
      depth: 12,
      active: 1,
      waiting: 7,
      delayed: 4,
      failed: 2,
      stalled: 3,
      workerConnected: true,
    });
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.emailQueue).toEqual({
      depth: 12,
      active: 1,
      waiting: 7,
      delayed: 4,
      failed: 2,
      stalled: 3,
      workerConnected: true,
    });
  });

  it('surfaces the tournament-events queue depth and stalled count', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    ctx.queueProbe.probeTournamentQueue.mockResolvedValue({
      depth: 5,
      active: 0,
      waiting: 3,
      delayed: 2,
      failed: 1,
      stalled: 0,
      workerConnected: false,
    });
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.tournamentEventsQueue).toEqual({
      depth: 5,
      active: 0,
      waiting: 3,
      delayed: 2,
      failed: 1,
      stalled: 0,
      workerConnected: false,
    });
  });

  it('invokes both probe methods in parallel', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    expect(ctx.queueProbe.probeEmailQueue).toHaveBeenCalledTimes(1);
    expect(ctx.queueProbe.probeTournamentQueue).toHaveBeenCalledTimes(1);
  });

  it('treats a non-string redis reply as degraded', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue(42);
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.status).toBe('degraded');
    expect(payload.redis.status).toBe('degraded');
    expect(payload.redis.detail).toMatch(/42/);
  });

  it('reports degraded (200) when redis ping throws', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockRejectedValue(new Error('boom'));
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.status).toBe('degraded');
    expect(payload.redis.status).toBe('down');
    expect(payload.redis.detail).toBe('boom');
  });

  it('reports degraded (200) when storage ping throws', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockRejectedValue(new Error('storage down'));
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.status).toBe('degraded');
    expect(payload.storage.status).toBe('down');
    expect(payload.storage.detail).toBe('storage down');
  });

  it('reports down and 503 when the database probe throws', async () => {
    const ctx = buildController();
    ctx.db.execute.mockRejectedValue(new Error('db gone'));
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.status).toBe('down');
    expect(payload.database).toBe('down');
  });

  it('uses null detail in the healthy branches', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.redis.detail).toBeNull();
    expect(payload.storage.detail).toBeNull();
  });

  it('preserves circuit-breaker failure counts from redis', async () => {
    const ctx = buildController();
    ctx.db.execute.mockResolvedValue(undefined);
    ctx.redisService.ping.mockResolvedValue('PONG');
    ctx.storage.ping.mockResolvedValue(undefined);
    ctx.redisService.getCircuitMetrics.mockReturnValue({
      state: 'open',
      consecutiveFailures: 5,
      shortCircuitedCount: 12,
    });
    const res = buildResponse();

    await ctx.controller.check(res as unknown as Response);

    const payload = ctx.presenter.check.mock.calls[0][0];
    expect(payload.redisCircuit).toEqual({
      state: 'open',
      consecutiveFailures: 5,
      shortCircuitedCount: 12,
    });
  });
});
