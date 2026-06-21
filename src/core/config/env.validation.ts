/**
 * Environment validation module.
 * Provides type-safe validation for all environment variables with fail-fast startup behavior.
 *
 * Key design decisions:
 * - Uses `as const` tuples for enum validation to avoid string literal duplication
 * - URL validation ensures protocol correctness (postgres:// for DB, redis:// for cache)
 * - All helper functions are module-private; only validateEnv is exported
 * - Return shape MUST match the original to preserve backward compatibility
 */

export type NodeEnv = 'development' | 'test' | 'production';

// ============================================
// Enum Value Sets (using as const for type safety)
// ============================================

const NODE_ENVS = ['development', 'test', 'production'] as const;
const EMAIL_PROVIDERS = ['resend'] as const;
const DATABASE_PROTOCOLS = ['postgres:', 'postgresql:'] as const;
const REDIS_PROTOCOLS = ['redis:', 'rediss:'] as const;

// ============================================
// Token Expiration Pattern
// ============================================

const TOKEN_EXPIRES_IN_PATTERN = /^(\d+)([smhd])?$/;

// ============================================
// Helper Functions
// ============================================

/**
 * Validates and parses a required non-empty string.
 * Trims whitespace before validation.
 */
const parseRequiredString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }

  return value.trim();
};

/**
 * Validates and parses a positive integer with optional fallback.
 * Accepts numeric or string input.
 */
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

/**
 * Validates and parses a boolean value.
 * Accepts: true/false, 1/0, yes/no (case-insensitive).
 * Returns fallback for undefined/null/empty values.
 */
const parseBoolean = (env: Record<string, unknown>, key: string, fallback: boolean): boolean => {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue !== 'string') {
    throw new Error(`${key} must be a boolean`);
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes') {
    return true;
  }

  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no') {
    return false;
  }

  throw new Error(`${key} must be a boolean`);
};

/**
 * Validates a URL with protocol enforcement.
 * @param env - Environment record
 * @param key - Environment variable key
 * @param allowedProtocols - Array of allowed protocol prefixes (e.g., ['postgres:', 'postgresql:'])
 * @param protocolDescription - Human-readable description for error messages (e.g., "postgres/postgresql")
 */
const parseUrl = (
  env: Record<string, unknown>,
  key: string,
  allowedProtocols: readonly string[],
  protocolDescription: string,
): string => {
  const url = parseRequiredString(env, key);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }

  const protocolWithColon = parsedUrl.protocol;

  if (!allowedProtocols.some((p) => protocolWithColon === p)) {
    throw new Error(`${key} must use ${protocolDescription} protocol. Got: ${protocolWithColon}`);
  }

  return url;
};

/**
 * Validates a value against a set of allowed enum values.
 * @param env - Environment record
 * @param key - Environment variable key
 * @param allowedValues - readonly tuple of allowed values
 * @param typeName - Human-readable type name for error messages
 */
const parseEnum = <T extends string>(
  env: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  typeName: string,
): T => {
  const rawValue = env[key];

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string for ${typeName}`);
  }

  const normalizedValue = rawValue.trim().toLowerCase() as T;

  if (!allowedValues.includes(normalizedValue)) {
    const allowedList = allowedValues.map((v) => `'${v}'`).join(', ');
    throw new Error(`${key} must be one of: ${allowedList}. Got: '${rawValue}'`);
  }

  return normalizedValue;
};

/**
 * Validates token expiration format.
 * Accepts: number (seconds), or number with unit suffix (e.g., 30s, 15m, 24h, 7d).
 */
const parseTokenExpiresIn = (env: Record<string, unknown>, key: string): string => {
  const rawValue = parseRequiredString(env, key).toLowerCase();

  if (!TOKEN_EXPIRES_IN_PATTERN.test(rawValue)) {
    throw new Error(
      `${key} has invalid format. Use number or number + s/m/h/d (e.g., 60, 30s, 15m, 24h, 7d)`,
    );
  }

  return rawValue;
};

// ============================================
// Main Validation Function
// ============================================

/**
 * Validates all required environment variables at startup.
 * Fails fast if any required variable is missing or invalid.
 *
 * @returns All validated environment variables in their original top-level keys.
 *          The return shape is intentionally flat to match the original implementation.
 *
 * @example
 * // After ConfigModule.forRoot({ validate: validateEnv }), you can access:
 * configService.get('DATABASE_URL');
 * configService.get('JWT_ACCESS_TOKEN_SECRET');
 */
export const validateEnv = (env: Record<string, unknown>) => {
  // Database & Cache
  const databaseUrl = parseUrl(env, 'DATABASE_URL', DATABASE_PROTOCOLS, 'postgres/postgresql');
  const redisUrl = parseUrl(env, 'REDIS_URL', REDIS_PROTOCOLS, 'redis/rediss');

  // JWT Configuration
  const jwtAccessTokenSecret = parseRequiredString(env, 'JWT_ACCESS_TOKEN_SECRET');
  const jwtRefreshTokenSecret = parseRequiredString(env, 'JWT_REFRESH_TOKEN_SECRET');
  const accessTokenExpiresIn = parseTokenExpiresIn(env, 'ACCESS_TOKEN_EXPIRES_IN');
  const refreshTokenExpiresIn = parseTokenExpiresIn(env, 'REFRESH_TOKEN_EXPIRES_IN');
  const jwtAccessTokenIssuer = parseRequiredString(env, 'JWT_ACCESS_TOKEN_ISSUER');
  const jwtAccessTokenAudience = parseRequiredString(env, 'JWT_ACCESS_TOKEN_AUDIENCE');

  // Sessions
  const refreshTokenCookieMaxAgeMs = parsePositiveInteger(env, 'REFRESH_TOKEN_COOKIE_MAX_AGE_MS');
  const maxActiveSessionsPerUser = parsePositiveInteger(env, 'MAX_ACTIVE_SESSIONS_PER_USER', 5);
  const refreshTokenReuseGraceWindowSeconds = parsePositiveInteger(
    env,
    'REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS',
    10,
  );
  const sessionBindingStrict = parseBoolean(env, 'SESSION_BINDING_STRICT', false);

  // Email Verification
  const emailVerificationTokenTtlSeconds = parsePositiveInteger(
    env,
    'EMAIL_VERIFICATION_TOKEN_TTL_SECONDS',
    1_800,
  );
  const emailVerificationBaseUrl =
    typeof env.EMAIL_VERIFICATION_BASE_URL === 'string'
      ? env.EMAIL_VERIFICATION_BASE_URL.trim()
      : '';

  // Email Provider
  const emailProvider = parseEnum(env, 'EMAIL_PROVIDER', EMAIL_PROVIDERS, 'email provider');
  const emailFromAddress = parseRequiredString(env, 'EMAIL_FROM_ADDRESS');
  const emailFromName = parseRequiredString(env, 'EMAIL_FROM_NAME');
  const resendApiKey = parseRequiredString(env, 'RESEND_API_KEY');
  const emailSendTimeoutMs = parsePositiveInteger(env, 'EMAIL_SEND_TIMEOUT_MS', 5_000);
  const emailQueueConcurrency = parsePositiveInteger(env, 'EMAIL_QUEUE_CONCURRENCY', 5);

  // Server Configuration
  const port = parsePositiveInteger(env, 'PORT', 3000);
  const nodeEnv = parseEnum(env, 'NODE_ENV', NODE_ENVS, 'NODE_ENV');
  const corsOrigins = typeof env.CORS_ORIGINS === 'string' ? env.CORS_ORIGINS : '';
  const trustProxy = parseBoolean(env, 'TRUST_PROXY', false);

  // Application Metadata (optional, with sensible defaults)
  const appName = typeof env.APP_NAME === 'string' ? env.APP_NAME.trim() : 'Quiz API';
  const appVersion = typeof env.APP_VERSION === 'string' ? env.APP_VERSION.trim() : '1.0';
  const appDescription = typeof env.APP_DESCRIPTION === 'string' ? env.APP_DESCRIPTION.trim() : '';
  const appUrl = typeof env.APP_URL === 'string' ? env.APP_URL.trim() : '';

  // Return validated environment (flat structure for backward compatibility)
  return {
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_ACCESS_TOKEN_SECRET: jwtAccessTokenSecret,
    JWT_REFRESH_TOKEN_SECRET: jwtRefreshTokenSecret,
    ACCESS_TOKEN_EXPIRES_IN: accessTokenExpiresIn,
    REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
    REFRESH_TOKEN_COOKIE_MAX_AGE_MS: refreshTokenCookieMaxAgeMs,
    MAX_ACTIVE_SESSIONS_PER_USER: maxActiveSessionsPerUser,
    REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS: refreshTokenReuseGraceWindowSeconds,
    EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: emailVerificationTokenTtlSeconds,
    JWT_ACCESS_TOKEN_ISSUER: jwtAccessTokenIssuer,
    JWT_ACCESS_TOKEN_AUDIENCE: jwtAccessTokenAudience,
    SESSION_BINDING_STRICT: sessionBindingStrict,
    TRUST_PROXY: trustProxy,
    PORT: port,
    NODE_ENV: nodeEnv,
    CORS_ORIGINS: corsOrigins,
    EMAIL_VERIFICATION_BASE_URL: emailVerificationBaseUrl,
    EMAIL_PROVIDER: emailProvider,
    EMAIL_FROM_ADDRESS: emailFromAddress,
    EMAIL_FROM_NAME: emailFromName,
    RESEND_API_KEY: resendApiKey,
    EMAIL_SEND_TIMEOUT_MS: emailSendTimeoutMs,
    EMAIL_QUEUE_CONCURRENCY: emailQueueConcurrency,
    APP_NAME: appName,
    APP_VERSION: appVersion,
    APP_DESCRIPTION: appDescription,
    APP_URL: appUrl,
  };
};

// ============================================
// Type Exports (for consumers who want them)
// ============================================

export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];
