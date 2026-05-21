import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from 'nestjs-pino';
import { TournamentApplicationService } from './application/tournament.application.service';
import { TournamentService } from './domain/tournament.service';
import { TournamentResponseMapper } from './mappers/tournament-response.mapper';
import { TournamentController } from './transport/controller/tournament.controller';
import { TournamentDomainExceptionFilter } from './transport/filters/tournament-domain-exception.filter';
import { TOURNAMENT_REPOSITORY_PORT } from './domain/ports';
import { TournamentRepository } from '@/core/database/repositories/tournament.repository';
import { ATTEMPT_REPOSITORY_PORT } from '@/modules/attempt/domain/ports';
import { AttemptModule } from '@/modules/attempt/attempt.module';

@Module({
  imports: [DatabaseModule, LoggerModule.forRoot(), AttemptModule],
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
  ],
  controllers: [TournamentController],
  exports: [TournamentApplicationService],
})
export class TournamentModule {}
