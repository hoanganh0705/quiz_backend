import { Module } from '@nestjs/common';
import { TagController } from './transport/controllers/tag.controller';
import { UserTagController } from './transport/controllers/user-tag.controller';
import { TagApplicationService } from './application/tag.application.service';
import { TagDomainService } from './domain/tag.service';
import { TagRepository } from './infrastructure/repositories/tag.repository';
import { TagDomainEventBus } from './domain/events/tag-domain.event-bus';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { TAG_REPOSITORY_PORT } from './domain/ports/tag-repository.port';
import { TAG_DOMAIN_EVENT_BUS } from './domain/events/tag-domain-event-bus.port';
import { QUIZ_LISTING_PORT } from '@/modules/quiz/domain/analytics';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';

@Module({
  imports: [DatabaseModule, RedisModule, QuizModule],
  controllers: [TagController, UserTagController],
  providers: [
    TagApplicationService,
    TagDomainService,
    TagRepository,
    TagDomainEventBus,
    { provide: TAG_REPOSITORY_PORT, useClass: TagRepository },
    { provide: TAG_DOMAIN_EVENT_BUS, useExisting: TagDomainEventBus },
    { provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService },
  ],
  exports: [TagApplicationService, TAG_REPOSITORY_PORT, TAG_DOMAIN_EVENT_BUS],
})
export class TagModule {}
