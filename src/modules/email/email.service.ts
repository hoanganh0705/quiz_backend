import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EMAIL_JOB_NAMES, EMAIL_JOB_RETRY_POLICY, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData, SendPasswordResetEmailJobData } from './email.types';
import type { EmailProvider } from '@/common/ports/email.provider';
import { createCorrelationId, getCorrelationId } from '@/common/interceptors/correlation-id';

type EmailJobName =
  | typeof EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL
  | typeof EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL;

type EmailJobData = SendVerificationEmailJobData | SendPasswordResetEmailJobData;

@Injectable()
export class EmailService implements EmailProvider, OnModuleDestroy {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: Queue<EmailJobData>,
    @InjectPinoLogger(EmailService.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.emailQueue.close();
  }

  async enqueueVerificationEmail(email: string, token: string, userId?: string): Promise<void> {
    await this.enqueueJob(EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL, {
      email,
      token,
      userId,
    });
  }

  async enqueuePasswordResetEmail(email: string, token: string, userId: string): Promise<void> {
    await this.enqueueJob(EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL, {
      email,
      token,
      userId,
    });
  }

  private async enqueueJob(jobName: EmailJobName, payload: EmailJobData): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    const data = { ...payload, correlationId } as EmailJobData;

    try {
      const job = await this.emailQueue.add(jobName, data, EMAIL_JOB_RETRY_POLICY);
      this.logger.info({
        event: 'email_job_enqueued',
        jobId: job.id,
        jobName: job.name,
        userId: 'userId' in data ? data.userId : undefined,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'email_job_enqueue_failed',
        jobName,
        correlationId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });
      throw new Error(
        jobName === EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL
          ? 'Unable to queue password reset email'
          : 'Unable to queue verification email',
      );
    }
  }
}
