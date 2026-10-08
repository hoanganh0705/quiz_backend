import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { CircuitOpenError } from '@/common/resilience/circuit-breaker';
import { type RankingDedupePort } from '@/modules/ranking/domain/ports/ranking-dedupe.port';
import { MetricsRegistry } from '@/core/observability/metrics.registry';

const KEY_PREFIX = 'xp:processed:';

@Injectable()
export class RedisRankingDedupeAdapter implements RankingDedupePort {
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(RedisRankingDedupeAdapter.name)
    private readonly logger: PinoLogger,
    @Optional()
    private readonly metrics?: MetricsRegistry,
  ) {}

  async tryClaimXp(idempotencyKey: string, ttlSeconds: number): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }
    try {
      return await this.cache.setIfNotExistsWithTtlSeconds(
        `${KEY_PREFIX}${idempotencyKey}`,
        '1',
        ttlSeconds,
      );
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.logger.warn({
          event: 'ranking_dedupe_fail_open',
          idempotencyKey,
          reason: 'redis_circuit_open',
        });
        return true;
      }
      this.logger.warn({
        event: 'ranking_dedupe_fail_open',
        idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return true;
    }
  }

  async releaseXp(idempotencyKey: string): Promise<void> {
    try {
      await this.cache.del(`${KEY_PREFIX}${idempotencyKey}`);
    } catch (error) {
      this.logger.warn({
        event: 'ranking_dedupe_release_failed',
        idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      });
      void this.metrics;
    }
  }
}
