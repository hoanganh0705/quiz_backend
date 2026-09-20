import { ATTEMPT_THROTTLE_VALUES } from '@/core/config';
import type { AttemptThrottleConfig } from '@/core/config';

/**
 * Frozen reference to attempt-module throttle values exported from the core config.
 * Used by `@Throttle({ default: ATTEMPT_THROTTLE.<name> })` decorators.
 */
export const ATTEMPT_THROTTLE: Readonly<AttemptThrottleConfig> = Object.freeze({
  ...ATTEMPT_THROTTLE_VALUES,
});
