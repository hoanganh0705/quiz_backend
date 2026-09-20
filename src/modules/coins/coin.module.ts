import { forwardRef as nestForwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { CoinController } from './transport/controller/coin.controller';
import { CoinAdminController } from './transport/controller/coin-admin.controller';

// Domain
import { CoinIngestionService } from './domain/services/coin-ingestion.service';
import { CoinSpendService } from './domain/services/coin-spend.service';
import { CoinMetricsService } from './domain/services/coin-metrics.service';
import { COIN_INGESTION_PORT } from './domain/ports/coin-ingestion.port';
import { COIN_SPEND_PORT } from './domain/ports/coin-spend.port';
import { COIN_REPOSITORY_PORT } from './domain/ports/coin-repository.port';
import { COIN_OUTBOX_PORT } from './domain/ports/coin-outbox.port';
import { CoinDomainEventBus } from './domain/events/coin-domain.event-bus';
import { COIN_DOMAIN_EVENT_BUS } from './domain/events/coin-domain-event-bus.port';

// Infrastructure
import { CoinRepository } from './infrastructure/repositories/coin.repository';
import { CoinOutboxAdapter } from './infrastructure/outbox/coin-outbox.adapter';
import { CoinOutboxProcessorService } from './infrastructure/outbox/coin-outbox-processor.service';
import { CoinReconciliationSchedulerService } from './infrastructure/scheduler/coin-reconciliation.scheduler';
import { AttemptCoinListenerAdapter } from './infrastructure/adapters/attempt-coin-listener.adapter';
import { DailyChallengeCoinListenerAdapter } from './infrastructure/adapters/daily-challenge-coin-listener.adapter';
import { StreakCoinListenerAdapter } from './infrastructure/adapters/streak-coin-listener.adapter';
import { AchievementCoinListenerAdapter } from './infrastructure/adapters/achievement-coin-listener.adapter';
import { TournamentCoinListenerAdapter } from './infrastructure/adapters/tournament-coin-listener.adapter';
import { CoinWebSocketListener } from './infrastructure/adapters/coin-websocket-listener.adapter';

// Transport
import { CoinGateway } from './transport/gateway/coin.gateway';
import { CoinPresenter } from './transport/presenters/coin.presenter';
import { CoinApplicationService } from './application/coin.application.service';

// Cross-module imports
import { AttemptModule } from '@/modules/attempt/attempt.module';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { DailyChallengeModule } from '@/modules/daily-challenge/daily-challenge.module';
import { UserModule } from '@/modules/user/user.module';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import { ACHIEVEMENT_DOMAIN_EVENT_BUS } from '@/modules/achievement/domain/events/achievement-domain.event-bus';
import { DAILY_CHALLENGE_DOMAIN_EVENT_BUS } from '@/modules/daily-challenge/domain/events/daily-challenge-domain.event-bus';
import { USER_DOMAIN_EVENT_BUS } from '@/modules/user/domain/events/user-domain-event-bus.port';

/**
 * CoinModule
 *

 */
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AttemptModule,
    AchievementModule,

    nestForwardRef(() => DailyChallengeModule),
    nestForwardRef(() => UserModule),
  ],
  controllers: [CoinController, CoinAdminController],
  providers: [
    // Domain services
    CoinIngestionService,
    {
      provide: COIN_INGESTION_PORT,
      useExisting: CoinIngestionService,
    },
    CoinSpendService,
    {
      provide: COIN_SPEND_PORT,
      useExisting: CoinSpendService,
    },
    CoinMetricsService,

    // Domain event bus
    CoinDomainEventBus,
    {
      provide: COIN_DOMAIN_EVENT_BUS,
      useExisting: CoinDomainEventBus,
    },

    // Infrastructure
    CoinRepository,
    {
      provide: COIN_REPOSITORY_PORT,
      useExisting: CoinRepository,
    },
    CoinOutboxAdapter,
    {
      provide: COIN_OUTBOX_PORT,
      useExisting: CoinOutboxAdapter,
    },
    CoinOutboxProcessorService,
    CoinReconciliationSchedulerService,

    // Cross-module listeners (earn side)
    AttemptCoinListenerAdapter,
    DailyChallengeCoinListenerAdapter,
    StreakCoinListenerAdapter,
    AchievementCoinListenerAdapter,
    TournamentCoinListenerAdapter,

    CoinGateway,
    CoinWebSocketListener,

    // Transport + application
    CoinPresenter,
    CoinApplicationService,
  ],
  exports: [COIN_INGESTION_PORT, COIN_SPEND_PORT, COIN_REPOSITORY_PORT, COIN_DOMAIN_EVENT_BUS],
})
export class CoinModule {}

// Mark port token symbols as referenced — the `@Inject(port)` calls
// live inside the listener adapters, not on this module's providers.
void COIN_OUTBOX_PORT;
void ATTEMPT_DOMAIN_EVENT_BUS;
void ACHIEVEMENT_DOMAIN_EVENT_BUS;
void DAILY_CHALLENGE_DOMAIN_EVENT_BUS;
void USER_DOMAIN_EVENT_BUS;
