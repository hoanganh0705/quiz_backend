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
  TOURNAMENT_NOT_REGISTERED_MESSAGE,
  TOURNAMENT_UNREGISTER_CLOSED_MESSAGE,
  TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE,
  TOURNAMENT_WITHDRAW_CLOSED_MESSAGE,
} from '../tournament.constants';
import {
  TournamentAuthorizationPolicy,
  type TournamentOwnershipTarget,
} from './policies/tournament-authorization.policy';

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
      participantId: participant.participantId,
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
     * Reject if the tournament has already started.
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

        const categoryTitle = tournament.categoryId
          ? ((await this.categoryRepository.findById(tournament.categoryId))?.name ?? null)
          : null;

        await this.tournamentOutbox.scheduleTournamentEvent(
          {
            eventType: 'tournament.joined',
            payload: {
              eventType: 'tournament.joined',
              tournamentId,
              userId: user.sub,
              tournamentTitle: tournament.title,
              categoryTitle,
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

    const withdrawn = await this.db.transaction(async (tx) => {
      const withdrawnRow = await this.tournamentRepository.atomicWithdraw({
        tournamentId: command.tournamentId,
        userId: command.userId,
        nowIso,
        tx,
      });

      if (!withdrawnRow) {
        const existing = await this.tournamentRepository.getParticipantByUserAndTournament(
          command.userId,
          command.tournamentId,
        );

        if (!existing) {
          throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
        }
        if (existing.status === 'withdrawn') {
          throw new TournamentAlreadyWithdrawnError(TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE);
        }
        if (existing.status === 'completed') {
          throw new TournamentWithdrawClosedError(TOURNAMENT_WITHDRAW_CLOSED_MESSAGE);
        }
        throw new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE);
      }

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

      return withdrawnRow;
    });

    this.logger.info({
      event: 'tournament_participant_withdrawn',
      tournamentId: command.tournamentId,
      userId: command.userId,
      participantId: withdrawn.participantId,
      withdrawnAt: nowIso,
    });

    return withdrawn;
  }

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

    const result = await this.tournamentRepository.startRoundAttemptTx({
      roundId,
      participantId: participant.participantId,
      userId: user.sub,
      quizVersionId: roundDetail.quizVersionId,
      tournamentId,
      nowIso,
    });

    return {
      attemptId: result.attemptId,
      quizVersionId: roundDetail.quizVersionId,
      participantId: participant.participantId,
    };
  }
}
