import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { notDeleted } from '@/common/database/soft-delete.helper';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournaments, tournamentParticipants, tournamentStats } from '@/core/database/schema';
import type {
  FinalizedTournamentParticipantRow,
  TournamentStatsRow,
} from '@/modules/tournament/domain/ports';

/**
 * Stats aggregate — owns all read/write operations on the `tournament_stats`
 * table plus the heavy finalization logic (`finalizeTournament`) which
 * combines batched participant ranking with stats refresh inside one transaction.
 */
@Injectable()
export class TournamentStatsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
      .where(and(eq(tournamentStats.tournamentId, tournamentId), notDeleted(tournaments.deletedAt)))
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
      .where(and(eq(tournaments.tournamentId, tournamentId), notDeleted(tournaments.deletedAt)))
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

  /**
   * Refreshes the `tournament_stats` aggregate from live
   * `tournament_participants` data. Used by `finalizeTournament`
   * inside the same transaction.
   */
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

  async finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<FinalizedTournamentParticipantRow[]> {
    return (params.tx != null ? (params.tx as DrizzleDB) : this.db).transaction(async (tx) => {
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

      const roundTotalsResult = await tx.execute(
        sql<{
          participant_id: string;
          total_score: number | string;
          total_time_ms: number | string;
        }>`
          SELECT
            trp.participant_id,
            SUM(trp.round_score)::int   AS total_score,
            SUM(trp.round_time_ms)::int AS total_time_ms
          FROM tournament_round_participants trp
          WHERE trp.participant_id IN (
            SELECT tp.participant_id
            FROM tournament_participants tp
            INNER JOIN users u ON u.user_id = tp.user_id
            WHERE tp.tournament_id = ${params.tournamentId}::uuid
              AND tp.withdrawn_at IS NULL
              AND u.deleted_at IS NULL
          )
          GROUP BY trp.participant_id
        `,
      );

      const roundTotals = new Map<string, { total_score: number; total_time_ms: number }>();
      for (const row of roundTotalsResult.rows) {
        roundTotals.set(row.participant_id, {
          total_score: Number(row.total_score),
          total_time_ms: Number(row.total_time_ms),
        });
      }

      const rankedResult = await tx.execute(
        sql<{ participant_id: string; user_id: string; rank: number | string }>`
          SELECT
            tp.participant_id,
            tp.user_id,
            ROW_NUMBER() OVER (
              ORDER BY
                COALESCE(rt.total_score,   0) DESC,
                COALESCE(rt.total_time_ms, 0) ASC,
                tp.participant_id ASC
            )::int AS rank
          FROM tournament_participants tp
          INNER JOIN users u ON u.user_id = tp.user_id
          LEFT JOIN (
            SELECT
              trp.participant_id,
              SUM(trp.round_score)::int   AS total_score,
              SUM(trp.round_time_ms)::int AS total_time_ms
            FROM tournament_round_participants trp
            WHERE trp.participant_id IN (
              SELECT tp2.participant_id
              FROM tournament_participants tp2
              INNER JOIN users u2 ON u2.user_id = tp2.user_id
              WHERE tp2.tournament_id = ${params.tournamentId}::uuid
                AND tp2.withdrawn_at IS NULL
                AND u2.deleted_at IS NULL
            )
            GROUP BY trp.participant_id
          ) rt ON rt.participant_id = tp.participant_id
          WHERE tp.tournament_id = ${params.tournamentId}::uuid
            AND tp.withdrawn_at IS NULL
            AND u.deleted_at IS NULL
          ORDER BY rank
        `,
      );

      const ranked = rankedResult.rows as Array<{
        participant_id: string;
        user_id: string;
        rank: number | string;
      }>;

      const BATCH_SIZE = 1000;
      for (let i = 0; i < ranked.length; i += BATCH_SIZE) {
        const batch = ranked.slice(i, i + BATCH_SIZE);
        const valuesSql = sql.join(
          batch.map((r) => sql`(${r.participant_id}::uuid, ${Number(r.rank)}::int)`),
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
      }

      await this.refreshTournamentStats(params.tournamentId, tx);

      const finalStandings = ranked.map((row) => ({
        userId: row.user_id,
        rank: Number(row.rank),
        totalParticipants,
      }));

      return finalStandings;
    });
  }
}
