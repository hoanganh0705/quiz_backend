import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './schema/relations';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
  schema: { ...schema, ...relations },
});

export type DrizzleDB = typeof db;

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
