/**
 * Attempt-module endpoint throttle configuration.
 *
 * Central source of truth for `@nestjs/throttler` overrides applied via
 * `@Throttle({ default: ATTEMPT_THROTTLE.<name> })` on controller methods.
 *
 * Values here are intentionally hard-coded for now. If we ever need
 * per-environment tuning, add env-var lookups behind the same shape so
 * the controller decorators don't need to change.
 */
export const ATTEMPT_THROTTLE_VALUES = {
  startAttempt: { limit: 10, ttl: 60_000 },
  submitAnswer: { limit: 60, ttl: 60_000 },
  completeAttempt: { limit: 20, ttl: 60_000 },
} as const;

export type AttemptThrottleConfig = typeof ATTEMPT_THROTTLE_VALUES;
