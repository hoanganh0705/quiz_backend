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
import { InstanceFeedListenerAdapter } from './infrastructure/adapters/instance-feed-listener.adapter';
import { SocialNotificationListener } from './infrastructure/adapters/social-notification-listener.adapter';
import { SocialController } from './transport/controller/social.controller';
import { SocialPresenter } from './transport/presenters/social.presenter';
import { SocialDomainExceptionFilter } from './transport/filters/social-domain-exception.filter';
import { SOCIAL_REPOSITORY_PORT } from './domain/ports/social-ports';
import { SocialDomainEventBus } from './domain/events';
import { RANKING_PORT } from './domain/ports/ranking.port';
import { SOCIAL_DOMAIN_EVENT_BUS } from './domain/events/social-event-bus.port';
// Other domain modules (needed for event bus tokens)
import { UserModule } from '@/modules/user/user.module';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { DiscussionModule } from '@/modules/discussion/discussion.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { InstanceModule } from '@/modules/instance/instance.module';
import { AttemptFeedListenerAdapter } from './infrastructure/adapters/attempt-feed-listener.adapter';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AchievementModule,
    DiscussionModule,
    TournamentModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => RankingModule),
    AttemptModule,
    forwardRef(() => InstanceModule),
    JwtModule,
  ],
  providers: [
    SocialApplicationService,
    SocialService,
    SocialRepository,
    SocialPresenter,
    // Ranking port (SocialModule owns this adapter)
    RankingAdapter,
    // Event listener adapters
    AchievementFeedListenerAdapter,
    RankingFeedListenerAdapter,
    DiscussionFeedListenerAdapter,
    TournamentFeedListenerAdapter,
    AttemptFeedListenerAdapter,
    InstanceFeedListenerAdapter,
    SocialNotificationListener,
    SocialDomainExceptionFilter,
    SocialDomainEventBus,
    // Token bindings
    { provide: SOCIAL_DOMAIN_EVENT_BUS, useExisting: SocialDomainEventBus },
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
    { provide: RANKING_PORT, useExisting: RankingAdapter },
  ],
  controllers: [SocialController],
  exports: [SocialService, SocialApplicationService, SocialDomainEventBus, SOCIAL_DOMAIN_EVENT_BUS],
})
export class SocialModule {}
