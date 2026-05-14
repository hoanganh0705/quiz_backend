export interface CacheProvider {
  incrementWindowCounter(key: string, windowMs: number): Promise<number>;

  setIfNotExistsWithTtlSeconds(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  incrementCounterWithInitialTtlSeconds(key: string, ttlSeconds: number): Promise<number>;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
