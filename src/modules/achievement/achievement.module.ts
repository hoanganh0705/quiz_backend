/**
 * Achievement Module
 *
 * Handles badge evaluation, achievement tracking, and consistency rewards.
 *
 * Domain responsibilities:
 * - Badge definitions and taxonomy
 * - Achievement evaluation rules
 * - Badge awarding and revocation
 * - Achievement history (immutable records)
 *
 * Integrates with:
 * - Ranking Domain: receives rank change events, XP events
 * - Attempt Domain: receives attempt completion events
 * - Tournament Domain: receives tournament win events
 * - User Domain: reads streak data (does NOT own streak calculation)
 */

import { Module } from '@nestjs/common';

// Database
import { DatabaseModule } from '@/core/database/database.module';

// Domain
import { RankAchievementService } from './domain/services/rank-achievement.service';
import { ConsistencyService } from './domain/services/consistency.service';
import { BadgeEvaluationService } from './domain/services/badge-evaluation.service';
import { RuleEngineService } from './domain/services/rule-engine.service';

// Infrastructure
import { AchievementRepository } from './infrastructure/repositories/achievement.repository.impl';
import { RankingListenerAdapter } from './infrastructure/adapters/ranking-listener.adapter';
import { AttemptEventListenerAdapter } from './infrastructure/adapters/attempt-listener.adapter';
import { TournamentEventListenerAdapter } from './infrastructure/adapters/tournament-listener.adapter';
import { ACHIEVEMENT_REPOSITORY_PORT } from './infrastructure/repositories/achievement.repository';

// Application
import { AchievementApplicationService } from './application/achievement.application.service';

// Ranking module for event bus
import { RankingModule } from '@/modules/ranking/ranking.module';

@Module({
  imports: [DatabaseModule, RankingModule],
  providers: [
    // Domain Services
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,
    RuleEngineService,

    // Infrastructure - Repository
    AchievementRepository,
    {
      provide: ACHIEVEMENT_REPOSITORY_PORT,
      useExisting: AchievementRepository,
    },

    // Infrastructure - Event Listeners
    RankingListenerAdapter,
    AttemptEventListenerAdapter,
    TournamentEventListenerAdapter,

    // Application
    AchievementApplicationService,
  ],
  exports: [
    // Domain Services
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,
    RuleEngineService,

    // Ports
    ACHIEVEMENT_REPOSITORY_PORT,

    // Event Listeners (for external modules to call)
    AttemptEventListenerAdapter,
    TournamentEventListenerAdapter,

    // Application Service
    AchievementApplicationService,
  ],
})
export class AchievementModule {}
