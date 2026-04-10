/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './schema/relations';

const createDrizzleDb = (connectionString: string) => {
  const pool = new Pool({ connectionString });

  return drizzle(pool, {
    schema: { ...schema, ...relations },
  });
};

export type DrizzleDB = ReturnType<typeof createDrizzleDb>;

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (!databaseUrl) {
          throw new Error('Missing DATABASE_URL configuration');
        }

        return createDrizzleDb(databaseUrl);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
