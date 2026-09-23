import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sentVerificationTokens } from '@/core/database/schema';
import {
  emailConfig,
  emailVerificationConfig,
  type EmailConfig,
  type EmailVerificationConfig,
} from '@/core/config';
import { EMAIL_JOB_NAMES } from '../email.constants';
import type { SendVerificationEmailJobData } from '../email.types';
import { EmailResilienceRunner } from '../resilience/email-resilience.runner';
import { renderVerificationEmail } from '../templates/verification.template';
import type { EmailJobContext, EmailJobHandler } from './email-job.handler';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class VerificationEmailHandler implements EmailJobHandler<SendVerificationEmailJobData> {
  readonly jobName = EMAIL_JOB_NAMES.SEND_VERIFICATION_EMAIL;

  private readonly provider: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly verificationBaseUrl: string;
  private readonly tokenTtlSeconds: number;
  private readonly resend: Resend;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(emailConfig.KEY) private readonly email: EmailConfig,
    @Inject(emailVerificationConfig.KEY)
    private readonly emailVerification: EmailVerificationConfig,
    private readonly resilience: EmailResilienceRunner,
    @InjectPinoLogger(VerificationEmailHandler.name) private readonly logger: PinoLogger,
  ) {
    if (!this.email.resendApiKey) {
      throw new Error(
        'Email service is missing required configuration. Check server environment variables.',
      );
    }
    this.resend = new Resend(this.email.resendApiKey);
    this.provider = this.email.provider;
    this.fromAddress = this.email.fromAddress;
    this.fromName = this.email.fromName;
    this.verificationBaseUrl = this.emailVerification.baseUrl.trim();
    this.tokenTtlSeconds = this.emailVerification.tokenTtlSeconds;
  }

  async process(data: SendVerificationEmailJobData, ctx: EmailJobContext): Promise<void> {
    const userId = data.userId;
    const { correlationId, jobId } = ctx;
    const tokenHash = hashToken(data.token);
    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000).toISOString();

    const claimed = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(sentVerificationTokens)
        .values({ userId: userId ?? null, tokenHash, expiresAt })
        .onConflictDoNothing({ target: sentVerificationTokens.tokenHash })
        .returning({
          sentTokenId: sentVerificationTokens.sentTokenId,
          sentAt: sentVerificationTokens.sentAt,
        });

      if (inserted.length === 0) {
        const existing = await tx
          .select({ sentAt: sentVerificationTokens.sentAt })
          .from(sentVerificationTokens)
          .where(eq(sentVerificationTokens.tokenHash, tokenHash))
          .limit(1);
        return { claimed: null, previouslySentAt: existing[0]?.sentAt ?? null };
      }

      return { claimed: inserted[0], previouslySentAt: null };
    });

    if (!claimed.claimed) {
      this.logger.info({
        event: 'email_send_verification_skipped_duplicate',
        provider: this.provider,
        userId,
        jobId,
        correlationId,
        reason: 'token_already_sent',
        previouslySentAt: claimed.previouslySentAt,
      });
      return;
    }

    try {
      const verificationUrl = `${this.verificationBaseUrl}?token=${encodeURIComponent(data.token)}`;
      const { html, subject } = renderVerificationEmail({
        fromName: this.fromName,
        verificationUrl,
        ttlSeconds: this.tokenTtlSeconds,
      });

      await this.resilience.runWithResilience((signal) =>
        this.sendViaProvider(data.email, subject, html, signal),
      );

      this.logger.info({
        event: 'email_send_verification_success',
        provider: this.provider,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
        userId,
        jobId,
        correlationId,
      });
    } catch (error) {
      await this.db
        .delete(sentVerificationTokens)
        .where(sql`${sentVerificationTokens.sentTokenId} = ${claimed.claimed.sentTokenId}::uuid`);

      this.logger.error({
        event: 'email_send_verification_error',
        errorCode: classifyEmailError(error),
        jobId,
        userId,
        circuitState: this.resilience.getCircuitState(),
        correlationId,
      });
      throw error;
    }
  }

  private async sendViaProvider(
    email: string,
    subject: string,
    html: string,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await this.resend.emails.send(
      {
        from: `${this.fromName} <${this.fromAddress}>`,
        to: email,
        subject,
        html,
      },
      { signal },
    );
    if (response.error) {
      throw new Error('Email provider returned an error');
    }
  }
}

const classifyEmailError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === 'CircuitOpenError') return 'circuit_open';
    if (error.message.includes('timed out')) return 'timeout';
  }
  return 'provider_error';
};
