import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { and, inArray, isNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { categories, tags, users } from '../schema';
import * as schema from '../schema';
import * as relations from '../schema/relations';

type UserRole = 'admin' | 'moderator' | 'creator' | 'user';

type RawUserSeed = {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings?: Record<string, unknown>;
};

type NormalizedUserSeed = {
  email: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  bio: string;
  avatarUrl: string;
  settings: Record<string, unknown>;
};

type RawCategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

type NormalizedCategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
};

type RawTagSeed = {
  name: string;
  slug: string;
};

type NormalizedTagSeed = {
  name: string;
  slug: string;
};

type SeedSummary = {
  domain: string;
  inserted: number;
  updated: number;
  skipped: number;
};

type SeedContext = {
  nowIso: string;
};

const USER_SEEDS: readonly RawUserSeed[] = [
  // Keep full enum coverage so auth/authorization tests exercise every user_role.
  {
    email: 'admin@quiz.local',
    username: 'admin_master',
    password: 'Admin@123',
    role: 'admin',
    displayName: 'Quiz Admin',
    bio: 'Platform administrator account for managing users and content.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
  },
  {
    email: 'moderator@quiz.local',
    username: 'community_moderator',
    password: 'Moderator@123',
    role: 'moderator',
    displayName: 'Quiz Moderator',
    bio: 'Moderator account for reviewing reports and moderating content.',
    avatarUrl: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c',
  },
  {
    email: 'creator@quiz.local',
    username: 'content_creator',
    password: 'Creator@123',
    role: 'creator',
    displayName: 'Quiz Creator',
    bio: 'Content creator account for drafting and publishing quiz content.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  },
  {
    email: 'user@quiz.local',
    username: 'learner_user',
    password: 'Learner@123',
    role: 'user',
    displayName: 'Learner User',
    bio: 'Standard learner account for attempting quizzes.',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d',
  },
];

const CATEGORY_SEEDS: readonly RawCategorySeed[] = [
  {
    name: 'Science',
    slug: 'science',
    description: 'Physics, chemistry, biology and scientific discoveries.',
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d',
  },
  {
    name: 'History',
    slug: 'history',
    description: 'World history, major events, timelines, and civilizations.',
    imageUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1',
  },
  {
    name: 'Geography',
    slug: 'geography',
    description: 'Countries, capitals, landscapes, and geographical facts.',
    imageUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1',
  },
  {
    name: 'Technology',
    slug: 'technology',
    description: 'Computing, software, internet, and modern innovations.',
    imageUrl: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3',
  },
  {
    name: 'Mathematics',
    slug: 'mathematics',
    description: 'Algebra, geometry, calculus, and logical reasoning.',
    imageUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904',
  },
  {
    name: 'Sports',
    slug: 'sports',
    description: 'Rules, players, records, and major sporting events.',
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211',
  },
];

const TAG_SEEDS: readonly RawTagSeed[] = [
  {
    name: 'Physics',
    slug: 'physics',
  },
  {
    name: 'Chemistry',
    slug: 'chemistry',
  },
  {
    name: 'Biology',
    slug: 'biology',
  },
  {
    name: 'Math',
    slug: 'math',
  },
  {
    name: 'Programming',
    slug: 'programming',
  },
  {
    name: 'Algorithms',
    slug: 'algorithms',
  },
  {
    name: 'General Knowledge',
    slug: 'general-knowledge',
  },
  {
    name: 'World History',
    slug: 'world-history',
  },
];

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run seeds');
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pool = new Pool({ connectionString: databaseUrl });
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});

type SeedDb = typeof db;
type SeedTx = Parameters<Parameters<SeedDb['transaction']>[0]>[0];

type SeedDomain = {
  domain: string;
  run: (tx: SeedTx, context: SeedContext) => Promise<SeedSummary>;
};

const trimText = (value: string): string => value.trim();

const normalizeEmail = (value: string): string => trimText(value).toLowerCase();

const normalizeUsername = (value: string): string => trimText(value).toLowerCase();

const normalizeSlug = (value: string): string => {
  const slug = trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new Error('Invalid slug: slug cannot be empty after normalization');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid slug format: ${slug}`);
  }

  return slug;
};

const normalizeUserSeeds = (input: readonly RawUserSeed[]): NormalizedUserSeed[] =>
  input.map((seed) => ({
    email: normalizeEmail(seed.email),
    username: normalizeUsername(seed.username),
    password: seed.password,
    role: seed.role,
    displayName: trimText(seed.displayName),
    bio: trimText(seed.bio),
    avatarUrl: trimText(seed.avatarUrl),
    settings: seed.settings ?? {},
  }));

const normalizeCategorySeeds = (input: readonly RawCategorySeed[]): NormalizedCategorySeed[] =>
  input.map((seed) => ({
    name: trimText(seed.name),
    slug: normalizeSlug(seed.slug || seed.name),
    description: trimText(seed.description),
    imageUrl: trimText(seed.imageUrl),
  }));

const normalizeTagSeeds = (input: readonly RawTagSeed[]): NormalizedTagSeed[] =>
  input.map((seed) => ({
    name: trimText(seed.name),
    slug: normalizeSlug(seed.slug || seed.name),
  }));

const assertUniqueBy = <T>(
  items: readonly T[],
  keyFn: (item: T) => string,
  label: string,
): void => {
  const seen = new Set<string>();

  for (const item of items) {
    const key = keyFn(item);

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label} in seed payload: ${key}`);
    }

    seen.add(key);
  }
};

const seedUsersDomain = (rawSeeds: readonly RawUserSeed[]): SeedDomain => ({
  domain: 'users',
  run: async (tx: SeedTx, context: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeUserSeeds(rawSeeds);
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
    const existingByUsername = new Map(
      existingUsers.map((row) => [normalizeUsername(row.username), row]),
    );

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
        const passwordHash = existing
          ? existing.passwordHash
          : await bcrypt.hash(seed.password, 12);

        return {
          email: seed.email,
          username: seed.username,
          passwordHash,
          role: seed.role,
          displayName: seed.displayName,
          bio: seed.bio,
          avatarUrl: seed.avatarUrl,
          settings: seed.settings,
          updatedAt: context.nowIso,
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
          displayName: sql`excluded.display_name`,
          bio: sql`excluded.bio`,
          avatarUrl: sql`excluded.avatar_url`,
          updatedAt: context.nowIso,
        },
        setWhere: sql`
          ${users.username} IS DISTINCT FROM excluded.username
          OR ${users.role} IS DISTINCT FROM excluded.role
          OR ${users.displayName} IS DISTINCT FROM excluded.display_name
          OR ${users.bio} IS DISTINCT FROM excluded.bio
          OR ${users.avatarUrl} IS DISTINCT FROM excluded.avatar_url
        `,
      })
      .returning({
        inserted: sql<boolean>`xmax = 0`,
      });

    const inserted = touchedRows.filter((row) => row.inserted).length;
    const updated = touchedRows.length - inserted;
    const skipped = seeds.length - touchedRows.length;

    return {
      domain: 'users',
      inserted,
      updated,
      skipped,
    };
  },
});

const seedCategoriesDomain = (rawSeeds: readonly RawCategorySeed[]): SeedDomain => ({
  domain: 'categories',
  run: async (tx: SeedTx, context: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeCategorySeeds(rawSeeds);

    assertUniqueBy(seeds, (seed) => seed.slug, 'category slug');
    assertUniqueBy(seeds, (seed) => seed.name.toLowerCase(), 'category name (case-insensitive)');

    const slugs = seeds.map((seed) => seed.slug);
    const normalizedNames = seeds.map((seed) => seed.name.toLowerCase());
    const lowerNameExpression = sql<string>`lower(${categories.name})`;

    const existingCategories = await tx
      .select({
        categoryId: categories.categoryId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories)
      .where(
        and(
          isNull(categories.deletedAt),
          or(inArray(categories.slug, slugs), inArray(lowerNameExpression, normalizedNames)),
        ),
      );

    const existingBySlug = new Map(existingCategories.map((row) => [row.slug, row]));
    const existingByLowerName = new Map(
      existingCategories.map((row) => [row.name.toLowerCase(), row]),
    );

    for (const seed of seeds) {
      const bySlug = existingBySlug.get(seed.slug);
      const byName = existingByLowerName.get(seed.name.toLowerCase());

      if (bySlug && byName && bySlug.categoryId !== byName.categoryId) {
        throw new Error(`Conflicting category seed for slug=${seed.slug} and name=${seed.name}`);
      }
    }

    const touchedRows = await tx
      .insert(categories)
      .values(
        seeds.map((seed) => ({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          imageUrl: seed.imageUrl,
          updatedAt: context.nowIso,
        })),
      )
      .onConflictDoUpdate({
        target: categories.slug,
        targetWhere: isNull(categories.deletedAt),
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          imageUrl: sql`excluded.image_url`,
          updatedAt: context.nowIso,
        },
        setWhere: sql`
          ${categories.name} IS DISTINCT FROM excluded.name
          OR ${categories.description} IS DISTINCT FROM excluded.description
          OR ${categories.imageUrl} IS DISTINCT FROM excluded.image_url
        `,
      })
      .returning({
        inserted: sql<boolean>`xmax = 0`,
      });

    const inserted = touchedRows.filter((row) => row.inserted).length;
    const updated = touchedRows.length - inserted;
    const skipped = seeds.length - touchedRows.length;

    return {
      domain: 'categories',
      inserted,
      updated,
      skipped,
    };
  },
});

const seedTagsDomain = (rawSeeds: readonly RawTagSeed[]): SeedDomain => ({
  domain: 'tags',
  run: async (tx: SeedTx, context: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeTagSeeds(rawSeeds);

    assertUniqueBy(seeds, (seed) => seed.slug, 'tag slug');
    assertUniqueBy(seeds, (seed) => seed.name.toLowerCase(), 'tag name (case-insensitive)');

    const slugs = seeds.map((seed) => seed.slug);
    const normalizedNames = seeds.map((seed) => seed.name.toLowerCase());
    const lowerNameExpression = sql<string>`lower(${tags.name})`;

    const existingTags = await tx
      .select({
        tagId: tags.tagId,
        slug: tags.slug,
        name: tags.name,
      })
      .from(tags)
      .where(
        and(
          isNull(tags.deletedAt),
          or(inArray(tags.slug, slugs), inArray(lowerNameExpression, normalizedNames)),
        ),
      );

    const existingBySlug = new Map(existingTags.map((row) => [row.slug, row]));
    const existingByLowerName = new Map(existingTags.map((row) => [row.name.toLowerCase(), row]));

    for (const seed of seeds) {
      const bySlug = existingBySlug.get(seed.slug);
      const byName = existingByLowerName.get(seed.name.toLowerCase());

      if (bySlug && byName && bySlug.tagId !== byName.tagId) {
        throw new Error(`Conflicting tag seed for slug=${seed.slug} and name=${seed.name}`);
      }
    }

    const touchedRows = await tx
      .insert(tags)
      .values(
        seeds.map((seed) => ({
          name: seed.name,
          slug: seed.slug,
          updatedAt: context.nowIso,
        })),
      )
      .onConflictDoUpdate({
        target: tags.slug,
        targetWhere: isNull(tags.deletedAt),
        set: {
          name: sql`excluded.name`,
          updatedAt: context.nowIso,
        },
        setWhere: sql`
          ${tags.name} IS DISTINCT FROM excluded.name
        `,
      })
      .returning({
        inserted: sql<boolean>`xmax = 0`,
      });

    const inserted = touchedRows.filter((row) => row.inserted).length;
    const updated = touchedRows.length - inserted;
    const skipped = seeds.length - touchedRows.length;

    return {
      domain: 'tags',
      inserted,
      updated,
      skipped,
    };
  },
});

const SEED_DOMAINS: readonly SeedDomain[] = [
  seedUsersDomain(USER_SEEDS),
  seedCategoriesDomain(CATEGORY_SEEDS),
  seedTagsDomain(TAG_SEEDS),
  // Add future domains here:
  // seedQuizzesDomain(...),
  // seedQuizVersionsDomain(...),
  // seedQuizQuestionsDomain(...),
  // seedQuizAnswerOptionsDomain(...),
];

const runSeed = async (): Promise<void> => {
  const context: SeedContext = {
    nowIso: new Date().toISOString(),
  };

  const summaries = await db.transaction(async (tx) => {
    const results: SeedSummary[] = [];

    for (const domain of SEED_DOMAINS) {
      const result = await domain.run(tx, context);
      results.push(result);
    }

    return results;
  });

  console.log('Seed completed successfully.');

  for (const summary of summaries) {
    console.log(
      `${summary.domain}: inserted=${summary.inserted}, updated=${summary.updated}, skipped=${summary.skipped}`,
    );
  }

  console.log('Seeded users (email / password):');

  for (const user of USER_SEEDS) {
    console.log(`- ${normalizeEmail(user.email)} / ${user.password} (${user.role})`);
  }
};

runSeed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await pool.end();
  });
