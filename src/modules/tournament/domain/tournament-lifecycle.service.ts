import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
  type TournamentRow,
} from './ports';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from './ports/tournament-domain-event-bus.port';
import {
  TournamentCompletedEvent,
  TournamentStartingSoonEvent,
  TournamentWonEvent,
} from './events';

@Injectable()
export class TournamentLifecycleService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly eventBus: TournamentDomainEventBusPort,
    @InjectPinoLogger(TournamentLifecycleService.name)
    private readonly logger: PinoLogger,
  ) {}

  async dispatchStartingSoonNotifications(params: {
    windowStartIso: string;
    windowEndIso: string;
  }): Promise<number> {
    const tournaments = await this.tournamentRepository.listTournamentsStartingSoon(params);
    const timestamp = new Date();
    let published = 0;

    for (const tournament of tournaments) {
      const participantCount = await this.tournamentRepository.countParticipants(
        tournament.tournamentId,
      );
      if (participantCount === 0) {
        continue;
      }

      const advanced = await this.advanceTournamentToRegistration(
        tournament,
        params.windowStartIso,
      );
      if (!advanced) {
        continue;
      }

      const participants = await this.tournamentRepository.listParticipants({
        tournamentId: tournament.tournamentId,
        page: 1,
        limit: participantCount,
      });

      for (const participant of participants.items) {
        this.eventBus.publish(
          new TournamentStartingSoonEvent(
            participant.userId,
            tournament.tournamentId,
            tournament.title,
            tournament.startAt,
            timestamp,
          ),
        );
        published += 1;
      }
    }

    this.logger.info({
      event: 'tournament_starting_soon_notifications_dispatched',
      published,
    });

    return published;
  }

  async startDueTournaments(nowIso: string): Promise<number> {
    const tournaments = await this.tournamentRepository.listTournamentsStartingSoon({
      windowStartIso: '1970-01-01T00:00:00.000Z',
      windowEndIso: nowIso,
    });

    let transitioned = 0;
    for (const tournament of tournaments) {
      const advanced = await this.tournamentRepository.markTournamentStatus({
        tournamentId: tournament.tournamentId,
        fromStatus: 'registration',
        toStatus: 'ongoing',
        nowIso,
      });

      if (advanced) {
        transitioned += 1;
      }
    }

    this.logger.info({
      event: 'tournaments_started',
      transitioned,
    });

    return transitioned;
  }

  async finalizeDueTournaments(nowIso: string): Promise<number> {
    const completed = await this.tournamentRepository.listCompletedTournaments({
      page: 1,
      limit: 100,
      nowIso,
    });

    let finalized = 0;
    const timestamp = new Date(nowIso);

    for (const item of completed.items) {
      const tournament = await this.tournamentRepository.markTournamentStatus({
        tournamentId: item.tournamentId,
        fromStatus: 'ongoing',
        toStatus: 'finished',
        nowIso,
      });

      if (!tournament) {
        continue;
      }

      const standings = await this.tournamentRepository.finalizeTournament({
        tournamentId: tournament.tournamentId,
        nowIso,
      });

      for (const standing of standings) {
        this.eventBus.publish(
          new TournamentCompletedEvent(
            standing.userId,
            tournament.tournamentId,
            tournament.title,
            standing.rank,
            standing.totalParticipants,
            timestamp,
          ),
        );

        if (standing.rank === 1) {
          this.eventBus.publish(
            new TournamentWonEvent(
              standing.userId,
              tournament.tournamentId,
              tournament.title,
              standing.rank,
              tournament.prize ?? undefined,
              timestamp,
            ),
          );
        }
      }

      finalized += 1;
    }

    this.logger.info({
      event: 'tournaments_finalized',
      finalized,
    });

    return finalized;
  }

  private async advanceTournamentToRegistration(
    tournament: TournamentRow,
    nowIso: string,
  ): Promise<boolean> {
    const advanced = await this.tournamentRepository.markTournamentStatus({
      tournamentId: tournament.tournamentId,
      fromStatus: 'upcoming',
      toStatus: 'registration',
      nowIso,
    });

    return Boolean(advanced);
  }
}
