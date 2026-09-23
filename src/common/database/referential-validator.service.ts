/**
 * Centralized referential existence checker.
 *
 * The polymorphic columns used across the schema
 * (`coin_transactions.reference_type` + `reference_id`,
 * `quiz_attempts.context_ref_id`) point to a closed set of
 * aggregates that live in other modules. Without an explicit
 * application-side check, the only validation is the database FK
 * constraint, which surfaces as a generic 23503 error and only at
 * insert time. This service runs the existence check in the
 * application layer so:
 *
 *   1. Callers get a typed domain error instead of a DB constraint
 *      failure.
 *   2. Hot paths (coins earned from attempts, daily challenges,
 *      badges) can cache the existence verdict in Redis to avoid a
 *      round-trip on every ledger row.
 *
 * The cache is best-effort: a Redis outage degrades to the same
 * synchronous DB lookup, never a write that bypasses validation.
 *
 * Cache key shape: `ref:v1:{kind}:{id}` with a positive TTL for
 * hits (`CACHE_TTL_MS`) and a shorter TTL for misses
 * (`MISS_TTL_MS`). The negative cache protects against a stampede
 * of lookups for a non-existent referent (which can happen when
 * upstream callers retry with a bad id).
 */
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '@/core/database/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  ReferencedEntityNotFoundError,
  type ReferencedEntity,
} from '@/common/database/references.types';

const CACHE_TTL_MS = 60_000;
const MISS_TTL_MS = 5_000;

@Injectable()
export class ReferentialValidatorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
  ) {}

  /**
   * Asserts that the referenced entity exists. Throws
   * `ReferencedEntityNotFoundError` if it does not.
   *
   * Use this before any insert that carries a polymorphic FK
   * column. The check is synchronous from the caller's
   * perspective (await once); subsequent calls within
   * `CACHE_TTL_MS` for the same referent skip the DB round-trip.
   */
  async assertExists(entity: ReferencedEntity): Promise<void> {
    const exists = await this.exists(entity);
    if (!exists) {
      throw new ReferencedEntityNotFoundError(entity);
    }
  }

  /**
   * Same as `assertExists` but returns a boolean instead of
   * throwing. Useful in code paths that want to silently skip
   * orphaned references (e.g. reconciliation).
   */
  async exists(entity: ReferencedEntity): Promise<boolean> {
    const key = cacheKeyFor(entity);
    try {
      const cached = await this.cache.get(key);
      if (cached === '1') return true;
      if (cached === '0') return false;
    } catch {
      // Redis hiccup → fall through to DB lookup.
    }

    const found = await this.checkDatabase(entity);
    try {
      await this.cache.set(key, found ? '1' : '0', found ? CACHE_TTL_MS : MISS_TTL_MS);
    } catch {
      // Cache failure is non-fatal; verdict already known.
    }
    return found;
  }

  /**
   * Invalidate a cached verdict (e.g. when an admin deletes a row
   * the next existence check should re-query). Errors are
   * swallowed: a stale cache entry expires within CACHE_TTL_MS.
   */
  async invalidate(entity: ReferencedEntity): Promise<void> {
    const key = cacheKeyFor(entity);
    try {
      await this.cache.del(key);
    } catch {
      // Cache failure is non-fatal; entry will expire on TTL.
    }
  }

  private async checkDatabase(entity: ReferencedEntity): Promise<boolean> {
    switch (entity.kind) {
      case 'attempt': {
        const result = await this.db
          .select({ exists: sql<number>`1` })
          .from(schema.quizAttempts)
          .where(eq(schema.quizAttempts.attemptId, entity.id))
          .limit(1);
        return result.length > 0;
      }
      case 'daily_challenge': {
        const result = await this.db
          .select({ exists: sql<number>`1` })
          .from(schema.dailyChallengeAttempt)
          .where(eq(schema.dailyChallengeAttempt.attemptId, entity.id))
          .limit(1);
        return result.length > 0;
      }
      case 'streak':
        // Streak "references" are milestone day numbers (e.g. "7"),
        // not foreign keys. Validate as a non-negative integer.
        return isPositiveIntString(entity.id);
      case 'badge':
      case 'flair': {
        const result = await this.db
          .select({ exists: sql<number>`1` })
          .from(schema.userBadges)
          .where(eq(schema.userBadges.userBadgeId, entity.id))
          .limit(1);
        return result.length > 0;
      }
      case 'tournament': {
        const result = await this.db
          .select({ exists: sql<number>`1` })
          .from(schema.tournaments)
          .where(eq(schema.tournaments.tournamentId, entity.id))
          .limit(1);
        return result.length > 0;
      }
      case 'tip':
      case 'admin':
        return this.checkUser(entity.id);
      case 'suppress': {
        const result = await this.db
          .select({ exists: sql<number>`1` })
          .from(schema.quizzes)
          .where(eq(schema.quizzes.quizId, entity.id))
          .limit(1);
        return result.length > 0;
      }
    }
  }

  private async checkUser(userId: string): Promise<boolean> {
    const result = await this.db
      .select({ exists: sql<number>`1` })
      .from(schema.users)
      .where(and(eq(schema.users.userId, userId), sql`${schema.users.deletedAt} IS NULL`))
      .limit(1);
    return result.length > 0;
  }
}

function cacheKeyFor(entity: ReferencedEntity): string {
  return `ref:v1:${entity.kind}:${entity.id}`;
}

function isPositiveIntString(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;
  return Number(value) > 0;
}
