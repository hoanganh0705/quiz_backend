import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

  async getPlayerById(
    instancePlayerId: string,
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
      .where(eq(quizInstancePlayers.instancePlayerId, instancePlayerId))
      .limit(1);

    return (
      (row as import('@/modules/instance/domain/ports').QuizInstancePlayerRow | undefined) ?? null
    );
  }

  async getPlayerDetail(
    instanceId: string,
    userId: string,
  ): Promise<import('@/modules/instance/domain/ports').QuizInstancePlayerDetailRow | null> {
    const [row] = await this.db
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
      })
      .from(quizInstancePlayers)
      .innerJoin(users, eq(quizInstancePlayers.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(eq(quizInstancePlayers.instanceId, instanceId), eq(quizInstancePlayers.userId, userId)),
      )
      .limit(1);

    return (
      (row as import('@/modules/instance/domain/ports').QuizInstancePlayerDetailRow | undefined) ??
      null
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

  async updatePlayerStatus(params: {
    instancePlayerId: string;
    status: string;
    attemptId?: string | null;
    nowIso: string;
  }): Promise<void> {
    const update: Record<string, unknown> = {
      status: params.status,
    };
    if (params.attemptId !== undefined) update.attemptId = params.attemptId;

    await this.db
      .update(quizInstancePlayers)
      .set(update)
      .where(eq(quizInstancePlayers.instancePlayerId, params.instancePlayerId));
  }

  async updatePlayerByInstanceAndUser(params: {
    instanceId: string;
    userId: string;
    status: string;
    attemptId?: string | null;
  }): Promise<void> {
    const update: Record<string, unknown> = {
      status: params.status,
    };
    if (params.attemptId !== undefined) update.attemptId = params.attemptId;

    await this.db
      .update(quizInstancePlayers)
      .set(update)
      .where(
        and(
          eq(quizInstancePlayers.instanceId, params.instanceId),
          eq(quizInstancePlayers.userId, params.userId),
        ),
      );
  }

  async getLeaderboard(
    instanceId: string,
  ): Promise<import('@/modules/instance/domain/ports').InstanceLeaderboardEntry[]> {
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
      })
      .from(quizInstancePlayers)
      .innerJoin(users, eq(quizInstancePlayers.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(quizAttempts, eq(quizInstancePlayers.attemptId, quizAttempts.attemptId))
      .where(eq(quizInstancePlayers.instanceId, instanceId))
      .orderBy(desc(quizAttempts.scorePercent), quizAttempts.timeTakenMs);

    return rows.map((row, index) => ({
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
      rank: index + 1,
    })) as import('@/modules/instance/domain/ports').InstanceLeaderboardEntry[];
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
}
