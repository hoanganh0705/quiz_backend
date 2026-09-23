/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { Queue } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';
import { EmailService } from './email.service';
import { EMAIL_JOB_NAMES, EMAIL_JOB_RETRY_POLICY } from './email.constants';
import type { SendPasswordResetEmailJobData, SendVerificationEmailJobData } from './email.types';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const makeLogger = (): PinoLogger =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  }) as unknown as PinoLogger;

interface QueueCall {
  readonly name: string;
  readonly data: SendVerificationEmailJobData | SendPasswordResetEmailJobData;
}

const makeQueue = (
  opts: { failOn?: string } = {},
): {
  queue: Queue<SendVerificationEmailJobData | SendPasswordResetEmailJobData>;
  calls: QueueCall[];
} => {
  const calls: QueueCall[] = [];
  const queue = {
    add: jest.fn(
      async (name: string, data: SendVerificationEmailJobData | SendPasswordResetEmailJobData) => {
        if (opts.failOn === name) {
          throw new Error('redis down');
        }
        calls.push({ name, data });
        return { id: `job-${calls.length}`, name };
      },
    ),
    close: jest.fn(async () => undefined),
  } as unknown as Queue<SendVerificationEmailJobData | SendPasswordResetEmailJobData>;
  return { queue, calls };
};

describe('EmailService', () => {
  describe('enqueueVerificationEmail', () => {
    it('adds a verification job with the captured correlation ID and retry policy', async () => {
      const captured = createCorrelationId();
      await correlationIdStorage.run({ correlationId: captured }, async () => {
        const { queue, calls } = makeQueue();
        const service = new EmailService(queue, makeLogger());
        await service.enqueueVerificationEmail('user@example.com', 'token-123', 'user-1');

        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe(EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL);
        expect(calls[0].data).toMatchObject({
          email: 'user@example.com',
          token: 'token-123',
          userId: 'user-1',
          correlationId: captured,
        });
      });
    });

    it('mints a fresh correlation ID when called outside an HTTP request', async () => {
      const { queue, calls } = makeQueue();
      const service = new EmailService(queue, makeLogger());
      await service.enqueueVerificationEmail('user@example.com', 'token-123');

      expect(calls[0].data.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('logs the enqueue event with the job ID and correlation ID', async () => {
      const logger = makeLogger();
      const { queue } = makeQueue();
      const service = new EmailService(queue, logger);

      await service.enqueueVerificationEmail('user@example.com', 't', 'user-1');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'email_job_enqueued',
          jobName: EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
          jobId: 'job-1',
          userId: 'user-1',
          correlationId: expect.any(String),
        }),
      );
    });

    it('logs an error and throws a sanitised Error when queue.add fails', async () => {
      const logger = makeLogger();
      const { queue } = makeQueue({ failOn: EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL });
      const service = new EmailService(queue, logger);

      await expect(
        service.enqueueVerificationEmail('user@example.com', 't', 'user-1'),
      ).rejects.toThrow('Unable to queue verification email');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'email_job_enqueue_failed',
          jobName: EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
        }),
      );
    });
  });

  describe('enqueuePasswordResetEmail', () => {
    it('adds a password reset job with the captured correlation ID', async () => {
      const captured = createCorrelationId();
      await correlationIdStorage.run({ correlationId: captured }, async () => {
        const { queue, calls } = makeQueue();
        const service = new EmailService(queue, makeLogger());
        await service.enqueuePasswordResetEmail('user@example.com', 'reset-token', 'user-1');

        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe(EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL);
        expect(calls[0].data).toMatchObject({
          email: 'user@example.com',
          token: 'reset-token',
          userId: 'user-1',
          correlationId: captured,
        });
      });
    });

    it('throws a sanitised Error and logs the failure when queue.add fails', async () => {
      const logger = makeLogger();
      const { queue } = makeQueue({ failOn: EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL });
      const service = new EmailService(queue, logger);

      await expect(
        service.enqueuePasswordResetEmail('user@example.com', 't', 'user-1'),
      ).rejects.toThrow('Unable to queue password reset email');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'email_job_enqueue_failed',
          jobName: EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL,
        }),
      );
    });
  });

  describe('retry policy', () => {
    it('uses the shared EMAIL_JOB_RETRY_POLICY for every job', async () => {
      const { queue } = makeQueue();
      const addSpy = queue.add as unknown as jest.Mock;
      const service = new EmailService(queue, makeLogger());

      await service.enqueueVerificationEmail('a@b.c', 't', 'u-1');
      await service.enqueuePasswordResetEmail('a@b.c', 't', 'u-1');

      expect(addSpy.mock.calls[0][2]).toEqual(EMAIL_JOB_RETRY_POLICY);
      expect(addSpy.mock.calls[1][2]).toEqual(EMAIL_JOB_RETRY_POLICY);
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the underlying queue', async () => {
      const { queue } = makeQueue();
      const service = new EmailService(queue, makeLogger());
      await service.onModuleDestroy();
      expect(queue.close as jest.Mock).toHaveBeenCalled();
    });
  });
});
