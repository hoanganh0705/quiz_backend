/**
 * JWT configuration.
 * Provides typed access to JWT-related environment variables.
 *
 * Both access and refresh tokens share the same issuer and audience
 * as they represent the same security context.
 */
import { ConfigType, registerAs } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

export const jwtConfig = registerAs('jwt', () => {
  const accessSecret = process.env.JWT_ACCESS_TOKEN_SECRET ?? '';
  const refreshSecret = process.env.JWT_REFRESH_TOKEN_SECRET ?? '';

  if (accessSecret.length === 0) {
    throw new Error(
      'JWT_ACCESS_TOKEN_SECRET must be a non-empty string. env.validation.ts enforces this for HTTP boot; this guard catches CLI/test paths that bypass env validation.',
    );
  }
  if (refreshSecret.length === 0) {
    throw new Error(
      'JWT_REFRESH_TOKEN_SECRET must be a non-empty string. env.validation.ts enforces this for HTTP boot; this guard catches CLI/test paths that bypass env validation.',
    );
  }

  const accessExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m';
  const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn,
    refreshExpiresIn,
    issuer: process.env.JWT_ACCESS_TOKEN_ISSUER ?? '',
    audience: process.env.JWT_ACCESS_TOKEN_AUDIENCE ?? '',
    accessExpiresInSeconds: parseDurationToSeconds(accessExpiresIn, 'ACCESS_TOKEN_EXPIRES_IN'),
    refreshExpiresInSeconds: parseDurationToSeconds(refreshExpiresIn, 'REFRESH_TOKEN_EXPIRES_IN'),
  };
});

export type JwtConfig = ConfigType<typeof jwtConfig>;
