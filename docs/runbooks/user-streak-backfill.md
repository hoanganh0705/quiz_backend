# User-Streak Backfill Runbook

> Operational guide for `pnpm db:backfill:user-streak`. One-shot
> recompute of `users.current_streak`, `users.longest_streak`, and
> `users.last_streak_day` from the source-of-truth
> `quiz_attempts.finished_at` history. Idempotent; safe to re-run.
>
> Scope: Phase B of `docs/plans/user-streak-system.md`. Runs after
> the Phase A migration (`0011_add_users_last_streak_day.sql`) has
> been deployed.

---

## What this script does

For each non-deleted user with at least one completed attempt:

1. Reads the full set of distinct UTC completion days from
   `quiz_attempts` (no `LIMIT` — every distinct day matters per §3.2
   of the design doc).
2. Runs the §3.2 in-process walk to compute the trio:
   - `current_streak` — the consecutive-day run ending today.
   - `longest_streak` — the all-time longest run.
   - `last_streak_day` — `today` when `current_streak > 0`, else `NULL`.
3. Writes the trio via the §3.1 SQL (the same atomic UPDATE the
   hot-path `AttemptRepository.completeAttemptAndSideEffects` uses).
   The SQL's `IS DISTINCT FROM` guard makes the write a no-op when
   the recompute produces the same values — see §6.3 of the design.

The script never deletes data, never touches `quiz_attempts`, and
never updates any user row whose `deleted_at IS NOT NULL`.

---

## When to run this

| Scenario | Action |
|---|---|
| Initial deployment of migration `0011_add_users_last_streak_day.sql` | Run the backfill once after the migration is applied. New columns default to `(0, 0, NULL)`; the backfill populates them from `quiz_attempts` history. |
| Drift detected between a user's `longest_streak` and a re-derivation from `quiz_attempts` (e.g. after a bug fix to the hot-path SQL) | Re-run the backfill. The §3.1 SQL's `IS DISTINCT FROM` guard writes zero rows for already-correct users; only drifted users get rewritten. |
| Schema change that alters the streak column defaults | Re-run after the migration lands. |
| A scheduled daily drift probe (out of scope for this implementation) | N/A — see §7.4 of the design doc for the rationale. |

The backfill is **not** run on every deployment. It is a one-shot
recovery tool. After the initial deployment it stays idle until an
operator needs it.

---

## Pre-flight

Before running the backfill in any environment:

1. **Confirm migration `0011_add_users_last_streak_day.sql` is applied.**
   ```bash
   pnpm db:check
   ```
   The output should list `0011` as applied. If not, run
   `pnpm db:migrate` first.

2. **Confirm the hot-path is live.** Phase A's inlined SQL in
   `AttemptRepository.completeAttemptAndSideEffects` must already
   be writing on every attempt completion. If the hot-path is not
   yet live, the backfill's recompute will be overwritten by old
   hot-path code on the next attempt. Verify by checking that
   `users.current_streak` increments for any user who just
   completed an attempt.

3. **Take a backup.** The script only writes to `users`. A
   `pg_dump --table=users --file=users-$(date +%F).sql` is
   sufficient and recovers in minutes.

4. **Run a dry-run first** to estimate duration and surface obvious
   data shape issues:
   ```bash
   pnpm db:backfill:user-streak:dry-run
   ```
   The summary line shows `usersEvaluated`, `maxStreakSeen`, and
   `errorCount`. If `errorCount > 0` or `usersEvaluated` is wildly
   off from your user base, investigate before the real run.

---

## Execution

### Staging smoke-test

Run on a single user first to confirm the SQL shape matches the
hot-path:

```bash
pnpm db:backfill:user-streak --user-id=<uuid of any active user>
```

The script logs `[user-streak-backfill] <uuid>: updated|unchanged
(longest=<n>)`. Cross-check the trio against the §7.2 unit cases
in the design doc.

### Staging full run

Once the single-user path is clean:

```bash
pnpm db:backfill:user-streak --limit=100    # first 100 users
# then:
pnpm db:backfill:user-streak                # full sweep
```

The script logs progress every 100 users. Throughput target is
serial — sufficient for the current user base. Parallelisation is a
future optimisation (§3.2 cost reasoning).

### Production run

Production safety: the script refuses to run with
`NODE_ENV=production` unless the operator explicitly opts in:

```bash
ALLOW_PROD_USER_STREAK_BACKFILL=true \
  NODE_ENV=production \
  pnpm db:backfill:user-streak
```

Promote during a low-traffic window. The §3.1 SQL is per-user and
each user's update is its own short transaction; lock contention
on the `users` table is minimal but non-zero.

---

## Verification (§6.5 probes)

Run both probes immediately after the backfill. Both should return
zero rows.

### 1. Invariant probe — DB CHECKs should hold

```sql
SELECT user_id, current_streak, longest_streak, last_streak_day
FROM   users
WHERE  longest_streak < current_streak
   OR  current_streak  < 0
   OR  longest_streak  < 0
   OR  last_streak_day > current_date;
```

Expected: 0 rows. Non-zero indicates either a bug in the §3.2
algorithm or a row that pre-existed the migration with bad data.

### 2. Conformance probe — recompute and compare

For 100 random users, recompute via SQL and compare to the stored
cache:

```sql
WITH sample AS (
  SELECT user_id FROM users
  WHERE deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE quiz_attempts.user_id = users.user_id
        AND quiz_attempts.status = 'completed'
        AND quiz_attempts.finished_at IS NOT NULL
    )
  ORDER BY random()
  LIMIT 100
),
recomputed AS (
  SELECT
    u.user_id,
    u.current_streak  AS stored_current,
    u.longest_streak  AS stored_longest,
    u.last_streak_day AS stored_last,
    -- current_streak recompute (see §3.2 walk 1)
    (
      WITH days AS (
        SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date AS d
        FROM quiz_attempts
        WHERE user_id = u.user_id
          AND status = 'completed'
          AND finished_at IS NOT NULL
        ORDER BY d DESC
      ),
      walk AS (
        SELECT d,
          CASE
            WHEN d = (SELECT d FROM days WHERE d <= (SELECT d FROM days ORDER BY d LIMIT 1))
            ...
          END
          ...
      )
      ...
    ) AS recomputed_current
  FROM users u
  WHERE u.user_id IN (SELECT user_id FROM sample)
)
SELECT user_id
FROM recomputed
WHERE stored_current  IS DISTINCT FROM recomputed_current
   OR stored_longest  IS DISTINCT FROM recomputed_longest
   OR stored_last     IS DISTINCT FROM recomputed_last;
```

> **Note:** the conformance probe above is intentionally simplified
> for readability; the full SQL walk mirrors §3.2's two passes
> (`computeCurrentStreak` + `computeLongestStreak`). For the
> authoritative version, port `scripts/backfill/user-streak.algorithm.ts`
> into a Postgres function or run the script a second time and
> assert that `usersUpdated = 0` in the summary line.

The two-line summary check is the practical equivalent:

```bash
pnpm db:backfill:user-streak 2>&1 | grep summary
# Expected: {"usersEvaluated":N,"usersUpdated":0,"unchanged":N,...}
```

If the second run writes zero rows, the cache matches the
recompute. Drift only if there's a date-cast bug or the
`quiz_attempts` source-of-truth itself changed between runs.

---

## Spot-check the 10 longest streaks (B4)

The §6.5 verification probes are mechanical. The §8 checklist also
calls for a manual spot-check:

```sql
SELECT user_id, current_streak, longest_streak, last_streak_day
FROM   users
WHERE  deleted_at IS NULL
ORDER  BY longest_streak DESC
LIMIT  10;
```

For each of the top 10, independently confirm the streak from the
user's `quiz_attempts` history:

```sql
SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date AS day
FROM   quiz_attempts
WHERE  user_id = $1
  AND  status = 'completed'
  AND  finished_at IS NOT NULL
ORDER  BY day DESC;
```

Eyeball the descending day list for each top-10 user. The longest
run visible in the list should match `longest_streak`. Mismatches
indicate either a §3.2 algorithm bug or a `quiz_attempts` data
anomaly (e.g. timezone-shifted `finished_at` values) that the
backfill cannot detect.

---

## Idempotency and re-runs (§6.3)

The §3.1 SQL's `IS DISTINCT FROM` guard makes a re-run a no-op for
already-correct users. The script's summary reports `usersUpdated`
and `unchanged` counts:

```text
[user-streak-backfill] summary: {"usersEvaluated":1234,"usersUpdated":7,"unchanged":1227,"maxStreakSeen":412,"errorCount":0,"dryRun":false}
```

- `usersUpdated > 0` and `unchanged = usersEvaluated - usersUpdated`
  — backfill changed some users; expected on the initial run.
- `usersUpdated = 0` and `unchanged = usersEvaluated` — the cache
  already matches the recompute; either a previous backfill was
  successful, or the hot-path has been live long enough to maintain
  the cache itself.

If the script terminates mid-run (operator interrupt, DB
disconnect), re-invoke it. The cursor is `user_id`, a stable UUID;
the re-run re-evaluates every user but writes only to drifted rows.

---

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| `errorCount > 0` in summary | One user's `quiz_attempts` history is malformed (e.g. `finished_at` is `NULL` despite `status='completed'`) | Inspect the per-user error log line; fix the offending attempt row, then re-run. |
| `usersEvaluated = 0` | No user has a completed attempt. | Confirm `quiz_attempts.status = 'completed'` rows exist; check the seed. |
| Invariant probe returns non-zero | Either a §3.2 bug or pre-existing bad data | Cross-check a sample row against `quiz_attempts`; if the data is correct, escalate. |
| Conformance probe returns non-zero | The script's recompute diverges from the SQL probe | One of them is wrong — most likely a `::date` cast mismatch between the script's UTC midnight anchor and the probe's `(finished_at AT TIME ZONE 'UTC')::date`. Verify the script uses `(now() AT TIME ZONE 'UTC')::date` for `today`. |
| `last_streak_day` constraint violation | Recomputed `today` lands on a future date (DB clock skew) | Investigate the DB's `current_date`; do not bypass the CHECK. |

---

## Cleanup

The script is a one-shot. No persistent state remains after a
successful run beyond the cache columns themselves. The `users`
table backup taken pre-flight can be deleted once verification
probes pass.

---

## References

- `docs/plans/user-streak-system.md` — design doc (§3.1 SQL,
  §3.2 algorithm, §6.3 idempotency, §7.1 unit tests).
- `scripts/backfill/user-streak.ts` — the script this runbook
  documents.
- `scripts/backfill/user-streak.algorithm.ts` — pure §3.2 walk,
  unit-tested in `scripts/backfill/__tests__/user-streak.spec.ts`.
- `src/core/database/migrations/0011_add_users_last_streak_day.sql`
  — the schema migration this backfill populates.
- `src/commands/outbox.ts` — precedent for the
  `ALLOW_PROD_*` / `NODE_ENV` safety pattern.
