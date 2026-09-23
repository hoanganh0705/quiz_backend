import { ConfigType, registerAs } from '@nestjs/config';

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${raw}`);
  }
  return parsed;
};

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER ?? 'resend',
  fromAddress: process.env.EMAIL_FROM_ADDRESS ?? '',
  fromName: process.env.EMAIL_FROM_NAME ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  sendTimeoutMs: parsePositiveInt(process.env.EMAIL_SEND_TIMEOUT_MS, 5_000),
  queueConcurrency: parsePositiveInt(process.env.EMAIL_QUEUE_CONCURRENCY, 5),
  circuitBreaker: {
    failureThreshold: parsePositiveInt(process.env.EMAIL_CB_FAILURE_THRESHOLD, 5),
    resetTimeoutMs: parsePositiveInt(process.env.EMAIL_CB_RESET_TIMEOUT_MS, 30_000),
  },
}));

export type EmailConfig = ConfigType<typeof emailConfig>;
