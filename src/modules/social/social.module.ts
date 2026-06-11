import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { SocialApplicationService } from './application/social-application.service';
import { SocialService } from './domain/services/social.service';
import { SocialRepository } from './infrastructure/repositories/social.repository';
import { RankingAdapter } from './infrastructure/adapters/ranking.adapter';
import { AchievementFeedListenerAdapter } from './infrastructure/adapters/achievement-feed-listener.adapter';
import { RankingFeedListenerAdapter } from './infrastructure/adapters/ranking-feed-listener.adapter';
import { DiscussionFeedListenerAdapter } from './infrastructure/adapters/discussion-feed-listener.adapter';
import { TournamentFeedListenerAdapter } from './infrastructure/adapters/tournament-feed-listener.adapter';
import { SocialNotificationListener } from './infrastructure/adapters/social-notification-listener.adapter';
import { SocialController } from './transport/controller/social.controller';
import { SocialDomainExceptionFilter } from './transport/filters/social-domain-exception.filter';
import { SOCIAL_REPOSITORY_PORT } from './domain/ports/social-ports';
import { SocialDomainEventBus } from './domain/events';
import { RANKING_PORT } from './domain/ports/ranking.port';
import { SOCIAL_DOMAIN_EVENT_BUS } from './domain/events/social-event-bus.port';
// Ranking infrastructure (local instances, no RankingModule import needed)
import { RankingDomainEventBus } from '@/modules/ranking/domain/events/ranking-domain.event-bus';
import { RankingRepository } from '@/modules/ranking/infrastructure/repositories/ranking.repository';
import { RANKING_DOMAIN_EVENT_BUS } from '@/modules/ranking/domain/ports/ranking-event-bus.port';
import { RANKING_REPOSITORY_PORT } from '@/modules/ranking/domain/ports/ranking-repository.port';
// Other domain modules (needed for event bus tokens)
import { UserModule } from '@/modules/user/user.module';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { DiscussionModule } from '@/modules/discussion/discussion.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';
import { NotificationModule } from '@/modules/notification/notification.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AchievementModule,
    DiscussionModule,
    TournamentModule,
    forwardRef(() => NotificationModule),
    JwtModule,
  ],
  providers: [
    SocialApplicationService,
    SocialService,
    SocialRepository,
    // Ranking infrastructure (local instances for SocialModule)
    RankingRepository,
    RankingDomainEventBus,
    RankingAdapter,
    // Event listener adapters
    AchievementFeedListenerAdapter,
    RankingFeedListenerAdapter,
    DiscussionFeedListenerAdapter,
    TournamentFeedListenerAdapter,
    SocialNotificationListener,
    SocialDomainExceptionFilter,
    SocialDomainEventBus,
    // Token bindings
    { provide: SOCIAL_DOMAIN_EVENT_BUS, useExisting: SocialDomainEventBus },
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
    { provide: RANKING_PORT, useExisting: RankingAdapter },
    { provide: RANKING_DOMAIN_EVENT_BUS, useExisting: RankingDomainEventBus },
    { provide: RANKING_REPOSITORY_PORT, useExisting: RankingRepository },
  ],
  controllers: [SocialController],
  exports: [SocialService, SocialApplicationService, SocialDomainEventBus, SOCIAL_DOMAIN_EVENT_BUS],
})
export class SocialModule {}
