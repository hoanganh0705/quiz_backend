/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './schema/relations';
import { DRIZZLE } from './drizzle.constants';
import { UserSessionRepository } from './repositories/user-session.repository';
import { UserRepository } from './repositories/user.repository';

export { DRIZZLE } from './drizzle.constants';

const createDrizzleDb = (connectionString: string) => {
  const pool = new Pool({ connectionString });

  return drizzle(pool, {
    schema: { ...schema, ...relations },
  });
};

export type DrizzleDB = ReturnType<typeof createDrizzleDb>;

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
    UserSessionRepository,
    UserRepository,
  ],
  exports: [DRIZZLE, UserSessionRepository, UserRepository],
})
export class DatabaseModule {}
