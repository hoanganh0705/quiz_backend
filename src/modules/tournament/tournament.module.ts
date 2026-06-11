import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionOptions, Queue } from 'bullmq';
import { DatabaseModule } from '@/core/database/database.module';
import { TournamentApplicationService } from './application/tournament.application.service';
import { TournamentService } from './domain/tournament.service';
import { TournamentLifecycleService } from './domain/tournament-lifecycle.service';
import { TournamentResponseMapper } from './mappers/tournament-response.mapper';
import { TournamentController } from './transport/controller/tournament.controller';
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

@Module({
  imports: [DatabaseModule],
  providers: [
    TournamentApplicationService,
    TournamentService,
    TournamentLifecycleService,
    TournamentRepository,
    BullmqTournamentEventBusService,
    TournamentEventProcessor,
    TournamentSchedulerService,
    TournamentResponseMapper,
    TournamentDomainExceptionFilter,
    { provide: TOURNAMENT_REPOSITORY_PORT, useExisting: TournamentRepository },
    { provide: TOURNAMENT_DOMAIN_EVENT_BUS, useExisting: BullmqTournamentEventBusService },
    {
      provide: TOURNAMENT_QUEUE_TOKENS.CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ConnectionOptions => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl?.trim()) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }
        return { url: redisUrl };
      },
    },
    {
      provide: TOURNAMENT_QUEUE_TOKENS.QUEUE,
      inject: [TOURNAMENT_QUEUE_TOKENS.CONNECTION],
      useFactory: (connection: ConnectionOptions) => {
        return new Queue(TOURNAMENT_QUEUE_NAME, { connection });
      },
    },
  ],
  controllers: [TournamentController],
  exports: [
    TournamentApplicationService,
    TournamentLifecycleService,
    TOURNAMENT_DOMAIN_EVENT_BUS,
    BullmqTournamentEventBusService,
    TOURNAMENT_QUEUE_TOKENS.QUEUE,
  ],
})
export class TournamentModule {}
