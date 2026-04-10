export type NodeEnv = 'development' | 'test' | 'production';

const TOKEN_EXPIRES_IN_PATTERN = /^(\d+)([smhd])?$/;

const parseRequiredString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }

  return value.trim();
};

const parsePositiveInteger = (
  env: Record<string, unknown>,
  key: string,
  fallback?: number,
): number => {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`${key} must be defined`);
  }

  let normalizedValue = '';

  if (typeof rawValue === 'number') {
    normalizedValue = String(rawValue);
  } else if (typeof rawValue === 'string') {
    normalizedValue = rawValue.trim();
  } else {
    throw new Error(`${key} must be a positive integer`);
  }

  const parsed = Number(normalizedValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
};

export const validateEnv = (env: Record<string, unknown>) => {
  const databaseUrl = parseRequiredString(env, 'DATABASE_URL');
  const jwtAccessTokenSecret = parseRequiredString(env, 'JWT_ACCESS_TOKEN_SECRET');
  const jwtRefreshTokenSecret = parseRequiredString(env, 'JWT_REFRESH_TOKEN_SECRET');
  const accessTokenExpiresIn = parseRequiredString(env, 'ACCESS_TOKEN_EXPIRES_IN').toLowerCase();
  const refreshTokenExpiresIn = parseRequiredString(env, 'REFRESH_TOKEN_EXPIRES_IN').toLowerCase();
  const refreshTokenCookieMaxAgeMs = parsePositiveInteger(env, 'REFRESH_TOKEN_COOKIE_MAX_AGE_MS');
  const port = parsePositiveInteger(env, 'PORT', 3000);
  const rawNodeEnv = env.NODE_ENV;
  const nodeEnvRaw =
    typeof rawNodeEnv === 'string' && rawNodeEnv.trim().length > 0
      ? rawNodeEnv.trim().toLowerCase()
      : 'development';
  const corsOrigins = typeof env.CORS_ORIGINS === 'string' ? env.CORS_ORIGINS : '';

  if (!TOKEN_EXPIRES_IN_PATTERN.test(accessTokenExpiresIn)) {
    throw new Error('ACCESS_TOKEN_EXPIRES_IN has invalid format. Use number or number + s/m/h/d');
  }

  if (!TOKEN_EXPIRES_IN_PATTERN.test(refreshTokenExpiresIn)) {
    throw new Error('REFRESH_TOKEN_EXPIRES_IN has invalid format. Use number or number + s/m/h/d');
  }

  if (nodeEnvRaw !== 'development' && nodeEnvRaw !== 'test' && nodeEnvRaw !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  return {
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_TOKEN_SECRET: jwtAccessTokenSecret,
    JWT_REFRESH_TOKEN_SECRET: jwtRefreshTokenSecret,
    ACCESS_TOKEN_EXPIRES_IN: accessTokenExpiresIn,
    REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
    REFRESH_TOKEN_COOKIE_MAX_AGE_MS: refreshTokenCookieMaxAgeMs,
    PORT: port,
    NODE_ENV: nodeEnvRaw as NodeEnv,
    CORS_ORIGINS: corsOrigins,
  };
};
