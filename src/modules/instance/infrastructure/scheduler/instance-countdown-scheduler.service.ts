import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InstanceService } from '../../domain/instance.service';
import { QUIZ_INSTANCE_REPOSITORY_PORT, type QuizInstanceRepositoryPort } from '../../domain/ports';

/**
 * Phase 2 (Gameplay Lifecycle) — countdown scheduler.
 *
 * Scans `quiz_instances` for rows where `status = 'countdown'` AND
 * `countdown_started_at + COUNTDOWN_DURATION_MS <= now()` and asks
 * `InstanceService.completeCountdownByScheduler` to fire each one.
 *
 * Why a `@Cron` poll rather than a `setTimeout` per instance
 * ------------------------------------------------------------
 *
 * 1. The countdown state is persisted on the row (`countdownStartedAt`)
 *    so any replica can pick up the work after a restart or a Redis
 *    failover. A per-instance in-process timer would be lost on
 *    restart, leaving rows stuck in `countdown` until a manual
 *    intervention.
 * 2. The query hits the partial index `idx_quiz_instances_countdown_due`
 *    added by migration 0019, so the per-tick cost is O(due rows) —
 *    a handful per second even in heavy load.
 * 3. The cadence matches the codebase convention
 *    (`TournamentSchedulerService` polls per-minute or per-5-minutes
 *    using `@Cron`). One-second polling is novel here, but the cron
 *    expression (six fields, seconds-first) gives us one tick per
 *    second without breaking the rest of the project.
 *
 * Why no advisory lock here
 * -------------------------
 *
 * The work itself is idempotent and serialized by the optimistic-locking
 * `WHERE version = $expectedVersion` predicate on
 * `updateInstanceStatus`. Two replicas polling concurrently will both
 * list the same due row, but only one will win the `UPDATE`; the other
 * receives `InstanceOptimisticLockError` and folds it into the
 * `lost_lock` return shape. Adding a Redis lock would only delay the
 * losing replica — same correctness guarantee, lower availability.
 *
 * Operational scale
 * -----------------
 *
 * The tick is bounded by `TICK_BATCH_SIZE`. If the backlog exceeds the
 * batch we re-enter on the next tick; the cron runs every second, so
 * the worst-case lag is `(backlog / TICK_BATCH_SIZE)` seconds. With a
 * default batch of 50 that is 50 countdowns per second sustained, which
 * already dwarfs the realistic peak (a few hundred concurrent instances
 * is the project's stated capacity envelope).
 */
@Injectable()
export class InstanceCountdownSchedulerService {
  /**
   * Max rows processed per tick. Sized so the per-tick work stays
   * well under the 1-second cron cadence even at peak.
   */
  static readonly TICK_BATCH_SIZE = 50;

  constructor(
    private readonly instanceService: InstanceService,
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceCountdownSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Cron: every second. The `@nestjs/schedule` adapter parses the
   * expression as seconds-first, matching the per-second cadence the
   * countdown state needs.
   */
  @Cron(CronExpression.EVERY_SECOND)
  async handleDueCountdowns(): Promise<void> {
    const nowIso = new Date().toISOString();

    let due: ReadonlyArray<{
      instanceId: string;
      version: number;
      countdownStartedAt: string;
    }>;
    try {
      due = await this.instanceRepository.findDueCountdowns({
        nowIso,
        limit: InstanceCountdownSchedulerService.TICK_BATCH_SIZE,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_countdown_scheduler_query_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (due.length === 0) {
      return;
    }

    this.logger.debug({
      event: 'instance_countdown_scheduler_due_rows',
      count: due.length,
    });

    for (const row of due) {
      try {
        const result = await this.instanceService.completeCountdownByScheduler({
          instanceId: row.instanceId,
          expectedVersion: row.version,
        });
        if (!result.completed) {
          // `lost_lock` (host raced us) and `state_changed` (host
          // cancelled) are both expected; only `min_players_not_met`
          // is novel at this layer. The application service has
          // already logged the cancellation event in that case.
          this.logger.debug({
            event: 'instance_countdown_scheduler_skipped',
            instanceId: row.instanceId,
            reason: result.reason,
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'instance_countdown_scheduler_complete_failed',
          instanceId: row.instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
