import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData, SendPasswordResetEmailJobData } from './email.types';
import type { EmailProvider } from '@/common/ports/email.provider';
import { createCorrelationId, getCorrelationId } from '@/common/interceptors/correlation-id';

/**
 * EmailService — Enqueues email jobs on the BullMQ email queue.
 *
 * Correlation ID handling
 * -----------------------
 * Every job carries a `correlationId` in its `data` so the
 * worker (which runs outside any HTTP request) can restore the
 * trace context and join the same correlation chain as the
 * originating HTTP request. The ID is captured here at enqueue
 * time, while the `correlationIdStorage` AsyncLocalStorage
 * still holds the request-scoped ID populated by
 * `CorrelationInterceptor`.
 *
 * If the caller is not inside an HTTP request (rare — only
 * happens for jobs enqueued from a one-off script or a
 * background job that itself has no parent), `getCorrelationId()`
 * returns `undefined` and we fall back to a fresh UUID via
 * `createCorrelationId()`. Either way, every job has a
 * non-empty correlation ID, which means the worker's
 * "no correlation ID" branch is only hit when the *job data*
 * was tampered with in Redis — and even then the worker
 * mints a fresh one.
 */
@Injectable()
export class EmailService implements EmailProvider, OnModuleDestroy {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: Queue<
      SendVerificationEmailJobData | SendPasswordResetEmailJobData
    >,
    @InjectPinoLogger(EmailService.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.emailQueue.close();
  }

  async enqueueVerificationEmail(email: string, token: string, userId?: string): Promise<void> {
    // Capture the correlation ID once and reuse it for the job
    // data and the enqueue log line. `getCorrelationId()` returns
    // `undefined` outside an HTTP request; `createCorrelationId()`
    // falls back to a fresh UUID in that case so the worker
    // always has a non-empty string to read.
    const correlationId = getCorrelationId() ?? createCorrelationId();

    try {
      const job = await this.emailQueue.add(
        EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
        { email, token, userId, correlationId },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: {
            age: 86_400,
            count: 1_000,
          },
          removeOnFail: {
            age: 604_800,
            count: 5_000,
          },
        },
      );

      this.logger.info({
        event: 'email_job_enqueued',
        jobId: job.id,
        jobName: job.name,
        userId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'email_job_enqueue_failed',
        jobName: EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
        userId,
        correlationId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });

      throw new Error('Unable to queue verification email');
    }
  }

  async enqueuePasswordResetEmail(email: string, token: string, userId: string): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    try {
      const job = await this.emailQueue.add(
        EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL,
        { email, token, userId, correlationId },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: {
            age: 86_400,
            count: 1_000,
          },
          removeOnFail: {
            age: 604_800,
            count: 5_000,
          },
        },
      );

      this.logger.info({
        event: 'email_password_reset_job_enqueued',
        jobId: job.id,
        jobName: job.name,
        userId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'email_password_reset_job_enqueue_failed',
        jobName: EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL,
        userId,
        correlationId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });

      throw new Error('Unable to queue password reset email');
    }
  }
}
