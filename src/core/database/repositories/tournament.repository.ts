import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql, or, count } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  tournamentRoundParticipants,
  categories,
  users,
} from '@/core/database/schema';
import type {
  TournamentDifficulty,
  TournamentParticipantStatus,
} from '@/modules/tournament/types/tournament.types';
import type {
  TournamentRepositoryPort,
  TournamentRow,
  TournamentDetailRow,
  TournamentRoundRow,
  TournamentParticipantRow,
  TournamentRoundParticipantRow,
  TournamentLeaderboardEntry,
  TournamentListFilters,
  TournamentCursorPayload,
} from '@/modules/tournament/domain/ports';

@Injectable()
export class TournamentRepository implements TournamentRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getTournamentById(tournamentId: string): Promise<TournamentRow | null> {
    const [row] = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        title: tournaments.title,
        description: tournaments.description,
        difficulty: tournaments.difficulty,
        status: tournaments.status,
        prize: tournaments.prize,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        maxParticipants: tournaments.maxParticipants,
        categoryId: tournaments.categoryId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
      })
      .from(tournaments)
      .where(and(eq(tournaments.tournamentId, tournamentId), isNull(tournaments.deletedAt)))
      .limit(1);

    return (row as TournamentRow | undefined) ?? null;
  }

  async getTournamentDetailById(tournamentId: string): Promise<TournamentDetailRow | null> {
    const [row] = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        title: tournaments.title,
        description: tournaments.description,
        difficulty: tournaments.difficulty,
        status: tournaments.status,
        prize: tournaments.prize,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        maxParticipants: tournaments.maxParticipants,
        categoryId: tournaments.categoryId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        totalParticipants:
          sql<number>`count(${tournamentParticipants.participantId}) over (partition by ${tournamentParticipants.tournamentId})`.as(
            'total_participants',
          ),
      })
      .from(tournaments)
      .leftJoin(categories, eq(tournaments.categoryId, categories.categoryId))
      .leftJoin(
        tournamentParticipants,
        eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
      )
      .where(and(eq(tournaments.tournamentId, tournamentId), isNull(tournaments.deletedAt)))
      .limit(1);

    if (!row) return null;

    // Fetch total participants count
    const [countRow] = await this.db
      .select({ total: count() })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      );

    return {
      ...(row as Omit<TournamentDetailRow, 'totalParticipants'>),
      totalParticipants: countRow?.total ?? 0,
    } as TournamentDetailRow;
  }

  async listTournaments(params: {
    limit: number;
    cursor?: TournamentCursorPayload | null;
    filters?: TournamentListFilters;
  }): Promise<TournamentRow[]> {
    const filters: ReturnType<typeof sql<unknown>>[] = [isNull(tournaments.deletedAt)];

    if (params.filters?.status) {
      filters.push(eq(tournaments.status, params.filters.status));
    }

    if (params.filters?.difficulty) {
      filters.push(eq(tournaments.difficulty, params.filters.difficulty));
    }

    if (params.filters?.categoryId) {
      filters.push(eq(tournaments.categoryId, params.filters.categoryId));
    }

    if (params.cursor) {
      filters.push(
        or(
          sql`${tournaments.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(tournaments.createdAt, params.cursor.createdAt),
            sql`${tournaments.tournamentId} < ${params.cursor.tournamentId}`,
          ),
        ) as ReturnType<typeof sql<unknown>>,
      );
    }

    const rows = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        title: tournaments.title,
        description: tournaments.description,
        difficulty: tournaments.difficulty,
        status: tournaments.status,
        prize: tournaments.prize,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        maxParticipants: tournaments.maxParticipants,
        categoryId: tournaments.categoryId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
      })
      .from(tournaments)
      .where(and(...filters))
      .orderBy(desc(tournaments.createdAt), desc(tournaments.tournamentId))
      .limit(params.limit + 1);

    return rows as TournamentRow[];
  }

  async createTournament(params: {
    title: string;
    description: string | null;
    difficulty: TournamentDifficulty;
    prize: string | null;
    startAt: string;
    endAt: string;
    maxParticipants: number | null;
    categoryId: string | null;
    nowIso: string;
  }): Promise<{ tournamentId: string }> {
    const [result] = await this.db
      .insert(tournaments)
      .values({
        title: params.title,
        description: params.description,
        difficulty: params.difficulty,
        prize: params.prize,
        startAt: params.startAt,
        endAt: params.endAt,
        maxParticipants: params.maxParticipants,
        categoryId: params.categoryId,
        status: 'upcoming',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({ tournamentId: tournaments.tournamentId });

    return { tournamentId: result.tournamentId };
  }

  async getParticipant(participantId: string): Promise<TournamentParticipantRow | null> {
    const [row] = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        updatedAt: tournamentParticipants.updatedAt,
      })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.participantId, participantId))
      .limit(1);

    return (row as TournamentParticipantRow | undefined) ?? null;
  }

  async getParticipantByUserAndTournament(
    userId: string,
    tournamentId: string,
  ): Promise<TournamentParticipantRow | null> {
    const [row] = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        updatedAt: tournamentParticipants.updatedAt,
      })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.userId, userId),
          eq(tournamentParticipants.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    return (row as TournamentParticipantRow | undefined) ?? null;
  }

  async getParticipantById(participantId: string): Promise<TournamentParticipantRow | null> {
    return this.getParticipant(participantId);
  }

  async registerParticipant(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
  }): Promise<TournamentParticipantRow> {
    const [row] = await this.db
      .insert(tournamentParticipants)
      .values({
        tournamentId: params.tournamentId,
        userId: params.userId,
        registeredAt: params.nowIso,
        totalScore: 0,
        totalTimeMs: 0,
        status: 'active' as TournamentParticipantStatus,
        updatedAt: params.nowIso,
      })
      .returning({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        updatedAt: tournamentParticipants.updatedAt,
      });

    return row as TournamentParticipantRow;
  }

  async getRoundById(roundId: string): Promise<TournamentRoundRow | null> {
    const [row] = await this.db
      .select({
        roundId: tournamentRounds.roundId,
        tournamentId: tournamentRounds.tournamentId,
        roundNumber: tournamentRounds.roundNumber,
        name: tournamentRounds.name,
        description: tournamentRounds.description,
        quizVersionId: tournamentRounds.quizVersionId,
        startAt: tournamentRounds.startAt,
        endAt: tournamentRounds.endAt,
        durationMs: tournamentRounds.durationMs,
        status: tournamentRounds.status,
        isElimination: tournamentRounds.isElimination,
        participantLimit: tournamentRounds.participantLimit,
        createdAt: tournamentRounds.createdAt,
        updatedAt: tournamentRounds.updatedAt,
      })
      .from(tournamentRounds)
      .where(eq(tournamentRounds.roundId, roundId))
      .limit(1);

    return (row as TournamentRoundRow | undefined) ?? null;
  }

  getRoundDetailById(
    roundId: string,
  ): Promise<import('@/modules/tournament/domain/ports').TournamentRoundDetailRow | null> {
    // Not implemented yet - returns null, can be extended later
    void roundId;
    return Promise.resolve(null);
  }

  async getRoundsByTournament(tournamentId: string): Promise<TournamentRoundRow[]> {
    const rows = await this.db
      .select({
        roundId: tournamentRounds.roundId,
        tournamentId: tournamentRounds.tournamentId,
        roundNumber: tournamentRounds.roundNumber,
        name: tournamentRounds.name,
        description: tournamentRounds.description,
        quizVersionId: tournamentRounds.quizVersionId,
        startAt: tournamentRounds.startAt,
        endAt: tournamentRounds.endAt,
        durationMs: tournamentRounds.durationMs,
        status: tournamentRounds.status,
        isElimination: tournamentRounds.isElimination,
        participantLimit: tournamentRounds.participantLimit,
        createdAt: tournamentRounds.createdAt,
        updatedAt: tournamentRounds.updatedAt,
      })
      .from(tournamentRounds)
      .where(eq(tournamentRounds.tournamentId, tournamentId))
      .orderBy(tournamentRounds.roundNumber);

    return rows as TournamentRoundRow[];
  }

  async getRoundParticipant(
    roundId: string,
    participantId: string,
  ): Promise<TournamentRoundParticipantRow | null> {
    const [row] = await this.db
      .select({
        roundParticipantId: tournamentRoundParticipants.roundParticipantId,
        roundId: tournamentRoundParticipants.roundId,
        participantId: tournamentRoundParticipants.participantId,
        attemptId: tournamentRoundParticipants.attemptId,
        joinedAt: tournamentRoundParticipants.joinedAt,
        roundScore: tournamentRoundParticipants.roundScore,
        roundTimeMs: tournamentRoundParticipants.roundTimeMs,
        rankInRound: tournamentRoundParticipants.rankInRound,
        isQualified: tournamentRoundParticipants.isQualified,
        updatedAt: tournamentRoundParticipants.updatedAt,
      })
      .from(tournamentRoundParticipants)
      .where(
        and(
          eq(tournamentRoundParticipants.roundId, roundId),
          eq(tournamentRoundParticipants.participantId, participantId),
        ),
      )
      .limit(1);

    return (row as TournamentRoundParticipantRow | undefined) ?? null;
  }

  async createRoundParticipant(params: {
    roundId: string;
    participantId: string;
    nowIso: string;
  }): Promise<TournamentRoundParticipantRow> {
    const [row] = await this.db
      .insert(tournamentRoundParticipants)
      .values({
        roundId: params.roundId,
        participantId: params.participantId,
        joinedAt: params.nowIso,
        roundScore: 0,
        roundTimeMs: 0,
        isQualified: true,
        updatedAt: params.nowIso,
      })
      .returning({
        roundParticipantId: tournamentRoundParticipants.roundParticipantId,
        roundId: tournamentRoundParticipants.roundId,
        participantId: tournamentRoundParticipants.participantId,
        attemptId: tournamentRoundParticipants.attemptId,
        joinedAt: tournamentRoundParticipants.joinedAt,
        roundScore: tournamentRoundParticipants.roundScore,
        roundTimeMs: tournamentRoundParticipants.roundTimeMs,
        rankInRound: tournamentRoundParticipants.rankInRound,
        isQualified: tournamentRoundParticipants.isQualified,
        updatedAt: tournamentRoundParticipants.updatedAt,
      });

    return row as TournamentRoundParticipantRow;
  }

  async getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardEntry[]> {
    const rows = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        updatedAt: tournamentParticipants.updatedAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      )
      .orderBy(desc(tournamentParticipants.totalScore), tournamentParticipants.totalTimeMs);

    return rows.map((row, index) => ({
      ...(row as Omit<TournamentLeaderboardEntry, 'rank'>),
      rank: index + 1,
    })) as TournamentLeaderboardEntry[];
  }

  async countParticipants(tournamentId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      );

    return row?.count ?? 0;
  }
}
