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

export const emailVerificationConfig = registerAs('emailVerification', () => ({
  tokenTtlSeconds: parsePositiveInt(process.env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS, 1_800),
  baseUrl: process.env.EMAIL_VERIFICATION_BASE_URL ?? '',
}));

export type EmailVerificationConfig = ConfigType<typeof emailVerificationConfig>;
