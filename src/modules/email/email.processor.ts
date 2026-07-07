import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { emailConfig, type EmailConfig } from '@/core/config';
import { EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import { SendPasswordResetEmailJobData, SendVerificationEmailJobData } from './email.types';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import type { EmailJobHandler } from './handlers/email-job.handler';
import { PasswordResetEmailHandler } from './handlers/password-reset.handler';
import { VerificationEmailHandler } from './handlers/verification.handler';
import { EmailResilienceRunner } from './resilience/email-resilience.runner';

/**
 * BullMQ worker dispatcher for the email queue.
 *
 * Lifecycle (startup/shutdown, retry log events, correlation ID
 * plumbing) lives here. Per-job-type logic — what the email
 * actually does, what to dedupe, what template to use — lives in
 * `EmailJobHandler` implementations under `./handlers/`.
 *
 * Adding a new email type is a 3-step change with no edits to this
 * file beyond the constructor's handler list:
 *   1. Add a `FooHandler` implementing `EmailJobHandler`.
 *   2. Register it in `EmailModule.providers`.
 *   3. Add `private readonly foo: FooEmailHandler` to the
 *      constructor and append it to `this.handlers` below.
 */
@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly handlers: EmailJobHandler<unknown>[];
  private readonly concurrency: number;
  private worker: Worker | null = null;

  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @Inject(emailConfig.KEY) private readonly email: EmailConfig,
    verificationHandler: VerificationEmailHandler,
    passwordResetHandler: PasswordResetEmailHandler,
    // The runner is owned by this class only for the side-effect of
    // constructing it once per process (so the circuit breaker state
    // listener is registered exactly once). Handlers also receive it
    // via DI and use it directly; the dispatcher does not invoke it.
    _resilience: EmailResilienceRunner,
    @InjectPinoLogger(EmailProcessor.name) private readonly logger: PinoLogger,
  ) {
    this.concurrency = this.email.queueConcurrency;
    this.handlers = [
      verificationHandler as EmailJobHandler<unknown>,
      passwordResetHandler as EmailJobHandler<unknown>,
    ];
  }

  onModuleInit(): void {
    this.worker = new Worker(
      EMAIL_QUEUE_NAME,
      async (job: Job) => {
        // BullMQ workers run outside any HTTP request context, so we
        // must restore the correlation ID the enqueue site captured
        // in `correlationIdStorage`. If the job data is missing one
        // (only possible if someone hand-published to Redis without
        // going through `EmailService`), mint a fresh UUID so log
        // lines stay joinable on a single ID per processing attempt.
        const dataWithCorrelation = job.data as { correlationId?: string };
        const correlationId = dataWithCorrelation.correlationId ?? createCorrelationId();

        await correlationIdStorage.run({ correlationId }, async () => {
          const handler = this.handlers.find((h) => h.jobName === job.name);
          if (!handler) {
            this.logger.warn({
              event: 'email_job_unknown_type',
              jobId: job.id,
              jobName: job.name,
              correlationId,
            });
            return;
          }
          await handler.process(job.data, {
            jobId: job.id,
            correlationId,
            logger: this.logger,
          });
        });
      },
      {
        connection: this.connection,
        concurrency: this.concurrency,
      },
    );

    this.worker.on('completed', (job: Job) => {
      const dataWithCorrelation = job.data as { correlationId?: string };
      this.logger.info({
        event: 'email_job_completed',
        jobId: job.id,
        jobName: job.name,
        correlationId: dataWithCorrelation.correlationId,
      });
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      const dataWithCorrelation = job?.data as
        | { userId?: string; correlationId?: string }
        | undefined;
      const attemptsMade = job?.attemptsMade ?? 0;
      const configuredAttempts =
        typeof job?.opts?.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1;
      const correlationId = dataWithCorrelation?.correlationId ?? createCorrelationId();

      this.logger.error({
        event: 'email_job_failed',
        jobId: job?.id,
        jobName: job?.name,
        userId: dataWithCorrelation?.userId,
        attemptsMade,
        configuredAttempts,
        isFinalAttempt: attemptsMade >= configuredAttempts,
        correlationId,
        message: error.message,
        stack: error.stack,
      });
    });
  }

  // Gracefully shut down the worker when the module is destroyed.
  // In-flight jobs are allowed to finish; Redis sockets are closed.
  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

// Re-export so callers that previously imported from
// `./email.processor` keep working — there were none outside the
// module, but this keeps the surface stable during the refactor.
export type { SendPasswordResetEmailJobData, SendVerificationEmailJobData };
