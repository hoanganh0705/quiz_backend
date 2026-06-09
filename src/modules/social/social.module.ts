import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { SocialApplicationService } from './application/social-application.service';
import { SocialService } from './domain/services/social.service';
import { SocialRepository } from './infrastructure/repositories/social.repository';
import { UserSearchAdapter } from './infrastructure/adapters/user-search.adapter';
import { RankingAdapter } from './infrastructure/adapters/ranking.adapter';
import { AchievementFeedListenerAdapter } from './infrastructure/adapters/achievement-feed-listener.adapter';
import { RankingFeedListenerAdapter } from './infrastructure/adapters/ranking-feed-listener.adapter';
import { DiscussionFeedListenerAdapter } from './infrastructure/adapters/discussion-feed-listener.adapter';
import { TournamentFeedListenerAdapter } from './infrastructure/adapters/tournament-feed-listener.adapter';
import { SocialController } from './transport/controller/social.controller';
import { SocialDomainExceptionFilter } from './transport/filters/social-domain-exception.filter';
import { SOCIAL_REPOSITORY_PORT } from './domain/ports/social-ports';
import { SocialDomainEventBus } from './domain/events';
import { USER_SEARCH_PORT } from './domain/ports/user-search.port';
import { RANKING_PORT } from './domain/ports/ranking.port';
import { SOCIAL_DOMAIN_EVENT_BUS } from './domain/events/social-event-bus.port';
import { UserModule } from '@/modules/user/user.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { DiscussionModule } from '@/modules/discussion/discussion.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    RankingModule,
    AchievementModule,
    DiscussionModule,
    TournamentModule,
    JwtModule,
  ],
  providers: [
    SocialApplicationService,
    SocialService,
    SocialRepository,
    UserSearchAdapter,
    RankingAdapter,
    AchievementFeedListenerAdapter,
    RankingFeedListenerAdapter,
    DiscussionFeedListenerAdapter,
    TournamentFeedListenerAdapter,
    SocialDomainExceptionFilter,
    SocialDomainEventBus,
    { provide: SOCIAL_DOMAIN_EVENT_BUS, useExisting: SocialDomainEventBus },
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    { provide: RANKING_PORT, useExisting: RankingAdapter },
  ],
  controllers: [SocialController],
  exports: [SocialService, SocialApplicationService, SocialDomainEventBus, SOCIAL_DOMAIN_EVENT_BUS],
})
export class SocialModule {}
