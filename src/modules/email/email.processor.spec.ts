/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { EmailProcessor } from './email.processor';
import type { ConnectionOptions } from 'bullmq';
import { EMAIL_QUEUE_NAME } from './email.constants';
import { VerificationEmailHandler } from './handlers/verification.handler';
import { PasswordResetEmailHandler } from './handlers/password-reset.handler';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import type { EmailConfig } from '@/core/config';

jest.mock('bullmq', () => {
  type JobHandler = (job: {
    id: string;
    name: string;
    data: Record<string, unknown>;
  }) => Promise<void>;
  return {
    Worker: class FakeWorker {
      readonly handlers: Record<string, JobHandler> = {};
      readonly failedListeners: Array<(job: unknown, err: Error) => void> = [];
      readonly completedListeners: Array<
        (job: { id: string; name: string; data: Record<string, unknown> }) => void
      > = [];
      constructor(
        public readonly name: string,
        public readonly processor: (job: {
          id: string;
          name: string;
          data: Record<string, unknown>;
        }) => Promise<void>,
        public readonly opts: { connection: ConnectionOptions; concurrency: number },
      ) {}

      on(event: 'completed' | 'failed', listener: unknown): this {
        if (event === 'completed') {
          this.completedListeners.push(listener as never);
        } else if (event === 'failed') {
          this.failedListeners.push(listener as never);
        }
        return this;
      }

      async close(): Promise<void> {
        return;
      }

      async processOne(job: {
        id: string;
        name: string;
        data: Record<string, unknown>;
      }): Promise<void> {
        try {
          await this.processor(job);
          this.completedListeners.forEach((l) => l(job));
        } catch (err) {
          this.failedListeners.forEach((l) => l(job, err as Error));
          throw err;
        }
      }
    },
  };
});

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

const makeEmailConfig = (): EmailConfig =>
  ({
    provider: 'resend',
    fromAddress: 'noreply@example.com',
    fromName: 'Acme',
    resendApiKey: 're_test_key',
    sendTimeoutMs: 5_000,
    queueConcurrency: 5,
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30_000 },
  }) as EmailConfig;

const buildProcessor = () => {
  const logger = makeLogger();
  const verificationHandler = {
    jobName: 'sendVerificationEmail',
    process: jest.fn(async () => undefined),
  } as unknown as VerificationEmailHandler;
  const passwordResetHandler = {
    jobName: 'sendPasswordResetEmail',
    process: jest.fn(async () => undefined),
  } as unknown as PasswordResetEmailHandler;

  const processor = new EmailProcessor(
    { url: 'redis://localhost:6379' } as ConnectionOptions,
    makeEmailConfig(),
    verificationHandler,
    passwordResetHandler,
    logger,
  );
  return { processor, logger, verificationHandler, passwordResetHandler };
};

describe('EmailProcessor', () => {
  it('uses EMAIL_QUEUE_NAME as the queue name', () => {
    const { processor } = buildProcessor();
    processor.onModuleInit();
    const worker = (processor as unknown as { worker: { name: string } | null }).worker;
    expect(worker).not.toBeNull();
    expect(worker?.name).toBe(EMAIL_QUEUE_NAME);
  });

  it('uses the configured concurrency', () => {
    const { processor } = buildProcessor();
    processor.onModuleInit();
    const worker = (processor as unknown as { worker: { opts: { concurrency: number } } | null })
      .worker;
    expect(worker?.opts.concurrency).toBe(5);
  });

  it('restores the correlation ID from the job data and runs the matching handler', async () => {
    const { processor, verificationHandler } = buildProcessor();
    processor.onModuleInit();
    const worker = (
      processor as unknown as {
        worker: {
          processOne: (j: {
            id: string;
            name: string;
            data: Record<string, unknown>;
          }) => Promise<void>;
        } | null;
      }
    ).worker;
    const observedCorrelationIds: Array<string | undefined> = [];

    const correlationId = createCorrelationId();
    verificationHandler.process = jest.fn(async (_data, ctx) => {
      observedCorrelationIds.push(ctx.correlationId);
    }) as unknown as VerificationEmailHandler['process'];

    await worker!.processOne({
      id: 'job-1',
      name: 'sendVerificationEmail',
      data: { email: 'a@b.c', token: 't', correlationId },
    });

    expect(observedCorrelationIds).toEqual([correlationId]);
    expect(verificationHandler.process).toHaveBeenCalledTimes(1);
  });

  it('mints a fresh correlation ID when the job data is missing one', async () => {
    const { processor, verificationHandler } = buildProcessor();
    processor.onModuleInit();
    const worker = (
      processor as unknown as {
        worker: {
          processOne: (j: {
            id: string;
            name: string;
            data: Record<string, unknown>;
          }) => Promise<void>;
        } | null;
      }
    ).worker;

    verificationHandler.process = jest.fn(async (_data, ctx) => {
      expect(ctx.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    }) as unknown as VerificationEmailHandler['process'];

    await worker!.processOne({
      id: 'job-1',
      name: 'sendVerificationEmail',
      data: { email: 'a@b.c', token: 't' },
    });
  });

  it('warns and skips when no handler matches the job name', async () => {
    const { processor, logger } = buildProcessor();
    processor.onModuleInit();
    const worker = (
      processor as unknown as {
        worker: {
          processOne: (j: {
            id: string;
            name: string;
            data: Record<string, unknown>;
          }) => Promise<void>;
        } | null;
      }
    ).worker;

    await worker!.processOne({
      id: 'job-1',
      name: 'unknownJob',
      data: {},
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'email_job_unknown_type' }),
    );
  });

  it('logs a structured failure with attempts and finalAttempt flag', async () => {
    const { processor, logger, verificationHandler } = buildProcessor();
    processor.onModuleInit();
    const worker = (
      processor as unknown as {
        worker: {
          processOne: (j: {
            id: string;
            name: string;
            data: Record<string, unknown>;
          }) => Promise<void>;
        } | null;
      }
    ).worker;

    verificationHandler.process = jest.fn(async () => {
      throw new Error('boom');
    }) as unknown as VerificationEmailHandler['process'];

    await expect(
      worker!.processOne({
        id: 'job-1',
        name: 'sendVerificationEmail',
        data: { email: 'a@b.c', token: 't', userId: 'u-1' },
        opts: { attempts: 3 },
        attemptsMade: 3,
      } as unknown as { id: string; name: string; data: Record<string, unknown> }),
    ).rejects.toThrow('boom');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'email_job_failed',
        attemptsMade: 3,
        configuredAttempts: 3,
        isFinalAttempt: true,
        userId: 'u-1',
      }),
    );
  });

  it('onModuleDestroy closes the underlying worker', async () => {
    const { processor } = buildProcessor();
    processor.onModuleInit();
    await processor.onModuleDestroy();
    const worker = (processor as unknown as { worker: unknown }).worker;
    expect(worker).toBeNull();
  });

  it('correlation ID storage is active during handler execution', async () => {
    const { processor, verificationHandler } = buildProcessor();
    processor.onModuleInit();
    const worker = (
      processor as unknown as {
        worker: {
          processOne: (j: {
            id: string;
            name: string;
            data: Record<string, unknown>;
          }) => Promise<void>;
        } | null;
      }
    ).worker;

    const correlationId = createCorrelationId();
    let insideCorrelationId: string | undefined;
    verificationHandler.process = jest.fn(async () => {
      insideCorrelationId = correlationIdStorage.getStore()?.correlationId;
    }) as unknown as VerificationEmailHandler['process'];

    await worker!.processOne({
      id: 'job-1',
      name: 'sendVerificationEmail',
      data: { email: 'a@b.c', token: 't', correlationId },
    });

    expect(insideCorrelationId).toBe(correlationId);
  });
});
