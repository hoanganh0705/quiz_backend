import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { SearchApplicationService } from './application/search.application.service';
import { SearchController } from './transport/search.controller';
import { SearchPresenter } from './transport/search.presenter';

@Module({
  imports: [DatabaseModule],
  providers: [SearchApplicationService, SearchPresenter],
  controllers: [SearchController],
  exports: [SearchApplicationService],
})
export class SearchModule {}
