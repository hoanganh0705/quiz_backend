import { Module } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';

// Database
import { DatabaseModule } from '@/core/database/database.module';

// Domain Services
import { RankAchievementService } from './domain/services/rank-achievement.service';
import { ConsistencyService } from './domain/services/consistency.service';
import { BadgeEvaluationService } from './domain/services/badge-evaluation.service';
import { RuleEngineService } from './domain/services/rule-engine.service';
import { ProgressTrackingService } from './domain/services/progress-tracking.service';
import { ScheduledEvaluationService } from './domain/services/scheduled-evaluation.service';
import { BadgeNotificationService } from './domain/services/badge-notification.service';
import { AchievementHistoryService } from './domain/services/achievement-history.service';
import { SeasonalBadgeService } from './domain/services/seasonal-badge.service';
import { BadgeRevocationService } from './domain/services/badge-revocation.service';
import { BadgeVersioningService } from './domain/services/badge-versioning.service';
import { RareBadgeService } from './domain/services/rare-badge.service';
import { BadgeAnalyticsService } from './domain/services/badge-analytics.service';
import { AchievementDomainEventBus } from './domain/events/achievement-domain.event-bus';

// Infrastructure - Repository
import { AchievementRepository } from './infrastructure/repositories/achievement.repository.impl';
import { ACHIEVEMENT_REPOSITORY_PORT } from './infrastructure/repositories/achievement.repository';

// Infrastructure - Event Listeners
import { RankingListenerAdapter } from './infrastructure/adapters/ranking-listener.adapter';
import { AttemptEventListenerAdapter } from './infrastructure/adapters/attempt-listener.adapter';
import { TournamentEventListenerAdapter } from './infrastructure/adapters/tournament-listener.adapter';
import { UserActivityListenerAdapter } from './infrastructure/adapters/user-activity-listener.adapter';

// Application
import { AchievementApplicationService } from './application/achievement.application.service';

// Transport
import { AchievementController } from './transport/controller/achievement.controller';
import { AchievementDomainExceptionFilter } from './transport/filters/achievement-domain-exception.filter';

// User module for activity event wiring
import { UserModule } from '@/modules/user/user.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';

@Module({
  imports: [DatabaseModule, UserModule, RankingModule, AttemptModule],
  controllers: [AchievementController],
  providers: [
    {
      provide: 'DATABASE',
      useExisting: DRIZZLE,
    },
    // Domain Event Bus
    AchievementDomainEventBus,

    // Domain Services
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,
    RuleEngineService,
    ProgressTrackingService,
    ScheduledEvaluationService,
    BadgeNotificationService,
    AchievementHistoryService,
    SeasonalBadgeService,
    BadgeRevocationService,
    BadgeVersioningService,
    RareBadgeService,
    BadgeAnalyticsService,

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
    UserActivityListenerAdapter,

    // Application
    AchievementApplicationService,

    // Exception Filter
    AchievementDomainExceptionFilter,
  ],
  exports: [
    // Domain Event Bus
    AchievementDomainEventBus,

    // Domain Services
    RankAchievementService,
    ConsistencyService,
    BadgeEvaluationService,
    RuleEngineService,
    ProgressTrackingService,
    ScheduledEvaluationService,
    BadgeNotificationService,
    AchievementHistoryService,
    SeasonalBadgeService,
    BadgeRevocationService,
    BadgeVersioningService,
    RareBadgeService,
    BadgeAnalyticsService,

    // Ports
    ACHIEVEMENT_REPOSITORY_PORT,

    // Event Listeners
    AttemptEventListenerAdapter,
    TournamentEventListenerAdapter,
    UserActivityListenerAdapter,

    // Application Service
    AchievementApplicationService,
  ],
})
export class AchievementModule {}
