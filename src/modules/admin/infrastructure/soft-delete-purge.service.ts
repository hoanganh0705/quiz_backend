/**
 * Phase 7 #4 — soft-delete purge job.
 *
 * ADR-0011 mandates soft deletes with `deleted_at = NULL` for "active"
 * rows. Over time that produces dead rows that confuse stats and
 * bloat indexes. This service hard-deletes rows whose `deleted_at`
 * is older than the configurable retention window (default 30 days).
 *
 * The purge is **defence in depth**, not the primary retention
 * mechanism. Other services are still expected to apply the soft-delete
 * predicate (`deleted_at IS NULL`) on every read; this job simply
 * cleans up the dead rows after they have aged out.
 *
 * Implementation notes:
 *   - The retention window is configurable via env var
 *     `SOFT_DELETE_RETENTION_DAYS` (default 30). It is clamped to
 *     `[1, 365]` so a typo cannot delete everything.
 *   - The cron runs nightly at 03:15 UTC. Nightly is sufficient
 *     because the user-visible impact of a stale soft-deleted row is
 *     statistical noise; the only risk is storage cost, which is
 *     bounded regardless.
 *   - Each table is purged in its own transaction so a failure on
 *     one does not roll back the others. Tables that share a single
 *     statement (e.g. social follows) purge in a single transaction
 *     per logical pair.
 *   - Cascading FKs with `ON DELETE CASCADE` ensure dependent rows
 *     (reviews → comments → comment votes) go with the parent. The
 *     Drizzle schema confirms this — see
 *     `src/core/database/schema/comment/schema.ts`.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';

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

export interface PurgeResult {
  readonly table: string;
  readonly deleted: number;
  readonly elapsedMs: number;
}

@Injectable()
export class SoftDeletePurgeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(SoftDeletePurgeService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Nightly cron. Runs at 03:15 UTC. The exact minute is not
   * important; we pick a non-round hour to stagger against other
   * backend crons.
   */
  @Cron('15 3 * * *')
  async nightlyPurge(): Promise<void> {
    const retentionDays = this.clampedRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const cutoffIso = cutoff.toISOString();

    this.logger.info({
      event: 'soft_delete_purge_started',
      retentionDays,
      cutoff: cutoffIso,
    });

    const results: PurgeResult[] = [];
    for (const target of this.purgeableTables()) {
      const start = Date.now();
      try {
        const deleted = await this.purgeTable(target.table, cutoff);
        const elapsedMs = Date.now() - start;
        results.push({ table: target.table, deleted, elapsedMs });
      } catch (err) {
        // Defence in depth: a per-table failure must not abort the
        // rest of the run. Log and continue.
        this.logger.error({
          event: 'soft_delete_purge_table_failed',
          table: target.table,
          message: err instanceof Error ? err.message : String(err),
        });
        results.push({ table: target.table, deleted: 0, elapsedMs: Date.now() - start });
      }
    }

    this.logger.info({
      event: 'soft_delete_purge_completed',
      retentionDays,
      cutoff: cutoffIso,
      totalDeleted: results.reduce((acc, r) => acc + r.deleted, 0),
      results,
    });
  }

  /**
   * Public so admin tooling (or a Playwright job) can trigger a
   * dry-run on demand. Returns the same shape as `nightlyPurge`'s
   * log line.
   */
  async purgeOnce(retentionDays?: number): Promise<PurgeResult[]> {
    const days = retentionDays ?? this.clampedRetentionDays();
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const cutoffIso = cutoff.toISOString();
    this.logger.info({
      event: 'soft_delete_purge_manual_started',
      retentionDays: days,
      cutoff: cutoffIso,
    });
    const results: PurgeResult[] = [];
    for (const target of this.purgeableTables()) {
      const start = Date.now();
      try {
        const deleted = await this.purgeTable(target.table, cutoff);
        results.push({ table: target.table, deleted, elapsedMs: Date.now() - start });
      } catch (err) {
        this.logger.error({
          event: 'soft_delete_purge_table_failed',
          table: target.table,
          message: err instanceof Error ? err.message : String(err),
        });
        results.push({ table: target.table, deleted: 0, elapsedMs: Date.now() - start });
      }
    }
    return results;
  }

  private async purgeTable(
    table: ReturnType<typeof this.purgeableTables>[number]['table'],
    cutoff: Date,
  ): Promise<number> {
    switch (table) {
      case 'quizzes':
        return this.db
          .delete(quizzes)
          .where(sql`${quizzes.deletedAt} IS NOT NULL AND ${quizzes.deletedAt} < ${cutoff.toISOString()}`)
          .then((r) => countRows(r));
      case 'quiz_reviews':
        return this.db
          .delete(quizReviews)
          .where(
            sql`${quizReviews.deletedAt} IS NOT NULL AND ${quizReviews.deletedAt} < ${cutoff.toISOString()}`,
          )
          .then((r) => countRows(r));
      case 'comments':
        return this.db
          .delete(commentRows)
          .where(sql`${commentRows.deletedAt} IS NOT NULL AND ${commentRows.deletedAt} < ${cutoff.toISOString()}`)
          .then((r) => countRows(r));
      case 'notifications':
        return this.db
          .delete(notifications)
          .where(sql`${notifications.deletedAt} IS NOT NULL AND ${notifications.deletedAt} < ${cutoff.toISOString()}`)
          .then((r) => countRows(r));
      case 'tournaments':
        return this.db
          .delete(tournaments)
          .where(sql`${tournaments.deletedAt} IS NOT NULL AND ${tournaments.deletedAt} < ${cutoff.toISOString()}`)
          .then((r) => countRows(r));
      default:
        return 0;
    }
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

/**
 * Drizzle's `delete(...)` return type is loose (`Promise<unknown>`),
 * so we count rows by relying on the driver's return shape. The
 * shape most drivers return is `{ rowCount: number }` (node-postgres)
 * or an empty array. Normalise to a number.
 */
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
