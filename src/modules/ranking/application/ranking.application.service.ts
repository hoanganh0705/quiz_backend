/**
 * Ranking Application Service
 *
 * Orchestrates ranking operations and exposes admin use cases.
 * Scheduler logic has been moved to `infrastructure/scheduler/RankingSchedulerService`.
 *
 * Application Service Responsibilities:
 * - Orchestrate use cases across domain services
 * - Expose admin operations (trigger recalculation, consistency check)
 * - Return status information
 *
 * Scheduler Responsibilities (moved to infrastructure/):
 * - Dirty rankings processing (every 30s)
 * - Period reset checks (every 30s)
 * - Historical snapshots (hourly)
 * - Consistency checks (hourly)
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RankingPeriod, type ConsistencyReport } from '../domain/types/ranking.types';
import { RankCalculationService } from '../domain/services';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';

@Injectable()
export class RankingApplicationService {
  constructor(
    private readonly rankCalculationService: RankCalculationService,
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(RankingApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Trigger an immediate rank recalculation.
   * Use sparingly - prefer the scheduled process.
   */
  async triggerImmediateRecalculation(period?: RankingPeriod): Promise<void> {
    this.logger.info({
      event: 'immediate_recalculation_triggered',
      period: period ?? 'all',
    });

    if (period) {
      await this.rankCalculationService.calculateAllRanks(period);
    } else {
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.ALL_TIME);
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.WEEKLY);
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.MONTHLY);
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.DAILY);
    }
  }

  /**
   * Returns the current operational status of the ranking system.
   */
  async getStatus(): Promise<{
    dirtyQueueSize: number;
  }> {
    const dirtyUsers = await this.rankingRepository.getDirtyUsers(0);

    return {
      dirtyQueueSize: dirtyUsers.length,
    };
  }

  /**
   * Triggers an immediate consistency check and returns the report.
   * Exposed for admin monitoring.
   */
  async triggerConsistencyCheck(): Promise<ConsistencyReport> {
    this.logger.info({ event: 'consistency_check_admin_triggered' });
    return this.rankCalculationService.performConsistencyCheck();
  }
}
