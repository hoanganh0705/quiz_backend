import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import { runWithConcurrency } from '@/common/outbox/base-outbox-processor';

import {
  quizzes,
  quizReviews,
  commentRows,
  notifications,
  tournaments,
} from '@/core/database/schema';

const DEFAULT_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS = 1;

const SOFT_DELETE_PURGE_LOCK_KEY = 'admin:cron:soft_delete_purge';
const SOFT_DELETE_PURGE_LOCK_TTL_MS = 60 * 1000;
const SOFT_DELETE_PURGE_HEARTBEAT_MS = 50 * 1000;
const SOFT_DELETE_PURGE_JOB = 'admin-soft-delete-purge';
const SOFT_DELETE_PURGE_BATCH_LIMIT = 1000;

export interface PurgeResult {
  readonly table: string;
  readonly deleted: number;
  readonly elapsedMs: number;
}

@Injectable()
export class SoftDeletePurgeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT) private readonly redisCircuit: RedisCircuitPort,
    @Optional() private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(SoftDeletePurgeService.name) private readonly logger: PinoLogger,
  ) {}

  @Cron('15 3 * * *')
  async nightlyPurge(): Promise<void> {
    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return;
    const heartbeat = setInterval(() => {
      this.cache
        .renewAdvisoryLock?.(SOFT_DELETE_PURGE_LOCK_KEY, lockToken, SOFT_DELETE_PURGE_LOCK_TTL_MS)
        .catch((err: unknown) =>
          this.logger.warn({
            event: 'soft_delete_purge_heartbeat_failed',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }, SOFT_DELETE_PURGE_HEARTBEAT_MS);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    try {
      const retentionDays = this.clampedRetentionDays();
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
      const cutoffIso = cutoff.toISOString();

      this.logger.info({
        event: 'soft_delete_purge_started',
        retentionDays,
        cutoff: cutoffIso,
      });

      await this.purgeMany(retentionDays, cutoff, cutoffIso);
    } finally {
      clearInterval(heartbeat);
      await this.cache.releaseAdvisoryLock(SOFT_DELETE_PURGE_LOCK_KEY, lockToken);
    }
  }

  async purgeOnce(retentionDays?: number): Promise<PurgeResult[]> {
    const days = retentionDays ?? this.clampedRetentionDays();
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const cutoffIso = cutoff.toISOString();
    this.logger.info({
      event: 'soft_delete_purge_manual_started',
      retentionDays: days,
      cutoff: cutoffIso,
    });
    const { results } = await this.purgeAllInto(cutoff);
    return results;
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: SOFT_DELETE_PURGE_LOCK_KEY,
      lockTtlMs: SOFT_DELETE_PURGE_LOCK_TTL_MS,
      job: SOFT_DELETE_PURGE_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'soft_delete_purge_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  private async purgeMany(retentionDays: number, cutoff: Date, cutoffIso: string): Promise<void> {
    const results = (await this.purgeAllInto(cutoff)).results;
    this.logger.info({
      event: 'soft_delete_purge_completed',
      retentionDays,
      cutoff: cutoffIso,
      totalDeleted: results.reduce((acc, r) => acc + r.deleted, 0),
      results,
    });
  }

  private async purgeAllInto(cutoff: Date): Promise<{ results: PurgeResult[] }> {
    const results: PurgeResult[] = [];

    const purgeAndRecord = async (
      target: ReturnType<typeof this.purgeableTables>[number],
    ): Promise<PurgeResult> => {
      const start = Date.now();
      try {
        const deleted = await this.purgeTable(target.table, cutoff);
        return { table: target.table, deleted, elapsedMs: Date.now() - start };
      } catch (err) {
        this.logger.error({
          event: 'soft_delete_purge_table_failed',
          table: target.table,
          message: err instanceof Error ? err.message : String(err),
        });
        return { table: target.table, deleted: 0, elapsedMs: Date.now() - start };
      }
    };

    const purgeResults = await runWithConcurrency(this.purgeableTables(), 5, purgeAndRecord);
    results.push(...purgeResults);
    return { results };
  }

  private async purgeTable(
    table: ReturnType<typeof this.purgeableTables>[number]['table'],
    cutoff: Date,
  ): Promise<number> {
    const cutoffIso = cutoff.toISOString();
    let total = 0;
    for (;;) {
      const ids = await this.selectExpiredIds(table, cutoffIso, SOFT_DELETE_PURGE_BATCH_LIMIT);
      if (ids.length === 0) break;
      const deleted = await this.deleteByIds(table, ids);
      total += deleted;
      if (ids.length < SOFT_DELETE_PURGE_BATCH_LIMIT) break;
    }
    return total;
  }

  private async selectExpiredIds(
    table: ReturnType<typeof this.purgeableTables>[number]['table'],
    cutoffIso: string,
    limit: number,
  ): Promise<string[]> {
    const sqlFragment = this.buildSelectIdsSql(table, cutoffIso, limit);
    if (!sqlFragment) return [];
    const result = (await this.db.execute(sqlFragment)) as { rows?: Array<{ id: string }> };
    return (result.rows ?? []).map((r) => r.id);
  }

  private async deleteByIds(
    table: ReturnType<typeof this.purgeableTables>[number]['table'],
    ids: string[],
  ): Promise<number> {
    if (ids.length === 0) return 0;
    switch (table) {
      case 'quizzes':
        return this.db
          .delete(quizzes)
          .where(sql`${quizzes.quizId} = ANY(${ids}::uuid[])`)
          .then((r) => countRows(r));
      case 'quiz_reviews':
        return this.db
          .delete(quizReviews)
          .where(sql`${quizReviews.reviewId} = ANY(${ids}::uuid[])`)
          .then((r) => countRows(r));
      case 'comments':
        return this.db
          .delete(commentRows)
          .where(sql`${commentRows.commentId} = ANY(${ids}::uuid[])`)
          .then((r) => countRows(r));
      case 'notifications':
        return this.db
          .delete(notifications)
          .where(sql`${notifications.notificationId} = ANY(${ids}::uuid[])`)
          .then((r) => countRows(r));
      case 'tournaments':
        return this.db
          .delete(tournaments)
          .where(sql`${tournaments.tournamentId} = ANY(${ids}::uuid[])`)
          .then((r) => countRows(r));
      default:
        return 0;
    }
  }

  private buildSelectIdsSql(
    table: ReturnType<typeof this.purgeableTables>[number]['table'],
    cutoffIso: string,
    limit: number,
  ): SQL | null {
    switch (table) {
      case 'quizzes':
        return this.expiredIdsSql('quizzes', 'quiz_id', 'deleted_at', cutoffIso, limit);
      case 'quiz_reviews':
        return this.expiredIdsSql('quiz_reviews', 'review_id', 'deleted_at', cutoffIso, limit);
      case 'comments':
        return this.expiredIdsSql('comments', 'comment_id', 'deleted_at', cutoffIso, limit);
      case 'notifications':
        return this.expiredIdsSql(
          'notifications',
          'notification_id',
          'deleted_at',
          cutoffIso,
          limit,
        );
      case 'tournaments':
        return this.expiredIdsSql('tournaments', 'tournament_id', 'deleted_at', cutoffIso, limit);
      default:
        return null;
    }
  }

  private expiredIdsSql(
    tableName: string,
    pkColumn: string,
    deletedAtColumn: string,
    cutoffIso: string,
    limit: number,
  ): SQL {
    return sql`
      SELECT ${sql.raw(pkColumn)} AS id
      FROM ${sql.raw(tableName)}
      WHERE ${sql.raw(deletedAtColumn)} IS NOT NULL
        AND ${sql.raw(deletedAtColumn)} < ${cutoffIso}
      ORDER BY ${sql.raw(deletedAtColumn)} ASC
      LIMIT ${limit}
    `;
  }

  private purgeableTables() {
    return [
      { table: 'quizzes' as const },
      { table: 'quiz_reviews' as const },
      { table: 'comments' as const },
      { table: 'notifications' as const },
      { table: 'tournaments' as const },
    ];
  }

  private clampedRetentionDays(): number {
    const raw = Number(process.env.SOFT_DELETE_RETENTION_DAYS);
    if (!Number.isInteger(raw) || raw <= 0) {
      return DEFAULT_RETENTION_DAYS;
    }
    return Math.min(Math.max(raw, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS);
  }
}

function countRows(result: unknown): number {
  if (typeof result === 'number') {
    return result;
  }
  if (Array.isArray(result)) {
    return result.length;
  }
  if (result && typeof result === 'object') {
    const r = result as { rowCount?: unknown; count?: unknown };
    if (typeof r.rowCount === 'number') {
      return r.rowCount;
    }
    if (typeof r.count === 'number') {
      return r.count;
    }
  }
  return 0;
}
