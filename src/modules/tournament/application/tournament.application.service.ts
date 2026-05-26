import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { TournamentService } from '../domain/tournament.service';
import { TournamentResponseMapper } from '../mappers/tournament-response.mapper';
import { CreateTournamentDto, ListTournamentsQueryDto } from '../dto/request';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentListResponseDto,
  TournamentLeaderboardResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
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

  async getTournamentById(tournamentId: string): Promise<TournamentDetailResponseDto> {
    const detail = await this.tournamentService.getTournamentById(tournamentId);
    const rounds = await this.tournamentService.getTournamentRounds(tournamentId);
    return this.mapper.toTournamentDetailResponse(detail, rounds);
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
}
