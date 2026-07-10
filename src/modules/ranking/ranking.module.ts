/**
 * Ranking Module
 *
 * Core ranking domain module providing XP aggregation, rank calculation,
 * leaderboards, and period management.
 *
 * Architecture follows the same conventions as Quiz, Attempt, Auth, and User modules:
 * - domain/: Business logic (services, types, errors, events, ports)
 * - infrastructure/: Implementations (repositories)
 * - transport/: HTTP layer (controllers, filters)
 * - application/: Orchestration (schedulers, background jobs)
 */

import { forwardRef, Module } from '@nestjs/common';
import { NotificationModule } from '@/modules/notification/notification.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';

// Infrastructure
import { RankingRepository } from './infrastructure/repositories/ranking.repository';
import { RankingNotificationListenerAdapter } from './infrastructure/adapters/ranking-notification-listener.adapter';
import { RankingConsistencySubscriber } from './infrastructure/adapters/ranking-consistency-subscriber.adapter';
import { RankingOutboxProcessorService } from './infrastructure/outbox/ranking-outbox-processor.service';
import { RankingOutboxAdapter } from './infrastructure/outbox/ranking-outbox.adapter';
import { AttemptRankingListenerAdapter } from './infrastructure/adapters/attempt-ranking-listener.adapter';
import { RankingPeriodResetNotificationAdapter } from './infrastructure/adapters/ranking-period-reset-notification.adapter';

// Domain Events
import { RankingDomainEventBus } from './domain/events/ranking-domain.event-bus';
import { SharedRankingEventBusAdapter } from './domain/events/shared-ranking-event-bus.adapter';
import { RankingEventHandler } from './domain/events/ranking.event-handler';
import { SHARED_RANKING_EVENT_BUS } from '@/common/events/ranking-shared-events';

// Domain Ports
import { RANKING_REPOSITORY_PORT } from './domain/ports/ranking-repository.port';
import { RANKING_DOMAIN_EVENT_BUS } from './domain/ports/ranking-event-bus.port';
import { RANKING_OUTBOX_PORT } from './domain/ports/ranking-outbox.port';

// Domain Services
import {
  XpIngestionService,
  RankCalculationService,
  LeaderboardService,
  UserRankService,
  PeriodResetService,
} from './domain/services';

// Application Services
import { GetLeaderboardDistributionQueryHandler } from './application/get-leaderboard-distribution.query';
import { GetMyPeakRanksQueryHandler } from './application/get-my-peak-ranks.query';
import { GetMyPercentileQueryHandler } from './application/get-my-percentile.query';
import { GetMyRankMovementQueryHandler } from './application/get-my-rank-movement.query';
import { GetMyRankingHistoryQueryHandler } from './application/get-my-ranking-history.query';
import { GetMyRankingMilestonesQueryHandler } from './application/get-my-ranking-milestones.query';
import { GetNearbyRanksQueryHandler } from './application/get-nearby-ranks.query';
import { GetTopMoversQueryHandler } from './application/get-top-movers.query';
import { GetUserRankingHistoryQueryHandler } from './application/get-user-ranking-history.query';
import { RankingApplicationService } from './application/ranking.application.service';

// Transport
import { RankingController } from './transport/controller/ranking.controller';
import { RankingAdminController } from './transport/controller/ranking-admin.controller';
import { RankingPresenter } from './transport/presenters/ranking.presenter';
import { RankingDomainExceptionFilter } from './transport/filters/ranking-domain-exception.filter';

@Module({
  imports: [NotificationModule, forwardRef(() => AttemptModule)],
  providers: [
    // Infrastructure
    RankingRepository,
    AttemptRankingListenerAdapter,
    RankingPeriodResetNotificationAdapter,
    RankingDomainEventBus,
    SharedRankingEventBusAdapter,

    // Ports
    {
      provide: RANKING_REPOSITORY_PORT,
      useClass: RankingRepository,
    },
    {
      provide: RANKING_DOMAIN_EVENT_BUS,
      useExisting: RankingDomainEventBus,
    },
    {
      provide: SHARED_RANKING_EVENT_BUS,
      useExisting: SharedRankingEventBusAdapter,
    },
    {
      provide: RANKING_OUTBOX_PORT,
      useClass: RankingOutboxAdapter,
    },

    // Domain Services
    XpIngestionService,
    RankCalculationService,
    LeaderboardService,
    UserRankService,
    PeriodResetService,

    // Application Services
    GetLeaderboardDistributionQueryHandler,
    GetMyPeakRanksQueryHandler,
    GetMyPercentileQueryHandler,
    GetMyRankMovementQueryHandler,
    GetMyRankingHistoryQueryHandler,
    GetMyRankingMilestonesQueryHandler,
    GetNearbyRanksQueryHandler,
    GetTopMoversQueryHandler,
    GetUserRankingHistoryQueryHandler,
    RankingApplicationService,

    // Domain Events
    RankingEventHandler,

    // Notification Listeners
    RankingNotificationListenerAdapter,

    // Monitoring
    RankingConsistencySubscriber,

    // Outbox Processor
    RankingOutboxProcessorService,

    // Transport
    RankingPresenter,
    RankingDomainExceptionFilter,
  ],
  controllers: [RankingController, RankingAdminController],
  exports: [
    // Ports
    RANKING_REPOSITORY_PORT,
    RANKING_DOMAIN_EVENT_BUS,
    RANKING_OUTBOX_PORT,
    SHARED_RANKING_EVENT_BUS,

    // Domain Services
    XpIngestionService,
    RankCalculationService,
    LeaderboardService,
    UserRankService,
    PeriodResetService,

    // Application Services
    GetLeaderboardDistributionQueryHandler,
    GetMyPeakRanksQueryHandler,
    GetMyPercentileQueryHandler,
    GetMyRankMovementQueryHandler,
    GetMyRankingHistoryQueryHandler,
    GetMyRankingMilestonesQueryHandler,
    GetNearbyRanksQueryHandler,
    GetTopMoversQueryHandler,
    GetUserRankingHistoryQueryHandler,
    RankingApplicationService,
  ],
})
export class RankingModule {}
