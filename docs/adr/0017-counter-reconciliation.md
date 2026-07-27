# ADR-0017: Counter Reconciliation — Mutate-In-Transaction or Full-Recompute

## Status

Accepted

## Context

The codebase carries 16 distinct denormalized counters and cached aggregates (`docs/plans/denormalized-counters-audit.md` §1). Each one duplicates information that exists verbatim in another table — `quiz_stats.total_attempts` restates `COUNT(quiz_attempts WHERE status='completed')`, `quiz_stats.bookmark_count` restates `COUNT(bookmarked_quizzes)`, `review_helpful_votes.helpful_count` restates a join, and so on.

The duplication is necessary for read-latency (the summary tables back leaderboards, analytics dashboards, and listing sort keys), but it creates a correctness problem: every denormalized counter is a contract between two places that must stay in sync. The `denormalized-counters-audit.md` review classified seven counters as HIGH-risk because they were either:

- written outside the transaction that mutated the source of truth (race), or
- never written by application code at all (so the cached column silently grew stale).

Three of those counters — `tournament_participants.total_score`, `tournament_participants.total_time_ms`, and `users.xp_total` / `streak` — were observed to be broken in production. The cause was structural: the application did not know how to keep the cache and the source synchronized, so it diverged.

We need a policy that:

1. Describes the only two acceptable write strategies for any new denormalized counter.
2. Is enforceable through code review (visible in the call site) rather than relying on runbook rituals.
3. Forces every counter to ship a defense-in-depth periodic recompute so that one missed mutation cannot silently corrupt the cache.

## Decision

**Two-allowed-strategies rule.** Every denormalized counter must be maintained by exactly one of the following strategies, declared at the column level in the schema comment and re-asserted by code review:

- **Strategy A — Mutate inside the source transaction.** The write to the denormalized column must execute in the *same* `db.transaction(...)` as the mutation to the source-of-truth table. The denormalized write is inserted in the same SQL block — not in a follow-up repository call after `tx.commit()`. Inline conditional increments (`helpful_count = helpful_count + 1`) paired with the row insert/delete are the canonical example.
- **Strategy B — Never write; always recompute.** No application code may `INSERT` or `UPDATE` the denormalized column. The cache is rebuilt on demand by a service method (e.g. `QuizAnalyticsService.refreshBookmarkMetrics`) that reads from the source and overwrites the cache. The service must upsert with `ON CONFLICT`, must filter on soft-delete predicates, and must be idempotent under repeated calls.

Hybrid strategies (e.g. "inline most of the time but recompute on a cron") are explicitly disallowed. A counter either lives inside the transaction or it lives outside it.

**Defense-in-depth periodic reconciliation.** Every counter must ship a reconciliation sweep that runs at least daily, regardless of whether events were emitted. The sweep iterates every affected primary key, calls the same recompute service method used by Strategy B, and tolerates per-row failures so a single bad row cannot stop the cron. A one-shot production-guarded backfill script (`db:backfill:<name>` with the same `ALLOW_PROD_*_BACKFILL=true` gate as every other data repair in the project) is required alongside the scheduler entry so deployments can recover drift discovered in production.

**Reconciliation is a first-class test artifact.** Every counter must have a migration-shaped test (`test/reconcile-*.e2e-spec.ts`) that:

1. Seeds a row with deliberately drifted counters (above and below the truth).
2. Runs the reconciliation entry point.
3. Asserts the cached column equals the SQL aggregate over the source.

A drift-detection integration test that runs every reconciliation sweep in a single CI pass is required to land any new counter.

**Inline-increment guard.** Additions to the codebase that increment a denormalized column with `UPDATE ... SET col = col + $n` must either:
- be wrapped in `db.transaction(...)` at the call site, **and**
- carry a sibling unit test that asserts a transaction rollback restores the counter to its pre-mutation value.

The audit's optional lint rule / pre-commit hook to reject `UPDATE ... SET col = col + $n` outside a transaction is **not adopted** in this ADR; TypeScript AST rules that span dynamic `tx.execute(sql\`...\`)` blocks (the canonical write pattern in this project) are too brittle to maintain. The expectation is enforced by code review against the rule above. A future ADR can revisit this once the codebase commits to parameterized Drizzle builders for counter mutations.

## Consequences

**Advantages**

- Future counters cannot drift without the author naming the source-of-truth write strategy.
- Periodic reconciliation means partial outages (process crash mid-transaction, manual DBA fix, future schema change) auto-repair within at most 24 hours.
- Reconciliation migrations and reconciliation sweeps share the *same* recompute entry point, so the production repair path is the same code path as the daily cron — no second implementation to maintain.

**Trade-offs**

- Strategy B counters can never be updated synchronously inside a request that needs the new value before the response; the application must either tolerate a stale read window or fall back to a SQL aggregate in the hot path.
- Defense-in-depth crons cost DB CPU every day. For high-fanout counters we accept the cost; for low-fanout counters we deliberately run the sweep anyway so we never have to think about *which* counters are safe to skip.
- The migration-shaped test forces every counter change to author drift tests up front, which adds a small amount of upfront work per counter but eliminates the "counter silently broken in production" failure mode observed during the audit.
- Skipping the lint rule means a reviewer can still miss an out-of-transaction increment. The mitigation is that any drift is repaired by the daily sweep, not that drift cannot occur.

## Evidence

- `docs/plans/denormalized-counters-audit.md` — the audit that motivated this ADR, including the 16-counter inventory and per-counter risk classification.
- `docs/plans/helpful-vote-counter-reconciliation.md` — the original Strategy-A reconciliation pattern (atomic increment + conditional update inside the source transaction), codified after a production drift incident.
- `src/modules/review/infrastructure/repositories/review.repository.ts: addHelpfulVote / removeHelpfulVote` — canonical Strategy A implementation: `INSERT ... ON CONFLICT DO NOTHING` on the source `review_helpful_votes` table plus a conditional `UPDATE quiz_reviews SET helpful_count = ...` inside the same transaction.
- `src/modules/quiz/domain/analytics/quiz-analytics.service.ts: refreshBookmarkMetrics / refreshQuizMetrics` — canonical Strategy B implementation: pure recompute from `bookmarked_quizzes` / `quiz_attempts`, never touches the source table.
- `src/modules/quiz/scheduler/analytics.scheduler.ts` — defense-in-depth crons (`@Cron('0 5 * * *')` reconcile, `@Cron('0 3 * * 0')` full rebuild) that re-run Strategy B over every active quiz.
- `scripts/backfill/bookmark-metrics.ts` / `scripts/backfill/quiz-metrics.ts` — production-guarded one-shot reconciliation commands that share the sweep entry point with the crons.
- `src/core/database/migrations/0007_reconcile_helpful_count.sql` — reconciliation migration SQL, executed as a data-only migration that calls the same recompute expression used by Strategy B.
- `test/reconcile-helpful-count.e2e-spec.ts` / `test/counter-reconciliation-drift.e2e-spec.ts` / `test/reconcile-tournament-totals.e2e-spec.ts` / `test/quiz-metrics-reconcile.e2e-spec.ts` — migration-shaped drift tests for every counter that has one.
- ADR-0006 (Request Lifecycle) and ADR-0009 (Transaction Management) — the upstream transactions for Strategy A; this ADR depends on both.
