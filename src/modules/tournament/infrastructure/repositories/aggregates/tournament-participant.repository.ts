import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, isNull, or, sql } from 'drizzle-orm';
import { notDeleted } from '@/common/database/soft-delete.helper';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournaments, tournamentParticipants, users, userProfiles } from '@/core/database/schema';
import type { TournamentParticipantStatus } from '@/modules/tournament/types/tournament.types';
import type {
  TournamentParticipantRow,
  TournamentParticipantListItemRow,
  TournamentLeaderboardEntry,
  TournamentStandingRow,
  TournamentWinnerRow,
} from '@/modules/tournament/domain/ports';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

/**
 * Participant aggregate — owns all read/write operations on the
 * `tournament_participants` table plus leaderboard and standing queries
 * that are primarily participant-scoped.
 */
@Injectable()
export class TournamentParticipantRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
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

  // Wraps the full read-check-insert sequence inside a single transaction with a row-level lock on the tournament so the capacity check is always consistent. Uses `INSERT … ON CONFLICT DO NOTHING` to safely handle the case where two concurrent requests both find no existing participant and both try to insert — the second receives zero rows back and the method falls through to a re-read.
  async atomicRegister(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<{ participant: TournamentParticipantRow; inserted: boolean; reactivated: boolean }> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
      const [tournament] = await tx
        .select({
          tournamentId: tournaments.tournamentId,
          maxParticipants: tournaments.maxParticipants,
          status: tournaments.status,
        })
        .from(tournaments)
        .where(
          and(eq(tournaments.tournamentId, params.tournamentId), notDeleted(tournaments.deletedAt)),
        )
        .limit(1)
        .for('update');

      if (!tournament) {
        throw new Error('Tournament not found');
      }

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
          reactivated: false,
        };
      }

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

      if (existing.status === 'completed') {
        throw new Error('TOURNAMENT_PARTICIPANT_STATE:completed');
      }

      if (existing.status === 'withdrawn') {
        const [reactivated] = await tx
          .update(tournamentParticipants)
          .set({
            status: 'active' as TournamentParticipantStatus,
            withdrawnAt: null,
            updatedAt: params.nowIso,
          })
          .where(eq(tournamentParticipants.participantId, existing.participantId))
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

        return {
          participant: reactivated as TournamentParticipantRow,
          inserted: false,
          reactivated: true,
        };
      }

      return {
        participant: existing as TournamentParticipantRow,
        inserted: false,
        reactivated: false,
      };
    });
  }

  // Locks the tournament row with `SELECT … FOR UPDATE`, then conditionally updates the participant to `status='withdrawn'` only when they are currently `active`. This prevents the TOCTOU race described in the port interface.
  async atomicWithdraw(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentParticipantRow | null> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
      const [tournament] = await tx
        .select({ tournamentId: tournaments.tournamentId })
        .from(tournaments)
        .where(
          and(eq(tournaments.tournamentId, params.tournamentId), notDeleted(tournaments.deletedAt)),
        )
        .limit(1)
        .for('update');

      if (!tournament) {
        return null;
      }

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

  async listParticipants(params: {
    tournamentId: string;
    page: number;
    limit: number;
  }): Promise<{ items: TournamentParticipantListItemRow[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions = and(
      eq(tournamentParticipants.tournamentId, params.tournamentId),
      eq(tournamentParticipants.status, 'active'),
      notDeleted(users.deletedAt),
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
        sql`${tournamentParticipants.registeredAt} DESC`,
        sql`${tournamentParticipants.participantId} DESC`,
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
    participantId?: string;
  }): Promise<TournamentStandingRow | null> {
    const participantId =
      params.participantId ??
      (await this.getParticipantByUserAndTournament(params.userId, params.tournamentId))
        ?.participantId;

    if (!participantId) {
      return null;
    }

    const result = await this.executeRaw<{
      participant_id: string;
      total_score: number;
      total_time_ms: number;
      participant_count: number;
      rank: number;
    }>(sql`
      WITH ranked_participants AS (
        SELECT
          tp.participant_id,
          tp.total_score,
          tp.total_time_ms,
          COUNT(*) OVER ()::int AS participant_count,
          RANK() OVER (
            ORDER BY tp.total_score DESC, tp.total_time_ms ASC
          ) AS rank
        FROM tournament_participants tp
        INNER JOIN users u ON u.user_id = tp.user_id
        WHERE tp.tournament_id = ${params.tournamentId}
          AND tp.status = 'active'
          AND u.deleted_at IS NULL
      )
      SELECT
        participant_id,
        total_score,
        total_time_ms,
        participant_count,
        rank
      FROM ranked_participants
      WHERE participant_id = ${participantId}
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

  // Pagination to prevent unbounded responses for tournaments with many participants.
  // Use RANK() instead of in-memory index assignment so tied participants share ranks.
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
      .orderBy(
        sql`${tournamentParticipants.totalScore} DESC`,
        sql`${tournamentParticipants.totalTimeMs} ASC`,
      )
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
          sql`${tournamentParticipants.rankFinal} is not null`,
          notDeleted(users.deletedAt),
        ),
      )
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

  async recalculateParticipantTotals(participantId: string, tx?: unknown): Promise<void> {
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
   * Bulk variant of `recalculateParticipantTotals` that re-runs the same
   * two-pass UPDATE as the 0008 migration, across every tournament
   * participant. Intended for the daily cron.
   *
   * Returns the number of participant rows whose totals changed.
   */
  async reconcileAllParticipantTotals(): Promise<{ updated: number }> {
    const result = await this.executeRaw<{ updated: number | string }>(sql`
      WITH recent_active AS (
        SELECT tp.participant_id
        FROM tournament_participants tp
        WHERE tp.updated_at > NOW() - INTERVAL '7 days'
      ),
      before_totals AS (
        SELECT tp.participant_id, tp.total_score, tp.total_time_ms
        FROM tournament_participants tp
        INNER JOIN recent_active ra ON ra.participant_id = tp.participant_id
      ),
      agg AS (
        SELECT
          trp.participant_id,
          COALESCE(SUM(trp.round_score),   0)::int AS total_score,
          COALESCE(SUM(trp.round_time_ms), 0)::int AS total_time_ms
        FROM tournament_round_participants trp
        INNER JOIN recent_active ra ON ra.participant_id = trp.participant_id
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
          AND tp.updated_at > NOW() - INTERVAL '7 days'
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
