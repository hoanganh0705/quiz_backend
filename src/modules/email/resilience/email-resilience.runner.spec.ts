/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { EmailResilienceRunner } from './email-resilience.runner';
import type { EmailConfig } from '@/core/config';

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

const makeEmailConfig = (overrides: Partial<EmailConfig> = {}): EmailConfig =>
  ({
    provider: 'resend',
    fromAddress: 'noreply@example.com',
    fromName: 'Test',
    resendApiKey: 're_test',
    sendTimeoutMs: 5_000,
    queueConcurrency: 5,
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 1_000 },
    ...overrides,
  }) as EmailConfig;

describe('EmailResilienceRunner', () => {
  describe('onModuleInit', () => {
    it('registers a state-change listener that logs every transition', async () => {
      const logger = makeLogger();
      const runner = new EmailResilienceRunner(makeEmailConfig(), logger);
      runner.onModuleInit();

      await expect(
        runner.runWithResilience(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      await expect(
        runner.runWithResilience(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      await expect(
        runner.runWithResilience(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'email_resend_circuit_state',
          from: 'closed',
          to: 'open',
        }),
      );
    });
  });

  describe('runWithResilience', () => {
    it('returns the task result on success', async () => {
      const runner = new EmailResilienceRunner(makeEmailConfig(), makeLogger());
      runner.onModuleInit();
      const task = jest.fn(async () => 'ok');
      const result = await runner.runWithResilience(task);
      expect(result).toBe('ok');
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('throws the task error verbatim on failure', async () => {
      const runner = new EmailResilienceRunner(makeEmailConfig(), makeLogger());
      runner.onModuleInit();
      await expect(
        runner.runWithResilience(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });

    it('aborts the signal after sendTimeoutMs and rejects with a timeout error', async () => {
      const runner = new EmailResilienceRunner(
        makeEmailConfig({ sendTimeoutMs: 50 }),
        makeLogger(),
      );
      runner.onModuleInit();

      const signalHolder: { signal: AbortSignal | null } = { signal: null };
      await expect(
        runner.runWithResilience(
          (signal) =>
            new Promise<string>((_resolve, reject) => {
              signalHolder.signal = signal;
              signal.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        ),
      ).rejects.toThrow(/timed out after 50ms/);

      expect(signalHolder.signal).not.toBeNull();
      expect(signalHolder.signal?.aborted).toBe(true);
    });
  });

  describe('getCircuitState', () => {
    it('reflects the breaker state', async () => {
      const runner = new EmailResilienceRunner(
        makeEmailConfig({ circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 1_000 } }),
        makeLogger(),
      );
      runner.onModuleInit();
      expect(runner.getCircuitState()).toBe('closed');

      await expect(
        runner.runWithResilience(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      expect(runner.getCircuitState()).toBe('open');
    });
  });
});
