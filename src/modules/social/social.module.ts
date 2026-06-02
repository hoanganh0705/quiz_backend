import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { SocialApplicationService } from './application/social-application.service';
import { SocialService } from './domain/services/social.service';
import { SocialRepository } from './infrastructure/repositories/social.repository';
import { UserSearchAdapter } from './infrastructure/adapters/user-search.adapter';
import { RankingAdapter } from './infrastructure/adapters/ranking.adapter';
import { SocialController } from './transport/controller/social.controller';
import { SocialDomainExceptionFilter } from './transport/filters/social-domain-exception.filter';
import { SOCIAL_REPOSITORY_PORT } from './domain/ports/social-ports';
import { SOCIAL_DOMAIN_EVENT_BUS } from './domain/events';
import { SocialDomainEventBus } from './domain/events/social-domain.event-bus';
import { USER_SEARCH_PORT } from './domain/ports/user-search.port';
import { RANKING_PORT } from './domain/ports/ranking.port';
import { UserModule } from '@/modules/user/user.module';
import { RankingModule } from '@/modules/ranking/ranking.module';

@Module({
  imports: [DatabaseModule, UserModule, RankingModule],
  providers: [
    SocialApplicationService,
    SocialService,
    SocialRepository,
    UserSearchAdapter,
    RankingAdapter,
    SocialDomainExceptionFilter,
    SocialDomainEventBus,
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
    { provide: SOCIAL_DOMAIN_EVENT_BUS, useExisting: SocialDomainEventBus },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    { provide: RANKING_PORT, useExisting: RankingAdapter },
  ],
  controllers: [SocialController],
  exports: [
    SocialService,
    SocialApplicationService,
    SOCIAL_DOMAIN_EVENT_BUS,
    SocialDomainEventBus,
  ],
})
export class SocialModule {}
