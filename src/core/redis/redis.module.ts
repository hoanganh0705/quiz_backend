import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisCircuitBreaker } from './redis-circuit-breaker';
import { redisConfig } from '@/core/config';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import { PUBSUB_PROVIDER } from '@/common/ports/pubsub.provider';
import { REDIS_CIRCUIT_PORT } from '@/common/ports/redis-circuit.port';
import { THROTTLER_CACHE_PORT } from '@/common/ports/throttler-cache.port';
import { RedisTracingWrapper } from '@/core/observability/redis-tracing.wrapper';
import { RetryQueueMetrics } from './retry-queue.metrics';

@Global()
@Module({
  providers: [
    {
      provide: RedisCircuitBreaker,
      inject: [redisConfig.KEY],
      useFactory: (config: { circuit: { failureThreshold: number; resetTimeoutMs: number } }) =>
        new RedisCircuitBreaker({
          failureThreshold: config.circuit.failureThreshold,
          resetTimeoutMs: config.circuit.resetTimeoutMs,
        }),
    },
    RedisTracingWrapper,
    RedisService,
    { provide: CACHE_PROVIDER, useExisting: RedisService },
    { provide: PUBSUB_PROVIDER, useExisting: RedisService },
    { provide: REDIS_CIRCUIT_PORT, useExisting: RedisService },
    { provide: THROTTLER_CACHE_PORT, useExisting: RedisService },
    RetryQueueMetrics,
  ],
  exports: [
    RedisService,
    RedisCircuitBreaker,
    CACHE_PROVIDER,
    PUBSUB_PROVIDER,
    REDIS_CIRCUIT_PORT,
    THROTTLER_CACHE_PORT,
    RedisTracingWrapper,
    RetryQueueMetrics,
  ],
})
export class RedisModule {}
