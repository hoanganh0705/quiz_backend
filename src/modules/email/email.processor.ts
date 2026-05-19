import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Resend } from 'resend';
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_NAME, EMAIL_QUEUE_TOKENS } from './email.constants';
import type { SendVerificationEmailJobData } from './email.types';

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<SendVerificationEmailJobData, void, string> | null = null; // type parameters: <JobData, ReturnType, JobName>
  private readonly provider: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly verificationBaseUrl: string;
  private readonly sendTimeoutMs: number;
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EMAIL_QUEUE_TOKENS.CONNECTION) // inject the Redis connection in email.module.ts
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

  // this method initializes the BullMQ worker to process email jobs from the queue, it sets up the concurrency level based on configuration and defines handlers for job completion and failure events to log the outcomes of email processing. When we start a project, this module will be initialized and the worker will start listening for jobs in the email queue, when a job is added to the queue, the worker will pick it up and execute the corresponding processing logic defined in the processSendVerificationEmail method.
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

  // Gracefully shut down the worker when the module is destroyed, we need to do this to ensure that any in-progress jobs are allowed to finish and resources are cleaned up properly.
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
      const verificationUrl = `${this.verificationBaseUrl}?token=${encodeURIComponent(job.data.token)}`; // encodeURIComponent to ensure the token is safely included in the URL, in details, the verification URL is constructed by appending the token as a query parameter to the base URL. This allows the recipient to click the link and be directed to the appropriate endpoint in your application to verify their email address.
      const userId = job.data.userId;
      const controller = new AbortController(); // we use AbortController to implement the timeout mechanism for sending emails. If the email sending operation takes longer than the specified timeout, the controller will abort the request, allowing us to handle it as a failure and trigger any retry logic defined in BullMQ.

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

  // This method sends the verification email using the Resend provider. It constructs the email content and handles the API response, throwing an error if the API call fails.
  private async sendVerificationEmailViaProvider(
    email: string,
    verificationUrl: string,
    signal: AbortSignal, // we pass the AbortSignal to the Resend API call to allow it to be aborted if the timeout is reached, this is from the AbortController we created in the processSendVerificationEmail method, if the email sending takes too long, the signal will be triggered to abort the request.
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

  // This method implements a timeout mechanism for any given asynchronous task, it helps ensure that if the email sending operation takes longer than the specified timeout, it will be aborted and handled as a failure
  private async withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
    controller?: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    // Promise<never> indicates that this promise will never resolve successfully, it will only reject when the timeout is reached
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error(`Email sending timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // this codeblock uses Promise.race to run both the email sending task and the timeout promise concurrently, if the email sending task completes successfully before the timeout, its result will be returned, if the timeout is reached first, the timeoutPromise will reject and trigger the catch block in processSendVerificationEmail method to handle it as a failure.
    try {
      return await Promise.race([task, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private buildVerificationEmailHtml(verificationUrl: string): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email — ${this.fromName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-size:22px;font-weight:700;color:#1a1a2e;letter-spacing:-0.5px;">${this.fromName}</span>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border-radius:12px;padding:40px 48px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

                <p style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#1a1a2e;line-height:1.3;">
                  Verify your email address
                </p>
                <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.6;">
                  Thanks for signing up! Click the button below to confirm your email address and activate your account.
                  This link expires in <strong>1 hour</strong>.
                </p>

                <!-- CTA Button -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <a href="${verificationUrl}"
                         style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
                                text-decoration:none;border-radius:8px;padding:14px 36px;letter-spacing:0.2px;">
                        Verify Email Address
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback link -->
                <p style="margin:0 0 6px 0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 28px 0;word-break:break-all;">
                  <a href="${verificationUrl}" style="font-size:13px;color:#4f46e5;text-decoration:underline;">${verificationUrl}</a>
                </p>

                <!-- Divider -->
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;" />

                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                  If you didn't create an account, you can safely ignore this email — no action is needed.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:24px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  © ${new Date().getFullYear()} ${this.fromName}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(`${key} is not defined in environment variables`);
    }

    return value;
  }
}
