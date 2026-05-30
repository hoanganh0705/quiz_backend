/**
 * Ranking Module
 *
 * Core ranking domain module providing XP aggregation, rank calculation,
 * leaderboards, and period management.
 *
 * Phase 1: Foundation - XP ingestion, rank calculation
 * Phase 2: Core Features - Period resets, peak tracking, history
 * Phase 3: Leaderboards & APIs - Public endpoints, caching
 */

import { Module, Global } from '@nestjs/common';

// Infrastructure
import { RankingRepository } from './infrastructure/repositories/ranking.repository';
import { RankingDomainEventBus } from './infrastructure/events/ranking-domain.event-bus';

// Domain Ports
import {
  RANKING_REPOSITORY_PORT,
  RankingRepositoryPort,
} from './domain/ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  RankingDomainEventBusPort,
  EXTERNAL_EVENT_BUS,
  ExternalEventBusPort,
} from './domain/ports/ranking-event-bus.port';

// Application Services (Phase 1 & 2)
import { XpIngestionService } from './application/xp-ingestion.service';
import { RankCalculationService } from './application/rank-calculation.service';
import { PeakRankService } from './application/peak-rank.service';
import { PeriodResetService } from './application/period-reset.service';
import { RankHistoryService } from './application/rank-history.service';
import { RankingSchedulerService } from './application/ranking-scheduler.service';
import { RankingEventHandler } from './application/ranking-event-handler';

// Application Services (Phase 3)
import { LeaderboardService } from './application/leaderboard.service';
import { UserRankService } from './application/user-rank.service';

// Controller
import { RankingController } from './ranking.controller';

// Exception Filter
import { RankingDomainExceptionFilter } from './transport/filters/ranking-domain-exception.filter';

@Global()
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
      useClass: RankingDomainEventBus,
    },
    {
      provide: EXTERNAL_EVENT_BUS,
      useExisting: RankingDomainEventBus,
    },

    // Phase 1 & 2 Services
    XpIngestionService,
    RankCalculationService,
    PeakRankService,
    PeriodResetService,
    RankHistoryService,
    RankingSchedulerService,
    RankingEventHandler,

    // Phase 3 Services
    LeaderboardService,
    UserRankService,

    // Exception Filter
    RankingDomainExceptionFilter,
  ],
  controllers: [RankingController],
  exports: [
    // Ports
    RANKING_REPOSITORY_PORT,
    RANKING_DOMAIN_EVENT_BUS,
    EXTERNAL_EVENT_BUS,

    // Phase 1 & 2 Services
    XpIngestionService,
    RankCalculationService,
    PeakRankService,
    PeriodResetService,
    RankHistoryService,
    RankingSchedulerService,

    // Phase 3 Services
    LeaderboardService,
    UserRankService,
  ],
})
export class RankingModule {}
