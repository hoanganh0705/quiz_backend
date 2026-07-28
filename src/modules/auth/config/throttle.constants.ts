import { AUTH_THROTTLE_VALUES } from '@/core/config/auth-throttle.config';
import type { AuthThrottleConfig as AuthThrottleConfigType } from '@/core/config/auth-throttle.config';

/**
 * Frozen plain-object snapshot of the auth-throttle config values, exposed
 * for decorator-time consumption.
 *
 * Used as the value source for `@Throttle({ default: AUTH_THROTTLE.register })`
 * decorators. Decorators evaluate at class-definition time, so they cannot
 * reach into the DI container — they need a plain importable value. The
 * values themselves live in {@link AUTH_THROTTLE_VALUES} (which is also the
 * factory body of `authThrottleConfig`) so there is no drift between the
 * `@Throttle` overrides applied to controller methods and the values
 * surfaced via DI to `AuthThrottleConfig`.
 *
 * @see docs/audits/AUTH_MODULE_PRODUCTION_READINESS_AUDIT.md §Phase 7 #17
 */
export const AUTH_THROTTLE: Readonly<AuthThrottleConfigType> = Object.freeze({
  ...AUTH_THROTTLE_VALUES,
});
