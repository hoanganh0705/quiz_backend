import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  tournamentRoundParticipants,
  tournamentStats,
  quizVersions,
  quizAttempts,
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
  TournamentRoundDetailRow,
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

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

@Injectable()
export class TournamentRepository implements TournamentRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
  }

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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
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
    // Filter on status = 'upcoming' AND startAt > now.
    // Issue #13: Previously only filtered startAt > now, which would include
    // any tournament whose startAt is in the future regardless of status
    // (e.g. cancelled tournaments could appear).
    const conditions = and(
      isNull(tournaments.deletedAt),
      eq(tournaments.status, 'upcoming'),
      sql`${tournaments.startAt} > ${params.nowIso}`,
    );

    const [totalRow] = await this.db.select({ count: count() }).from(tournaments).where(conditions);

    const participantCountSql = sql<number>`count(${tournamentParticipants.participantId})`;
    // Issue #80: `sortBy = 'registrationDeadline'` actually sorts by `createdAt`.
    // There is no `registration_deadline` column on tournaments. This is documented
    // in the controller's OpenAPI description.
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
    // Issue #12: Filter on status IN ('registration', 'ongoing') AND time window.
    // Previously only filtered on time window, which would include any tournament
    // whose [startAt, endAt] window contains "now" regardless of status
    // (e.g. finished tournaments with misconfigured endAt could appear).
    const conditions = and(
      isNull(tournaments.deletedAt),
      or(eq(tournaments.status, 'registration'), eq(tournaments.status, 'ongoing')),
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
    // Filter on status = 'finished' AND endAt < now.
    // Issue #14: Previously only filtered endAt < now, which would include
    // any tournament whose endAt is in the past regardless of status
    // (e.g. cancelled tournaments with endAt in the past would appear).
    const conditions = and(
      isNull(tournaments.deletedAt),
      eq(tournaments.status, 'finished'),
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
          // Issue #15: Include non-cancelled tournaments only.
          // Allow 'finished' for historical browsing but exclude 'cancelled'.
          ne(tournaments.status, 'cancelled'),
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
        tournamentId: tournamentStats.tournamentId,
        participants: tournamentStats.participants,
        completedParticipants: tournamentStats.completedParticipants,
        averageScore: sql<string>`COALESCE(${tournamentStats.averageScore}::numeric, 0)`,
        highestScore: tournamentStats.highestScore,
        lowestScore: tournamentStats.lowestScore,
        completionRate: sql<string>`COALESCE(${tournamentStats.completionRate}::numeric, 0)`,
        averageRank: tournamentStats.averageRank,
        startedAt: tournaments.startAt,
        endedAt: tournaments.endAt,
      })
      .from(tournamentStats)
      .innerJoin(tournaments, eq(tournamentStats.tournamentId, tournaments.tournamentId))
      .where(and(eq(tournamentStats.tournamentId, tournamentId), isNull(tournaments.deletedAt)))
      .limit(1);

    if (stats) {
      return {
        tournamentId,
        participants: Number(stats.participants ?? 0),
        completedParticipants: Number(stats.completedParticipants ?? 0),
        averageScore: Number(stats.averageScore ?? 0),
        highestScore: stats.highestScore ?? null,
        lowestScore: stats.lowestScore ?? null,
        completionRate: Number(stats.completionRate ?? 0),
        averageRank: stats.averageRank ? Number(stats.averageRank) : null,
        startedAt: stats.startedAt ?? '',
        endedAt: stats.endedAt ?? '',
      };
    }

    const [fallback] = await this.db
      .select({
        participants: sql<number>`COUNT(${tournamentParticipants.participantId})`,
        completedParticipants: sql<number>`COUNT(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN 1 END)`,
        averageScore: sql<number>`COALESCE(ROUND(AVG(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore}::numeric END)), 0)`,
        highestScore: sql<
          number | null
        >`MAX(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore} END)`,
        lowestScore: sql<
          number | null
        >`MIN(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.totalScore} END)`,
        completionRate: sql<number>`COALESCE(ROUND((COUNT(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN 1 END)::numeric * 100.0) / NULLIF(COUNT(${tournamentParticipants.participantId}), 0), 2), 0)`,
        averageRank: sql<
          number | null
        >`ROUND(AVG(CASE WHEN ${tournamentParticipants.rankFinal} IS NOT NULL THEN ${tournamentParticipants.rankFinal}::numeric END))`,
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
      participants: Number(fallback?.participants ?? 0),
      completedParticipants: Number(fallback?.completedParticipants ?? 0),
      averageScore: Number(fallback?.averageScore ?? 0),
      highestScore: fallback?.highestScore ?? null,
      lowestScore: fallback?.lowestScore ?? null,
      completionRate: Number(fallback?.completionRate ?? 0),
      averageRank: fallback?.averageRank ?? null,
      startedAt: fallback?.startedAt ?? '',
      endedAt: fallback?.endedAt ?? '',
    };
  }

  private async refreshTournamentStats(tournamentId: string, tx?: unknown): Promise<void> {
    const client = tx != null ? (tx as DrizzleDB) : this.db;
    await client.execute(sql`
      INSERT INTO tournament_stats AS ts (
        tournament_id, participants, completed_participants,
        average_score, highest_score, lowest_score,
        completion_rate, average_rank, updated_at
      )
      SELECT
        ${tournamentId},
        COUNT(tp.participant_id)::int,
        COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END)::int,
        COALESCE(ROUND(AVG(CASE WHEN tp.rank_final IS NOT NULL THEN tp.total_score::numeric END), 2), 0)::numeric,
        CASE WHEN COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END) = 0 THEN NULL
             ELSE MAX(CASE WHEN tp.rank_final IS NOT NULL THEN tp.total_score END)::int
        END,
        CASE WHEN COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END) = 0 THEN NULL
             ELSE MIN(CASE WHEN tp.rank_final IS NOT NULL THEN tp.total_score END)::int
        END,
        COALESCE(
          ROUND(
            (COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END)::numeric * 100.0) /
            NULLIF(COUNT(tp.participant_id), 0),
            2
          ),
          0
        )::numeric,
        CASE WHEN COUNT(CASE WHEN tp.rank_final IS NOT NULL THEN 1 END) = 0 THEN NULL
             ELSE ROUND(AVG(CASE WHEN tp.rank_final IS NOT NULL THEN tp.rank_final::numeric END))::numeric
        END,
        now()
      FROM tournament_participants tp
      WHERE tp.tournament_id = ${tournamentId}
      ON CONFLICT (tournament_id) DO UPDATE SET
        participants = EXCLUDED.participants,
        completed_participants = EXCLUDED.completed_participants,
        average_score = EXCLUDED.average_score,
        highest_score = EXCLUDED.highest_score,
        lowest_score = EXCLUDED.lowest_score,
        completion_rate = EXCLUDED.completion_rate,
        average_rank = EXCLUDED.average_rank,
        updated_at = EXCLUDED.updated_at
    `);
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
    ownerUserId: string;
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
        // Phase 1 / Issue #2 — `owner_user_id` is NOT NULL on the
        // table; the migration backfilled historical rows to the
        // system actor, so every tournament ever has an owner.
        ownerUserId: params.ownerUserId,
        status: 'upcoming',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({ tournamentId: tournaments.tournamentId });

    return { tournamentId: result.tournamentId };
  }

  /**
   * Phase 1 / Issue #1 — partial update for `PATCH /tournaments/:id`.
   *
   * Builds a partial `set` payload from whichever fields the caller
   * provided. Fields set to `undefined` in `params` are omitted
   * from the UPDATE entirely (Drizzle's `.set()` accepts undefined
   * to mean "leave alone"). The check for `tournamentId` not yet
   * being soft-deleted is part of the WHERE so a deleted row stays
   * deleted and the UPDATE returns zero rows.
   *
   * The `WHERE` returns rows using `isNull(deletedAt)` — even though
   * the matching row may have been touched — and the `RETURNING`
   * clause does a full projection so callers get a `TournamentRow`
   * shaped value back without a follow-up SELECT.
   *
   * Returns `null` when no row matches the predicate (the row was
   * missing or already soft-deleted). The service layer maps `null`
   * to `TournamentNotFoundError`.
   */
  async updateTournament(params: {
    tournamentId: string;
    title?: string;
    description?: string | null;
    difficulty?: TournamentDifficulty;
    prize?: string | null;
    startAt?: string;
    endAt?: string;
    maxParticipants?: number | null;
    categoryId?: string | null;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    const set: Partial<typeof tournaments.$inferInsert> = { updatedAt: params.nowIso };
    if (params.title !== undefined) set.title = params.title;
    if (params.description !== undefined) set.description = params.description;
    if (params.difficulty !== undefined) set.difficulty = params.difficulty;
    if (params.prize !== undefined) set.prize = params.prize;
    if (params.startAt !== undefined) set.startAt = params.startAt;
    if (params.endAt !== undefined) set.endAt = params.endAt;
    if (params.maxParticipants !== undefined) set.maxParticipants = params.maxParticipants;
    if (params.categoryId !== undefined) set.categoryId = params.categoryId;

    const [row] = await this.db
      .update(tournaments)
      .set(set)
      .where(and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)))
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
      });

    return (row as TournamentRow | undefined) ?? null;
  }

  /**
   * Phase 1 / Issue #1 — soft delete for `DELETE /tournaments/:id`.
   *
   * Writes `deleted_at = nowIso()`. The `RETURNING` includes the
   * (already-set) `deleted_at`, so the caller can echo the soft-delete
   * timestamp back without a second SELECT.
   *
   * Idempotent: a soft-deleted row stays soft-deleted (the WHERE does
   * not match a row with `deleted_at IS NOT NULL`, so a second
   * DELETE returns `null` rather than mutating the timestamp). The
   * service layer translates `null` into either
   * `TournamentNotFoundError` or `TournamentAlreadyDeletedError` based
   * on its own state check.
   */
  async softDeleteTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    const [row] = await this.db
      .update(tournaments)
      .set({
        deletedAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .where(and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)))
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
      });

    return (row as TournamentRow | undefined) ?? null;
  }

  /**
   * Phase 1 / Issue #1 — cancel transition for `POST /tournaments/:id/cancel`.
   *
   * The state guard lives in the service layer (it needs to read the
   * current row first to make the cancel-vs-already-canceled
   * distinction observable to the client). The repository accepts a
   * transition for any row that is currently live
   * (`deleted_at IS NULL`).
   *
   * Returns the post-mutation row, or `null` when no live row
   * matches the predicate (the row no longer exists or was
   * soft-deleted between the caller's `SELECT` and the `UPDATE`).
   */
  async cancelTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    const [row] = await this.db
      .update(tournaments)
      .set({
        status: 'cancelled',
        updatedAt: params.nowIso,
      })
      .where(and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)))
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
      });

    return (row as TournamentRow | undefined) ?? null;
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
    tx?: unknown,
  ): Promise<TournamentParticipantRow> {
    const client = tx != null ? (tx as DrizzleDB) : this.db;
    const [row] = await client
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

  /**
   * Phase 2 / Issues #3, #4 — atomic tournament registration.
   *
   * Wraps the full read-check-insert sequence inside a single transaction
   * with a row-level lock on the tournament so the capacity check is
   * always consistent. Uses `INSERT … ON CONFLICT DO NOTHING` to safely
   * handle the case where two concurrent requests both find no existing
   * participant and both try to insert — the second receives zero rows
   * back and the method falls through to a re-read.
   *
   * Returns the newly-inserted or pre-existing participant row.
   * The `inserted` flag indicates whether the row was freshly created.
   */
  async atomicRegister(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<{ participant: TournamentParticipantRow; inserted: boolean }> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
      // 1. Lock the tournament row — prevents concurrent registration from
      //    racing the capacity count.
      const [tournament] = await tx
        .select({
          tournamentId: tournaments.tournamentId,
          maxParticipants: tournaments.maxParticipants,
          status: tournaments.status,
        })
        .from(tournaments)
        .where(
          and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)),
        )
        .limit(1)
        .for('update');

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // 2. Re-count active participants under the lock — this is now
      //    fully consistent; two concurrent requests that both see
      //    count == max-1 will serialize on the FOR UPDATE and the
      //    second one will correctly see count == max and raise.
      if (tournament.maxParticipants !== null) {
        const activeCountResult = await tx
          .select({ activeCount: count() })
          .from(tournamentParticipants)
          .where(
            and(
              eq(tournamentParticipants.tournamentId, params.tournamentId),
              eq(tournamentParticipants.status, 'active' as TournamentParticipantStatus),
            ),
          )
          .limit(1);

        const activeCount = activeCountResult[0]?.activeCount ?? 0;
        if (activeCount >= tournament.maxParticipants) {
          throw new Error('TOURNAMENT_FULL');
        }
      }

      // 3. Upsert: insert if no row exists; silently ignore conflicts.
      //    `onConflictDoNothing` returns an empty array when the unique
      //    constraint fires. We then re-read the existing row so the
      //    caller can decide how to proceed based on the returned status.
      const inserted = await tx
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
        .onConflictDoNothing({
          target: [tournamentParticipants.tournamentId, tournamentParticipants.userId],
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

      if (inserted.length > 0) {
        return {
          participant: inserted[0] as TournamentParticipantRow,
          inserted: true,
        };
      }

      // Conflict — user was already registered (or withdrawn). Re-read
      // the current state so the service can decide what to do.
      const [existing] = await tx
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
            eq(tournamentParticipants.tournamentId, params.tournamentId),
            eq(tournamentParticipants.userId, params.userId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error('Participant not found after registration conflict');
      }

      return {
        participant: existing as TournamentParticipantRow,
        inserted: false,
      };
    });
  }

  /**
   * Phase 2 / Issue #2 (part 2) — atomic tournament withdrawal.
   *
   * Locks the tournament row with `SELECT … FOR UPDATE`, then
   * conditionally updates the participant to `status='withdrawn'`
   * only when they are currently `active`. This prevents the
   * TOCTOU race described in the port interface.
   *
   * Returns the updated participant, or `null` if no active
   * participant existed for this (user, tournament) pair.
   */
  async atomicWithdraw(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentParticipantRow | null> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
      // Lock the tournament row for consistency (prevents concurrent
      // re-registration from racing the withdrawal).
      const [tournament] = await tx
        .select({ tournamentId: tournaments.tournamentId })
        .from(tournaments)
        .where(
          and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)),
        )
        .limit(1)
        .for('update');

      if (!tournament) {
        return null;
      }

      // Conditionally withdraw — only succeeds when the participant
      // is currently `active`. The `WHERE` on status prevents a
      // concurrent re-activation from being immediately re-withdrawn.
      const [withdrawn] = await tx
        .update(tournamentParticipants)
        .set({
          status: 'withdrawn' as TournamentParticipantStatus,
          withdrawnAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .where(
          and(
            eq(tournamentParticipants.tournamentId, params.tournamentId),
            eq(tournamentParticipants.userId, params.userId),
            eq(tournamentParticipants.status, 'active' as TournamentParticipantStatus),
          ),
        )
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

      return (withdrawn as TournamentParticipantRow | undefined) ?? null;
    });
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

  async getRoundDetailById(roundId: string): Promise<TournamentRoundDetailRow | null> {
    const result = await this.db
      .select({
        roundId: tournamentRounds.roundId,
        tournamentId: tournamentRounds.tournamentId,
        roundNumber: tournamentRounds.roundNumber,
        name: tournamentRounds.name,
        description: tournamentRounds.description,
        quizVersionId: tournamentRounds.quizVersionId,
        startAt: tournamentRounds.startAt,
        endAt: tournamentRounds.endAt,
        durationMs: quizVersions.durationMs,
        status: tournamentRounds.status,
        isElimination: tournamentRounds.isElimination,
        participantLimit: tournamentRounds.participantLimit,
        createdAt: tournamentRounds.createdAt,
        updatedAt: tournamentRounds.updatedAt,
        versionNumber: quizVersions.versionNumber,
        difficulty: quizVersions.difficulty,
        passingScorePercent: quizVersions.passingScorePercent,
        rewardXp: quizVersions.rewardXp,
      })
      .from(tournamentRounds)
      .leftJoin(quizVersions, eq(tournamentRounds.quizVersionId, quizVersions.quizVersionId))
      .where(eq(tournamentRounds.roundId, roundId))
      .limit(1);

    const [row] = result as any;
    return (row as unknown as TournamentRoundDetailRow | undefined) ?? null;
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

  /**
   * Phase 2 / Issues #6, #50 — atomic round-start with idempotency.
   *
   * Replaces the service-layer TOCTOU check with a single atomic
   * transaction that:
   *
   *   1. Tries to insert the round_participant row with
   *      `ON CONFLICT DO NOTHING`. If the row already exists (duplicate
   *      request or the `existingRoundParticipant` case from the service
   *      layer), the INSERT silently succeeds with zero rows returned.
   *
   *   2. Re-reads the round_participant row (with `FOR UPDATE` to
   *      prevent a concurrent `createAttemptForRound` from racing).
   *
   *   3. If `attemptId` is already set, returns it immediately
   *      (idempotent — user already started this round).
   *
   *   4. Otherwise, creates the quiz_attempt and links it back.
   *
   * The service layer pre-checks `round.tournamentId === tournamentId`
   * (cross-tournament attack prevention) before calling this method.
   */
  async startRoundAttemptTx(params: {
    roundId: string;
    participantId: string;
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    nowIso: string;
  }): Promise<{
    attemptId: string;
    roundParticipant: TournamentRoundParticipantRow;
    inserted: boolean;
  }> {
    return this.db.transaction(async (tx) => {
      // Step 1: Try to insert the round_participant. If it already exists,
      // ON CONFLICT DO NOTHING returns an empty array and we fall through
      // to re-read the existing row.
      const insertedRp = await tx
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
        .onConflictDoNothing({
          target: [tournamentRoundParticipants.participantId, tournamentRoundParticipants.roundId],
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

      let roundParticipantId: string;

      if (insertedRp.length > 0) {
        // Fresh insert — no existing round participant.
        roundParticipantId = insertedRp[0].roundParticipantId;
      } else {
        // Duplicate — re-read the existing row under lock so we can
        // safely check whether an attempt already exists.
        const [existingRp] = await tx
          .select({ roundParticipantId: tournamentRoundParticipants.roundParticipantId })
          .from(tournamentRoundParticipants)
          .where(
            and(
              eq(tournamentRoundParticipants.roundId, params.roundId),
              eq(tournamentRoundParticipants.participantId, params.participantId),
            ),
          )
          .limit(1)
          .for('update');

        if (!existingRp) {
          throw new Error('Round participant not found after conflict');
        }
        roundParticipantId = existingRp.roundParticipantId;
      }

      // Step 2: Re-read the round participant under FOR UPDATE to
      // check if an attempt already exists (prevents the race between
      // this call and a concurrent `createAttemptForRound` call).
      const [rp] = await tx
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
        .where(eq(tournamentRoundParticipants.roundParticipantId, roundParticipantId))
        .limit(1)
        .for('update');

      if (rp.attemptId) {
        // Idempotent: round already has an attempt linked.
        return {
          attemptId: rp.attemptId,
          roundParticipant: rp as TournamentRoundParticipantRow,
          inserted: false,
        };
      }

      // Step 3: No existing attempt — create one and link it.
      const [createdAttempt] = await tx
        .insert(quizAttempts)
        .values({
          userId: params.userId,
          quizVersionId: params.quizVersionId,
          contextType: 'tournament',
          contextRefId: params.tournamentId,
          status: 'started',
          startedAt: params.nowIso,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning({ attemptId: quizAttempts.attemptId });

      await tx
        .update(tournamentRoundParticipants)
        .set({ attemptId: createdAttempt.attemptId, updatedAt: params.nowIso })
        .where(eq(tournamentRoundParticipants.roundParticipantId, roundParticipantId));

      const [updatedRp] = await tx
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
        .where(eq(tournamentRoundParticipants.roundParticipantId, roundParticipantId))
        .limit(1);

      return {
        attemptId: createdAttempt.attemptId,
        roundParticipant: updatedRp as TournamentRoundParticipantRow,
        inserted: insertedRp.length > 0,
      };
    });
  }

  /**
   * Phase 2 / Issues #6, #50 — atomic attempt creation with idempotency.
   *
   * Used when a round_participant row already exists but has no
   * `attemptId` linked. The service calls this after confirming
   * `existingRoundParticipant` (from a pre-Tx read) has no attempt.
   *
   * The idempotency guarantee: if two concurrent calls both reach this
   * method for the same `roundParticipantId`, the `FOR UPDATE` on the
   * round_participant row ensures only one succeeds. The winner creates
   * the attempt; the loser re-reads and returns the existing `attemptId`.
   */
  async createAttemptForRound(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    roundParticipantId: string;
    nowIso: string;
  }): Promise<{ attemptId: string }> {
    return this.db.transaction(async (tx) => {
      // Lock the round participant so concurrent callers are serialized.
      const [rp] = await tx
        .select({ attemptId: tournamentRoundParticipants.attemptId })
        .from(tournamentRoundParticipants)
        .where(eq(tournamentRoundParticipants.roundParticipantId, params.roundParticipantId))
        .limit(1)
        .for('update');

      if (!rp) {
        throw new Error('Round participant not found');
      }

      if (rp.attemptId) {
        // Idempotent — another concurrent call already created the attempt.
        return { attemptId: rp.attemptId };
      }

      // No existing attempt — create one.
      const [createdAttempt] = await tx
        .insert(quizAttempts)
        .values({
          userId: params.userId,
          quizVersionId: params.quizVersionId,
          contextType: 'tournament',
          contextRefId: params.tournamentId,
          status: 'started',
          startedAt: params.nowIso,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning({ attemptId: quizAttempts.attemptId });

      await tx
        .update(tournamentRoundParticipants)
        .set({ attemptId: createdAttempt.attemptId, updatedAt: params.nowIso })
        .where(eq(tournamentRoundParticipants.roundParticipantId, params.roundParticipantId));

      return { attemptId: createdAttempt.attemptId };
    });
  }

  // Issue #28: Added pagination to prevent unbounded responses for tournaments with many participants.
  // Issue #29: Use RANK() instead of in-memory index assignment so tied participants share ranks.
  async getLeaderboard(params: {
    tournamentId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: TournamentLeaderboardEntry[]; total: number }> {
    const totalResult = await this.db
      .select({ count: count() })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, params.tournamentId),
          or(
            eq(tournamentParticipants.status, 'active'),
            eq(tournamentParticipants.status, 'completed'),
          ),
        ),
      );

    const total = Number(totalResult[0]?.count ?? 0);

    // Use RANK() OVER to compute ranks in SQL. This handles ties correctly
    // (participants with identical totalScore and totalTimeMs share the same rank).
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
        rank: sql<number>`RANK() OVER (
          ORDER BY ${tournamentParticipants.totalScore} DESC, ${tournamentParticipants.totalTimeMs} ASC
        )`.as('rank'),
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(tournamentParticipants.tournamentId, params.tournamentId),
          or(
            eq(tournamentParticipants.status, 'active'),
            eq(tournamentParticipants.status, 'completed'),
          ),
        ),
      )
      .orderBy(desc(tournamentParticipants.totalScore), tournamentParticipants.totalTimeMs)
      .limit(params.limit)
      .offset(params.offset);

    return {
      items: rows as TournamentLeaderboardEntry[],
      total,
    };
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
      // Issue #58: Added userId ASC as tiebreaker for deterministic ordering
      // when two participants share the same rankFinal.
      .orderBy(asc(tournamentParticipants.rankFinal), asc(tournamentParticipants.userId))
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

    const result = await this.executeRaw<{
      participant_id: string;
      total_score: number;
      total_time_ms: number;
      participant_count: number;
      rank: number;
    }>(sql`
      SELECT
        tp.participant_id,
        tp.total_score,
        tp.total_time_ms,
        COUNT(*) OVER ()::int AS participant_count,
        -- Issue #30: Use RANK() instead of ROW_NUMBER() so tied participants
        -- (identical total_score and total_time_ms) share the same rank.
        -- ROW_NUMBER() gave unique sequential numbers even for ties, which
        -- was unfair and confusing for leaderboards.
        RANK() OVER (
          ORDER BY tp.total_score DESC, tp.total_time_ms ASC
        ) AS rank
      FROM tournament_participants tp
      INNER JOIN users u ON u.user_id = tp.user_id
      WHERE tp.tournament_id = ${params.tournamentId}
        AND tp.status = 'active'
        AND u.deleted_at IS NULL
      HAVING tp.participant_id = ${participant.participantId}
    `);

    const rows = result.rows;

    if (!rows.length) {
      return null;
    }

    const row = rows[0];
    const rank = Number(row.rank);
    const participantCount = Number(row.participant_count);
    const rankedBelow = participantCount - rank;
    const percentile =
      participantCount <= 1 ? 0 : Math.round((rankedBelow / participantCount) * 100);

    return {
      rank,
      score: Number(row.total_score),
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
    tx?: unknown;
  }): Promise<TournamentRow | null> {
    const client = params.tx != null ? (params.tx as DrizzleDB) : this.db;
    const [row] = await client
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
        ownerUserId: tournaments.ownerUserId,
        createdAt: tournaments.createdAt,
        updatedAt: tournaments.updatedAt,
        deletedAt: tournaments.deletedAt,
      });

    return (row as TournamentRow | undefined) ?? null;
  }

  async finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<FinalizedTournamentParticipantRow[]> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
      // Compute ranks entirely in SQL with ROW_NUMBER(). The CTE orders
      // participants by score (descending) and tie-breaks by total time
      // (ascending — faster finishes win ties), then materializes the
      // final standings. This avoids loading the full participant set
      // into application memory: only the (participantId, userId, rank)
      // tuples are streamed out, in batches of 1000.
      const totalResult = await tx.execute(sql<{ total: number | string }>`
          SELECT COUNT(*)::bigint AS total
          FROM tournament_participants tp
          INNER JOIN users u ON u.user_id = tp.user_id
          WHERE tp.tournament_id = ${params.tournamentId}::uuid
            AND tp.withdrawn_at IS NULL
            AND u.deleted_at IS NULL
        `);
      const totalParticipants = Number(
        (totalResult.rows[0] as { total?: unknown } | undefined)?.total ?? 0,
      );

      // Streaming batched UPDATE: pull (participantId, userId, rank) chunks
      // and update each batch with one statement that joins to a VALUES list.
      // A single SQL round-trip per batch instead of one per participant.
      //
      // The leaderboard ranking here is *derived* from
      // `tournament_round_participants.round_score` / `round_time_ms` sums
      // (not from the cached `tp.total_score` / `total_time_ms`), per
      // docs/plans/denormalized-counters-audit.md — Fix #1. This guarantees
      // the leaderboard is correct even if the cached counters ever drift.
      const BATCH_SIZE = 1000;
      let offset = 0;

      while (true) {
        const batch = await tx.execute(
          sql<{ participantId: string; userId: string; rank: number | string }>`
              WITH round_totals AS (
                SELECT
                  trp.participant_id,
                  SUM(trp.round_score)::int   AS total_score,
                  SUM(trp.round_time_ms)::int AS total_time_ms
                FROM tournament_round_participants trp
                GROUP BY trp.participant_id
              ),
              ranked AS (
                SELECT
                  tp.participant_id as "participantId",
                  tp.user_id as "userId",
                  ROW_NUMBER() OVER (
                    ORDER BY
                      COALESCE(rt.total_score,   0) DESC,
                      COALESCE(rt.total_time_ms, 0) ASC,
                      tp.participant_id ASC
                  )::int as rank
                FROM tournament_participants tp
                INNER JOIN users u ON u.user_id = tp.user_id
                LEFT JOIN round_totals rt ON rt.participant_id = tp.participant_id
                WHERE tp.tournament_id = ${params.tournamentId}::uuid
                  AND tp.withdrawn_at IS NULL
                  AND u.deleted_at IS NULL
              )
              SELECT "participantId", "userId", rank
              FROM ranked
              ORDER BY rank
              LIMIT ${BATCH_SIZE} OFFSET ${offset}
            `,
        );

        const rows = batch.rows as Array<{
          participantId: string;
          userId: string;
          rank: number | string;
        }>;
        if (rows.length === 0) break;

        // Build a single UPDATE … FROM (VALUES …) statement per batch.
        // This issues exactly one round-trip for the whole batch and
        // touches only the rows in this chunk.
        const valuesSql = sql.join(
          rows.map((r) => sql`(${r.participantId}::uuid, ${Number(r.rank)}::int)`),
          sql`, `,
        );

        await tx.execute(sql`
            UPDATE tournament_participants AS tp
            SET
              rank_final = v.rank,
              status = 'completed',
              updated_at = ${params.nowIso}::timestamptz
            FROM (VALUES ${valuesSql}) AS v(participant_id, rank)
            WHERE tp.participant_id = v.participant_id
          `);

        if (rows.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }

      await this.refreshTournamentStats(params.tournamentId, tx);

      // Return the final standings in rank order. This is the only place
      // we materialize the full result set, and it's bounded by the
      // number of participants in this tournament (necessary because
      // the API contract returns the full standings list).
      //
      // Same projection rationale as above: derive ordering from
      // `tournament_round_participants` so the result is correct even if
      // the cached totals on `tournament_participants` drift.
      const finalStandings = await tx.execute(
        sql<{ userId: string; rank: number | string }>`
            WITH round_totals AS (
              SELECT
                trp.participant_id,
                SUM(trp.round_score)::int   AS total_score,
                SUM(trp.round_time_ms)::int AS total_time_ms
              FROM tournament_round_participants trp
              GROUP BY trp.participant_id
            ),
            ranked AS (
              SELECT
                tp.user_id as "userId",
                ROW_NUMBER() OVER (
                  ORDER BY
                    COALESCE(rt.total_score,   0) DESC,
                    COALESCE(rt.total_time_ms, 0) ASC,
                    tp.participant_id ASC
                )::int as rank
              FROM tournament_participants tp
              INNER JOIN users u ON u.user_id = tp.user_id
              LEFT JOIN round_totals rt ON rt.participant_id = tp.participant_id
              WHERE tp.tournament_id = ${params.tournamentId}::uuid
                AND tp.withdrawn_at IS NULL
                AND u.deleted_at IS NULL
            )
            SELECT "userId", rank
            FROM ranked
            ORDER BY rank
          `,
      );

      return (finalStandings.rows as Array<{ userId: string; rank: number | string }>).map(
        (row) => ({
          userId: row.userId,
          rank: Number(row.rank),
          totalParticipants,
        }),
      );
    });
  }

  async recalculateParticipantTotals(participantId: string, tx?: unknown): Promise<void> {
    // Single-statement projection of `tournament_round_participants` onto the
    // denormalized totals on `tournament_participants`. Widen the stored
    // rounding of SUMs to int to match the schema's `integer` columns. The
    // `NOW()` set on updated_at is intentional — totals drift recovery is
    // itself a "real" write from the application's POV.
    const upsertTotals = async (client: unknown): Promise<void> => {
      await (client as DrizzleDB).execute(sql`
        UPDATE tournament_participants AS tp
        SET
          total_score   = agg.total_score,
          total_time_ms = agg.total_time_ms,
          updated_at    = NOW()
        FROM (
          SELECT
            ${participantId}::uuid AS participant_id,
            COALESCE(SUM(round_score),   0)::int AS total_score,
            COALESCE(SUM(round_time_ms), 0)::int AS total_time_ms
          FROM tournament_round_participants
          WHERE participant_id = ${participantId}::uuid
        ) AS agg
        WHERE tp.participant_id = ${participantId}::uuid
          AND (
            tp.total_score   IS DISTINCT FROM agg.total_score
            OR tp.total_time_ms IS DISTINCT FROM agg.total_time_ms
          );
      `);
    };

    if (tx) {
      await upsertTotals(tx);
      return;
    }

    await this.db.transaction(async (inner) => {
      await upsertTotals(inner);
    });
  }

  /**
   * Reconciliation variant of `recalculateParticipantTotals` intended for the
   * daily cron (see `TournamentSchedulerService`).
   *
   * Re-applies the same two-pass UPDATE as the 0008 migration:
   *
   *   1. For every participant with at least one round participant, set
   *      totals to SUM(round_score) / SUM(round_time_ms). WHERE filters out
   *      rows that already match.
   *   2. For every participant with zero round participants that still
   *      carries a non-zero denormalized counter, zero the counters.
   *
   * Idempotent. Returns the number of rows reconciled for logging.
   */
  async reconcileAllParticipantTotals(): Promise<{ updated: number }> {
    const result = await this.executeRaw<{ updated: number | string }>(sql`
      WITH before_totals AS (
        SELECT tp.participant_id, tp.total_score, tp.total_time_ms
        FROM tournament_participants tp
      ),
      agg AS (
        SELECT
          trp.participant_id,
          COALESCE(SUM(trp.round_score),   0)::int AS total_score,
          COALESCE(SUM(trp.round_time_ms), 0)::int AS total_time_ms
        FROM tournament_round_participants trp
        GROUP BY trp.participant_id
      ),
      drift_pass AS (
        UPDATE tournament_participants AS tp
        SET total_score   = agg.total_score,
            total_time_ms = agg.total_time_ms,
            updated_at    = NOW()
        FROM agg
        WHERE tp.participant_id = agg.participant_id
          AND (
            tp.total_score   IS DISTINCT FROM agg.total_score
            OR tp.total_time_ms IS DISTINCT FROM agg.total_time_ms
          )
        RETURNING 1
      ),
      zero_pass AS (
        UPDATE tournament_participants AS tp
        SET total_score   = 0,
            total_time_ms = 0,
            updated_at    = NOW()
        WHERE (tp.total_score <> 0 OR tp.total_time_ms <> 0)
          AND NOT EXISTS (
            SELECT 1 FROM tournament_round_participants trp
            WHERE trp.participant_id = tp.participant_id
          )
        RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM drift_pass)::int
           + (SELECT COUNT(*) FROM zero_pass)::int AS updated;
    `);

    const updatedRaw = (result.rows[0] as { updated?: unknown } | undefined)?.updated;
    return { updated: Number(updatedRaw ?? 0) };
  }
}
