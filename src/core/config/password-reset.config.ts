/**
 * Password reset configuration.
 * Provides typed access to password-reset-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const passwordResetConfig = registerAs('passwordReset', () => ({
  tokenTtlSeconds: Number(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS ?? 3600),
  baseUrl: process.env.PASSWORD_RESET_BASE_URL ?? 'http://localhost:3000/reset-password',
}));

export type PasswordResetConfig = ConfigType<typeof passwordResetConfig>;
