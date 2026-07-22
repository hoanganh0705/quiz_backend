import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { TournamentService } from '../domain/tournament.service';
import { TournamentResponseMapper } from '../mappers/tournament-response.mapper';
import {
  CreateTournamentDto,
  CreateTournamentRoundDto,
  ListTournamentsQueryDto,
  GetTournamentParticipantsQueryDto,
  GetTournamentWinnersQueryDto,
  GetUpcomingTournamentsQueryDto,
  GetActiveTournamentsQueryDto,
  GetCompletedTournamentsQueryDto,
  GetRelatedTournamentsQueryDto,
  UpdateTournamentDto,
} from '../dto/request';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentListResponseDto,
  TournamentLeaderboardResponseDto,
  TournamentWinnersResponseDto,
  TournamentParticipantsResponseDto,
  UpcomingTournamentsResponseDto,
  ActiveTournamentsResponseDto,
  CompletedTournamentsResponseDto,
  RelatedTournamentsResponseDto,
  TournamentStatsResponseDto,
  MyTournamentStandingResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
  WithdrawTournamentResponseDto,
  CancelTournamentResponseDto,
  SoftDeleteTournamentResponseDto,
  TournamentRoundResponseDto,
} from '../dto/response';

@Injectable()
export class TournamentApplicationService {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly mapper: TournamentResponseMapper,
    @InjectPinoLogger(TournamentApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createTournament(
    user: JwtPayload,
    payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    this.logger.info({
      event: 'app_create_tournament',
      userId: user.sub,
      title: payload.title,
      difficulty: payload.difficulty,
    });
    const result = await this.tournamentService.createTournament(user, payload);
    return this.mapper.toTournamentResponse(result);
  }

  async listTournaments(query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    const { rows, limit, hasNextPage, nextCursor } = await this.tournamentService.listTournaments({
      limit: query.limit,
      cursor: query.cursor,
      filters: {
        status: query.status,
        difficulty: query.difficulty,
        categoryId: query.categoryId,
      },
    });

    this.logger.info({
      event: 'app_list_tournaments',
      filters: { status: query.status, difficulty: query.difficulty, categoryId: query.categoryId },
      resultCount: rows.length,
      hasNextPage,
    });

    return {
      items: rows.map((row) => this.mapper.toTournamentResponse(row)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  async getUpcomingTournaments(
    query: GetUpcomingTournamentsQueryDto,
  ): Promise<UpcomingTournamentsResponseDto> {
    const result = await this.tournamentService.getUpcomingTournaments({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sortBy: query.sortBy ?? 'startAt',
    });

    this.logger.info({
      event: 'app_get_upcoming_tournaments',
      page: result.page,
      limit: result.limit,
      total: result.total,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        description: item.description,
        startAt: item.startAt,
        endAt: item.endAt,
        participantCount: item.participantCount,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getActiveTournaments(
    query: GetActiveTournamentsQueryDto,
  ): Promise<ActiveTournamentsResponseDto> {
    const result = await this.tournamentService.getActiveTournaments({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    this.logger.info({
      event: 'app_get_active_tournaments',
      page: result.page,
      limit: result.limit,
      total: result.total,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        startAt: item.startAt,
        endAt: item.endAt,
        participantCount: item.participantCount,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getCompletedTournaments(
    query: GetCompletedTournamentsQueryDto,
  ): Promise<CompletedTournamentsResponseDto> {
    const result = await this.tournamentService.getCompletedTournaments({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    this.logger.info({
      event: 'app_get_completed_tournaments',
      page: result.page,
      limit: result.limit,
      total: result.total,
    });

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        startAt: item.startAt,
        endAt: item.endAt,
        participantCount: item.participantCount,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async getRelatedTournaments(
    tournamentId: string,
    query: GetRelatedTournamentsQueryDto,
  ): Promise<RelatedTournamentsResponseDto> {
    const result = await this.tournamentService.getRelatedTournaments({
      tournamentId,
      limit: query.limit ?? 5,
    });

    this.logger.info({
      event: 'app_get_related_tournaments',
      tournamentId,
      resultCount: result.length,
    });

    return {
      items: result.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        startAt: item.startAt,
        participantCount: item.participantCount,
      })),
    };
  }

  async getTournamentStats(tournamentId: string): Promise<TournamentStatsResponseDto> {
    const stats = await this.tournamentService.getTournamentStats({ tournamentId });

    this.logger.info({
      event: 'app_get_tournament_stats',
      tournamentId,
      participants: stats.participants,
      completedParticipants: stats.completedParticipants,
    });

    return {
      tournamentId: stats.tournamentId,
      participants: stats.participants,
      completedParticipants: stats.completedParticipants,
      averageScore: stats.averageScore,
      highestScore: stats.highestScore,
      lowestScore: stats.lowestScore,
      completionRate: stats.completionRate,
      averageRank: stats.averageRank,
      startedAt: stats.startedAt,
      endedAt: stats.endedAt,
    };
  }

  async getTournamentWinners(
    tournamentId: string,
    query: GetTournamentWinnersQueryDto,
  ): Promise<TournamentWinnersResponseDto> {
    const items = await this.tournamentService.getTournamentWinners({
      tournamentId,
      limit: query.limit ?? 10,
    });

    this.logger.info({
      event: 'app_get_tournament_winners',
      tournamentId,
      limit: query.limit ?? 10,
      resultCount: items.length,
    });

    return {
      items: items.map((item) => ({
        rank: item.rank,
        userId: item.userId,
        username: item.username,
        score: item.score,
        avatarUrl: item.avatarUrl,
      })),
    };
  }

  async getTournamentById(tournamentId: string): Promise<TournamentDetailResponseDto> {
    const detail = await this.tournamentService.getTournamentById(tournamentId);
    const rounds = await this.tournamentService.getTournamentRounds(tournamentId);

    this.logger.info({
      event: 'app_get_tournament_by_id',
      tournamentId,
      roundCount: rounds.length,
    });

    return this.mapper.toTournamentDetailResponse(detail, rounds);
  }

  async createTournamentRound(
    tournamentId: string,
    payload: CreateTournamentRoundDto,
  ): Promise<TournamentRoundResponseDto> {
    this.logger.info({
      event: 'app_create_tournament_round',
      tournamentId,
      quizVersionId: payload.quizVersionId,
      name: payload.name,
    });

    const round = await this.tournamentService.createTournamentRound(tournamentId, payload);

    return {
      roundId: round.roundId,
      tournamentId: round.tournamentId,
      roundNumber: round.roundNumber,
      name: round.name,
      description: round.description,
      quizVersionId: round.quizVersionId,
      startAt: round.startAt,
      endAt: round.endAt,
      durationMs: round.durationMs,
      status: round.status,
      isElimination: round.isElimination,
      participantLimit: round.participantLimit,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
    };
  }

  async getTournamentParticipants(
    tournamentId: string,
    query: GetTournamentParticipantsQueryDto,
  ): Promise<TournamentParticipantsResponseDto> {
    const result = await this.tournamentService.getTournamentParticipants({
      tournamentId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    this.logger.info({
      event: 'app_get_tournament_participants',
      tournamentId,
      page: result.page,
      limit: result.limit,
      total: result.total,
    });

    return {
      items: result.items.map((item) => ({
        userId: item.userId,
        username: item.username,
        registeredAt: item.registeredAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
      totalParticipants: result.total,
    };
  }

  async getMyTournamentStanding(
    tournamentId: string,
    userId: string,
  ): Promise<MyTournamentStandingResponseDto> {
    const standing = await this.tournamentService.getMyTournamentStanding({ tournamentId, userId });

    this.logger.info({
      event: 'app_get_my_standing',
      tournamentId,
      userId,
      rank: standing.rank,
    });

    return {
      rank: standing.rank,
      score: standing.score,
      percentile: standing.percentile,
      participantCount: standing.participantCount,
    };
  }

  async registerForTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<RegisterTournamentResponseDto> {
    this.logger.info({
      event: 'app_register_for_tournament',
      tournamentId,
      userId: user.sub,
    });

    const participant = await this.tournamentService.registerForTournament(tournamentId, user);

    return {
      participantId: participant.participantId,
      tournamentId: participant.tournamentId,
      userId: participant.userId,
      registeredAt: participant.registeredAt,
      message: 'Successfully registered for the tournament',
    };
  }

  // Issue #28: Added pagination support to leaderboard endpoint.
  async getLeaderboard(
    tournamentId: string,
    query: { limit: number; offset: number },
  ): Promise<TournamentLeaderboardResponseDto> {
    this.logger.info({
      event: 'app_get_leaderboard',
      tournamentId,
      limit: query.limit,
      offset: query.offset,
    });

    const result = await this.tournamentService.getLeaderboard(tournamentId, {
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: result.items.map((entry) => this.mapper.toLeaderboardEntryResponse(entry)),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
      page: Math.floor(query.offset / query.limit) + 1,
    };
  }

  async startRoundAttempt(
    tournamentId: string,
    roundId: string,
    user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
    this.logger.info({
      event: 'app_start_round_attempt',
      tournamentId,
      roundId,
      userId: user.sub,
    });

    const result = await this.tournamentService.startRoundAttempt(tournamentId, roundId, user);

    return {
      attemptId: result.attemptId,
      quizVersionId: result.quizVersionId,
      participantId: result.participantId,
      message: 'Attempt started successfully. Use the attempt endpoint to continue.',
    };
  }

  async unregisterFromTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<UnregisterTournamentResponseDto> {
    this.logger.info({
      event: 'app_unregister_from_tournament',
      tournamentId,
      userId: user.sub,
    });

    await this.tournamentService.unregisterFromTournament(tournamentId, user);

    return { message: 'Successfully unregistered from the tournament' };
  }

  async withdrawFromTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<WithdrawTournamentResponseDto> {
    this.logger.info({
      event: 'app_withdraw_from_tournament',
      tournamentId,
      userId: user.sub,
    });

    const participant = await this.tournamentService.withdrawFromTournament({
      tournamentId,
      userId: user.sub,
    });

    return {
      success: true,
      tournamentId: participant.tournamentId,
      status: participant.status,
      withdrawnAt: participant.withdrawnAt ?? participant.updatedAt,
    };
  }

  /**
   * Phase 1 / Issue #1 — `PATCH /tournaments/:id` application entry.
   *
   * Thin wrapper around the domain service. The domain service
   * enforces ownership and state guards; the application service
   * only maps the resulting `TournamentRow` into a
   * `TournamentResponseDto` for the response envelope.
   */
  async updateTournament(
    tournamentId: string,
    user: JwtPayload,
    payload: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    this.logger.info({
      event: 'app_update_tournament',
      tournamentId,
      userId: user.sub,
    });

    const updated = await this.tournamentService.updateTournament(tournamentId, user, payload);

    return this.mapper.toTournamentResponse(updated);
  }

  /**
   * Phase 1 / Issue #1 — `DELETE /tournaments/:id` (soft delete)
   * application entry. Maps the post-mutation row to a
   * `SoftDeleteTournamentResponseDto` (so the controller can echo
   * `deletedAt` back to the client).
   */
  async softDeleteTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<SoftDeleteTournamentResponseDto> {
    this.logger.info({
      event: 'app_soft_delete_tournament',
      tournamentId,
      userId: user.sub,
    });

    const deleted = await this.tournamentService.softDeleteTournament(tournamentId, user);

    return {
      tournamentId: deleted.tournamentId,
      deletedAt: deleted.deletedAt ?? deleted.updatedAt,
    };
  }

  /**
   * Phase 1 / Issue #1 — `POST /tournaments/:id/cancel` application
   * entry. The domain service returns the post-mutation row so we
   * can surface `status` and `updated_at` (today there is no
   * dedicated `cancelled_at` column).
   */
  async cancelTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<CancelTournamentResponseDto> {
    this.logger.info({
      event: 'app_cancel_tournament',
      tournamentId,
      userId: user.sub,
    });

    const cancelled = await this.tournamentService.cancelTournament(tournamentId, user);

    return {
      tournamentId: cancelled.tournamentId,
      status: 'cancelled',
      cancelledAt: cancelled.updatedAt,
    };
  }
}
