import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
import {
  quizInstances,
  quizInstancePlayers,
  quizVersions,
  quizzes,
  users,
  userProfiles,
  quizAttempts,
} from '@/core/database/schema';
import type { QuizInstanceRepositoryPort } from '@/modules/instance/domain/ports';

const QUIZ_INSTANCE_COLUMNS = quizInstances as unknown as {
  quizVersionId: AnyPgColumn;
  hostUserId: AnyPgColumn;
};

const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  quizId: AnyPgColumn;
  versionNumber: AnyPgColumn;
  difficulty: AnyPgColumn;
  durationMs: AnyPgColumn;
  passingScorePercent: AnyPgColumn;
  rewardXp: AnyPgColumn;
};

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  title: AnyPgColumn;
  slug: AnyPgColumn;
  creatorId: AnyPgColumn;
};

@Injectable()
export class QuizInstanceRepository implements QuizInstanceRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
  ) {}

  async createInstance(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string }> {
    const [result] = await this.db
      .insert(quizInstances)
      .values({
        quizVersionId: params.quizVersionId,
        hostUserId: params.hostUserId,
        maxPlayers: params.maxPlayers,
        status: 'open',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({ instanceId: quizInstances.instanceId });

    return { instanceId: result.instanceId };
  }

  async createInstanceWithHost(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string; hostPlayerId: string }> {
    const existingTx = this.transactionalContext?.getDbClient() as DrizzleDB | null;

    if (existingTx) {
      // Already inside a transaction (e.g., a @Transactional controller handler
      // opened an outer transaction) — reuse it as a savepoint.
      const [instance] = await existingTx
        .insert(quizInstances)
        .values({
          quizVersionId: params.quizVersionId,
          hostUserId: params.hostUserId,
          maxPlayers: params.maxPlayers,
          status: 'open',
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning({ instanceId: quizInstances.instanceId });

      const [player] = await existingTx
        .insert(quizInstancePlayers)
        .values({
          instanceId: instance.instanceId,
          userId: params.hostUserId,
          status: 'joined',
          joinedAt: params.nowIso,
        })
        .returning({ instancePlayerId: quizInstancePlayers.instancePlayerId });

      return { instanceId: instance.instanceId, hostPlayerId: player.instancePlayerId };
    }

    return this.db.transaction(async (tx) => {
      const [instance] = await tx
        .insert(quizInstances)
        .values({
          quizVersionId: params.quizVersionId,
          hostUserId: params.hostUserId,
          maxPlayers: params.maxPlayers,
          status: 'open',
          createdAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .returning({ instanceId: quizInstances.instanceId });

      const [player] = await tx
        .insert(quizInstancePlayers)
        .values({
          instanceId: instance.instanceId,
          userId: params.hostUserId,
          status: 'joined',
          joinedAt: params.nowIso,
        })
        .returning({ instancePlayerId: quizInstancePlayers.instancePlayerId });

      return { instanceId: instance.instanceId, hostPlayerId: player.instancePlayerId };
    });
  }

  async getInstanceById(
    instanceId: string,
  ): Promise<import('@/modules/instance/domain/ports').QuizInstanceRow | null> {
    const [row] = await this.db
      .select({
        instanceId: quizInstances.instanceId,
        quizVersionId: quizInstances.quizVersionId,
        hostUserId: quizInstances.hostUserId,
        maxPlayers: quizInstances.maxPlayers,
        status: quizInstances.status,
        createdAt: quizInstances.createdAt,
        startedAt: quizInstances.startedAt,
        closedAt: quizInstances.closedAt,
        updatedAt: quizInstances.updatedAt,
      })
      .from(quizInstances)
      .where(eq(quizInstances.instanceId, instanceId))
      .limit(1);

    return (row as import('@/modules/instance/domain/ports').QuizInstanceRow | undefined) ?? null;
  }

  async getInstanceDetailById(
    instanceId: string,
  ): Promise<import('@/modules/instance/domain/ports').QuizInstanceDetailRow | null> {
    const [row] = await this.db
      .select({
        instanceId: quizInstances.instanceId,
        quizVersionId: quizInstances.quizVersionId,
        hostUserId: quizInstances.hostUserId,
        maxPlayers: quizInstances.maxPlayers,
        status: quizInstances.status,
        createdAt: quizInstances.createdAt,
        startedAt: quizInstances.startedAt,
        closedAt: quizInstances.closedAt,
        updatedAt: quizInstances.updatedAt,
        versionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
        difficulty: QUIZ_VERSION_COLUMNS.difficulty,
        durationMs: QUIZ_VERSION_COLUMNS.durationMs,
        passingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
        rewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
        quizId: QUIZ_COLUMNS.quizId,
        quizTitle: QUIZ_COLUMNS.title,
        quizSlug: QUIZ_COLUMNS.slug,
        quizCreatorId: QUIZ_COLUMNS.creatorId,
        hostUsername: users.username,
        hostDisplayName: userProfiles.displayName,
      })
      .from(quizInstances)
      .innerJoin(
        quizVersions,
        eq(QUIZ_INSTANCE_COLUMNS.quizVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .innerJoin(users, eq(QUIZ_INSTANCE_COLUMNS.hostUserId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(quizInstances.instanceId, instanceId))
      .limit(1);

    return (
      (row as import('@/modules/instance/domain/ports').QuizInstanceDetailRow | undefined) ?? null
    );
  }

  async updateInstanceStatus(params: {
    instanceId: string;
    status: string;
    nowIso: string;
    startedAt?: string;
    closedAt?: string;
  }): Promise<void> {
    const update: Record<string, unknown> = {
      status: params.status,
      updatedAt: params.nowIso,
    };
    if (params.startedAt) update.startedAt = params.startedAt;
    if (params.closedAt) update.closedAt = params.closedAt;

    await this.db
      .update(quizInstances)
      .set(update)
      .where(eq(quizInstances.instanceId, params.instanceId));
  }

  async getPlayer(
    instanceId: string,
    userId: string,
  ): Promise<import('@/modules/instance/domain/ports').QuizInstancePlayerRow | null> {
    const [row] = await this.db
      .select({
        instancePlayerId: quizInstancePlayers.instancePlayerId,
        instanceId: quizInstancePlayers.instanceId,
        userId: quizInstancePlayers.userId,
        attemptId: quizInstancePlayers.attemptId,
        status: quizInstancePlayers.status,
        joinedAt: quizInstancePlayers.joinedAt,
        leftAt: quizInstancePlayers.leftAt,
      })
      .from(quizInstancePlayers)
      .where(
        and(eq(quizInstancePlayers.instanceId, instanceId), eq(quizInstancePlayers.userId, userId)),
      )
      .limit(1);

    return (
      (row as import('@/modules/instance/domain/ports').QuizInstancePlayerRow | undefined) ?? null
    );
  }

  async listPlayers(
    instanceId: string,
  ): Promise<import('@/modules/instance/domain/ports').QuizInstancePlayerRow[]> {
    const rows = await this.db
      .select({
        instancePlayerId: quizInstancePlayers.instancePlayerId,
        instanceId: quizInstancePlayers.instanceId,
        userId: quizInstancePlayers.userId,
        attemptId: quizInstancePlayers.attemptId,
        status: quizInstancePlayers.status,
        joinedAt: quizInstancePlayers.joinedAt,
        leftAt: quizInstancePlayers.leftAt,
      })
      .from(quizInstancePlayers)
      .where(eq(quizInstancePlayers.instanceId, instanceId))
      .orderBy(quizInstancePlayers.joinedAt);

    return rows as import('@/modules/instance/domain/ports').QuizInstancePlayerRow[];
  }

  async addPlayer(params: {
    instanceId: string;
    userId: string;
    nowIso: string;
  }): Promise<import('@/modules/instance/domain/ports').QuizInstancePlayerRow> {
    const [row] = await this.db
      .insert(quizInstancePlayers)
      .values({
        instanceId: params.instanceId,
        userId: params.userId,
        status: 'joined',
        joinedAt: params.nowIso,
      })
      .returning({
        instancePlayerId: quizInstancePlayers.instancePlayerId,
        instanceId: quizInstancePlayers.instanceId,
        userId: quizInstancePlayers.userId,
        attemptId: quizInstancePlayers.attemptId,
        status: quizInstancePlayers.status,
        joinedAt: quizInstancePlayers.joinedAt,
        leftAt: quizInstancePlayers.leftAt,
      });

    return row as import('@/modules/instance/domain/ports').QuizInstancePlayerRow;
  }

  async joinInstanceAtomic(params: {
    instanceId: string;
    userId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{
    joined: boolean;
    player?: import('@/modules/instance/domain/ports').QuizInstancePlayerRow;
  }> {
    const existingTx = this.transactionalContext?.getDbClient() as DrizzleDB | null;

    const executeJoin = async (
      tx: unknown,
    ): Promise<{
      joined: boolean;
      player?: import('@/modules/instance/domain/ports').QuizInstancePlayerRow;
    }> => {
      const db = tx as DrizzleDB;

      const [existing] = await db
        .select({ instancePlayerId: quizInstancePlayers.instancePlayerId })
        .from(quizInstancePlayers)
        .where(
          and(
            eq(quizInstancePlayers.instanceId, params.instanceId),
            eq(quizInstancePlayers.userId, params.userId),
          ),
        )
        .limit(1);

      if (existing) {
        return { joined: false };
      }

      if (params.maxPlayers !== null) {
        const [{ count: currentCount }] = await db
          .select({ count: count() })
          .from(quizInstancePlayers)
          .where(
            and(
              eq(quizInstancePlayers.instanceId, params.instanceId),
              eq(quizInstancePlayers.status, 'joined'),
            ),
          );

        if (currentCount >= params.maxPlayers) {
          throw new Error('INSTANCE_FULL');
        }
      }

      try {
        const [player] = await db
          .insert(quizInstancePlayers)
          .values({
            instanceId: params.instanceId,
            userId: params.userId,
            status: 'joined',
            joinedAt: params.nowIso,
          })
          .returning({
            instancePlayerId: quizInstancePlayers.instancePlayerId,
            instanceId: quizInstancePlayers.instanceId,
            userId: quizInstancePlayers.userId,
            attemptId: quizInstancePlayers.attemptId,
            status: quizInstancePlayers.status,
            joinedAt: quizInstancePlayers.joinedAt,
            leftAt: quizInstancePlayers.leftAt,
          });

        return {
          joined: true,
          player: player as import('@/modules/instance/domain/ports').QuizInstancePlayerRow,
        };
      } catch (error) {
        if (isPostgresUniqueViolation(error)) {
          return { joined: false };
        }
        throw error;
      }
    };

    if (existingTx) {
      return executeJoin(existingTx as unknown as DrizzleDB);
    }

    return this.db.transaction(async (tx) => executeJoin(tx));
  }

  async getLeaderboard(params: {
    instanceId: string;
    limit: number;
    cursor?: import('@/modules/instance/domain/ports').LeaderboardCursorPayload | null;
  }): Promise<{
    items: import('@/modules/instance/domain/ports').InstanceLeaderboardEntry[];
    hasNextPage: boolean;
  }> {
    const conditions = [eq(quizInstancePlayers.instanceId, params.instanceId)];

    if (params.cursor) {
      // Cursor = last item of previous page (rank, instancePlayerId).
      // Rows after the cursor: rank > cursor.rank, OR same rank but instancePlayerId > cursor.instancePlayerId.
      conditions.push(
        sql`(
          (row_rank > ${params.cursor.rank})
          OR (row_rank = ${params.cursor.rank} AND ${quizInstancePlayers.instancePlayerId} > ${params.cursor.instancePlayerId})
        )`,
      );
    }

    const rows = await this.db
      .select({
        instancePlayerId: quizInstancePlayers.instancePlayerId,
        instanceId: quizInstancePlayers.instanceId,
        userId: quizInstancePlayers.userId,
        attemptId: quizInstancePlayers.attemptId,
        status: quizInstancePlayers.status,
        joinedAt: quizInstancePlayers.joinedAt,
        leftAt: quizInstancePlayers.leftAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        timeTakenMs: quizAttempts.timeTakenMs,
        rowRank: sql<number>`row_number() over (
          order by ${quizAttempts.scorePercent} desc nulls last,
                   ${quizAttempts.timeTakenMs} asc nulls last,
                   ${quizInstances.instanceId} asc
        )`.as('row_rank'),
      })
      .from(quizInstancePlayers)
      .innerJoin(users, eq(quizInstancePlayers.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(quizAttempts, eq(quizInstancePlayers.attemptId, quizAttempts.attemptId))
      .innerJoin(quizInstances, eq(quizInstancePlayers.instanceId, quizInstances.instanceId))
      .where(and(...conditions))
      .orderBy(
        desc(quizAttempts.scorePercent),
        quizAttempts.timeTakenMs,
        quizInstancePlayers.instancePlayerId,
      )
      .limit(params.limit + 1);

    const hasNextPage = rows.length > params.limit;
    if (hasNextPage) {
      rows.pop();
    }

    return {
      items: rows.map((row) => ({
        instancePlayerId: row.instancePlayerId,
        instanceId: row.instanceId,
        userId: row.userId,
        attemptId: row.attemptId,
        status: row.status,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        scorePercent: row.scorePercent,
        correctCount: row.correctCount,
        timeTakenMs: row.timeTakenMs,
        rank: row.rowRank,
      })) as import('@/modules/instance/domain/ports').InstanceLeaderboardEntry[],
      hasNextPage,
    };
  }

  async countPlayers(instanceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(quizInstancePlayers)
      .where(
        and(
          eq(quizInstancePlayers.instanceId, instanceId),
          eq(quizInstancePlayers.status, 'joined'),
        ),
      );

    return row?.count ?? 0;
  }

  async linkAttemptToPlayer(params: {
    instanceId: string;
    userId: string;
    attemptId: string;
    status: string;
  }): Promise<void> {
    await this.db
      .update(quizInstancePlayers)
      .set({
        attemptId: params.attemptId,
        status: params.status,
      })
      .where(
        and(
          eq(quizInstancePlayers.instanceId, params.instanceId),
          eq(quizInstancePlayers.userId, params.userId),
        ),
      );
  }

  async updatePlayerStatus(params: {
    instanceId: string;
    userId: string;
    status: string;
  }): Promise<void> {
    await this.db
      .update(quizInstancePlayers)
      .set({ status: params.status })
      .where(
        and(
          eq(quizInstancePlayers.instanceId, params.instanceId),
          eq(quizInstancePlayers.userId, params.userId),
        ),
      );
  }

  async getPlayerByUserAndInstance(params: {
    instanceId: string;
    userId: string;
  }): Promise<import('@/modules/instance/domain/ports').QuizInstancePlayerRow | null> {
    return this.getPlayer(params.instanceId, params.userId);
  }

  async listInstances(params: {
    limit: number;
    cursor?: import('@/modules/instance/domain/ports').InstanceCursorPayload | null;
    filters?: {
      status?: string;
      difficulty?: string;
    };
  }): Promise<import('@/modules/instance/domain/ports').QuizInstanceListRow[]> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (params.filters?.status) {
      conditions.push(
        eq(
          quizInstances.status,
          params.filters.status as 'open' | 'running' | 'closed' | 'finished',
        ),
      );
    }
    if (params.filters?.difficulty) {
      conditions.push(eq(QUIZ_VERSION_COLUMNS.difficulty, params.filters.difficulty));
    }
    if (params.cursor) {
      conditions.push(
        sql`(${quizInstances.createdAt}, ${quizInstances.instanceId}) < (${params.cursor.createdAt}, ${params.cursor.instanceId})`,
      );
    }

    const rows = await this.db
      .select({
        instanceId: quizInstances.instanceId,
        quizVersionId: quizInstances.quizVersionId,
        hostUserId: quizInstances.hostUserId,
        maxPlayers: quizInstances.maxPlayers,
        status: quizInstances.status,
        createdAt: quizInstances.createdAt,
        startedAt: quizInstances.startedAt,
        closedAt: quizInstances.closedAt,
        updatedAt: quizInstances.updatedAt,
        versionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
        difficulty: QUIZ_VERSION_COLUMNS.difficulty,
        durationMs: QUIZ_VERSION_COLUMNS.durationMs,
        passingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
        rewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
        quizId: QUIZ_COLUMNS.quizId,
        quizTitle: QUIZ_COLUMNS.title,
        quizSlug: QUIZ_COLUMNS.slug,
        quizCreatorId: QUIZ_COLUMNS.creatorId,
        hostUsername: users.username,
        hostDisplayName: userProfiles.displayName,
        playerCount: sql<number>`COALESCE((
          SELECT count(*)::int
          FROM quiz_instance_players p
          WHERE p.instance_id = ${quizInstances.instanceId} AND p.status = 'joined'
        ), 0)`,
      })
      .from(quizInstances)
      .innerJoin(
        quizVersions,
        eq(QUIZ_INSTANCE_COLUMNS.quizVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .innerJoin(users, eq(QUIZ_INSTANCE_COLUMNS.hostUserId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quizInstances.createdAt), desc(quizInstances.instanceId))
      .limit(params.limit + 1);

    return rows as unknown as Promise<
      import('@/modules/instance/domain/ports').QuizInstanceListRow[]
    >;
  }

  async listPlayersWithProfile(params: {
    instanceId: string;
  }): Promise<import('@/modules/instance/domain/ports').InstancePlayerWithProfile[]> {
    const rows = await this.db
      .select({
        instancePlayerId: quizInstancePlayers.instancePlayerId,
        instanceId: quizInstancePlayers.instanceId,
        userId: quizInstancePlayers.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        status: quizInstancePlayers.status,
        attemptId: quizInstancePlayers.attemptId,
        joinedAt: quizInstancePlayers.joinedAt,
      })
      .from(quizInstancePlayers)
      .innerJoin(users, eq(quizInstancePlayers.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(quizInstancePlayers.instanceId, params.instanceId))
      .orderBy(quizInstancePlayers.joinedAt);

    return rows as import('@/modules/instance/domain/ports').InstancePlayerWithProfile[];
  }

  async countInstancesHostedByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(quizInstances)
      .where(eq(quizInstances.hostUserId, userId));

    return row?.count ?? 0;
  }

  async countFinishedInstancesByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(quizInstancePlayers)
      .where(
        and(eq(quizInstancePlayers.userId, userId), eq(quizInstancePlayers.status, 'finished')),
      );

    return row?.count ?? 0;
  }

  async getAttemptContextInfo(
    attemptId: string,
  ): Promise<import('@/modules/instance/domain/ports').AttemptContextInfo | null> {
    const [row] = await this.db
      .select({
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.attemptId, attemptId))
      .limit(1);

    return row ?? null;
  }
}
