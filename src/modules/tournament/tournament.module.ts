import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { TournamentApplicationService } from './application/tournament.application.service';
import { TournamentService } from './domain/tournament.service';
import { TournamentLifecycleService } from './domain/tournament-lifecycle.service';
import { TournamentResponseMapper } from './mappers/tournament-response.mapper';
import { TournamentController } from './transport/controller/tournament.controller';
import { TournamentDomainExceptionFilter } from './transport/filters/tournament-domain-exception.filter';
import { TOURNAMENT_REPOSITORY_PORT } from './domain/ports';
import { TournamentRepository } from './infrastructure/repositories/tournament.repository';
import { ATTEMPT_REPOSITORY_PORT } from '@/modules/attempt/domain/ports';
import { AttemptRepository } from '@/modules/attempt/infrastructure/repositories/attempt.repository';
import { TOURNAMENT_DOMAIN_EVENT_BUS } from './domain/ports/tournament-domain-event-bus.port';
import { InMemoryTournamentDomainEventBus } from './infrastructure/events/in-memory-tournament-domain-event-bus';

@Module({
  imports: [DatabaseModule],
  providers: [
    TournamentApplicationService,
    TournamentService,
    TournamentLifecycleService,
    TournamentRepository,
    InMemoryTournamentDomainEventBus,
    TournamentResponseMapper,
    TournamentDomainExceptionFilter,
    { provide: TOURNAMENT_REPOSITORY_PORT, useExisting: TournamentRepository },
    { provide: ATTEMPT_REPOSITORY_PORT, useExisting: AttemptRepository },
    { provide: TOURNAMENT_DOMAIN_EVENT_BUS, useExisting: InMemoryTournamentDomainEventBus },
  ],
  controllers: [TournamentController],
  exports: [
    TournamentApplicationService,
    TournamentLifecycleService,
    TOURNAMENT_DOMAIN_EVENT_BUS,
    InMemoryTournamentDomainEventBus,
  ],
})
export class TournamentModule {}
