/**
 * Attempt Event Listener Adapter (Tournament)
 *
 * Bridges Attempt domain events into the Tournament aggregate's bookkeeping:
 *
 *   1. On `AttemptCompletedEvent`, look up the tournament round participant
 *      that owns the attempt (the round where the quiz attempt lives).
 *   2. Persist the score and elapsed time onto that round participant row.
 *   3. Recompute the parent `tournament_participants.total_score` and
 *      `total_time_ms` from `tournament_round_participants` via
 *      `TournamentRepository.recalculateParticipantTotals`.
 *
 * The recompute is the Fix #1 wiring described in
 * `docs/plans/denormalized-counters-audit.md` — it ensures the
 * denormalized counters always reflect their source of truth, even if a
 * future code path forgets to call the recompute manually.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournamentRoundParticipants } from '@/core/database/schema';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
} from '@/modules/tournament/domain/ports/tournament-repository.port';

@Injectable()
export class TournamentAttemptEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @InjectPinoLogger(TournamentAttemptEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.attemptEventBus.subscribe((event: unknown) => {
      if (this.isAttemptCompletedEvent(event)) {
        void this.handleAttemptCompleted(event);
      }
    });

    this.logger.info({ event: 'tournament_attempt_listener_subscribed' });
  }

  private isAttemptCompletedEvent(event: unknown): event is AttemptCompletedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'attempt.completed'
    );
  }

  private async handleAttemptCompleted(event: AttemptCompletedEvent): Promise<void> {
    try {
      // Look up the round participant that owns this attempt. Index
      // `idx_tournament_round_participants_attempt_id` keeps this O(log n).
      const [roundParticipant] = await this.db
        .select({
          roundParticipantId: tournamentRoundParticipants.roundParticipantId,
          participantId: tournamentRoundParticipants.participantId,
          roundId: tournamentRoundParticipants.roundId,
        })
        .from(tournamentRoundParticipants)
        .where(
          and(
            eq(tournamentRoundParticipants.attemptId, event.attemptId),
            isNotNull(tournamentRoundParticipants.attemptId),
          ),
        )
        .limit(1);

      if (!roundParticipant) {
        // This is the common case: most attempts are not tournament
        // attempts, so we short-circuit silently.
        return;
      }

      // Derive a tournament-friendly score from the attempt's score percent.
      // The audit's recommendation is to keep the totals as a projection of
      // round_score / round_time_ms; we treat scorePercent (0–100) as the
      // canonical "score for this round" and the elapsed time as the round
      // time. Round to int because `round_score` is `integer`.
      const roundScore = Math.round(Number(event.scorePercent));

      await this.db.transaction(async (tx) => {
        await tx
          .update(tournamentRoundParticipants)
          .set({
            roundScore,
            roundTimeMs: event.timeTakenMs,
            updatedAt: event.nowIso,
          })
          .where(
            eq(tournamentRoundParticipants.roundParticipantId, roundParticipant.roundParticipantId),
          );

        await this.tournamentRepository.recalculateParticipantTotals(
          roundParticipant.participantId,
          tx,
        );
      });

      this.logger.info({
        event: 'tournament_round_participant_scored',
        attemptId: event.attemptId,
        roundParticipantId: roundParticipant.roundParticipantId,
        participantId: roundParticipant.participantId,
        roundId: roundParticipant.roundId,
        roundScore,
        roundTimeMs: event.timeTakenMs,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_round_participant_score_failed',
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
