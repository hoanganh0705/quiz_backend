import { CronExpression } from '@nestjs/schedule';
import { InstanceAbandonmentSchedulerService } from './instance-abandonment-scheduler.service';
import type { QuizInstanceRepositoryPort } from '../../domain/ports';

const ORIGINAL_OVERRIDE = process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'];

describe('InstanceAbandonmentSchedulerService — cron cadence', () => {
  afterEach(() => {
    if (ORIGINAL_OVERRIDE === undefined) {
      delete process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'];
    } else {
      process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'] = ORIGINAL_OVERRIDE;
    }
  });

  it('defaults to EVERY_30_SECONDS when no override env var is set', () => {
    delete process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'];
    expect(InstanceAbandonmentSchedulerService.CRON_EXPRESSION).toBe(
      CronExpression.EVERY_30_SECONDS,
    );
  });

  it('honors INSTANCE_ABANDONMENT_CRON_OVERRIDE when provided', () => {
    process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'] = '*/10 * * * * *';
    expect(InstanceAbandonmentSchedulerService.CRON_EXPRESSION).toBe('*/10 * * * * *');
  });

  it('falls back to the default when the override is whitespace', () => {
    process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE'] = '   ';
    expect(InstanceAbandonmentSchedulerService.CRON_EXPRESSION).toBe(
      CronExpression.EVERY_30_SECONDS,
    );
  });
});

describe('InstanceAbandonmentSchedulerService — 5-minute TTL and abandonment execution', () => {
  function makeRepo(rows: Array<{ instanceId: string; version: number }>, findMock?: jest.Mock) {
    return {
      findAbandonedInstances: findMock ?? jest.fn().mockResolvedValue(rows),
    } as unknown as QuizInstanceRepositoryPort;
  }

  it('queries findAbandonedInstances with a 5-minute cutoff timestamp', async () => {
    const findAbandonedInstances = jest.fn().mockResolvedValue([]);
    const repo = makeRepo([], findAbandonedInstances);
    const instanceService = {
      abandonInstanceByScheduler: jest.fn(),
    };

    const svc = new InstanceAbandonmentSchedulerService(instanceService as any, repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);

    const beforeCall = Date.now();
    await svc.handleAbandonedInstances();
    const afterCall = Date.now();

    expect(findAbandonedInstances).toHaveBeenCalledTimes(1);
    const callArg = findAbandonedInstances.mock.calls[0][0];
    expect(callArg.limit).toBe(InstanceAbandonmentSchedulerService.BATCH_SIZE);

    const cutoffEpoch = new Date(callArg.cutoffIso).getTime();
    const expectedFiveMinsBefore =
      beforeCall - InstanceAbandonmentSchedulerService.ABANDONMENT_TTL_MS;
    expect(cutoffEpoch).toBeGreaterThanOrEqual(expectedFiveMinsBefore - 50);
    expect(cutoffEpoch).toBeLessThanOrEqual(
      afterCall - InstanceAbandonmentSchedulerService.ABANDONMENT_TTL_MS + 50,
    );
    expect(instanceService.abandonInstanceByScheduler).not.toHaveBeenCalled();
  });

  it('processes abandoned rows with bounded concurrency', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      instanceId: `inst-${i}`,
      version: 1,
    }));
    const callOrder: string[] = [];
    const instanceService = {
      abandonInstanceByScheduler: jest.fn().mockImplementation(async () => {
        callOrder.push('start');
        await new Promise((r) => setImmediate(r));
        callOrder.push('end');
        return { abandoned: true, status: 'closed', closedAt: new Date().toISOString() };
      }),
    };
    const repo = makeRepo(rows);

    const svc = new InstanceAbandonmentSchedulerService(instanceService as any, repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);

    const start = Date.now();
    await svc.handleAbandonedInstances();
    const elapsed = Date.now() - start;

    expect(instanceService.abandonInstanceByScheduler).toHaveBeenCalledTimes(20);
    expect(instanceService.abandonInstanceByScheduler).toHaveBeenCalledWith({
      instanceId: 'inst-0',
      expectedVersion: 1,
    });
    expect(elapsed).toBeLessThan(300);
  });

  it('does not throw when individual abandonment calls fail', async () => {
    const instanceService = {
      abandonInstanceByScheduler: jest
        .fn()
        .mockRejectedValueOnce(new Error('db connection error'))
        .mockResolvedValue({
          abandoned: true,
          status: 'closed',
          closedAt: new Date().toISOString(),
        }),
    };
    const repo = makeRepo([
      { instanceId: 'inst-1', version: 1 },
      { instanceId: 'inst-2', version: 2 },
    ]);

    const svc = new InstanceAbandonmentSchedulerService(instanceService as any, repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);

    await expect(svc.handleAbandonedInstances()).resolves.toBeUndefined();
    expect(instanceService.abandonInstanceByScheduler).toHaveBeenCalledTimes(2);
  });

  it('handles query failure gracefully without crashing', async () => {
    const repo = {
      findAbandonedInstances: jest.fn().mockRejectedValue(new Error('table locked')),
    } as unknown as QuizInstanceRepositoryPort;
    const instanceService = {
      abandonInstanceByScheduler: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const svc = new InstanceAbandonmentSchedulerService(
      instanceService as any,
      repo,
      logger as any,
    );

    await expect(svc.handleAbandonedInstances()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'instance_abandonment_scheduler_query_failed',
      }),
    );
  });

  it('disconnects ghost players when instanceAppService reports 0 active sockets', async () => {
    const repo = {
      findAbandonedInstances: jest.fn().mockResolvedValue([{ instanceId: 'inst-ghost', version: 1 }]),
      disconnectPlayersByInstance: jest.fn().mockResolvedValue(undefined),
    } as unknown as QuizInstanceRepositoryPort;
    const instanceService = {
      abandonInstanceByScheduler: jest.fn().mockResolvedValue({
        abandoned: true,
        status: 'closed',
        closedAt: new Date().toISOString(),
      }),
    };
    const mockAppService = {
      getActiveRoomSocketCount: jest.fn().mockReturnValue(0),
    };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const svc = new InstanceAbandonmentSchedulerService(
      instanceService as any,
      repo,
      logger as any,
      mockAppService as any,
    );

    await svc.handleAbandonedInstances();

    expect(mockAppService.getActiveRoomSocketCount).toHaveBeenCalledWith('inst-ghost');
    expect(repo.disconnectPlayersByInstance).toHaveBeenCalledWith('inst-ghost');
    expect(instanceService.abandonInstanceByScheduler).toHaveBeenCalledWith({
      instanceId: 'inst-ghost',
      expectedVersion: 1,
    });
  });

  it('runs handleAbandonedInstances on onModuleInit', async () => {
    const repo = {
      findAbandonedInstances: jest.fn().mockResolvedValue([]),
    } as unknown as QuizInstanceRepositoryPort;
    const instanceService = {
      abandonInstanceByScheduler: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const svc = new InstanceAbandonmentSchedulerService(
      instanceService as any,
      repo,
      logger as any,
    );

    await svc.onModuleInit();

    expect(repo.findAbandonedInstances).toHaveBeenCalled();
  });
});
