import { eq } from 'drizzle-orm';
import { db, type SeedContext, recorder } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  rankHistory,
  rankingMilestones,
  userRanking,
  users,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

type RankingPeriodSeed = 'daily' | 'weekly' | 'monthly' | 'all_time';
type RankingMilestoneSeed =
  | 'TOP_10000'
  | 'TOP_1000'
  | 'TOP_100'
  | 'TOP_50'
  | 'TOP_10'
  | 'TOP_3'
  | 'TOP_1';

type RankHistorySeed = {
  historyId: string;
  period: RankingPeriodSeed;
  snapshotDate: string;
  rank: number;
  xp: number;
};

type RankingMilestoneRowSeed = {
  id: string;
  milestone: RankingMilestoneSeed;
  rank: number;
  achievedAt: string;
};

type UserRankingSeed = {
  username: string;
  allTimeXp: number;
  weeklyXp: number;
  monthlyXp: number;
  dailyXp: number;
  allTimeRank: number;
  weeklyRank: number;
  monthlyRank: number;
  dailyRank: number;
  peakAllTimeRank: number;
  peakWeeklyRank: number;
  peakMonthlyRank: number;
  peakDailyRank: number;
  peakAchievedAt: string;
  lastActivityAt: string;
  history: RankHistorySeed[];
  milestones: RankingMilestoneRowSeed[];
};

// Per Phase 10 audit: `user_ranking` is ✅ REQUIRED SEED because
// GET /users/me/ranking and GET /leaderboard/me return null gracefully but
// cannot be exercised end-to-end without a per-user row. Every seed user
// gets one (active users get real XP/rank values; admin and moderator get
// rank entries with 0 XP). `rank_history` and `ranking_milestones` are
// ⚠ OPTIONAL — only seeded for the active users.
// See `PHASE_10_EVIDENCE_REPORT.md` → "Ranking domain" for the full
// classification rationale.
const USER_RANKING_SEEDS: UserRankingSeed[] = [
  {
    username: 'power_user',
    allTimeXp: 350,
    weeklyXp: 250,
    monthlyXp: 350,
    dailyXp: 150,
    allTimeRank: 1,
    weeklyRank: 1,
    monthlyRank: 1,
    dailyRank: 1,
    peakAllTimeRank: 1,
    peakWeeklyRank: 1,
    peakMonthlyRank: 1,
    peakDailyRank: 1,
    peakAchievedAt: '2026-06-30T10:00:00.000Z',
    lastActivityAt: '2026-06-30T10:00:00.000Z',
    history: [
      {
        historyId: '31111111-1111-7111-8111-111111111111',
        period: 'weekly',
        snapshotDate: '2026-06-23T00:00:00.000Z',
        rank: 2,
        xp: 180,
      },
      {
        historyId: '31111111-1111-7111-8111-111111111112',
        period: 'monthly',
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 1,
        xp: 350,
      },
    ],
    milestones: [
      {
        id: '41111111-1111-7111-8111-111111111111',
        milestone: 'TOP_10',
        rank: 1,
        achievedAt: '2026-06-30T10:00:00.000Z',
      },
      {
        id: '41111111-1111-7111-8111-111111111112',
        milestone: 'TOP_3',
        rank: 1,
        achievedAt: '2026-06-30T10:00:00.000Z',
      },
      {
        id: '41111111-1111-7111-8111-111111111113',
        milestone: 'TOP_1',
        rank: 1,
        achievedAt: '2026-06-30T10:00:00.000Z',
      },
    ],
  },
  {
    username: 'learner_user',
    allTimeXp: 100,
    weeklyXp: 80,
    monthlyXp: 100,
    dailyXp: 40,
    allTimeRank: 2,
    weeklyRank: 2,
    monthlyRank: 2,
    dailyRank: 2,
    peakAllTimeRank: 2,
    peakWeeklyRank: 2,
    peakMonthlyRank: 2,
    peakDailyRank: 2,
    peakAchievedAt: '2026-06-29T08:30:00.000Z',
    lastActivityAt: '2026-06-29T08:30:00.000Z',
    history: [
      {
        historyId: '32222222-2222-7222-8222-222222222221',
        period: 'weekly',
        snapshotDate: '2026-06-23T00:00:00.000Z',
        rank: 3,
        xp: 40,
      },
      {
        historyId: '32222222-2222-7222-8222-222222222222',
        period: 'monthly',
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 2,
        xp: 100,
      },
    ],
    milestones: [
      {
        id: '42222222-2222-7222-8222-222222222221',
        milestone: 'TOP_10',
        rank: 2,
        achievedAt: '2026-06-29T08:30:00.000Z',
      },
      {
        id: '42222222-2222-7222-8222-222222222222',
        milestone: 'TOP_3',
        rank: 2,
        achievedAt: '2026-06-29T08:30:00.000Z',
      },
    ],
  },
  {
    username: 'content_author',
    allTimeXp: 0,
    weeklyXp: 0,
    monthlyXp: 0,
    dailyXp: 0,
    allTimeRank: 3,
    weeklyRank: 3,
    monthlyRank: 3,
    dailyRank: 3,
    peakAllTimeRank: 3,
    peakWeeklyRank: 3,
    peakMonthlyRank: 3,
    peakDailyRank: 3,
    peakAchievedAt: '2026-06-28T14:00:00.000Z',
    lastActivityAt: '2026-06-28T14:00:00.000Z',
    history: [
      {
        historyId: '33333333-3333-7333-8333-333333333331',
        period: 'weekly',
        snapshotDate: '2026-06-23T00:00:00.000Z',
        rank: 1,
        xp: 0,
      },
      {
        historyId: '33333333-3333-7333-8333-333333333332',
        period: 'monthly',
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 3,
        xp: 0,
      },
    ],
    milestones: [
      {
        id: '43333333-3333-7333-8333-333333333331',
        milestone: 'TOP_10',
        rank: 3,
        achievedAt: '2026-06-28T14:00:00.000Z',
      },
      {
        id: '43333333-3333-7333-8333-333333333332',
        milestone: 'TOP_3',
        rank: 3,
        achievedAt: '2026-06-28T14:00:00.000Z',
      },
    ],
  },
  // Admin account — no quiz activity, seeded so ranking endpoints are testable
  {
    username: 'admin_master',
    allTimeXp: 0,
    weeklyXp: 0,
    monthlyXp: 0,
    dailyXp: 0,
    allTimeRank: 4,
    weeklyRank: 4,
    monthlyRank: 4,
    dailyRank: 4,
    peakAllTimeRank: 4,
    peakWeeklyRank: 4,
    peakMonthlyRank: 4,
    peakDailyRank: 4,
    peakAchievedAt: '2026-06-28T00:00:00.000Z',
    lastActivityAt: '2026-06-28T00:00:00.000Z',
    history: [],
    milestones: [],
  },
  // Moderator account — no quiz activity, seeded so ranking endpoints are testable
  {
    username: 'community_moderator',
    allTimeXp: 0,
    weeklyXp: 0,
    monthlyXp: 0,
    dailyXp: 0,
    allTimeRank: 5,
    weeklyRank: 5,
    monthlyRank: 5,
    dailyRank: 5,
    peakAllTimeRank: 5,
    peakWeeklyRank: 5,
    peakMonthlyRank: 5,
    peakDailyRank: 5,
    peakAchievedAt: '2026-06-28T00:00:00.000Z',
    lastActivityAt: '2026-06-28T00:00:00.000Z',
    history: [],
    milestones: [],
  },
];

export const runRankingSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let rankingRowsTouched = 0;
    let historyInserted = 0;
    let milestonesInserted = 0;

    for (const seed of USER_RANKING_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);

      await tx
        .insert(userRanking)
        .values({
          userId,
          allTimeXp: seed.allTimeXp,
          weeklyXp: seed.weeklyXp,
          monthlyXp: seed.monthlyXp,
          dailyXp: seed.dailyXp,
          allTimeRank: seed.allTimeRank,
          weeklyRank: seed.weeklyRank,
          monthlyRank: seed.monthlyRank,
          dailyRank: seed.dailyRank,
          updatedAt: ctx.nowIso,
          lastWeeklyResetAt: '2026-06-30T00:00:00.000Z',
          lastMonthlyResetAt: '2026-06-01T00:00:00.000Z',
          lastDailyResetAt: '2026-06-30T00:00:00.000Z',
          peakAllTimeRank: seed.peakAllTimeRank,
          peakAllTimeRankAchievedAt: seed.peakAchievedAt,
          peakWeeklyRank: seed.peakWeeklyRank,
          peakWeeklyRankAchievedAt: seed.peakAchievedAt,
          peakMonthlyRank: seed.peakMonthlyRank,
          peakMonthlyRankAchievedAt: seed.peakAchievedAt,
          peakDailyRank: seed.peakDailyRank,
          peakDailyRankAchievedAt: seed.peakAchievedAt,
          lastActivityAt: seed.lastActivityAt,
          isDirty: false,
        })
        .onConflictDoUpdate({
          target: userRanking.userId,
          set: {
            allTimeXp: seed.allTimeXp,
            weeklyXp: seed.weeklyXp,
            monthlyXp: seed.monthlyXp,
            dailyXp: seed.dailyXp,
            allTimeRank: seed.allTimeRank,
            weeklyRank: seed.weeklyRank,
            monthlyRank: seed.monthlyRank,
            dailyRank: seed.dailyRank,
            updatedAt: ctx.nowIso,
            lastWeeklyResetAt: '2026-06-30T00:00:00.000Z',
            lastMonthlyResetAt: '2026-06-01T00:00:00.000Z',
            lastDailyResetAt: '2026-06-30T00:00:00.000Z',
            peakAllTimeRank: seed.peakAllTimeRank,
            peakAllTimeRankAchievedAt: seed.peakAchievedAt,
            peakWeeklyRank: seed.peakWeeklyRank,
            peakWeeklyRankAchievedAt: seed.peakAchievedAt,
            peakMonthlyRank: seed.peakMonthlyRank,
            peakMonthlyRankAchievedAt: seed.peakAchievedAt,
            peakDailyRank: seed.peakDailyRank,
            peakDailyRankAchievedAt: seed.peakAchievedAt,
            lastActivityAt: seed.lastActivityAt,
            isDirty: false,
          },
        });

      // Also sync users.xpTotal so the profile endpoint shows the correct XP.
      // quiz_attempts are ❌ DO NOT SEED (Phase 10 audit), so this seed owns
      // the xpTotal side-effect that attempt-driven flows would otherwise set.
      if (seed.allTimeXp > 0) {
        await tx
          .update(users)
          .set({ xpTotal: seed.allTimeXp })
          .where(eq(users.userId, userId));
      }

      rankingRowsTouched++;

      for (const history of seed.history) {
        const inserted = await tx
          .insert(rankHistory)
          .values({
            historyId: history.historyId,
            userId,
            period: history.period,
            snapshotDate: history.snapshotDate,
            rank: history.rank,
            xp: history.xp,
            recordedAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ historyId: rankHistory.historyId });

        historyInserted += inserted.length;
      }

      for (const milestone of seed.milestones) {
        const inserted = await tx
          .insert(rankingMilestones)
          .values({
            id: milestone.id,
            userId,
            milestone: milestone.milestone,
            rank: milestone.rank,
            achievedAt: milestone.achievedAt,
          })
          .onConflictDoNothing()
          .returning({ id: rankingMilestones.id });

        milestonesInserted += inserted.length;
      }

      logger.info(`Ranking seeded for ${seed.username}: allTimeRank=${seed.allTimeRank} xp=${seed.allTimeXp}`);

      const rankingDetails: Record<string, unknown> = {
        userId,
        username: seed.username,
        allTimeXp: seed.allTimeXp,
        weeklyXp: seed.weeklyXp,
        monthlyXp: seed.monthlyXp,
        dailyXp: seed.dailyXp,
        allTimeRank: seed.allTimeRank,
        weeklyRank: seed.weeklyRank,
        monthlyRank: seed.monthlyRank,
        dailyRank: seed.dailyRank,
        lastWeeklyResetAt: '2026-06-30T00:00:00.000Z',
        lastMonthlyResetAt: '2026-06-01T00:00:00.000Z',
        lastDailyResetAt: '2026-06-30T00:00:00.000Z',
        peakAllTimeRank: seed.peakAllTimeRank,
        peakAllTimeRankAchievedAt: seed.peakAchievedAt,
        peakWeeklyRank: seed.peakWeeklyRank,
        peakWeeklyRankAchievedAt: seed.peakAchievedAt,
        peakMonthlyRank: seed.peakMonthlyRank,
        peakMonthlyRankAchievedAt: seed.peakAchievedAt,
        peakDailyRank: seed.peakDailyRank,
        peakDailyRankAchievedAt: seed.peakAchievedAt,
        lastActivityAt: seed.lastActivityAt,
        isDirty: false,
      };

      recorder.record({
        kind: 'User Rankings',
        id: seed.username,
        fields: {
          username: seed.username,
          allTimeRank: String(seed.allTimeRank),
          allTimeXp: String(seed.allTimeXp),
          weeklyXp: String(seed.weeklyXp),
          monthlyXp: String(seed.monthlyXp),
          peakAllTimeRank: String(seed.peakAllTimeRank),
        },
        details: rankingDetails,
      });

      if (seed.history.length > 0) {
        recorder.record({
          kind: 'Ranking History',
          id: seed.username,
          fields: {
            username: seed.username,
            entries: String(seed.history.length),
            periods: seed.history.map((h) => h.period).join(', '),
          },
          details: {
            userId,
            username: seed.username,
            history: seed.history.map((h) => ({
              historyId: h.historyId,
              userId,
              period: h.period,
              snapshotDate: h.snapshotDate,
              rank: h.rank,
              xp: h.xp,
              recordedAt: ctx.nowIso,
            })),
          },
        });
      }

      if (seed.milestones.length > 0) {
        recorder.record({
          kind: 'Ranking Milestones',
          id: seed.username,
          fields: {
            username: seed.username,
            entries: String(seed.milestones.length),
            milestones: seed.milestones.map((m) => m.milestone).join(', '),
          },
          details: {
            userId,
            username: seed.username,
            milestones: seed.milestones.map((m) => ({
              id: m.id,
              userId,
              milestone: m.milestone,
              rank: m.rank,
              achievedAt: m.achievedAt,
            })),
          },
        });
      }
    }

    summaries.push({
      domain: 'ranking',
      inserted: rankingRowsTouched + historyInserted + milestonesInserted,
      updated: 0,
      skipped: 0,
    });
  });

  return summaries;
};
