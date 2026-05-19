// Re-export from shared location — the interface lives in common/ports
// to avoid circular dependency (core → module).
export { type CacheProvider, CACHE_PROVIDER } from '@/common/ports/cache.provider';
