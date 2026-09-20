/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DRIZZLE, DRIZZLE_READ } from './drizzle.constants';
import { databaseConfig } from '@/core/config';
import type { DatabaseConfig } from '@/core/config';
import { UserSessionRepository } from '@/modules/auth/infrastructure/repositories/user-session.repository';
import { UserRepository } from '@/modules/user/infrastructure/repositories/user.repository';
import { AttemptRepository } from '@/modules/attempt/infrastructure/repositories/attempt.repository';
import { ReviewRepository } from '@/modules/review/infrastructure/repositories/review.repository';
import { QuizRepository } from '@/modules/quiz/infrastructure/repositories/quiz.repository';
import { QuizVersionRepository } from '@/modules/quiz/infrastructure/repositories/quiz-version.repository';
import { QuizQuestionRepository } from '@/modules/quiz/infrastructure/repositories/quiz-question.repository';
import { StorageAssetsRepository } from '@/core/storage/infrastructure/repositories/storage-assets.repository';

const createDrizzleDb = (config: DatabaseConfig, connectionString: string) => {
  const pool = new Pool({
    connectionString,
    max: config.pool.max,
    idleTimeoutMillis: config.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
  });

  const statementTimeoutMs = config.pool.statementTimeoutMs;
  pool.on('connect', (client) => {
    client.query(`SET statement_timeout = ${statementTimeoutMs}`).catch(() => {});
  });

  return drizzle(pool, { schema });
};

export type DrizzleDB = ReturnType<typeof createDrizzleDb>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [databaseConfig.KEY],
      useFactory: (databaseConfig: DatabaseConfig) => {
        return createDrizzleDb(databaseConfig, databaseConfig.url);
      },
    },
    {
      provide: DRIZZLE_READ,
      inject: [databaseConfig.KEY, DRIZZLE],
      useFactory: (databaseConfig: DatabaseConfig, primary: DrizzleDB) => {
        if (databaseConfig.readReplicaUrl) {
          return createDrizzleDb(databaseConfig, databaseConfig.readReplicaUrl);
        }
        return primary;
      },
    },
    UserSessionRepository,
    UserRepository,
    AttemptRepository,
    ReviewRepository,
    QuizRepository,
    QuizVersionRepository,
    QuizQuestionRepository,
    StorageAssetsRepository,
  ],
  exports: [
    DRIZZLE,
    DRIZZLE_READ,
    UserSessionRepository,
    UserRepository,
    AttemptRepository,
    ReviewRepository,
    QuizRepository,
    QuizVersionRepository,
    QuizQuestionRepository,
    StorageAssetsRepository,
  ],
})
export class DatabaseModule {}
