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
import type { EmailJobContext, EmailJobHandler } from './email-job.handler';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Handles `sendPasswordResetEmail` jobs.
 *
 * Flow:
 *   1. Look up the `password_reset_tokens` row. If missing, warn and
 *      return (the auth domain guards this, but defensive).
 *   2. If the token is consumed, revoked, or expired, log + return —
 *      re-sending would mislead the recipient into clicking a dead
 *      URL.
 *   3. Otherwise build the reset URL, send via Resend with the shared
 *      resilience wrapper, log success or failure.
 *
 * Log events emitted (kept stable):
 *   - email_password_reset_token_missing
 *   - email_password_reset_skipped_inactive
 *   - email_send_password_reset_success
 *   - email_send_password_reset_error
 */
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
    this.passwordResetBaseUrl =
      this.passwordReset.baseUrl?.trim().length > 0
        ? this.passwordReset.baseUrl.trim()
        : 'http://localhost:3000/reset-password';
  }

  async process(
    data: SendPasswordResetEmailJobData,
    ctx: EmailJobContext,
  ): Promise<void> {
    const userId = data.userId;
    const { correlationId, jobId } = ctx;

    // Password reset tokens are single-use and time-bound. Before
    // attempting to send, check whether this token is still in a state
    // where a fresh email would be useful: it must not have been
    // consumed (`usedAt`), revoked (`revokedAt`), or expired. If any
    // of those is true, the user has either already reset their
    // password or invalidated the link, and re-sending would mislead
    // them into clicking a dead URL.
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
      tokenRow.usedAt !== null ||
      tokenRow.revokedAt !== null ||
      new Date(tokenRow.expiresAt).getTime() <= new Date(nowIso).getTime()
    ) {
      this.logger.info({
        event: 'email_password_reset_skipped_inactive',
        provider: this.provider,
        userId,
        jobId,
        correlationId,
        reason: 'token_consumed_revoked_or_expired',
      });
      return;
    }

    try {
      const resetUrl = `${this.passwordResetBaseUrl}?token=${encodeURIComponent(data.token)}`;
      await this.resilience.runWithResilience((signal) =>
        this.sendViaProvider(data.email, resetUrl, signal),
      );

      this.logger.info({
        event: 'email_send_password_reset_success',
        provider: this.provider,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
        userId,
        resetUrl: '[REDACTED]',
        jobId,
        correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'email_send_password_reset_error',
        jobId,
        userId,
        timeoutMs: this.email.sendTimeoutMs,
        circuitState: this.resilience.getCircuitState(),
        correlationId,
        message: error instanceof Error ? error.message : 'Unknown email processing error',
      });

      // Re-throw so BullMQ retry/backoff policy applies.
      throw error;
    }
  }

  private async sendViaProvider(
    email: string,
    resetUrl: string,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await this.resend.emails.send(
      {
        from: `${this.fromName} <${this.fromAddress}>`,
        to: email,
        subject: 'Reset your password',
        html: this.buildHtml(resetUrl),
      },
      { signal },
    );
    if (response.error) {
      throw new Error('Email provider returned an error. See server logs for details.');
    }
  }

  private buildHtml(resetUrl: string): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password — ${this.fromName}</title>
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
                  Reset your password
                </p>
                <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.6;">
                  We received a request to reset the password for your account. Click the button below to choose a new password.
                  This link expires in <strong>1 hour</strong>.
                </p>

                <!-- CTA Button -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <a href="${resetUrl}"
                         style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
                                text-decoration:none;border-radius:8px;padding:14px 36px;letter-spacing:0.2px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback link -->
                <p style="margin:0 0 6px 0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 28px 0;word-break:break-all;">
                  <a href="${resetUrl}" style="font-size:13px;color:#4f46e5;text-decoration:underline;">${resetUrl}</a>
                </p>

                <!-- Divider -->
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;" />

                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                  If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
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
}
