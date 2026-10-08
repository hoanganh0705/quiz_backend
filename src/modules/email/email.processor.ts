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

const EMAIL_JOB_NAME_PATTERN = /^[A-Za-z0-9_:.]+$/;

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
    @InjectPinoLogger(EmailProcessor.name) private readonly logger: PinoLogger,
  ) {
    this.concurrency = this.email.queueConcurrency;
    this.handlers = [verificationHandler, passwordResetHandler];
  }

  onModuleInit(): void {
    this.worker = new Worker(
      EMAIL_QUEUE_NAME,
      async (job: Job) => {
        const dataWithCorrelation = job.data as { correlationId?: string };
        const correlationId = dataWithCorrelation.correlationId ?? createCorrelationId();

        await correlationIdStorage.run({ correlationId }, async () => {
          const jobName = job.name ?? '';
          const jobNameValid = EMAIL_JOB_NAME_PATTERN.test(jobName);
          const handler = jobNameValid
            ? this.handlers.find((h) => h.jobName === jobName)
            : undefined;
          if (!handler) {
            this.logger.warn({
              event: 'email_job_unknown_type',
              jobId: job.id,
              jobName,
              handlerResolved: false,
              reason: jobNameValid ? 'unknown_name' : 'invalid_chars',
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
        handlerResolved: true,
        correlationId: dataWithCorrelation.correlationId,
      });
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      const dataWithCorrelation = job?.data as
        { userId?: string; correlationId?: string } | undefined;
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
        ...(this.email.nodeEnv === 'production' ? {} : { stack: error.stack }),
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

export type { SendPasswordResetEmailJobData, SendVerificationEmailJobData };
