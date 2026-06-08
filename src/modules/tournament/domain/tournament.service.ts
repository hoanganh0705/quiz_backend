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
import { TournamentParticipantWithdrawnEvent } from './events/tournament-participant-withdrawn.event';
import { ATTEMPT_REPOSITORY_PORT } from '@/modules/attempt/domain/ports';
import type { AttemptRepositoryPort } from '@/modules/attempt/domain/ports';
import { CreateTournamentDto } from '../dto/request';
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
  TournamentRegistrationClosedError,
  TournamentFullError,
  TournamentAlreadyRegisteredError,
  TournamentForbiddenError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentAttemptAlreadyExistsError,
  TournamentNotRegisteredError,
  TournamentUnregisterClosedError,
  TournamentAlreadyWithdrawnError,
  TournamentWithdrawClosedError,
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
  TOURNAMENT_WITHDRAW_CLOSED_MESSAGE,
} from '../tournament.constants';

@Injectable()
export class TournamentService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(ATTEMPT_REPOSITORY_PORT)
    private readonly attemptRepository: AttemptRepositoryPort,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly eventBus: TournamentDomainEventBusPort,
    @InjectPinoLogger(TournamentService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getActiveTournamentOrThrow(tournamentId: string): Promise<TournamentRow> {
    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }
    return tournament;
  }

  // ---------------------------------------------------------------------------
  // Tournament operations
  // ---------------------------------------------------------------------------

  async createTournament(user: JwtPayload, payload: CreateTournamentDto): Promise<TournamentRow> {
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

  async getRelatedTournaments(
    query: GetRelatedTournamentsQuery,
  ): Promise<{ items: RelatedTournamentRow[] }> {
    const items = await this.tournamentRepository.listRelatedTournaments({
      tournamentId: query.tournamentId,
      limit: query.limit,
    });

    this.logger.info({
      event: 'tournaments_related_listed',
      tournamentId: query.tournamentId,
      limit: query.limit,
      resultCount: items.length,
    });

    return { items };
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

  async getTournamentParticipants(
    query: GetTournamentParticipantsQuery,
  ): Promise<{ items: TournamentParticipantListItemRow[]; total: number; page: number; limit: number }> {
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

  async getMyTournamentStanding(query: GetMyTournamentStandingQuery): Promise<TournamentStandingRow> {
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

    // Registration is permitted exclusively when the tournament is in the `registration` phase.
    // `upcoming` means the tournament exists but registration has not opened yet.
    // We rely solely on the status state machine — not on timestamps.
    if (tournament.status !== 'registration') {
      throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
    }

    if (tournament.maxParticipants !== null) {
      const currentCount = await this.tournamentRepository.countParticipants(tournamentId);
      if (currentCount >= tournament.maxParticipants) {
        throw new TournamentFullError(TOURNAMENT_FULL_MESSAGE);
      }
    }

    const existingParticipant = await this.tournamentRepository.getParticipantByUserAndTournament(
      user.sub,
      tournamentId,
    );

    if (existingParticipant) {
      // A withdrawn participant is allowed to re-register during the registration window.
      if (existingParticipant.status === 'withdrawn') {
        const reactivated = await this.tournamentRepository.reactivateParticipant(
          existingParticipant.participantId,
          nowIso,
        );

        this.logger.info({
          event: 'tournament_reregistered',
          tournamentId,
          userId: user.sub,
          participantId: reactivated.participantId,
        });

        return reactivated;
      }

      throw new TournamentAlreadyRegisteredError(TOURNAMENT_ALREADY_REGISTERED_MESSAGE);
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

    return participant;
  }

  async unregisterFromTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(tournamentId);

    // Unregistration is permitted only during the `registration` phase, mirroring the registration rule.
    // Once the tournament moves to `ongoing` or later, withdrawals are no longer accepted.
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
      throw new TournamentAlreadyWithdrawnError(TOURNAMENT_ALREADY_WITHDRAWN_MESSAGE);
    }

    if (participant.status !== 'active' && participant.status !== 'registered') {
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

  async withdrawFromTournament(command: WithdrawTournamentCommand): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.getActiveTournamentOrThrow(command.tournamentId);

    if (tournament.status !== 'ongoing') {
      throw new TournamentWithdrawClosedError(TOURNAMENT_WITHDRAW_CLOSED_MESSAGE);
    }

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      command.userId,
      command.tournamentId,
    );

    if (!participant || participant.status === 'registered') {
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

    if (!round || round.tournamentId !== tournamentId) {
      throw new TournamentRoundNotFoundError(TOURNAMENT_ROUND_NOT_FOUND_MESSAGE);
    }

    if (round.status !== 'open' && round.status !== 'running') {
      throw new TournamentRoundNotOpenError(TOURNAMENT_ROUND_NOT_OPEN_MESSAGE);
    }

    const participant = await this.tournamentRepository.getParticipantByUserAndTournament(
      user.sub,
      tournamentId,
    );

    // FIX: use TournamentNotRegisteredError (→ 404) instead of the misleading
    // TournamentNotFoundError that was previously thrown here.
    if (!participant || participant.status !== 'active') {
      throw new TournamentNotRegisteredError(TOURNAMENT_NOT_REGISTERED_MESSAGE);
    }

    const existingRoundParticipant = await this.tournamentRepository.getRoundParticipant(
      roundId,
      participant.participantId,
    );

    if (existingRoundParticipant?.attemptId) {
      throw new TournamentAttemptAlreadyExistsError(TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE);
    }

    const attempt = await this.attemptRepository.createTournamentAttempt({
      userId: user.sub,
      quizVersionId: round.quizVersionId,
      tournamentId,
      roundId,
      nowIso,
    });

    await this.tournamentRepository.createRoundParticipant({
      roundId,
      participantId: participant.participantId,
      nowIso,
    });

    this.logger.info({
      event: 'tournament_round_attempt_started',
      tournamentId,
      roundId,
      userId: user.sub,
      participantId: participant.participantId,
      attemptId: attempt.attemptId,
    });

    return {
      attemptId: attempt.attemptId,
      quizVersionId: attempt.quizVersionId,
      participantId: participant.participantId,
    };
  }
}
