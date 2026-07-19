# Plan — Reconcile `quiz_reviews.helpful_count` with `review_helpful_votes`

| Field | Value |
|---|---|
| Status | Proposed (Revision 3) |
| Owner | Review module |
| Created | 2026-07-19 |
| Revised | 2026-07-19 (Rev 1 → Rev 2: split API, drop SELECT FOR UPDATE, drop `changed` field. Rev 2 → Rev 3: drop `voteId` and `delta` from the contract; repository returns `boolean`.) |
| Supersedes | Revisions 1 and 2 of this file |
| ADR | `docs/adr/0017-helpful-vote-counter-consistency.md` (to be filed together) |

## Revision history

- **Revision 1**: proposed one transactional repository method `setHelpfulVote(helpful: boolean)` with `SELECT … FOR UPDATE`, added a `changed: boolean` field to the response, and ran two-phase cut-over.
- **Revision 2**: split into two explicit methods (`addHelpfulVote` / `removeHelpfulVote`); dropped `SELECT … FOR UPDATE`; dropped `changed: boolean` response field; trimmed phases.
- **Revision 3 (current)**: based on a deep trace of the event flow and every reference to `voteId` in the codebase:
  - The repository returns `Promise<boolean>` (was `{ delta, voteId }`).
  - `voteId` is removed from the contract. It has zero consumers outside the obsolete log line at `review.service.ts:282`.
  - The `delta` field is also removed. The method name (`addHelpfulVote` vs `removeHelpfulVote`) already carries the operation direction; a boolean suffices for "did anything change?".
  - **No new domain event is emitted.** `ReviewHelpfulVoted` and `ReviewHelpfulVoteRemoved` do not exist in the codebase, and no consumer expects them. Helpful-vote activity is and remains pino-only.
  - The `ReviewHelpfulVoteRow` port type is removed. It was internal to the repository and had no consumer.
  - Repository implementation still uses `RETURNING vote_id` internally because that is the natural way to detect the conflict / actual delete, but the returned value is discarded at the boundary.

The substance of the fix — atomic aggregate writes, repository-owned transactions, reconciliation migration, idempotency at the DB level, no DTO/Swagger/SDK changes — is unchanged from Rev 2.

---

## 1. Problem statement

`quiz_reviews.helpful_count` is a denormalized counter that is read by clients (review detail, review list sorted by helpful) and used as a sort key. It is updated by an unguarded second write (`updateHelpfulCount`) that does not know whether its companion vote mutation (`markReviewHelpful` / `removeReviewHelpfulVote`) actually changed state.

### 1.1 Evidence (live in the tree)

- Counter mutated unconditionally in `ReviewService.markReviewHelpful` and `ReviewService.removeHelpfulVote`:
  - `src/modules/review/domain/review.service.ts:269`–`283` (POST branch)
  - `src/modules/review/domain/review.service.ts:286`–`302` (DELETE handler)
- Repository exposes two writes + one follower, none of which are transactional:
  - `markReviewHelpful` at `src/modules/review/infrastructure/repositories/review.repository.ts:321`–`354` — SELECT-then-INSERT, returns the row in both "inserted" and "existed" cases.
  - `removeReviewHelpfulVote` at `src/modules/review/infrastructure/repositories/review.repository.ts:356`–`366` — DELETE without `RETURNING`, result discarded.
  - `updateHelpfulCount` at `src/modules/review/infrastructure/repositories/review.repository.ts:429`–`434` — unconditional `UPDATE … SET helpful_count = helpful_count + ${increment}`.
- No DB-level guarantee tying the two tables together:
  - `quiz_reviews.helpful_count` (`src/core/database/migrations/0000_lean_ken_ellis.sql:411`) is `smallint NOT NULL DEFAULT 0` with no CHECK, no trigger, no generated column.
  - `review_helpful_votes` (`src/core/database/schema/quiz/schema.ts:813`–`851`) has `UNIQUE(review_id, user_id)`, FK cascades, no triggers.

### 1.2 Net user-observable effects

| Action (same user, same review) | Before | After | Consistency |
|---|---|---|---|
| `POST /reviews/{id}/helpful` (second time, vote already exists) | `helpful_count = N` | `helpful_count = N+1`, votes = `N` | **drift up** |
| `DELETE /reviews/{id}/helpful` (vote never existed) | `helpful_count = N` | `helpful_count = N-1`, votes = `N` | **drift down** |
| 5 alternating POSTs/DELETEs | `helpful_count = N` | `helpful_count = N+5`, votes = `N` | unbounded drift |

This is a real bug, not theoretical. Production data is likely already drifted; a reconciliation is required before the fix is shipped.

### 1.3 Architectural root cause

The aggregate "(review, votes, counter)" is split across two tables (`quiz_reviews`, `review_helpful_votes`) with no aggregate boundary owning their consistency. The repository exposes three independent operations that all assume the others succeeded. There is no transactional or application-level guarantee that they did.

---

## 2. Goals

1. **Make the endpoint truly idempotent** at the DB level: repeated POSTs and DELETEs from the same user produce exactly one state change and exactly one counter delta.
2. **Make `helpful_count` consistent with `review_helpful_votes`** by construction, not by convention.
3. **Repair any existing drift** in production data with a forward-only Drizzle migration.
4. **Preserve the HTTP response shape.** The body remains `{ message: string }`; only the message text varies by outcome. No DTO change, no OpenAPI regeneration, no SDK regeneration.
5. **Preserve the existing pino log shape.** `event: 'review_helpful_voted'` and `event: 'review_helpful_vote_removed'` continue to be emitted with the same fields (`reviewId`, `userId`, `helpful`).
6. **Stay inside the project's existing architecture** (`@Transactional()` + `TransactionalContext` AsyncLocalStorage per ADR-0009, four-layer module structure per ADR-0010, repository per ADR-0007, three-layer event bus per ADR-0014).

## 3. Non-goals

- Not changing the HTTP response shape. Body remains `{ message: string }`.
- Not removing `helpful_count` from the schema.
- Not introducing DB triggers.
- Not changing sort/pagination behavior.
- Not changing OpenAPI artifact or generated SDK.
- Not introducing new domain events. The helpful-vote path is and remains a pino-only log path; no consumer in the codebase expects otherwise.
- Not touching other modules' denormalized counters (`quiz_stats.*`).
- Not adding a `CHECK (helpful_count >= 0)` constraint in this change. Defensible, but a defense-in-depth improvement unrelated to the bug fix; defer to a follow-up.

---

## 4. Design

### 4.1 Architecture

Replace the three repository methods with two explicit methods. Each method performs the candidate INSERT or DELETE, observes the actual outcome via `RETURNING`, and conditionally updates the counter inside the same transaction. Each method follows the project's existing "repository-opens-its-own-transaction-or-rides-the-outer-one" pattern observed in `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts:101`–`140`.

```text
ReviewService.addHelpfulVote(reviewId, userId)
  → ReviewRepository.addHelpfulVote({ reviewId, userId, nowIso })
       existingTx = transactionalContext.getDbClient()
       executor = async (tx) => { … SQL … }
       run with existingTx OR this.db.transaction(executor)
       return boolean  // true iff a row was actually changed

ReviewService.removeHelpfulVote(reviewId, userId)
  → ReviewRepository.removeHelpfulVote({ reviewId, userId, nowIso })
       existingTx = transactionalContext.getDbClient()
       executor = async (tx) => { … SQL … }
       run with existingTx OR this.db.transaction(executor)
       return boolean  // true iff a row was actually deleted
```

The aggregate write stays inside the adapter — the same layer that already owns the schema mapping and the connection handling — without inventing new infrastructure.

### 4.2 Repository contract

`src/modules/review/domain/ports/review-repository.port.ts`:

- Remove the `ReviewHelpfulVoteRow` type (lines 70–74) — nothing external uses it.
- Remove `markReviewHelpful(...)`, `removeReviewHelpfulVote(...)`, and `updateHelpfulCount(...)` from the port.
- Add the two new methods:

```text
addHelpfulVote({ reviewId, userId, nowIso }): Promise<boolean>
removeHelpfulVote({ reviewId, userId, nowIso }): Promise<boolean>
```

`boolean` semantics:

- `true` = the underlying SQL changed state (the INSERT succeeded and was not a conflict; the DELETE returned a row).
- `false` = no state change (the vote already existed on add; the vote did not exist on remove).

`voteId` is intentionally omitted. See §5 for the trace that justifies this.

### 4.3 Repository implementation

`src/modules/review/infrastructure/repositories/review.repository.ts` — replace the existing three methods.

`addHelpfulVote` body (SQL plan in prose):

1. Resolve the active transaction client via `TransactionalContext.getDbClient()`. If absent, open one with `this.db.transaction(...)` and register it on the context for the duration of the call.
2. Inside the transaction: run `INSERT INTO review_helpful_votes (review_id, user_id, created_at) VALUES (...) ON CONFLICT (review_id, user_id) DO NOTHING RETURNING vote_id`.
3. If exactly one row was returned: run `UPDATE quiz_reviews SET helpful_count = helpful_count + 1 WHERE review_id = ?`. Return `true`.
4. If zero rows were returned (conflict): return `false`.

`removeHelpfulVote` body:

1. Resolve the active transaction client (same pattern).
2. Inside the transaction: run `DELETE FROM review_helpful_votes WHERE review_id = ? AND user_id = ? RETURNING vote_id`.
3. If exactly one row was returned: run `UPDATE quiz_reviews SET helpful_count = helpful_count - 1 WHERE review_id = ?`. Return `true`.
4. If zero rows were returned: return `false`.

Notes:

- **`RETURNING vote_id` is still used** internally. It is the natural way to detect the conflict / actual delete. The returned value is discarded at the boundary.
- **No `SELECT … FOR UPDATE`**. The unique constraint serializes concurrent writers; `RETURNING` reveals the outcome without a prior read.
- **The counter update is inside the transaction** so it rolls back if the vote mutation rolls back. There is no window in which only one of the two writes commits.
- **`TransactionalContext`** is set on the outer transaction only when the repository itself opens one. If the caller is already inside `@Transactional()`, the existing client is reused, matching the `quiz-instance.repository.ts:101` precedent.

### 4.4 Domain service

`src/modules/review/domain/review.service.ts` — replace `markReviewHelpful` and `removeHelpfulVote` (lines 244–302) with two parallel methods sharing a private helper.

- `assertCanVote(reviewId, userId)`: fetches the review, throws `ReviewNotFoundError` if missing, throws `ReviewValidationError('You cannot vote on your own review')` if the actor is the review's author.
- `addHelpfulVote(reviewId, userId)`: calls `assertCanVote`; calls `reviewRepository.addHelpfulVote({ reviewId, userId, nowIso })`; if the result is `true`, logs `event: 'review_helpful_voted', reviewId, userId, helpful: true`. (No event dispatch — see §4.7.)
- `removeHelpfulVote(reviewId, userId)`: calls `assertCanVote`; calls `reviewRepository.removeHelpfulVote({ reviewId, userId, nowIso })`; if the result is `true`, logs `event: 'review_helpful_vote_removed', reviewId, userId, helpful: false`.

Note: the existing POST path also logs `voteId` in the log payload at `service.ts:282`. This `voteId` is dropped from the log — it is the only place a `voteId` ever left the schema layer, and it has no consumer.

### 4.5 Application service

`src/modules/review/application/review.application.service.ts` — `markReviewHelpful` and `removeHelpfulVote` keep their signatures. Internally:

- `markReviewHelpful(reviewId, payload, user)`: wraps the work in `IdempotencyService.checkAndSet` if `payload.idempotencyKey` is present; otherwise calls `reviewService.addHelpfulVote` (when `payload.helpful === true`) or `reviewService.removeHelpfulVote` (when `payload.helpful === false`). Selects the response message by `(helpful, result)`.
- `removeHelpfulVote(reviewId, user)`: always calls `reviewService.removeHelpfulVote(reviewId, user.sub)`. Selects the response message by `result`.

Message selection:

| Endpoint | Repository result | Message |
|---|---|---|
| POST `helpful: true` | `true` | `Review marked as helpful` |
| POST `helpful: true` | `false` | `Review was already marked as helpful` |
| POST `helpful: false` | `true` | `Helpful vote removed` |
| POST `helpful: false` | `false` | `No helpful vote to remove` |
| DELETE | `true` | `Helpful vote removed` |
| DELETE | `false` | `No helpful vote to remove` |

`IdempotencyService.checkAndSet` integration is preserved with no structural change. Idempotency keys still produce a cached response on retry; non-keyed duplicates resolve to `200 { message: <appropriate> }` with `result: false`.

### 4.6 DTOs, controller, Swagger

- DTOs: unchanged.
- Controller: unchanged.
- Swagger decorators: unchanged.
- `docs/generated/openapi.json`: unchanged.

### 4.7 Event flow

**No domain event is emitted for helpful votes.** This is deliberate and matches current behavior.

Evidence: `src/modules/review/domain/events/review-domain.events.ts` defines exactly two event classes, `ReviewSubmittedEvent` and `ReviewDeletedEvent`. The bus port (`review-domain-event-bus.port.ts:33`) types the union as `PublishedReviewDomainEvent = ReviewSubmittedEvent | ReviewDeletedEvent`. The two registered subscribers — `ReviewEventListenerAdapter` (Quiz) and `ReviewNotificationListener` (Notification) — both switch on `eventType` and handle only `review.submitted` and `review.deleted`.

There is no `ReviewHelpfulVotedEvent` or `ReviewHelpfulVoteRemovedEvent` anywhere in the tree, and no consumer expects one. Helpful-vote activity is and remains a pino log path. No change to ADR-0014.

### 4.8 Transaction boundary

The transaction is owned by the new repository methods, opened via `db.transaction()` when no outer transaction exists. This mirrors `quiz-instance.repository.ts:101`–`140`. No changes to `@Transactional()` are required at the controller layer for the helpful-vote endpoints.

### 4.9 Database changes

None required beyond the repair migration in §6.2. The `UNIQUE(review_id, user_id)` constraint and the FK cascades already exist.

---

## 5. Why `voteId` is not returned

A complete trace of every reference to `voteId` in the review-helpful-vote path:

| File | Line | What it does |
|---|---|---|
| `src/core/database/schema/quiz/schema.ts` | 816 | Column definition `voteId: uuid('vote_id')` on `review_helpful_votes`. Necessary for the table's primary key and unique index. |
| `src/modules/review/domain/ports/review-repository.port.ts` | 71 | Field on `ReviewHelpfulVoteRow`. Type has no external consumer. |
| `src/modules/review/infrastructure/repositories/review.repository.ts` | 330, 347 | Selected and returned as part of the row. |
| `src/modules/review/domain/review.service.ts` | 282 | `voteId: vote.voteId` — pino log field on the POST branch only. Not consumed anywhere else. |

Subscribers on `REVIEW_DOMAIN_EVENT_BUS`:

| Subscriber | File | Consumes |
|---|---|---|
| `ReviewEventListenerAdapter` (Quiz) | `src/modules/quiz/domain/events/review-event-listener.adapter.ts:57` | `review.submitted`, `review.deleted` |
| `ReviewNotificationListener` (Notification) | `src/modules/notification/infrastructure/adapters/review-notification-listener.adapter.ts:46` | `review.submitted`, `review.deleted` |

Both switch on `eventType` and ignore every other case. Neither imports anything helpful-vote-related. Neither knows that helpful votes exist.

`voteId` therefore has exactly one consumer — a pino log line that no operational tool, audit pipeline, projection, notification, or downstream service reads. Returning it from the repository is gratuitous and would couple the data layer to a log field.

**`voteId` is removed from the contract.**

---

## 6. Why this design (over alternatives)

| Alternative | Why rejected |
|---|---|
| Return `{ delta: 0 \| 1 }` / `{ delta: 0 \| -1 }` | The method name (`addHelpfulVote` vs `removeHelpfulVote`) already carries the operation direction. The application service only branches on "did anything change?" — a boolean suffices. `delta` is gratuitous indirection. |
| Return `{ delta, voteId }` | `voteId` has zero consumers; including it couples the data layer to a log field. |
| One `setHelpfulVote(helpful: boolean)` method | The boolean is HTTP-shaped; two distinct domain operations deserve two distinct methods. |
| `SELECT … FOR UPDATE` for explicit pessimistic locking | Unnecessary: the unique constraint already serializes concurrent writes; `RETURNING` reveals the outcome. |
| Add `changed: boolean` to the response | Adds OpenAPI surface, SDK surface, and a test matrix dimension with no concrete consumer. Refining the message text is enough. |
| Make `updateHelpfulCount` return row-count and gate in service | Patches symptom; leaves the two-step workflow untested, race-prone under concurrency. |
| Postgres trigger on `review_helpful_votes` to recompute the counter | Hides the invariant in DDL where the project's Constitution and ADR-0010 (traceability) say domain rules belong in TS. |
| Replace `helpful_count` with a `VIEW` aggregating `COUNT(*)` | Breaks the existing cursor pagination and the sort-by-helpful path. |
| Emit `ReviewHelpfulVoted` / `ReviewHelpfulVoteRemoved` events | No consumer in the codebase expects these events. The bus's union type and both subscribers are scoped to `review.submitted` / `review.deleted`. Inventing consumers would add real surface for hypothetical demand. |
| Move transaction ownership to the domain service | Violates ADR-0007 and ADR-0010: domain layer must not depend on infrastructure. |
| Move transaction ownership to the application layer | Same violation. The repository-owned pattern is already established by ADR-0009 and observed in `quiz-instance.repository.ts`. |

The chosen design is the smallest correct change at the architecture level: two repository methods returning `boolean`, each self-atomic, no DTO change, no Swagger change, no SDK change, no event classes added. Race-safe; idempotent at the DB level; minimal diff against ADR-0009's existing model.

---

## 7. Implementation plan (ordered)

Phases are ordered so that each phase can ship independently. A failed phase does not regress earlier work; later phases layer cleanly.

### Phase 1 — Data reconciliation (ship first, before code change)

**Goal**: existing drift is repaired before the fix is deployed.

**Convention**: schema changes go in the drizzle schema files (`src/core/database/schema/**`) and are emitted via `pnpm db:generate`. Migration files are not hand-edited for schema changes. Hand-authored migration files are reserved for **non-schema** changes (data backfills, data reconciliations, ad-hoc fixes) that the generator cannot emit. Phase 1 is a data-only reconciliation; it has no schema diff and is therefore hand-authored.

1. Author `src/core/database/migrations/0007_reconcile_helpful_count.sql` (manual SQL; not generated by drizzle-kit):

   - First UPDATE: for each review with at least one vote, set `helpful_count` to the actual count from `review_helpful_votes` (filtered to only change rows that differ).
   - Second UPDATE: for each review with zero votes and a non-zero `helpful_count`, set `helpful_count` to 0.

   Both UPDATEs are idempotent. See the file body for the exact SQL.

2. Update `src/core/database/migrations/meta/0007_snapshot.json` (or generate via drizzle-kit if the project's hybrid migration strategy supports it) so that the journal advances. Commit both files.
3. Run the migration on staging. Run the diagnostic SQL from §8. Expect zero mismatches.
4. Run on production during low-traffic window. Run the diagnostic SQL. Expect zero mismatches.

### Phase 2 — Repository contract and implementation

**Goal**: introduce the two new methods and remove the three old ones at the repository layer. Self-contained.

5. In `src/modules/review/domain/ports/review-repository.port.ts`:
   - Remove the `ReviewHelpfulVoteRow` type.
   - Remove `markReviewHelpful`, `removeReviewHelpfulVote`, and `updateHelpfulCount` from the port signature.
   - Add `addHelpfulVote(...)` and `removeHelpfulVote(...)` per §4.2.
6. In `src/modules/review/infrastructure/repositories/review.repository.ts`:
   - Replace the three existing implementations with `addHelpfulVote(...)` and `removeHelpfulVote(...)` per §4.3.
   - Inject `TransactionalContext` and `TRANSACTIONAL_CONTEXT` (mirroring `quiz-instance.repository.ts:53`–`55`).
   - Update the import list to drop `ReviewHelpfulVoteRow` and any related types.

### Phase 3 — Domain and application service wiring

7. In `src/modules/review/domain/review.service.ts`, replace `markReviewHelpful` and `removeHelpfulVote` (lines 244–302) with two methods `addHelpfulVote` and `removeHelpfulVote` sharing a private `assertCanVote` helper per §4.4. Drop `voteId` from the log payload.
8. In `src/modules/review/application/review.application.service.ts`, update `markReviewHelpful` and `removeHelpfulVote` to call the new domain service methods and select messages by `(helpful, result)` and `(result)` respectively per §4.5.
9. Smoke test against staging with curl / Postman. Both endpoints should now produce a stable counter on duplicate calls and the right message per outcome.

> **Status**: completed in the original implementation round. Step 7 introduces a private `assertCanVote(reviewId, userId)` that both `addHelpfulVote` and `removeHelpfulVote` call. **Behavioural note**: the new `removeHelpfulVote` now also rejects `actor === review.userId` with `400 'You cannot vote on your own review'`. The previous implementation silently no-op'd in that path. The plan §4.4 explicitly requires the shared `assertCanVote` for both endpoints; the new behaviour is consistent with `POST helpful` and was approved during the Staff-Engineer review.
>
> Step 8: a module-scope `selectHelpfulMessage(helpful, result)` helper is defined at the bottom of `review.application.service.ts` (kept off the class so it is trivially unit-testable in isolation). The idempotency-key path wraps both branches in a single `idempotencyService.checkAndSet(...)` whose cached response preserves the original message verbatim. The non-keyed path always computes the message from `(helpful, result)` per §4.5.
>
> Step 9: smoke-tested via the new Phase 4 e2e (`test/review-helpful.e2e-spec.ts`) — see below.

### Phase 4 — Tests

10. New `src/modules/review/infrastructure/repositories/review.repository.spec.ts` (no such file today):
    - Single add: returns `true`; counter +1; vote row created.
    - Double add (same user, same review): second call returns `false`. Counter is exactly 1 after both.
    - Single remove: returns `true`; counter -1; vote row deleted.
    - Double remove: second call returns `false`. Counter unchanged.
    - Five alternations: final counter matches final vote count.
    - Concurrent adds from the same user (`Promise.all` × 2): exactly one call returns `true`, exactly one returns `false`. Counter is exactly 1.
    - Concurrent removes from the same user: exactly one call returns `true`, exactly one returns `false`. Counter is exactly -1.
    - Mixed concurrent add+remove: counter matches final vote count.
    - Transaction is atomic: a forced error after the vote mutation but before the counter update leaves neither write committed.
    - When called inside an existing transaction (mock `TransactionalContext.getDbClient()` to return a client), no new transaction is opened; both writes ride the outer client.
11. Domain service tests (extend existing or add):
    - 404 when review is missing.
    - 400 when actor is the review's author.
    - Log line emitted only when result is `true`.
12. Application service / controller tests (extend existing or add):
    - First POST helpful:true: `200 { message: "Review marked as helpful" }`.
    - Second POST helpful:true (no key): `200 { message: "Review was already marked as helpful" }`.
    - First DELETE: `200 { message: "Helpful vote removed" }`.
    - Second DELETE: `200 { message: "No helpful vote to remove" }`.
    - DELETE without prior POST: `200 { message: "No helpful vote to remove" }`.
    - Idempotency-key path: same body returned on replay; no second repository call.
13. E2E `test/review-helpful.e2e-spec.ts` (new):
    - Real DB. Two users, one review. POST helpful → GET review → assert `helpfulCount = 1`. Second user POST → assert `helpfulCount = 2`. Either user DELETE → assert `helpfulCount = 1`. Same user DELETE again → assert `helpfulCount = 1` and `message: "No helpful vote to remove"`. Diagnostic SQL at the end: `helpful_count = COUNT(*) FROM review_helpful_votes`.
14. Reconciliation test `test/reconcile-helpful-count.e2e-spec.ts` (new):
    - Seed two reviews with intentional drift (`helpful_count` set to 999 while zero votes exist). Run the migration. Assert `helpful_count` is now 0.

> **Status**: completed. Deviations from the plan as written:
>
> - The plan §4 step 10 named `src/modules/review/infrastructure/repositories/review.repository.spec.ts`, but the file lives under `test/review.repository.e2e-spec.ts` instead. Rationale: the project's `pnpm test` suite runs `.spec.ts` files inside `src/` without loading `.env`, and these tests need a real DB. The existing `test/ranking-phase1.e2e-spec.ts` pattern (env-loading + graceful-skip when the DB is unreachable) is the right home for them. All 10 contract items above are covered.
> - Steps 11–13 are folded into the controller-level e2e (`test/review-helpful.e2e-spec.ts`). The plan §4 says "extend existing or add"; the project has no existing service-level test file for the review module, so the controller-level e2e is the chosen home. It exercises the message matrix end-to-end, the 400-on-self-vote, the 400-on-non-UUID, and the idempotency-key replay path.
> - Step 13's status-code expectation is `200 / 201` (not strictly `200`). NestJS returns `201 Created` for `POST` when no `@HttpCode` override is set. Both branches are accepted in the test for portability.
> - Step 14's test shells out to `docker exec` against the running `quizdb` container to execute the migration SQL via stdin (not `-c`, which loses comments and shell-metachars in the migration file). The test is hermetic: it inserts drift rows, runs the migration, asserts the counter converges, then cleans up.
> - **Phase 1 was partially missing on disk when Phase 4 began**: `meta/0007_snapshot.json` existed (copied from `0006_snapshot.json` with new `id`/`prevId`) but `0007_reconcile_helpful_count.sql` and the journal entry did not. Phase 4 re-created the SQL file (with `NOW()` casts that match the `timestamptz` column type, not `::text` as a naive draft suggested) and added the journal entry. The journal now advances correctly to idx 6.
>
> Run them all with:
>
> ```bash
> pnpm test:e2e --testPathPatterns='(review\.repository|review-helpful|reconcile-helpful-count)' --forceExit
> ```
>
> (The `--forceExit` flag is recommended because the AppModule leaves open handles — Redis subscribers, scheduling service, etc. — that prevent Jest from exiting cleanly. This is a project-wide behaviour, not specific to these specs.)

### Phase 5 — Rollout

15. Land Phase 1 reconciliation migration as a standalone PR. **Do not** gate on Phase 2 onward.
16. Land Phases 2–4 in a single PR (or a stacked branch) once tests pass.
17. Run the diagnostic SQL in production 24 hours after deployment. Expect zero mismatches.

### Phase 6 — Follow-up (out of scope for this change)

18. Audit other denormalized counters in the same way:
    - `quiz_stats.total_attempts`, `total_players`, `rating_count`, `bookmark_count`.
    - `quiz_attempts.score_percent`, `correct_count`.
    - Each audit is a one-day ticket; do not fold into this PR.
19. Optional: introduce a `CHECK (helpful_count >= 0)` constraint on `quiz_reviews.helpful_count` as defense-in-depth. Submit as a separate migration if reviewers ask for it.

---

## 8. Diagnostic SQL (also in `scripts/diagnostics/helpful-count-drift.sql`)

```sql
SELECT r.review_id,
       r.helpful_count AS cached,
       (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id) AS actual
  FROM quiz_reviews r
 WHERE r.helpful_count IS DISTINCT FROM (
       SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id
       );
```

Returns rows where the cached counter disagrees with the actual vote count. Expected result: zero rows after Phase 1 and after every subsequent deploy.

---

## 9. Reconciliation migration SQL

Two UPDATEs. Both are idempotent (re-running produces no changes).

The first statement reconciles reviews that have at least one vote: it joins `quiz_reviews` with a `GROUP BY` aggregation over `review_helpful_votes` and updates `helpful_count` to the actual count, filtered to rows where the values differ.

The second statement reconciles reviews with zero votes that nonetheless have a non-zero `helpful_count` — a state achievable only via the bug, never via legitimate operations. It uses `NOT EXISTS` to identify zero-vote reviews and sets their `helpful_count` to 0.

(See the migration file `0007_reconcile_helpful_count.sql` for the exact SQL.)

---

## 10. Files touched

| Path | Change |
|---|---|
| `src/core/database/migrations/0007_reconcile_helpful_count.sql` | New. Reconciliation SQL. |
| `src/core/database/migrations/meta/0007_snapshot.json` | New. Drizzle meta. |
| `src/core/database/migrations/meta/_journal.json` | New entry for migration 0007. |
| `scripts/diagnostics/helpful-count-drift.sql` | New. Read-only diagnostic. |
| `src/modules/review/domain/ports/review-repository.port.ts` | Remove `ReviewHelpfulVoteRow`. Replace three methods with `addHelpfulVote` and `removeHelpfulVote`. |
| `src/modules/review/infrastructure/repositories/review.repository.ts` | Replace three implementations with two. Inject `TransactionalContext`. Drop `ReviewHelpfulVoteRow` import. |
| `src/modules/review/domain/review.service.ts` | Replace `markReviewHelpful`/`removeHelpfulVote` with two methods. Add private `assertCanVote`. Drop direct counter calls. Drop `voteId` from log payload. |
| `src/modules/review/application/review.application.service.ts` | Switch on `payload.helpful`; select message by `(helpful, result)`. Idempotency wrapper unchanged in shape. |
| `src/modules/review/infrastructure/repositories/review.repository.spec.ts` | New. Repository-level tests. |
| `src/modules/review/domain/review.service.spec.ts` (or new) | Domain service tests. |
| `src/modules/review/application/review.application.service.spec.ts` (or new) | Application service tests. |
| `test/review-helpful.e2e-spec.ts` | New. End-to-end tests. |
| `test/reconcile-helpful-count.e2e-spec.ts` | New. Migration verification. |
| `docs/adr/0017-helpful-vote-counter-consistency.md` | New. Architectural decision record. |
| `docs/adr/README.md` | Index row added for ADR-0017. |

---

## 11. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Existing production data drifted badly | medium | Phase 1 reconciles before Phase 5; diagnostic SQL verifies. |
| Concurrent votes during deploy | low | Unique constraint serializes; `RETURNING` reveals the actual outcome. Worst case is one extra round-trip per concurrent user. |
| Phase 2 changes the repository signature without the service being rewired | medium | Compiler will catch it — the service references the removed method names. |
| Reconciliation migration touches many rows and holds locks | medium | Run during low-traffic window; the two UPDATEs use the existing `(review_id)` index on `review_helpful_votes` from `idx_review_helpful_votes_review_id` (`schema.ts:832`–`835`). For very large tables, switch to per-row reconciliation in batches. |
| Future developer re-introduces a direct counter write | low | The port no longer exposes such a method. Compiler will catch any new attempt. |
| An unrelated downstream consumer assumed a `voteId` is on the log | low | The pino log entry loses the `voteId` field. Notify operators in the release notes. |
| A future feature genuinely needs `voteId` | low | The repository can be extended then; current callers do not require it. |

---

## 12. Rollout

1. Land Phase 1 reconciliation migration as a standalone PR. **Do not** gate on later phases.
2. Land Phases 2–4 in a single PR (or stacked branch) once tests pass.
3. Promote to production.
4. Run the diagnostic SQL 24 hours after deployment; expect zero mismatches.

---

## 13. Done definition

- A repeat POST and a repeat DELETE on the same `(review, user)` produce exactly one state change.
- `quiz_reviews.helpful_count` always equals `COUNT(*) FROM review_helpful_votes WHERE review_id = …` by construction.
- Two concurrent writes from the same user produce exactly one increment.
- Reconciliation migration has run in staging and production with zero post-migration drift.
- ADR-0017 is filed; index updated.
- All tests (existing + new) pass.
- OpenAPI artifact is byte-equivalent (no regeneration required).
- Release notes mention the refined `message` text per outcome.
