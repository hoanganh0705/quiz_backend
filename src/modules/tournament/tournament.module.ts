import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { TournamentApplicationService } from './application/tournament.application.service';
import { TournamentService } from './domain/tournament.service';
import { TournamentResponseMapper } from './mappers/tournament-response.mapper';
import { TournamentController } from './transport/controller/tournament.controller';
import { TournamentDomainExceptionFilter } from './transport/filters/tournament-domain-exception.filter';
import { TOURNAMENT_REPOSITORY_PORT } from './domain/ports';
import { TournamentRepository } from '@/core/database/repositories/tournament.repository';
import { ATTEMPT_REPOSITORY_PORT } from '@/modules/attempt/domain/ports';
import { AttemptRepository } from '@/core/database/repositories/attempt.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Application
    TournamentApplicationService,

    // Domain
    TournamentService,

    // Repository
    TournamentRepository,

    // Mapper
    TournamentResponseMapper,

    // Exception filter
    TournamentDomainExceptionFilter,

    // Port bindings
    { provide: TOURNAMENT_REPOSITORY_PORT, useExisting: TournamentRepository },
    { provide: ATTEMPT_REPOSITORY_PORT, useExisting: AttemptRepository },
  ],
  controllers: [TournamentController],
  exports: [TournamentApplicationService],
})
export class TournamentModule {}
