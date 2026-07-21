/**
 * Tournament Lifecycle Service
 *
 * Phase 3 / Issue #5 — events are now scheduled to the transactional outbox
 * (via `TournamentOutboxPort`) INSIDE the same transaction as the business
 * write, guaranteeing at-least-once delivery even if the process crashes
 * between commit and publish.
 *
 * Phase 3 / Issue #40 — `finalizeDueTournaments` now wraps both
 * `markTournamentStatus` and `finalizeTournament` inside one DB transaction,
 * so either both succeed or neither does — eliminating the race where a second
 * replica could attempt to finalize an already-finished tournament.
 *
 * The internal event bus (`TOURNAMENT_DOMAIN_EVENT_BUS`) is no longer used
 * directly for event dispatch. It remains injected for compatibility with
 * `TournamentAttemptEventListenerAdapter` (which listens to in-process attempt
 * events, not tournament lifecycle events).
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
  type TournamentRow,
  TOURNAMENT_OUTBOX_PORT,
  type TournamentOutboxPort,
} from './ports';
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

      for (const participant of participants.items) {
        await this.tournamentOutbox.scheduleTournamentEvent(
          {
            eventType: 'tournament.starting_soon',
            payload: {
              eventType: 'tournament.starting_soon',
              tournamentId: tournament.tournamentId,
              userId: participant.userId,
              tournamentTitle: tournament.title,
              startedAt: tournament.startAt,
              timestamp: timestamp.toISOString(),
            },
            idempotencyKey: `tournament:starting_soon:${tournament.tournamentId}:${participant.userId}`,
            correlationId: getCorrelationId(),
          },
          this.db,
          timestamp.toISOString(),
        );
        scheduled += 1;
      }
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
   * Round lifecycle / Issue #round-lifecycle — open rounds whose
   * `start_at` is at or before `nowIso` AND whose parent tournament is
   * `ongoing`. Mirrors `finalizeDueTournaments` for pagination: a
   * bounded outer loop with `PAGE_SIZE = 100` so a single tick can
   * drain arbitrarily many due rows without unbounded runtime. The
   * guard in `markRoundStatus` (`WHERE status = fromStatus`) makes
   * each transition concurrency-safe across replicas.
   *
   * Returns the total number of rounds transitioned to `open` so the
   * scheduler can log it.
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
   * Round lifecycle / Issue #round-lifecycle — close rounds whose
   * `end_at` is at or before `nowIso`. Symmetric to `openDueRounds`:
   * same pagination shape, same per-row guarded UPDATE. The parent
   * tournament's status is intentionally not constrained — a round
   * whose tournament transitioned `ongoing → finished` mid-round
   * still closes on its own `end_at`.
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

  /**
   * Phase 3 / Issue #40 — wraps markTournamentStatus + finalizeTournament in one
   * transaction so both succeed or neither does. Events are scheduled to the outbox
   * inside the same transaction.
   *
   * Issue #94: Added pagination loop to process ALL due tournaments, not just the first 100.
   * Previously, if more than 100 tournaments were due for finalization, the rest
   * would be deferred to the next cron tick.
   */
  async finalizeDueTournaments(nowIso: string): Promise<number> {
    const PAGE_SIZE = 100;
    let page = 1;
    let finalized = 0;
    const timestamp = new Date(nowIso);
    const correlationId = getCorrelationId() ?? 'system';

    // Loop through all pages of completed tournaments until no more items.
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

      // If we got fewer items than the page size, we've reached the last page.
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
      // Phase 3 / Issue #40 — atomic: markTournamentStatus + finalizeTournament
      // inside the same transaction. If the second replica attempts this tournament
      // before the first commits, markTournamentStatus returns null and we skip.
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

      // Schedule tournament.completed and tournament.won events to the outbox
      // INSIDE this transaction so they're atomic with the finalize.
      for (const standing of standings) {
        await this.tournamentOutbox.scheduleTournamentEvent(
          {
            eventType: 'tournament.completed',
            payload: {
              eventType: 'tournament.completed',
              tournamentId,
              userId: standing.userId,
              tournamentTitle: tournament.title,
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
                rank: standing.rank,
                prize: tournament.prize ?? undefined,
                timestamp: timestampIso,
              },
              // Issue #9: idempotency key matches ExternalXpEarnedEvent.idempotencyKey
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
