export type NodeEnv = 'development' | 'test' | 'production';

const NODE_ENVS = ['development', 'test', 'production'] as const;
const EMAIL_PROVIDERS = ['resend'] as const;
const DATABASE_PROTOCOLS = ['postgres:', 'postgresql:'] as const;
const REDIS_PROTOCOLS = ['redis:', 'rediss:'] as const;

const TOKEN_EXPIRES_IN_PATTERN = /^(\d+)([smhd])?$/;

const parseRequiredString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }

  return value.trim();
};

const MIN_SECRET_LENGTH = 32;
const MIN_SECRET_UNIQUE_CHARS = 16;

const parseHighEntropyString = (env: Record<string, unknown>, key: string): string => {
  const value = parseRequiredString(env, key);

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${key} must be at least ${MIN_SECRET_LENGTH} characters long (got ${value.length}). Generate with: openssl rand -base64 32`,
    );
  }

  const unique = new Set(value).size;
  if (unique < MIN_SECRET_UNIQUE_CHARS) {
    throw new Error(
      `${key} must contain at least ${MIN_SECRET_UNIQUE_CHARS} distinct characters (got ${unique}). A repeating pattern is not secure.`,
    );
  }

  return value;
};

const parseStringWithDefault = (
  env: Record<string, unknown>,
  key: string,
  fallback: string,
): string => {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  if (typeof rawValue !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  return rawValue.trim();
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

  let normalizedValue: string;

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

const parseOptionalUrl = (env: Record<string, unknown>, key: string, fallback: string): string => {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  if (typeof rawValue !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${key} must be a valid URL. Got: ${trimmed}`);
  }

  return trimmed;
};

const parseCloudinaryFolder = (env: Record<string, unknown>): string => {
  const nodeEnvRaw = env.NODE_ENV;
  const nodeEnv = typeof nodeEnvRaw === 'string' ? nodeEnvRaw.trim().toLowerCase() : 'development';
  const isProduction = nodeEnv === 'production';

  const value = parseStringWithDefault(env, 'CLOUDINARY_FOLDER', 'quiz-app-dev');

  if (isProduction && value === 'quiz-app-dev') {
    throw new Error(
      'CLOUDINARY_FOLDER must not be "quiz-app-dev" in production; set it to a non-development folder name.',
    );
  }

  return value;
};

/**
 * Resolve the Redis key prefix.
 *
 * Production deployments MUST set `REDIS_KEY_PREFIX` — an empty
 * value (or whitespace) fails boot because the consequence of an
 * unprefixed prod is silent key collisions across environments
 * sharing a Redis instance.
 *
 * Development and test environments default to `dev:` and `test:`
 * respectively when the variable is unset, so a developer that
 * forgets to set one never accidentally shares keys with another
 * environment.
 */
const parseRedisKeyPrefix = (env: Record<string, unknown>): string => {
  const nodeEnvRaw = env.NODE_ENV;
  const nodeEnv = typeof nodeEnvRaw === 'string' ? nodeEnvRaw.trim().toLowerCase() : '';

  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const fallback = isTest ? 'test:' : 'dev:';

  const raw = env.REDIS_KEY_PREFIX;
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value.length === 0) {
    if (isProduction) {
      throw new Error('REDIS_KEY_PREFIX must be a non-empty string in production');
    }
    return fallback;
  }

  if (/\s/.test(value)) {
    throw new Error('REDIS_KEY_PREFIX must not contain whitespace');
  }

  return value;
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
  const databasePoolMax = parsePositiveInteger(env, 'DATABASE_POOL_MAX', 10);
  const databasePoolIdleTimeoutMs = parsePositiveInteger(
    env,
    'DATABASE_POOL_IDLE_TIMEOUT_MS',
    30_000,
  );
  const databasePoolConnectionTimeoutMs = parsePositiveInteger(
    env,
    'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
    10_000,
  );
  const databasePoolStatementTimeoutMs = parsePositiveInteger(
    env,
    'DATABASE_POOL_STATEMENT_TIMEOUT_MS',
    30_000,
  );
  const redisUrl = parseUrl(env, 'REDIS_URL', REDIS_PROTOCOLS, 'redis/rediss');
  const databaseReadReplicaUrl =
    typeof env.DATABASE_READ_REPLICA_URL === 'string' &&
    env.DATABASE_READ_REPLICA_URL.trim().length > 0
      ? env.DATABASE_READ_REPLICA_URL.trim()
      : null;
  if (databaseReadReplicaUrl !== null) {
    try {
      const replica = new URL(databaseReadReplicaUrl);
      if (!DATABASE_PROTOCOLS.some((p) => replica.protocol === p)) {
        throw new Error();
      }
    } catch {
      throw new Error('DATABASE_READ_REPLICA_URL must use postgres/postgresql protocol');
    }
  }
  const redisCircuitFailureThreshold = parsePositiveInteger(
    env,
    'REDIS_CIRCUIT_FAILURE_THRESHOLD',
    5,
  );
  const redisCircuitResetTimeoutMs = parsePositiveInteger(
    env,
    'REDIS_CIRCUIT_RESET_TIMEOUT_MS',
    30_000,
  );
  const redisKeyPrefix = parseRedisKeyPrefix(env);

  // JWT Configuration
  const jwtAccessTokenSecret = parseHighEntropyString(env, 'JWT_ACCESS_TOKEN_SECRET');
  const jwtRefreshTokenSecret = parseHighEntropyString(env, 'JWT_REFRESH_TOKEN_SECRET');
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
  const emailVerificationBaseUrl = parseOptionalUrl(env, 'EMAIL_VERIFICATION_BASE_URL', '');

  const passwordResetTokenTtlSeconds = parsePositiveInteger(
    env,
    'PASSWORD_RESET_TOKEN_TTL_SECONDS',
    3_600,
  );
  const passwordResetBaseUrl = parseOptionalUrl(
    env,
    'PASSWORD_RESET_BASE_URL',
    'http://localhost:3000/reset-password',
  );

  // Email Provider
  const emailProvider = parseEnum(env, 'EMAIL_PROVIDER', EMAIL_PROVIDERS, 'email provider');
  const emailFromAddress = parseRequiredString(env, 'EMAIL_FROM_ADDRESS');
  const emailFromName = parseRequiredString(env, 'EMAIL_FROM_NAME');
  const resendApiKey = parseRequiredString(env, 'RESEND_API_KEY');
  const emailSendTimeoutMs = parsePositiveInteger(env, 'EMAIL_SEND_TIMEOUT_MS', 5_000);
  const emailQueueConcurrency = parsePositiveInteger(env, 'EMAIL_QUEUE_CONCURRENCY', 5);
  const emailCircuitFailureThreshold = parsePositiveInteger(env, 'EMAIL_CB_FAILURE_THRESHOLD', 5);
  const emailCircuitResetTimeoutMs = parsePositiveInteger(env, 'EMAIL_CB_RESET_TIMEOUT_MS', 30_000);

  const cloudinaryCloudName = parseRequiredString(env, 'CLOUDINARY_CLOUD_NAME');
  const cloudinaryApiKey = parseRequiredString(env, 'CLOUDINARY_API_KEY');
  const cloudinaryApiSecret = parseRequiredString(env, 'CLOUDINARY_API_SECRET');
  const cloudinaryFolder = parseCloudinaryFolder(env);

  const port = parsePositiveInteger(env, 'PORT', 3000);
  const nodeEnv = parseEnum(env, 'NODE_ENV', NODE_ENVS, 'NODE_ENV');
  const corsOrigins = typeof env.CORS_ORIGINS === 'string' ? env.CORS_ORIGINS : '';

  const normalisedCorsOrigins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (nodeEnv === 'production' && normalisedCorsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must be set in production (got empty list). ' +
        'Add comma-separated allowed origins to the environment.',
    );
  }

  const prometheusScrapeTokenRaw = env.PROMETHEUS_SCRAPE_TOKEN;
  const prometheusScrapeToken =
    typeof prometheusScrapeTokenRaw === 'string' && prometheusScrapeTokenRaw.trim().length > 0
      ? prometheusScrapeTokenRaw.trim()
      : null;
  if (nodeEnv === 'production' && prometheusScrapeToken === null) {
    throw new Error(
      'PROMETHEUS_SCRAPE_TOKEN must be set in production so the /metrics endpoint can authenticate Prometheus scrapes.',
    );
  }

  const trustProxy = parseBoolean(env, 'TRUST_PROXY', false);

  const appName = typeof env.APP_NAME === 'string' ? env.APP_NAME.trim() : 'Quiz API';
  const appVersion = typeof env.APP_VERSION === 'string' ? env.APP_VERSION.trim() : '1.0';
  const appDescription = typeof env.APP_DESCRIPTION === 'string' ? env.APP_DESCRIPTION.trim() : '';
  const appUrl = typeof env.APP_URL === 'string' ? env.APP_URL.trim() : '';

  const allowProdSeed = parseBoolean(env, 'ALLOW_PROD_SEED', false);
  if (nodeEnv === 'production' && allowProdSeed) {
    throw new Error(
      'ALLOW_PROD_SEED must not be true in production; this is an emergency escape hatch only.',
    );
  }

  // Auth security knobs (defaulted; rejected in production when nonsensical)
  const passwordHistorySize = parsePositiveInteger(env, 'PASSWORD_HISTORY_SIZE', 5);
  const authAuditRetentionDays = parsePositiveInteger(env, 'AUTH_AUDIT_RETENTION_DAYS', 365);
  const authOutboxMaxRetries = parsePositiveInteger(env, 'AUTH_OUTBOX_MAX_RETRIES', 8);
  const authOutboxBaseDelaySeconds = parsePositiveInteger(
    env,
    'AUTH_OUTBOX_BASE_DELAY_SECONDS',
    30,
  );
  const authSessionInvalidationChannel = parseStringWithDefault(
    env,
    'AUTH_SESSION_INVALIDATION_CHANNEL',
    'auth:session:invalidate',
  );

  // Google OAuth (boot safety: missing GOOGLE_CLIENT_ID is allowed only in dev/test)
  const googleClientId = parseStringWithDefault(env, 'GOOGLE_CLIENT_ID', '');
  if (nodeEnv === 'production' && googleClientId.trim().length === 0) {
    throw new Error('GOOGLE_CLIENT_ID must be set in production for OAuth sign-in.');
  }
  const googleHostedDomain = parseStringWithDefault(env, 'GOOGLE_HOSTED_DOMAIN', '');

  // Coin admin guardrails
  const coinAdminDailyCapPerAdmin = parsePositiveInteger(
    env,
    'COIN_ADMIN_DAILY_CAP_PER_ADMIN',
    10_000_000,
  );

  // Runtime feature toggles
  const disableRedisSocketAdapter = parseBoolean(env, 'DISABLE_REDIS_SOCKET_ADAPTER', false);
  const swaggerEnabled = parseBoolean(env, 'SWAGGER_ENABLED', false);

  // Tournament queue concurrency (BullMQ consumer pool)
  const tournamentQueueConcurrency = parsePositiveInteger(env, 'TOURNAMENT_QUEUE_CONCURRENCY', 5);

  // Retry queue DLQ key prefixes (per tier)
  const retryQueueDlqAttemptKey = parseStringWithDefault(
    env,
    'RETRY_QUEUE_DLQ_ATTEMPT_KEY',
    'tier:attempt:dlq',
  );
  const retryQueueDlqCoinKey = parseStringWithDefault(
    env,
    'RETRY_QUEUE_DLQ_COIN_KEY',
    'tier:coin:dlq',
  );
  const retryQueueDlqCommentKey = parseStringWithDefault(
    env,
    'RETRY_QUEUE_DLQ_COMMENT_KEY',
    'tier:comment:dlq',
  );

  const softDeleteRetentionDays = (() => {
    const raw = env.SOFT_DELETE_RETENTION_DAYS;
    if (typeof raw !== 'string' || raw.trim() === '') {
      return 30;
    }
    const n = Number(raw.trim());
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      throw new Error('SOFT_DELETE_RETENTION_DAYS must be an integer between 1 and 365');
    }
    return n;
  })();

  return {
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: databasePoolMax,
    DATABASE_POOL_IDLE_TIMEOUT_MS: databasePoolIdleTimeoutMs,
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: databasePoolConnectionTimeoutMs,
    DATABASE_POOL_STATEMENT_TIMEOUT_MS: databasePoolStatementTimeoutMs,
    DATABASE_READ_REPLICA_URL: databaseReadReplicaUrl,
    REDIS_URL: redisUrl,
    REDIS_CIRCUIT_FAILURE_THRESHOLD: redisCircuitFailureThreshold,
    REDIS_CIRCUIT_RESET_TIMEOUT_MS: redisCircuitResetTimeoutMs,
    REDIS_KEY_PREFIX: redisKeyPrefix,
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
    PASSWORD_RESET_TOKEN_TTL_SECONDS: passwordResetTokenTtlSeconds,
    PASSWORD_RESET_BASE_URL: passwordResetBaseUrl,
    PROMETHEUS_SCRAPE_TOKEN: prometheusScrapeToken,
    EMAIL_PROVIDER: emailProvider,
    EMAIL_FROM_ADDRESS: emailFromAddress,
    EMAIL_FROM_NAME: emailFromName,
    RESEND_API_KEY: resendApiKey,
    EMAIL_SEND_TIMEOUT_MS: emailSendTimeoutMs,
    EMAIL_QUEUE_CONCURRENCY: emailQueueConcurrency,
    EMAIL_CB_FAILURE_THRESHOLD: emailCircuitFailureThreshold,
    EMAIL_CB_RESET_TIMEOUT_MS: emailCircuitResetTimeoutMs,
    CLOUDINARY_CLOUD_NAME: cloudinaryCloudName,
    CLOUDINARY_API_KEY: cloudinaryApiKey,
    CLOUDINARY_API_SECRET: cloudinaryApiSecret,
    CLOUDINARY_FOLDER: cloudinaryFolder,
    APP_NAME: appName,
    APP_VERSION: appVersion,
    APP_DESCRIPTION: appDescription,
    APP_URL: appUrl,
    SOFT_DELETE_RETENTION_DAYS: softDeleteRetentionDays,
    ALLOW_PROD_SEED: allowProdSeed,
    PASSWORD_HISTORY_SIZE: passwordHistorySize,
    AUTH_AUDIT_RETENTION_DAYS: authAuditRetentionDays,
    AUTH_OUTBOX_MAX_RETRIES: authOutboxMaxRetries,
    AUTH_OUTBOX_BASE_DELAY_SECONDS: authOutboxBaseDelaySeconds,
    AUTH_SESSION_INVALIDATION_CHANNEL: authSessionInvalidationChannel,
    GOOGLE_CLIENT_ID: googleClientId,
    GOOGLE_HOSTED_DOMAIN: googleHostedDomain,
    COIN_ADMIN_DAILY_CAP_PER_ADMIN: coinAdminDailyCapPerAdmin,
    DISABLE_REDIS_SOCKET_ADAPTER: disableRedisSocketAdapter,
    SWAGGER_ENABLED: swaggerEnabled,
    TOURNAMENT_QUEUE_CONCURRENCY: tournamentQueueConcurrency,
    RETRY_QUEUE_DLQ_ATTEMPT_KEY: retryQueueDlqAttemptKey,
    RETRY_QUEUE_DLQ_COIN_KEY: retryQueueDlqCoinKey,
    RETRY_QUEUE_DLQ_COMMENT_KEY: retryQueueDlqCommentKey,
  };
};

export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];
