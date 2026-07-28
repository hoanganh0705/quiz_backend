import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  CATEGORY_REPOSITORY_PORT,
  type CategoryRepositoryPort,
} from '@/modules/category/domain/ports';
import { CategoryNotFoundError } from '@/modules/category/domain/errors';
import { getCorrelationId } from '@/common/interceptors/correlation-id';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
  type TournamentRow,
  type TournamentDetailRow,
  type TournamentRoundRow,
  type TournamentParticipantRow,
  type TournamentLeaderboardEntry,
  type TournamentListFilters,
  type TournamentCursorPayload,
  type TournamentParticipantListItemRow,
  type TournamentStandingRow,
  type UpcomingTournamentRow,
  type ActiveTournamentRow,
  type CompletedTournamentRow,
  type RelatedTournamentRow,
  type TournamentStatsRow,
  type TournamentWinnerRow,
} from './ports';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from './ports/tournament-domain-event-bus.port';
import { TOURNAMENT_OUTBOX_PORT, type TournamentOutboxPort } from './ports/tournament-outbox.port';
import { CreateTournamentDto, CreateTournamentRoundDto, UpdateTournamentDto } from '../dto/request';
import type { GetTournamentParticipantsQuery } from './types/get-tournament-participants.query';
import type { GetMyTournamentStandingQuery } from './types/get-my-tournament-standing.query';
import type { GetUpcomingTournamentsQuery } from './types/get-upcoming-tournaments.query';
import type { GetActiveTournamentsQuery } from './types/get-active-tournaments.query';
import type { GetCompletedTournamentsQuery } from './types/get-completed-tournaments.query';
import type { GetRelatedTournamentsQuery } from './types/get-related-tournaments.query';
import type { GetTournamentStatsQuery } from './types/get-tournament-stats.query';
import type { GetTournamentWinnersQuery } from './types/get-tournament-winners.query';
import type { WithdrawTournamentCommand } from './types/withdraw-tournament.command';
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentRegistrationClosedError,
  TournamentFullError,
  TournamentAlreadyRegisteredError,
  TournamentForbiddenError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentAttemptAlreadyExistsError,
  TournamentNotRegisteredError,
  TournamentUnregisterClosedError,
  TournamentWithdrawClosedError,
  TournamentAlreadyWithdrawnError,
  TournamentTerminalStateError,
  TournamentCapacityReductionError,
  TournamentEmptyUpdateError,
  TournamentParticipantStateError,
} from './errors';
import {
  TOURNAMENT_NOT_FOUND_MESSAGE,
  TOURNAMENT_REGISTRATION_CLOSED_MESSAGE,
  TOURNAMENT_FULL_MESSAGE,
  TOURNAMENT_ALREADY_REGISTERED_MESSAGE,
  TOURNAMENT_FORBIDDEN_MESSAGE,
  TOURNAMENT_STANDING_WITHDRAWN_MESSAGE,
  TOURNAMENT_ROUND_NOT_FOUND_MESSAGE,
  TOURNAMENT_ROUND_NOT_OPEN_MESSAGE,
  TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE,
  TOURNAMENT_NOT_REGISTERED_MESSAGE,
  TOURNAMENT_UNREGISTER_CLOSED_MESSAGE,
  TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE,
  TOURNAMENT_WITHDRAW_CLOSED_MESSAGE,
} from '../tournament.constants';
import {
  TournamentAuthorizationPolicy,
  type TournamentOwnershipTarget,
} from './policies/tournament-authorization.policy';

/**
 * Phase 1 / Issue #1 — adapter from `TournamentRow` (the
 * repository's read shape) to `TournamentOwnershipTarget`
 * (the authorization policy's input shape).
 *
 * Keeping the adapter inline (rather than a class method) avoids
 * having to widen `TournamentRow` to expose `deletedAt` and
 * `ownerUserId` for every consumer that does not care. Today
 * `TournamentRow` already carries both columns (see the
 * repository port change for Issue #2), but the helper centralizes
 * the projection so a future audit item can change the policy
 * surface without touching every call site.
 */
const tournamentToPolicyTarget = (row: TournamentRow): TournamentOwnershipTarget => ({
  tournamentId: row.tournamentId,
  ownerUserId: row.ownerUserId,
  status: row.status,
  deletedAt: row.deletedAt,
});

@Injectable()
export class TournamentService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly eventBus: TournamentDomainEventBusPort,
    @Inject(TOURNAMENT_OUTBOX_PORT)
    private readonly tournamentOutbox: TournamentOutboxPort,
    @Inject(CATEGORY_REPOSITORY_PORT)
    private readonly categoryRepository: CategoryRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(TournamentService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async getActiveTournamentOrThrow(tournamentId: string): Promise<TournamentRow> {
    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }
    return tournament;
  }

  async createTournament(user: JwtPayload, payload: CreateTournamentDto): Promise<TournamentRow> {
    if (new Date(payload.endAt) <= new Date(payload.startAt)) {
      throw new TournamentValidationError('endAt must be after startAt');
    }

    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      const category = await this.categoryRepository.findById(payload.categoryId);
      if (!category) {
        throw new CategoryNotFoundError();
      }
    }

    const nowIso = new Date().toISOString();

    const result = await this.tournamentRepository.createTournament({
      title: payload.title.trim(),
      description: payload.description?.trim() ?? null,
      difficulty: payload.difficulty,
      prize: payload.prize?.trim() ?? null,
      startAt: payload.startAt,
      endAt: payload.endAt,
      maxParticipants: payload.maxParticipants ?? null,
      categoryId: payload.categoryId ?? null,
      // Phase 1 / Issue #2 — thread the caller's JWT subject into
      // the new `owner_user_id` column. The migration backfilled
      // historical rows to a system actor; new tournaments are
      // always attributed to the creating user.
      ownerUserId: user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'tournament_created',
      tournamentId: result.tournamentId,
      userId: user.sub,
      title: payload.title,
      difficulty: payload.difficulty,
    });

    return this.tournamentRepository.getTournamentById(
      result.tournamentId,
    ) as Promise<TournamentRow>;
  }

  /**
   * Phase 1 / Issue #1 — `PATCH /tournaments/:id` service entry.
   *
   * Steps:
   *
   *   1. Load the tournament (and therefore `owner_user_id` and
   *      `deleted_at`). 404 if missing.
   *   2. Run the application-layer authorization policy
   *      (`TournamentAuthorizationPolicy.canEdit`). 403 if denied.
   *   3. Validate the payload (no empty bodies, monotonic
   *      `startAt`/`endAt`, no shrinking `maxParticipants` while
   *      in `registration`). 400 / 409 as appropriate.
   *   4. Delegate to `tournamentRepository.updateTournament`.
   *
   * The state-aware fields (which columns are editable in which
   * status) live in this method, NOT in the DTO or repository —
   * putting them here lets a future audit item relax the rules
   * without touching the wire shape.
   */
  async updateTournament(
    tournamentId: string,
    user: JwtPayload,
    payload: UpdateTournamentDto,
  ): Promise<TournamentRow> {
    const editableFields = [
      'title',
      'description',
      'difficulty',
      'prize',
      'startAt',
      'endAt',
      'maxParticipants',
      'categoryId',
    ] as const;
    const hasAnyField = editableFields.some((field) => payload[field] !== undefined);
    if (!hasAnyField) {
      throw new TournamentEmptyUpdateError();
    }

    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (
      !TournamentAuthorizationPolicy.canEdit(
        { sub: user.sub, role: user.role },
        tournamentToPolicyTarget(tournament),
      )
    ) {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    if (
      tournament.status !== 'upcoming' &&
      tournament.status !== 'registration' &&
      tournament.status !== 'ongoing'
    ) {
      throw new TournamentTerminalStateError('Cannot update a tournament in a terminal status');
    }

    if (payload.startAt !== undefined || payload.endAt !== undefined) {
      const newStartAt = payload.startAt ?? tournament.startAt;
      const newEndAt = payload.endAt ?? tournament.endAt;
      if (new Date(newEndAt) <= new Date(newStartAt)) {
        throw new TournamentValidationError('endAt must be after startAt');
      }
    }

    if (
      tournament.status === 'ongoing' &&
      (payload.title !== undefined ||
        payload.description !== undefined ||
        payload.difficulty !== undefined ||
        payload.startAt !== undefined ||
        payload.endAt !== undefined ||
        payload.maxParticipants !== undefined ||
        payload.categoryId !== undefined)
    ) {
      throw new TournamentTerminalStateError(
        'Only the prize field is editable while a tournament is ongoing',
      );
    }

    if (
      payload.maxParticipants !== undefined &&
      payload.maxParticipants !== null &&
      tournament.maxParticipants !== null &&
      payload.maxParticipants < tournament.maxParticipants
    ) {
      throw new TournamentCapacityReductionError(
        'maxParticipants cannot be reduced after registration has started',
      );
    }

    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      const category = await this.categoryRepository.findById(payload.categoryId);
      if (!category) {
        throw new CategoryNotFoundError();
      }
    }

    const nowIso = new Date().toISOString();

    const updated = await this.tournamentRepository.updateTournament({
      tournamentId,
      title: payload.title,
      description: payload.description,
      difficulty: payload.difficulty,
      prize: payload.prize,
      startAt: payload.startAt,
      endAt: payload.endAt,
      maxParticipants: payload.maxParticipants,
      categoryId: payload.categoryId,
      nowIso,
    });

    if (!updated) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    this.logger.info({
      event: 'tournament_updated',
      tournamentId,
      userId: user.sub,
      changedFields: editableFields.filter((f) => payload[f] !== undefined),
    });

    return updated;
  }

  /**
   * Phase 1 / Issue #1 — `DELETE /tournaments/:id` (soft delete)
   * service entry.
   *
   * Reuses the same authorization policy as `updateTournament` and
   * adds the strict state guard: an `ongoing` / `finished` /
   * `cancelled` tournament cannot be soft-deleted because the
   * audit (Issue #10) reserves those lifecycle states for the
   * finalization pipeline.
   *
   * Returns the post-mutation row so the controller can echo
   * `deletedAt` back to the client.
   */
  async softDeleteTournament(tournamentId: string, user: JwtPayload): Promise<TournamentRow> {
    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (
      !TournamentAuthorizationPolicy.canSoftDelete(
        { sub: user.sub, role: user.role },
        tournamentToPolicyTarget(tournament),
      )
    ) {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    if (tournament.status !== 'upcoming' && tournament.status !== 'registration') {
      throw new TournamentTerminalStateError(
        'Cannot soft-delete a tournament outside of upcoming or registration status',
      );
    }

    const nowIso = new Date().toISOString();
    const deleted = await this.tournamentRepository.softDeleteTournament({
      tournamentId,
      nowIso,
    });

    if (!deleted) {
      // Race against a concurrent DELETE — surface as 404 because
      // the resource the caller asked to delete is no longer there.
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    this.logger.info({
      event: 'tournament_soft_deleted',
      tournamentId,
      userId: user.sub,
      deletedAt: nowIso,
    });

    return deleted;
  }

  /**
   * Phase 1 / Issue #1 — `POST /tournaments/:id/cancel` service entry.
   *
   * Different authorization path from `updateTournament` /
   * `softDeleteTournament`: cancellation requires the
   * `TOURNAMENT_CANCEL` permission (admin-only today) and is
   * limited to `upcoming` / `registration` tournaments.
   *
   * No `TournamentCancelledEvent` is emitted in Phase 1 — that is
   * tracked under audit Issue #10 and lands when the notification
   * fan-out from a cancelled tournament is designed. Cancel
   * today means "the tournament transitions to `cancelled` so
   * participants see it as closed".
   */
  async cancelTournament(tournamentId: string, user: JwtPayload): Promise<TournamentRow> {
    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (
      !TournamentAuthorizationPolicy.canCancel(
        { sub: user.sub, role: user.role },
        tournamentToPolicyTarget(tournament),
      )
    ) {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    const cancelled = await this.tournamentRepository.cancelTournament({
      tournamentId,
      nowIso,
    });

    if (!cancelled || cancelled.status !== 'cancelled') {
      // Race: another caller transitioned the tournament into a
      // terminal state between the SELECT and the UPDATE. Surface
      // as 409 Conflict — the round-trip's "before" state did not
      // match the authorization decision.
      throw new TournamentTerminalStateError('Tournament cannot be cancelled in its current state');
    }

    this.logger.info({
      event: 'tournament_cancelled',
      tournamentId,
      userId: user.sub,
      cancelledAt: nowIso,
    });

    return cancelled;
  }

  async listTournaments(
    query: {
      limit?: number;
      cursor?: string | null;
      filters?: TournamentListFilters;
    } = {},
  ): Promise<{
    rows: TournamentRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = query.limit ?? 20;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor: TournamentCursorPayload | null = cursorValue
      ? (JSON.parse(
          Buffer.from(cursorValue, 'base64').toString('utf-8'),
        ) as TournamentCursorPayload)
      : null;

    const rows = await this.tournamentRepository.listTournaments({
      limit,
      cursor,
      filters: query.filters,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? Buffer.from(
              JSON.stringify({
                createdAt: lastItem.createdAt,
                tournamentId: lastItem.tournamentId,
              }),
            ).toString('base64')
          : null,
    };
  }

  async getUpcomingTournaments(
    query: GetUpcomingTournamentsQuery,
  ): Promise<{ items: UpcomingTournamentRow[]; total: number; page: number; limit: number }> {
    const page = query.page;
    const limit = query.limit;
    const nowIso = new Date().toISOString();

    const result = await this.tournamentRepository.listUpcomingTournaments({
      page,
      limit,
      sortBy: query.sortBy,
      nowIso,
    });

    this.logger.info({
      event: 'tournaments_upcoming_listed',
      page,
      limit,
      sortBy: query.sortBy,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getActiveTournaments(
    query: GetActiveTournamentsQuery,
  ): Promise<{ items: ActiveTournamentRow[]; total: number; page: number; limit: number }> {
    const page = query.page;
    const limit = query.limit;
    const nowIso = new Date().toISOString();

    const result = await this.tournamentRepository.listActiveTournaments({
      page,
      limit,
      nowIso,
    });

    this.logger.info({
      event: 'tournaments_active_listed',
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getCompletedTournaments(
    query: GetCompletedTournamentsQuery,
  ): Promise<{ items: CompletedTournamentRow[]; total: number; page: number; limit: number }> {
    const page = query.page;
    const limit = query.limit;
    const nowIso = new Date().toISOString();

    const result = await this.tournamentRepository.listCompletedTournaments({
      page,
      limit,
      nowIso,
    });

    this.logger.info({
      event: 'tournaments_completed_listed',
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getRelatedTournaments(query: GetRelatedTournamentsQuery): Promise<RelatedTournamentRow[]> {
    await this.getActiveTournamentOrThrow(query.tournamentId);
    return this.tournamentRepository.listRelatedTournaments(query);
  }

  async getTournamentStats(query: GetTournamentStatsQuery): Promise<TournamentStatsRow> {
    await this.getActiveTournamentOrThrow(query.tournamentId);

    const stats = await this.tournamentRepository.getTournamentStats(query.tournamentId);

    this.logger.info({
      event: 'tournament_stats_retrieved',
      tournamentId: query.tournamentId,
      participants: stats.participants,
      completedParticipants: stats.completedParticipants,
    });

    return stats;
  }

  async getTournamentWinners(query: GetTournamentWinnersQuery): Promise<TournamentWinnerRow[]> {
    await this.getActiveTournamentOrThrow(query.tournamentId);

    const winners = await this.tournamentRepository.getWinners({
      tournamentId: query.tournamentId,
      limit: query.limit,
    });

    this.logger.info({
      event: 'tournament_winners_retrieved',
      tournamentId: query.tournamentId,
      limit: query.limit,
      count: winners.length,
    });

    return winners;
  }

  async getTournamentById(tournamentId: string): Promise<TournamentDetailRow> {
    const row = await this.tournamentRepository.getTournamentDetailById(tournamentId);

    if (!row) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    return row;
  }

  async getTournamentRounds(tournamentId: string): Promise<TournamentRoundRow[]> {
    await this.getActiveTournamentOrThrow(tournamentId);
    return this.tournamentRepository.getRoundsByTournament(tournamentId);
  }

  async createTournamentRound(
    tournamentId: string,
    payload: CreateTournamentRoundDto,
  ): Promise<TournamentRoundRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (
      tournament.status === 'ongoing' ||
      tournament.status === 'finished' ||
      tournament.status === 'cancelled'
    ) {
      throw new TournamentValidationError(
        'Cannot add rounds to a tournament that is ongoing, finished, or cancelled',
      );
    }

    if (payload.startAt !== undefined && payload.startAt !== null) {
      if (new Date(payload.startAt) < new Date(tournament.startAt)) {
        throw new TournamentValidationError('Round startAt must be >= tournament startAt');
      }
    }

    if (payload.endAt !== undefined && payload.endAt !== null) {
      if (new Date(payload.endAt) > new Date(tournament.endAt)) {
        throw new TournamentValidationError('Round endAt must be <= tournament endAt');
      }
    }

    const round = await this.tournamentRepository.createRound({
      tournamentId,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? null,
      quizVersionId: payload.quizVersionId,
      startAt: payload.startAt ?? null,
      endAt: payload.endAt ?? null,
      durationMs: payload.durationMs ?? null,
      isElimination: payload.isElimination ?? false,
      participantLimit: payload.participantLimit ?? null,
      nowIso,
    });

    this.logger.info({
      event: 'tournament_round_created',
      tournamentId,
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      name: round.name,
    });

    return round;
  }

  async getTournamentParticipants(query: GetTournamentParticipantsQuery): Promise<{
    items: TournamentParticipantListItemRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.getActiveTournamentOrThrow(query.tournamentId);

    const page = query.page;
    const limit = query.limit;

    const result = await this.tournamentRepository.listParticipants({
      tournamentId: query.tournamentId,
      page,
      limit,
    });

    this.logger.info({
      event: 'tournament_participants_listed',
      tournamentId: query.tournamentId,
      page,
      limit,
      total: result.total,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }

  async getMyTournamentStanding(
    query: GetMyTournamentStandingQuery,
  ): Promise<TournamentStandingRow> {
    await this.getActiveTournamentOrThrow(query.tournamentId);

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      query.userId,
      query.tournamentId,
    );

    if (!participant) {
      throw new TournamentNotRegisteredError(TOURNAMENT_NOT_REGISTERED_MESSAGE);
    }

    if (participant.status === 'withdrawn') {
      throw new TournamentForbiddenError(TOURNAMENT_STANDING_WITHDRAWN_MESSAGE);
    }

    const standing = await this.tournamentRepository.getParticipantStanding({
      tournamentId: query.tournamentId,
      userId: query.userId,
    });

    if (!standing) {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    this.logger.info({
      event: 'tournament_my_standing_retrieved',
      tournamentId: query.tournamentId,
      userId: query.userId,
      rank: standing.rank,
      score: standing.score,
      participantCount: standing.participantCount,
    });

    return standing;
  }

  async registerForTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (tournament.status !== 'registration') {
      throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
    }

    /**
     * Issue #45 — also reject if the tournament has already started.
     *
     * The scheduler transitions `registration → ongoing` every 5 minutes.
     * If the scheduler is down for >5 minutes and `startAt` has passed,
     * the tournament status is still `registration` but `startAt < now`.
     * Users could register into a tournament that has already started.
     *
     * This guard ensures registration is rejected when `startAt <= now`
     * regardless of the cached status value.
     */
    if (tournament.startAt && tournament.startAt <= nowIso) {
      throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
    }

    /**
     * Phase 2 / Issues #3, #4 — atomic registration.
     *
     * The previous read-then-write pattern had two TOCTOU races:
     *
     *   (a) `getParticipantByUserAndTournament` + `registerParticipant` —
     *       two concurrent requests both see no participant and both insert.
     *       The DB unique constraint rejects the second, but it threw a 500.
     *
     *   (b) `countParticipants` + `registerParticipant` — two concurrent
     *       requests both see count == max-1 and both insert, over-filling
     *       the tournament.
     *
     *   (c) `reactivateParticipant` — when a withdrawn user re-registers,
     *       the capacity check was never re-run, allowing the spot to be
     *       re-taken even after new users filled the vacancy.
     *
     * The new `atomicRegister` method fixes all three by:
     *
     *   1. Acquiring `SELECT … FOR UPDATE` on the tournament row,
     *      serializing all registrations for this tournament.
     *   2. Recounting active participants inside the lock.
     *   3. Using `INSERT … ON CONFLICT DO NOTHING` so concurrent
     *      duplicates resolve to a re-read rather than a 500.
     *
     * The `inserted` flag tells us whether the participant row was
     * freshly created (`true`) or already existed (`false`). We only
     * schedule `TournamentJoinedEvent` to the outbox for fresh registrations.
     *
     * Phase 3 / Issue #5 — the event is now scheduled to the outbox INSIDE
     * the same transaction as the participant insert, guaranteeing at-least-once
     * delivery even if the process crashes between commit and publish.
     */
    try {
      let isNewRegistration = false;
      let wasReactivated = false;
      let registeredParticipant: TournamentParticipantRow;

      await this.db.transaction(async (tx) => {
        const result = await this.tournamentRepository.atomicRegister({
          tournamentId,
          userId: user.sub,
          nowIso,
          tx,
        });

        registeredParticipant = result.participant;

        if (!result.inserted) {
          wasReactivated = result.reactivated;
          // Don't throw here — return the participant and let the outer code decide
          return;
        }

        isNewRegistration = true;

        // Phase 3 / Issue #5 — schedule event to outbox inside the same tx
        await this.tournamentOutbox.scheduleTournamentEvent(
          {
            eventType: 'tournament.joined',
            payload: {
              eventType: 'tournament.joined',
              tournamentId,
              userId: user.sub,
              tournamentTitle: tournament.title,
              timestamp: nowIso,
            },
            idempotencyKey: `tournament:joined:${tournamentId}:${user.sub}`,
            correlationId: getCorrelationId(),
          },
          tx,
          nowIso,
        );
      });

      // At this point, the transaction has committed
      if (!isNewRegistration) {
        if (wasReactivated) {
          // Participant was withdrawn and is now re-activated. Log and return.
          this.logger.info({
            event: 'tournament_registration_reactivated',
            tournamentId,
            userId: user.sub,
            participantId: registeredParticipant!.participantId,
          });
          return registeredParticipant!;
        }
        // User was already active — this is a duplicate registration attempt.
        throw new TournamentAlreadyRegisteredError(TOURNAMENT_ALREADY_REGISTERED_MESSAGE);
      }

      this.logger.info({
        event: 'tournament_registered',
        tournamentId,
        userId: user.sub,
        participantId: registeredParticipant!.participantId,
      });

      return registeredParticipant!;
    } catch (error) {
      if (error instanceof Error && error.message === 'TOURNAMENT_FULL') {
        throw new TournamentFullError(TOURNAMENT_FULL_MESSAGE);
      }
      if (error instanceof Error && error.message.startsWith('TOURNAMENT_PARTICIPANT_STATE:')) {
        throw new TournamentParticipantStateError(
          `Cannot re-register: participant state is ${error.message.split(':')[1]}`,
        );
      }
      throw error;
    }
  }
  async unregisterFromTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    if (tournament.status !== 'registration') {
      throw new TournamentUnregisterClosedError(TOURNAMENT_UNREGISTER_CLOSED_MESSAGE);
    }

    /**
     * Phase 2 / Issue #2 — atomic withdrawal.
     *
     * The previous read-then-write pattern had a TOCTOU race:
     *
     *   1. `getParticipantByUserAndTournament` — no lock
     *   2. `withdrawParticipant` — unconditional update
     *
     * A concurrent re-registration arriving between steps 1 and 2
     * could see the participant as `active` (the withdrawal hadn't
     * committed yet) and re-activate it, only to have the subsequent
     * `withdrawParticipant` overwrite it back to `withdrawn`.
     *
     * The new `atomicWithdraw` method serializes all actions for this
     * tournament behind a `FOR UPDATE` lock and uses a conditional
     * `WHERE status='active'` in the UPDATE so a concurrent
     * re-activation cannot be immediately overwritten.
     *
     * Phase 3 / Issue #5 — the `TournamentParticipantWithdrawnEvent` is now
     * scheduled to the outbox INSIDE the same transaction as the withdrawal.
     */
    const withdrawn = await this.db.transaction(async (tx) => {
      const result = await this.tournamentRepository.atomicWithdraw({
        tournamentId,
        userId: user.sub,
        nowIso,
        tx,
      });

      if (!result) {
        throw new TournamentNotRegisteredError(TOURNAMENT_NOT_REGISTERED_MESSAGE);
      }

      // Phase 3 / Issue #5 — schedule event to outbox inside the same tx
      await this.tournamentOutbox.scheduleTournamentEvent(
        {
          eventType: 'tournament.participant.withdrawn',
          payload: {
            eventType: 'tournament.participant.withdrawn',
            tournamentId,
            userId: user.sub,
            timestamp: nowIso,
          },
          idempotencyKey: `tournament:withdrawn:${tournamentId}:${user.sub}`,
          correlationId: getCorrelationId(),
        },
        tx,
        nowIso,
      );

      return result;
    });

    this.logger.info({
      event: 'tournament_unregistered',
      tournamentId,
      userId: user.sub,
      participantId: withdrawn.participantId,
    });

    return withdrawn;
  }

  async withdrawFromTournament(
    command: WithdrawTournamentCommand,
  ): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(command.tournamentId);

    if (tournament.status !== 'ongoing') {
      throw new TournamentWithdrawClosedError(TOURNAMENT_WITHDRAW_CLOSED_MESSAGE);
    }

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      command.userId,
      command.tournamentId,
    );

    if (!participant) {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    if (participant.status === 'withdrawn') {
      throw new TournamentAlreadyWithdrawnError(TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE);
    }

    if (participant.status === 'completed') {
      throw new TournamentWithdrawClosedError(TOURNAMENT_WITHDRAW_CLOSED_MESSAGE);
    }

    // Phase 3 / Issue #5 — wrap withdrawal + event scheduling in a transaction
    const withdrawn = await this.db.transaction(async (tx) => {
      const result = await this.tournamentRepository.withdrawParticipant(
        participant.participantId,
        nowIso,
        tx,
      );

      await this.tournamentOutbox.scheduleTournamentEvent(
        {
          eventType: 'tournament.participant.withdrawn',
          payload: {
            eventType: 'tournament.participant.withdrawn',
            tournamentId: command.tournamentId,
            userId: command.userId,
            timestamp: nowIso,
          },
          idempotencyKey: `tournament:withdrawn:${command.tournamentId}:${command.userId}`,
          correlationId: getCorrelationId(),
        },
        tx,
        nowIso,
      );

      return result;
    });

    this.logger.info({
      event: 'tournament_participant_withdrawn',
      tournamentId: command.tournamentId,
      userId: command.userId,
      participantId: participant.participantId,
      withdrawnAt: nowIso,
    });

    return withdrawn;
  }

  // Issue #28: Added pagination to prevent unbounded responses.
  async getLeaderboard(
    tournamentId: string,
    query: { limit: number; offset: number },
  ): Promise<{ items: TournamentLeaderboardEntry[]; total: number }> {
    await this.getActiveTournamentOrThrow(tournamentId);
    return this.tournamentRepository.getLeaderboard({
      tournamentId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async startRoundAttempt(
    tournamentId: string,
    roundId: string,
    user: JwtPayload,
  ): Promise<{ attemptId: string; quizVersionId: string; participantId: string }> {
    const nowIso = new Date().toISOString();

    await this.getActiveTournamentOrThrow(tournamentId);

    const round = await this.tournamentRepository.getRoundById(roundId);
    if (!round) {
      throw new TournamentRoundNotFoundError(TOURNAMENT_ROUND_NOT_FOUND_MESSAGE);
    }

    // Phase 1 / Issue #20 + #31 — cross-tournament attack surface fix.
    //
    // The previous shape accepted `:id` (the tournament) and `:roundId`
    // as independent path parameters and only checked that each one
    // existed in isolation. A malicious user registered for tournament
    // A could submit `:id = A, :roundId = round-of-B` and the attempt
    // would be created against A's participant / B's quiz version,
    // silently inflating another user's leaderboard / leaking XP.
    //
    // The two new invariants here:
    //
    //   1. `round.tournamentId === tournamentId` — the round actually
    //      belongs to the tournament the user said they wanted.
    //   2. We surface the mismatch as `TournamentRoundNotFoundError`
    //      (404) rather than `TournamentForbiddenError` (403) so we
    //      do not leak whether the round id exists in some other
    //      tournament — the previous shape effectively acted as an
    //      enumeration oracle for cross-tournament round ids.
    if (round.tournamentId !== tournamentId) {
      throw new TournamentRoundNotFoundError(TOURNAMENT_ROUND_NOT_FOUND_MESSAGE);
    }

    if (round.status !== 'open') {
      throw new TournamentRoundNotOpenError(TOURNAMENT_ROUND_NOT_OPEN_MESSAGE);
    }

    const roundDetail = await this.tournamentRepository.getRoundDetailById(roundId);
    if (!roundDetail) {
      throw new TournamentRoundNotFoundError(TOURNAMENT_ROUND_NOT_FOUND_MESSAGE);
    }

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      user.sub,
      tournamentId,
    );
    if (!participant || participant.status !== 'active') {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    const existingRoundParticipant = await this.tournamentRepository.getRoundParticipant(
      roundId,
      participant.participantId,
    );

    if (existingRoundParticipant?.attemptId) {
      throw new TournamentAttemptAlreadyExistsError(TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE);
    }

    /**
     * Phase 2 / Issues #6, #50 — atomic round-start with idempotency.
     *
     * Two paths:
     *
     *   (a) `!existingRoundParticipant` — no round participant row yet.
     *       `startRoundAttemptTx` atomically inserts the round_participant,
     *       creates the attempt, and links it. The `inserted` flag tells
     *       us whether the round_participant was freshly inserted (true)
     *       or already existed (false, meaning a concurrent request beat
     *       us to the insert and already set up the attempt).
     *
     *   (b) `existingRoundParticipant` (no attemptId) — round participant
     *       row exists but no attempt linked. `createAttemptForRound` takes
     *       a FOR UPDATE lock on the row and creates the attempt. If a
     *       concurrent `startRoundAttemptTx` beat us to the attempt creation,
     *       it returns the existing `attemptId` without creating a duplicate.
     *
     * The pre-Tx `existingRoundParticipant?.attemptId` check above is the
     * fast path for the 99% case (user has no existing attempt). The
     * transaction-level idempotency inside both methods is the safety net
     * for the race between the pre-Tx check and the transaction.
     */
    let attemptId: string;

    if (!existingRoundParticipant) {
      const result = await this.tournamentRepository.startRoundAttemptTx({
        roundId,
        participantId: participant.participantId,
        userId: user.sub,
        quizVersionId: roundDetail.quizVersionId,
        tournamentId,
        nowIso,
      });

      attemptId = result.attemptId;
    } else {
      const createdAttempt = await this.tournamentRepository.createAttemptForRound({
        userId: user.sub,
        quizVersionId: roundDetail.quizVersionId,
        tournamentId,
        roundId,
        roundParticipantId: existingRoundParticipant.roundParticipantId,
        nowIso,
      });

      attemptId = createdAttempt.attemptId;
    }

    return {
      attemptId,
      quizVersionId: roundDetail.quizVersionId,
      participantId: participant.participantId,
    };
  }
}
