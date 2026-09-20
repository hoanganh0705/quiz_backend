import { ConfigType, registerAs } from '@nestjs/config';

export const AUTH_THROTTLE_VALUES = {
  register: { limit: 5, ttl: 60_000 },
  verifyEmail: { limit: 10, ttl: 60_000 },
  resendVerificationEmail: { limit: 5, ttl: 60_000 },
  login: { limit: 10, ttl: 60_000 },
  googleLogin: { limit: 10, ttl: 60_000 },
  forgotPassword: { limit: 3, ttl: 60_000 },
  resetPassword: { limit: 5, ttl: 60_000 },
  refreshToken: { limit: 30, ttl: 60_000 },
  checkAvailability: { limit: 10, ttl: 60_000 },
} as const;

export const authThrottleConfig = registerAs('authThrottle', () => AUTH_THROTTLE_VALUES);

export type AuthThrottleConfig = ConfigType<typeof authThrottleConfig>;
