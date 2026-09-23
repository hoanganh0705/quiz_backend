# Database Audit Remediation Plan

> **Scope:** Code-only remediation of the database audit findings (DB-001 … DB-150).
> **Out of scope:** All migration work (DDL, index creation, constraint changes via SQL files,
> `drizzle-kit generate`, schema-data backfills). The user is handling migrations manually;
> every phase below explicitly stops at the *code* layer and tags items that still require
> a corresponding migration authored separately.

---

## How to read this plan

Each finding has three possible handling levels:

| Tag | Meaning |
|---|---|
| **CODE-ONLY** | Change is fully contained in TypeScript/TS-config. No DB schema change. Ship in code. |
| **CODE + MIG** | Code change is required AND a migration must exist for the DB-side enforcement. **The migration is the user's responsibility** — code authors must (a) not silently rely on the constraint being present, and (b) leave an explicit TODO/MIG-REF note pointing at the finding ID. |
| **MIG-ONLY** | The finding can be fixed entirely in SQL. Listed here for completeness so the developer writing migrations has a checklist. **No code change.** |

Each phase lists:
- the findings it resolves,
- the files touched,
- the explicit "DO NOT TOUCH" list (migrations, journal, snapshots),
- and the verification command(s) to run.

---

## Phase 0 — Pre-flight (no behavior change)

**Goal:** Establish a safe workspace before any code edits.

**Tasks**

1. Confirm branch + working tree are clean.
2. Verify `pnpm test` and `pnpm build` pass on `main` before changes.
3. Read the audit report (DB-001 … DB-150) and copy the finding IDs into a working
   scratch file so each phase can cross-reference them.
4. Tag each finding with one of `CODE-ONLY`, `CODE + MIG`, or `MIG-ONLY` before
   starting implementation. The tagging table at the bottom of this document is
   the source of truth.

**Files touched:** none.

**Verification:**

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

**DO NOT TOUCH:**

- `src/core/database/migrations/**`
- `src/core/database/migrations/meta/**`
- `drizzle.config.ts`

---

## Phase 1 — Indexes & missing query support (code-only path)

**Goal:** Convert "missing index" findings into code-level query rewrites and
prepared "index requests" for the migration author. **No SQL files are written
by this phase.**

### Findings in scope

DB-031, DB-032, DB-033, DB-034, DB-060, DB-100, DB-101, DB-102, DB-115,
DB-116, DB-117, DB-122, DB-125, DB-126, DB-127, DB-128 — all `MIG-ONLY`.

### Code-side preparation (CODE-ONLY sub-steps)

Even though the indexes themselves are migration work, the *queries that depend
on them* can be hardened in code now:

1. **`src/modules/ranking/infrastructure/repositories/aggregates/leaderboard.repository.ts`**
   - Refactor `getLeaderboard(period, limit, offset)` to use a keyset cursor
     keyed on `(xp DESC, user_id ASC)`. Keep `offset` as a deprecated parameter
     that throws if `> MAX_OFFSET_PAGES`. This is the prerequisite for switching
     off OFFSET pagination (see Phase 5).
   - Add a `MIG-REF: DB-031` comment above the function pointing to the index
     the migration author must add.

2. **`src/modules/coins/infrastructure/repositories/coin.repository.ts`**
   - Replace `SUM(amount)` over `coin_transactions` in `getLedgerSum` /
     `getDailyEarnCapSum` with a single `SELECT user_id, SUM(amount) … GROUP BY`
     or a window if the hot path needs per-row sums.
   - Tag with `MIG-REF: DB-032`.

3. **`src/modules/ranking/infrastructure/repositories/aggregates/rank-history.repository.ts`**
   - Confirm queries use `(user_id, recorded_at DESC)` ordering; if not, fix.
   - Tag with `MIG-REF: DB-033`.

4. **`src/modules/notification/infrastructure/repositories/notification.repository.ts`**
   - Confirm the unread-count query path can be served by a partial index
     `(user_id) WHERE deleted_at IS NULL AND read_at IS NULL`.
   - Tag with `MIG-REF: DB-030`.

5. **`src/modules/auth/infrastructure/repositories/user-session.repository.ts`**
   - Add a `findActiveByUser` method that explicitly filters
     `revoked_at IS NULL AND expires_at > now()` and uses an indexed path.
   - Tag with `MIG-REF: DB-060`.

6. **`src/modules/attempt/infrastructure/repositories/attempt.repository.ts`**
   - Tag `completeAttemptAndSideEffects` and `list` queries with `MIG-REF: DB-102, DB-125`.

7. **`src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`**
   - Tag `listInstances`, `getLeaderboard` with `MIG-REF: DB-126`.

8. **`src/modules/outbox` (auth/coins/achievement/ranking processors)**
   - Add a `cleanup` repository method `DELETE FROM outbox_events WHERE processed_at < now() - INTERVAL '7 days' RETURNING event_id`. Tag with `MIG-REF: DB-034`.

### Files touched

- `src/modules/ranking/infrastructure/repositories/aggregates/leaderboard.repository.ts`
- `src/modules/coins/infrastructure/repositories/coin.repository.ts`
- `src/modules/ranking/infrastructure/repositories/aggregates/rank-history.repository.ts`
- `src/modules/notification/infrastructure/repositories/notification.repository.ts`
- `src/modules/auth/infrastructure/repositories/user-session.repository.ts`
- `src/modules/attempt/infrastructure/repositories/attempt.repository.ts`
- `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`
- `src/modules/auth/infrastructure/outbox/outbox.adapter.ts` (or equivalent per-processor)

### Verification

```bash
pnpm test src/modules/ranking
pnpm test src/modules/coins
pnpm test src/modules/notification
```

### DO NOT TOUCH

- `src/core/database/migrations/**`
- `drizzle.config.ts`

---

## Phase 2 — Concurrency hardening (mostly CODE-ONLY)

**Goal:** Replace fragile read-modify-write patterns with atomic SQL or
explicit locking, and centralize isolation-level documentation.

### Findings in scope

| ID | Tag | Resolution path |
|---|---|---|
| DB-002 | CODE + MIG | Add app-side guard on every attempt-status UPDATE; add `MIG-REF` for FSM trigger. |
| DB-003 | CODE + MIG | Add app-side invariant in `QuizInstanceService.joinOrReturn`; `MIG-REF` for CHECK. |
| DB-006 | CODE-ONLY | Verified correct. Add inline doc comment explaining the `SELECT 1 FOR UPDATE` rationale. |
| DB-009 | CODE + MIG | Add `throw` in `social/follow.service.ts` for self-follow; `MIG-REF`. |
| DB-010 | CODE + MIG | Same as DB-009 for `block.service.ts`. |
| DB-018 | CODE-ONLY | Replace `pg_advisory_xact_lock(hashtext(userId))` with `pg_advisory_xact_lock(hashtextextended(userId, 0))` or two-arg form. |
| DB-019 | CODE-ONLY | Add `// Isolation: READ COMMITTED` header in `src/core/database/database.module.ts` and `TransactionalContext`. |
| DB-020 | CODE + MIG | Add `ON CONFLICT (idempotency_key) DO NOTHING` to ledger INSERT in `applyDeltaInTx`; `MIG-REF` for unique idempotency key. |
| DB-021 | CODE-ONLY | Audit every outbox processor's `SELECT … FOR UPDATE SKIP LOCKED`. Add `// SKIP LOCKED` comment if present, fix if missing. |
| DB-022 | CODE + MIG | Replace denormalized `helpful_count` with `COUNT(*)` from `review_helpful_votes`. Tag with `MIG-REF` for column drop (optional, MIG only). |
| DB-038 | CODE-ONLY | Replace `updatePeakRank` read-then-write with `UPDATE … SET peak_X_rank = LEAST(peak_X_rank, $1) … RETURNING`. |
| DB-063 | CODE-ONLY | Verify `attempt-xp-outbox-processor.scheduler.ts` and `daily-challenge-xp-outbox-processor.scheduler.ts` use `FOR UPDATE SKIP LOCKED`. |
| DB-074 | CODE-ONLY | In `coin.repository.applySpendInTx`, switch to `SELECT … FOR UPDATE` on `user_wallets`. |
| DB-107 | CODE-ONLY | Replace app-side `getWeekStart/getMonthStart` with SQL `date_trunc('week', now())`. |

### Files touched

- `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts` (DB-006 doc)
- `src/modules/social/application/*follow.service.ts`, `*block.service.ts`, `*friendship.service.ts`
- `src/modules/auth/infrastructure/repositories/user-session.repository.ts` (DB-018)
- `src/modules/auth/infrastructure/repositories/aggregates/password-change.repository.ts` (DB-018)
- `src/core/database/database.module.ts` (DB-019)
- `src/common/interceptors/transactional-context.ts` (DB-019)
- `src/modules/coins/infrastructure/repositories/coin.repository.ts` (DB-020, DB-074)
- `src/modules/{auth,coins,achievement,ranking,attempt,daily-challenge}/infrastructure/outbox/*.processor.service.ts` (DB-021, DB-063)
- `src/modules/review/infrastructure/repositories/review.repository.ts` (DB-022)
- `src/modules/ranking/infrastructure/repositories/aggregates/user-ranking.repository.ts` (DB-038)
- `src/modules/ranking/domain/services/rank-calculation.service.ts` (DB-038)

### Verification

```bash
pnpm test src/modules/auth
pnpm test src/modules/coins
pnpm test src/modules/review
pnpm test src/modules/ranking
pnpm test src/modules/social
```

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 3 — Pagination refactor (CODE-ONLY)

**Goal:** Remove OFFSET pagination from leaderboards and any other large-cardinality
listing, replacing with deterministic keyset cursors.

### Findings in scope

| ID | Tag | Resolution |
|---|---|---|
| DB-027 | CODE-ONLY | Leaderboard OFFSET → keyset (already started in Phase 1). |
| DB-029 | CODE-ONLY | Replace correlated subquery for `playerCount` in `instance.listInstances` with `LEFT JOIN … GROUP BY`. |
| DB-050 | CODE-ONLY | Verify single-query aggregate in comment repository (GROUP BY instead of N+1). |

### Files touched

- `src/modules/ranking/infrastructure/repositories/aggregates/leaderboard.repository.ts`
- `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`
- `src/modules/comment/infrastructure/repositories/comment.repository.ts`

### Verification

```bash
pnpm test src/modules/ranking
pnpm test src/modules/instance
pnpm test src/modules/comment
```

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 4 — Counter reconciliation (CODE-ONLY)

**Goal:** Make every denormalized counter self-healing via scheduled jobs and
monotonic-atomic updates.

### Findings in scope

| ID | Tag | Resolution |
|---|---|---|
| DB-004 | CODE-ONLY | Atomic `UPDATE tournament_participants SET total_score = (SELECT SUM …)` in the round-completion tx. |
| DB-022 | CODE-ONLY | Done in Phase 2. |
| DB-024 | CODE-ONLY | Wire `RankCalculationService.performConsistencyCheck` into a scheduled job (`@Cron`) once per day. |
| DB-043 | CODE-ONLY | Add `recomputeQuizRatingStats(quizId)` job invoked on review write/delete; or run nightly. |
| DB-074 | CODE-ONLY | Done in Phase 2. |
| DB-092 | CODE-ONLY | Add `recomputeBookmarkCount(quizId)`; call from bookmark service add/remove. |
| DB-093 | CODE-ONLY | Add `recomputeCompletionRate(quizId)`; call from attempt completion. |

### New scheduled jobs (new code, not migration)

- `src/modules/ranking/infrastructure/scheduler/ranking-consistency.scheduler.ts`
- `src/modules/quiz/infrastructure/scheduler/quiz-stats-recompute.scheduler.ts`

### Files touched

- `src/modules/tournament/infrastructure/repositories/aggregates/tournament-participant.repository.ts`
- `src/modules/ranking/domain/services/rank-calculation.service.ts`
- `src/modules/quiz/domain/services/quiz-stats-recompute.service.ts` (new)
- `src/modules/quiz/infrastructure/scheduler/quiz-stats-recompute.scheduler.ts` (new)
- `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`
- `src/modules/review/infrastructure/repositories/review.repository.ts`
- `src/modules/bookmark/infrastructure/repositories/bookmark.repository.ts`

### Verification

```bash
pnpm test src/modules/ranking
pnpm test src/modules/tournament
pnpm test src/modules/quiz
pnpm test src/modules/bookmark
```

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 5 — Pagination, N+1, and hot-row fixes (CODE-ONLY)

**Goal:** Eliminate correlated subqueries and single-row sequence hotspots
that are addressable entirely in code.

### Findings in scope

| ID | Tag | Resolution |
|---|---|---|
| DB-023 | CODE-ONLY (data default) | Change Drizzle `cache: 1` to `cache: 32` in the `quiz_attempt_events` PK definition. **Important:** this is a *schema definition* change, not a migration — Drizzle regenerates the migration from the schema. The user has explicitly said they will write migrations, so this MUST be paired with a corresponding migration they author. Tag with `MIG-REF: DB-023`. |
| DB-027 | CODE-ONLY | Done in Phase 3. |
| DB-029 | CODE-ONLY | Done in Phase 3. |
| DB-050 | CODE-ONLY | Done in Phase 3. |

### Files touched

- `src/core/database/schema/quiz/schema.ts` (cache value, MIG-REF comment)
- (No further code changes; rest already covered.)

### DO NOT TOUCH

- `src/core/database/migrations/**`
- `meta/_journal.json`
- `meta/0000_snapshot.json` (and any other snapshot)

---

## Phase 6 — Soft-delete consistency & repository filtering (CODE-ONLY)

**Goal:** Audit every soft-deletable repository for missed `WHERE deleted_at IS NULL` filters,
unify helper, fix joins that can leak deleted rows.

### Findings in scope

DB-007, DB-008, DB-025, DB-026, DB-045, DB-073, DB-141, DB-142, DB-143

### Tasks

1. Add a shared helper `notDeleted(table)` in
   `src/common/database/soft-delete.helper.ts` and use it in every repository that
   touches a soft-deletable table.
2. In `quiz.repository.ts`, ensure `getBySlug` and listing queries filter on
   `deleted_at IS NULL AND is_hidden = false`.
3. In `social/follow.service.ts`, canonicalize ordering (insert with
   `follower_id = lesser_id, followee_id = greater_id`) and reject inverse pair at the
   application boundary. Tag DB-008 with `MIG-REF` for the CHECK.
4. In `quiz.repository.ts` and `quiz-version.repository.ts`, replace the implicit
   assumption that `creator_id` is non-null with explicit fallback rendering.
   Tag DB-142/DB-143 with `MIG-REF`.

### Files touched

- `src/common/database/soft-delete.helper.ts` (new)
- `src/modules/social/application/follow.service.ts`
- `src/modules/social/application/friendship.service.ts`
- `src/modules/social/application/block.service.ts`
- `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`
- `src/modules/quiz/infrastructure/repositories/quiz-version.repository.ts`
- `src/modules/comment/infrastructure/repositories/comment.repository.ts`
- `src/modules/review/infrastructure/repositories/review.repository.ts`
- `src/modules/notification/infrastructure/repositories/notification.repository.ts`

### Verification

```bash
pnpm test src/common/database
pnpm test src/modules/quiz
pnpm test src/modules/social
pnpm test src/modules/comment
pnpm test src/modules/review
pnpm test src/modules/notification
```

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 7 — Enum migration (CODE-ONLY)

**Goal:** Convert text+CHECK columns to proper `pgEnum` definitions.

> **Important:** As with DB-023, enum changes are schema-definition changes. The
> migration author will write the `CREATE TYPE …` / `ALTER TABLE …` SQL. The code
> change is to update the Drizzle schema and add a `MIG-REF` comment.

### Findings in scope

DB-001, DB-064, DB-065, DB-066, DB-067, DB-068, DB-069, DB-090, DB-118

### Tasks

1. In `src/core/database/schema/quiz/schema.ts`:
   - `quiz_attempts.status` → `quizAttemptStatus` pgEnum.
   - `quiz_attempt_events.eventType` → `quizAttemptEventType` pgEnum.
   - `quiz_instance_players.status` → `quizInstancePlayerStatus` pgEnum.
   - `quiz_attempts.contextType` → `quizContextType` pgEnum.
2. In `src/core/database/schema/tournament/schema.ts`:
   - `tournaments.status` → `tournamentStatus` pgEnum.
   - `tournament_rounds.status` → `tournamentRoundStatus` pgEnum.
3. In `src/core/database/schema/social/schema.ts`:
   - `social_feed_activities.activityType` → pgEnum.
4. In `src/core/database/schema/user/schema.ts`:
   - `user_activity_events.eventType` → pgEnum.
5. In `src/core/database/schema/comment/schema.ts`:
   - `review_reports.reason` → pgEnum (was already text+CHECK).
6. Add `MIG-REF: DB-XXX` comment above each `pgEnum(...)` declaration.

### Files touched

- `src/core/database/schema/quiz/schema.ts`
- `src/core/database/schema/tournament/schema.ts`
- `src/core/database/schema/social/schema.ts`
- `src/core/database/schema/user/schema.ts`
- `src/core/database/schema/comment/schema.ts`
- `src/core/database/schema/shared/enums.ts` (add new enum types)

### Verification

```bash
pnpm build
pnpm test
```

### DO NOT TOUCH

- `src/core/database/migrations/**`
- `meta/_journal.json`
- any `meta/*.snapshot.json`

---

## Phase 8 — Application-side invariants (CODE-ONLY + MIG-REF)

**Goal:** Replace "neither enforced" invariants with explicit application code
that fails fast, and emit MIG-REF tags for DB-side enforcement.

### Findings in scope

| ID | Tag | Resolution |
|---|---|---|
| DB-002 | CODE + MIG | Add `assertAttemptTransition(from, to)` in `attempt-domain.service.ts`. |
| DB-003 | CODE + MIG | Add `assertInstancePlayerTransition` helper. |
| DB-007 | CODE-ONLY | Document retake policy in code comments. |
| DB-008 | CODE + MIG | Add `canonicalizeFriendshipPair(userA, userB)` helper. |
| DB-009 | CODE + MIG | Guard self-follow in `FollowService.create`. |
| DB-010 | CODE + MIG | Guard self-block in `BlockService.create`. |
| DB-011 | CODE + MIG | Add depth check (e.g. ≤ 5) in `CommentService.reply`. |
| DB-026 | CODE-ONLY | Add `assertPlayerFinishedHasAttempt` invariant. |
| DB-097 | CODE + MIG | Validate `contextRefId` against `quiz_instances` when `contextType='instance'`. |
| DB-098 | CODE + MIG | Validate `selectedOptionId` belongs to `questionId`. |
| DB-099 | CODE-ONLY | Application-side FSM for `review_reports.status` transitions. |
| DB-139 | CODE + MIG | Reject self-parent in `CommentService.reply`. |

### Files touched

- `src/modules/attempt/domain/services/attempt-domain.service.ts`
- `src/modules/instance/domain/services/instance-domain.service.ts`
- `src/modules/social/application/follow.service.ts`
- `src/modules/social/application/block.service.ts`
- `src/modules/social/application/friendship.service.ts`
- `src/modules/comment/application/comment.service.ts`
- `src/modules/review/application/review.service.ts`
- `src/modules/review/infrastructure/repositories/review.repository.ts`

### Verification

```bash
pnpm test src/modules/attempt
pnpm test src/modules/instance
pnpm test src/modules/social
pnpm test src/modules/comment
pnpm test src/modules/review
```

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 9 — Performance & sequence tuning (CODE-ONLY)

**Goal:** Address DB-023 sequence cache and other in-code tuning items.

### Findings in scope

DB-023 (cache: 32), DB-073 (filter completeness), DB-118/DB-119/DB-120/DB-053
(jsonb validation in code), DB-088/DB-110/DB-119 (jsonb size caps in code).

### Tasks

1. Update `quiz_attempt_events` PK `cache: 1` → `cache: 32`. Add `MIG-REF: DB-023`.
2. Add a `assertJsonbSize(payload, maxBytes)` helper in `src/common/utils/jsonb.util.ts`
   for application-side size validation on payloads (notifications, attempts, etc.).
3. Sweep all repositories that touch soft-deletable tables; ensure every
   `SELECT`, `UPDATE`, `DELETE` filters on `deleted_at IS NULL` unless the
   caller is admin or has explicitly opted out (the latter only via a
   dedicated admin repository path).

### Files touched

- `src/core/database/schema/quiz/schema.ts`
- `src/common/utils/jsonb.util.ts` (new)
- All repositories listed in Phase 6

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 10 — Retention & cleanup jobs (CODE-ONLY)

**Goal:** Add scheduled cleanup for high-write append-only tables, idempotency
keys, sessions, and outbox.

### Findings in scope

DB-035, DB-036, DB-037, DB-041, DB-042, DB-123, DB-127

### Tasks

1. Create `src/modules/outbox/infrastructure/scheduler/outbox-cleanup.scheduler.ts`
   that deletes processed outbox rows older than `OUTBOX_RETENTION_DAYS`
   (configurable, default 7).
2. Create `src/modules/auth/infrastructure/scheduler/idempotency-cleanup.scheduler.ts`
   for `idempotency_keys` expired rows.
3. Create `src/modules/auth/infrastructure/scheduler/session-cleanup.scheduler.ts`
   for expired/revoked sessions.
4. Add `attempt-events-cleanup.scheduler.ts` (retention from config).
5. Add `social-feed-cleanup.scheduler.ts` (retention from config).
6. Add `user-activity-events-cleanup.scheduler.ts` (retention from config).

All cleanup jobs are idempotent and use `DELETE … RETURNING id` to log
deleted row counts.

### Files touched (new)

- `src/modules/outbox/infrastructure/scheduler/outbox-cleanup.scheduler.ts`
- `src/modules/auth/infrastructure/scheduler/idempotency-cleanup.scheduler.ts`
- `src/modules/auth/infrastructure/scheduler/session-cleanup.scheduler.ts`
- `src/modules/attempt/infrastructure/scheduler/attempt-events-cleanup.scheduler.ts`
- `src/modules/social/infrastructure/scheduler/social-feed-cleanup.scheduler.ts`
- `src/modules/user/infrastructure/scheduler/user-activity-cleanup.scheduler.ts`

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 11 — Outbox processor hardening (CODE-ONLY)

**Goal:** Make every outbox processor use `FOR UPDATE SKIP LOCKED`,
idempotency-conflict detection, and DLQ discipline.

### Findings in scope

DB-021, DB-063, DB-077, DB-078, DB-082

### Tasks

1. Create a shared `BaseOutboxProcessor` abstract class in
   `src/common/outbox/base-outbox-processor.ts` that:
   - Selects pending rows with `FOR UPDATE SKIP LOCKED`.
   - Detects idempotency-key conflicts via the partial unique index
     (`uq_outbox_events_idempotency_unprocessed`).
   - Routes to a dead-letter state after `MAX_RETRIES`.
2. Refactor each processor to extend `BaseOutboxProcessor`:
   - `auth/outbox-processor.service.ts`
   - `coins/outbox/coin-outbox-processor.service.ts`
   - `achievement/outbox/achievement-outbox-processor.service.ts`
   - `ranking/outbox/ranking-outbox-processor.service.ts`
   - `attempt/outbox/attempt-xp-outbox-processor.service.ts`
   - `daily-challenge/outbox/daily-challenge-xp-outbox-processor.service.ts`
3. Add unit tests for the conflict path in each.

### Files touched (new)

- `src/common/outbox/base-outbox-processor.ts`

### Files touched (refactored)

- All `*outbox-processor.service.ts` listed above.

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 12 — Polymorphic FK encapsulation (CODE-ONLY)

**Goal:** Replace bare `reference_type` + `reference_id` text columns with
typed application services that perform the FK lookup explicitly, removing
the silent-referent risk.

### Findings in scope

DB-097, DB-147, DB-148, DB-149

### Tasks

1. Introduce `ReferencedEntity` discriminated union in
   `src/common/database/references.types.ts`.
2. Refactor each polymorphic writer (`CoinTransaction`, `Notification`,
   `SocialFeedActivity`, `QuizAttempt.contextRefId`) to validate that the
   referenced row exists via the appropriate repository before insert.
3. Add a `ReferentialValidator` service per domain that performs the
   existence check + caching (Redis) for hot paths.

### Files touched

- `src/common/database/references.types.ts` (new)
- `src/modules/coins/application/coin-transaction.service.ts`
- `src/modules/notification/application/notification.service.ts`
- `src/modules/social/application/social-feed.service.ts`
- `src/modules/attempt/application/attempt-context.service.ts`

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 13 — Documentation & ADR update (CODE-ONLY)

**Goal:** Lock in the decisions made in this plan as ADRs and module docs.

### Tasks

1. Add `docs/adr/0024-pagination-strategy.md` updating the existing
   `0004-pagination-strategy.md` if it conflicts with the new keyset default.
2. Add `docs/adr/0025-counter-reconciliation.md` describing the scheduled
   recompute pattern.
3. Add `docs/adr/0026-soft-delete-filter-helper.md` describing
   `notDeleted(table)`.
4. Add `docs/adr/0027-base-outbox-processor.md` describing
   `BaseOutboxProcessor`.
5. Update `docs/standards/database.md` to reference the audit remediation
   plan and the migration hand-off notes.
6. Update `docs/standards/migration.md` with the "what code authors MUST NOT do"
   list (the inverse of this plan).

### Files touched

- `docs/adr/0024-pagination-strategy.md` (new)
- `docs/adr/0025-counter-reconciliation.md` (new)
- `docs/adr/0026-soft-delete-filter-helper.md` (new)
- `docs/adr/0027-base-outbox-processor.md` (new)
- `docs/standards/database.md`
- `docs/standards/migration.md`

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 14 — Coverage gating (CODE-ONLY)

**Goal:** Add a CI check that fails if a repository touches a soft-deletable
table without the `notDeleted()` filter.

### Tasks

1. Add an ESLint custom rule `no-soft-delete-leak` under
   `tools/eslint-plugins/no-soft-delete-leak.ts` (or `eslint-plugin-local`).
2. The rule flags any Drizzle `where()` clause that operates on
   `users/quizzes/friendships/blocked_users/user_follows/notifications/
   quiz_reviews/categories/tags/comment_rows` without a `notDeleted(table)`
   call.
3. Wire the rule into `eslint.config.js` for `*.repository.ts` files only.
4. Add the rule to `pnpm lint` and to pre-push hook.

### Files touched (new)

- `tools/eslint-plugins/no-soft-delete-leak.ts`
- `tools/eslint-plugins/index.ts`
- `eslint.config.js`

### DO NOT TOUCH

- `src/core/database/migrations/**`

---

## Phase 15 — Final verification (CODE-ONLY)

**Goal:** Confirm the codebase is in a healthy state after all phases.

### Tasks

1. `pnpm lint` passes with the new rule enabled.
2. `pnpm build` passes.
3. `pnpm test` passes (unit + integration + e2e).
4. `pnpm test:cov` reports ≥ 80% coverage.
5. Run the production-audit skill (if available) and confirm no new
   database risks are introduced.
6. Verify every `CODE + MIG` finding has a corresponding `MIG-REF` comment
   pointing at the migration author and the finding ID.

### Verification

```bash
pnpm install
pnpm lint
pnpm build
pnpm test
pnpm test:cov
```

### DO NOT TOUCH

- `src/core/database/migrations/**`
- `meta/_journal.json`
- any `meta/*.snapshot.json`

---

## Appendix A — Finding-to-tag map (work this list before coding)

> Pre-populate this table before starting Phase 1. Each finding becomes a
> tracked TODO with its tag.

| ID | Tag | Phase |
|---|---|---|
| DB-001 | CODE + MIG (enum) | 7 |
| DB-002 | CODE + MIG | 8 |
| DB-003 | CODE + MIG | 8 |
| DB-004 | CODE-ONLY | 4 |
| DB-005 | CODE-ONLY (with MIG-REF for covering index) | 1 |
| DB-006 | CODE-ONLY (doc comment) | 2 |
| DB-007 | CODE-ONLY (doc) | 8 |
| DB-008 | CODE + MIG | 8 |
| DB-009 | CODE + MIG | 8 |
| DB-010 | CODE + MIG | 8 |
| DB-011 | CODE + MIG | 8 |
| DB-012 | CODE-ONLY (doc) | 6 |
| DB-013 | MIG-ONLY | (user handles) |
| DB-014 | MIG-ONLY | (user handles) |
| DB-015 | MIG-ONLY | (user handles) |
| DB-016 | MIG-ONLY | (user handles) |
| DB-017 | MIG-ONLY | (user handles) |
| DB-018 | CODE-ONLY | 2 |
| DB-019 | CODE-ONLY | 2 |
| DB-020 | CODE + MIG | 2 |
| DB-021 | CODE-ONLY | 11 |
| DB-022 | CODE-ONLY (drop helper) + MIG-OPTIONAL | 4 |
| DB-023 | CODE + MIG | 5, 9 |
| DB-024 | CODE-ONLY | 4 |
| DB-025 | CODE-ONLY | 6 |
| DB-026 | CODE-ONLY | 8 |
| DB-027 | CODE-ONLY | 3 |
| DB-028 | CODE-ONLY (no-op, verified) | — |
| DB-029 | CODE-ONLY | 3 |
| DB-030 | CODE-ONLY (with MIG-REF) | 1 |
| DB-031 | CODE-ONLY (with MIG-REF) | 1, 5 |
| DB-032 | CODE-ONLY (with MIG-REF) | 1 |
| DB-033 | CODE-ONLY (with MIG-REF) | 1 |
| DB-034 | CODE-ONLY (with MIG-REF) | 1 |
| DB-035 | CODE-ONLY | 10 |
| DB-036 | CODE-ONLY | 10 |
| DB-037 | CODE-ONLY | 10 |
| DB-038 | CODE-ONLY | 2 |
| DB-039 | CODE-ONLY (architecture decision) | 13 |
| DB-040 | CODE-ONLY (no change) | — |
| DB-041 | CODE-ONLY | 10 |
| DB-042 | CODE-ONLY | 10 |
| DB-043 | CODE-ONLY | 4 |
| DB-044 | CODE-ONLY | (verify in repo; trivial fix) |
| DB-045 | CODE-ONLY | 6 |
| DB-046 | CODE + MIG | 8 |
| DB-047 | CODE + MIG | 8 |
| DB-048 | CODE-ONLY (no change) | — |
| DB-049 | CODE + MIG | 8 |
| DB-050 | CODE-ONLY | 3 |
| DB-051 | CODE-ONLY (doc) | 1 |
| DB-052 | CODE-ONLY (no change) | — |
| DB-053 | CODE-ONLY (validator) | 9 |
| DB-054 | CODE + MIG | 8 |
| DB-055 | CODE-ONLY (canonicalize) | 6 |
| DB-056 | CODE-ONLY (atomic reorder helper) | (Phase 8) |
| DB-057 | (good — no action) | — |
| DB-058 | (informational) | — |
| DB-059 | (good — no action) | — |
| DB-060 | CODE-ONLY (with MIG-REF) | 1 |
| DB-061 | CODE-ONLY (length cap in service) | 9 |
| DB-062 | (informational) | — |
| DB-063 | CODE-ONLY | 11 |
| DB-064 | CODE + MIG (enum) | 7 |
| DB-065 | CODE + MIG (enum) | 7 |
| DB-066 | CODE + MIG (enum) | 7 |
| DB-067 | CODE + MIG (enum) | 7 |
| DB-068 | CODE + MIG (enum) | 7 |
| DB-069 | CODE + MIG (enum) | 7 |
| DB-070 | (good — no action) | — |
| DB-071 | CODE-ONLY (link table refactor) | 12 |
| DB-072 | CODE-ONLY (derive on read) | (Phase 13 doc) |
| DB-073 | CODE-ONLY | 6 |
| DB-074 | CODE-ONLY | 2 |
| DB-075 | (informational) | — |
| DB-076 | (informational) | — |
| DB-077 | CODE-ONLY | 11 |
| DB-078 | CODE-ONLY | 11 |
| DB-079 | (verified) | — |
| DB-080 | (verified) | — |
| DB-081 | (verified) | — |
| DB-082 | CODE-ONLY | 11 |
| DB-083 | (informational) | — |
| DB-084 | (informational) | — |
| DB-085 | CODE + MIG | 8 |
| DB-086 | CODE + MIG | 8 |
| DB-087 | CODE + MIG | 8 |
| DB-088 | CODE-ONLY (size cap helper) | 9 |
| DB-089 | CODE + MIG | 8 |
| DB-090 | CODE + MIG (enum) | 7 |
| DB-091 | CODE-ONLY (with MIG-REF) | 1 |
| DB-092 | CODE-ONLY | 4 |
| DB-093 | CODE-ONLY | 4 |
| DB-094 | (informational) | — |
| DB-095 | CODE-ONLY (verify column) | (Phase 7) |
| DB-096 | (informational) | — |
| DB-097 | CODE + MIG | 8, 12 |
| DB-098 | CODE + MIG | 8 |
| DB-099 | CODE-ONLY | 8 |
| DB-100 | CODE-ONLY (with MIG-REF) | 1 |
| DB-101 | CODE-ONLY (with MIG-REF) | 1 |
| DB-102 | CODE-ONLY (with MIG-REF) | 1 |
| DB-103 | CODE-ONLY (with MIG-REF) | 1 |
| DB-104 | (informational) | — |
| DB-105 | (informational) | — |
| DB-106 | CODE-ONLY (with MIG-REF) | (Phase 1) |
| DB-107 | CODE-ONLY | 2 |
| DB-108 | (informational) | — |
| DB-109 | (informational) | — |
| DB-110 | CODE-ONLY (size cap helper) | 9 |
| DB-111 | (informational) | — |
| DB-112 | (informational) | — |
| DB-113 | (informational) | — |
| DB-114 | (informational) | — |
| DB-115 | CODE-ONLY (with MIG-REF) | 1 |
| DB-116 | CODE-ONLY (with MIG-REF) | 1 |
| DB-117 | CODE-ONLY (with MIG-REF) | 1 |
| DB-118 | CODE + MIG (enum) | 7 |
| DB-119 | CODE-ONLY (size cap helper) | 9 |
| DB-120 | CODE-ONLY (size cap helper) | 9 |
| DB-121 | (good — no action) | — |
| DB-122 | CODE-ONLY (with MIG-REF) | 1 |
| DB-123 | CODE-ONLY | 10 |
| DB-124 | (informational) | — |
| DB-125 | CODE-ONLY (with MIG-REF) | 1 |
| DB-126 | CODE-ONLY (with MIG-REF) | 1 |
| DB-127 | CODE-ONLY (with MIG-REF) | 1 |
| DB-128 | CODE-ONLY (with MIG-REF) | 1 |
| DB-129 | CODE-ONLY (verify) | (Phase 8) |
| DB-130 | (informational) | — |
| DB-131 | (informational) | — |
| DB-132 | (good — no action) | — |
| DB-133 | (informational) | — |
| DB-134 | (informational) | — |
| DB-135 | (informational) | — |
| DB-136 | (good — no action) | — |
| DB-137 | (good — no action) | — |
| DB-138 | CODE + MIG | 8 |
| DB-139 | CODE + MIG | 8 |
| DB-140 | (informational) | — |
| DB-141 | CODE-ONLY | 6 |
| DB-142 | CODE-ONLY (doc) + MIG-OPTIONAL | 6 |
| DB-143 | CODE-ONLY (doc) + MIG-OPTIONAL | 6 |
| DB-144 | (informational) | — |
| DB-145 | (good — no action) | — |
| DB-146 | (good — no action) | — |
| DB-147 | CODE-ONLY | 12 |
| DB-148 | CODE-ONLY | 12 |
| DB-149 | CODE-ONLY | 12 |
| DB-150 | (informational) | — |

---

## Appendix B — Hand-off contract to the migration author

For every `CODE + MIG` and `MIG-ONLY` finding, the code author will:

1. Add a `MIG-REF: DB-XXX` comment immediately above the affected code line.
2. Add an entry to the migration author's TODO list in
   `docs/runbooks/db-audit-migration-todos.md` (the user is responsible for
   creating/maintaining this file).
3. Never block CI on the migration — code changes must remain buildable
   even if the migration has not been applied. This means:
   - Application-level guards must precede any DB-level invariant.
   - Code paths must not silently rely on the new constraint existing.
   - Tests must not assume the new constraint exists unless gated by an
     environment variable like `ENABLE_DB_AUDIT_MIGRATIONS=1`.

For every `MIG-ONLY` finding, the code author will:

1. Add an entry to `docs/runbooks/db-audit-migration-todos.md` only — no
   code change.

---

## Appendix C — What the code author must NEVER do

- ❌ Edit any file under `src/core/database/migrations/**`.
- ❌ Edit `meta/_journal.json`.
- ❌ Edit any `meta/*.snapshot.json`.
- ❌ Run `drizzle-kit generate`.
- ❌ Hand-author `ALTER TABLE … ADD COLUMN …`, `CREATE INDEX …`, `CREATE TYPE …`,
  `ALTER TABLE … ADD CONSTRAINT …` SQL.
- ❌ Edit `drizzle.config.ts`.
- ❌ Add or remove columns, indexes, enums, or constraints in
  `src/core/database/schema/**/*.ts` without pairing the change with a
  `MIG-REF: DB-XXX` comment **and** an entry in
  `docs/runbooks/db-audit-migration-todos.md`. Schema definitions drive
  Drizzle's migration generator, so any schema change will leak into
  generated SQL.
- ❌ Add new tables, functions, triggers, or views to the schema files.
- ❌ Reference new tables / columns / types in code without the corresponding
  `MIG-REF` tag.
