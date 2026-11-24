import { eq } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext, recorder } from '../infrastructure';
import { SeedLookup } from '../shared/seed-lookup';
import { userProfiles, userProfileSettings } from '@/core/database/schema';
import { USER_SEEDS } from './user.seed';
import { logger } from '../infrastructure/seed-logger';
import type { SeedSummary } from '../infrastructure/types';

export const runUserProfilesSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  let inserted = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    for (const seed of USER_SEEDS) {
      const userId = await lookup.userIdByUsername(seed.username);

      const [existingProfile] = await tx
        .select({ profileId: userProfiles.profileId })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (existingProfile) {
        await tx
          .update(userProfiles)
          .set({
            displayName: seed.displayName,
            avatarUrl: seed.avatarUrl,
            bio: seed.bio,
            updatedAt: ctx.nowIso,
          })
          .where(eq(userProfiles.profileId, existingProfile.profileId));
        updated++;
      } else {
        await tx.insert(userProfiles).values({
          userId,
          displayName: seed.displayName,
          avatarUrl: seed.avatarUrl,
          bio: seed.bio,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
        inserted++;
      }

      const [existingSettings] = await tx
        .select({ settingsId: userProfileSettings.settingsId })
        .from(userProfileSettings)
        .where(eq(userProfileSettings.userId, userId))
        .limit(1);

      if (!existingSettings) {
        await tx.insert(userProfileSettings).values({
          userId,
          isPublic: true,
          showStatistics: true,
          showAchievements: true,
          showActivity: true,
          showRankImprovement: true,
          showTournamentActivity: true,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
      }

      logger.info(`Seeded profile and settings for "${seed.username}"`);
    }
  });

  return { domain: 'user_profiles', inserted, updated, skipped: 0 };
};
