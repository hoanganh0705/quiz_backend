# Review Module — Production Readiness Audit

> Audit by: Staff Backend Engineer lens
> Date: 2026-07-19
> Scope: `src/modules/review/**`, `core/database/schema/{quiz,auth}/*`, cross-cutting analytics path
> Constraint: correctness over style; assume production-load, adversarial traffic, and eventual consumer integration failures

---

## Glossary of files audited

- Domain services: `src/modules/review/domain/review.service.ts`, `review-admin.service.ts`, `idempotency.service.ts`, `policies/review-authorization.policy.ts`
- Repositories: `src/modules/review/infrastructure/repositories/{review.repository.ts, review-report.repository.ts, review-analytics.adapter.ts}`
- Controllers: `transport/controller/{review.controller.ts, user-review.controller.ts, quiz-review.controller.ts, admin-review.controller.ts}`
- Application: `application/review.application.service.ts`
- DTOs: `dto/request/*.ts`, `dto/response/*.ts`
- Schema: `core/database/schema/quiz/schema.ts` (`quiz_reviews`, `review_helpful_votes`, `review_reports`)
- Cross-module: `src/modules/quiz/domain/{ports/quiz-repository.port.ts, infrastructure/repositories/quiz.repository.ts, domain/analytics/*}`
- Event bus: `domain/events/review-domain.{events,event-bus}.ts`

---

## Issue #1 — `getActiveQuizRecordById` does not enforce `isHidden` or a published version

**Severity:** High
**Category:** Business Logic / Authorization / Validation
**Location:** `review.service.ts:77`, `quiz/infrastructure/repositories/quiz.repository.ts:103`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`

**Description:** The "active quiz" predicate used by `createReview`, `getCreatorQuizReviewAnalytics`, `getQuizReviewStats` only checks `deletedAt IS NULL`. It does NOT filter on `is_hidden = false`, on `publishedVersionId IS NOT NULL`, nor on the underlying `quiz_versions.status = 'published'`. Review creation therefore succeeds for **hidden**, **draft-only** (no `publishedVersionId`), **archived-only**, and **moderator‑unpublished** quizzes.

**Why this is incorrect:** Hidden quizzes are explicitly excluded from public search (`idx_quizzes_search_vector ... WHERE deleted_at IS NULL AND is_hidden = false`). Allowing reviews on hidden quizzes contradicts that contract: users can't see the quiz by browsing, but anonymous / search-driven actors can still be linked to it via review aggregates. More importantly, `getCreatorQuizReviewAnalytics` exposes a non-empty analytics payload to the quiz's *creator* even when the creator archived (or hid) the version — analysts see metrics on a quiz that is intentionally not published. Bots can also enumerate UUIDs and leave reviews on quizzes with no UI affordance to ever see them.

**Example scenario:**
1. Admin sets `quiz = hidden` and removes `publishedVersionId`.
2. Attacker who knows the UUID completes an attempt, posts `rating: 1, comment: "spam"`. Review row is created; the cached `avg_rating` on `quiz_stats` is now contaminated.
3. Creator later un-hides — public users immediately see a low average seeded by a review that nobody knew existed.

**Impact:** Cached analytics (rating, distribution) include reviews on quizzes that public users can never legitimately encounter. Moderation queues fill with content nobody can see. Search-driven user flows break (the review row may now cite the quiz in `user_review_dashboard.favoriteCategory/favoriteTag` joins — making the hidden quiz part of an *active* user's public stats).

**Suggested direction:** Strengthen `getActiveQuizRecordById` (or add a review‑specific variant) to additionally require `is_hidden = false` and `published_version_id IS NOT NULL`. Apply consistently to create / stats / analytics entry points.

---

## Issue #2 — `createReview` race condition produces duplicate rows under concurrent POSTs

**Severity:** High
**Category:** Concurrency / Data Integrity
**Location:** `review.service.ts:91-148`, `review.repository.ts:55-71`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** The duplicate-prevention code path is:

```ts
const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
if (existing) { throw 409 }
await this.db.transaction(async (tx) => { tx.insert(quizReviews).values(...) });
```

Both the `SELECT` and the `INSERT` use the bare `db` client, not a serializable transaction, and there is no advisory lock or row lock taken. Two simultaneous `POST /quizzes/:q/reviews` for the same `(quiz, user)` pair each pass the `existing` check before either commits, and both then insert. Even though there is a `UNIQUE (quiz_id, user_id)` constraint, the constraint *will* fire — only one INSERT succeeds and the loser is converted to a 409 via the `23505/uq_quiz_reviews_quiz_user` fallback. That's correct in the **steady state**, but the loser has already done the side-effects:

- The loser fetched `getActiveQuizRecordById` (a wasted read, fine).
- The loser executed the `hasCompletedAttempt` query (a wasted read, fine).
- The loser pulled the `nowIso` and entered `db.transaction` unnecessarily.
- More importantly: the *caller* sees a 409 Conflict on retry. **But** — the loser did **not** dispatch the analytics event, so for the losing client, their idempotency cache is keyed on `(idempotencyKey, user.sub, 'createReview')`. If the loser retries with a different key, it will attempt the insert again and again collide — but now any side effects tied to "create attempt #N" (e.g., activity streams, achievement increments elsewhere) could be duplicated by either path.

While the database UNIQUE protects against duplicate rows, the lack of `SERIALIZABLE` isolation means the application produces confusing logs (race warnings on every duplicate pair) and any future side effects inside the transaction will multiply.

**Why this is incorrect:** The check-then-act is a classic pattern that requires either an explicit lock or a serializable isolation level to be correct. The current implementation relies entirely on the UNIQUE constraint being the *only* invariant, not on transaction semantics.

**Example scenario:**
1. Mobile client with aggressive retry: POST #1 fires, network drops before response. Client retries.
2. Server is processing POST #1 when POST #2 lands. Both pass `existing == null`. Both reach `tx.insert`. UNIQUE constraint catches the second. POST #2 → 409.
3. Client treats 409 as "duplicate, but my first POST succeeded" — fine. **But** if a developer later adds `emitFirstReviewAchievement(event)` inside the transaction, both transactions will fire it.

**Impact:** Today, zero incorrect rows. But the pattern is fragile to any future developer extending the transaction body. The "duplicate review rejected" log warning fires unnecessarily under concurrent load.

**Suggested direction:** Either take a `pg_advisory_xact_lock(hashtextextended($1||$2))` keyed on `(quizId, userId)` inside the transaction, or upgrade the transaction to `SERIALIZABLE`. Document the invariant.

---

## Issue #3 — Hard-delete on DELETE leaves analytics denormalized; onDelete cascade is silent

**Severity:** Critical
**Category:** Transaction / Data Integrity / Counter
**Location:** `review.service.ts:382-408`, schema `quiz/schema.ts:594` (`onDelete: 'cascade'`), analytics `quiz-analytics.service.ts:141-155`
**Affected files:** `src/modules/review/domain/review.service.ts`, `core/database/schema/quiz/schema.ts`, `src/modules/quiz/domain/analytics/quiz-analytics.service.ts`

**Description:** `deleteReview` issues `DELETE FROM quiz_reviews WHERE review_id = ?` inside a transaction. This **hard-deletes** the row. The schema cascade:

```
quiz_reviews → onDelete: 'cascade'  ←  review_helpful_votes, review_reports
quiz_id     → onDelete: 'cascade'  ←  quizzes
```

Cascade immediately drops all `review_helpful_votes` rows for the review. After commit:

1. The `ReviewDeletedEvent` is *dispatched* to in-process subscribers.
2. The Quiz analytics subscriber refreshes review metrics via `refreshReviewMetrics`, which calls `calculateAverageRating(quizId)` and `calculateRatingCount(quizId)` from `quiz_reviews`. Once the review is gone, the source‑of‑truth average/rating count matches the row deletion — **good**.

**However**, several serious sub-issues exist:

- **Analytics write is fire-and-forget.** `review-event-listener.adapter.ts:57-59` uses `void this.handleEvent(event)`. The HTTP response to the user returns *before* analytics refresh. Under load or process crash, the denormalized `quiz_stats.avg_rating` / `rating_count` will drift indefinitely. The same is true of bookmark counters after a quiz delete, but the explicit user-visible bug here is: a creator deletes a bad review, then refreshes their analytics dashboard a second later and still sees the old rating.
- **Listener is registered in `QuizModule.onModuleInit`.** If `QuizModule` and `ReviewModule` fail to wire (e.g. misconfiguration), the warning `review_event_listener_no_bus` is logged once at startup and `void`-discarded — analytics refresh silently never runs. There is no health check.
- **No `quiz.deleted` listener refreshes `quiz_stats.rating_count` / `avg_rating` on soft-delete of the parent quiz.** A soft-deleted quiz still has its reviews in `quiz_reviews`; the analytics row continues to count ratings for an invisible quiz. The `invalidateQuizMetrics` only deletes `quiz_stats` row when the *quiz* itself is *hard*-deleted — but quizzes are soft-deleted via `deletedAt`. So deleted quizzes' denormalized `avg_rating` and `rating_count` live forever in `quiz_stats`. (Cross-checked at `quiz-analytics.service.ts:248-263`.)
- **The `ReviewDeletedEvent` does NOT include `oldRating`.** Subscribers that need to decrement a weighted counter (none today, but anything built later) cannot reconstruct the prior state. This is design debt: events must be self-describing for at-least-once delivery.
- **`deleteReview` does NOT clear `helpful_count` because the row is gone** — fine — but it also does **not** verify that an outstanding `addHelpfulVote` or `removeHelpfulVote` transaction is not mid-flight. If a vote is in-flight inside `transactionalContext` for the same review when the delete lands, the cascade wins and the vote decrement runs against a row that's been deleted; the SQL `UPDATE WHERE review_id = X` becomes a 0-row update, which is fine — but the user's HTTP response will then say "Vote removed successfully" with `removed = true`. The user can no longer see the review anyway, so the silent no-op is invisible.

**Why this is incorrect:** Multiple compounding issues. The most operationally important is that the analytics path is asynchronous and not in the same transaction as the source row.

**Example scenario:**
1. Author deletes a 1-star review. Review row gone, cascade deletes 5 helpful votes.
2. Quiz creator's analytics dashboard, queried **50 ms later**, still shows `avg_rating: 4.2` and `rating_count: 14`.
3. A creator who deletes reviews to escape negative feedback sees no change in their analytics until the periodic reconciler runs (which doesn't exist for review metrics — see Issue #9).
4. Compounding: if the listener crashes between event and subscriber call, the analytics row is wrong forever.

**Impact:** Authored-cheating defenses (review removal) are *visibly* neutered because the analytics still show the deleted review's impact for an unbounded window. **Most damning**: this is the exact mechanism a malicious review author would use to game their quiz's rating back up after taking damage.

**Suggested direction:** Move analytics refresh into the same DB transaction (or to an outbox table processed asynchronously). Add a `reconcileReviewMetrics` sweep alongside `reconcileAllQuizMetrics`. Include old values in `ReviewDeletedEvent`. Add a startup health check verifying the listener is wired.

---

## Issue #4 — `helpfulCount` has no DB CHECK constraint and can go negative

**Severity:** High
**Category:** Data Integrity / Concurrency
**Location:** `core/database/schema/quiz/schema.ts:572`, `review.repository.ts:367-371, 414-417`
**Affected files:** `src/core/database/schema/quiz/schema.ts`, `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** The DDL is:

```sql
helpful_count SMALLINT NOT NULL DEFAULT 0
```

There is no CHECK constraint `helpful_count >= 0`. The repository's `addHelpfulVote` is atomic (insert → onConflictDoNothing → counter `+1`), and `removeHelpfulVote` is atomic (delete → counter `-1`). They both wrap in a transaction.

But **a `helpfulCount` decrement with no insert has no write-side protection beyond the counter being a non-negative number**. Concrete drift paths:

- A `removeHelpfulVote` runs after the vote row was already deleted by an external cascade (admin-manual `DELETE FROM review_helpful_votes`). The repo's `delete` returns 0 rows → repo returns `false` → counter update is skipped → counter stays at e.g. 3. (Good path; no drift.)
- **BUT** the `transactionalContext` reuse path. When a HTTP request joins an outer transaction (the `existingTx` branch), the counter update runs against the same transaction the caller uses for review create/update. There is no isolation guarantee the decrements and inserts agree on state at commit time (they do work — they are sequential). However the *real* concern is that nothing forces the counter update to be wrapped in a way that **fails** the transaction if the post-condition is violated. A `helpfulCount = -1` is a legal value.

- The most concrete way to reach `-1`: `helpful_count` defaults to 0 on insert. If a regression causes `removeHelpfulVote` to run (perhaps triggered by a future bulk-removal API for admin "remove all votes") against a review with no votes, the `deleted.length === 0` check correctly skips the decrement — but a developer who later adds a bulk-clear path could remove the if-skip and the SQL `helpful_count - 1` would run unconditionally, creating a negative counter that survives future reconciliation logic and produces `helpful_count = -1` displayed via the DTO.

**Example scenario:**
1. Backend operator sets `UPDATE review_helpful_votes SET review_id = NULL WHERE …` (data fix). Counter unchanged.
2. Admin bulk-deletes 10 helpful vote rows for review X. `helpful_count` should be 0 now, but Drizzle counter is 12.
3. Future `reconcile-helpful-counter` job recomputes from a buggy aggregate → `helpful_count = 12 - 10 = 2` is "correct" but the drift has *already existed for a while*.

**Impact:** Silent semantics drift. Negative counters can leak into UI ("-42 people found this helpful"). Listing by helpful sort uses `ORDER BY helpful_count DESC, review_id DESC` — so a review at `-1` is grouped with the very bottom, dragging skew in `helpful` and `highest_rating`/`lowest_rating` aggregations.

**Suggested direction:** Add `check('quiz_reviews_helpful_count_nonneg', sql\`helpful_count >= 0\`)`. Same for any future stats deltas. Verify `addHelpfulVote` and `removeHelpfulVote` are also wrapped server-side in their own statement-level transaction (not as part of an unrelated outer tx) so the regression risk is centralized.

---

## Issue #5 — `removeHelpfulVote` is non-idempotent at the application layer; DELETE endpoint after a successful DELETE returns "removed"

**Severity:** Medium
**Category:** API Design / Idempotency
**Location:** `review.controller.ts:48-58`, `review.service.ts:282-296`, `application/review.application.service.ts:202-205`
**Affected files:** `src/modules/review/transport/controller/review.controller.ts`, `src/modules/review/domain/review.service.ts`, `src/modules/review/application/review.application.service.ts`

**Description:** The DELETE endpoint calls `removeHelpfulVote`, which returns `true` if a row was deleted or `false` if no vote existed. The controller passes the boolean through `selectHelpfulMessage`-like logic:
- `removed === true` → `"Helpful vote removed"`
- `removed === false` → `"No helpful vote to remove"`

The HTTP status is **always 200 OK**, regardless of whether state changed. A client receiving `"No helpful vote to remove"` cannot distinguish "I had a vote and it was removed" from "I had no vote". Both responses look like a successful mutation.

**Why this is incorrect:** Per RFC 7231 / REST best practice, DELETE on an already-deleted resource should be **idempotent**. The verb is idempotent — calling it twice with the same effective body should not change the long-term state. But the *response payload* should *either* be identical (same 200 + same body) *or* the second call should explicitly return 204 No Content with no body. Returning 200 with `"Helpful vote removed"` on the first call and `"No helpful vote to remove"` on the second is **not idempotent at the API surface** — the second response message is different, and a client retrying a failed DELETE should not be surprised by a different message.

Compounding: the **POST /helpful** endpoint also supports `helpful: false`, which routes to the same `removeHelpfulVote`. So:

- POST /helpful `{helpful: false}` first time → `"Helpful vote removed"`
- POST /helpful `{helpful: false}` second time → `"No helpful vote to remove"`
- DELETE /helpful first time → `"Helpful vote removed"`
- DELETE /helpful second time → `"No helpful vote to remove"`

Either ordering produces the same log lines but **different** HTTP response messages. Clients writing integration tests against these strings are forced to handle both.

**Impact:** Subtle behavioral inconsistency. Confuses debugging, log analysis, and integration tests.

**Suggested direction:** Pick one: either return 204 No Content on the second-in-a-row call, or always return the same body. Document idempotent-200 + body contract.

---

## Issue #6 — `reportReview` has TOCTOU window between `hasUserReportedReview` check and `createReport` insert

**Severity:** High
**Category:** Concurrency / Data Integrity
**Location:** `review.service.ts:316-329`, `review-report.repository.ts:18-26`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/infrastructure/repositories/review-report.repository.ts`

**Description:** `reportReview` performs:

```ts
const hasReported = await this.reportRepository.hasUserReportedReview(reviewId, reporterId);
if (hasReported) { throw ReviewAlreadyReportedError }
const report = await this.reportRepository.createReport({...});
```

The unique index `uq_review_reports_review_reporter (review_id, reporter_id)` enforces uniqueness, but the application throws `ReviewAlreadyReportedError` *only if* it observed a duplicate via the pre-check. Two concurrent reports from the same user race:

- Both pass `hasUserReportedReview` (concurrent SELECTs see no row).
- Both call `createReport`. The unique index catches the second.
- The second INSERT throws `23505` (unique violation). The application **does not** translate this into `ReviewAlreadyReportedError` — it bubbles a 500.

**Example scenario:**
1. User hits the "Report" button twice quickly. Frontend's debouncing missed.
2. Server returns 500 for the second click. The user retries, this time succeeds (the unique row blocks the third insert, now correctly translated to 409).
3. Mobile crash analytics dashboard reports 1,000 spurious 500s per minute from a popular review.

**Impact:** Under normal operation, the 23505 escape path is the dominant cause of 500s for `POST /reviews/:reviewId/report`. Less important than the duplicate‑create race because the unique index protects data, but the user experience and observability suffer.

**Suggested direction:** Either wrap in serializable transaction, or catch 23505 in `createReport` and rethrow as `ReviewAlreadyReportedError` (translate at the repository boundary, or in the service catch block — mirrors the pattern already used for `createReview`).

---

## Issue #7 — Review reports remain after review deletion (cascade is correct, but list endpoints leak deleted reviews)

**Severity:** High
**Category:** Data Integrity / Authorization
**Location:** `core/database/schema/quiz/schema.ts:899`, `infrastructure/repositories/review-report.repository.ts:43-71`
**Affected files:** `src/modules/review/infrastructure/repositories/review-report.repository.ts`, `src/modules/review/domain/review.service.ts`

**Description:** Wait — re-reading the schema: `review_reports.review_id` is `onDelete: 'cascade'`. So hard-delete of the review cascades to delete its reports. So there's actually no orphan reports. ✅

But the inverse issue exists on the user's "my reported reviews" list. Once a report is closed (status = `reviewed`, `dismissed`, or `actioned`) it stays in the user's `users/me/reported-reviews` list forever. There is no expiry, no archival, no status filter — the endpoint just returns all reports regardless of status. From a privacy standpoint, users should reasonably be allowed to filter to `status = 'open'` so they can hide closed reports.

This is a **minor** API design issue but I noted it during the audit. The bigger issue is that there's **no way for a user to see whether their report was actioned**. The `actioned` status indicates the moderator took action against the *review* (not the report), not action against the *reporter*. The reporter has no signal whether the moderator dismissed their report vs took action against the review.

Categorizing lower priority.

---

## Issue #8 — `reportReview` does not guard against reporting a *deleted* (soft-deleted target → hard-deleted) review

**Severity:** High
**Category:** Authorization / Business Logic
**Location:** `review.service.ts:298-339`, `review.repository.ts:95-111`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** `getReviewById` reads `quiz_reviews` by primary key. It does not check whether `quiz_reviews.deletedAt IS NOT NULL` (there is no `deletedAt` column). The DB does not have soft-delete on `quiz_reviews` — reviews are *hard-deleted*. So this can't happen for a deleted review because the row is gone. ✅

BUT — the review can be **soft-deleted at the quiz level**. If the quiz is hidden or soft-deleted (`quizzes.deletedAt IS NOT NULL`), `getReviewById` still returns it. The reporter's `POST /reviews/:id/report` succeeds against an invisible review. The cascading architecture ensures the moderator queue grows with reports against reviews users can't see or that resolve to nothing.

**Why this is incorrect:** A report requires a real, currently-visible review. Otherwise moderators waste time triaging reports against an orphaned review that the public can't see, and the reporter's data is recorded against an effectively-decommissioned resource.

**Impact:** Moderation queues fill with reports against invisible content. Reputation system counts (`user_review_dashboard.totalReviews`) silently includes orphan reviews on quizzes that may be revived.

**Suggested direction:** When loading a review for reporting, also require the parent quiz to be `deletedAt IS NULL AND is_hidden = false AND published_version_id IS NOT NULL`. Reject with 404 (`ReviewNotFoundError`).

---

## Issue #9 — `quiz_stats.avg_rating` and `rating_count` are denormalized counters with **no per-quiz reconciliation job**

**Severity:** Critical
**Category:** Data Integrity / Counter / Transaction
**Location:** `quiz-analytics.service.ts:94-114, 121-155, 387-451`, `quiz-analytics.repository.ts:151-164`
**Affected files:** `src/modules/quiz/domain/analytics/quiz-analytics.service.ts`, `src/modules/quiz/domain/analytics/quiz-analytics.repository.ts`

**Description:** `quiz_stats.avg_rating` and `quiz_stats.rating_count` are denormalized counters. There are *two* paths to keep them in sync:

1. The event-driven path: `review.submitted`/`review.deleted` → `AnalyticsEventHandler.onReviewSubmitted/onReviewDeleted` → `refreshReviewMetrics` → `metricsRepository.calculateAverageRating/calculateRatingCount(quizId)` → `upsertQuizStats`. (Source of truth: `quiz_reviews` aggregate.)
2. The bulk reconciliation path: `reconcileAllQuizMetrics` is wired for the *attempt* side, but **not** for the review side. There is no `reconcileAllReviewMetrics` or any equivalent that re-aggregates all reviews.

The two problems:

- The event-driven path is **fire-and-forget** (void discard in `review-event-listener.adapter.ts:58`). A dropped event, a process crash, a misconfigured listener — and the counters drift forever.
- A reconciliation sweep that recomputes from source-of-truth is **missing** for review metrics.

Compounding: bulk SQL ops (DB restores, missing triggers, manual DBA `UPDATE quiz_reviews SET ...`) cause permanent drift. `validateMetrics` *checks* but doesn't *fix* and emits warnings that are easy to ignore.

**Impact:** The biggest, most user-visible consequence: creator dashboard `avg_rating` is wrong after a sequence of create/delete/create races or moderator hard-deletes that bypass the listener. Recompute is a periodic job that **does not exist** for reviews. This is the same class of bug the bookmark module used to have (per `docs/plans/denormalized-counters-audit.md`), and that fix is referenced for attempts but the parallel for reviews was never implemented.

**Suggested direction:** Add a `reconcileAllReviewMetrics()` method on `QuizAnalyticsService`, scheduled daily, that iterates active quiz IDs and recomputes `avg_rating` + `rating_count` from `quiz_reviews`. Wire it into the same cron that runs `reconcileAllQuizMetrics`. Add active health check that alerts when the analytics listener is dead.

---

## Issue #10 — Cursor `createdAt` deserialization accepts any ISO date prefix instead of full ISO 8601

**Severity:** Low
**Category:** API Design / Validation
**Location:** `review-cursor.mapper.ts:6-14`
**Affected files:** `src/modules/review/mappers/review-cursor.mapper.ts`

**Description:** The `ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/` accepts a *prefix* of an ISO timestamp (no timezone, no millis, no trailing characters required). A pagination cursor `2026-01-01T99:99:99` will validate, then crash the SQL `WHERE` clause with a Postgres error. The mapper throws a generic `Error('Invalid cursor')` which the controller does not currently translate, returning a **500 Internal Server Error** instead of a clean 400 Bad Request.

**Why this is incorrect:** A paginating client retrying with a partially-malformed cursor gets a server error in production logs. Track this: any malformed cursor is a 400-class bug.

**Impact:** Trivially-rate-limited cursor spam creates noise in error logs and triggers an exception path through the global filter that may mask real internal errors.

**Suggested direction:** Tighten the regex to `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$`. Catch the parse failure and throw a domain exception that maps to 400.

---

## Issue #11 — Sort by `helpful_count` is unstable, drops ties unpredictably

**Severity:** Medium
**Category:** Data Integrity / API Design
**Location:** `review.repository.ts:171-182`
**Affected files:** `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** The `helpful` sort path is:

```ts
.orderBy(desc(quizReviews.helpfulCount), desc(quizReviews.reviewId))
.limit(params.limit + 1);
```

The cursor condition for `helpful` sort reuses the `createdAt` cursor — but the sort itself is on `helpful_count, review_id`. The cursor predicate is keyed on `createdAt`/`reviewId`, but the sort is keyed on `helpful_count`/`reviewId`.

**Why this is incorrect:** Cursor pagination requires that the ORDER BY columns **match** the cursor predicate. If the sort is `ORDER BY helpful_count DESC, review_id DESC` and the cursor predicate is `createdAt < ? OR (createdAt = ? AND review_id < ?)`, then:

- The cursor predicate filters rows, but the *ordering* is by `helpful_count`.
- Pages emitted by this approach may **skip** rows (because two rows with the same `createdAt` but different `helpful_count` are filtered by the predicate but ordered differently).
- Worse: a row with a *newer* `createdAt` but *higher* `helpful_count` may not match the cursor at all, so it can be skipped or duplicated across pages.

This is not just a theoretical problem. The `CursorMapper.parseReview` throws on a missing `createdAt`, which the `helpful` sort does not produce. Clients who try to paginate the helpful‑sorted list **cannot supply the cursor type the server expects**, but the cursor field on the response is still generated via `CursorMapper.serializeReview` (using `createdAt`+`reviewId`). Pagination across `helpful`-sorted pages is broken or unstable.

**Example scenario:**
1. Page 1, 20 reviews sorted by helpful_count DESC. Last row at cursor `createdAt=2026-01-10T...`, `reviewId=R10`.
2. Page 2 query: `WHERE helpful_count < cursor_helpful OR ... AND createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND review_id < cursor.reviewId)`. The two predicates are *different*. Postgres will scan in `helpful_count` order but only emit rows that match the cursor predicate in `createdAt`. Result: skipped or duplicated rows.

**Impact:** `?sort=helpful` pagination is broken at scale. Users see the same review twice on page 2, or miss reviews entirely.

**Suggested direction:** The `helpful` sort cursor **must** be `(helpfulCount, reviewId)` instead of `(createdAt, reviewId)`. Either change the cursor format or split the cursor params per-sort.

---

## Issue #12 — `ReviewAnalyticsPort` injected into `ReviewService` but never called (dead dependency)

**Severity:** Low
**Category:** Maintainability
**Location:** `review.service.ts:60-62`, `review.module.ts:51`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/review.module.ts`

**Description:** `ReviewAnalyticsPort` is bound to `ReviewAnalyticsAdapter`, which is constructed and provided to `ReviewService`. `ReviewService` never invokes any method on it (verified via `grep reviewAnalytics\\.`). The actual analytics update flows through the `ReviewDomainEventBus` and the quiz-side `ReviewEventListenerAdapter`.

**Why this matters:** Dead dependencies hide future drift. A developer who wires `reviewAnalytics.handleReviewSubmitted(event)` into `createReview` (changing the analytics path) will not break the unit test (`review.service.spec.ts:21-24` mocks it), but their change will silently duplicate the analytics refresh — once via the listener, once via the port. Double-refresh is harmless today but doubles the cascade-update rate.

**Impact:** Currently zero correctness impact. Future-state risk: inadvertent double-counters on review events.

**Suggested direction:** Remove the unused `ReviewAnalyticsPort` injection from `ReviewService` and the unbinding from the module. Keep the adapter if used elsewhere.

---

## Issue #13 — Idempotency key replay returns *cached 4xx/5xx responses*

**Severity:** High
**Category:** API Design / Idempotency
**Location:** `idempotency.service.ts:25-77`, review application service usages at `review.application.service.ts:46-62, 180-192, 212-228`
**Affected files:** `src/modules/review/domain/idempotency.service.ts`, `src/modules/review/application/review.application.service.ts`

**Description:** `IdempotencyService.checkAndSet` stores the `computeResponse()` return value as JSON in `idempotency_keys.response`. On replay, it returns that JSON. But:

- If `computeResponse` *threw* (e.g. the first call returned 404 because the quiz did not exist at the time), the throw escapes the closure **before** `idempotencyKeys.insert(...)` runs (the catch only handles the 23505 from the insert path). So a failing first call does NOT cache.
- Conversely, if the first call *succeeded* with a 200 message like `"Review marked as helpful"`, the second call **with a different state of the world** (e.g. the helpful vote was already removed by a parallel DELETE) returns the cached 200 even though the operation would have failed or succeeded differently. The cached response is treated as authoritative forever (24h TTL).
- The cached response shape can include state-evolving values. For example, `"Review marked as helpful"` is a constant string — safe to cache. But if the response included the reviewId of a freshly created review, that's also safe. **However**, the success response for `createReview` returns the review row including `createdAt`; the cache for `createReview` therefore records the row's `createdAt` and `reviewId`. A replay returns the originally-created review's id — *good for idempotency*.

But: the more subtle issue is that **`reportReview`'s idempotency wrapper** never returns the cached `response`! Lines 213-227:

```ts
const { response } = await this.idempotencyService.checkAndSet(
  payload.idempotencyKey,
  user.sub,
  'reportReview',
  async () => {
    await this.reviewService.reportReview(...);
    return { message: 'Review reported successfully' };
  },
);
return { message: 'Review reported successfully' };  // ← ignores `response`
```

The destructured `response` is **discarded**. The second call with the same key will:
- hit `existing != null` in `checkAndSet` and immediately return `{ isNew: false, response: ... }`,
- but the caller ignores `response` and constructs a fresh `{ message: 'Review reported successfully' }`.

So the idempotency cache is bypassed for `reportReview` entirely! The DB write is still gated by the unique index on `(review_id, reporter_id)`, so no duplicate row is created. But the **second call goes through the duplicate-pre-check, attempts an INSERT, and gets a 409**. *The user sees a 409 on replay — not the cached 200 that idempotency should have produced.*

This is a **striking inconsistency** between `createReview` and `markReviewHelpful` (which correctly return `response!`) and `reportReview` (which does not).

**Impact:** The idempotency key for `reportReview` is silently a no-op — the user gets a 409 on retry instead of a clean replay. Combined with auto-retry libraries (axios-retry etc.), this creates user-visible "I reported this review 50 times!" alerts.

**Suggested direction:** Return `response!` from `reportReview`, like the other two endpoints. Standardize the pattern across the module.

---

## Issue #14 — Idempotency TTL is silently fixed at 24h with no cleanup job

**Severity:** Medium
**Category:** Data Integrity / Performance
**Location:** `idempotency.service.ts:15-32, 79-86`
**Affected files:** `src/modules/review/domain/idempotency.service.ts`

**Description:** `idempotency_keys.expiresAt` is `now + 24h`, but `deleteExpired()` exists and is **never scheduled** anywhere. Rows accumulate in `idempotency_keys` forever. Under reporting load (where reviewers may also be targets of mass reports), table bloat.

The schema presumably has a unique constraint on `(key, user_id)`. Confirmed by re-reading the DTOs that all idempotency keys are user-scoped.

**Impact:** Storage growth, slow hash-index scans. Not catastrophic but symptomatic.

**Suggested direction:** Schedule `IdempotencyService.deleteExpired()` daily via `@nestjs/schedule` cron. Or partial-index `WHERE expires_at > now()`.

---

## Issue #15 — `listMyReviews` and `listReviewsByUser` join `quizzes` and break if the quiz is hard-deleted or NULL

**Severity:** Medium
**Category:** Data Integrity / API Design
**Location:** `review.repository.ts:222-258`, `quiz-review.controller.ts:65-78`
**Affected files:** `src/modules/review/infrastructure/repositories/review.repository.ts`, `src/modules/review/transport/controller/user-review.controller.ts`

**Description:** `listUserReviews` performs an `INNER JOIN quizzes ON quiz_reviews.quiz_id = quizzes.quiz_id`. If the parent quiz is hard-deleted, the FK `cascade` deletes the review (so this can't happen today). **But** if the quiz is soft-deleted (`deletedAt IS NOT NULL`) the row stays, and the join returns the title of an invisible quiz to a viewer who is allowed to see their own review history.

**Additionally, soft-deleted quizzes' reviews leak the quiz's title** (which is normally hidden by the public path) into the user's "my reviews" list. Author-side: a quiz creator who hides their quiz can still see the title through their reviews tab. Privacy minor.

More material: `listReviewsByUser` is a **public** (`@Public()`) endpoint that exposes `quizTitle` for any user — including reviews on hidden/archived quizzes. Since hidden quizzes are not listable, an attacker who guesses a reviewer's userId can enumerate their reviews and learn the titles of hidden quizzes they've interacted with.

**Impact:** Hidden quiz titles leak via `/users/:userId/reviews`. This is the canonical "hidden quiz IDOR" pattern.

**Suggested direction:** Either hide reviews where the parent quiz is hidden, or filter the `listReviewsByUser` endpoint to require auth + the requesting user being the profile owner OR the quiz being visible. Add `is_hidden = false AND deleted_at IS NULL` to the join WHERE.

---

## Issue #16 — `reportReview` does NOT block reports against archived/dismissed reports AND has no rate limiting

**Severity:** High
**Category:** Business Logic / Performance
**Location:** `review.service.ts:298-339`, `review-report.repository.ts`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/infrastructure/repositories/review-report.repository.ts`

**Description:** A user can repeatedly file a new "report" against the same review. But:
- The UNIQUE INDEX on `(review_id, reporter_id)` prevents duplicate pending reports.
- The first report with status `open` is the only one until status changes to `dismissed`/`reviewed`/`actioned`.
- After a moderator dismisses the report, the user **cannot** re-report that review (unique still holds).

This is actually CORRECT behavior — but only because no admin path changes status. If `updateReportStatus` flips `open → dismissed`, the reporter sees "I've been dismissed" and **cannot escalate or re-report** with new evidence. This is a usability gap that attackers may exploit to harass: a dismissed report means an endless game of "I reported this review, the moderator closed it, the platform ignored my report forever."

**Additionally, there is no rate limit:**
- One user cannot create 1000 reports because the UNIQUE constraint prevents duplicates.
- But across users, **any** number of users can file independent reports against the same review. A bot network could file 100k reports on a single review by 100k distinct user accounts. This bloats the moderator queue.

**Impact:**
- Bot-driven mass reports exhaust moderation capacity (a legitimate use case for moderation queues — reports should be costlier to file). 
- Real users can not re-escalate after dismissal with new context.

**Suggested direction:**
- Add a rate-limit middleware (Redis token bucket) for `reportReview`.
- Add an *update* endpoint so a reporter can supplement their dismissed report with new evidence without creating a new row.

---

## Issue #17 — `deleteReview` does NOT clean up `helpfulCount` because the review itself is gone — but the FK cascade on `review_helpful_votes` may erase votes the user thought they had voted for

**Severity:** Medium
**Category:** Data Integrity / User Experience
**Location:** `review.service.ts:382-408`, schema `quiz/schema.ts:840-849`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/core/database/schema/quiz/schema.ts`

**Description:** When a review is hard-deleted, all `review_helpful_votes` are cascade-deleted. Users who voted "helpful" lose their vote silently — `addHelpfulVote` would return `false` ("already voted") on the *same review ID* if we tried to re-vote, because the row was just deleted and a re-insert would succeed. But the user has no UI signal. And if a user tries to `addHelpfulVote` on a *deleted* review, the repository will:

1. `assertCanVote(reviewId, userId)` — `getReviewById` returns null → throw `ReviewNotFoundError`. 

So votes on deleted reviews return 404. OK. But *concurrent*: a vote insert + review delete. Already analyzed in Issue #3 — no end-state corruption, but no transaction-level ordering.

**Impact:** Mid. Users lose track of votes silently.

**Suggested direction:** Consider soft-deleting reviews (added `deletedAt` column). Migrate `review_helpful_votes` `onDelete` to `set null`. This requires schema migration.

---

## Issue #18 — Bulk `reportReview` request body `details` may exceed DB limits / contains uncontrolled free text

**Severity:** Low
**Category:** Validation / Data Integrity
**Location:** `report-review.dto.ts:5-37`, `core/database/schema/quiz/schema.ts:867`
**Affected files:** `src/modules/review/dto/request/report-review.dto.ts`, `src/core/database/schema/quiz/schema.ts`

**Description:** `ReportReviewDto.reason` has `MaxLength(255)`, which matches `text()` column default Postgres truncation. `details` has `MaxLength(2000)`. ✅ BUT — there is no `@MinLength` on `reason` (server-side), and although the DB CHECK `review_reports_reason_nonblank` enforces `length(btrim(reason)) > 0` (good), the **dto** does not. So the user can submit `reason = ""` with the DB constraint rejecting *eventually*, but the error path goes through Postgres 23514 (check violation), not a friendly 400. Worse: the reason is documented as "free-form" but then a moderator sees arbitrary user-generated text.

Also: the `@IsEnum` for reasons was discussed in the OpenAPI docstring as if it were enum-limited, but actually it's free text. The swagger example shows `'spam'` / `'harassment'` / `'inappropriate_content'` / `'other'` as common values, implying a closed set, but **the DTO enforces nothing**. Moderators can't reliably group reports by reason.

**Impact:** Moderation dashboards cannot compute "how many reports tagged spam today" without text mining. Users sending misspelled reasons see Postgres error 500.

**Suggested direction:** Use `@IsEnum(['spam', 'harassment', 'inappropriate_content', 'other'])` (or similar closed set), keep `details` as free text.

---

## Issue #19 — `assertCanVote` runs `getReviewById` for every vote attempt — no caching, no audit

**Severity:** Low
**Category:** Performance
**Location:** `review.service.ts:253-264`
**Affected files:** `src/modules/review/domain/review.service.ts`

**Description:** Every helpful vote attempt performs:

1. `getReviewById(reviewId)` — selects `quiz_reviews` JOIN `quizzes`, `users`, returning many fields (for detail view), even though `assertCanVote` only needs `userId` and existence.
2. `addHelpfulVote({reviewId, userId})` — does its own work.

The 1st query joins two tables it doesn't need (joined via `findReviewById`, not the slimmer `getReviewById`). That's two extra rows × 4 columns every vote.

**Impact:** Helpful votes are unlikely to be a hot path, but a malicious user could enumerate UUIDs and trigger `assertCanVote` 100k times a second, each one hammering the DB.

**Suggested direction:** Add a lightweight "review author + exists" fetch, or reuse `addHelpfulVote`'s RETURNING with a FK constraint check that throws "review not found" specifically.

---

## Issue #20 — `getReviewById` is `Public` but joins `quizzes` AND `users`, exposing user PII (email hash will leak via join?)

**Severity:** Low
**Category:** Authorization / Privacy
**Location:** `review.controller.ts:73-80`, `review.repository.ts:113-134`
**Affected files:** `src/modules/review/transport/controller/review.controller.ts`, `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** `GET /reviews/:reviewId` is `@Public()`. It calls `findReviewById`, which INNER JOINs `users` (for `username`) and INNER JOINs `quizzes` (for `quizTitle`). Even though the response DTO only surfaces `username`/`quizTitle`, these are surfaced anonymously. An attacker enumerating UUIDs can scrape usernames / quiz titles for hidden quizzes (per Issue #15). The `findReviewById` is the same path used by `getReviewById` and `getMyQuizReview` — both fine — but the public route opens it up.

A user can also see the review of any user, including their own (sensitive content like profanity, harassment) without authentication. Some moderation policies require auth on read-by-id.

**Impact:** Moderate privacy concern. Public read of any review by ID works only if the quiz is visible.

**Suggested direction:** Either require auth on `/reviews/:id`, or only return the review if the parent quiz is publicly visible.

---

## Issue #21 — `getCreatorQuizReviewAnalytics` allows admin OR creator — but what about when `creatorId IS NULL`?

**Severity:** Medium
**Category:** Authorization
**Location:** `review.service.ts:439-457`, `policies/review-authorization.policy.ts:29-32`
**Affected files:** `src/modules/review/domain/review.service.ts`, `src/modules/review/domain/policies/review-authorization.policy.ts`

**Description:** `canViewAnalytics` is:

```ts
return target.creatorId === actor.sub || actor.role === 'admin';
```

The check uses strict equality on `creatorId`. If `creatorId IS NULL` (because `quizzes.creator_id` is nullable and the FK is `ON DELETE SET NULL`, so a deleted creator's quiz has `creatorId = NULL`), only admin can view analytics — and **admins of any role-level** (`actor.role === 'admin'`) can view analytics for a quiz with a NULL creator. The check is correct. BUT — there's no isolation: any admin can view analytics for any quiz, including quizzes by other admins. That is a multi‑admin privilege separation gap.

Also, the route is `@ApiAuth()` only — there's no `@Permissions(...)` decorator. **Anyone authenticated** passes JwtGuard → the service then throws 403 if not authorized. That's defense-in-depth. But there is no `@Permissions(Permission.QUIZ_VIEW_ANALYTICS)` style guard. **Look-up ambiguity**: the correct policy is "quiz owner OR admin" (modeled in `ReviewAuthorizationPolicy.canViewAnalytics`), but the route-level enforcement is missing.

**Impact:** All authenticated users can hit the route and get a 403. No correctness issue with the policy. The issue is that the route is **not actually gated at the boundary** — the auth check could be bypassed if anyone calls the service directly (e.g. from internal jobs, scripts). The "defense in depth" comment in the policy file means this is *intentional*, but the **internal callers must remember to apply the policy themselves**. Risk: a future scripted job that calls `quizAnalyticsService.getQuizAnalytics(quizId)` bypasses the auth gate.

**Suggested direction:** Mirror the bookmark pattern: add a `@Permissions(Permission.REVIEW_VIEW_QUIZ_ANALYTICS)` decorator + `PermissionsGuard` invocation on the route. Reduces reliance on application-layer guards.

---

## Issue #22 — `deleteReview` requires `(quizId, user.sub)` match — admin path is in policy but no admin guard at the route layer

**Severity:** Medium
**Category:** Authorization
**Location:** `quiz-review.controller.ts:118-128`, `review.service.ts:382-393`, `policies/review-authorization.policy.ts:25-27`
**Affected files:** `src/modules/review/transport/controller/quiz-review.controller.ts`, `src/modules/review/domain/policies/review-authorization.policy.ts`

**Description:** Per the policy, an admin can `canModify` any review. The `deleteReview` service method calls `ReviewAuthorizationPolicy.canModify(actor, target)`. But the `@Auth()` decorator on `DELETE /quizzes/:quizId/reviews` does not include a `@Permissions()` for admin. A regular user without admin role tries to delete their own review — passes the auth check via `user.sub`. A user with **a review authored by someone else** tries `DELETE /quizzes/:q/reviews` — `existing.userId !== user.sub`, `actor.role !== 'admin'`, throws 403. ✅

But: **what if a malicious admin or moderator takes a quiz's review Id, calls DELETE, expecting to delete someone else's review**? Currently:
- The route looks up by `(quizId, user.sub)` — meaning the admin can only delete reviews they themselves authored under that quiz. Admins CANNOT delete another user's review through this route.

This is a **bug** if the intent was "admin can moderate any review." The `ReviewAuthorizationPolicy.canModify` claim "OR actor.role === 'admin'" is unreachable in the delete path because of the `(quizId, user.sub)` lookup.

**Example:**
- An admin wants to moderate and remove a 1-star spam review. Their JWT says `role: admin`. They hit `DELETE /quizzes/Q/reviews`. The service `getReviewByQuizAndUser(quizId, user.sub)` — but `user.sub` is the *admin's* userId, not the spam reviewer's. So no review is found → 404.

**Impact:** Admins cannot delete other users' reviews via the public API. They need a separate `DELETE /admin/reviews/:reviewId` or the existing endpoint needs to switch to looking up by `reviewId` directly.

**Suggested direction:** Add an admin-only `DELETE /admin/reviews/:reviewId` route. Keep the user-facing `DELETE /quizzes/:quizId/reviews` for self-delete only.

---

## Issue #23 — `createReview` is exposed but the service **does NOT check whether the quiz has a published version** (only `deletedAt IS NULL`)

**Severity:** High
**Category:** Business Logic
**Location:** `review.service.ts:77`, `quiz/infrastructure/repositories/quiz.repository.ts:103`
**Affected files:** `src/modules/review/domain/review.service.ts`

**Description:** Already discussed in Issue #1, but specifically: a user who completes an attempt on a *draft* version (which is impossible because attempts require a published version per the state machine — but if the state machine doesn't strictly enforce this, draft quizzes can be attempted) and then reviews it. The review is recorded for a quiz that has no `published_version_id`. The review aggregates in `getQuizReviewStats` (which already filters by quiz) but the quiz appears nowhere visible to the public — so the average rating is silently biased.

**Impact:** Invisible quizzes with phantom ratings.

**Suggested direction:** Mirror Issue #1's fix.

---

## Issue #24 — Comment length not enforced consistently on UPDATE

**Severity:** Low
**Category:** Validation
**Location:** `update-review.dto.ts`, `review.service.ts:341-380`
**Affected files:** `src/modules/review/dto/request/update-review.dto.ts`, `src/modules/review/domain/review.service.ts`

**Description:** `UpdateReviewDto` has `comment?: string | null;` with `MaxLength(1000)`. `null` is allowed via `@IsOptional()` + `@IsString()`. The service does `comment ?? null` — so if the user omits `comment`, it's stored as `null`, **wiping the existing comment**. That's debatable. Also, `rating` is required (mandatory field) but `comment` can be silently nulled by omitting it.

PATCH semantics typically mean "replace the field only if present." But here `comment: undefined` (omitted) results in a `null` write, which is the same as `comment: null`. That's not strictly a bug, but it means **a client that sends a PATCH with no `comment` field will null out the previously-non-null comment**. The original rating stays.

For PATCH, the conventional semantics is "missing field = unchanged". Setting it to null when missing is a footgun.

**Impact:** Trivial — accidentally nulled comments.

**Suggested direction:** Make `comment` truly optional in PATCH semantics (only set when provided in payload).

---

## Issue #25 — `getQuizReviewStats` route is `Public` but does not verify the quiz is `is_hidden = false` and has a `publishedVersionId`

**Severity:** High
**Category:** Authorization / API Design
**Location:** `quiz-review.controller.ts:72-79`
**Affected files:** `src/modules/review/transport/controller/quiz-review.controller.ts`

**Description:** Similar to Issue #1: the public stats endpoint allows any UUID to leak the `avg_rating`, `total_reviews`, and rating distribution of any non-deleted quiz, including hidden ones.

**Impact:** Hidden quiz rating profile (count + distribution) is enumerable.

**Suggested direction:** Same as Issue #1: require `is_hidden = false AND published_version_id IS NOT NULL`. Or limit the public stats endpoint to published quizzes only.

---

## Issue #26 — `getUserReviewDashboard` does not filter hidden reviews out of `favoriteCategory` / `favoriteTag`

**Severity:** Medium
**Category:** Business Logic / Authorization
**Location:** `review.repository.ts:279-327`
**Affected files:** `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** `getUserReviewDashboard` counts each user's reviews by category/tag via joins. It does not filter out hidden/deprecated quizzes. So a user's "favorite category" can include hidden categories they've interacted with during testing.

Minor.

---

## Issue #27 — `reportReview`'s `hasUserReportedReview` runs on a stale-read path; race window exists between check and insert

**Severity:** Medium
**Category:** Concurrency
**Location:** `review-report.repository.ts:18-26`, `review.service.ts:316-329`
**Affected files:** `src/modules/review/infrastructure/repositories/review-report.repository.ts`, `src/modules/review/domain/review.service.ts`

**Description:** Already mentioned in Issue #6. The check-then-act creates a TOCTOU window where a 23505 from the unique index is *not* translated to `ReviewAlreadyReportedError`, leaking 500s. The application never translates.

**Impact:** 500 spikes when concurrent reports happen.

**Suggested direction:** Catch 23505 in `reportReview` service catch block, like `createReview` does.

---

## Issue #28 — `ReviewDeletedEvent` and `ReviewSubmittedEvent` propagate via synchronous in-memory bus only — no durable outbox

**Severity:** High
**Category:** Transaction / Data Integrity / Counter
**Location:** `events/review-domain.event-bus.ts:37-49`, `events/review-event-listener.adapter.ts:57-59`
**Affected files:** `src/modules/review/domain/events/review-domain.event-bus.ts`

**Description:** Confirmed issue (parallels Issue #3 and #9). After commit, the listener is invoked via `void this.handleEvent(event)` — fire-and-forget. If the process crashes between `db.transaction.commit` and `handleEvent` execution, the analytics refresh is lost. If the listener raises, it's logged and discarded. There's no retry, no outbox, no dead-letter.

The `outbox` schema exists at `core/database/schema/outbox/schema.ts` (per the index mapping). Reviews do not use it.

**Impact:** Counter drift under process crash. This is mitigated by the eventual reconcile job for some counters, but no reconcile job exists for reviews.

**Suggested direction:** Persist review events to an outbox in the same transaction; a worker drains and applies.

---

## Issue #29 — `ReviewAuthorizationPolicy.canModify` uses `actor.role === 'admin'` — hardcoded role string

**Severity:** Low
**Category:** Authorization / Maintainability
**Location:** `policies/review-authorization.policy.ts:25-27`
**Affected files:** `src/modules/review/domain/policies/review-authorization.policy.ts`

**Description:** The policy checks role against a string. If the role enum evolves (`admin` → `super_admin`, `moderator`, etc.), the policy stays stale. A `moderator` should logically be able to moderate reviews, but the policy says only `admin` can. There IS a separate `REVIEW_MODERATE` permission decorator used on the admin controller — but the inline service code's admin check uses the role.

**Impact:** Inconsistency between `REVIEW_MODERATE` permission and role-based check. If the role `admin` is removed in favor of permissions, the policy silently fails.

**Suggested direction:** Replace `actor.role === 'admin'` with a permissions-based check (`actor.permissions?.includes(Permission.REVIEW_MODERATE)`).

---

## Issue #30 — `getMyReviewDashboard`'s `lastUpdated` always returns `NOW()` when no reviews exist

**Severity:** Low
**Category:** API Design / Data Integrity
**Location:** `review.repository.ts:287-289`, `review.service.ts:232-242`
**Affected files:** `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** The SQL `COALESCE(MAX(updated_at)::text, NOW()::text)` returns the current DB time when no reviews exist. The endpoint surfaces this as `"Dashboard last calculated at <now>"` for users with no reviews, which is misleading.

**Impact:** Trivial. Cosmetic.

---

## Issue #31 — `comment` column on `quiz_reviews` has no length CHECK constraint

**Severity:** Low
**Category:** Data Integrity
**Location:** `core/database/schema/quiz/schema.ts:565`
**Affected files:** `src/core/database/schema/quiz/schema.ts`

**Description:** `comment: text()` with no `length(1..1000)` check. The DTO enforces `MaxLength(1000)` at the HTTP layer, but the database permits arbitrary length comments. A direct DB write or a different code path can write a 10MB comment.

`reason` in `review_reports` does have a `nonblank` check; `comment` has nothing.

**Impact:** DB bloat on direct INSERT bypassing the API.

**Suggested direction:** Add `check('quiz_reviews_comment_length', sql\`comment IS NULL OR length(comment) <= 1000\`)`.

---

## Issue #32 — Helpful counter update is NOT in the same DB transaction as `addHelpfulVote`'s vote insert when the request is wrapped in an outer transactional context (e.g. a future review create that grants initial helpful vote)

**Severity:** Low
**Category:** Transaction
**Location:** `review.repository.ts:345-381`
**Affected files:** `src/modules/review/infrastructure/repositories/review.repository.ts`

**Description:** When `existingTx` is present (from `TransactionalContext`), the helper runs the insert and the counter update in that outer transaction. So if a future feature combines helpful vote + other writes in one HTTP request, the counter is grouped. Good.

But if the outer transaction rolls back *after* the insert (between the insert and the counter update), the counter is left in an inconsistent state. PostgreSQL semantics for a single statement inside a transaction: an ROLLBACK aborts everything. So both the insert and the counter decrement/increment roll back together. ✅

The real subtle issue: **the inner `executeAdd` runs the insert, then the update, in two distinct SQL statements**. If the helper is reused outside a transactional context with READ COMMITTED, a different SQL statement (e.g. a `DELETE FROM review_helpful_votes ...`) could interleave between the two statements — though the unique index on `(review_id, user_id)` and the SQL `UPDATE WHERE review_id = X` would still be ordered by `helpful_count`. The risk is low but non-zero.

The current code has:
```ts
if (existingTx) {
  return executeAdd(existingTx);
}
return this.db.transaction(async (tx) => executeAdd(tx));
```

When no outer transaction exists, the helper opens its own. Inside, both statements commit together. Good.

But when the helper is used inside an outer transactional context (e.g. `transactionalContext.getDbClient() returns non-null`), the helper uses the existing tx and does NOT open a nested savepoint. If the outer tx rolls back later for reasons unrelated to the helper, both the helper's actions are rolled back. ✅

**Conclusion:** No bug here. The implementation is correct under all observed paths. Marked Low because reviewers should be aware this is the de-facto contract.

---

## Issue #33 — Idempotency in `markReviewHelpful` caches result without saving the side-effects when helper succeeds but DTO is computed outside

**Severity:** Low
**Category:** Idempotency
**Location:** `review.application.service.ts:175-200`
**Affected files:** `src/modules/review/application/review.application.service.ts`

**Description:** The endpoint computes `result` from the service (boolean), then constructs `{ message: selectHelpfulMessage(payload.helpful, result) }` and passes that as the `computeResponse()`. The cached response is just the string. So if you replay with a key, you get the original message back. Fine.

But if you replay with the same key but the state has since changed (e.g. the helpful vote was added then removed), the cache returns the OLD message. Idempotency contract is "you get the same response twice" — which is preserved. ✅

No bug.

---

## Issue #34 — `dispatchToSubscribers` is **synchronous** but `handleEvent` is async (with `void` discard)

**Severity:** Medium
**Category:** Concurrency / Performance
**Location:** `events/review-event-listener.adapter.ts:57-59`, `events/review-domain.event-bus.ts:37-49`
**Affected files:** `src/modules/review/infrastructure/adapters/review-event-listener.adapter.ts`, `src/modules/review/domain/events/review-domain.event-bus.ts`

**Description:** The bus invokes subscribers **synchronously** (`handler(event)`). The subscriber starts an async chain with `void this.handleEvent(event)`. So:

- The synchronous `handler` returns immediately after `void`-ing the async work.
- The HTTP request returns to the user before the analytics refresh completes.
- If a user retries the create-review call rapidly (e.g. due to error), and the first call's analytics haven't yet refreshed, the second call's analytics refresh starts immediately, doubling the work for the writer (no concurrency safety there).

`void`-discarded promises cannot be awaited; if `handleEvent` throws, the rejection is unhandled. (The bus wrapping uses try/catch — but the catch is in the synchronous handler, the unhandled rejection happens later in the void chain.)

**Impact:** Counter race + unhandled promise rejection risk.

**Suggested direction:** Refactor event delivery to use an outbox + worker (see Issue #28).

---

## Issue #35 — `reportedReviews` endpoint joins `quizReviews` and `users` and `quizzes` — all INNER JOINs

**Severity:** Medium
**Category:** API Design / Performance
**Location:** `review-report.repository.ts:43-71`
**Affected files:** `src/modules/review/infrastructure/repositories/review-report.repository.ts`

**Description:** The query is:

```sql
FROM review_reports
INNER JOIN quiz_reviews ON review_reports.review_id = quiz_reviews.review_id
INNER JOIN quizzes ON quiz_reviews.quiz_id = quizzes.quiz_id
INNER JOIN users ON quiz_reviews.user_id = users.user_id
```

So a user's "my reported reviews" list disappears if the underlying review is deleted (cascade). User experience: "I reported review X yesterday; today I can't see it in my list." Confusing. Also leaks no rows for hidden quizzes — they'd still appear, but the user can't navigate to them.

**Impact:** UX issue, but more material: users wonder if their report was deleted. Also: a spammer who reports a review and gets the review banned can no longer see their own report — the report cascaded out. They see an empty list and never learn moderation acted.

**Suggested direction:** Use LEFT JOIN on `quiz_reviews` so users can still see the report even if the review is gone (status, reason, details from `review_reports` alone). Or surface the list as "report events" rather than cross-joined view.

---

## Issue #36 — `listPlatformReports` admin endpoint does not paginate by default and may be O(N) over the entire reports table

**Severity:** Medium
**Category:** Performance
**Location:** `admin-review.controller.ts:34-47`, `review-admin.service.ts:35-67`
**Affected files:** `src/modules/review/transport/controller/admin-review.controller.ts`, `src/modules/review/domain/review-admin.service.ts`

**Description:** The admin endpoint supports `limit`/`cursor` via DTO. ✅

But there's no `status` filter argument applied unless the moderator sends `status=` — they get ALL reports, in DESCENDING `createdAt` order. The default order prioritizes *recent* reports, not *open* reports. A moderation queue effectively sees "newest reports," not "open reports" — older open reports fall off the bottom.

**Impact:** Operational. Important for moderators.

**Suggested direction:** Default to `status: 'open'` when no status is provided. Add an explicit "show all" status to bypass.

---

## Issue #37 — `updateReportStatus` is a `@Permissions(Permission.REVIEW_MODERATE)` endpoint, but the `actor.sub` for audit is captured AFTER permission check

**Severity:** Low
**Category:** Authorization / Audit
**Location:** `admin-review.controller.ts:49-65`, `review-admin.service.ts:69-109`
**Affected files:** `src/modules/review/transport/controller/admin-review.controller.ts`, `src/modules/review/domain/review-admin.service.ts`

**Description:** Audit log records `actorId = actor.sub`. The audit log captures moderator identity correctly.

But the **report status update is not in a transaction** with the audit write (`updateReportStatus` calls `await this.reportRepository.updateReportStatus(...)` then `try { await this.auditLogService.record(...) }`). If the audit write fails, the operation succeeds with no audit. If the audit write succeeds but the status update fails (e.g. FK violation), no audit is recorded. Either way, no transactional atomicity.

The `try/catch` swallows the audit failure as a logged warning. That means: **a moderator can mark a report as `dismissed` and the audit log will not record it** under certain failure modes.

**Impact:** Audit completeness gap. May not be material but violates immutability of moderation records.

**Suggested direction:** Wrap the status update + audit write in one DB transaction or use an outbox.

---

## Issue #38 — `updateReportStatus` allows arbitrary transition to any status

**Severity:** Low
**Category:** Business Logic
**Location:** `review-admin.service.ts:69-109`, `admin-review.dto.ts:39-46`
**Affected files:** `src/modules/review/domain/review-admin.service.ts`, `src/modules/review/dto/request/admin-review.dto.ts`

**Description:** A moderator can flip status `open → actioned → dismissed → reviewed → open` arbitrarily. There's no state machine. The semantically-correct transitions are forward-only (`open → reviewed | dismissed | actioned`). Status reverts allow gaming.

**Impact:** Moderate. State machine violation.

**Suggested direction:** Add `reviewReportStatus` transitions: `open → {reviewed, dismissed, actioned}`, terminal in those three.

---

## Issue #39 — `actions` against the *target review* are NOT triggered when `actioned` status is set

**Severity:** High
**Category:** Business Logic
**Location:** `review-admin.service.ts:69-109`
**Affected files:** `src/modules/review/domain/review-admin.service.ts`

**Description:** When a moderator sets `actioned`, the system does NOT remove the reported review, does NOT update the author's reputation, does NOT notify the author. The status change is purely informational. The reviewer → reviewer-loop is broken.

Compounding: when `dismissed`, the report is closed but no notification to the reporter — the reporter sees their report as "still open" (depending on list filtering) or "closed with no action."

This is a *designed* gap if moderators are expected to perform followup actions in another system, but there's no integration point nor notification.

**Impact:** Moderation queue UX. Actioned reports should have a followup action: review removed/preserved, reporter notified.

---

## Issue #40 — Test coverage shows `curl-like` adversarial tests are absent

**Severity:** Medium
**Category:** Maintainability / API Design
**Location:** whole `test/review-*` dir
**Affected files:** `test/review-helpful.e2e-spec.ts`, `test/review.repository.e2e-spec.ts`

**Description:** Only `review-helpful.e2e-spec.ts` and `review.repository.e2e-spec.ts` exist. The plan indicated `test/review-report-self.e2e-spec.ts` is in flight (it is `?? test/review-report-self.e2e-spec.ts` in git status). Tests for:

- duplicate concurrency on create-review
- delete-during-update race
- helpful counter negative drift
- hidden quiz review creation
- idempotency cache replay for `reportReview` (Issue #13)
- helpful sort cursor stability (Issue #11)

are absent.

**Impact:** No regression tests for the bugs documented above.

---

## Phase Grouping

## Phase 1 — Critical Security Bugs

1. **Issue #1** — Hidden / draft quizzes allowed in review creation / analytics / stats (`getActiveQuizRecordById` filter).
2. **Issue #9** — `quiz_stats.avg_rating` / `rating_count` denormalized counters without per-quiz reconciliation job (fire-and-forget listener).
3. **Issue #25** — Public `getQuizReviewStats` endpoint reveals stats for hidden quizzes.
4. **Issue #3** — Hard-delete cascade + async analytics listener = silent drift on review deletion.
5. **Issue #22** — Admin cannot delete another user's review via the public route (`DELETE /quizzes/:quizId/reviews` is keyed on `(quiz, user)` not review ID).

**Objective:** Lock down the API surface against hidden resources and ensure analytics integrity for moderators and creators. Stop the immediate leaks.
**Implementation order:** #22 (smallest, route-level) → #25 (route filter) → #1 (active-quiz predicate) → #3 (transactional analytics, or outbox) → #9 (sweep job).
**Dependencies:** #1 unblocks #25 and #3. #9 can be parallelized.
**Estimated complexity:** Medium for #1, #25, #22. Large for #3 (requires outbox infra or atomic event-apply). Large for #9 (new reconcile method + cron).
**Breaking change risk:** High for #3 (alters analytics update timing; clients reading post-mutation may see stale values temporarily). Low for the others — they tighten existing behavior; legitimate clients won't notice.

---

## Phase 2 — Business Logic Bugs

6. **Issue #2** — `createReview` check-then-act race; UNIQUE catches it but logs spam.
7. **Issue #4** — `helpfulCount` no CHECK constraint, can go negative.
8. **Issue #6** — `reportReview` 23505 not translated to 409 (concurrent dup reports produce 500).
9. **Issue #13** — `reportReview` idempotency key replay discards the cached response, returning 409 instead.
10. **Issue #16** — Reports cannot be re-escalated after dismissal; no rate limit on report filing.
11. **Issue #38** — Report status transitions have no state machine.
12. **Issue #8** — Reporting a review on a soft-deleted (or hidden) quiz succeeds.

**Objective:** Tighter validation and idempotency on write paths. Eliminate 500 leaks from concurrent edge cases.
**Implementation order:** #13 → #6 → #4 (DB CHECK) → #2 (advisory lock or serializable) → #8 → #38 → #16.
**Dependencies:** #2, #6 both benefit from outbox (#3) if used.
**Complexity:** Small for #6, #13, #38. Medium for #4 (DB migration). Medium for #2 (advisory lock or SERIALIZABLE).
**Breaking change risk:** #13 changes the idempotency semantics — clients currently relying on 409 will need to migrate.

---

## Phase 3 — Data Integrity

13. **Issue #4** — `helpful_count` CHECK constraint (rolled out with Phase 2 if scoped tightly).
14. **Issue #28** — Outbox for review events (recommend before consolidating). Falls under #3 if implemented.
15. **Issue #31** — `comment` length CHECK constraint.
16. **Issue #14** — Idempotency TTL cleanup job.
17. **Issue #26** — `getUserReviewDashboard.favoriteCategory` / `favoriteTag` should exclude hidden quiz reviews.
18. **Issue #7** — Report filter to allow users to view only `open` reports.

**Objective:** Repair schema-level data integrity gaps and reconcile sources-of-truth. Establish durable event delivery.
**Complexity:** Medium for #28 (adds outbox infra). Small for others.

---

## Phase 4 — Counter Reconciliation

19. **Issue #9** (revisited) — Per-quiz review reconcile job.
20. **Issue #34** — Synchronous bus + async handler race.
21. **Issue #35** — `listReportedReviews` INNER JOIN drops reports when underlying review is deleted.
22. **Issue #36** — Admin list defaults to recent, not `open` reports.

**Objective:** Counter and UX consistency for moderation, dashboards, and reports lists.
**Complexity:** Medium for reconcile job, small for the others.

---

## Phase 5 — Cleanup

23. **Issue #12** — Remove dead `ReviewAnalyticsPort` injection from `ReviewService`.
24. **Issue #29** — Replace role-based admin check with permission-based policy.
25. **Issue #5** — Normalize DELETE semantics for helpful vote.
26. **Issue #10** — Tighten cursor regex.
27. **Issue #11** — Fix sort=`helpful` cursor pagination.
28. **Issue #15** — `listReviewsByUser` filter for hidden quizzes.
29. **Issue #17** — Consider soft-delete on `quiz_reviews` to preserve vote history.
30. **Issue #18** — Reason enum.
31. **Issue #19** — Slimmer `assertCanVote` lookup.
32. **Issue #20** — Public read-by-id review privacy.
33. **Issue #21** — Add `@Permissions(Permission.REVIEW_VIEW_QUIZ_ANALYTICS)` route guard.
34. **Issue #24** — PATCH semantics for `comment`.
35. **Issue #30** — `lastUpdated` cosmetic for users with no reviews.
36. **Issue #37** — Audit + status update transactional atomicity.
38. **Issue #39** — Actioned status followup (notifications + review removal).
40. **Issue #40** — Test coverage for adversarial cases.

**Objective:** Polish, observability, maintainability. Lowest priority; spread across multiple PRs.

---

## Summary statistics

| Severity | Count |
|----------|-------|
| Critical | 2 (issues 3, 9) |
| High     | 14 |
| Medium   | 18 |
| Low      | 6 |
| **Total** | **40** |

| Category | Count |
|----------|-------|
| Authorization | 6 |
| Business Logic | 9 |
| Concurrency | 5 |
| Data Integrity | 7 |
| API Design | 8 |
| Validation | 3 |
| Transaction | 4 |
| Counter | 4 (overlap) |
| Performance | 2 |
| Maintainability | 4 |

The single most important trajectory:

- **Hidden & soft-deleted resource leakage** (Issues #1, #8, #15, #20, #25, #26) is a consistent theme — `getActiveQuizRecordById` and the `ReviewRepository` reads need to consistently check `is_hidden = false AND published_version_id IS NOT NULL` on the parent quiz.
- **Analytics drift under event-driven update** (Issues #3, #9, #28, #34) — the synchronous in-process event bus with `void` discard and no outbox is the deepest structural problem. Without an outbox, the analytics denormalized counters cannot be kept in sync without compensating reconcile jobs. **Recommend implementing an outbox for review events before any further counter work.**
- **Race conditions on check-then-act** (Issues #2, #6) — both `createReview` and `reportReview` have TOCTOU windows that today the unique constraint catches (causing 500 leakage for reports). The fix pattern is consistent (advisory lock, serializable isolation, or 23505 translation at the service layer).

If only **three** issues were fixed before launch, I would prioritize in this order:

1. **#9 — review metrics reconciliation job** (without this, analytics drift is uncatchable).
2. **#1 + #25 — hide reviews and stats for non-published / hidden quizzes** (immediate user-visible privacy hole).
3. **#28 — outbox for review events** (architectural foundation for #3 and #9 follow-on work).
