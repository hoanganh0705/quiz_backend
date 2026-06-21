/**
 * Server configuration.
 * Provides typed access to server-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const serverConfig = registerAs('server', () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  trustProxy: process.env.TRUST_PROXY === 'true',
}));

export type ServerConfig = ConfigType<typeof serverConfig>;
