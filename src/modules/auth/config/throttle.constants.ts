import { AUTH_THROTTLE_VALUES } from '@/core/config/auth-throttle.config';
import type { AuthThrottleConfig as AuthThrottleConfigType } from '@/core/config/auth-throttle.config';

export const AUTH_THROTTLE: Readonly<AuthThrottleConfigType> = Object.freeze({
  ...AUTH_THROTTLE_VALUES,
});
