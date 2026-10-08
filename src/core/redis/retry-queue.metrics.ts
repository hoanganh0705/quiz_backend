import { Inject, Injectable } from '@nestjs/common';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';

export interface RetryQueueDlqTierConfig {
  /** Stable label used for the `tier` Prometheus dimension. */
  readonly tier: string;
  /** The full Redis key holding the bounded JSON list of dead-lettered events. */
  readonly deadLetterKey: string;
}

export interface RetryQueueTierAccess {
  readonly liveKeyForRedis: string;
  readonly dlqKey: string;
}

/**
 * Read-only view of the in-process `RetryQueue` dead-letter list.
 *
 * The retry queue pushes JSON-encoded envelopes onto a bounded Redis
 * list when an event handler fails past its retry budget. That list
 * is otherwise invisible to operators — the plan calls for a gauge
 * metric (`quiz_retry_queue_dlq_size{tier=...}`) so alerting can fire
 * whenever any tier backs up.
 */
@Injectable()
export class RetryQueueMetrics {
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
  ) {}

  /**
   * Read the length of the dead-letter list for a single tier. The
   * call is cheap (`LLEN`) and degrades gracefully when Redis is
   * unreachable — a circuit-open or transport failure returns `-1`
   * so callers can render "unknown" rather than a misleading 0.
   * @param tier Dead-letter tier (e.g. `attempt`, `coin`, `comment`).
   * @param deadLetterKey Full Redis key of the JSON list.
   */
  async getDlqSize(tier: string, deadLetterKey: string): Promise<number> {
    if (this.redisCircuit.getCircuitState() === 'open') {
      return -1;
    }
    try {
      const size = await this.cache.listLength(deadLetterKey);
      return typeof size === 'number' && size >= 0 ? size : 0;
    } catch {
      return -1;
    }
  }
}
