/**
 * Database configuration.
 * Provides typed access to database-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
