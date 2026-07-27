import { and, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, type SeedTx, type SeedContext, recorder } from '../infrastructure';
import { assertUniqueBy, normalizeSlug, normalizeTagSeeds } from '../infrastructure/utils';
import type { NormalizedTagSeed, RawTagSeed, SeedDomain, SeedSummary } from '../infrastructure/types';
import { tags } from '@/core/database/schema';

const TAG_SEEDS: readonly RawTagSeed[] = [
  { name: 'Physics', slug: 'physics' },
  { name: 'Chemistry', slug: 'chemistry' },
  { name: 'Biology', slug: 'biology' },
  { name: 'Math', slug: 'math' },
  { name: 'Programming', slug: 'programming' },
  { name: 'Algorithms', slug: 'algorithms' },
  { name: 'General Knowledge', slug: 'general-knowledge' },
  { name: 'World History', slug: 'world-history' },
];

export { TAG_SEEDS };

export const createTagsDomain = (): SeedDomain => ({
  domain: 'tags',
  run: async (tx: SeedTx, ctx: SeedContext): Promise<SeedSummary> => {
    const seeds = normalizeTagSeeds(TAG_SEEDS);

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

    // Always return rows to populate the SEED_RECORD with IDs and timestamps.
    // Using COALESCE in the setWhere means "no update needed" rows are still
    // returned (the condition evaluates to true via COALESCE).
    const touchedRows = await tx
      .insert(tags)
      .values(
        seeds.map((seed) => ({
          name: seed.name,
          slug: seed.slug,
          updatedAt: ctx.nowIso,
        })),
      )
      .onConflictDoUpdate({
        target: tags.slug,
        targetWhere: isNull(tags.deletedAt),
        set: {
          name: sql`excluded.name`,
          updatedAt: ctx.nowIso,
        },
        // Always evaluate to true so RETURNING includes all rows (inserted or updated).
        setWhere: sql`true`,
      })
      .returning({
        tagId: tags.tagId,
        slug: tags.slug,
        name: tags.name,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        inserted: sql<boolean>`xmax = 0`,
      });

    const rowBySlug = new Map(touchedRows.map((row) => [row.slug, row]));
    const insertedCount = touchedRows.filter((row) => row.inserted).length;
    const updatedCount = touchedRows.length - insertedCount;

    for (const seed of seeds) {
      const row = rowBySlug.get(seed.slug);
      recorder.record({
        kind: 'Tags',
        id: seed.slug,
        fields: {
          slug: seed.slug,
          name: seed.name,
          tagId: row?.tagId ?? '',
        },
        details: {
          tagId: row?.tagId ?? null,
          slug: seed.slug,
          name: seed.name,
          createdAt: row?.createdAt ?? null,
          updatedAt: row?.updatedAt ?? null,
        },
      });
    }

    return {
      domain: 'tags',
      inserted: insertedCount,
      updated: updatedCount,
      skipped: 0,
    };
  },
});

export const runTagsSeed = async (): Promise<SeedSummary> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  return db.transaction(async (tx) => createTagsDomain().run(tx, ctx));
};
