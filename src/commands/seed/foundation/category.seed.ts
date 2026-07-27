import { and, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext, recorder } from '../infrastructure';
import {
  assertUniqueBy,
  normalizeCategorySeeds,
  normalizeSlug,
  trimText,
} from '../infrastructure/utils';
import type { NormalizedCategorySeed, RawCategorySeed, SeedDomain, SeedSummary } from '../infrastructure/types';
import { categories } from '@/core/database/schema';

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

export { CATEGORY_SEEDS };

export const createCategoriesDomain = (): SeedDomain => ({
  domain: 'categories',
  run: async (tx: SeedTx, ctx: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeCategorySeeds(CATEGORY_SEEDS);

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

    // Always return rows to populate the SEED_RECORD with IDs and timestamps.
    // Using COALESCE in the setWhere means "no update needed" rows are still
    // returned (the condition evaluates to true via COALESCE).
    const touchedRows = await tx
      .insert(categories)
      .values(
        seeds.map((seed) => ({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          imageUrl: seed.imageUrl,
          updatedAt: ctx.nowIso,
        })),
      )
      .onConflictDoUpdate({
        target: categories.slug,
        targetWhere: isNull(categories.deletedAt),
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          imageUrl: sql`excluded.image_url`,
          updatedAt: ctx.nowIso,
        },
        // Always evaluate to true so RETURNING includes all rows (inserted and updated).
        setWhere: sql`true`,
      })
      .returning({
        categoryId: categories.categoryId,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        imageUrl: categories.imageUrl,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        inserted: sql<boolean>`xmax = 0`,
      });

    const rowBySlug = new Map(touchedRows.map((row) => [row.slug, row]));
    const insertedCount = touchedRows.filter((row) => row.inserted).length;
    const updatedCount = touchedRows.length - insertedCount;

    for (const seed of seeds) {
      const row = rowBySlug.get(seed.slug);
      recorder.record({
        kind: 'Categories',
        id: seed.slug,
        fields: {
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          categoryId: row?.categoryId ?? '',
        },
        details: {
          categoryId: row?.categoryId ?? null,
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          imageUrl: row?.imageUrl ?? null,
          createdAt: row?.createdAt ?? null,
          updatedAt: row?.updatedAt ?? null,
        },
      });
    }

    return {
      domain: 'categories',
      inserted: insertedCount,
      updated: updatedCount,
      skipped: 0,
    };
  },
});

export const runCategoriesSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  return db.transaction(async (tx) => createCategoriesDomain().run(tx, ctx));
};
