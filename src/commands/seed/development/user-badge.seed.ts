// `user_badges` is ⚠ OPTIONAL SEED per the Phase 10 audit — rows can be
// earned naturally by completing attempts. We seed a handful so the badge
// list / revoke / re-evaluate endpoints have data immediately.
// See `PHASE_10_EVIDENCE_REPORT.md` → "Achievement domain" for the
// classification rationale.

import { db, type SeedContext, recorder } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import { userBadges } from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

type UserBadgeSeed = {
  userBadgeId: string;
  username: string;
  badgeSlug: string;
  earnedAt: string;
  progress?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const USER_BADGE_SEEDS: UserBadgeSeed[] = [
  {
    userBadgeId: '51111111-1111-7111-8111-111111111111',
    username: 'learner_user',
    badgeSlug: 'first-quiz',
    earnedAt: '2026-06-28T08:00:00.000Z',
    progress: { quizzesCompleted: 1, threshold: 1 },
    metadata: { source: 'direct_seed', note: 'Completed first quiz' },
  },
  {
    userBadgeId: '51111111-1111-7111-8111-111111111112',
    username: 'learner_user',
    badgeSlug: 'xp-100',
    earnedAt: '2026-06-29T08:30:00.000Z',
    progress: { xpTotal: 100, threshold: 100 },
    metadata: { source: 'ranking_seed' },
  },
  {
    userBadgeId: '52222222-2222-7222-8222-222222222221',
    username: 'power_user',
    badgeSlug: 'first-quiz',
    earnedAt: '2026-06-27T10:00:00.000Z',
    progress: { quizzesCompleted: 1, threshold: 1 },
    metadata: { source: 'direct_seed' },
  },
  {
    userBadgeId: '52222222-2222-7222-8222-222222222222',
    username: 'power_user',
    badgeSlug: 'perfect-score',
    earnedAt: '2026-06-30T10:00:00.000Z',
    progress: { perfectScores: 1, threshold: 1 },
    metadata: { source: 'direct_seed', note: 'Seeded directly to exercise badge list / revoke endpoints' },
  },
  {
    userBadgeId: '52222222-2222-7222-8222-222222222223',
    username: 'power_user',
    badgeSlug: 'rank-1',
    earnedAt: '2026-06-30T10:00:00.000Z',
    progress: { globalRank: 1, threshold: 1 },
    metadata: { source: 'ranking_seed', period: 'all_time' },
  },
  {
    userBadgeId: '53333333-3333-7333-8333-333333333331',
    username: 'content_author',
    badgeSlug: 'rank-top-100',
    earnedAt: '2026-06-28T14:00:00.000Z',
    progress: { globalRank: 3, threshold: 100 },
    metadata: { source: 'ranking_seed', period: 'all_time' },
  },
];

export const runUserBadgeSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let inserted = 0;
    let skipped = 0;

    for (const seed of USER_BADGE_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);
      const badgeId = await lookup.badgeIdBySlug(seed.badgeSlug);

      if (!badgeId) {
        logger.warn(`User badge seed: badge "${seed.badgeSlug}" not found for ${seed.username}, skipping`);
        skipped++;
        continue;
      }

      const touched = await tx
        .insert(userBadges)
        .values({
          userBadgeId: seed.userBadgeId,
          userId,
          badgeId,
          earnedAt: seed.earnedAt,
          badgeVersion: '1.0.0',
          progress: seed.progress ?? {},
          metadata: seed.metadata ?? {},
          expiresAt: null,
          revokedAt: null,
          revocationReason: null,
        })
        .onConflictDoNothing()
        .returning({ userBadgeId: userBadges.userBadgeId });

      // Record the seeded user-badge so SEED_RECORD.md lists every award that
      // the seed defines — even on re-runs where the row already exists.
      recorder.record({
        kind: 'User Badges',
        id: `${seed.username}:${seed.badgeSlug}`,
        fields: {
          username: seed.username,
          badgeSlug: seed.badgeSlug,
          earnedAt: seed.earnedAt,
        },
        details: {
          userBadgeId: seed.userBadgeId,
          userId,
          badgeId,
          badgeSlug: seed.badgeSlug,
          username: seed.username,
          earnedAt: seed.earnedAt,
          badgeVersion: '1.0.0',
          progress: seed.progress ?? {},
          metadata: seed.metadata ?? {},
          expiresAt: null,
          revokedAt: null,
          revocationReason: null,
        },
      });

      if (touched.length === 0) {
        skipped++;
        continue;
      }

      inserted += touched.length;
      logger.info(`User badge seeded: ${seed.username} earned "${seed.badgeSlug}"`);
    }

    summaries.push({ domain: 'user_badges', inserted, updated: 0, skipped });
  });

  return summaries;
};
