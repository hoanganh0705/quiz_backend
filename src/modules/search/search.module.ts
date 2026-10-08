import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { SearchApplicationService } from './application/search.application.service';
import { SearchController } from './transport/search.controller';
import { SearchPresenter } from './transport/search.presenter';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [SearchApplicationService, SearchPresenter],
  controllers: [SearchController],
  exports: [SearchApplicationService],
})
export class SearchModule {}
