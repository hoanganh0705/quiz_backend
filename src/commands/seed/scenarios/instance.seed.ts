import { and, eq } from 'drizzle-orm';
import { db, type SeedContext, recorder } from '../infrastructure';
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

      const domainKey = `instance:${instance.quizSlug}:v${instance.versionNumber}`;

      if (!quizVersionId) {
        logger.warn(`Instance seed: quiz version not found for "${instance.quizSlug}" v${instance.versionNumber}`);
        summaries.push({ domain: domainKey, inserted: 0, updated: 0, skipped: 1 });
        continue;
      }

      // Idempotency: skip if an instance for this (quizVersion, host, status) already
      // exists. quiz_instances has no natural unique key, so we check explicitly
      // rather than relying on onConflictDoNothing.
      const [existing] = await tx
        .select({ instanceId: quizInstances.instanceId })
        .from(quizInstances)
        .where(
          and(
            eq(quizInstances.quizVersionId, quizVersionId),
            eq(quizInstances.hostUserId, hostUserId),
            eq(quizInstances.status, instance.status),
          ),
        )
        .limit(1);

      if (existing) {
        logger.info(
          `Skipped existing instance for "${instance.quizSlug}" v${instance.versionNumber} hosted by ${instance.hostUsername}`,
        );

        // Still record the existing instance so SEED_RECORD.md reflects
        // what's actually in the database on a re-run.
        recorder.record({
          kind: 'Quiz Instances',
          id: `${instance.quizSlug}:v${instance.versionNumber}`,
          fields: {
            quizSlug: instance.quizSlug,
            version: String(instance.versionNumber),
            host: instance.hostUsername,
            status: instance.status,
            maxPlayers: String(instance.maxPlayers ?? ''),
          },
          details: {
            instanceId: existing.instanceId,
            quizVersionId,
            quizSlug: instance.quizSlug,
            hostUserId,
            hostUsername: instance.hostUsername,
            maxPlayers: instance.maxPlayers,
            status: instance.status,
            createdAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          },
        });
        summaries.push({ domain: domainKey, inserted: 0, updated: 0, skipped: 1 });
        continue;
      }

      const [created] = await tx
        .insert(quizInstances)
        .values({
          quizVersionId,
          hostUserId,
          maxPlayers: instance.maxPlayers,
          status: instance.status,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        })
        .returning({
          instanceId: quizInstances.instanceId,
          quizVersionId: quizInstances.quizVersionId,
          hostUserId: quizInstances.hostUserId,
          status: quizInstances.status,
          createdAt: quizInstances.createdAt,
          updatedAt: quizInstances.updatedAt,
        });

      logger.info(`Created instance for "${instance.quizSlug}" v${instance.versionNumber} (${instance.status}) hosted by ${instance.hostUsername}`);

      recorder.record({
        kind: 'Quiz Instances',
        id: `${instance.quizSlug}:v${instance.versionNumber}`,
        fields: {
          quizSlug: instance.quizSlug,
          version: String(instance.versionNumber),
          host: instance.hostUsername,
          status: instance.status,
          maxPlayers: String(instance.maxPlayers ?? ''),
        },
        details: {
          instanceId: created.instanceId,
          quizVersionId: created.quizVersionId,
          quizSlug: instance.quizSlug,
          hostUserId: created.hostUserId,
          hostUsername: instance.hostUsername,
          maxPlayers: instance.maxPlayers,
          status: created.status,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      });
      summaries.push({ domain: domainKey, inserted: 1, updated: 0, skipped: 0 });
    }
  });

  return summaries;
};
