# ADR-0025: Scheduled Counter Reconciliation Pattern

## Status

Accepted

## Context

ADR-0017 established the two-allowed-strategies rule for denormalized counters (Mutate-in-Transaction and Never-Write-Always-Recompute). It also required a daily reconciliation sweep for every counter, but it did not prescribe:

- The naming convention for reconciliation entry points.
- The shared scheduling infrastructure.
- How to compose multiple counter sweeps into a single efficient cron job.
- How to guard reconciliation against cascade failures (a bad row must not stop the sweep).

This ADR fills those operational gaps.

## Decision

**Naming convention.** Every reconciliation sweep is a `@Cron`-annotated method on a `*ReconciliationSchedulerService` class. The class lives alongside the other schedulers in the module. Entry point methods are named `<metric>Recompute` (e.g., `xpRecompute`, `quizMetricsRecompute`). One-shot backfill entry points are separate CLI commands in `scripts/backfill/` following the `db:backfill:<name>` pattern.

**Shared infrastructure.** The sweep base class (`BaseReconciliationSchedulerService` in `src/common/scheduler/`) provides:
- A `runSweep` helper that iterates over all primary keys, calls the recompute function, and collects per-row errors without aborting.
- A configurable `batchSize` to avoid lock contention on large tables.
- A `skipIfRunning` guard to prevent overlapping executions.
- Structured log output with the sweep name, batch count, and error summary.

**Failure isolation.** Every iteration runs in a sub-transaction or wraps the individual write in try/catch. A single row failure (e.g., a constraint violation on a malformed counter) does not halt the sweep. Failed row IDs are logged at warn level and returned as a summary.

**Scheduling.** Daily reconciliation crons run at off-peak hours (default: `0 4 * * *`, 04:00 UTC). The daily sweep for a given bounded context runs after that context's heaviest write traffic window. High-frequency counters (e.g., XP changes) run more frequently (hourly) as a dedicated sweep.

**Backfill CLI.** A backfill command shares the same recompute entry point as the cron. It is gated by `ALLOW_PROD_BACKFILL=true` env var, logs the actor, timestamp, and row count, and requires a `--confirm` flag in production. The backfill is idempotent: re-running it produces the same result.

## Consequences

**Advantages**

- Naming convention makes reconciliation entry points discoverable: grep for `Recompute` finds every sweep.
- The base class ensures every sweep implements failure isolation without each author having to re-solve it.
- Composing all counters for a bounded context into a single cron job (instead of one cron per counter) reduces scheduler overhead.
- Backfill CLI sharing the cron entry point means no second implementation to maintain.

**Trade-offs**

- A misbehaving sweep that never terminates holds a DB connection for the duration. The `batchSize` limit and `skipIfRunning` guard mitigate this but cannot eliminate it.
- A sweep that recomputes all rows every hour incurs more DB work than a differential update. Differential updates require tracking the last-reconciled state, which adds complexity; the current decision accepts the hourly full-scan cost in exchange for simplicity.

## Evidence

- `src/common/scheduler/base-reconciliation-scheduler.ts` — shared sweep infrastructure.
- `src/modules/coins/infrastructure/scheduler/coin-reconciliation.scheduler.ts` — XP and balance reconciliation crons.
- `src/modules/quiz/domain/analytics/quiz-analytics.service.ts` — `refreshBookmarkMetrics`, `refreshQuizMetrics` recompute entry points.
- `src/modules/ranking/infrastructure/scheduler/ranking-scheduler.service.ts` — XP leaderboard reconciliation.
- `scripts/backfill/bookmark-metrics.ts` — production-guarded backfill sharing the same recompute path.
- `ADR-0017` — the upstream decision that introduced the reconciliation requirement.
