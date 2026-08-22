import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisCircuitBreaker } from './redis-circuit-breaker';
import { redisConfig } from '@/core/config';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import { PUBSUB_PROVIDER } from '@/common/ports/pubsub.provider';

@Global()
@Module({
  providers: [
    // Phase 2 #1: construct the breaker from the validated Redis config.
    // The breaker is built once per process and shared by every Redis call.
    {
      provide: RedisCircuitBreaker,
      inject: [redisConfig.KEY],
      useFactory: (config: { circuit: { failureThreshold: number; resetTimeoutMs: number } }) =>
        new RedisCircuitBreaker({
          failureThreshold: config.circuit.failureThreshold,
          resetTimeoutMs: config.circuit.resetTimeoutMs,
        }),
    },
    RedisService,
    { provide: CACHE_PROVIDER, useExisting: RedisService },
    { provide: PUBSUB_PROVIDER, useExisting: RedisService },
  ],
  exports: [RedisService, RedisCircuitBreaker, CACHE_PROVIDER, PUBSUB_PROVIDER],
})
export class RedisModule {}