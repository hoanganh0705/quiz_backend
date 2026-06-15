export interface CacheProvider {
  incrementWindowCounter(key: string, windowMs: number): Promise<number>;

  setIfNotExistsWithTtlSeconds(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  incrementCounterWithInitialTtlSeconds(key: string, ttlSeconds: number): Promise<number>;

  get(key: string): Promise<string | null>;

  set(key: string, value: string, ttlMs: number): Promise<void>;

  /**
   * Gets a cached value or computes and caches it if missing.
   * @param key Redis key
   * @param ttlMs TTL in milliseconds
   * @param fetcher async function to compute the value if not cached
   */
  getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T>;

  rpushJson<T>(key: string, item: T): Promise<number>;

  lpopJson<T>(key: string): Promise<T | null>;

  /**
   * Publish a JSON-serialized payload on a Redis pub/sub channel.
   * Returns the number of subscribers that received the message.
   * Used by cross-instance buses (e.g. session invalidation).
   */
  publish(channel: string, payload: unknown): Promise<number>;

  /**
   * Create a dedicated subscriber connection. Pub/sub in Redis
   * blocks the connection from running normal commands, so
   * subscribers must use a separate client. The caller is
   * responsible for calling `subscriber.quit()` on shutdown.
   */
  createSubscriber(): import('ioredis').default;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
