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

export const passwordResetConfig = registerAs('passwordReset', () => ({
  tokenTtlSeconds: parsePositiveInt(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS, 3_600),
  baseUrl: process.env.PASSWORD_RESET_BASE_URL ?? 'http://localhost:3000/reset-password',
}));

export type PasswordResetConfig = ConfigType<typeof passwordResetConfig>;
