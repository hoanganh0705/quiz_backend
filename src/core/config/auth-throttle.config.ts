import { ConfigType, registerAs } from '@nestjs/config';

const isDisabled = process.env.AUTH_THROTTLE_DISABLED === 'true';

export const AUTH_THROTTLE_VALUES = {
  register: { limit: isDisabled ? 100_000_000 : 5, ttl: 60_000 },
  verifyEmail: { limit: isDisabled ? 100_000_000 : 10, ttl: 60_000 },
  resendVerificationEmail: { limit: isDisabled ? 100_000_000 : 5, ttl: 60_000 },
  login: { limit: isDisabled ? 100_000_000 : 10, ttl: 60_000 },
  googleLogin: { limit: isDisabled ? 100_000_000 : 10, ttl: 60_000 },
  forgotPassword: { limit: isDisabled ? 100_000_000 : 3, ttl: 60_000 },
  resetPassword: { limit: isDisabled ? 100_000_000 : 5, ttl: 60_000 },
  refreshToken: { limit: isDisabled ? 100_000_000 : 30, ttl: 60_000 },
  checkAvailability: { limit: isDisabled ? 100_000_000 : 10, ttl: 60_000 },
} as const;

export const authThrottleConfig = registerAs('authThrottle', () => AUTH_THROTTLE_VALUES);

export type AuthThrottleConfig = ConfigType<typeof authThrottleConfig>;
