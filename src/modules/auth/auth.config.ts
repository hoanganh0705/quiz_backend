import { ConfigService } from '@nestjs/config';

export function isProduction(configService: ConfigService): boolean {
  return configService.get<string>('NODE_ENV') === 'production';
}

export function getAccessTokenSecret(configService: ConfigService): string {
  return (
    configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
    (() => {
      throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
    })()
  );
}

export function getRefreshTokenSecret(configService: ConfigService): string {
  return (
    configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ??
    (() => {
      throw new Error('JWT_REFRESH_TOKEN_SECRET is not defined in environment variables');
    })()
  );
}

export function getTokenExpiresInSeconds(configService: ConfigService, configKey: string): number {
  const rawValue = configService.get<string>(configKey);
  if (!rawValue) {
    throw new Error(`${configKey} is not defined in environment variables`);
  }

  const trimmedValue = rawValue.trim().toLowerCase();
  const matchedValue = trimmedValue.match(/^(\d+)([smhd])?$/);
  if (!matchedValue) {
    throw new Error(
      `${configKey} has invalid format. Expected number or number with one of: s, m, h, d`,
    );
  }

  const amount = Number(matchedValue[1]);
  const unit = matchedValue[2] ?? 's';

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`${configKey} has unsupported unit`);
  }
}

export function getRefreshTokenCookieMaxAgeMs(configService: ConfigService): number {
  const rawValue = configService.get<number>('REFRESH_TOKEN_COOKIE_MAX_AGE_MS');

  if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
    throw new Error('REFRESH_TOKEN_COOKIE_MAX_AGE_MS must be a positive integer');
  }

  return rawValue;
}
