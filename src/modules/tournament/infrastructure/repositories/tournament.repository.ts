import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  tournamentRoundParticipants,
  categories,
  users,
  userProfiles,
} from '@/core/database/schema';
import type {
  TournamentDifficulty,
  TournamentParticipantStatus,
  TournamentStatus,
} from '@/modules/tournament/types/tournament.types';
import type {
  FinalizedTournamentParticipantRow,
  TournamentRepositoryPort,
  TournamentRow,
  TournamentDetailRow,
  TournamentRoundRow,
  TournamentParticipantRow,
  TournamentRoundParticipantRow,
  TournamentLeaderboardEntry,
  TournamentListFilters,
  TournamentCursorPayload,
  TournamentParticipantListItemRow,
  TournamentStandingRow,
  UpcomingTournamentRow,
  ActiveTournamentRow,
  CompletedTournamentRow,
  RelatedTournamentRow,
  TournamentStatsRow,
  TournamentWinnerRow,
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

  async listUpcomingTournaments(params: {
    page: number;
    limit: number;
    sortBy: 'startAt' | 'registrationDeadline';
    nowIso: string;
  }): Promise<{ items: UpcomingTournamentRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      isNull(tournaments.deletedAt),
      sql`${tournaments.startAt} > ${params.nowIso}`,
    );

    const [totalRow] = await this.db.select({ count: count() }).from(tournaments).where(conditions);

    const participantCountSql = sql<number>`count(${tournamentParticipants.participantId})`;
    const orderColumn =
      params.sortBy === 'registrationDeadline' ? tournaments.createdAt : tournaments.startAt;

    const items = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        name: tournaments.title,
        description: tournaments.description,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        participantCount: participantCountSql.as('participant_count'),
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        and(
          eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      )
      .where(conditions)
      .groupBy(
        tournaments.tournamentId,
        tournaments.title,
        tournaments.description,
        tournaments.startAt,
        tournaments.endAt,
        orderColumn,
      )
      .orderBy(orderColumn, tournaments.tournamentId)
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as UpcomingTournamentRow[],
      total: totalRow?.count ?? 0,
    };
  }

  async listActiveTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: ActiveTournamentRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      isNull(tournaments.deletedAt),
      sql`${tournaments.startAt} <= ${params.nowIso}`,
      sql`${tournaments.endAt} >= ${params.nowIso}`,
    );

    const [totalRow] = await this.db.select({ count: count() }).from(tournaments).where(conditions);

    const items = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        name: tournaments.title,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        participantCount: sql<number>`count(${tournamentParticipants.participantId})`.as(
          'participant_count',
        ),
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        and(
          eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      )
      .where(conditions)
      .groupBy(tournaments.tournamentId, tournaments.title, tournaments.startAt, tournaments.endAt)
      .orderBy(tournaments.endAt, tournaments.tournamentId)
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as ActiveTournamentRow[],
      total: totalRow?.count ?? 0,
    };
  }

  async listCompletedTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: CompletedTournamentRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      isNull(tournaments.deletedAt),
      sql`${tournaments.endAt} < ${params.nowIso}`,
    );

    const [totalRow] = await this.db.select({ count: count() }).from(tournaments).where(conditions);

    const items = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        name: tournaments.title,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
        participantCount: sql<number>`count(${tournamentParticipants.participantId})`.as(
          'participant_count',
        ),
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        and(
          eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      )
      .where(conditions)
      .groupBy(tournaments.tournamentId, tournaments.title, tournaments.startAt, tournaments.endAt)
      .orderBy(desc(tournaments.endAt), desc(tournaments.tournamentId))
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as CompletedTournamentRow[],
      total: totalRow?.count ?? 0,
    };
  }

  async listRelatedTournaments(params: {
    tournamentId: string;
    limit: number;
  }): Promise<RelatedTournamentRow[]> {
    const base = this.db
      .select({
        tournamentId: tournaments.tournamentId,
        name: tournaments.title,
        description: tournaments.description,
        startAt: tournaments.startAt,
        categoryId: tournaments.categoryId,
        participantCount: sql<number>`count(${tournamentParticipants.participantId})`.as(
          'participant_count',
        ),
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        and(
          eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
          eq(tournamentParticipants.status, 'active'),
        ),
      )
      .where(
        and(
          isNull(tournaments.deletedAt),
          sql`${tournaments.tournamentId} != ${params.tournamentId}`,
        ),
      )
      .groupBy(
        tournaments.tournamentId,
        tournaments.title,
        tournaments.description,
        tournaments.startAt,
        tournaments.categoryId,
      )
      .orderBy(desc(tournaments.startAt), tournaments.tournamentId)
      .limit(params.limit * 3);

    const rows = await base;

    const tournament = await this.getTournamentById(params.tournamentId);
    if (!tournament) return [];

    const titleWords = tournament.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const scored = rows
      .map((row) => {
        let score = 0;
        if (row.categoryId === tournament.categoryId) score += 3;
        if (tournament.description) {
          const words = tournament.description
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 2);
          for (const word of words) {
            if (row.description && row.description.toLowerCase().includes(word)) score += 1;
          }
        }
        for (const word of titleWords) {
          if (row.name.toLowerCase().includes(word)) score += 0.5;
        }
        return { ...row, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || (a.startAt > b.startAt ? -1 : 1))
      .slice(0, params.limit);

    return scored as RelatedTournamentRow[];
  }

  async getTournamentStats(tournamentId: string): Promise<TournamentStatsRow> {
    const [stats] = await this.db
      .select({
        tournamentId: tournaments.tournamentId,
        participants: sql<number>`COUNT(${tournamentParticipants.participantId})`,
        completedParticipants: sql<number>`COUNT(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN 1 END)`,
        averageScore:
          sql<number>`COALESCE(ROUND(AVG(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore}::numeric END)), 0)`,
        highestScore:
          sql<number | null>`MAX(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore} END)`,
        lowestScore:
          sql<number | null>`MIN(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore} END)`,
        completionRate:
          sql<number>`COALESCE(ROUND((COUNT(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN 1 END)::numeric * 100.0) / NULLIF(COUNT(${tournamentParticipants.participantId}), 0), 2), 0)`,
        averageRank:
          sql<number | null>`ROUND(AVG(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.rankFinal}::numeric END))`,
        startedAt: tournaments.startAt,
        endedAt: tournaments.endAt,
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        eq(tournaments.tournamentId, tournamentParticipants.tournamentId),
      )
      .where(and(eq(tournaments.tournamentId, tournamentId), isNull(tournaments.deletedAt)))
      .groupBy(tournaments.tournamentId, tournaments.startAt, tournaments.endAt)
      .limit(1);

    return {
      tournamentId,
      participants: Number(stats?.participants ?? 0),
      completedParticipants: Number(stats?.completedParticipants ?? 0),
      averageScore: Number(stats?.averageScore ?? 0),
      highestScore: stats?.highestScore ?? null,
      lowestScore: stats?.lowestScore ?? null,
      completionRate: Number(stats?.completionRate ?? 0),
      averageRank: stats?.averageRank ?? null,
      startedAt: stats?.startedAt ?? '',
      endedAt: stats?.endedAt ?? '',
    };
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
        withdrawnAt: tournamentParticipants.withdrawnAt,
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
        withdrawnAt: tournamentParticipants.withdrawnAt,
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
        withdrawnAt: tournamentParticipants.withdrawnAt,
        updatedAt: tournamentParticipants.updatedAt,
      });

    return row as TournamentParticipantRow;
  }

  async withdrawParticipant(
    participantId: string,
    nowIso: string,
  ): Promise<TournamentParticipantRow> {
    const [row] = await this.db
      .update(tournamentParticipants)
      .set({
        status: 'withdrawn' as TournamentParticipantStatus,
        withdrawnAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(tournamentParticipants.participantId, participantId))
      .returning({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        withdrawnAt: tournamentParticipants.withdrawnAt,
        updatedAt: tournamentParticipants.updatedAt,
      });

    return row as TournamentParticipantRow;
  }

  async reactivateParticipant(
    participantId: string,
    nowIso: string,
  ): Promise<TournamentParticipantRow> {
    const [row] = await this.db
      .update(tournamentParticipants)
      .set({
        status: 'active' as TournamentParticipantStatus,
        withdrawnAt: null,
        updatedAt: nowIso,
      })
      .where(eq(tournamentParticipants.participantId, participantId))
      .returning({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournamentParticipants.tournamentId,
        userId: tournamentParticipants.userId,
        registeredAt: tournamentParticipants.registeredAt,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
        rankFinal: tournamentParticipants.rankFinal,
        status: tournamentParticipants.status,
        withdrawnAt: tournamentParticipants.withdrawnAt,
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
        withdrawnAt: tournamentParticipants.withdrawnAt,
        updatedAt: tournamentParticipants.updatedAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
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

  async getWinners(params: {
    tournamentId: string;
    limit: number;
  }): Promise<TournamentWinnerRow[]> {
    const rows = await this.db
      .select({
        rank: tournamentParticipants.rankFinal,
        userId: tournamentParticipants.userId,
        username: users.username,
        score: tournamentParticipants.totalScore,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(tournamentParticipants.tournamentId, params.tournamentId),
          isNull(tournamentParticipants.withdrawnAt),
          isNull(users.deletedAt),
          sql`${tournamentParticipants.rankFinal} is not null`,
        ),
      )
      .orderBy(asc(tournamentParticipants.rankFinal))
      .limit(params.limit);

    return rows.map((row) => ({
      rank: Number(row.rank),
      userId: row.userId,
      username: row.username,
      score: row.score,
      avatarUrl: row.avatarUrl,
    }));
  }

  async listParticipants(params: {
    tournamentId: string;
    page: number;
    limit: number;
  }): Promise<{ items: TournamentParticipantListItemRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      eq(tournamentParticipants.tournamentId, params.tournamentId),
      eq(tournamentParticipants.status, 'active'),
      isNull(users.deletedAt),
    );

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(conditions);

    const items = await this.db
      .select({
        userId: tournamentParticipants.userId,
        username: users.username,
        registeredAt: tournamentParticipants.registeredAt,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(conditions)
      .orderBy(
        desc(tournamentParticipants.registeredAt),
        desc(tournamentParticipants.participantId),
      )
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as TournamentParticipantListItemRow[],
      total: totalRow?.count ?? 0,
    };
  }

  async getParticipantStanding(params: {
    tournamentId: string;
    userId: string;
  }): Promise<TournamentStandingRow | null> {
    const participant = await this.getParticipantByUserAndTournament(
      params.userId,
      params.tournamentId,
    );

    if (!participant || participant.status === 'withdrawn') {
      return null;
    }

    const activeParticipants = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        totalScore: tournamentParticipants.totalScore,
        totalTimeMs: tournamentParticipants.totalTimeMs,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(
        and(
          eq(tournamentParticipants.tournamentId, params.tournamentId),
          eq(tournamentParticipants.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(desc(tournamentParticipants.totalScore), tournamentParticipants.totalTimeMs);

    const participantCount = activeParticipants.length;
    const participantIndex = activeParticipants.findIndex(
      (row) => row.participantId === participant.participantId,
    );

    if (participantIndex === -1) {
      return null;
    }

    const rank = participantIndex + 1;
    const rankedBelow = participantCount - rank;
    const percentile =
      participantCount <= 1 ? 0 : Math.round((rankedBelow / participantCount) * 100);

    return {
      rank,
      score: participant.totalScore,
      percentile,
      participantCount,
    };
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

  async listTournamentsStartingSoon(params: {
    windowStartIso: string;
    windowEndIso: string;
  }): Promise<TournamentRow[]> {
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
      .where(
        and(
          isNull(tournaments.deletedAt),
          eq(tournaments.status, 'upcoming' as TournamentStatus),
          sql`${tournaments.startAt} >= ${params.windowStartIso}`,
          sql`${tournaments.startAt} <= ${params.windowEndIso}`,
        ),
      )
      .orderBy(asc(tournaments.startAt), asc(tournaments.tournamentId));

    return rows as TournamentRow[];
  }

  async markTournamentStatus(params: {
    tournamentId: string;
    fromStatus: TournamentStatus;
    toStatus: TournamentStatus;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    const [row] = await this.db
      .update(tournaments)
      .set({
        status: params.toStatus,
        updatedAt: params.nowIso,
      })
      .where(
        and(
          eq(tournaments.tournamentId, params.tournamentId),
          eq(tournaments.status, params.fromStatus),
          isNull(tournaments.deletedAt),
        ),
      )
      .returning({
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
      });

    return (row as TournamentRow | undefined) ?? null;
  }

  async finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<FinalizedTournamentParticipantRow[]> {
    const participants = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        userId: tournamentParticipants.userId,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(
        and(
          eq(tournamentParticipants.tournamentId, params.tournamentId),
          isNull(tournamentParticipants.withdrawnAt),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(desc(tournamentParticipants.totalScore), tournamentParticipants.totalTimeMs);

    const totalParticipants = participants.length;

    for (const [index, participant] of participants.entries()) {
      await this.db
        .update(tournamentParticipants)
        .set({
          rankFinal: index + 1,
          status: 'completed' as TournamentParticipantStatus,
          updatedAt: params.nowIso,
        })
        .where(eq(tournamentParticipants.participantId, participant.participantId));
    }

    return participants.map((participant, index) => ({
      userId: participant.userId,
      rank: index + 1,
      totalParticipants,
    }));
  }
}
