import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { passwordResetTokens } from '@/core/database/schema';
import {
  emailConfig,
  passwordResetConfig,
  type EmailConfig,
  type PasswordResetConfig,
} from '@/core/config';
import { EMAIL_JOB_NAMES } from '../email.constants';
import type { SendPasswordResetEmailJobData } from '../email.types';
import { EmailResilienceRunner } from '../resilience/email-resilience.runner';
import { renderPasswordResetEmail } from '../templates/password-reset.template';
import type { EmailJobContext, EmailJobHandler } from './email-job.handler';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetEmailHandler implements EmailJobHandler<SendPasswordResetEmailJobData> {
  readonly jobName = EMAIL_JOB_NAMES.SEND_PASSWORD_RESET_EMAIL;

  private readonly provider: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly passwordResetBaseUrl: string;
  private readonly resend: Resend;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(emailConfig.KEY) private readonly email: EmailConfig,
    @Inject(passwordResetConfig.KEY) private readonly passwordReset: PasswordResetConfig,
    private readonly resilience: EmailResilienceRunner,
    @InjectPinoLogger(PasswordResetEmailHandler.name) private readonly logger: PinoLogger,
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
    this.passwordResetBaseUrl = this.passwordReset.baseUrl.trim();
  }

  async process(data: SendPasswordResetEmailJobData, ctx: EmailJobContext): Promise<void> {
    const userId = data.userId;
    const { correlationId, jobId } = ctx;
    const tokenHash = hashToken(data.token);
    const nowIso = new Date().toISOString();

    const existing = await this.db
      .select({
        usedAt: passwordResetTokens.usedAt,
        revokedAt: passwordResetTokens.revokedAt,
        expiresAt: passwordResetTokens.expiresAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1);

    const tokenRow = existing[0];
    if (!tokenRow) {
      this.logger.warn({
        event: 'email_password_reset_token_missing',
        provider: this.provider,
        userId,
        jobId,
        correlationId,
      });
      return;
    }

    if (
      tokenRow.revokedAt !== null ||
      new Date(tokenRow.expiresAt).getTime() <= new Date(nowIso).getTime()
    ) {
      this.logger.info({
        event: 'email_password_reset_skipped_inactive',
        provider: this.provider,
        userId,
        jobId,
        correlationId,
        reason: 'token_revoked_or_expired',
      });
      return;
    }

    try {
      const resetUrl = `${this.passwordResetBaseUrl}?token=${encodeURIComponent(data.token)}`;
      const { html, subject } = renderPasswordResetEmail({
        fromName: this.fromName,
        resetUrl,
        ttlSeconds: this.passwordReset.tokenTtlSeconds,
      });

      await this.resilience.runWithResilience((signal) =>
        this.sendViaProvider(data.email, subject, html, signal),
      );

      this.logger.info({
        event: 'email_send_password_reset_success',
        provider: this.provider,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
        userId,
        jobId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'email_send_password_reset_error',
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
