import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { tournamentRoundParticipants, quizAttempts } from '@/core/database/schema';
import type { TournamentRoundParticipantRow } from '@/modules/tournament/domain/ports';

/**
 * Round-participant aggregate — owns all read/write operations on the
 * `tournament_round_participants` table plus the quiz-attempt creation
 * methods (`startRoundAttemptTx`, `createAttemptForRound`).
 */
@Injectable()
export class TournamentRoundParticipantRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

  // Atomically inserts the round_participant row (with `ON CONFLICT DO NOTHING` for idempotency), then creates the quiz_attempt and links it back.
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
        roundParticipantId = insertedRp[0].roundParticipantId;
      } else {
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
        return {
          attemptId: rp.attemptId,
          roundParticipant: rp as TournamentRoundParticipantRow,
          inserted: false,
        };
      }

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
  async createAttemptForRound(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    roundParticipantId: string;
    nowIso: string;
  }): Promise<{ attemptId: string }> {
    return this.db.transaction(async (tx) => {
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
        return { attemptId: rp.attemptId };
      }

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
}
