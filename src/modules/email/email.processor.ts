import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Resend } from 'resend';
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData } from './email.types';

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<SendVerificationEmailJobData, void, string> | null = null;
  private readonly provider: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly verificationBaseUrl: string;
  private readonly sendTimeoutMs: number;
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EMAIL_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @InjectPinoLogger(EmailProcessor.name) private readonly logger: PinoLogger,
  ) {
    const configuredBaseUrl = this.configService.get<string>('EMAIL_VERIFICATION_BASE_URL')?.trim();
    const resendApiKey = this.getRequiredConfig('RESEND_API_KEY');

    this.resend = new Resend(resendApiKey);

    this.provider = this.getRequiredConfig('EMAIL_PROVIDER');
    this.fromAddress = this.getRequiredConfig('EMAIL_FROM_ADDRESS');
    this.fromName = this.getRequiredConfig('EMAIL_FROM_NAME');
    this.verificationBaseUrl =
      configuredBaseUrl && configuredBaseUrl.length > 0
        ? configuredBaseUrl
        : 'http://localhost:3000/verify-email';

    const configuredTimeout = this.configService.get<number>('EMAIL_SEND_TIMEOUT_MS');
    this.sendTimeoutMs =
      typeof configuredTimeout === 'number' && configuredTimeout > 0 ? configuredTimeout : 5_000;
  }

  onModuleInit(): void {
    const fallbackConcurrency = 5;
    const configuredConcurrency = this.configService.get<string | number>(
      'EMAIL_QUEUE_CONCURRENCY',
    );
    const parsedConcurrency = Number(configuredConcurrency);

    const concurrency =
      Number.isInteger(parsedConcurrency) && parsedConcurrency > 0
        ? parsedConcurrency
        : fallbackConcurrency;

    if (
      configuredConcurrency !== undefined &&
      (!Number.isInteger(parsedConcurrency) || parsedConcurrency <= 0)
    ) {
      this.logger.warn({
        event: 'email_queue_invalid_concurrency',
        value: configuredConcurrency,
        fallback: fallbackConcurrency,
      });
    }

    this.worker = new Worker<SendVerificationEmailJobData, void, string>(
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
        concurrency,
      },
    );

    this.worker.on('completed', (job: Job<SendVerificationEmailJobData>) => {
      this.logger.info({
        event: 'email_job_completed',
        jobId: job.id,
        jobName: job.name,
      });
    });

    this.worker.on('failed', (job: Job<SendVerificationEmailJobData> | undefined, error) => {
      const attemptsMade = job?.attemptsMade ?? 0;
      const configuredAttempts =
        typeof job?.opts?.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1;
      const jobUserId = job?.data.userId;
      const isFinalAttempt = attemptsMade >= configuredAttempts;

      this.logger.error({
        event: 'email_job_failed',
        jobId: job?.id,
        jobName: job?.name,
        userId: jobUserId,
        attemptsMade,
        configuredAttempts,
        isFinalAttempt,
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
    try {
      const verificationUrl = `${this.verificationBaseUrl}?token=${encodeURIComponent(job.data.token)}`;
      const userId = job.data.userId;
      const controller = new AbortController();

      await this.withTimeout(
        this.sendVerificationEmailViaProvider(job.data.email, verificationUrl, controller.signal),
        this.sendTimeoutMs,
        controller,
      );

      this.logger.info({
        event: 'email_send_verification_success',
        provider: this.provider,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
        userId,
        verificationUrl: '[REDACTED]',
        jobId: job.id,
      });
    } catch (error) {
      const userId = job.data.userId;

      this.logger.error({
        event: 'email_send_verification_error',
        jobId: job.id,
        userId,
        timeoutMs: this.sendTimeoutMs,
        message: error instanceof Error ? error.message : 'Unknown email processing error',
      });

      // Re-throw so BullMQ retry/backoff policy applies.
      throw error;
    }
  }

  private async sendVerificationEmailViaProvider(
    email: string,
    verificationUrl: string,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await this.resend.emails.send(
      {
        from: `${this.fromName} <${this.fromAddress}>`,
        to: email,
        subject: 'Verify your email',
        html: this.buildVerificationEmailHtml(verificationUrl),
      },
      { signal },
    );

    if (response.error) {
      throw new Error(`Resend API error (${response.error.name}): ${response.error.message}`);
    }
  }

  private async withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
    controller?: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error(`Email sending timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([task, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private buildVerificationEmailHtml(verificationUrl: string): string {
    return [
      '<!doctype html>',
      '<html lang="en">',
      '  <body>',
      '    <p>Please verify your email address.</p>',
      `    <p><a href="${verificationUrl}">Verify Email</a></p>`,
      '    <p>If you did not request this, you can ignore this email.</p>',
      '  </body>',
      '</html>',
    ].join('\n');
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(`${key} is not defined in environment variables`);
    }

    return value;
  }
}
