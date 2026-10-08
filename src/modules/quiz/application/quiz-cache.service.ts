import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createHash } from 'crypto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

export const QUIZ_LIST_CACHE_TTL_MS = 10 * 60_000;
export const QUIZ_STATS_CACHE_TTL_MS = 5 * 60_000;
export const QUIZ_SINGLE_CACHE_TTL_MS = 15 * 60_000;
export const QUIZ_TRENDING_CACHE_TTL_MS = 10 * 60_000;
export const QUIZ_POPULAR_CACHE_TTL_MS = 10 * 60_000;
export const QUIZ_FEATURED_CACHE_TTL_MS = 30 * 60_000;

export const QUIZ_LIST_CACHE_NAMESPACE = 'quiz:list:v1';
export const QUIZ_STATS_CACHE_NAMESPACE = 'quiz:stats:v1';
export const QUIZ_SINGLE_CACHE_NAMESPACE = 'quiz';
export const QUIZ_TRENDING_CACHE_KEY = 'quiz:trending:v1';
export const QUIZ_POPULAR_CACHE_KEY = 'quiz:popular:v1';
export const QUIZ_FEATURED_CACHE_KEY = 'quiz:featured:v1';
export const QUIZ_AGGREGATE_CACHE_TTL_MS = 5 * 60_000;

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
   * Wipe every list-cache entry under `quiz:list:v1:*`. Called on
   * `QuizCreatedEvent` / `QuizUpdatedEvent` / `QuizDeletedEvent`.
   *
   * The catalog is small enough that a `SCAN` + `UNLINK` sweep is
   * acceptable; the keys are namespace-prefixed so the scan is
   * bounded. `UNLINK` is used over `DEL` so memory reclaim happens
   * off the Redis main thread, and `SCAN` is used over `KEYS` for
   * the same reason — `KEYS` blocks the server until the scan
   * completes.
   */
  async invalidateList(): Promise<void> {
    const removed = await this.cache.unlinkByPattern(`${QUIZ_LIST_CACHE_NAMESPACE}:*`);
    this.logger.info({ event: 'quiz_list_cache_invalidated', removed });
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

  // ─── Single quiz cache ─────────────────────────────────────────────────

  async getOrSetQuiz<T>(
    quizId: string,
    versionHash: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      this.singleQuizKey(quizId, versionHash),
      QUIZ_SINGLE_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateQuiz(quizId: string): Promise<void> {
    await this.cache.unlinkByPattern(`${QUIZ_SINGLE_CACHE_NAMESPACE}:${quizId}:v:*`);
    this.logger.debug({ event: 'quiz_cache_invalidated', quizId });
  }

  private singleQuizKey(quizId: string, versionHash: string): string {
    return `${QUIZ_SINGLE_CACHE_NAMESPACE}:${quizId}:v:${versionHash}`;
  }

  // ─── Trending cache ───────────────────────────────────────────────────

  async getOrSetTrending<T>(fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      QUIZ_TRENDING_CACHE_KEY,
      QUIZ_TRENDING_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateTrending(): Promise<void> {
    await this.cache.del(QUIZ_TRENDING_CACHE_KEY);
    this.logger.debug({ event: 'quiz_trending_cache_invalidated' });
  }

  // ─── Popular cache ─────────────────────────────────────────────────────

  async getOrSetPopular<T>(fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      QUIZ_POPULAR_CACHE_KEY,
      QUIZ_POPULAR_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidatePopular(): Promise<void> {
    await this.cache.del(QUIZ_POPULAR_CACHE_KEY);
    this.logger.debug({ event: 'quiz_popular_cache_invalidated' });
  }

  // ─── Featured cache ─────────────────────────────────────────────────────

  async getOrSetFeatured<T>(fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      QUIZ_FEATURED_CACHE_KEY,
      QUIZ_FEATURED_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateFeatured(): Promise<void> {
    await this.cache.del(QUIZ_FEATURED_CACHE_KEY);
    this.logger.debug({ event: 'quiz_featured_cache_invalidated' });
  }

  // ─── Aggregate cache ─────────────────────────────────────────────────────

  async getOrSetAggregate<T>(
    quizId: string,
    versionHash: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      this.aggregateKey(quizId, versionHash),
      QUIZ_AGGREGATE_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateAggregate(quizId: string): Promise<void> {
    await this.cache.unlinkByPattern(`quiz:aggregate:${quizId}:v:*`);
    this.logger.debug({ event: 'quiz_aggregate_cache_invalidated', quizId });
  }

  private aggregateKey(quizId: string, versionHash: string): string {
    return `quiz:aggregate:${quizId}:v:${versionHash}`;
  }

  // ─── Profile bundle cache ─────────────────────────────────────────────
  //
  // The `user:profile-bundle:v1:*` keys are owned by
  // `UserProfileBundleService`. This service only knows about list /
  // stats; the user module is responsible for invalidating the
  // profile bundle on profile / settings / streak updates.

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
