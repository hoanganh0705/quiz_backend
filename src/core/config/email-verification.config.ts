/**
 * Email verification configuration.
 * Provides typed access to email verification-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const emailVerificationConfig = registerAs('emailVerification', () => ({
  tokenTtlSeconds: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS ?? 1800),
  baseUrl: process.env.EMAIL_VERIFICATION_BASE_URL ?? '',
}));

export type EmailVerificationConfig = ConfigType<typeof emailVerificationConfig>;
