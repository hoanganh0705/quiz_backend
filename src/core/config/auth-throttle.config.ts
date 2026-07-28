/**
 * Auth-module endpoint throttle configuration.
 *
 * Central source of truth for `@nestjs/throttler` overrides applied via
 * `@Throttle({ default: AUTH_THROTTLE.<name> })` on controller methods.
 *
 * Each entry mirrors a per-endpoint rate limit; the global throttler default
 * (`app.module.ts` → `ThrottlerModule.forRoot`) is the fallback for endpoints
 * without an explicit override.
 *
 * Values here are intentionally hard-coded for now — the auth module's risk
 * model treats these as policy constants rather than environment-tunable
 * knobs. If we ever need per-environment tuning, add env-var lookups behind
 * the same shape so the controller decorators don't need to change.
 *
 * @see docs/audits/AUTH_MODULE_PRODUCTION_READINESS_AUDIT.md §Phase 7 #17
 */
import { ConfigType, registerAs } from '@nestjs/config';

/**
 * Single source of truth for the throttle values. Exported separately so
 * `throttle.constants.ts` (which the controller's `@Throttle` decorators
 * read at class-definition time) can import them without going through the
 * DI-bound `authThrottleConfig` factory.
 */
export const AUTH_THROTTLE_VALUES = {
  register: { limit: 5, ttl: 60_000 },
  verifyEmail: { limit: 10, ttl: 60_000 },
  resendVerificationEmail: { limit: 5, ttl: 60_000 },
  login: { limit: 10, ttl: 60_000 },
  googleLogin: { limit: 10, ttl: 60_000 },
  forgotPassword: { limit: 3, ttl: 60_000 },
  checkAvailability: { limit: 10, ttl: 60_000 },
} as const;

export const authThrottleConfig = registerAs('authThrottle', () => AUTH_THROTTLE_VALUES);

export type AuthThrottleConfig = ConfigType<typeof authThrottleConfig>;
