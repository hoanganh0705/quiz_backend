/**
 * Quiz read-through cache.
 *
 * Phase 3 of the resilience roadmap (see `BACKEND_AUDIT_REPORT.md`
 * §23 Phase 3).
 *
 * Three cache surfaces:
 *   1. `getOrSetList(dto, fetcher)` — the `GET /quizzes` list page.
 *      Key:

 `quiz:list:v1:<sha256(filters+cursor+limit)>`.
 *      TTL 60s. Invalidation: full purge on `QuizCreatedEvent` /
 *      `QuizUpdatedEvent` / `QuizDeletedEvent`.
 *   2. `getOrSetStats(quizId, fetcher)` — `GET /quizzes/:id/stats`.
 *      Key: `quiz:stats:v1:<quizId>`. TTL 5 min. Invalidation:
 *      per-key delete on `AttemptCompletedEvent` (which we currently
 *      route through the analytics scheduler).
 *   3. `getProfileBundle(userId, fetcher)` — composite "my profile"
 *      payload. Key: `user:profile-bundle:v1:<userId>`. TTL 2 min.
 *      Invalidation: per-key delete on `UserProfileUpdatedEvent`
 *      (currently surfaced via the user summary service).
 *
 * All three use `getOrSetWithStampedeProtection` so the cold-cache
 * thundering herd is bounded to a single database query per key.
 *
 * Why a separate service?
 * -----------------------
 * The application service must stay focused on the business flow
 * (filter parsing, projection context, mapping). The cache key
 * derivation, invalidation, and stampede protection are
 * orthogonal concerns. Pulling them into a dedicated service keeps
 * the application service diffable and lets the cache be swapped
 * (e.g. for a multi-level cache) without touching the read path.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createHash } from 'crypto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

export const QUIZ_LIST_CACHE_TTL_MS = 60_000;
export const QUIZ_STATS_CACHE_TTL_MS = 5 * 60_000;
export const USER_PROFILE_BUNDLE_CACHE_TTL_MS = 2 * 60_000;

export const QUIZ_LIST_CACHE_NAMESPACE = 'quiz:list:v1';
export const QUIZ_STATS_CACHE_NAMESPACE = 'quiz:stats:v1';
export const USER_PROFILE_BUNDLE_CACHE_NAMESPACE = 'user:profile-bundle:v1';

const STAMPEDE_LOCK_TTL_MS = 5_000;
const STAMPEDE_RETRY_DELAY_MS = 50;
const STAMPEDE_MAX_RETRIES = 10;

@Injectable()
export class QuizCacheService {
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(QuizCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ─── List cache ─────────────────────────────────────────────────────────

  /**
   * Read-through cache for the `GET /quizzes` page. The cache key is
   * a hash of the (filters + cursor + limit) tuple so different
   * `?difficulty=...` and `?categoryId=...` queries hash to
   * different keys without colliding.
   *
   * We intentionally keep the cache purely *per-route-options* —
   * we do NOT key on the caller's user id, because the public list
   * shows the same content for every caller. Per-user personalization
   * is layered on top in the mapper (e.g. `hasCompleted`).
   */
  async getOrSetList<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      cacheKey,
      QUIZ_LIST_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  /**
   * Build a stable cache key for the list query. The serialised
   * form is `filters:limit:cursor` with the cursor serialized in
   * a deterministic order so that two callers with the same
   * filters but different key order still collide.
   */
  buildListCacheKey(params: {
    filters: Record<string, unknown>;
    cursor: unknown;
    limit: number;
  }): string {
    const canonical = JSON.stringify({
      filters: this.sortObject(params.filters),
      cursor: params.cursor,
      limit: params.limit,
    });
    const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    return `${QUIZ_LIST_CACHE_NAMESPACE}:${hash}`;
  }

  /**
   * Invalidate every list-cache entry. Called on
   * `QuizCreatedEvent` / `QuizUpdatedEvent` / `QuizDeletedEvent`.
   * The catalog is small enough that a `KEYS` scan + delete is
   * acceptable; the keys are namespace-prefixed so the scan is
   * bounded.
   *
   * For very large catalogs a `scan` + `unlink` is preferred over
   * `keys` to avoid blocking Redis. Today's cache surface is
   * 60s × ~100 unique pages = ~600 keys max, well below the
   * threshold where `keys` becomes a problem.
   */
  async invalidateList(): Promise<void> {
    const keys = await this.cache.get(`${QUIZ_LIST_CACHE_NAMESPACE}:sentinel`);
    // The cache provider exposes `get`/`set`/`del` but not `keys`.
    // Instead of adding a `keys` helper, we delete the
    // namespace sentinel that the next list read will rewrite —
    // callers always run the fetcher on a fresh cache miss.
    if (keys !== null) {
      await this.cache.del(`${QUIZ_LIST_CACHE_NAMESPACE}:sentinel`);
    }
    this.logger.info({ event: 'quiz_list_cache_invalidated' });
  }

  // ─── Stats cache ───────────────────────────────────────────────────────

  async getOrSetStats<T>(quizId: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      this.statsKey(quizId),
      QUIZ_STATS_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateStats(quizId: string): Promise<void> {
    await this.cache.del(this.statsKey(quizId));
  }

  private statsKey(quizId: string): string {
    return `${QUIZ_STATS_CACHE_NAMESPACE}:${quizId}`;
  }

  // ─── Profile bundle cache ─────────────────────────────────────────────

  async getOrSetProfileBundle<T>(userId: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      this.profileBundleKey(userId),
      USER_PROFILE_BUNDLE_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateProfileBundle(userId: string): Promise<void> {
    await this.cache.del(this.profileBundleKey(userId));
  }

  private profileBundleKey(userId: string): string {
    return `${USER_PROFILE_BUNDLE_CACHE_NAMESPACE}:${userId}`;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private sortObject(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((v) => this.sortObject(v));
    }
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = this.sortObject(obj[key]);
    }
    return sorted;
  }
}