import { eq, and } from 'drizzle-orm';
import { db, type SeedContext } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  bookmarkCollections,
  bookmarkedQuizzes,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const COLLECTION_SEEDS = [
  {
    name: 'Favorites',
    description: 'My favorite quizzes to revisit.',
    userUsername: 'learner_user',
    quizSlugs: ['javascript-fundamentals', 'system-design-v2'],
  },
  {
    name: 'Study Plan',
    description: 'Quizzes to complete this month.',
    userUsername: 'power_user',
    quizSlugs: ['algorithms-advanced', 'system-design-v2', 'javascript-fundamentals'],
  },
  {
    name: 'Work Progress',
    description: 'Tracking my learning journey.',
    userUsername: 'learner_user',
    quizSlugs: ['javascript-fundamentals'],
  },
];

export { COLLECTION_SEEDS };

export const runBookmarkSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let collectionsUpserted = 0;
    let quizzesBookmarked = 0;

    for (const collection of COLLECTION_SEEDS) {
      const userId = await lookup.userIdByUsername(collection.userUsername);

      // Find or create the collection (user-scoped by name)
      const [existing] = await tx
        .select({ collectionId: bookmarkCollections.collectionId })
        .from(bookmarkCollections)
        .where(
          and(
            eq(bookmarkCollections.userId, userId),
            eq(bookmarkCollections.name, collection.name),
          ),
        )
        .limit(1);

      let collectionId: string;

      if (existing) {
        collectionId = existing.collectionId;
        await tx
          .update(bookmarkCollections)
          .set({ description: collection.description, updatedAt: ctx.nowIso })
          .where(eq(bookmarkCollections.collectionId, collectionId));
        collectionsUpserted++;
      } else {
        const [created] = await tx
          .insert(bookmarkCollections)
          .values({
            userId,
            name: collection.name,
            description: collection.description,
            createdAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          })
          .returning({ collectionId: bookmarkCollections.collectionId });
        collectionId = created.collectionId;
        collectionsUpserted++;
      }

      for (const quizSlug of collection.quizSlugs) {
        const quizId = await lookup.quizIdBySlug(quizSlug);
        if (!quizId) {
          logger.warn(`Bookmark seed: quiz "${quizSlug}" not found, skipping`);
          continue;
        }

        const [existingBookmark] = await tx
          .select({ bookmarkId: bookmarkedQuizzes.bookmarkId })
          .from(bookmarkedQuizzes)
          .where(
            and(
              eq(bookmarkedQuizzes.collectionId, collectionId),
              eq(bookmarkedQuizzes.quizId, quizId),
            ),
          )
          .limit(1);

        if (!existingBookmark) {
          await tx.insert(bookmarkedQuizzes).values({
            collectionId,
            quizId,
            notes: null,
            bookmarkedAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          });
        }

        quizzesBookmarked++;
        logger.info(`Bookmarked "${quizSlug}" in "${collection.name}" for ${collection.userUsername}`);
      }
    }

    summaries.push({
      domain: 'bookmarks',
      inserted: collectionsUpserted,
      updated: 0,
      skipped: 0,
    });
  });

  return summaries;
};
