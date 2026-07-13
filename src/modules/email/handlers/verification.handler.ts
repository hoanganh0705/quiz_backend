import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { sql } from 'drizzle-orm';
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
import type { EmailJobContext, EmailJobHandler } from './email-job.handler';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Handles `sendVerificationEmail` jobs.
 *
 * Flow:
 *   1. Atomic dedupe via `sent_verification_tokens` (unique index
 *      on `token_hash`). A duplicate re-delivery simply finds the
 *      existing claim and logs + returns — no second email.
 *   2. Build the verification URL and send through Resend, wrapped
 *      in the shared circuit breaker + timeout.
 *   3. On failure, delete the claim so a future retry can succeed.
 *
 * Log events emitted (kept stable for dashboards/grep rules):
 *   - email_send_verification_skipped_duplicate
 *   - email_send_verification_success
 *   - email_send_verification_error
 */
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
    this.verificationBaseUrl =
      this.emailVerification.baseUrl?.trim().length > 0
        ? this.emailVerification.baseUrl.trim()
        : 'http://localhost:3000/verify-email';
    this.tokenTtlSeconds = this.emailVerification.tokenTtlSeconds;
  }

  async process(data: SendVerificationEmailJobData, ctx: EmailJobContext): Promise<void> {
    const userId = data.userId;
    const { correlationId, jobId } = ctx;

    // Idempotency: try to claim this token in
    // `sent_verification_tokens`. The unique index on `token_hash`
    // makes this atomic — two concurrent attempts to claim the same
    // token will produce exactly one row. If we did not claim the
    // token, it has already been sent in a prior job, so we skip.
    const tokenHash = hashToken(data.token);
    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000).toISOString();
    const claimed = await this.db
      .insert(sentVerificationTokens)
      .values({
        userId: userId ?? null,
        tokenHash,
        expiresAt,
      })
      .onConflictDoNothing({ target: sentVerificationTokens.tokenHash })
      .returning({ sentTokenId: sentVerificationTokens.sentTokenId });

    if (claimed.length === 0) {
      this.logger.info({
        event: 'email_send_verification_skipped_duplicate',
        provider: this.provider,
        userId,
        jobId,
        correlationId,
        reason: 'token_already_sent',
      });
      return;
    }

    try {
      const verificationUrl = `${this.verificationBaseUrl}?token=${encodeURIComponent(data.token)}`;
      await this.resilience.runWithResilience((signal) =>
        this.sendViaProvider(data.email, verificationUrl, signal),
      );

      this.logger.info({
        event: 'email_send_verification_success',
        provider: this.provider,
        fromAddress: this.fromAddress,
        fromName: this.fromName,
        userId,
        verificationUrl: '[REDACTED]',
        jobId,
        correlationId,
      });
    } catch (error) {
      // The token was claimed above but the actual send failed. To
      // avoid a permanently blocked token (a future retry would see
      // the row in `sent_verification_tokens` and skip), delete the
      // claim. This trades a tiny extra work on the failure path for
      // correctness on the retry path: a failed send can be retried,
      // a successful send cannot be duplicated.
      await this.db
        .delete(sentVerificationTokens)
        .where(sql`${sentVerificationTokens.sentTokenId} = ${claimed[0].sentTokenId}::uuid`);

      this.logger.error({
        event: 'email_send_verification_error',
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
    verificationUrl: string,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await this.resend.emails.send(
      {
        from: `${this.fromName} <${this.fromAddress}>`,
        to: email,
        subject: 'Verify your email',
        html: this.buildHtml(verificationUrl),
      },
      { signal },
    );
    if (response.error) {
      // Log provider details internally; never propagate provider internals in the error message.
      throw new Error('Email provider returned an error. See server logs for details.');
    }
  }

  private buildHtml(verificationUrl: string): string {
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
}
