# Denormalized Counter & Cached Aggregate Audit Report

**Scope:** All persistent counters, cached aggregates, and derived numeric values across the NestJS backend (`quiz_backend`).
**Method:** Schema scan → mutation trace → transaction/concurrency analysis → risk classification.
**Date:** 2026-07-19
**Related work:** [Helpful Vote Counter Reconciliation](./helpful-vote-counter-reconciliation.md), migration `0007_reconcile_helpful_count.sql`

---

## 1. Counter Inventory by Domain

### 1.1 Quiz domain (`quiz_stats`)

| Column | Source of Truth | Type |
|---|---|---|
| `total_attempts` | `quiz_attempts` (status='completed') | Recompute, plus inline increment |
| `total_players` | `COUNT(DISTINCT quiz_attempts.user_id)` for the quiz | Recompute only |
| `avg_score_percent` | `AVG(quiz_attempts.score_percent)` for completed attempts | Recompute (running avg also possible) |
| `avg_rating` | `AVG(quiz_reviews.rating)` | Recompute only |
| `rating_count` | `COUNT(quiz_reviews)` | Recompute only |
| `bookmark_count` | `COUNT(bookmarked_quizzes)` — counted **per row, not per user** | Recompute only |
| `completion_rate` | completed / (started + completed) | Recompute only |
| `popularity_score` | weighted function of attempts/bookmarks/ratings | Recompute only |
| `trending_score` | time-decayed recent events | Recompute only |
| `last_attempt_at` | `MAX(quiz_attempts.created_at)` | Recompute only |

Source of recompute: `quiz-analytics.service.refreshQuizMetrics / refreshReviewMetrics / refreshBookmarkMetrics / refreshTrendingScore / refreshPopularityScore`, all driven by domain-event listeners.

Inline increment: `attempt.repository.completeAttemptAndSideEffects` performs an atomic `total_attempts = total_attempts + 1` with a running-average update **inside the same transaction** as the `UPDATE quiz_attempts SET status='completed'`.

### 1.2 Quiz reviews (`quiz_reviews`)

| Column | Source of Truth | Type |
|---|---|---|
| `helpful_count` | `COUNT(review_helpful_votes WHERE review_id = …)` | Inline atomic increment with idempotent insert (see `review.repository.addHelpfulVote / removeHelpfulVote`). Counter is **conditionally** updated only when the vote row is actually inserted/deleted. Already reconciled by migration `0007`. |

### 1.3 Discussion (`discussion_threads`, `discussion_comments`)

| Column | Source of Truth | Type |
|---|---|---|
| `discussion_threads.comments_count` | `COUNT(discussion_comments WHERE thread_id = … AND deleted_at IS NULL)` | Inline `±1` via `incrementThreadCommentCount` |
| `discussion_threads.votes_count` | sum of `discussion_votes.value` for the thread | Inline `±1` via `updateThreadVotes` |
| `discussion_threads.upvotes_count` | `SUM(CASE WHEN value='upvote' THEN 1)` for the thread | Inline `±1` via `updateThreadVotes` |
| `discussion_threads.downvotes_count` | `SUM(CASE WHEN value='downvote' THEN 1)` for the thread | Inline `±1` via `updateThreadVotes` |
| `discussion_comments.replies_count` | `COUNT(discussion_comments WHERE parent_comment_id = … AND deleted_at IS NULL)` | Inline `±1` via `incrementCommentRepliesCount` |
| `discussion_comments.votes_count` | same pattern | Inline `±1` via `updateCommentVotes` |
| `discussion_comments.upvotes_count` | same pattern | Inline `±1` |
| `discussion_comments.downvotes_count` | same pattern | Inline `±1` |

### 1.4 Ranking (`user_ranking`)

| Column | Source of Truth | Type |
|---|---|---|
| `all_time_xp` | `SUM(quiz_attempts.xp_earned)` + bonuses (authoritative source: `quiz_attempts`) | Inline `+= amount` in `xp-ingestion.service.processXpEvent`, atomic and transactional |
| `weekly_xp`, `monthly_xp`, `daily_xp` | per-period XP from same events | Inline `+= amount` (same path) |
| `all_time_rank`, `weekly_rank`, `monthly_rank`, `daily_rank` | `RANK() OVER (ORDER BY xp DESC)` against the table itself | **Fully recomputed** in `rank-calculation.service.calculateAllRanks / recalculateRanksForUsers` using SQL window functions |
| `peak_*_rank` and `peak_*_rank_achieved_at` | minimum observed rank | Set, never incremented |
| `last_*_reset_at` | timestamps | Set, never incremented |
| `is_dirty` | dirty latch for the rank-recalc worker | Boolean set/clear |

### 1.5 Users (`users`)

| Column | Source of Truth | Type |
|---|---|---|
| `users.xp_total` | `user_ranking.all_time_xp` | **Never updated in production code** (only seed scripts). Always reads 0. |
| `users.current_streak` | derived from consecutive-day attempt activity | **Never updated in production code**; `StreakService.recalculateStreak` is a stub that emits an event but never reads or writes the column. |
| `users.longest_streak` | same | same |

### 1.6 Tournaments (`tournaments`)

| Column | Source of Truth | Type |
|---|---|---|
| `tournament_stats.participants` | `COUNT(tournament_participants WHERE tournament_id = …)` | **Fully recomputed** by `refreshTournamentStats` (single SQL) |
| `tournament_stats.completed_participants` | `COUNT(rank_final IS NOT NULL)` | Recomputed |
| `tournament_stats.average_score`, `highest_score`, `lowest_score` | `AVG/MAX/MIN(tournament_participants.total_score WHERE rank_final IS NOT NULL)` | Recomputed |
| `tournament_stats.completion_rate` | completed / participants | Recomputed |
| `tournament_stats.average_rank` | `AVG(rank_final)` | Recomputed |
| `tournament_participants.total_score` | `SUM(tournament_round_participants.round_score)` for that participant | **Never updated in production code** — always reads 0. The leaderboard ORDER BY is `total_score DESC`; rounds contribute `round_score` but no recompute writes it back. |
| `tournament_participants.total_time_ms` | `SUM(tournament_round_participants.round_time_ms)` for that participant | **Never updated** — always reads 0. Leaderboard tie-break relies on it. |
| `tournament_participants.rank_final` | `ROW_NUMBER() OVER (ORDER BY total_score DESC, total_time_ms ASC)` | Recomputed in `finalizeTournament` (atomic, batched, transactional) |

### 1.7 Outbox (`outbox_events`)

| Column | Source of Truth | Type |
|---|---|---|
| `attempt_count` | locally tracked retry counter | Inline `+1` inside `WHERE processed_at IS NULL` lock; idempotent because the SELECT FOR UPDATE SKIP LOCKED pattern guarantees one worker per row. |

---

## 2. Dangerous Patterns Found

I searched for: `UPDATE … count = count + 1`, `sql\`${table.count} + N\``, `SELECT then INSERT` without transactional protection, INSERT followed by UPDATE.

| Location | Pattern | Verdict |
|---|---|---|
| `attempt.repository.completeAttemptAndSideEffects` | Inline `total_attempts = total_attempts + 1` with running-average math, inside the **same** transaction as the attempt row update. | ✅ Safe — single transaction, single statement |
| `review.repository.addHelpfulVote / removeHelpfulVote` | INSERT … ON CONFLICT DO NOTHING … RETURNING, then UPDATE helpful_count only if the row was actually inserted/deleted. Transactional (or joins the outer one). | ✅ Safe — conditional counter update |
| `ranking.repository._updateXpCore` | `UPDATE … SET all_time_xp = all_time_xp + $amount` inside `XpIngestionService`'s outer transaction. | ✅ Safe |
| `ranking.repository.resetPeriod` | One-shot UPDATE per period guarded by `pg_advisory_xact_lock` to serialize resets. | ✅ Safe |
| `discussion.repository.incrementThreadCommentCount / incrementCommentRepliesCount` | `UPDATE … comments_count = comments_count + $delta` executed **outside** the surrounding service-layer transaction. The call sites (`discussion.service.createComment`, `softDeleteComment`) wrap neither the insert/delete nor the counter update. | ⚠️ Pattern matches "INSERT followed later by UPDATE without transaction protection" — **drift possible on crash mid-flight**. |
| `discussion.repository.updateThreadVotes / updateCommentVotes` | Conditional `±1` inside the same transaction as `upsertVote / removeVote`, protected by `FOR UPDATE` on the existing vote row. | ✅ Safe (vote path is transactional) |
| `tournament.repository.startRoundAttemptTx / createAttemptForRound` | INSERT round_participant + INSERT quiz_attempt + UPDATE round_participant to attach attemptId, all inside one transaction. | ✅ Safe |
| `tournament.repository.finalizeTournament` | Streaming batched UPDATE with VALUES list + `refreshTournamentStats` UPSERT, all in one transaction. | ✅ Safe |
| `achievement.repository.awardBadge / revokeBadge` | INSERT user_badges + INSERT outboxEvents inside a transaction, idempotent on (user, badge). | ✅ Safe |
| `users.xp_total / current_streak / longest_streak` | SELECT only in production code. | ⚠️ **Counter is never written** (orphan counter, always 0 in production). |
| `tournament_participants.total_score / total_time_ms` | SELECT only in production code. | ⚠️ **Counter is never written** (orphan counter, always 0 in production). |

### Special cases

- **`BookmarkAnalyticsEventHandler`** subscribes to `BookmarkAddedEvent`/`BookmarkRemovedEvent`, but **`BookmarkCommandService.addBookmarksBulk` and `removeBookmarksBulk` do not emit those events**. Bulk operations silently bypass analytics refresh.
- **`quiz_stats.bookmark_count`** is counted **per row** in `bookmarked_quizzes` rather than per unique user/quiz — so the same user bookmarking a quiz in two collections inflates the count. Not a drift bug per se, but a semantic mismatch between the column name and its meaning.
- **`quiz_stats.total_players`** uses `COUNT(DISTINCT user_id)`, but **`quiz_stats.bookmark_count`** does NOT use `DISTINCT`. Two parallel counter philosophies for the same table.

---

## 3. Risk Classification Table

| Counter | Table | Source of Truth | Mutation Location | Transaction Safe | Drift Risk | Recommendation |
|---|---|---|---|---|---|---|
| **`tournament_participants.total_score`** | `tournament_participants` | `SUM(round_score)` from `tournament_round_participants` | **None in production** | N/A — never written | **HIGH** | Recompute on every round completion + reconcile SQL |
| **`tournament_participants.total_time_ms`** | `tournament_participants` | `SUM(round_time_ms)` from `tournament_round_participants` | **None in production** | N/A — never written | **HIGH** | Same as above; needed for leaderboard tie-break |
| **`users.xp_total`** | `users` | `user_ranking.all_time_xp` | **None in production** | N/A — never written | **HIGH** | Either drop the column or set it from `user_ranking` after each XP write |
| **`users.current_streak`** | `users` | consecutive UTC-day attempt activity | `StreakService.recalculateStreak` (stub) | No — stub never reads or writes | **HIGH** | Implement `recalculateStreak` against `quiz_attempts` |
| **`users.longest_streak`** | `users` | max observed streak | `StreakService.recalculateStreak` (stub) | No — stub | **HIGH** | Same as above |
| **`discussion_threads.comments_count`** | `discussion_threads` | `COUNT(discussion_comments WHERE thread_id=…)` | `discussion.service` → `incrementThreadCommentCount` | **No** — runs in its own auto-commit after the insert | **HIGH** | Move into the same transaction as `createComment` / `softDeleteComment`, or replace with SQL recompute |
| **`discussion_comments.replies_count`** | `discussion_comments` | `COUNT(replies WHERE parent_comment_id=…)` | `incrementCommentRepliesCount` | **No** — same pattern | **HIGH** | Same as above |
| **`discussion_threads.votes_count` / `upvotes_count` / `downvotes_count`** | `discussion_threads` | `SUM(discussion_votes.value)` | `discussion.service.castVote` → `updateThreadVotes` (with `tx` and `FOR UPDATE`) | ✅ Safe (transactional + row lock) | **LOW** | None |
| **`discussion_comments.votes_count` / `upvotes_count` / `downvotes_count`** | `discussion_comments` | same | same | ✅ Safe | **LOW** | None |
| **`quiz_reviews.helpful_count`** | `quiz_reviews` | `COUNT(review_helpful_votes)` | `review.repository.addHelpfulVote / removeHelpfulVote` | ✅ Conditional + transactional | **LOW** (already reconciled by migration 0007) | Keep — guard with the same idempotent insert/delete pattern; periodic reconciliation cron as defense-in-depth |
| **`quiz_stats.total_attempts`** | `quiz_stats` | `COUNT(quiz_attempts.status='completed')` per quiz | `attempt.repository.completeAttemptAndSideEffects` (inline atomic increment + running avg) and `quiz-analytics.service.refreshQuizMetrics` (full recompute) | ✅ Both paths safe; event-driven refresh converges on any drift | **MEDIUM** | Keep both paths; periodic recompute job to reconcile |
| **`quiz_stats.avg_score_percent`** | `quiz_stats` | `AVG(score_percent)` of completed attempts | Inline running avg + full recompute | ✅ Safe | **MEDIUM** | Same as above |
| **`quiz_stats.total_players`** | `quiz_stats` | `COUNT(DISTINCT user_id)` of completed attempts | Recompute only | ✅ Safe | **LOW** | None |
| **`quiz_stats.rating_count`** | `quiz_stats` | `COUNT(quiz_reviews)` | Recompute only (`refreshReviewMetrics`) | ✅ Safe | **LOW** | None |
| **`quiz_stats.avg_rating`** | `quiz_stats` | `AVG(quiz_reviews.rating)` | Recompute only | ✅ Safe | **LOW** | None |
| **`quiz_stats.bookmark_count`** | `quiz_stats` | intended: distinct (collection, quiz, user) but currently `COUNT(bookmarked_quizzes)` | Recompute only (`refreshBookmarkMetrics`) | ✅ Safe in isolation | **MEDIUM** | (a) Fix semantic — count distinct users, not rows. (b) Emit bookmark events from bulk operations. |
| **`quiz_stats.completion_rate`** | `quiz_stats` | completed / (started + completed) | Recompute only | ✅ Safe | **LOW** | None |
| **`quiz_stats.popularity_score`** | `quiz_stats` | weighted function of attempts/bookmarks/ratings | Recompute only | ✅ Safe | **LOW** | None |
| **`quiz_stats.trending_score`** | `quiz_stats` | time-decayed recent events | Recompute only | ✅ Safe | **LOW** | None |
| **`user_ranking.all_time_xp`** | `user_ranking` | sum of all XP events for the user (via `quiz_attempts.xp_earned` + bonuses) | `ranking.repository._updateXpCore` inside the XP ingestion transaction | ✅ Safe + idempotency key in the outbox | **LOW** | None |
| **`user_ranking.weekly_xp` / `monthly_xp` / `daily_xp`** | `user_ranking` | same with period filters | Same; reset handled by `resetPeriod` with advisory lock | ✅ Safe | **LOW** | None |
| **`user_ranking.all_time_rank` / `weekly_rank` / `monthly_rank` / `daily_rank`** | `user_ranking` | `RANK()` window over the period XP column | `rank-calculation.service.calculateAllRanks / recalculateRanksForUsers` — full SQL recompute | ✅ Safe | **LOW** | None |
| **`user_ranking.peak_*_rank` / `peak_*_rank_achieved_at`** | `user_ranking` | min observed rank | `ranking.repository.updatePeakRank` (set, not increment) | ✅ Safe | **LOW** | None |
| **`tournament_stats.participants / completed_participants / average_score / highest_score / lowest_score / completion_rate / average_rank`** | `tournament_stats` | aggregates from `tournament_participants` | `tournament.repository.refreshTournamentStats` (full SQL UPSERT) | ✅ Safe | **LOW** | None |
| **`outbox_events.attempt_count`** | `outbox_events` | local retry counter | processors increment inside a worker claim | ✅ Safe (SKIP LOCKED) | **LOW** | None |
| **`badges.earnedCount`** | n/a — column does not exist; always computed | `COUNT(user_badges WHERE revoked_at IS NULL)` | n/a | ✅ Safe | **LOW** | None — already recomputed |

---

## 4. High-Risk Counter Deep-Dive

### 4.1 `tournament_participants.total_score` / `total_time_ms` (HIGH)

**Architectural root cause:** Schema defines these columns, `tournament_round_participants.round_score` and `round_time_ms` are written when attempts complete, but **no code path ever propagates those values into `tournament_participants`**. The leaderboard query in `finalizeTournament` orders by `total_score DESC, total_time_ms ASC` — both are always 0.

**Recommended fix:**
1. After every `tournament_round_participants` write, recompute the participant's `total_score` and `total_time_ms` in the **same transaction** from `SUM(round_score)` / `SUM(round_time_ms)` filtered to the participant.
2. Replace the leaderboard `ORDER BY` with an explicit `LEFT JOIN ... GROUP BY` so the ordering derives from `tournament_round_participants` (which is already authoritative).

**Migration needed?** Yes — a data-only reconciliation migration (mirroring `0007_reconcile_helpful_count.sql`) that backfills the two columns from `tournament_round_participants`.

**Reconciliation SQL possible?** Yes — straightforward single SQL:

```sql
UPDATE tournament_participants AS tp
SET
  total_score   = sub.total_score,
  total_time_ms = sub.total_time_ms
FROM (
  SELECT participant_id,
         SUM(round_score)::int AS total_score,
         SUM(round_time_ms)::int AS total_time_ms
  FROM tournament_round_participants
  GROUP BY participant_id
) AS sub
WHERE tp.participant_id = sub.participant_id
  AND (tp.total_score <> sub.total_score OR tp.total_time_ms <> sub.total_time_ms);
```

**Implementation plan:**
1. Reconciliation migration (backfill).
2. Add a repository method `recalculateParticipantTotals(participantId)` that runs the same SQL inside a transaction; call from the round-attempt-complete service handler.
3. Re-run the leaderboard query and confirm non-zero ordering.

### 4.2 `users.xp_total` / `users.current_streak` / `users.longest_streak` (HIGH)

**Architectural root cause:**
- `users.xp_total` duplicates `user_ranking.all_time_xp`; XP is written to `user_ranking` only, never to `users`. The `users` column always reads 0.
- `StreakService.recalculateStreak` is a stub (`TODO: Implement actual streak calculation with database queries`) that emits a `user.streak_updated` event but never persists to the table.

**Recommended fix (XP):** Either (a) drop the column, or (b) trigger a single SQL update after each `user_ranking.all_time_xp` write to mirror the value. Option (b) is simple but introduces another write path that must be kept transactional with the ranking update.

**Recommended fix (Streak):** Implement `StreakService.recalculateStreak` against `quiz_attempts`:

```sql
SELECT MAX(started_at)::date
FROM quiz_attempts
WHERE user_id = $1 AND status = 'completed';
```

Then compute `current_streak` / `longest_streak` with the same in-app logic the stub already has, and update `users` inside the same transaction as the attempt completion.

**Migration needed?** Yes — backfill from `user_ranking` (for XP) and recompute from `quiz_attempts` (for streaks). Both can be data-only.

**Reconciliation SQL possible?** Yes:

```sql
-- XP reconciliation
UPDATE users u
SET xp_total = ur.all_time_xp
FROM user_ranking ur
WHERE u.user_id = ur.user_id
  AND u.xp_total IS DISTINCT FROM ur.all_time_xp;

-- Streak reconciliation requires per-user logic; either a stored proc
-- or a one-shot Node script that mirrors StreakService logic.
```

**Implementation plan:**
1. Reconciliation migration for `xp_total`.
2. Reconcile `current_streak` / `longest_streak` via a one-shot script using the same day-bucketing rule as the (about-to-be-implemented) service.
3. Implement `recalculateStreak` and call it from `AttemptCommandService.completeAttempt` inside the same transaction.
4. Add a per-user check constraint that `users.longest_streak >= users.current_streak` already exists in the schema — leave it.

### 4.3 `discussion_threads.comments_count` / `discussion_comments.replies_count` (HIGH)

**Architectural root cause:** The service-layer comment create/delete flow does:

```ts
const comment = await this.repo.createComment(params);              // INSERT
await this.repo.incrementThreadCommentCount(params.threadId, 1);   // UPDATE
if (params.parentCommentId) {
  await this.repo.incrementCommentRepliesCount(params.parentCommentId, 1); // UPDATE
}
```

The two UPDATE calls execute in **separate auto-commits**. If the process dies between INSERT and UPDATE, the counter drifts; if the INSERT succeeded but the first UPDATE failed, the counter drifts. Same for the soft-delete path.

**Recommended fix:** Wrap insert + counter updates in a single transaction, passing the `tx` client through to the repository:

```ts
return this.db.transaction(async (tx) => {
  const comment = await this.repo.createComment(params, tx);
  await this.repo.incrementThreadCommentCount(params.threadId, 1, tx);
  if (params.parentCommentId) {
    await this.repo.incrementCommentRepliesCount(params.parentCommentId, 1, tx);
  }
  return comment;
});
```

The repository methods already accept an optional `db: DrizzleDB` parameter (some do — `incrementThreadCommentCount` and `incrementCommentRepliesCount` currently do **not**, fix that too).

**Migration needed?** A one-shot backfill reconciling the counts from `discussion_comments` and `discussion_replies`.

**Reconciliation SQL possible?** Yes — already covered by the same COUNT(*) used as source of truth:

```sql
UPDATE discussion_threads t
SET comments_count = sub.cnt
FROM (
  SELECT thread_id, COUNT(*)::int AS cnt
  FROM discussion_comments
  WHERE deleted_at IS NULL
  GROUP BY thread_id
) sub
WHERE t.thread_id = sub.thread_id
  AND t.comments_count IS DISTINCT FROM sub.cnt;

UPDATE discussion_threads t
SET comments_count = 0
WHERE comments_count <> 0
  AND NOT EXISTS (
    SELECT 1 FROM discussion_comments c
    WHERE c.thread_id = t.thread_id AND c.deleted_at IS NULL
  );
-- analogous SQL for replies_count
```

**Implementation plan:**
1. Backfill migration (idempotent, mirrors `0007_reconcile_helpful_count.sql`).
2. Make `incrementThreadCommentCount / incrementCommentRepliesCount` accept an optional `db: DrizzleDB`.
3. Wrap `discussion.service.createComment / softDeleteComment` in `db.transaction(...)`.
4. Defense-in-depth: nightly cron that re-runs the reconciliation SQL above.

### 4.4 `quiz_stats.bookmark_count` semantic drift (MEDIUM/HIGH depending on intent)

**Architectural root cause:** `MetricsRepository.calculateBookmarkCount` does `SELECT COUNT(*) FROM bookmarked_quizzes WHERE quiz_id = …` — counts **rows**, not distinct users. The same user bookmarking a quiz in two collections counts as 2.

**Recommended fix:**
1. Change the COUNT to `COUNT(DISTINCT bookmark_collection.user_id)` via the join, OR
2. Decide that "bookmark count" means "number of bookmark rows" and rename the column to `bookmark_row_count`.

**Migration needed?** No — semantic fix only.

**Reconciliation SQL possible?** Yes — by re-running `refreshBookmarkMetrics` for every quiz.

### 4.5 Bulk bookmark events missing (MEDIUM)

**Architectural root cause:** `BookmarkCommandService.addBookmarksBulk` / `removeBookmarksBulk` update the underlying table but do **not** emit `BookmarkAddedEvent` / `BookmarkRemovedEvent`. Analytics refresh fires only for single-bookmark operations.

**Recommended fix:** Emit one event per successfully-inserted/deleted row inside the bulk operations, mirroring the single-bookmark path.

**Reconciliation SQL possible?** Yes — refresh all quiz stats via the existing service method.

---

## 5. Ranked List — Auditing & Fix Order

Ordered highest to lowest drift risk. Each item links to the corresponding section above.

| # | Counter | Risk | Why first |
|---|---|---|---|
| 1 | `tournament_participants.total_score` | HIGH | Leaderboard is silently broken (always 0) — **observable user-facing bug**. |
| 2 | `tournament_participants.total_time_ms` | HIGH | Tie-break is silently broken. Fix together with #1. |
| 3 | `discussion_threads.comments_count` | HIGH | Counter can drift on every comment create/delete; visible on thread pages. |
| 4 | `discussion_comments.replies_count` | HIGH | Same pattern as #3. Fix together. |
| 5 | `users.xp_total` | HIGH | Profile endpoint returns wrong XP — directly visible to every user. |
| 6 | `users.current_streak` | HIGH | Streak feature is non-functional (stub). |
| 7 | `users.longest_streak` | HIGH | Same as #6. Fix together. |
| 8 | `quiz_stats.bookmark_count` semantic | MEDIUM | Number is wrong shape; fix as part of bookmark analytics pass. |
| 9 | Bookmark events missing from bulk operations | MEDIUM | Drift on every bulk add/remove. |
| 10 | `quiz_stats.total_attempts` / `avg_score_percent` | MEDIUM | Has both inline increment and recompute paths; safer than the others but still worth periodic reconcile. |
| 11 | `quiz_reviews.helpful_count` | LOW | Already reconciled; keep conditional idempotent pattern + periodic cron. |
| 12 | `quiz_stats.total_players / rating_count / avg_rating / completion_rate / popularity_score / trending_score / last_attempt_at` | LOW | Fully recomputed from source — no drift risk. |
| 13 | `user_ranking.all_time_xp / *_xp / *_rank / peak_*` | LOW | Transactional XP, recomputed ranks. |
| 14 | `tournament_stats.*` | LOW | Full SQL recompute. |
| 15 | `outbox_events.attempt_count` | LOW | Worker-bound retry counter. |
| 16 | `badges.earnedCount` (computed, not stored) | LOW | Computed on read. |

---

## 6. Recommended Audit Cadence

Even after the HIGH-risk fixes above, schedule a periodic job (e.g., daily cron) that re-runs the reconciliation SQL for:

- `quiz_stats.*` (recompute every row from source)
- `discussion_threads.comments_count`, `discussion_comments.replies_count`
- `quiz_reviews.helpful_count`
- `tournament_participants.total_score / total_time_ms` (after they are wired up)

And keep the existing `RankingRepository.findXpMismatches` reconciliation as the canary for `user_ranking` drift.

---

## 8. Implementation Checklist

The following list contains every concrete change required to resolve the audit findings, grouped by counter and ordered to match §5. Each item is small enough to be its own PR.

### Fix #1 — `tournament_participants.total_score` / `total_time_ms`

- [ ] **Migration 0008 — backfill totals from rounds**
  - [ ] Write `0008_reconcile_tournament_participant_totals.sql` mirroring the `0007` pattern (idempotent, two `UPDATE … IS DISTINCT FROM` statements).
  - [ ] Generate the new Drizzle snapshot and add the entry to `_journal.json`.
  - [ ] Add an e2e test that seeds a tournament + round participants with non-zero round scores, runs the migration SQL, and asserts the participant totals match `SUM(round_score)` / `SUM(round_time_ms)`.
- [ ] **Repository — add `recalculateParticipantTotals(participantId, db?)`**
  - [ ] Implement as a single SQL `UPDATE … FROM (SELECT … GROUP BY participant_id)` inside a transaction.
  - [ ] Accept an optional `db: DrizzleDB` so the method can join an outer transaction.
  - [ ] Add a port-method entry in `tournament-repository.port.ts`.
- [ ] **Service — call it on round completion**
  - [ ] In the round-attempt-complete service handler, after the round-participant write commits, call `recalculateParticipantTotals(participantId)` inside the same transaction (or immediately after, with an explicit `db.transaction` wrapper).
- [ ] **Leaderboard query — switch to derived ordering**
  - [ ] Update `finalizeTournament` ORDER BY to use `SUM(round_score)` / `SUM(round_time_ms)` from `tournament_round_participants` joined back to `tournament_participants`, so the leaderboard ranks correctly even if the cached totals ever drift.
  - [ ] Keep the existing `ROW_NUMBER()` recompute of `rank_final` as-is.
- [ ] **Periodic reconcile cron**
  - [ ] Add a daily cron (in the existing analytics-refresh worker) that re-runs the migration SQL for every tournament.

### Fix #2 — `discussion_threads.comments_count` / `discussion_comments.replies_count`

- [ ] **Migration 0009 — backfill discussion counts**
  - [ ] Write `0009_reconcile_discussion_counts.sql` with two idempotent UPDATEs (one per table).
  - [ ] Snapshot + journal entry.
  - [ ] e2e test: insert comments/replies, run SQL, assert counters.
- [ ] **Repository — accept an optional `db` client**
  - [ ] Change `incrementThreadCommentCount(threadId, delta)` → `incrementThreadCommentCount(threadId, delta, db?)`.
  - [ ] Change `incrementCommentRepliesCount(commentId, delta)` → `incrementCommentRepliesCount(commentId, delta, db?)`.
  - [ ] Update ports and signatures in `discussion/domain/ports/index.ts`.
- [ ] **Service — wrap create/delete in a transaction**
  - [ ] In `discussion.service.createComment`, open `this.db.transaction(async (tx) => { … })` and pass `tx` to `createComment`, `incrementThreadCommentCount`, and `incrementCommentRepliesCount`.
  - [ ] Apply the same wrapper to `softDeleteComment`.
- [ ] **Periodic reconcile cron**
  - [ ] Add a daily job that re-runs the migration SQL across all threads and comments.

### Fix #3 — `users.xp_total`

- [ ] **Decision — drop the column or keep it**
  - [ ] Confirm with product whether the profile endpoint should keep showing total XP. If yes, mirror it. If no, write a migration to drop it.
  - [ ] _Default if no answer_: keep the column and mirror it.
- [ ] **Migration 0010 — backfill `users.xp_total`**
  - [ ] Write `0010_reconcile_users_xp_total.sql` with `UPDATE users SET xp_total = ur.all_time_xp FROM user_ranking ur WHERE … IS DISTINCT FROM`.
  - [ ] Snapshot + journal entry.
  - [ ] e2e test.
- [ ] **Service — mirror after each XP write**
  - [ ] In `XpIngestionService.processXpEvent`, after the `rankingRepository.updateXpInTx` call (still inside the same transaction), add `UPDATE users SET xp_total = $newAllTimeXp WHERE user_id = $userId`.
  - [ ] If the decision was to drop the column, remove `xpTotal` from `users` in the schema, drop the column via migration, and remove the field from `UserMeResponseDto` / DTO mappers.

### Fix #4 — `users.current_streak` / `users.longest_streak`

- [ ] **Implement `StreakService.recalculateStreak`**
  - [ ] Replace the stub with a real implementation that reads the user's last-attempt date from `quiz_attempts` (`SELECT MAX(started_at)::date WHERE user_id = $1 AND status = 'completed'`).
  - [ ] Apply the existing day-bucketing rule (same / yesterday / else).
  - [ ] Compute `current_streak` / `longest_streak` and return a `StreakResult`.
  - [ ] Persist via a new `userRepository.updateStreak(userId, currentStreak, longestStreak)` method, all inside the calling transaction.
- [ ] **Service — wire it into attempt completion**
  - [ ] In `AttemptCommandService.completeAttempt`, after the `completeAttemptAndSideEffects` call (still inside the same transaction or immediately after), call `streakService.recalculateStreak(userId, now)`.
  - [ ] Make sure `AttemptCompletedEvent` carries the pre-/post-streak values so any downstream listener can react without re-querying.
- [ ] **Migration 0011 — backfill streaks**
  - [ ] Write a one-shot Node script (or stored procedure) that recomputes `current_streak` / `longest_streak` for every user from `quiz_attempts` using the same rule.
  - [ ] Run the script against staging first; spot-check 10 users; commit results via `UPDATE users SET current_streak = $1, longest_streak = $2 WHERE user_id = $3`.
- [ ] **Schema constraint check**
  - [ ] Verify `users_streak_order` (`longest_streak >= current_streak`) holds after the backfill; if any row violates, fix the script and re-run.
- [ ] **e2e test**
  - [ ] Seed a user with three consecutive-day completed attempts; assert `current_streak = 3`.
  - [ ] Seed a user with a gap; assert `current_streak = 1`.
  - [ ] Seed a user with no completed attempts; assert `current_streak = 0, longest_streak = 0`.

### Fix #5 — `quiz_stats.bookmark_count` semantic drift

- [ ] **Repository — count distinct users**
  - [ ] Change `MetricsRepository.calculateBookmarkCount` to:
    ```sql
    SELECT COUNT(DISTINCT bc.user_id)::int
    FROM bookmarked_quizzes bq
    INNER JOIN bookmark_collections bc ON bq.collection_id = bc.collection_id
    WHERE bq.quiz_id = $1
    ```
  - [ ] Update `QuizAnalyticsRepository.aggregateBookmarksByQuiz` to match.
- [ ] **Recompute existing stats**
  - [ ] Run `refreshBookmarkMetrics` for every quiz (one-shot script).
- [ ] **Periodic reconcile cron**
  - [ ] The existing analytics refresh already handles this; no new cron needed.

### Fix #6 — bulk bookmark events missing

- [ ] **Service — emit per-row events**
  - [ ] In `BookmarkCommandService.addBookmarksBulk`, after the bulk insert, fetch the returned `bookmarkId`s and emit one `BookmarkAddedEvent` per insertion (mirror the single-bookmark path).
  - [ ] In `BookmarkCommandService.removeBookmarksBulk`, do the same with `BookmarkRemovedEvent`.
- [ ] **e2e test**
  - [ ] Bulk-add 3 bookmarks to one quiz; assert `quiz_stats.bookmark_count` updates.
  - [ ] Bulk-remove; assert it drops back.

### Fix #7 — defense-in-depth for `quiz_stats.total_attempts` / `avg_score_percent`

- [ ] **Periodic recompute cron**
  - [ ] Add a daily job that calls `quizAnalyticsService.refreshQuizMetrics(quizId)` for every quiz, regardless of whether an event was emitted.
  - [ ] This will catch any drift between the inline-increment path in `completeAttemptAndSideEffects` and the source-of-truth COUNT.

### Fix #8 — documentation & ongoing hygiene

- [ ] **Update this audit doc** with the date each fix lands and a link to the corresponding PR.
- [ ] **Add an ADR** (`docs/adr/00XX-counter-reconciliation.md`) describing the policy: denormalized counters must be either (a) updated inside the same transaction as the source-of-truth mutation, or (b) full-SQL-recomputed from source.
- [ ] **Lint rule / pre-commit hook** (optional, follow-up): reject any new `UPDATE … SET column = column + $n` that is not inside a `db.transaction(...)`.
- [ ] **Add an integration test** that runs the entire reconciliation SQL set once per CI pipeline (against an ephemeral DB) and asserts zero drift, so future schema changes can't silently break a counter.

---

## 9. Suggested PR Sequence

To keep each PR small and reviewable, ship them in this order. Each PR is independently revertable.

| PR | Title | Touches | Migration |
|---|---|---|---|
| #1 | Reconcile tournament participant totals | `tournament.repository.ts`, `tournament.service.ts`, leaderboard SQL | `0008_reconcile_tournament_participant_totals.sql` |
| #2 | Make discussion counter increments transactional | `discussion.repository.ts`, `discussion.service.ts`, port interface | `0009_reconcile_discussion_counts.sql` |
| #3 | Reconcile `users.xp_total` from `user_ranking` | `xp-ingestion.service.ts`, possibly `users` schema | `0010_reconcile_users_xp_total.sql` |
| #4 | Implement streak recalculation and backfill | `streak.service.ts`, `attempt-command.service.ts`, `user.repository.ts` | `0011_reconcile_user_streaks.sql` (or run script) |
| #5 | Fix `quiz_stats.bookmark_count` semantic | `metrics.repository.ts`, `quiz-analytics.repository.ts` | none |
| #6 | Emit bookmark events from bulk operations | `bookmark-command.service.ts` | none |
| #7 | Daily reconciliation cron | new worker + scheduler entry | none |
| #8 | ADR + audit-doc update + CI drift test | `docs/adr/`, `docs/plans/denormalized-counters-audit.md`, CI config | none |

---

## 7. Summary

- **16 distinct denormalized counters / cached aggregates** were identified.
- **7 of those are HIGH-risk** — primarily because the application either (a) never writes them at all, or (b) writes them outside the surrounding transaction. Three are silently broken in production right now (`tournament_participants.total_score`, `tournament_participants.total_time_ms`, and the `users.xp_total / streak` columns all return 0).
- **6 are LOW-risk** because they are fully recomputed from authoritative source tables.
- **All HIGH-risk counters are recomputable from other tables** — no counter requires schema changes, only application code changes plus data-only backfill migrations mirroring `0007_reconcile_helpful_count.sql`.
