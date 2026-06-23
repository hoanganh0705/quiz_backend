/**
 * JWT configuration.
 * Provides typed access to JWT-related environment variables.
 *
 * Both access and refresh tokens share the same issuer and audience
 * as they represent the same security context.
 */
import { ConfigType, registerAs } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_TOKEN_SECRET ?? '',
  refreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET ?? '',
  accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
  issuer: process.env.JWT_ACCESS_TOKEN_ISSUER ?? '',
  audience: process.env.JWT_ACCESS_TOKEN_AUDIENCE ?? '',
  accessExpiresInSeconds: parseDurationToSeconds(
    process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    'ACCESS_TOKEN_EXPIRES_IN',
  ),
  refreshExpiresInSeconds: parseDurationToSeconds(
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    'REFRESH_TOKEN_EXPIRES_IN',
  ),
}));

export type JwtConfig = ConfigType<typeof jwtConfig>;
