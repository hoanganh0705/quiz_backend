/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './schema/relations';
import { DRIZZLE } from './drizzle.constants';
import { UserSessionRepository } from '@/modules/auth/infrastructure/repositories/user-session.repository';
import { UserRepository } from '@/modules/user/infrastructure/repositories/user.repository';
import { AttemptRepository } from '@/modules/attempt/infrastructure/repositories/attempt.repository';
import { BookmarkRepository } from '@/modules/bookmark/infrastructure/repositories/bookmark.repository';
import { ReviewRepository } from '@/modules/review/infrastructure/repositories/review.repository';
import { QuizRepository } from '@/modules/quiz/infrastructure/repositories/quiz.repository';
import { QuizVersionRepository } from '@/modules/quiz/infrastructure/repositories/quiz-version.repository';
import { QuizQuestionRepository } from '@/modules/quiz/infrastructure/repositories/quiz-question.repository';

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
    AttemptRepository,
    BookmarkRepository,
    ReviewRepository,
    QuizRepository,
    QuizVersionRepository,
    QuizQuestionRepository,
  ],
  exports: [
    DRIZZLE,
    UserSessionRepository,
    UserRepository,
    AttemptRepository,
    BookmarkRepository,
    ReviewRepository,
    QuizRepository,
    QuizVersionRepository,
    QuizQuestionRepository,
  ],
})
export class DatabaseModule {}
