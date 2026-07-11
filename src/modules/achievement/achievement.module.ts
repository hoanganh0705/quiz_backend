import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '@/core/database/database.module';

import { RankAchievementService } from './domain/services/rank-achievement.service';
import { RuleEngineService } from './domain/services/rule-engine.service';
import { BadgeRevocationService } from './domain/services/badge-revocation.service';
import {
  AchievementDomainEventBus,
  ACHIEVEMENT_DOMAIN_EVENT_BUS,
} from './domain/events/achievement-domain.event-bus';
import { SharedAchievementEventBusAdapter } from './domain/events/shared-achievement-event-bus.adapter';
import { SHARED_ACHIEVEMENT_EVENT_BUS } from '@/common/events/achievement-shared-events';

import { AchievementRepository } from './infrastructure/repositories/achievement.repository.impl';
import { ACHIEVEMENT_REPOSITORY_PORT } from './infrastructure/repositories/achievement.repository';
import { ScheduledEvaluationService } from './infrastructure/scheduled/scheduled-evaluation.service';
import { AchievementOutboxProcessorService } from './infrastructure/outbox/achievement-outbox-processor.service';

import { AchievementAttemptEventListenerAdapter } from './infrastructure/adapters/attempt-listener.adapter';
import { AchievementTournamentEventListenerAdapter } from './infrastructure/adapters/tournament-listener.adapter';
import { AchievementInstanceEventListenerAdapter } from './infrastructure/adapters/instance-listener.adapter';
import { UserActivityListenerAdapter } from './infrastructure/adapters/user-activity-listener.adapter';
import { UserAchievementListenerAdapter } from './infrastructure/adapters/user-achievement-listener.adapter';
import { AchievementNotificationListener } from './infrastructure/adapters/achievement-notification-listener.adapter';
import { RankingEventAchievementListenerAdapter } from './infrastructure/adapters/ranking-event-listener.adapter';

import { AchievementApplicationService } from './application/achievement.application.service';
import { ProgressTrackingService } from './application/progress-tracking.service';

import { AchievementController } from './transport/controller/achievement.controller';
import { AchievementAdminController } from './transport/controller/achievement-admin.controller';
import { AchievementPresenter } from './transport/presenters/achievement.presenter';

import { UserModule } from '@/modules/user/user.module';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { InstanceModule } from '@/modules/instance/instance.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';
import { AchievementHistoryService } from './application/achievement-history.service';
import { BadgeAnalyticsService } from './application';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    RankingModule,
    forwardRef(() => NotificationModule),
    AttemptModule,
    InstanceModule,
    TournamentModule,
  ],
  controllers: [AchievementController, AchievementAdminController],
  providers: [
    AchievementDomainEventBus,
    {
      provide: ACHIEVEMENT_DOMAIN_EVENT_BUS,
      useExisting: AchievementDomainEventBus,
    },
    SharedAchievementEventBusAdapter,
    {
      provide: SHARED_ACHIEVEMENT_EVENT_BUS,
      useExisting: SharedAchievementEventBusAdapter,
    },

    RankAchievementService,
    RuleEngineService,
    BadgeRevocationService,

    AchievementRepository,
    {
      provide: ACHIEVEMENT_REPOSITORY_PORT,
      useExisting: AchievementRepository,
    },

    ScheduledEvaluationService,

    AchievementAttemptEventListenerAdapter,
    AchievementTournamentEventListenerAdapter,
    AchievementInstanceEventListenerAdapter,
    UserActivityListenerAdapter,
    UserAchievementListenerAdapter,
    AchievementNotificationListener,
    RankingEventAchievementListenerAdapter,

    AchievementApplicationService,
    ProgressTrackingService,
    AchievementHistoryService,
    BadgeAnalyticsService,
    AchievementOutboxProcessorService,
    AchievementPresenter,
  ],
  exports: [
    AchievementDomainEventBus,
    ACHIEVEMENT_DOMAIN_EVENT_BUS,
    SHARED_ACHIEVEMENT_EVENT_BUS,

    RankAchievementService,
    RuleEngineService,
    BadgeRevocationService,

    ACHIEVEMENT_REPOSITORY_PORT,

    ScheduledEvaluationService,
    ProgressTrackingService,
    AchievementHistoryService,
    BadgeAnalyticsService,

    AchievementAttemptEventListenerAdapter,
    AchievementTournamentEventListenerAdapter,
    AchievementInstanceEventListenerAdapter,
    UserActivityListenerAdapter,

    RankingEventAchievementListenerAdapter,

    AchievementApplicationService,
  ],
})
export class AchievementModule {}
