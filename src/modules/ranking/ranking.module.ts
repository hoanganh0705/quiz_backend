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

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DRIZZLE } from '@/core/database/drizzle.constants';

// Infrastructure
import { RankingRepository } from './infrastructure/repositories/ranking.repository';

// Domain Events
import { RankingDomainEventBus } from './domain/events/ranking-domain.event-bus';
import { RankingEventHandler } from './domain/events/ranking.event-handler';

// Domain Ports
import { RANKING_REPOSITORY_PORT } from './domain/ports/ranking-repository.port';
import { RANKING_DOMAIN_EVENT_BUS } from './domain/ports/ranking-event-bus.port';

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
import { RankingDomainExceptionFilter } from './transport/filters/ranking-domain-exception.filter';

@Module({
  imports: [JwtModule],
  providers: [
    {
      provide: 'DATABASE',
      useExisting: DRIZZLE,
    },
    // Infrastructure
    RankingRepository,
    RankingDomainEventBus,

    // Ports
    {
      provide: RANKING_REPOSITORY_PORT,
      useClass: RankingRepository,
    },
    {
      provide: RANKING_DOMAIN_EVENT_BUS,
      useExisting: RankingDomainEventBus,
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

    // Transport
    RankingDomainExceptionFilter,
  ],
  controllers: [RankingController],
  exports: [
    // Ports
    RANKING_REPOSITORY_PORT,
    RANKING_DOMAIN_EVENT_BUS,

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
