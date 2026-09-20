import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournaments, tournamentParticipants, categories } from '@/core/database/schema';
import type {
  TournamentDifficulty,
  TournamentStatus,
} from '@/modules/tournament/types/tournament.types';
import type {
  TournamentRow,
  TournamentDetailRow,
  TournamentListFilters,
  TournamentCursorPayload,
  UpcomingTournamentRow,
  ActiveTournamentRow,
  CompletedTournamentRow,
  RelatedTournamentRow,
} from '@/modules/tournament/domain/ports';

/**
 * CRUD aggregate — owns all read/write operations on the `tournaments` table
 * plus any method that is exclusively a tournament-scoped read (no cross-table
 * mutation).
 */
@Injectable()
export class TournamentCrudRepository {
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
    const conditions = and(
      isNull(tournaments.deletedAt),
      eq(tournaments.status, 'upcoming'),
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
      .limit(params.limit * 2);

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
        ownerUserId: params.ownerUserId,
        status: 'upcoming',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({ tournamentId: tournaments.tournamentId });

    return { tournamentId: result.tournamentId };
  }

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

  async cancelTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    const [existing] = await this.db
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
      .where(and(eq(tournaments.tournamentId, params.tournamentId), isNull(tournaments.deletedAt)))
      .limit(1);

    if (!existing) {
      return null;
    }

    if (existing.status === 'cancelled') {
      return existing as TournamentRow;
    }

    if (existing.status === 'finished') {
      return null;
    }

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

  async listTournamentsStartingPlay(params: { nowIso: string }): Promise<TournamentRow[]> {
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
      .where(
        and(
          isNull(tournaments.deletedAt),
          eq(tournaments.status, 'registration' as TournamentStatus),
          sql`${tournaments.startAt} <= ${params.nowIso}`,
        ),
      )
      .orderBy(asc(tournaments.startAt), asc(tournaments.tournamentId));

    return rows as TournamentRow[];
  }
}
