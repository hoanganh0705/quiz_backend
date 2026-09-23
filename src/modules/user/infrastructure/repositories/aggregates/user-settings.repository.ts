import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userProfileSettings, users } from '@/core/database/schema';
import { and, eq } from 'drizzle-orm';
import { notDeleted } from '@/common/database/soft-delete.helper';
import type { UserMeRow } from '../../../domain/ports/user-repository.port';
import type { UserMeRowAssembler } from './user.types';

@Injectable()
export class UserSettingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findUserProfileSettings(userId: string): Promise<{ isPublic: boolean } | null> {
    const [row] = await this.db
      .select({ isPublic: userProfileSettings.isPublic })
      .from(userProfileSettings)
      .where(eq(userProfileSettings.userId, userId))
      .limit(1);

    return row ?? null;
  }

  async findUserPrivacyFlags(userId: string): Promise<{
    isPublic: boolean;
    showStatistics: boolean;
    showAchievements: boolean;
    showActivity: boolean;
    showRankImprovement: boolean;
    showTournamentActivity: boolean;
  } | null> {
    const [row] = await this.db
      .select({
        isPublic: userProfileSettings.isPublic,
        showStatistics: userProfileSettings.showStatistics,
        showAchievements: userProfileSettings.showAchievements,
        showActivity: userProfileSettings.showActivity,
        showRankImprovement: userProfileSettings.showRankImprovement,
        showTournamentActivity: userProfileSettings.showTournamentActivity,
      })
      .from(userProfileSettings)
      .where(eq(userProfileSettings.userId, userId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Replaces the `users.settings` JSONB blob with the supplied
   * `preferences` object inside a single transaction, then re-assembles
   * the full `UserMeRow` so callers can return it without an extra
   * round-trip.
   *
   * Callers must guarantee `settings` is defined before calling this
   * method. (See `UserApplicationService.updateSettings`, which throws
   * 400 when both `preferences` and `privacy` are absent.) The legacy
   * `undefined` branch was removed because it was unreachable from
   * production code paths.
   */
  async updatePreferences(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
    assembleUserMeRow: UserMeRowAssembler,
  ): Promise<UserMeRow | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({
          settings,
          updatedAt: nowIso,
        })
        .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)))
        .returning({
          userId: users.userId,
          username: users.username,
          email: users.email,
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
          settings: users.settings,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updated) return null;

      return (await assembleUserMeRow(tx, updated)) as UserMeRow | null;
    });
  }

  /**
   * Upserts one or more privacy flags into `user_profile_settings` and
   * bumps `users.updated_at`, then re-assembles the full `UserMeRow`.
   *
   * Callers must guarantee at least one flag is supplied (the empty
   * `set` branch returns the unmodified row via `fetchUserMe` and
   * does **not** touch `users.updated_at` — this is a pure read
   * fallback, not a timestamp refresh).
   */
  async updatePrivacy(
    userId: string,
    flags: {
      isPublic?: boolean;
      showStatistics?: boolean;
      showAchievements?: boolean;
      showActivity?: boolean;
      showRankImprovement?: boolean;
      showTournamentActivity?: boolean;
    },
    nowIso: string,
    fetchUserMe: (userId: string) => Promise<UserMeRow | null>,
    assembleUserMeRow: UserMeRowAssembler,
  ): Promise<UserMeRow | null> {
    const set: Record<string, unknown> = { updatedAt: nowIso };
    if ('isPublic' in flags) set.isPublic = flags.isPublic;
    if ('showStatistics' in flags) set.showStatistics = flags.showStatistics;
    if ('showAchievements' in flags) set.showAchievements = flags.showAchievements;
    if ('showActivity' in flags) set.showActivity = flags.showActivity;
    if ('showRankImprovement' in flags) set.showRankImprovement = flags.showRankImprovement;
    if ('showTournamentActivity' in flags)
      set.showTournamentActivity = flags.showTournamentActivity;

    if (Object.keys(set).length === 1) {
      // No flags supplied — pure no-op read; skip the UPSERT and do not
      // touch `users.updated_at`.
      return fetchUserMe(userId);
    }

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(userProfileSettings)
        .values({ userId, ...set })
        .onConflictDoUpdate({
          target: userProfileSettings.userId,
          set,
        })
        .returning({ userId: userProfileSettings.userId });

      if (!inserted.length) return null;

      await tx.update(users).set({ updatedAt: nowIso }).where(eq(users.userId, userId));

      const [updated] = await tx
        .select({
          userId: users.userId,
          username: users.username,
          email: users.email,
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
          settings: users.settings,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)))
        .limit(1);

      if (!updated) return null;

      return (await assembleUserMeRow(tx, updated)) as UserMeRow | null;
    });
  }
}
