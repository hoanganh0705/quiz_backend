import { Module } from '@nestjs/common';
import { ConnectionOptions, Queue } from 'bullmq';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { SHARED_TOURNAMENT_EVENT_BUS } from '@/common/events/tournament-shared-events';
import { TournamentApplicationService } from './application/tournament.application.service';
import { TournamentService } from './domain/tournament.service';
import { TournamentLifecycleService } from './domain/tournament-lifecycle.service';
import { TournamentResponseMapper } from './mappers/tournament-response.mapper';
import { TournamentController } from './transport/controller/tournament.controller';
import { TournamentPresenter } from './transport/presenters/tournament.presenter';
import { TournamentDomainExceptionFilter } from './transport/filters/tournament-domain-exception.filter';
import { TOURNAMENT_REPOSITORY_PORT } from './domain/ports';
import { TournamentRepository } from './infrastructure/repositories/tournament.repository';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  TOURNAMENT_QUEUE_NAME,
  TOURNAMENT_QUEUE_TOKENS,
} from './domain/ports';
import { BullmqTournamentEventBusService } from './infrastructure/events/bullmq-tournament-event-bus.service';
import { TournamentEventProcessor } from './infrastructure/events/tournament-event.processor';
import { TournamentSchedulerService } from './infrastructure/scheduler/tournament-scheduler.service';
import { TournamentListenerAdapter } from './infrastructure/adapters/tournament-listener.adapter';
import { SharedTournamentEventBusAdapter } from './domain/events/shared-tournament-event-bus.adapter';
import { redisConfig } from '@/core/config';
import type { RedisConfig } from '@/core/config';

@Module({
  imports: [DatabaseModule, NotificationModule],
  providers: [
    TournamentApplicationService,
    TournamentService,
    TournamentLifecycleService,
    TournamentRepository,
    BullmqTournamentEventBusService,
    TournamentEventProcessor,
    TournamentSchedulerService,
    TournamentResponseMapper,
    TournamentPresenter,
    TournamentDomainExceptionFilter,
    { provide: TOURNAMENT_REPOSITORY_PORT, useExisting: TournamentRepository },
    { provide: TOURNAMENT_DOMAIN_EVENT_BUS, useExisting: BullmqTournamentEventBusService },
    {
      provide: TOURNAMENT_QUEUE_TOKENS.CONNECTION,
      inject: [redisConfig.KEY],
      useFactory: (redis: RedisConfig): ConnectionOptions => {
        if (!redis.url) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }
        return { url: redis.url };
      },
    },
    {
      provide: TOURNAMENT_QUEUE_TOKENS.QUEUE,
      inject: [TOURNAMENT_QUEUE_TOKENS.CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        return new Queue(TOURNAMENT_QUEUE_NAME, { connection });
      },
    },
    TournamentListenerAdapter,
    SharedTournamentEventBusAdapter,
    {
      provide: SHARED_TOURNAMENT_EVENT_BUS,
      useExisting: SharedTournamentEventBusAdapter,
    },
  ],
  controllers: [TournamentController],
  exports: [
    TournamentApplicationService,
    TournamentLifecycleService,
    TOURNAMENT_DOMAIN_EVENT_BUS,
    BullmqTournamentEventBusService,
    TOURNAMENT_QUEUE_TOKENS.QUEUE,
    SHARED_TOURNAMENT_EVENT_BUS,
  ],
})
export class TournamentModule {}
