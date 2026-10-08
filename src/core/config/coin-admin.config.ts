import { ConfigType, registerAs } from '@nestjs/config';

const parseNonNegativeInteger = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, got: ${raw}`);
  }
  return parsed;
};

export const coinAdminConfig = registerAs('coinAdmin', () => ({
  dailyCapPerAdmin: parseNonNegativeInteger(process.env.COIN_ADMIN_DAILY_CAP_PER_ADMIN, 10_000_000),
}));

export type CoinAdminConfig = ConfigType<typeof coinAdminConfig>;
