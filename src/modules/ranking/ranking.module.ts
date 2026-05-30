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

// Infrastructure
import { RankingRepository } from './infrastructure/repositories/ranking.repository';

// Domain Events
import { RankingDomainEventBus } from './domain/events/ranking-domain.event-bus';
import { RankingEventHandler } from './domain/events/ranking.event-handler';

// Domain Ports
import { RANKING_REPOSITORY_PORT } from './domain/ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  EXTERNAL_EVENT_BUS,
} from './domain/ports/ranking-event-bus.port';

// Domain Services
import {
  XpIngestionService,
  RankCalculationService,
  LeaderboardService,
  UserRankService,
  PeriodResetService,
} from './domain/services';

// Application Services
import { RankingApplicationService } from './application/ranking.application.service';

// Transport
import { RankingController } from './transport/controller/ranking.controller';
import { RankingDomainExceptionFilter } from './transport/filters/ranking-domain-exception.filter';

@Module({
  providers: [
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
    {
      provide: EXTERNAL_EVENT_BUS,
      useExisting: RankingDomainEventBus,
    },

    // Domain Services
    XpIngestionService,
    RankCalculationService,
    LeaderboardService,
    UserRankService,
    PeriodResetService,

    // Application Services
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
    EXTERNAL_EVENT_BUS,

    // Domain Services
    XpIngestionService,
    RankCalculationService,
    LeaderboardService,
    UserRankService,
    PeriodResetService,

    // Application Services
    RankingApplicationService,
  ],
})
export class RankingModule {}
