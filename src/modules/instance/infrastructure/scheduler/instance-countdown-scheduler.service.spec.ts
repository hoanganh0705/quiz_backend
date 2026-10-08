import { CronExpression } from '@nestjs/schedule';
import { InstanceCountdownSchedulerService } from './instance-countdown-scheduler.service';
import type { QuizInstanceRepositoryPort } from '../../domain/ports';

const ORIGINAL_OVERRIDE = process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'];

describe('InstanceCountdownSchedulerService — cron cadence', () => {
  afterEach(() => {
    if (ORIGINAL_OVERRIDE === undefined) {
      delete process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'];
    } else {
      process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'] = ORIGINAL_OVERRIDE;
    }
  });

  it('defaults to EVERY_5_SECONDS when no override env var is set', () => {
    delete process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'];
    expect(InstanceCountdownSchedulerService.CRON_EXPRESSION).toBe(CronExpression.EVERY_5_SECONDS);
  });

  it('honors INSTANCE_COUNTDOWN_CRON_OVERRIDE when provided', () => {
    process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'] = '*/15 * * * * *';
    expect(InstanceCountdownSchedulerService.CRON_EXPRESSION).toBe('*/15 * * * * *');
  });

  it('falls back to the default when the override is whitespace', () => {
    process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE'] = '   ';
    expect(InstanceCountdownSchedulerService.CRON_EXPRESSION).toBe(CronExpression.EVERY_5_SECONDS);
  });
});

describe('InstanceCountdownSchedulerService — parallel processing', () => {
  function makeRepo(
    rows: Array<{ instanceId: string; version: number; countdownStartedAt: string }>,
  ) {
    return {
      findDueCountdowns: jest.fn().mockResolvedValue(rows),
    } as unknown as QuizInstanceRepositoryPort;
  }

  it('processes rows with bounded concurrency', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      instanceId: `inst-${i}`,
      version: 1,
      countdownStartedAt: new Date().toISOString(),
    }));
    const callOrder: string[] = [];
    const instanceService = {
      completeCountdownByScheduler: jest.fn().mockImplementation(async () => {
        callOrder.push('start');
        await new Promise((r) => setImmediate(r));
        callOrder.push('end');
        return { completed: true };
      }),
    };
    const repo = makeRepo(rows);

    const svc = new InstanceCountdownSchedulerService(instanceService as any, repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);

    const start = Date.now();
    await svc.handleDueCountdowns();
    const elapsed = Date.now() - start;

    expect(instanceService.completeCountdownByScheduler).toHaveBeenCalledTimes(20);
    expect(elapsed).toBeLessThan(200);
  });

  it('does not throw when individual countdowns fail', async () => {
    const instanceService = {
      completeCountdownByScheduler: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ completed: true }),
    };
    const repo = makeRepo([
      { instanceId: 'inst-1', version: 1, countdownStartedAt: new Date().toISOString() },
      { instanceId: 'inst-2', version: 1, countdownStartedAt: new Date().toISOString() },
    ]);

    const svc = new InstanceCountdownSchedulerService(instanceService as any, repo, {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any);

    await expect(svc.handleDueCountdowns()).resolves.toBeUndefined();
  });
});
