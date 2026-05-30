/**
 * Achievement Module
 *
 * Handles badge evaluation, achievement tracking, and consistency rewards.
 */

import { Module } from '@nestjs/common';

// Domain
import { RankAchievementService } from './domain/services/rank-achievement.service';
import { ConsistencyService } from './domain/services/consistency.service';
import { BadgeEvaluationService } from './domain/services/badge-evaluation.service';

// Infrastructure
import { AchievementRepository } from './infrastructure/repositories/achievement.repository.impl';
import { RankingListenerAdapter } from './infrastructure/adapters/ranking-listener.adapter';
import { ACHIEVEMENT_REPOSITORY_PORT } from './infrastructure/repositories/achievement.repository';

// Application
import { AchievementApplicationService } from './application/achievement.application.service';

@Module({
  providers: [
    // Domain Services
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,

    // Infrastructure
    AchievementRepository,
    RankingListenerAdapter,

    // Ports
    {
      provide: ACHIEVEMENT_REPOSITORY_PORT,
      useExisting: AchievementRepository,
    },

    // Application
    AchievementApplicationService,
  ],
  exports: [
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,
    AchievementApplicationService,
    ACHIEVEMENT_REPOSITORY_PORT,
  ],
})
export class AchievementModule {}
