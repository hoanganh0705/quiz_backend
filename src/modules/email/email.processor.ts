import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData } from './email.types';

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EMAIL_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @InjectPinoLogger(EmailProcessor.name) private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const concurrency = Number(this.configService.get<number>('EMAIL_QUEUE_CONCURRENCY') ?? 5);

    this.worker = new Worker(
      EMAIL_QUEUE_NAME,
      async (job: Job<SendVerificationEmailJobData>) => {
        if (job.name !== EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL) {
          this.logger.warn({ event: 'email_job_unknown_type', jobId: job.id, jobName: job.name });
          return;
        }

        await this.processSendVerificationEmail(job);
      },
      {
        connection: this.connection,
        concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.info({
        event: 'email_job_completed',
        jobId: job.id,
        jobName: job.name,
      });
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error({
        event: 'email_job_failed',
        jobId: job?.id,
        jobName: job?.name,
        message: error.message,
        stack: error.stack,
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processSendVerificationEmail(
    job: Job<SendVerificationEmailJobData>,
  ): Promise<void> {
    const baseUrl = this.configService.get<string>('EMAIL_VERIFICATION_BASE_URL')?.trim();
    const verificationBaseUrl =
      baseUrl && baseUrl.length > 0 ? baseUrl : 'http://localhost:3000/verify-email';

    // Placeholders you should set in env/provider integration:
    // - EMAIL_PROVIDER
    // - EMAIL_FROM_ADDRESS
    // - EMAIL_FROM_NAME
    const provider = this.configService.get<string>('EMAIL_PROVIDER') ?? 'SET_ME_EMAIL_PROVIDER';
    const fromAddress =
      this.configService.get<string>('EMAIL_FROM_ADDRESS') ??
      'SET_ME_EMAIL_FROM_ADDRESS@example.com';
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME') ?? 'SET_ME_EMAIL_FROM_NAME';

    const verificationUrl = `${verificationBaseUrl}?token=${encodeURIComponent(job.data.token)}`;

    // Placeholder for actual provider call.
    this.logger.info({
      event: 'email_send_verification_placeholder',
      provider,
      fromAddress,
      fromName,
      email: job.data.email,
      verificationUrl,
      jobId: job.id,
    });
  }
}
