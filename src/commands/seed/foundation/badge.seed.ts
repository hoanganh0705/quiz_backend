import { and, eq, sql } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext } from '../infrastructure';
import { assertUniqueBy, normalizeSlug } from '../infrastructure/utils';
import type { RawBadgeSeed, SeedDomain, SeedSummary } from '../infrastructure/types';
import { badges } from '@/core/database/schema';

const BADGE_SEEDS: readonly RawBadgeSeed[] = [
  {
    slug: 'first-quiz',
    type: 'bronze',
    name: 'First Steps',
    description: 'Complete your first quiz.',
    conditionType: 'quizzes_completed',
    conditionValue: 1,
    isActive: true,
  },
  {
    slug: 'five-quizzes',
    type: 'bronze',
    name: 'Getting Started',
    description: 'Complete 5 quizzes.',
    conditionType: 'quizzes_completed',
    conditionValue: 5,
    isActive: true,
  },
  {
    slug: 'ten-quizzes',
    type: 'silver',
    name: 'Quiz Enthusiast',
    description: 'Complete 10 quizzes.',
    conditionType: 'quizzes_completed',
    conditionValue: 10,
    isActive: true,
  },
  {
    slug: 'first-pass',
    type: 'bronze',
    name: 'Passer',
    description: 'Pass your first quiz on the first attempt.',
    conditionType: 'quizzes_passed',
    conditionValue: 1,
    isActive: true,
  },
  {
    slug: 'five-passes',
    type: 'silver',
    name: 'Consistent Performer',
    description: 'Pass 5 quizzes.',
    conditionType: 'quizzes_passed',
    conditionValue: 5,
    isActive: true,
  },
  {
    slug: 'streak-3',
    type: 'bronze',
    name: 'On a Roll',
    description: 'Maintain a 3-day learning streak.',
    conditionType: 'streak_days',
    conditionValue: 3,
    isActive: true,
  },
  {
    slug: 'streak-7',
    type: 'silver',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak.',
    conditionType: 'streak_days',
    conditionValue: 7,
    isActive: true,
  },
  {
    slug: 'streak-30',
    type: 'gold',
    name: 'Monthly Champion',
    description: 'Maintain a 30-day learning streak.',
    conditionType: 'streak_days',
    conditionValue: 30,
    isActive: true,
  },
  {
    slug: 'xp-100',
    type: 'bronze',
    name: 'Point Collector',
    description: 'Earn 100 XP total.',
    conditionType: 'xp_earned',
    conditionValue: 100,
    isActive: true,
  },
  {
    slug: 'xp-1000',
    type: 'silver',
    name: 'XP Master',
    description: 'Earn 1,000 XP total.',
    conditionType: 'xp_earned',
    conditionValue: 1000,
    isActive: true,
  },
  {
    slug: 'xp-5000',
    type: 'gold',
    name: 'XP Legend',
    description: 'Earn 5,000 XP total.',
    conditionType: 'xp_earned',
    conditionValue: 5000,
    isActive: true,
  },
  {
    slug: 'tournament-win',
    type: 'gold',
    name: 'Champion',
    description: 'Win a tournament.',
    conditionType: 'tournaments_won',
    conditionValue: 1,
    isActive: true,
  },
  {
    slug: 'perfect-score',
    type: 'platinum',
    name: 'Perfectionist',
    description: 'Get a perfect score on any quiz.',
    conditionType: 'perfect_score',
    conditionValue: 1,
    isActive: true,
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

    const upsertValues = BADGE_SEEDS.map((badge) => ({
      slug: normalizeSlug(badge.slug),
      type: badge.type,
      name: badge.name.trim(),
      description: badge.description?.trim() ?? null,
      conditionType: badge.conditionType,
      conditionValue: badge.conditionValue,
      isActive: badge.isActive,
      updatedAt: ctx.nowIso,
    }));

    const touchedRows = await tx
      .insert(badges)
      .values(upsertValues)
      .onConflictDoUpdate({
        target: badges.slug,
        set: {
          type: sql`excluded.type`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          conditionType: sql`excluded.condition_type`,
          conditionValue: sql`excluded.condition_value`,
          isActive: sql`excluded.is_active`,
          updatedAt: ctx.nowIso,
        },
      })
      .returning({
        inserted: sql<boolean>`xmax = 0`,
      });

    const inserted = touchedRows.filter((row) => row.inserted).length;
    const updated = touchedRows.length - inserted;
    const skipped = BADGE_SEEDS.length - touchedRows.length;

    return { domain: 'badges', inserted, updated, skipped };
  },
});

export const runBadgesSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  return db.transaction(async (tx) => createBadgesDomain().run(tx, ctx));
};
