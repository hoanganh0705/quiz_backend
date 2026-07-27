import type { DrizzleDB } from '@/core/database/database.module';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';

export type TransactionClient = PgTransaction<
  NodePgQueryResultHKT,
  Record<string, never>,
  Record<string, never>
>;

export * from './quiz-existence.port';
export * from './user-existence.port';
export * from './comment-repository.port';
