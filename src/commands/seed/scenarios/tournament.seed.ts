import { and, eq, sql } from 'drizzle-orm';
import { db, type SeedContext, type SeedTx, recorder } from '../infrastructure';
import type { TournamentSeed, SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  quizVersions,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const TOURNAMENT_SEEDS: TournamentSeed[] = [
  // ── Upcoming tournament (registration open) ────────────────────────────────
  {
    title: 'Weekly Challenge: Algorithms',
    description: 'Test your algorithmic thinking with our weekly challenge.',
    difficulty: 'hard',
    status: 'registration',
    prize: '500 XP + Champion Badge',
    startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),   // 1 week + 1 day
    maxParticipants: 50,
    categorySlug: 'technology',
    quizSlugs: ['algorithms-advanced'],
  },

  // ── Ongoing tournament ──────────────────────────────────────────────────────
  {
    title: 'Monthly JavaScript Showdown',
    description: 'Monthly competition for JavaScript enthusiasts.',
    difficulty: 'medium',
    status: 'ongoing',
    prize: '1000 XP + Expert Badge',
    startAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),   // 2 days from now
    maxParticipants: 100,
    categorySlug: 'technology',
    quizSlugs: ['javascript-fundamentals'],
  },

  // ── Finished tournament with leaderboard ────────────────────────────────────
  {
    title: 'April System Design Cup',
    description: 'The inaugural system design tournament.',
    difficulty: 'medium',
    status: 'finished',
    prize: '2000 XP + Champion Badge',
    startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    endAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),   // 23 days ago
    maxParticipants: 200,
    categorySlug: 'technology',
    quizSlugs: ['system-design-v2'],
  },
];

export { TOURNAMENT_SEEDS };

export const runTournamentSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    for (const tournament of TOURNAMENT_SEEDS) {
      await logger.group(`Tournament: ${tournament.title}`, async () => {
        let categoryId: string | null = null;
        if (tournament.categorySlug) {
          categoryId = await lookup.categoryIdBySlug(tournament.categorySlug);
        }

        // Create or find tournament by title (unique-ish identifier in schema)
        const [existing] = await tx
          .select({ tournamentId: tournaments.tournamentId })
          .from(tournaments)
          .where(eq(tournaments.title, tournament.title))
          .limit(1);

        let tournamentId: string;

        if (existing) {
          tournamentId = existing.tournamentId;

          recorder.record({
            kind: 'Tournaments',
            id: tournament.title,
            fields: {
              title: tournament.title,
              status: tournament.status,
              difficulty: tournament.difficulty,
              startAt: tournament.startAt,
              endAt: tournament.endAt,
              rounds: String(tournament.quizSlugs.length),
              quizzes: tournament.quizSlugs.join(', '),
              category: tournament.categorySlug ?? '',
            },
            details: {
              tournamentId: existing.tournamentId,
              title: tournament.title,
              description: tournament.description,
              difficulty: tournament.difficulty,
              status: tournament.status,
              prize: tournament.prize,
              startAt: tournament.startAt,
              endAt: tournament.endAt,
              maxParticipants: tournament.maxParticipants,
              categoryId: categoryId ?? existing.tournamentId.slice(0, 8),
              categorySlug: tournament.categorySlug,
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            },
          });
        } else {
          // Phase 1 / Issue #2 — every tournament must have an
          // owner. Seed tournaments are attributed to the platform
          // admin so the owner-based authorization policy has a
          // real human UUID to compare against when editing seed
          // data through the new admin endpoints.
          const ownerUserId = await lookup.userIdByUsername('admin_master');

          const [created] = await tx
            .insert(tournaments)
            .values({
              title: tournament.title,
              description: tournament.description,
              difficulty: tournament.difficulty,
              status: tournament.status,
              prize: tournament.prize,
              startAt: tournament.startAt,
              endAt: tournament.endAt,
              maxParticipants: tournament.maxParticipants,
              categoryId,
              ownerUserId,
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            })
            .returning({ tournamentId: tournaments.tournamentId });

          tournamentId = created.tournamentId;
          logger.info(`Created tournament: ${tournament.title}`);

          recorder.record({
            kind: 'Tournaments',
            id: tournament.title,
            fields: {
              title: tournament.title,
              status: tournament.status,
              difficulty: tournament.difficulty,
              startAt: tournament.startAt,
              endAt: tournament.endAt,
              rounds: String(tournament.quizSlugs.length),
              quizzes: tournament.quizSlugs.join(', '),
              category: tournament.categorySlug ?? '',
            },
            details: {
              tournamentId: created.tournamentId,
              title: tournament.title,
              description: tournament.description,
              difficulty: tournament.difficulty,
              status: tournament.status,
              prize: tournament.prize,
              startAt: tournament.startAt,
              endAt: tournament.endAt,
              maxParticipants: tournament.maxParticipants,
              categoryId,
              categorySlug: tournament.categorySlug,
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            },
          });
        }

        // Create rounds for each quiz version used in this tournament
        const createdRoundIds: string[] = [];
        let roundNumber = 1;
        for (const quizSlug of tournament.quizSlugs) {
          const quizVersionId = await lookup.publishedVersionIdByQuizSlug(quizSlug);
          if (!quizVersionId) {
            logger.warn(`No published version for quiz "${quizSlug}", skipping round`);
            continue;
          }

          const [existingRound] = await tx
            .select({ roundId: tournamentRounds.roundId })
            .from(tournamentRounds)
            .where(
              sql`${tournamentRounds.tournamentId} = ${tournamentId} AND ${tournamentRounds.roundNumber} = ${roundNumber}`,
            )
            .limit(1);

          let roundId: string;
          if (!existingRound) {
            const [createdRound] = await tx
              .insert(tournamentRounds)
              .values({
                tournamentId,
                roundNumber,
                name: `Round ${roundNumber}: ${quizSlug}`,
                description: `Quiz: ${quizSlug}`,
                quizVersionId,
                status: tournament.status === 'finished' ? 'finished'
                  : tournament.status === 'ongoing' ? 'open'
                  : 'pending',
                isElimination: false,
                participantLimit: null,
                createdAt: ctx.nowIso,
                updatedAt: ctx.nowIso,
              })
              .returning({ roundId: tournamentRounds.roundId });
            roundId = createdRound.roundId;
            createdRoundIds.push(roundId);
            logger.info(`Created round ${roundNumber} using ${quizSlug} (published version)`);
          } else {
            roundId = existingRound.roundId;
            createdRoundIds.push(roundId);
          }

          recorder.record({
            kind: 'Tournament Rounds',
            id: `${tournament.title}:round${roundNumber}`,
            fields: {
              tournament: tournament.title,
              round: String(roundNumber),
              name: `Round ${roundNumber}: ${quizSlug}`,
              quizSlug,
              status: tournament.status === 'finished' ? 'finished'
                : tournament.status === 'ongoing' ? 'open'
                : 'pending',
            },
            details: {
              roundId,
              tournamentId,
              roundNumber,
              name: `Round ${roundNumber}: ${quizSlug}`,
              description: `Quiz: ${quizSlug}`,
              quizVersionId,
              status: tournament.status === 'finished' ? 'finished'
                : tournament.status === 'ongoing' ? 'open'
                : 'pending',
              isElimination: false,
              participantLimit: null,
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            },
          });

          roundNumber++;
        }

        // Seed leaderboard data for the finished tournament
        if (tournament.status === 'finished') {
          const leaderboardData = [
            { username: 'power_user', score: 250, timeMs: 540_000 },
            { username: 'learner_user', score: 200, timeMs: 610_000 },
          ];

          for (const entry of leaderboardData) {
            const userId = await lookup.userIdByUsername(entry.username);

            const [existingParticipant] = await tx
              .select({ participantId: tournamentParticipants.participantId })
              .from(tournamentParticipants)
              .where(
                and(
                  eq(tournamentParticipants.tournamentId, tournamentId),
                  eq(tournamentParticipants.userId, userId),
                ),
              )
              .limit(1);

            let participantId: string;
            if (existingParticipant) {
              await tx
                .update(tournamentParticipants)
                .set({
                  totalScore: entry.score,
                  totalTimeMs: entry.timeMs,
                  rankFinal: leaderboardData.indexOf(entry) + 1,
                  updatedAt: ctx.nowIso,
                })
                .where(eq(tournamentParticipants.participantId, existingParticipant.participantId));
              participantId = existingParticipant.participantId;
            } else {
              const [createdParticipant] = await tx
                .insert(tournamentParticipants)
                .values({
                  tournamentId,
                  userId,
                  registeredAt: tournament.startAt,
                  totalScore: entry.score,
                  totalTimeMs: entry.timeMs,
                  rankFinal: leaderboardData.indexOf(entry) + 1,
                  status: 'active',
                  updatedAt: ctx.nowIso,
                })
                .returning({ participantId: tournamentParticipants.participantId });
              participantId = createdParticipant.participantId;
            }

            logger.info(`Leaderboard: ${entry.username} score=${entry.score} rank=${leaderboardData.indexOf(entry) + 1}`);

            recorder.record({
              kind: 'Tournament Participants',
              id: `${tournament.title}:${entry.username}`,
              fields: {
                tournament: tournament.title,
                username: entry.username,
                score: String(entry.score),
                timeMs: String(entry.timeMs),
                rank: String(leaderboardData.indexOf(entry) + 1),
                status: 'active',
              },
              details: {
                participantId,
                tournamentId,
                userId,
                username: entry.username,
                registeredAt: tournament.startAt,
                totalScore: entry.score,
                totalTimeMs: entry.timeMs,
                rankFinal: leaderboardData.indexOf(entry) + 1,
                status: 'active',
                updatedAt: ctx.nowIso,
              },
            });
          }
        }
      });

      summaries.push({ domain: `tournament:${tournament.title}`, inserted: 1, updated: 0, skipped: 0 });
    }
  });

  return summaries;
};
