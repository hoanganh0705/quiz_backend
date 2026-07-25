import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, count, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  isPostgresForeignKeyViolation,
  isPostgresUniqueViolation,
} from '@/common/utils/db-error.util';
import { QuizVersionNotFoundError } from '@/modules/quiz/domain/errors';
import { InstanceOptimisticLockError } from '@/modules/instance/domain/errors';
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

  /**
   * Translate raw Postgres errors raised while inserting a `quiz_instances`
   * row. Today only one FK violation is recoverable into a domain error:
   * missing `quiz_versions.quiz_version_id` → 404 `QUIZ_VERSION_NOT_FOUND`.
   * Other unique/foreign-key violations bubble up unchanged.
   */
  private mapCreateInstanceError(error: unknown): never {
    if (isPostgresForeignKeyViolation(error)) {
      throw new QuizVersionNotFoundError();
    }
    throw error;
  }

  async createInstance(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string }> {
    try {
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
    } catch (error) {
      this.mapCreateInstanceError(error);
    }
  }

  async createInstanceWithHost(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string; hostPlayerId: string }> {
    const existingTx = this.transactionalContext?.getDbClient() as DrizzleDB | null;

    const executeCreate = async (
      tx: unknown,
    ): Promise<{ instanceId: string; hostPlayerId: string }> => {
      const db = tx as DrizzleDB;

      const [instance] = await db
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

      const [player] = await db
        .insert(quizInstancePlayers)
        .values({
          instanceId: instance.instanceId,
          userId: params.hostUserId,
          status: 'joined',
          joinedAt: params.nowIso,
        })
        .returning({ instancePlayerId: quizInstancePlayers.instancePlayerId });

      return { instanceId: instance.instanceId, hostPlayerId: player.instancePlayerId };
    };

    try {
      if (existingTx) {
        // Already inside a transaction (e.g., a @Transactional controller handler
        // opened an outer transaction) — reuse it as a savepoint.
        return await executeCreate(existingTx);
      }

      return await this.db.transaction(async (tx) => executeCreate(tx));
    } catch (error) {
      this.mapCreateInstanceError(error);
    }
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
        version: quizInstances.version,
        countdownStartedAt: quizInstances.countdownStartedAt,
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
    countdownStartedAt?: string | null;
    expectedVersion: number;
  }): Promise<{ version: number }> {
    // Phase 1 (Foundational Correctness) — optimistic locking.
    // The UPDATE is conditional on `version = $expectedVersion`; the
    // version is then incremented atomically (`version = version + 1`)
    // inside the same statement. A zero-row result means another writer
    // won the race; we translate it into a domain error so the caller
    // can decide whether to retry or surface a 409.
    const update: Record<string, unknown> = {
      status: params.status,
      updatedAt: params.nowIso,
      version: sql`${quizInstances.version} + 1`,
    };
    if (params.startedAt) update.startedAt = params.startedAt;
    if (params.closedAt) update.closedAt = params.closedAt;
    // Phase 2 — explicit `null` clears the countdown anchor; `undefined`
    // leaves it untouched (used by `start`/`close` which don't touch it).
    if (params.countdownStartedAt !== undefined) {
      update.countdownStartedAt = params.countdownStartedAt;
    }

    const [row] = await this.db
      .update(quizInstances)
      .set(update)
      .where(
        and(
          eq(quizInstances.instanceId, params.instanceId),
          eq(quizInstances.version, params.expectedVersion),
        ),
      )
      .returning({ version: quizInstances.version });

    if (!row) {
      // Either the row was deleted, or another writer transitioned it
      // first. Either way the caller's observed version is stale.
      throw new InstanceOptimisticLockError();
    }

    return { version: row.version };
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — finds all countdown instances whose
   * deadline has elapsed. The scheduler calls this on each tick and
   * transitions the returned rows into `running`.
   *
   * The query hits the partial index `idx_quiz_instances_countdown_due`
   * defined alongside the column. Each row carries the optimistic-lock
   * `version`, which the scheduler passes back into
   * `updateInstanceStatus` so concurrent host-driven transitions still
   * surface as a clean 409 instead of a silent overwrite.
   */
  async findDueCountdowns(params: { nowIso: string; limit: number }): Promise<
    Array<{
      instanceId: string;
      version: number;
      countdownStartedAt: string;
    }>
  > {
    const rows = await this.db
      .select({
        instanceId: quizInstances.instanceId,
        version: quizInstances.version,
        countdownStartedAt: quizInstances.countdownStartedAt,
      })
      .from(quizInstances)
      .where(
        and(
          eq(quizInstances.status, 'countdown'),
          lte(quizInstances.countdownStartedAt, params.nowIso),
          isNotNull(quizInstances.countdownStartedAt),
        ),
      )
      .orderBy(quizInstances.countdownStartedAt)
      .limit(params.limit);

    return rows
      .filter((r): r is typeof r & { countdownStartedAt: string } => r.countdownStartedAt !== null)
      .map((r) => ({
        instanceId: r.instanceId,
        version: r.version,
        countdownStartedAt: r.countdownStartedAt,
      }));
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

      // Phase 1 (Foundational Correctness) — row-level locking.
      // Take an exclusive lock on the instance row for the duration of
      // this transaction. Two concurrent `joinInstance` calls against
      // the same instance now serialize: the second one waits for the
      // first to commit, then re-reads the (now-incremented) player
      // count and rejects at capacity.
      //
      // Without this lock, the count-then-insert pattern below could
      // see `count = maxPlayers - 1` and let the second writer through,
      // producing `maxPlayers + 1` rows on capacity exhaustion.
      //
      // `FOR UPDATE` matches Postgres' default `READ COMMITTED`
      // isolation: it acquires a row-level write lock that other
      // transactions block on until commit/rollback.
      await db.execute(
        sql`SELECT 1 FROM ${quizInstances} WHERE ${quizInstances.instanceId} = ${params.instanceId} FOR UPDATE`,
      );

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
    // The leaderboard needs a windowed `row_number()` for ranking, but
    // Postgres forbids using a window function directly inside a `WHERE`
    // clause. Wrap the windowed projection in a CTE, then filter the
    // cursor pagination (`rowRank`, `instancePlayerId`) on the outer
    // query. `rowRank` is also cast to `int` so the wire shape matches
    // the DTO/contract (number), instead of the Drizzle/PG default
    // serialization as a string.
    const ranked = this.db.$with('leaderboard_ranked').as(
      this.db
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
          scorePercent: sql<number | null>`${quizAttempts.scorePercent}::double precision`.as(
            'score_percent',
          ),
          correctCount: quizAttempts.correctCount,
          timeTakenMs: quizAttempts.timeTakenMs,
          rowRank: sql<number>`row_number() over (
            order by ${quizAttempts.scorePercent} desc nulls last,
                     ${quizAttempts.timeTakenMs} asc nulls last,
                     ${quizInstances.instanceId} asc,
                     /* Phase 2 (issue 8.4): stable tiebreaker. When every
                        sort key above is NULL or tied (e.g. no attempt
                        submitted yet), Postgres previously returned an
                        implementation-defined order across requests. Use
                        joinedAt ASC so the leaderboard is deterministic
                        even for players who have not finished their attempt. */
                     ${quizInstancePlayers.joinedAt} asc
          )::int`.as('row_rank'),
        })
        .from(quizInstancePlayers)
        .innerJoin(users, eq(quizInstancePlayers.userId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .leftJoin(quizAttempts, eq(quizInstancePlayers.attemptId, quizAttempts.attemptId))
        .innerJoin(quizInstances, eq(quizInstancePlayers.instanceId, quizInstances.instanceId))
        .where(eq(quizInstancePlayers.instanceId, params.instanceId)),
    );

    const outerConditions = [eq(ranked.instanceId, params.instanceId)];
    if (params.cursor) {
      // Cursor = last item of previous page (rank, instancePlayerId).
      // Rows after the cursor: rank > cursor.rank, OR same rank but instancePlayerId > cursor.instancePlayerId.
      outerConditions.push(
        sql`(
          (${ranked.rowRank} > ${params.cursor.rank})
          OR (${ranked.rowRank} = ${params.cursor.rank} AND ${ranked.instancePlayerId} > ${params.cursor.instancePlayerId})
        )`,
      );
    }

    const rows = await this.db
      .with(ranked)
      .select({
        instancePlayerId: ranked.instancePlayerId,
        instanceId: ranked.instanceId,
        userId: ranked.userId,
        attemptId: ranked.attemptId,
        status: ranked.status,
        joinedAt: ranked.joinedAt,
        leftAt: ranked.leftAt,
        username: ranked.username,
        displayName: ranked.displayName,
        avatarUrl: ranked.avatarUrl,
        scorePercent: ranked.scorePercent,
        correctCount: ranked.correctCount,
        timeTakenMs: ranked.timeTakenMs,
        rowRank: ranked.rowRank,
      })
      .from(ranked)
      .where(and(...outerConditions))
      .orderBy(ranked.rowRank, ranked.instancePlayerId)
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
      quizId?: string;
      creatorId?: string;
    };
  }): Promise<import('@/modules/instance/domain/ports').QuizInstanceListRow[]> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (params.filters?.status) {
      conditions.push(
        eq(
          quizInstances.status,
          params.filters.status as 'open' | 'countdown' | 'running' | 'closed' | 'finished',
        ),
      );
    }
    if (params.filters?.difficulty) {
      conditions.push(eq(QUIZ_VERSION_COLUMNS.difficulty, params.filters.difficulty));
    }
    if (params.filters?.quizId) {
      conditions.push(eq(QUIZ_COLUMNS.quizId, params.filters.quizId));
    }
    if (params.filters?.creatorId) {
      conditions.push(eq(QUIZ_COLUMNS.creatorId, params.filters.creatorId));
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
    limit: number;
    cursor?: { joinedAt: string; instancePlayerId: string } | null;
  }): Promise<{
    items: import('@/modules/instance/domain/ports').InstancePlayerWithProfile[];
    hasNextPage: boolean;
  }> {
    const conditions = [eq(quizInstancePlayers.instanceId, params.instanceId)];

    if (params.cursor) {
      // Cursor = last `(joinedAt, instancePlayerId)` of the previous page.
      // Rows after the cursor: joinedAt > cursor.joinedAt, OR same joinedAt
      // but instancePlayerId > cursor.instancePlayerId. Matches the
      // leaderboard's tiebreaker plumbing so the players list is
      // deterministic across pages.
      conditions.push(
        sql`(${quizInstancePlayers.joinedAt}, ${quizInstancePlayers.instancePlayerId}) > (${params.cursor.joinedAt}, ${params.cursor.instancePlayerId})`,
      );
    }

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
      .where(and(...conditions))
      .orderBy(quizInstancePlayers.joinedAt, quizInstancePlayers.instancePlayerId)
      // Fetch one extra row to detect `hasNextPage` without a second round-trip.
      .limit(params.limit + 1);

    const hasNextPage = rows.length > params.limit;
    const items = (
      hasNextPage ? rows.slice(0, params.limit) : rows
    ) as import('@/modules/instance/domain/ports').InstancePlayerWithProfile[];

    return { items, hasNextPage };
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
