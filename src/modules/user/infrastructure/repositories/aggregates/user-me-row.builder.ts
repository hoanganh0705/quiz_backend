import type { UserMeRow } from '../../../domain/ports/user-repository.port';
import { userProfiles, userRanking } from '@/core/database/schema';
import { eq, sql } from 'drizzle-orm';
import { isObjectRecord } from '@/common/utils/object.util';
import type { DrizzleTx, UpdatedUserCoreRow } from './user.types';

/**
 * Re-assembles a full `UserMeRow` from the partial `users` row that
 * the settings/preferences flows return from their transactional
 * `UPDATE … RETURNING`.
 *
 * Pulled out of `UserAccountRepository` so that any aggregate that
 * participates in a transactional write can share a single assembler
 * shape (see `UserMeRowAssembler` in `user.types.ts`).
 */
export async function assembleUserMeRow(
  tx: DrizzleTx,
  updated: UpdatedUserCoreRow,
): Promise<UserMeRow | null> {
  const [ranking] = await tx
    .select({
      xpTotal: sql<number>`COALESCE(${userRanking.allTimeXp}, 0)`,
    })
    .from(userRanking)
    .where(eq(userRanking.userId, updated.userId))
    .limit(1);

  const [profile] = await tx
    .select({
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      avatarPublicId: userProfiles.avatarPublicId,
      bio: userProfiles.bio,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, updated.userId))
    .limit(1);

  return {
    ...updated,
    xpTotal: ranking?.xpTotal ?? 0,
    settings: isObjectRecord(updated.settings) ? updated.settings : {},
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    avatarPublicId: profile?.avatarPublicId ?? null,
    bio: profile?.bio ?? null,
  } satisfies UserMeRow;
}
