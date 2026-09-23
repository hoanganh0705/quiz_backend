import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournaments, tournamentRounds, quizVersions } from '@/core/database/schema';
import { notDeleted } from '@/common/database/soft-delete.helper';
import type {
  TournamentRoundStatus,
  TournamentStatus,
} from '@/modules/tournament/types/tournament.types';
import type {
  TournamentRoundRow,
  TournamentRoundDetailRow,
} from '@/modules/tournament/domain/ports';

/**
 * Round aggregate — owns all read/write operations on the `tournament_rounds` table
 * plus the round-scoped lifecycle queries (`listDueRoundOpens`, `listDueRoundCloses`).
 */
@Injectable()
export class TournamentRoundRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

  async createRound(params: {
    tournamentId: string;
    name: string;
    description: string | null;
    quizVersionId: string;
    startAt: string | null;
    endAt: string | null;
    durationMs: number | null;
    isElimination: boolean;
    participantLimit: number | null;
    nowIso: string;
  }): Promise<TournamentRoundRow> {
    return this.db.transaction(async (tx) => {
      const [tournament] = await tx
        .select({ tournamentId: tournaments.tournamentId })
        .from(tournaments)
        .where(eq(tournaments.tournamentId, params.tournamentId))
        .limit(1)
        .for('update');

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const [maxRow] = await tx
        .select({ maxRound: sql<number | null>`MAX(${tournamentRounds.roundNumber})` })
        .from(tournamentRounds)
        .where(eq(tournamentRounds.tournamentId, params.tournamentId));
      const roundNumber = (maxRow?.maxRound ?? 0) + 1;

      const [row] = await tx
        .insert(tournamentRounds)
        .values({
          tournamentId: params.tournamentId,
          roundNumber,
          name: params.name,
          description: params.description,
          quizVersionId: params.quizVersionId,
          startAt: params.startAt,
          endAt: params.endAt,
          durationMs: params.durationMs,
          status: 'pending',
          isElimination: params.isElimination,
          participantLimit: params.participantLimit,
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning({
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
        });

      return row as TournamentRoundRow;
    });
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

    const row = result[0];
    if (!row) {
      return null;
    }
    return {
      ...row,
      durationMs: row.durationMs ?? 0,
    } as TournamentRoundDetailRow;
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

  async markRoundStatus(params: {
    roundId: string;
    fromStatus: TournamentRoundStatus;
    toStatus: TournamentRoundStatus;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentRoundRow | null> {
    const client = params.tx != null ? (params.tx as DrizzleDB) : this.db;
    const [row] = await client
      .update(tournamentRounds)
      .set({
        status: params.toStatus,
        updatedAt: params.nowIso,
      })
      .where(
        and(
          eq(tournamentRounds.roundId, params.roundId),
          eq(tournamentRounds.status, params.fromStatus),
        ),
      )
      .returning({
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
      });

    return (row as TournamentRoundRow | undefined) ?? null;
  }

  /**
   * Round lifecycle — list rounds whose `start_at` is at or before `nowIso`
   * AND whose parent tournament is currently `ongoing`. Pagination is
   * page/limit so the caller can loop until empty.
   *
   * Returns the page of `TournamentRoundRow` items in
   * `start_at ASC, round_id ASC` order.
   */
  async listDueRoundOpens(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      eq(tournamentRounds.status, 'pending' as TournamentRoundStatus),
      sql`${tournamentRounds.startAt} IS NOT NULL`,
      sql`${tournamentRounds.startAt} <= ${params.nowIso}`,
      eq(tournaments.status, 'ongoing' as TournamentStatus),
      notDeleted(tournaments.deletedAt),
    );

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(tournamentRounds)
      .innerJoin(tournaments, eq(tournamentRounds.tournamentId, tournaments.tournamentId))
      .where(conditions);

    const items = await this.db
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
      .innerJoin(tournaments, eq(tournamentRounds.tournamentId, tournaments.tournamentId))
      .where(conditions)
      .orderBy(asc(tournamentRounds.startAt), asc(tournamentRounds.roundId))
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as TournamentRoundRow[],
      total: totalRow?.count ?? 0,
    };
  }

  /**
   * Round lifecycle — list rounds whose `end_at` is at or before `nowIso`.
   * The parent tournament's status is intentionally not constrained.
   *
   * Returns the page of `TournamentRoundRow` items in
   * `end_at ASC, round_id ASC` order.
   */
  async listDueRoundCloses(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      eq(tournamentRounds.status, 'open' as TournamentRoundStatus),
      sql`${tournamentRounds.endAt} IS NOT NULL`,
      sql`${tournamentRounds.endAt} <= ${params.nowIso}`,
    );

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(tournamentRounds)
      .where(conditions);

    const items = await this.db
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
      .where(conditions)
      .orderBy(asc(tournamentRounds.endAt), asc(tournamentRounds.roundId))
      .limit(params.limit)
      .offset(offset);

    return {
      items: items as TournamentRoundRow[],
      total: totalRow?.count ?? 0,
    };
  }
}
