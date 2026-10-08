# Denormalization Standard

> Rules for adding, syncing, and removing a column that duplicates data
> already available from a parent row.

## When denormalization is acceptable

A denormalized column is a deliberate trade. The source-of-truth row
stays canonical; the denormalized column exists to make a specific
read path skip a join, an aggregation, or a hot-path computation.

A new denormalized column is acceptable when **all** of the following
hold:

1. The read path that benefits is hot (e.g. it serves a list endpoint,
   a leaderboard cursor, or a per-row summary shown in tight loops).
2. The join or computation it replaces is provably the bottleneck
   (`EXPLAIN ANALYZE`, a flame graph, or a representative microbench).
3. The denormalized value is **stable for the lifetime of the parent
   row** — the denormalization cannot drift from the source-of-truth
   because the source never changes once the row is created.
4. The cost of keeping the column in sync is bounded:
   - the value is written exactly once at insert time (best),
   - or the value is updated by a single, well-tested scheduler
     (acceptable), or
   - the value is updated by an existing trigger on the source table
     (acceptable but review carefully).
5. The column's business rule fits on a single line: "this column
   equals `SELECT count(*)` from `<child_table>` filtered by
   `<parent_fk>` at insert time." If the rule needs prose, prefer a
   JOIN or a materialized view.

## When denormalization is NOT acceptable

- The value can change after insert and there is no obvious, single
  write site. Examples: a `users.post_count` that needs to stay in sync
  every time any user creates or deletes a post; the failure modes are
  endless. Use a JOIN or a per-user counter table.
- The value is used for correctness, not performance. Source-of-truth
  queries must always reach the canonical row; the denormalized copy
  is allowed only as an optimization for read paths.
- The denormalization lets a future schema change break silently. If
  you can imagine dropping the child table without the column
  noticing, you have introduced a hidden contract.

## Lifecycle

1. **Propose the column** in the schema with `nullable: true` (or with
   a default when the backfill is a single SQL statement). Land it in
   a migration that ALSO runs the backfill before setting `NOT NULL`.
2. **Mirror the column in the Drizzle schema** (`core/database/schema/`)
   in the same PR. The migration and the schema MUST agree; out-of-sync
   schemas are a CI failure.
3. **Document the sync rule** in the column-level JSDoc in the schema
   file. Future readers must be able to see *why* the column exists
   and *when* it is written.
4. **Write a backfill script** when introducing the column on a
   populated table. The script MUST be idempotent (re-running on the
   already-backfilled table is a no-op). It MUST be safe to run while
   the application is live (no long lock, no `ACCESS EXCLUSIVE`).
5. **Cover the read path** with at least one integration test that
   asserts the denormalized value is returned alongside the parent row.
6. **Cover the write path** with a unit test that asserts the column is
   populated when the parent row is created. A missing test here means
   a future refactor will silently drop the value at insert time.

## Removal

Removing a denormalized column is a breaking change for any read path
that depends on it. Follow the deprecation lifecycle in
`docs/standards/migration.md`:

- Mark the field `@deprecated` in the response DTO.
- Add the column to the OpenAPI `deprecated: true` set if it surfaces
  there.
- Land a separate migration that drops the column only after the
  deprecation window has elapsed.

## Worked example

`daily_challenge.total_questions` (P10.1.5):

- **Read path**: `GET /daily-challenge/history` renders "completed in
  N questions" for each row. Without the denormalized column, every
  row triggers a correlated subquery against `quiz_questions` keyed on
  `quiz_version_id`.
- **Stability**: the value is fixed at insert time. The version the
  daily challenge points at never changes once the day is created
  (the rotation cron's `uq_daily_challenge_date` constraint prevents
  duplicate rows for the same UTC date).
- **Sync rule**: written once, by the daily-challenge rotation cron,
  using a single `COUNT(*)` query against the selected
  `quiz_version_id`.
- **Backfill**: existing rows are backfilled with the same
  `quiz_questions` count via a `UPDATE … FROM (SELECT … GROUP BY …)`
  subquery before the column is set `NOT NULL`.

## Anti-patterns

- ❌ Caching the entire response payload in a column (`response_json`)
  so the application "skips" the ORM. Use Redis.
- ❌ Storing a serialized array of child IDs (`child_ids int[]`) to
  avoid a join. Joins are cheap; arrays are not queryable.
- ❌ Storing a denormalized counter with no documented sync rule.
  Future readers will not know whether to update it.
- ❌ Hiding a denormalization inside a generic "stats" JSONB column.
  Typed columns are queryable; JSONB is not.

## Review checklist

Before approving a PR that adds a denormalized column:

- [ ] The read path is documented in the PR description.
- [ ] The sync rule fits on one line.
- [ ] The Drizzle schema file declares the column with a JSDoc block.
- [ ] The migration backfills before enforcing `NOT NULL`.
- [ ] Tests cover both the read and the write paths.
- [ ] The column is referenced in `docs/standards/denormalization.md`
      under "Worked examples" so the rule is discoverable.
