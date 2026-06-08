import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { TournamentService } from '../domain/tournament.service';
import { TournamentResponseMapper } from '../mappers/tournament-response.mapper';
import {
  CreateTournamentDto,
  ListTournamentsQueryDto,
  GetTournamentParticipantsQueryDto,
  GetUpcomingTournamentsQueryDto,
  GetActiveTournamentsQueryDto,
  GetCompletedTournamentsQueryDto,
  GetRelatedTournamentsQueryDto,
} from '../dto/request';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentListResponseDto,
  TournamentLeaderboardResponseDto,
  TournamentParticipantsResponseDto,
  UpcomingTournamentsResponseDto,
  ActiveTournamentsResponseDto,
  CompletedTournamentsResponseDto,
  RelatedTournamentsResponseDto,
  MyTournamentStandingResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
} from '../dto/response';

@Injectable()
export class TournamentApplicationService {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly mapper: TournamentResponseMapper,
  ) {}

  async createTournament(
    user: JwtPayload,
    payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
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

    return {
      items: result.items.map((item) => ({
        tournamentId: item.tournamentId,
        name: item.name,
        startAt: item.startAt,
        participantCount: item.participantCount,
      })),
    };
  }

  async getTournamentById(tournamentId: string): Promise<TournamentDetailResponseDto> {
    const detail = await this.tournamentService.getTournamentById(tournamentId);
    const rounds = await this.tournamentService.getTournamentRounds(tournamentId);
    return this.mapper.toTournamentDetailResponse(detail, rounds);
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
    const participant = await this.tournamentService.registerForTournament(tournamentId, user);

    return {
      participantId: participant.participantId,
      tournamentId: participant.tournamentId,
      userId: participant.userId,
      registeredAt: participant.registeredAt,
      message: 'Successfully registered for the tournament',
    };
  }

  async getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardResponseDto> {
    const entries = await this.tournamentService.getLeaderboard(tournamentId);

    return {
      items: entries.map((entry) => this.mapper.toLeaderboardEntryResponse(entry)),
    };
  }

  async startRoundAttempt(
    tournamentId: string,
    roundId: string,
    user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
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
    await this.tournamentService.unregisterFromTournament(tournamentId, user);

    return { message: 'Successfully withdrawn from the tournament' };
  }
}
