import { and, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext, requireEnv, recorder } from '../infrastructure';
import {
  assertUniqueBy,
  formatSummary,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  normalizeUserSeeds,
} from '../infrastructure/utils';
import type { NormalizedUserSeed, RawUserSeed, SeedDomain, SeedSummary } from '../infrastructure/types';
import { users } from '@/core/database/schema';

const USER_SEEDS: readonly RawUserSeed[] = [
  {
    email: 'admin@quiz.local',
    username: 'admin_master',
    password: requireEnv('SEED_ADMIN_PASSWORD'),
    role: 'admin',
    displayName: 'Quiz Admin',
    bio: 'Platform administrator account for managing users and content.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
  },
  {
    email: 'moderator@quiz.local',
    username: 'community_moderator',
    password: requireEnv('SEED_MODERATOR_PASSWORD'),
    role: 'moderator',
    displayName: 'Quiz Moderator',
    bio: 'Moderator account for reviewing reports and moderating content.',
    avatarUrl: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c',
  },
  {
    email: 'author@quiz.local',
    username: 'content_author',
    password: requireEnv('SEED_USER_PASSWORD'),
    role: 'user',
    displayName: 'Quiz Author',
    bio: 'Author account for drafting and publishing own quiz content.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  },
  {
    email: 'user@quiz.local',
    username: 'learner_user',
    password: requireEnv('SEED_USER_PASSWORD'),
    role: 'user',
    displayName: 'Learner User',
    bio: 'Standard learner account for attempting quizzes.',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d',
  },
  {
    email: 'power_user@quiz.local',
    username: 'power_user',
    password: requireEnv('SEED_USER_PASSWORD'),
    role: 'user',
    displayName: 'Power User',
    bio: 'Active learner who completes many quizzes and earns achievements.',
    avatarUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79',
  },
];

export { USER_SEEDS };

const normalizeUserSeeds_ = (input: readonly RawUserSeed[]): NormalizedUserSeed[] =>
  input.map((seed) => ({
    email: normalizeEmail(seed.email),
    username: normalizeUsername(seed.username),
    password: seed.password,
    role: seed.role,
    displayName: seed.displayName.trim(),
    bio: seed.bio.trim(),
    avatarUrl: seed.avatarUrl.trim(),
    settings: seed.settings ?? {},
  }));

export const createUsersDomain = (): SeedDomain => ({
  domain: 'users',
  run: async (tx: SeedTx, ctx: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeUserSeeds_(USER_SEEDS);
    assertUniqueBy(seeds, (seed) => seed.email, 'email');
    assertUniqueBy(seeds, (seed) => seed.username, 'username');

    const emails = seeds.map((seed) => seed.email);
    const usernames = seeds.map((seed) => seed.username);

    const existingUsers = await tx
      .select({
        userId: users.userId,
        email: users.email,
        username: users.username,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(inArray(users.email, emails), inArray(users.username, usernames)),
        ),
      );

    const existingByEmail = new Map(existingUsers.map((row) => [normalizeEmail(row.email), row]));
    const existingByUsername = new Map(existingUsers.map((row) => [normalizeUsername(row.username), row]));

    const upsertValues = await Promise.all(
      seeds.map(async (seed) => {
        const existingBySeedEmail = existingByEmail.get(seed.email);
        const existingBySeedUsername = existingByUsername.get(seed.username);

        if (
          existingBySeedEmail &&
          existingBySeedUsername &&
          existingBySeedEmail.userId !== existingBySeedUsername.userId
        ) {
          throw new Error(
            `Conflicting seeded user identity for email=${seed.email} username=${seed.username}`,
          );
        }

        const existing = existingBySeedEmail ?? existingBySeedUsername;
        const passwordHash = existing ? existing.passwordHash : await hashPassword(seed.password);

        return {
          email: seed.email,
          username: seed.username,
          passwordHash,
          role: seed.role,
          settings: seed.settings,
          isVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          updatedAt: ctx.nowIso,
          emailVerifiedAt: ctx.nowIso,
        };
      }),
    );

    const touchedRows = await tx
      .insert(users)
      .values(upsertValues)
      .onConflictDoUpdate({
        target: users.email,
        targetWhere: isNull(users.deletedAt),
        set: {
          username: sql`excluded.username`,
          role: sql`excluded.role`,
          isVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          emailVerifiedAt: sql`COALESCE(${users.emailVerifiedAt}, excluded.email_verified_at)`,
          updatedAt: ctx.nowIso,
        },
        setWhere: sql`
          ${users.username} IS DISTINCT FROM excluded.username
          OR ${users.role} IS DISTINCT FROM excluded.role
          OR ${users.isVerified} IS DISTINCT FROM true
          OR ${users.emailVerifiedAt} IS NULL
          OR ${users.emailVerificationTokenHash} IS NOT NULL
          OR ${users.emailVerificationExpiresAt} IS NOT NULL
        `,
      })
      .returning({
        inserted: sql<boolean>`xmax = 0`,
      });

    const inserted = touchedRows.filter((row) => row.inserted).length;
    const updated = touchedRows.length - inserted;
    const skipped = seeds.length - touchedRows.length;

    // Emit one record per seed user so SEED_RECORD.md lists every login.
    // We deliberately record from the seed payload (not the returned row)
    // because the password is only available pre-hash.
    for (const seed of seeds) {
      recorder.record({
        kind: 'Users',
        id: seed.username,
        fields: {
          username: seed.username,
          email: seed.email,
          password: seed.password,
          role: seed.role,
          displayName: seed.displayName,
        },
      });
    }

    return { domain: 'users', inserted, updated, skipped };
  },
});

export const runUsersSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  return db.transaction(async (tx) => createUsersDomain().run(tx, ctx));
};
