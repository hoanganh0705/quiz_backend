export const DRIZZLE = Symbol('DRIZZLE');
/**
 * Phase 7 #3 — read-replica DI token. Repositories that should run
 * against the read replica (e.g. quiz list, quiz stats, user profile
 * bundle) inject `DRIZZLE_READ` instead of `DRIZZLE`. When no replica
 * URL is configured the read pool is bound to the same `pg.Pool` as
 * the primary, so the difference is invisible in single-DB setups.
 */
export const DRIZZLE_READ = Symbol('DRIZZLE_READ');
