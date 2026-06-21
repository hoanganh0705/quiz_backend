/**
 * Application metadata configuration.
 * Provides typed access to application-level environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'Quiz API',
  version: process.env.APP_VERSION ?? '1.0',
  description: process.env.APP_DESCRIPTION ?? '',
  url: process.env.APP_URL ?? '',
}));

export type AppConfig = ConfigType<typeof appConfig>;
