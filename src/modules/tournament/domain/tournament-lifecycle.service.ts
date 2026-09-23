import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
  type TournamentRow,
  TOURNAMENT_OUTBOX_PORT,
  type TournamentOutboxPort,
} from './ports';
import {
  CATEGORY_REPOSITORY_PORT,
  type CategoryRepositoryPort,
} from '@/modules/category/domain/ports';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { getCorrelationId } from '@/common/interceptors/correlation-id';

@Injectable()
export class TournamentLifecycleService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(TOURNAMENT_OUTBOX_PORT)
    private readonly tournamentOutbox: TournamentOutboxPort,
    @Inject(CATEGORY_REPOSITORY_PORT)
    private readonly categoryRepository: CategoryRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(TournamentLifecycleService.name)
    private readonly logger: PinoLogger,
  ) {}

  async dispatchStartingSoonNotifications(params: {
    windowStartIso: string;
    windowEndIso: string;
  }): Promise<number> {
    const tournaments = await this.tournamentRepository.listTournamentsStartingSoon(params);
    const timestamp = new Date();
    const timestampIso = timestamp.toISOString();
    const correlationId = getCorrelationId();
    let scheduled = 0;

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

      const events = await Promise.all(
        participants.items.map(async (participant) => ({
          eventType: 'tournament.starting_soon' as const,
          payload: {
            eventType: 'tournament.starting_soon' as const,
            tournamentId: tournament.tournamentId,
            userId: participant.userId,
            tournamentTitle: tournament.title,
            categoryTitle: await this.resolveCategoryTitle(tournament.categoryId),
            startedAt: tournament.startAt,
            timestamp: timestampIso,
          },
          idempotencyKey: `tournament:starting_soon:${tournament.tournamentId}:${participant.userId}`,
          correlationId: correlationId ?? undefined,
        })),
      );

      await this.tournamentOutbox.scheduleTournamentEventsBatch(events, this.db, timestampIso);

      scheduled += events.length;
    }

    this.logger.info({
      event: 'tournament_starting_soon_notifications_scheduled',
      scheduled,
    });

    return scheduled;
  }

  async startDueTournaments(nowIso: string): Promise<number> {
    const tournaments = await this.tournamentRepository.listTournamentsStartingPlay({
      nowIso,
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

  /**
   * Open rounds whose `start_at` is at or before `nowIso` AND whose parent tournament is `ongoing`.
   */
  async openDueRounds(nowIso: string): Promise<number> {
    const PAGE_SIZE = 100;
    let page = 1;
    let opened = 0;

    while (true) {
      const due = await this.tournamentRepository.listDueRoundOpens({
        page,
        limit: PAGE_SIZE,
        nowIso,
      });

      if (due.items.length === 0) {
        break;
      }

      for (const item of due.items) {
        const advanced = await this.tournamentRepository.markRoundStatus({
          roundId: item.roundId,
          fromStatus: 'pending',
          toStatus: 'open',
          nowIso,
        });

        if (advanced) {
          opened += 1;
        }
      }

      if (due.items.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info({
      event: 'rounds_opened',
      opened,
    });

    return opened;
  }

  /**
   * Close rounds whose `end_at` is at or before `nowIso`.
   */
  async closeDueRounds(nowIso: string): Promise<number> {
    const PAGE_SIZE = 100;
    let page = 1;
    let closed = 0;

    while (true) {
      const due = await this.tournamentRepository.listDueRoundCloses({
        page,
        limit: PAGE_SIZE,
        nowIso,
      });

      if (due.items.length === 0) {
        break;
      }

      for (const item of due.items) {
        const advanced = await this.tournamentRepository.markRoundStatus({
          roundId: item.roundId,
          fromStatus: 'open',
          toStatus: 'finished',
          nowIso,
        });

        if (advanced) {
          closed += 1;
        }
      }

      if (due.items.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info({
      event: 'rounds_closed',
      closed,
    });

    return closed;
  }

  async finalizeDueTournaments(nowIso: string): Promise<number> {
    const PAGE_SIZE = 100;
    let page = 1;
    let finalized = 0;
    const timestamp = new Date(nowIso);
    const correlationId = getCorrelationId() ?? 'system';

    while (true) {
      const completed = await this.tournamentRepository.listCompletedTournaments({
        page,
        limit: PAGE_SIZE,
        nowIso,
      });

      if (completed.items.length === 0) {
        break;
      }

      for (const item of completed.items) {
        const result = await this.finalizeSingleTournament(
          item.tournamentId,
          nowIso,
          timestamp.toISOString(),
          correlationId,
        );

        if (result) {
          finalized += 1;
        }
      }

      if (completed.items.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info({
      event: 'tournaments_finalized',
      finalized,
    });

    return finalized;
  }

  private async finalizeSingleTournament(
    tournamentId: string,
    nowIso: string,
    timestampIso: string,
    correlationId: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const tournament = await this.tournamentRepository.markTournamentStatus({
        tournamentId,
        fromStatus: 'ongoing',
        toStatus: 'finished',
        nowIso,
        tx,
      });

      if (!tournament) {
        return false;
      }

      const standings = await this.tournamentRepository.finalizeTournament({
        tournamentId,
        nowIso,
        tx,
      });

      const categoryTitle = await this.resolveCategoryTitle(tournament.categoryId);

      for (const standing of standings) {
        await this.tournamentOutbox.scheduleTournamentEvent(
          {
            eventType: 'tournament.completed',
            payload: {
              eventType: 'tournament.completed',
              tournamentId,
              userId: standing.userId,
              tournamentTitle: tournament.title,
              categoryTitle,
              rank: standing.rank,
              totalParticipants: standing.totalParticipants,
              timestamp: timestampIso,
            },
            idempotencyKey: `tournament:completed:${tournamentId}:${standing.userId}`,
            correlationId,
          },
          tx,
          timestampIso,
        );

        if (standing.rank === 1) {
          await this.tournamentOutbox.scheduleTournamentEvent(
            {
              eventType: 'tournament.won',
              payload: {
                eventType: 'tournament.won',
                tournamentId,
                userId: standing.userId,
                tournamentTitle: tournament.title,
                categoryTitle,
                rank: standing.rank,
                prize: tournament.prize ?? undefined,
                timestamp: timestampIso,
              },
              idempotencyKey: `${tournamentId}:${standing.userId}:${standing.rank}`,
              correlationId,
            },
            tx,
            timestampIso,
          );
        }
      }

      return true;
    });
  }

  private async resolveCategoryTitle(categoryId: string | null): Promise<string | null> {
    if (categoryId === null) return null;
    const category = await this.categoryRepository.findById(categoryId);
    return category?.name ?? null;
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
