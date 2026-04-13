import { Inject, Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData } from './email.types';

@Injectable()
export class EmailService implements OnModuleDestroy {
  constructor(
    @Inject(EMAIL_QUEUE_TOKENS.QUEUE)
    private readonly emailQueue: Queue<SendVerificationEmailJobData>,
    @InjectPinoLogger(EmailService.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.emailQueue.close();
  }

  async enqueueVerificationEmail(email: string, token: string, userId?: string): Promise<void> {
    try {
      const job = await this.emailQueue.add(
        EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
        { email, token, userId },
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
      });
    } catch (error) {
      this.logger.error({
        event: 'email_job_enqueue_failed',
        jobName: EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL,
        userId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });

      throw new InternalServerErrorException('Unable to queue verification email');
    }
  }
}
