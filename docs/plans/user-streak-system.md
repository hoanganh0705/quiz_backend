# Fix #4 — User Streak System

**Status:** Design (revised). No implementation yet.
**Scope:** Replace the `StreakService` stub with a production-grade streak subsystem, persist `users.current_streak`, `users.longest_streak`, and `users.last_streak_day` in the same transaction that completes a quiz attempt, and backfill every user from historical `quiz_attempts`.
**Related work:** `docs/plans/denormalized-counters-audit.md` §4.2 (the audit this design answers).
**Out of scope:** Timezone per user, streak UI, social/sharing surfaces, streak multipliers, tournament/achievement/admin XP-streak semantics.

---

## 1. Business Rules

A *streak* is the count of consecutive UTC calendar days on which a user has at least one completed quiz attempt.

### 1.1 What counts as a streak

- **Trigger:** a `quiz_attempts` row transitions to `status = 'completed'`. There is no XP filter; an attempt that scores 0% and yields `xp_earned = 0` still extends the streak.
- **Why attempt-based and not XP-based:** the audit's wording is "consecutive-day attempt activity." Today the only code path that publishes `xp.added` is the attempt-completion path. Tournament, achievement, and admin XP are not wired through `xp.added`. Anchoring streak on attempt completion keeps semantics aligned with both the audit and the existing pipeline.
- **Tournaments, achievements, admin XP:** not streak-relevant under this definition. If a future product ask introduces "any-XP streaks," that is a separate feature (separate cache column or `streak_kind` discriminator). Not in this fix.

### 1.2 Per-day uniqueness

- **At most one streak-day increment per UTC calendar day.** Multiple completed attempts on the same UTC day MUST NOT bump `current_streak` more than once. The first qualifying event of the day increments; subsequent ones on the same day are no-ops.

### 1.3 Gap rules

| Last streak day (UTC) | Today's event (UTC) | Result |
|---|---|---|
| No previous day (`NULL`) | any | `current_streak = 1`, `longest_streak = max(prev, 1)`, `last_streak_day = today` |
| `today` | event fires | no-op (cache unchanged) |
| `today − 1` | event fires | `current_streak = current_streak + 1`, `longest_streak = max(prev, current)`, `last_streak_day = today` |
| `≤ today − 2` | event fires | `current_streak = 1`, `longest_streak = max(prev, 1)`, `last_streak_day = today` |
| `> today` (out-of-order commit; see §3.5.1) | event fires | no-op (the just-completed attempt is older than the cached freshest day; cache unchanged) |

The "yesterday" check is strict UTC calendar-day subtraction, not `finished_at − last_at < 24h`.

The "`> today`" row is a real product-rule condition: `quiz_attempts.finished_at` is captured at the start of the attempt-completion command (before scoring, before the transaction) and is therefore not strictly monotone across concurrent completions. If a later `finished_at` already committed and bumped `last_streak_day` past `today`, an older `finished_at` arriving later must not regress the cache. The hot-path SQL in §3.1 enforces this with a `WHEN $day < u.last_streak_day` branch and a `GREATEST(u.last_streak_day, $day)` clamp on the SET clause.

### 1.4 Longest streak

- **`longest_streak` is monotone non-decreasing**, capped at `max(longest_streak, new_current)`. Never decreases.
- DB CHECK constraints enforce `longest_streak >= current_streak >= 0` and `last_streak_day IS NULL OR last_streak_day <= current_date`.

### 1.5 Timezone

- **UTC calendar days.** The audit and the existing stub use UTC; `timestamptz` storage plus unmodified `::date` cast yields the UTC date. Per-user IANA timezone is out of scope.

### 1.6 Edge cases

| Case | Expected behavior |
|---|---|
| First-ever attempt ever | `current = 1`, `longest = max(prev, 1)`, `last_streak_day = today` |
| Two attempts same UTC day | streak increments once; second is a no-op |
| Attempt starts D-1, finishes D | `finished_at`'s UTC day is the streak day |
| `xp_earned = 0` attempt | **extends** streak (§1.1) |
| Soft-deleted user | service early-returns on `deleted_at IS NOT NULL` |
| Outbox duplicate (idempotency key collision) | re-enters recompute; atomic UPDATE is a no-op when cache is correct |
| `finished_at` in the future (clock skew) | DB CHECK rejects future-dated `last_streak_day`; recompute treats it as today |
| User with no `quiz_attempts` rows | `current = 0, longest = 0, last_streak_day = NULL` (DB defaults) |
| Leap day (Feb 29) | treated as a regular UTC day; delta math is day-based |
| Concurrent same-day completions for same user | exactly one increment; atomic UPDATE protects (see §4.5) |

### 1.7 Decisions deferred

Per-user TZ streak, `longest_streak` time-cap, "any-XP streak" semantics — deferred. Document here; do not silently change later.

---

## 2. Source of Truth

| Datum | Authoritative table/column |
|---|---|
| Streak-eligible activity | `quiz_attempts` where `status = 'completed'` |
| Timestamp of streak day | `quiz_attempts.finished_at` (`timestamptz`) |
| Cache: `current_streak` | `users.current_streak` (denormalized scalar) |
| Cache: `longest_streak` | `users.longest_streak` (denormalized scalar) |
| Cache: `last_streak_day` | `users.last_streak_day` (`DATE`, nullable) |

**Why `quiz_attempts` and not `xp_events`:** the audit and the existing code path converge on `quiz_attempts`. Using `xp_events` would drop the no-XP attempt case (breaking §1.1's "consistency over skill" semantics). Using an `xp.added` subscription would carry tournament/achievement XP into a feature the audit scoped to attempt activity.

**Why the cache columns exist:** the audit identifies them as the right place to surface streak. `users.last_streak_day` is the predicate input for the hot-path atomic UPDATE (§3.1) and lets the cache survive out-of-order completion commits without reading every attempt day on each call. The columns update **inside the same transaction** as the source-of-truth write (§4), so cache and source-of-truth never disagree in normal operation.

**Cache during normal operation vs. reconstruction.** During normal operation, the cache moves from a previous cache state to a new one via an atomic transition driven by the just-finished attempt's `finished_at` (the §3.1 SQL). Historical reconstruction from `quiz_attempts` is provided exclusively by the backfill algorithm (§3.2), which uses `quiz_attempts` as the source of truth. Live operation never re-reads `quiz_attempts` for streak purposes; reconstruction never runs in the hot path.

**Out of band for this fix:** a `streak_events` audit table is **not** added. The streak change is fully described by `outbox_events` (`attempt.completed` already carries `userId`, `finished_at`, `xp_earned`); adding another audit stream would duplicate that information. If a future "show me your streak history" feature is requested, derive it from `quiz_attempts`.

---

## 3. Streak Algorithm

### 3.1 Authoritative hot-path statement

The hot path is **one atomic SQL UPDATE**, derived from a single `CASE` over `last_streak_day`. It does not need to read the user's streak days; the cached `last_streak_day` is sufficient to apply the §1.3 gap rule. The full ordering of historical days only matters at **backfill** time, not on every attempt.

```sql
-- Inputs:
--   $user_id
--   $day  = (finished_at AT TIME ZONE 'UTC')::date of the just-completed attempt
UPDATE users u
SET
  current_streak  = src.new_current,
  longest_streak  = src.new_longest,
  last_streak_day = GREATEST(u.last_streak_day, $day::date)   -- never go backward
FROM (
  SELECT
    u.user_id,
    u.current_streak,
    u.longest_streak,
    u.last_streak_day,
    -- Apply §1.3 gap rule. The "today" the rule cares about is $day.
    -- When $day < cached last_streak_day, this attempt is older than the cached
    -- freshest day (out-of-order commit, see §3.5): no-op for current/longest.
    -- last_streak_day itself is clamped by GREATEST in the SET clause so it
    -- never moves into the past.
    CASE
      WHEN $day < u.last_streak_day                                   THEN u.current_streak
      WHEN $day = u.last_streak_day                                   THEN u.current_streak
      WHEN $day = u.last_streak_day + INTERVAL '1 day'                THEN u.current_streak + 1
      ELSE 1
    END AS new_current,
    GREATEST(
      u.longest_streak,
      CASE
        WHEN $day < u.last_streak_day                                   THEN u.current_streak
        WHEN $day = u.last_streak_day                                   THEN u.current_streak
        WHEN $day = u.last_streak_day + INTERVAL '1 day'                THEN u.current_streak + 1
        ELSE 1
      END
    ) AS new_longest
  FROM users u
  WHERE u.user_id = $user_id AND u.deleted_at IS NULL
) src
WHERE u.user_id = src.user_id
  AND (u.current_streak  IS DISTINCT FROM src.new_current
    OR u.longest_streak  IS DISTINCT FROM src.new_longest
    OR u.last_streak_day IS DISTINCT FROM GREATEST(u.last_streak_day, $day::date))
RETURNING u.current_streak, u.longest_streak, u.last_streak_day;
```

The `IS DISTINCT FROM` guard means: if the recompute produces the same values, the UPDATE affects 0 rows. The no-op same-day case (§1.2) falls out of the `WHEN $day = u.last_streak_day` branch automatically. The out-of-order commit case (§3.5) falls out of the `WHEN $day < u.last_streak_day` branch — the cache state stays exactly as it was after the earlier (chronologically-newer) attempt committed.

This single statement replaces three roundtrips plus a row lock in the previous design. Concurrent same-user completions are handled by atomic UPDATE semantics: each tx sees the committed cache state and writes its own derived new state. No `SELECT … FOR UPDATE` is required.

### 3.2 Backfill-only algorithm (separate concern)

At backfill there is no `last_streak_day` to bootstrap from. The script computes the cached trio from the **full** ordered set of distinct UTC days for the user. Backfill is a one-shot, correctness-first path; it is **not** the place to optimize for an unlikely worst case.

```
days   := SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date
            FROM quiz_attempts
            WHERE user_id = $1 AND status = 'completed'
            ORDER BY 1 DESC
          -- NO LIMIT. Every distinct day matters: a user's longest streak ever
          -- may be years in the past. Truncating the result would silently
          -- under-report `longest_streak`.

today  := (now() AT TIME ZONE 'UTC')::date

current := 0
cursor  := today
while days.contains(cursor):
    current := current + 1
    cursor  := cursor - INTERVAL '1 day'

longest := 0
prev    := NULL
run     := 0
for d in days ordered DESC:           -- single pass
    if prev IS NULL OR d = prev - INTERVAL '1 day':
        run := run + 1
    else:
        run := 1
    longest := max(longest, run)
    prev := d

last    := if current > 0 then today else NULL
```

After computing the trio, the script writes via the same SQL statement from §3.1. The script is the only place that hosts the in-process walks; the live hot path never executes them.

**Cost reasoning:**

- In-memory walks are `O(D)` where `D` is the number of distinct UTC days in the user's history. For a 5-year-active user, D ≈ 1,500. In-memory, that's a few-microsecond walk.
- The DB query reads every completed attempt's date for the user. There is an existing index on `quiz_attempts (user_id, started_at)` (`quiz/schema.ts:417` per the audit); for a power user this is ~10,000 index entries with a dedupe to ~1,500 unique dates. Sub-100ms with a covering index.
- For the (probably impossible) user with millions of completed attempts, the script can be parallelized across users (`LIMIT`/`OFFSET` cursor over `users`); per-user cost remains bounded.
- **Backfill is allowed to take an hour. Streak correctness cannot be traded for backfill speed.**

### 3.3 Why this is not `MAX(started_at)`

The audit's seed SQL — `SELECT MAX(started_at)::date FROM quiz_attempts WHERE user_id = $1 AND status = 'completed'` — is necessary but not sufficient. It identifies the most recent streak-eligible UTC day but says nothing about consecutive-day coverage or streak length. Backfilling from it would yield `current_streak = 1` for every user.

### 3.4 Why `finished_at` and not `started_at`

A attempt that starts D-1 and finishes D contributes XP on day D's calendar. `started_at = D-1` would miscount. `finished_at` is set atomically inside the same tx as the `status='completed'` transition. The audit used `started_at` as a placeholder; the precise column is an implementation detail and `finished_at` is the correct one.

### 3.5 Failure modes

| Mode | Behavior |
|---|---|
| Streak row missing (deleted user) | `FROM` subselect produces 0 rows; UPDATE affects 0 rows; tx proceeds |
| Recompute throws | outer attempt tx rolls back (attempt row reverts to prior status) |
| UPDATE `IS DISTINCT FROM` short-circuits | 0 rows affected; no event; observer noise avoided |
| Concurrent same-user completions | atomic UPDATE; lost-update impossible |
| Replayed event (idempotency key collision) | recompute reads identical cache; UPDATE affects 0 rows |
| **Out-of-order completion commits** | handled explicitly: `$day < u.last_streak_day` branch + `GREATEST(u.last_streak_day, $day)` clamp on `last_streak_day`. The cache cannot regress. See §3.5.1 below. |

#### 3.5.1 Out-of-order completion commits (verified against the codebase)

`quiz_attempts.finished_at` is **not** generated by PostgreSQL. It is set by the application to `new Date().toISOString()` at `attempt-command.service.ts:294`, before scoring and before the transaction. Two concurrent attempts can therefore commit in one order while their `finished_at` values are in the opposite order.

Concretely (`source: attempt-command.service.ts:294 → attempt.repository.ts:397 → 407`):

- Attempt A captures `nowIso = "2026-07-20T00:00:30Z"`, then enters its tx.
- Attempt B captures `nowIso = "2026-07-19T23:59:30Z"` (an attempt whose `finished_at` is July 19 UTC).
- B's tx commits first; cache becomes `last_streak_day = July 19`.
- A's tx commits second.

Without the `$day < u.last_streak_day` branch, A would compute `last_streak_day = July 19 - 1 = July 18? no; last_streak_day = July 18? no (it's July 19).` → reset to 1, last_streak_day = July 20. The cache would lose the July 19 day.

With the fix in §3.1:

- A: `last_streak_day = July 19`, `$day = July 20`. `$day > last_streak_day + 1 day` (July 19 + 1 = July 20). Match the `ELSE` branch only if `$day >= last_streak_day + 1 day`. That's `July 20 >= July 20` → `WHEN $day = u.last_streak_day + INTERVAL '1 day'` → `+1`. Correct.
- B (which committed first): `last_streak_day = NULL` (or pre-existing). `$day = July 19`. `last_streak_day + INTERVAL '1 day' = NULL + INTERVAL '1 day' = NULL`, so the `WHEN $day = u.last_streak_day + INTERVAL '1 day'` branch is false. ELSE → 1. `last_streak_day = July 19`. Correct.

**Invariant:** `users.last_streak_day` is monotone non-decreasing under arbitrary commit ordering. The DB CHECK `last_streak_day <= current_date` rules out future-dated values.

---

## 4. Architecture

### 4.1 Module boundaries

| Layer | Responsibility | Location |
|---|---|---|
| Atomic UPDATE | Lives entirely inside the existing `db.transaction` block in `AttemptCommandService.completeAttempt`. No new domain service, no new repository class, no new listener. | new method on existing `UserRepository` |
| `UserRepository.updateStreakCache(userId, finishedAt, tx)` | Issues the SQL from §3.1 inside the supplied tx handle. Returns the new `(current_streak, longest_streak, last_streak_day)` triple or `null` if the user is deleted. | `src/modules/user/infrastructure/repositories/user.repository.ts` (one method added) |
| `RankingXpStreakListenerAdapter` | **Untouched.** Subscribes to `xp.added` for ranking only. Does not carry streak responsibility. | unchanged |
| `AttemptCommandService.completeAttempt` | Invocation site — calls `userRepository.updateStreakCache(userId, attemptFinishedAt, tx)` inside the existing `db.transaction` block. | existing file; one new line |

A dedicated `StreakService`, `UserStreakRecomputer`, `UserStreakRepository` port, or Drizzle adapter for streak are **not introduced**. The streak logic is one SQL statement and one parameter; a four-class split is unwarranted.

### 4.2 Repository changes

One method on `UserRepository`:

```ts
updateStreakCache(
  userId: UserId,
  finishedAt: Date,
  tx: DrizzleDB,
): Promise<{ currentStreak: number; longestStreak: number; lastStreakDay: Date | null } | null>
```

Implementation is the §3.1 SQL with `finishedAt` bound to `$day`. The method joins whatever transaction `tx` is on (the surrounding attempt tx). It returns `null` for deleted users (FROM subselect empty), allowing callers to early-return without distinguishing that case in the calling service.

### 4.3 Streak trigger placement — one transaction

```
db.transaction(async (tx) => {
  await attemptRepo.transitionToCompleted(attemptId, tx);
  await attemptRepo.upsertQuizStats(quizId, tx);
  await attemptRepo.insertAttemptEvent(...);
  await userRepo.updateStreakCache(userId, finishedAt, tx);   ← new line
})
```

One transaction. The audit's §4.2 recommendation — "update `users` inside the same transaction as the attempt completion" — is satisfied directly. No listener, no outbox subscription, no three-transaction pipeline.

### 4.3.1 Implementation note — SQL is inlined at the call site

The hot-path UPDATE is duplicated verbatim into `AttemptRepository.completeAttemptAndSideEffects` rather than routed through `UserRepository.updateStreakCache` via constructor injection. Rationale:

- The repo-port call would force `AttemptModule → UserModule` injection, which closes a second cycle on top of the existing `RankingModule ↔ AttemptModule` cycle. The existing cycle already requires `forwardRef` at the provider level; layering a second cycle produces a `forwardRef` pattern that NestJS does not resolve cleanly in this codebase.
- `UserRepository.updateStreakCache` still exists and is the canonical entry point for any caller that runs **outside** `completeAttemptAndSideEffects` (Phase B backfill script, future admin tools). The hot-path duplication is a deliberate trade: a 30-line SQL string copied into the attempt repo, in exchange for no new cross-module DI wiring.
- The two SQL copies are identical bytes — verified by the §7.2 test cases, which exercise `UserRepository.updateStreakCache` directly; the e2e (§7.3) exercises the inlined copy. Drift between the two surfaces as a failing test.

### 4.4 Soft-deleted users

`UPDATE … FROM (… WHERE deleted_at IS NULL)` produces 0 source rows for deleted users. `updateStreakCache` returns `null`. Caller early-returns. Belt-and-braces; the XP/ranking path already short-circuits on deleted users, so deleted users generally never reach this code.

### 4.5 Concurrency

Two concurrent attempt-completion transactions for the same user are handled by the atomic UPDATE itself, not by a separate `SELECT … FOR UPDATE`. Each transaction reads its own snapshot of the cache row, derives new values from the `last_streak_day` predicate, and writes only when the result differs. Same-day concurrent completions both observe `last_streak_day = today` and produce no-op writes (the `IS DISTINCT FROM` guard). Different-day concurrent completions serialize naturally on the row lock implicit in `UPDATE`. The DB CHECK constraints enforce invariants regardless of order.

---

## 5. Event Design

**No new event is introduced.** No production code consumes `user.streak_updated` today; the cache columns are the system-of-record read path. The audit's bullet "Make sure `AttemptCompletedEvent` carries the pre-/post-streak values" is satisfied trivially because `AttemptCompletedEvent` is emitted in the same tx as the streak UPDATE — any consumer that wants the post-streak value reads the cache directly. Adding an event would require:

- An outbox row on every attempt completion.
- A listener contract to maintain.
- A consumer-shaped payload designed against hypothetical use cases.

Until the first real consumer appears (an achievement trigger that wants to react to a streak-crossing, an analytics pipeline, a WebSocket push to the client), this is YAGNI. When the consumer arrives, add the event with a payload shaped for that consumer. The cost of adding it then is one PR; the cost of carrying it forward now is permanent complexity no one is paying for.

---

## 6. Backfill Strategy

### 6.1 Choice

**One-shot Node script** at `scripts/backfill/user-streak.ts`.

The script hosts the in-process backfill algorithm from §3.2 (the consecutive-day walk) plus the §3.1 SQL for writing the result. The script does not touch production application code; it's an operational artifact.

### 6.2 Script design

- Reads the user list: `SELECT user_id FROM users WHERE deleted_at IS NULL AND has_attempts = true` — skips users with no completed attempts (they remain at DB defaults).
- For each user: fetches **all** distinct UTC-days for the user (no row-count cap — see §3.2); walks forward from `today` to compute `current`; walks the full `days` once to compute `longest`; writes via the same §3.1 SQL.
- Batching: per-user write; resumable via `LIMIT`/`OFFSET` cursor over `users ORDER BY user_id`. (The `LIMIT` is on the user cursor, not on the per-user distinct-days query.)
- Throughput target: serial is sufficient for the current user base. Parallelization is a future optimization.
- Output: JSON `{ usersEvaluated, usersUpdated, unchanged, maxStreakSeen, errorCount }`.

### 6.3 Idempotency

Rerunning produces zero writes if all users are already correct (`IS DISTINCT FROM` guard at the SQL layer). Safe to re-run.

### 6.4 Migration companion

A data-only migration `0011_backfill_user_streaks.sql` is **not added**. The backfill runs as an operational task; the migration journal only gets an entry if the schema changes (§8 — adding `current_streak`, `longest_streak`, `last_streak_day` columns).

### 6.5 Verification (post-backfill)

Two SQL probes run as part of the runbook:

1. **Invariant probe** — should return 0 rows:
   ```sql
   SELECT user_id, current_streak, longest_streak, last_streak_day
   FROM   users
   WHERE  longest_streak < current_streak
      OR  current_streak  < 0
      OR  longest_streak  < 0
      OR  last_streak_day > current_date;
   ```

2. **Conformance probe** — for 100 random users, recompute via SQL and compare to the stored cache; expect 0 mismatches. Drift only if there's a date-cast bug.

---

## 7. Testing Strategy

### 7.1 Unit tests — backfill algorithm (pure)

`scripts/backfill/__tests__/user-streak.spec.ts`. Tests the §3.2 in-process walk against a fixture of distinct days. Pure function tests; no DB.

| Case | Distinct UTC days | prev cache | today | Expected (current, longest) | Why |
|---|---|---|---|---|---|
| No previous attempts | `[]` | `{0,0,null}` | D | `(1, 1)` | §1.3 row 1 |
| Same day, second event | `[D]` | `{3,5,D}` | D | `(3, 5)` | §1.2 no-op |
| Yesterday continues streak | `[D, D-1, D-2]` | `{2,5,D-1}` | D | `(3, 5)` | §1.3 row 3 |
| Two-day gap resets streak | `[D, D-2]` | `{5,10,D-2}` | D | `(1, 10)` | §1.3 row 4 |
| Streak reaches new record | `[D, D-1]` | `{1,1,D-1}` | D | `(2, 2)` | §1.4 |
| Streak broken, longest preserved | `[D]` | `{0,10,D-30}` | D | `(1, 10)` | §1.4 |
| Empty result + prev cache 0 | `[]` | `{0,0,null}` | D | `(0, 0)` | DB default |
| Leap day in chain | `[2024-02-29, 2024-02-28]` | `{1,2,2024-02-28}` | 2024-02-29 | `(2, 2)` | §1.6 |
| **Long historical streak, short current (Concern 1)** | 1,000 distinct days, including a run of 650 consecutive from 2 years ago; recent activity only a 20-day run | `{0,0,null}` | today | `(20, 650)` — verifies the backfill does NOT truncate by `LIMIT` or by stopping after a recent gap | §3.2 |

The Concern 1 case is the critical correctness test for the backfill. It exercises the algorithm against a user whose longest streak ever happened outside a hypothetical "recent N days" window. The expected output catches any attempt to truncate the historical query.

### 7.2 Repository tests — `UserRepository.updateStreakCache`

`src/modules/user/infrastructure/repositories/user.repository.spec.ts`. Hits the test DB.

| Case | Seed | Action | Assertion |
|---|---|---|---|
| First attempt today | user with `(0,0,NULL)` | call with `finishedAt=today` | returns `(1,1,today)`; row updated |
| Same-day second attempt | user with `(3,5,today)` | call with `finishedAt=today` | returns `(3,5,today)`; `IS DISTINCT FROM` short-circuits (0 rows affected) |
| Yesterday continues | user with `(2,5,yesterday)` | call with `finishedAt=today` | returns `(3,5,today)` |
| Two-day gap resets | user with `(5,10,D-2)` | call with `finishedAt=today` | returns `(1,10,today)` |
| `xp_earned = 0` attempt | user with `last_streak_day=yesterday` | call with `finishedAt=today` | returns `(prev+1, …, today)` — confirms §1.1 |
| **Out-of-order older commit** | user with `last_streak_day=tomorrow`, `current=4` (newer attempt already landed) | call with `finishedAt=today` (older attempt's UTC day) | returns `(4, longest, today)` — confirms §3.5.1; cache did not regress; row's `last_streak_day` stayed at tomorrow |
| **Out-of-order older then newer commit** | user with `last_streak_day=yesterday` | (1) call with `finishedAt=tomorrow`; (2) call with `finishedAt=today` | after (1): `(prev+1, …, tomorrow)`; after (2): unchanged from (1); no regression |
| Soft-deleted user | `users.deleted_at IS NOT NULL` | call | returns `null`; no row updated |
| Future `finishedAt` (clock skew) | user with `(5,5,yesterday)` | call with `finishedAt=tomorrow` | DB CHECK constraint rejects future `last_streak_day` |

### 7.3 E2E tests — attempt completion

`test/user-streak.e2e-spec.ts`. Boots `AttemptCommandService`, completes attempts through the public flow, asserts on the cache.

| Case | Setup | Action | Assertion |
|---|---|---|---|
| New user, first attempt | seed user, no prior cache | complete attempt today | `current=1, longest=1, last=today` |
| Three consecutive days | seed attempts D, D-1, D-2 | complete attempt today | `current=3, longest=3` |
| Gap of 2 days | seed attempts D, D-2 | complete attempt today | `current=1, longest=2` |
| Failed quiz extends streak | seed yesterday's completion, today attempt scores 0 XP | complete attempt today | `current=2` (verifies §1.1) |
| Concurrent same-day completions | user with `last=today` | fire two completions same UTC day | `current` increments once; final cache consistent |
| Rolled-back attempt | seed user, deliberately throw during tx | attempt tx rolls back | `users.current_streak` unchanged |
| Backfill script e2e | seed 1000 users with random attempts | `pnpm ts-node scripts/backfill/user-streak.ts` | invariant probe = 0 rows; conformance probe = 0 mismatches |

### 7.4 Periodic verification — deferred to operational tooling

A daily or weekly drift probe is **not** in this implementation plan. The post-backfill invariant + conformance probes (§6.5) cover the initial roll-out. After the feature has been live for one week, evaluate drift over that period and decide whether a scheduled probe is warranted (likely yes; out of scope here).

---

## 8. Final Implementation Checklist

Tasks are ordered for dependency. Total: **2 code PRs** (plus optional operational tasks).

### Phase A — Schema + repository

- [x] **A1.** Migration `00XX_add_users_streak_columns.sql`:
  - Add `current_streak INT NOT NULL DEFAULT 0`.
  - Add `longest_streak INT NOT NULL DEFAULT 0`.
  - Add `last_streak_day DATE` (nullable).
  - Add CHECK constraints: `current_streak >= 0`, `longest_streak >= current_streak`, `last_streak_day IS NULL OR last_streak_day <= current_date`.
  - Update Drizzle schema in `src/core/database/schema/auth/schema.ts`; regenerate snapshot; update journal.
- [x] **A2.** Add `UserRepository.updateStreakCache(userId, finishedAt, tx)` per §4.2 (the §3.1 SQL).
- [x] **A3.** Wire `userRepo.updateStreakCache(userId, finishedAt, tx)` into `AttemptCommandService.completeAttempt` inside the existing `db.transaction` block (§4.3).
- [x] **A4.** Repository unit tests (§7.2). PR-A.

### Phase B — Backfill

- [x] **B1.** Write `scripts/backfill/user-streak.ts` (§6.2): hosts the §3.2 in-process walk; writes via §3.1 SQL. Implemented as two files — `scripts/backfill/user-streak.algorithm.ts` (pure) and `scripts/backfill/user-streak.ts` (DB wrapper + CLI). The DB wrapper owns its own `pg.Pool` so the script's `ALLOW_PROD_USER_STREAK_BACKFILL` safety gate is independent of `ALLOW_PROD_SEED`.
- [x] **B2.** Unit tests for the backfill algorithm (§7.1). Implemented at `scripts/backfill/__tests__/user-streak.spec.ts`; 34 cases including the §7.1 Concern 1 regression test (650-day historical run, 20-day recent run). Run via `pnpm test:scripts` (separate jest config: `scripts/jest.scripts.json`).
- [x] **B3.** Runbook at `docs/runbooks/user-streak-backfill.md` (operational, separate task).
- [ ] **B4.** Run against staging; spot-check 10 longest streaks (§6.5); promote to production off-peak. (Operational.)

### Out of scope (deferred)

- Per-user IANA timezone streak.
- `longest_streak` time-window cap (e.g., last 365 days).
- "Any-XP streak" semantics spanning tournament/achievement XP.
- Periodic drift probe (post-launch operational concern).
- `attempt.streak_updated` / `user.streak_updated` event (no current consumer).

---

## 9. Open questions deferred to future work

These are not blockers for this fix. Each is captured here so they aren't silently introduced later.

- **Per-user TZ streak.** Replaces `(finished_at AT TIME ZONE 'UTC')::date` with `(finished_at AT TIME ZONE iana_zone)::date` and adds `users.timezone TEXT`. Requires a TZ-aware backfill migration and a per-user DB CHECK revision. Deferred until a product ask lands.
- **`longest_streak` time-window cap.** Currently monotone forever. If product wants "longest in the last 365 days," that is a different cache computation (per-bucket max over a sliding window), not a cap on the existing column.
- **"Any XP" streak semantics.** If a future product ask extends streak eligibility to tournament rounds, achievement grants, or admin manual adjustments, that is a separate feature with a distinct cache column (or a `streak_kind` discriminator). This fix is scoped to attempt activity per `denormalized-counters-audit.md §4.2`.
- **Streak-change event.** Add when the first consumer appears (an achievement trigger that wants to fire on a streak-crossing, an analytics pipeline, a client WebSocket). Until then, the cache columns are the source of truth for any consumer.

---

*End of design. Implementation begins after §1.5 (timezone) and §1.7 (deferred items) are confirmed.*
