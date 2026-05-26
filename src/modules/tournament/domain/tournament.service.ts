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
} from './ports';
import { ATTEMPT_REPOSITORY_PORT } from '@/modules/attempt/domain/ports';
import type { AttemptRepositoryPort } from '@/modules/attempt/domain/ports';
import { CreateTournamentDto } from '../dto/request';
import {
  TournamentNotFoundError,
  TournamentRegistrationClosedError,
  TournamentFullError,
  TournamentAlreadyRegisteredError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentAttemptAlreadyExistsError,
} from './errors';
import {
  TOURNAMENT_NOT_FOUND_MESSAGE,
  TOURNAMENT_REGISTRATION_CLOSED_MESSAGE,
  TOURNAMENT_FULL_MESSAGE,
  TOURNAMENT_ALREADY_REGISTERED_MESSAGE,
  TOURNAMENT_ROUND_NOT_FOUND_MESSAGE,
  TOURNAMENT_ROUND_NOT_OPEN_MESSAGE,
  TOURNAMENT_ATTEMPT_ALREADY_EXISTS_MESSAGE,
} from '../tournament.constants';

@Injectable()
export class TournamentService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(ATTEMPT_REPOSITORY_PORT)
    private readonly attemptRepository: AttemptRepositoryPort,
    @InjectPinoLogger(TournamentService.name)
    private readonly logger: PinoLogger,
  ) {}

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

  async getTournamentById(tournamentId: string): Promise<TournamentDetailRow> {
    const row = await this.tournamentRepository.getTournamentDetailById(tournamentId);

    if (!row) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    return row;
  }

  async getTournamentRounds(tournamentId: string): Promise<TournamentRoundRow[]> {
    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);

    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    return this.tournamentRepository.getRoundsByTournament(tournamentId);
  }

  async registerForTournament(
    tournamentId: string,
    user: JwtPayload,
  ): Promise<TournamentParticipantRow> {
    const nowIso = new Date().toISOString();

    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);

    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    if (tournament.status !== 'upcoming' && tournament.status !== 'registration') {
      throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
    }

    const now = new Date();
    const endDate = new Date(tournament.endAt);
    if (now > endDate) {
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

  async getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardEntry[]> {
    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);

    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

    return this.tournamentRepository.getLeaderboard(tournamentId);
  }

  async startRoundAttempt(
    tournamentId: string,
    roundId: string,
    user: JwtPayload,
  ): Promise<{ attemptId: string; quizVersionId: string; participantId: string }> {
    const nowIso = new Date().toISOString();

    const tournament = await this.tournamentRepository.getTournamentById(tournamentId);

    if (!tournament) {
      throw new TournamentNotFoundError(TOURNAMENT_NOT_FOUND_MESSAGE);
    }

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

    if (!participant) {
      throw new TournamentNotFoundError('You are not registered for this tournament');
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
