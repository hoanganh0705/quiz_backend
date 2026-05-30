/**
 * Ranking Module
 *
 * Core ranking domain module providing XP aggregation, rank calculation,
 * leaderboards, and period management.
 *
 * Phase 1: Foundation
 * Phase 2: Core Features
 */

import { Module, Global } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Infrastructure
import { RankingRepository } from './infrastructure/repositories/ranking.repository';
import { RankingDomainEventBus } from './infrastructure/events/ranking-domain.event-bus';

// Domain Ports
import { RANKING_REPOSITORY_PORT, RankingRepositoryPort } from './domain/ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  RankingDomainEventBusPort,
  EXTERNAL_EVENT_BUS,
  ExternalEventBusPort,
} from './domain/ports/ranking-event-bus.port';

// Application Services
import { XpIngestionService } from './application/xp-ingestion.service';
import { RankCalculationService } from './application/rank-calculation.service';
import { PeakRankService } from './application/peak-rank.service';
import { PeriodResetService } from './application/period-reset.service';
import { RankHistoryService } from './application/rank-history.service';
import { RankingSchedulerService } from './application/ranking-scheduler.service';
import { RankingEventHandler } from './application/ranking-event-handler';

@Global()
@Module({
  providers: [
    // Database
    {
      provide: 'DATABASE',
      useExisting: 'DATABASE', // Reuse existing database provider
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
      useClass: RankingDomainEventBus,
    },
    {
      provide: EXTERNAL_EVENT_BUS,
      useExisting: RankingDomainEventBus, // Use the same bus for now
    },

    // Application Services
    XpIngestionService,
    RankCalculationService,
    PeakRankService,
    PeriodResetService,
    RankHistoryService,
    RankingSchedulerService,
    RankingEventHandler,
  ],
  exports: [
    // Ports
    RANKING_REPOSITORY_PORT,
    RANKING_DOMAIN_EVENT_BUS,
    EXTERNAL_EVENT_BUS,

    // Services (for other modules to use)
    XpIngestionService,
    RankCalculationService,
    PeakRankService,
    PeriodResetService,
    RankHistoryService,
    RankingSchedulerService,
  ],
})
export class RankingModule {}
