import { and, eq, sql } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext } from '../infrastructure';
import { assertUniqueBy, normalizeSlug } from '../infrastructure/utils';
import type { RawBadgeSeed, SeedDomain, SeedSummary } from '../infrastructure/types';
import { badges, badgeRules, badgeRuleType } from '@/core/database/schema';

const BADGE_SEEDS: readonly RawBadgeSeed[] = [
  // Quiz completion badges
  {
    slug: 'first-quiz',
    type: 'bronze',
    name: 'First Steps',
    description: 'Complete your first quiz.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_completed', threshold: 1, operator: '>=' },
      },
    ],
  },
  {
    slug: 'five-quizzes',
    type: 'bronze',
    name: 'Getting Started',
    description: 'Complete 5 quizzes.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_completed', threshold: 5, operator: '>=' },
      },
    ],
  },
  {
    slug: 'ten-quizzes',
    type: 'silver',
    name: 'Quiz Enthusiast',
    description: 'Complete 10 quizzes.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_completed', threshold: 10, operator: '>=' },
      },
    ],
  },
  {
    slug: 'hundred-quizzes',
    type: 'gold',
    name: 'Quiz Master',
    description: 'Complete 100 quizzes.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_completed', threshold: 100, operator: '>=' },
      },
    ],
  },
  // Pass badges
  {
    slug: 'first-pass',
    type: 'bronze',
    name: 'Passer',
    description: 'Pass your first quiz on the first attempt.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_passed', threshold: 1, operator: '>=' },
      },
    ],
  },
  {
    slug: 'five-passes',
    type: 'silver',
    name: 'Consistent Performer',
    description: 'Pass 5 quizzes.',
    isActive: true,
    rules: [
      {
        ruleType: 'count',
        priority: 0,
        config: { metric: 'quizzes_passed', threshold: 5, operator: '>=' },
      },
    ],
  },
  // Streak badges
  {
    slug: 'streak-3',
    type: 'bronze',
    name: 'On a Roll',
    description: 'Maintain a 3-day learning streak.',
    isActive: true,
    rules: [
      {
        ruleType: 'streak',
        priority: 0,
        config: { metric: 'streak_days', threshold: 3, operator: '>=' },
      },
    ],
  },
  {
    slug: 'streak-7',
    type: 'silver',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak.',
    isActive: true,
    rules: [
      {
        ruleType: 'streak',
        priority: 0,
        config: { metric: 'streak_days', threshold: 7, operator: '>=' },
      },
    ],
  },
  {
    slug: 'streak-30',
    type: 'gold',
    name: 'Monthly Champion',
    description: 'Maintain a 30-day learning streak.',
    isActive: true,
    rules: [
      {
        ruleType: 'streak',
        priority: 0,
        config: { metric: 'streak_days', threshold: 30, operator: '>=' },
      },
    ],
  },
  // XP badges
  {
    slug: 'xp-100',
    type: 'bronze',
    name: 'Point Collector',
    description: 'Earn 100 XP total.',
    isActive: true,
    rules: [
      {
        ruleType: 'xp_total',
        priority: 0,
        config: { metric: 'xp_total', threshold: 100, operator: '>=' },
      },
    ],
  },
  {
    slug: 'xp-1000',
    type: 'silver',
    name: 'XP Master',
    description: 'Earn 1,000 XP total.',
    isActive: true,
    rules: [
      {
        ruleType: 'xp_total',
        priority: 0,
        config: { metric: 'xp_total', threshold: 1000, operator: '>=' },
      },
    ],
  },
  {
    slug: 'xp-5000',
    type: 'gold',
    name: 'XP Legend',
    description: 'Earn 5,000 XP total.',
    isActive: true,
    rules: [
      {
        ruleType: 'xp_total',
        priority: 0,
        config: { metric: 'xp_total', threshold: 5000, operator: '>=' },
      },
    ],
  },
  // Tournament badges
  {
    slug: 'tournament-win',
    type: 'gold',
    name: 'Champion',
    description: 'Win a tournament.',
    isActive: true,
    rules: [
      {
        ruleType: 'tournament_win',
        priority: 0,
        config: { metric: 'tournaments_won', threshold: 1, operator: '>=' },
      },
    ],
  },
  {
    slug: 'tournament-three-wins',
    type: 'platinum',
    name: 'Tournament Veteran',
    description: 'Win 3 tournaments.',
    isActive: true,
    rules: [
      {
        ruleType: 'tournament_win',
        priority: 0,
        config: { metric: 'tournaments_won', threshold: 3, operator: '>=' },
      },
    ],
  },
  // Perfect score badges
  {
    slug: 'perfect-score',
    type: 'platinum',
    name: 'Perfectionist',
    description: 'Get a perfect score on any quiz.',
    isActive: true,
    rules: [
      {
        ruleType: 'perfect_score',
        priority: 0,
        config: { metric: 'perfect_scores', threshold: 1, operator: '>=' },
      },
    ],
  },
  {
    slug: 'perfect-ten',
    type: 'diamond',
    name: 'Perfectionist Elite',
    description: 'Get 10 perfect scores.',
    isActive: true,
    rules: [
      {
        ruleType: 'perfect_score',
        priority: 0,
        config: { metric: 'perfect_scores', threshold: 10, operator: '>=' },
      },
    ],
  },
  // Rank badges
  {
    slug: 'rank-top-100',
    type: 'silver',
    name: 'Expert',
    description: 'Reach Top 100 globally.',
    isActive: true,
    rules: [
      {
        ruleType: 'rank',
        priority: 0,
        config: { metric: 'global_rank', threshold: 100, operator: '<=' },
      },
    ],
  },
  {
    slug: 'rank-top-10',
    type: 'gold',
    name: 'Elite',
    description: 'Reach Top 10 globally.',
    isActive: true,
    rules: [
      {
        ruleType: 'rank',
        priority: 0,
        config: { metric: 'global_rank', threshold: 10, operator: '<=' },
      },
    ],
  },
  {
    slug: 'rank-1',
    type: 'diamond',
    name: 'Champion',
    description: 'Reach rank #1 globally.',
    isActive: true,
    rules: [
      {
        ruleType: 'rank',
        priority: 0,
        config: { metric: 'global_rank', threshold: 1, operator: '<=' },
      },
    ],
  },
  // Period rank badges
  {
    slug: 'rank-weekly-top-10',
    type: 'gold',
    name: 'Weekly Champion',
    description: 'Reach Top 10 in weekly rankings.',
    isActive: true,
    rules: [
      {
        ruleType: 'rank_period',
        priority: 0,
        config: { metric: 'period_rank', period: 'weekly', threshold: 10, operator: '<=' },
      },
    ],
  },
];

export { BADGE_SEEDS };

export const createBadgesDomain = (): SeedDomain => ({
  domain: 'badges',
  run: async (tx: SeedTx, ctx: SeedContext): Promise<SeedSummary> => {
    assertUniqueBy(BADGE_SEEDS, (badge) => badge.slug, 'badge slug');

    const slugs = BADGE_SEEDS.map((badge) => badge.slug);

    const existingBadges = await tx
      .select({ badgeId: badges.badgeId, slug: badges.slug })
      .from(badges)
      .where(sql`${badges.slug} = ANY(${slugs})`);

    const existingBySlug = new Map(existingBadges.map((row) => [row.slug, row]));

    // Insert badges
    const badgeUpsertValues = BADGE_SEEDS.map((badge) => ({
      slug: normalizeSlug(badge.slug),
      category: 'quiz' as const,
      type: badge.type,
      name: badge.name.trim(),
      description: badge.description?.trim() ?? null,
      iconUrl: badge.iconUrl ?? null,
      isActive: badge.isActive,
      updatedAt: ctx.nowIso,
    }));

    const touchedBadgeRows = await tx
      .insert(badges)
      .values(badgeUpsertValues)
      .onConflictDoUpdate({
        target: badges.slug,
        set: {
          type: sql`excluded.type`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          iconUrl: sql`excluded.icon_url`,
          isActive: sql`excluded.is_active`,
          updatedAt: ctx.nowIso,
        },
      })
      .returning({
        badgeId: badges.badgeId,
        slug: badges.slug,
        inserted: sql<boolean>`xmax = 0`,
      });

    // Map slug to badgeId
    const slugToBadgeId = new Map<string, string>();
    for (const row of touchedBadgeRows) {
      slugToBadgeId.set(row.slug, row.badgeId);
    }

    // Insert badge rules
    const ruleUpsertValues: Array<{
      badgeId: string;
      ruleType: typeof badgeRuleType.enumValues[number];
      priority: number;
      config: Record<string, unknown>;
      isActive: boolean;
    }> = [];

    for (const badge of BADGE_SEEDS) {
      const badgeId = slugToBadgeId.get(normalizeSlug(badge.slug));
      if (!badgeId) continue;

      for (const rule of badge.rules) {
        ruleUpsertValues.push({
          badgeId,
          ruleType: rule.ruleType,
          priority: rule.priority ?? 0,
          config: rule.config,
          isActive: rule.isActive ?? true,
        });
      }
    }

    if (ruleUpsertValues.length > 0) {
      await tx
        .insert(badgeRules)
        .values(ruleUpsertValues)
        .onConflictDoNothing();
    }

    const inserted = touchedBadgeRows.filter((row) => row.inserted).length;
    const updated = touchedBadgeRows.length - inserted;
    const skipped = BADGE_SEEDS.length - touchedBadgeRows.length;

    return { domain: 'badges', inserted, updated, skipped };
  },
});

export const runBadgesSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  return db.transaction(async (tx) => createBadgesDomain().run(tx, ctx));
};
