import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { SocialApplicationService } from './application/social-application.service';
import { SocialService } from './domain/services/social.service';
import {
  SocialRepository,
  FriendshipRepository,
  UserFollowRepository,
  BlockRepository,
} from './infrastructure/repositories';
import { SocialCacheService } from './infrastructure/cache';
import { RankingAdapter } from './infrastructure/adapters/ranking.adapter';
import { AchievementFeedListenerAdapter } from './infrastructure/adapters/achievement-feed-listener.adapter';
import { RankingFeedListenerAdapter } from './infrastructure/adapters/ranking-feed-listener.adapter';
import { CommentFeedListenerAdapter } from './infrastructure/adapters/comment-feed-listener.adapter';
import { TournamentFeedListenerAdapter } from './infrastructure/adapters/tournament-feed-listener.adapter';
import { InstanceFeedListenerAdapter } from './infrastructure/adapters/instance-feed-listener.adapter';
import { SocialNotificationListener } from './infrastructure/adapters/social-notification-listener.adapter';
import { SocialController } from './transport/controller/social.controller';
import { SocialPresenter } from './transport/presenters/social.presenter';
import {
  SOCIAL_REPOSITORY_PORT,
  FRIENDSHIP_REPOSITORY_PORT,
  USER_FOLLOW_REPOSITORY_PORT,
  BLOCK_REPOSITORY_PORT,
} from './domain/ports';
import { SocialDomainEventBus } from './domain/events';
import { RANKING_PORT } from './domain/ports/ranking.port';
import { SOCIAL_DOMAIN_EVENT_BUS } from './domain/events/social-event-bus.port';
// Other domain modules (needed for event bus tokens)
// Phase 1 (S-2): UserModule now forward-refs SocialModule (so the
// summary endpoint can inject SocialService). The reverse edge of
// that cycle needs the same treatment here — Social already depends
// on UserModule for its event-bus and token bindings, so we wrap
// our side in `forwardRef` to break the import cycle. Nest resolves
// the bidirectional forward refs at module-graph construction time.
import { UserModule } from '@/modules/user/user.module';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { CommentModule } from '@/modules/comment/comment.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { InstanceModule } from '@/modules/instance/instance.module';
import { AttemptFeedListenerAdapter } from './infrastructure/adapters/attempt-feed-listener.adapter';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    forwardRef(() => UserModule),
    AchievementModule,
    CommentModule,
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
    // Specialized repositories
    SocialRepository,
    FriendshipRepository,
    UserFollowRepository,
    BlockRepository,
    // Cache service
    SocialCacheService,
    // Presenter
    SocialPresenter,
    // Ranking port (SocialModule owns this adapter)
    RankingAdapter,
    // Event listener adapters
    AchievementFeedListenerAdapter,
    RankingFeedListenerAdapter,
    CommentFeedListenerAdapter,
    TournamentFeedListenerAdapter,
    AttemptFeedListenerAdapter,
    InstanceFeedListenerAdapter,
    SocialNotificationListener,
    SocialDomainEventBus,
    // Token bindings
    { provide: SOCIAL_DOMAIN_EVENT_BUS, useExisting: SocialDomainEventBus },
    { provide: SOCIAL_REPOSITORY_PORT, useExisting: SocialRepository },
    { provide: FRIENDSHIP_REPOSITORY_PORT, useExisting: FriendshipRepository },
    { provide: USER_FOLLOW_REPOSITORY_PORT, useExisting: UserFollowRepository },
    { provide: BLOCK_REPOSITORY_PORT, useExisting: BlockRepository },
    { provide: RANKING_PORT, useExisting: RankingAdapter },
  ],
  controllers: [SocialController],
  exports: [
    SocialService,
    SocialApplicationService,
    SocialDomainEventBus,
    SOCIAL_DOMAIN_EVENT_BUS,
    FRIENDSHIP_REPOSITORY_PORT,
    USER_FOLLOW_REPOSITORY_PORT,
    BLOCK_REPOSITORY_PORT,
  ],
})
export class SocialModule {}
