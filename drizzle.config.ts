import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to .env or export it in your shell before running migrations.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  out: './src/core/database/migrations',
  schema: './src/core/database/schema',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  introspect: {
    casing: 'camel',
  },

  // extensionsFilters: ['postgis'],
  // schemaFilter: 'public',
  // tablesFilter: '*',

  // migrations: {
  //   prefix: 'timestamp',
  //   table: '__drizzle_migrations__',
  //   schema: 'public',
  // },

  // entities: {
  //   roles: {
  //     provider: '',
  //     exclude: [],
  //     include: [],
  //   },
  // },

  // breakpoints: true,
  // strict: true,
  // verbose: true,
});
