import { db, type SeedContext } from '../infrastructure';
import type { InstanceSeed, SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import { quizInstances } from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const INSTANCE_SEEDS: InstanceSeed[] = [
  {
    quizSlug: 'javascript-fundamentals',
    versionNumber: 1,
    hostUsername: 'content_author',
    status: 'open',
    maxPlayers: 10,
  },
  {
    quizSlug: 'system-design-v2',
    versionNumber: 2,
    hostUsername: 'admin_master',
    status: 'running',
    maxPlayers: 20,
  },
];

export { INSTANCE_SEEDS };

export const runInstanceSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    for (const instance of INSTANCE_SEEDS) {
      const hostUserId = await lookup.userIdByUsername(instance.hostUsername);
      const quizVersionId = await lookup.quizVersionIdBySlugAndNumber(
        instance.quizSlug,
        instance.versionNumber,
      );

      if (!quizVersionId) {
        logger.warn(`Instance seed: quiz version not found for "${instance.quizSlug}" v${instance.versionNumber}`);
        summaries.push({ domain: `instance:${instance.quizSlug}:v${instance.versionNumber}`, inserted: 0, updated: 0, skipped: 1 });
        continue;
      }

      await tx.insert(quizInstances).values({
        quizVersionId,
        hostUserId,
        maxPlayers: instance.maxPlayers,
        status: instance.status,
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
      });

      logger.info(`Created instance for "${instance.quizSlug}" v${instance.versionNumber} (${instance.status}) hosted by ${instance.hostUsername}`);
      summaries.push({ domain: `instance:${instance.quizSlug}:v${instance.versionNumber}`, inserted: 1, updated: 0, skipped: 0 });
    }
  });

  return summaries;
};
