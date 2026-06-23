/**
 * Email configuration.
 * Provides typed access to email-related environment variables.
 *
 * The EMAIL_PROVIDER is validated at startup via env.validation.ts
 * and currently only supports 'resend'.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER ?? 'resend',
  fromAddress: process.env.EMAIL_FROM_ADDRESS ?? '',
  fromName: process.env.EMAIL_FROM_NAME ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  sendTimeoutMs: Number(process.env.EMAIL_SEND_TIMEOUT_MS ?? 5000),
  queueConcurrency: Number(process.env.EMAIL_QUEUE_CONCURRENCY ?? 5),
  circuitBreaker: {
    failureThreshold: Number(process.env.EMAIL_CB_FAILURE_THRESHOLD ?? 5),
    resetTimeoutMs: Number(process.env.EMAIL_CB_RESET_TIMEOUT_MS ?? 30000),
  },
}));

export type EmailConfig = ConfigType<typeof emailConfig>;
