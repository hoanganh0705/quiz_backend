import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
import { TournamentParticipantWithdrawnEvent, TournamentJoinedEvent } from './events';
import { CreateTournamentDto, UpdateTournamentDto } from '../dto/request';
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
  TournamentParticipantStateError,
  TournamentWithdrawClosedError,
  TournamentAlreadyWithdrawnError,
  TournamentTerminalStateError,
  TournamentCapacityReductionError,
  TournamentEmptyUpdateError,
} from './errors';
import {
  TOURNAMENT_NOT_FOUND_MESSAGE,
  TOURNAMENT_REGISTRATION_CLOSED_MESSAGE,
  TOURNAMENT_FULL_MESSAGE,
  TOURNAMENT_ALREADY_REGISTERED_MESSAGE,
  TOURNAMENT_FORBIDDEN_MESSAGE,
  TOURNAMENT_ROUND_NOT_FOUND_MESSAGE,
  TOURNAMENT_ROUND_NOT_OPEN_MESSAGE,
  TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE,
  TOURNAMENT_NOT_REGISTERED_MESSAGE,
  TOURNAMENT_UNREGISTER_CLOSED_MESSAGE,
  TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE,
  TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE,
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
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
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

    const existingParticipant = await this.tournamentRepository.getParticipantByUserAndTournament(
      user.sub,
      tournamentId,
    );

    if (existingParticipant) {
      if (existingParticipant.status === 'withdrawn') {
        const reactivated = await this.tournamentRepository.reactivateParticipant(
          existingParticipant.participantId,
          nowIso,
        );

        this.logger.info({
          event: 'tournament_registration_reactivated',
          tournamentId,
          userId: user.sub,
          participantId: reactivated.participantId,
        });

        return reactivated;
      }

      throw new TournamentAlreadyRegisteredError(TOURNAMENT_ALREADY_REGISTERED_MESSAGE);
    }

    if (tournament.maxParticipants !== null) {
      const count = await this.tournamentRepository.countParticipants(tournamentId);
      if (count >= tournament.maxParticipants) {
        throw new TournamentFullError(TOURNAMENT_FULL_MESSAGE);
      }
    }

    const participant = await this.tournamentRepository.registerParticipant({
      tournamentId,
      userId: user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'tournament_registered',
      tournamentId,
      userId: user.sub,
      participantId: participant.participantId,
    });

    this.eventBus.publish(
      new TournamentJoinedEvent(tournamentId, user.sub, tournament.title, new Date(nowIso)),
    );

    return participant;
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

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      user.sub,
      tournamentId,
    );

    if (!participant) {
      throw new TournamentNotRegisteredError(TOURNAMENT_NOT_REGISTERED_MESSAGE);
    }

    if (participant.status === 'withdrawn') {
      throw new TournamentParticipantStateError(TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE);
    }

    if (participant.status !== 'active') {
      throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
    }

    const withdrawn = await this.tournamentRepository.withdrawParticipant(
      participant.participantId,
      nowIso,
    );

    this.logger.info({
      event: 'tournament_unregistered',
      tournamentId,
      userId: user.sub,
      participantId: participant.participantId,
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

    const withdrawn = await this.tournamentRepository.withdrawParticipant(
      participant.participantId,
      nowIso,
    );

    this.eventBus.publish(
      new TournamentParticipantWithdrawnEvent(
        command.tournamentId,
        command.userId,
        new Date(nowIso),
      ),
    );

    this.logger.info({
      event: 'tournament_participant_withdrawn',
      tournamentId: command.tournamentId,
      userId: command.userId,
      participantId: participant.participantId,
      withdrawnAt: nowIso,
    });

    return withdrawn;
  }

  async getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardEntry[]> {
    await this.getActiveTournamentOrThrow(tournamentId);
    return this.tournamentRepository.getLeaderboard(tournamentId);
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

    let attemptId: string;

    if (!existingRoundParticipant) {
      // No round participant yet — atomically insert both round participant and attempt

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
      // Round participant exists but has no attempt — create attempt only

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
