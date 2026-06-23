/**
 * Sessions configuration.
 * Provides typed access to session-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

export const sessionsConfig = registerAs('sessions', () => ({
  refreshTokenCookieMaxAgeMs: Number(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE_MS ?? 604800000),
  maxActiveSessionsPerUser: Number(process.env.MAX_ACTIVE_SESSIONS_PER_USER ?? 5),
  refreshTokenReuseGraceWindowSeconds: Number(
    process.env.REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS ?? 10,
  ),
  refreshExpiresInSeconds: parseDurationToSeconds(
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    'REFRESH_TOKEN_EXPIRES_IN',
  ),
  authSessionInvalidationChannel:
    process.env.AUTH_SESSION_INVALIDATION_CHANNEL ?? 'auth:session:invalidate',
  tournamentQueueConcurrency: Number(process.env.TOURNAMENT_QUEUE_CONCURRENCY ?? 5),
}));

export type SessionsConfig = ConfigType<typeof sessionsConfig>;
