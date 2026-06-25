import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import { PUBSUB_PROVIDER } from '@/common/ports/pubsub.provider';

@Global()
@Module({
  providers: [
    RedisService,
    { provide: CACHE_PROVIDER, useExisting: RedisService },
    { provide: PUBSUB_PROVIDER, useExisting: RedisService },
  ],
  exports: [RedisService, CACHE_PROVIDER, PUBSUB_PROVIDER],
})
export class RedisModule {}
