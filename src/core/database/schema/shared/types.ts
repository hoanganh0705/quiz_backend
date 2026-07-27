import { customType } from 'drizzle-orm/pg-core';

// =============================================================================
// Shared column types
//
// Custom PostgreSQL types used across bounded contexts. New shared custom
// types should be declared here.
// =============================================================================

/**
 * PostgreSQL `tsvector` full-text search type.
 *
 * Used for generated full-text search columns on `users`, `quizzes`, and
 * `comments` (Q/A-era `comments_threads` was dropped). Stored as text in Drizzle's TypeScript layer because
 * drizzle-orm does not provide a native tsvector type.
 */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});
