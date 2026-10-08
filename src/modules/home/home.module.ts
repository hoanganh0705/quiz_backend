import { Module, forwardRef } from '@nestjs/common';

import { QuizModule } from '@/modules/quiz/quiz.module';
import { CategoryModule } from '@/modules/category/category.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { RedisModule } from '@/core/redis/redis.module';

import { HomeApplicationService } from './application/home.application.service';
import { HomeCacheService } from './application/home-cache.service';
import { HomeController } from './transport/controller/home.controller';
import { HomePresenter } from './transport/presenter/home.presenter';

@Module({
  imports: [
    forwardRef(() => QuizModule),
    forwardRef(() => CategoryModule),
    forwardRef(() => RankingModule),
    RedisModule,
  ],
  controllers: [HomeController],
  providers: [HomeApplicationService, HomeCacheService, HomePresenter],
  exports: [HomeApplicationService, HomeCacheService],
})
export class HomeModule {}
