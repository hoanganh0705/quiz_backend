# Discussion Module Architecture Review

**Module:** Discussion
**Date:** Thursday Jul 23, 2026
**Reviewer:** Principal Software Architect
**Status:** Pre-Production Review

---

## Executive Summary

**Overall Score: 6.5 / 10**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Architecture | 8/10 | Solid layering, proper DI patterns, good transaction handling |
| Product Design | 7/10 | Comprehensive features, but missing solved-filter and reply-depth enforcement |
| Business Modeling | 7.5/10 | Good state machine coverage, but several workflow gaps |
| Domain Modeling | 7/10 | Correct separation, missing event emission on vote removal |
| API Design | 6.5/10 | Pagination cursor bugs, DTO-schema mismatch, missing filters |
| Concurrency | 7/10 | Good TOCTOU fixes, but subscribe/save lack transactions |
| Scalability | 7/10 | Good indexing, cache strategy, but N+1 in trending queries |
| Maintainability | 5/10 | Minimal test coverage, no integration tests |
| Extensibility | 8/10 | Clean ports, policy pattern, event-driven architecture |
| Business Alignment | 7.5/10 | Matches documented requirements with gaps |

---

## Major Strengths

1. **Excellent TOCTOU Fix Implementation** — `FOR UPDATE` locking in `createComment()`, `deleteComment()`, `vote()`, and `removeVote()` properly closes race condition windows. The detailed comments explaining Fix #2 are exemplary.

2. **Clean Port Interface Design** — `DiscussionRepositoryPort`, `QuizExistencePort`, `UserExistencePort` provide clean cross-module integration without circular dependencies.

3. **Proper Scheduler Location** — `DiscussionCleanupService` in `infrastructure/scheduler/` following project conventions.

4. **Comprehensive State Machine** — Thread lifecycle (open/closed/hidden/deleted), comment lifecycle (visible/hidden/deleted), and report lifecycle properly modeled.

5. **Well-Documented Counter Reconciliation** — `reconcileDiscussionCounts()` with daily 3:30 AM cron and SQL using `IS DISTINCT FROM` for idempotent reconciliation.

6. **Domain Event Completeness** — 15+ domain events covering all significant state changes, with proper event emission patterns.

7. **Authorization Policy Pattern** — `DiscussionAuthorizationPolicy` is a clean, testable policy object without DI.

8. **CTE Optimization for Trending** — `fetchTrendingFromDb()` uses a single CTE pass instead of correlated subqueries, avoiding N+1 at the query level.

---

## Major Weaknesses

1. **Critical Pagination Cursor Bug** — `listThreads()`, `searchDiscussions()`, and `listUnansweredDiscussions()` accept cursor parameters but never forward them to the domain service/repository. Cursor pagination is broken for these endpoints.

2. **Minimal Test Coverage** — Only 1 spec file exists (`discussion.errors.spec.ts`) for a module with 80+ source files. No repository specs, service specs, or controller specs.

3. **Missing Reply Depth Enforcement** — `MAX_REPLIES_PER_COMMENT = 100` constant exists in repository but is never validated before comment creation. Users can exceed the 100-reply limit.

4. **DTO-Schema Mismatch for Comment Replies** — `listComments` accepts `parentCommentId` in the repository and domain layers, but `ListCommentsQueryDto` doesn't expose this field in the API.

5. **Vote Removal No-Op Events** — Removing a vote updates counters but emits no domain event, breaking the event-driven notification pipeline for un-voting.

6. **Subscribe/Save Race Conditions** — `subscribeToThread()` and `saveThread()` read the thread outside a transaction, creating TOCTOU windows.

7. **`reply` Target Type Inconsistency** — Repository methods accept `'thread' | 'comment' | 'reply'` but `DiscussionReportTargetType` only defines `'thread' | 'comment'`.

---

## Consistency Analysis

### Project Rules → Documentation → Implementation → Tests

| Area | Status | Finding |
|------|--------|---------|
| Layer Responsibilities | ✅ Consistent | transport → application → domain → infrastructure |
| DI Tokens | ✅ Consistent | `DISCUSSION_REPOSITORY_PORT`, `QUIZ_EXISTENCE_PORT`, etc. |
| Domain Exceptions | ✅ Consistent | `BaseDomainException` + concrete exceptions + `ProblemCodeMapping` |
| Error Response Format | ✅ Consistent | RFC 7807 with `extensions.code` |
| Pagination | ⚠️ Bug | Cursors accepted but not forwarded to repository |
| Soft Delete | ✅ Consistent | `deletedAt` column with `isNull()` filters |
| UUIDv7 | ✅ Consistent | `default(sql`uuidv7()`)` in schema |
| Transaction Management | ⚠️ Gap | `subscribeToThread()`/`saveThread()` lack transactions |
| Scheduler Location | ✅ Consistent | `infrastructure/scheduler/` |
| Test Coverage | ❌ Missing | Only 1 spec file for 80+ file module |
| Reply Depth Limit | ❌ Missing | `MAX_REPLIES_PER_COMMENT` defined but not enforced |

---

## Product Review

### From a Real User's Perspective

**What Works Well:**
- Creating threads and comments feels natural
- Solved marking for accepted answers
- Vote toggle (upvote/downvote) is responsive
- Trending and search feeds work as expected
- Thread subscriptions for notifications
- Moderation tools for admins

**User Experience Concerns:**

1. **Broken Pagination on Search** — Performing search → clicking "next page" returns the same results. Cursor never passed to repository.

2. **Broken Pagination on Trending/Unanswered** — Same issue as search; cursor ignored.

3. **Cannot Filter by Solved Status** — Documentation mentions "solved" as a thread attribute, but no API filter exists to find all solved threads.

4. **Cannot View Replies to a Comment** — `parentCommentId` filter exists in repository but not exposed in `ListCommentsQueryDto`.

5. **Silent Vote Changes** — When I change from upvote to downvote, no notification goes to the content author. Only the initial vote sends an event.

6. **Unbounded Reply Tree** — Documentation says max 100 replies per comment, but the system allows unlimited replies.

7. **Unsubscribe Not Guaranteed** — If the thread is deleted between the "check thread exists" and "delete subscription" calls, the operation might silently fail.

---

## Business Workflow Review

### State Machine: DiscussionThread Lifecycle

```
[Created by User]
    ↓
Open (status = 'open')
    │
    ├── closeThread() [author] ────────────────────────┐
    │                                                   ↓
    Closed (status = 'closed')                  Open (reopenThread())
    │                                                   │
    ├── deleteThread() [author] ───────────────────┐   │
    │                                              ↓   │
    │                                          Hidden (moderator hide)
    │                                              │   │
    ├── hideThread() [moderator] ───────────────┐  │   │
    │                                          ↓  │   │
    │                                      Open (restoreThread)
    │                                          │  │   │
    └── hideThread() [moderator]               │  │   │
                                              │  │   │
                                          Deleted ←┴──┘
                                          (soft-delete, no mutations)
```

### State Machine: DiscussionComment Lifecycle

```
[Created by Author]
    ↓
Visible (contentStatus = 'visible')
    │
    ├── deleteComment() [author] ──────────────→ Deleted (no mutations)
    │
    └── hideComment() [moderator] ────────────→ Hidden (visible to mods only)
                                                      │
                                              restoreComment() [moderator]
                                                      ↓
                                              Visible ←──→ hidden (toggle)
```

### Issues in Workflows

1. **Missing Reply Depth Check** — Comment creation validates thread status but never checks if `parentCommentId` depth exceeds 2 levels.

2. **No Event on Vote Removal** — Workflow documents comment about vote events, but `removeVote()` emits nothing.

3. **Unsubscribe Doesn't Validate Thread Existence** — User can unsubscribe from a non-existent thread (operation becomes no-op after DB constraint).

4. **Save Operation Race Window** — `saveThread()` reads thread first, then saves. If thread deleted between calls, save silently succeeds via `onConflictDoNothing()`.

---

## Domain Review

### Entities & Value Objects

**DiscussionThread Entity**
- `threadId` (UUIDv7) ✅
- `quizId`, `authorId` (FKs) ✅
- `title`, `body` (text) ✅
- `status` ('open' | 'closed' | 'hidden' | 'deleted') ✅
- `commentsCount`, `votesCount`, `upvotesCount`, `downvotesCount` (denormalized) ✅
- `isSolved`, `solvedAt`, `solvedCommentId`, `solvedBy` ✅
- `discussionSearchVector` (tsvector for FTS) ✅
- Temporal fields (`createdAt`, `updatedAt`, `deletedAt`) ✅

**DiscussionComment Entity**
- `commentId` (UUIDv7) ✅
- `threadId`, `authorId` (FKs) ✅
- `parentCommentId` (self-referential FK) ✅
- `body` (text) ✅
- `status` ('visible' | 'hidden' | 'deleted') ✅
- `repliesCount`, `votesCount`, `upvotesCount`, `downvotesCount` (denormalized) ✅
- Temporal fields ✅

**DiscussionVote Entity**
- Polymorphic via `targetType` + `targetId` ✅
- Single row per user per target (`uq_discussion_votes_user_target`) ✅

**DiscussionReport Entity**
- `reporterId`, `targetType`, `targetId` ✅
- `status` ('open' | 'reviewed' | 'dismissed' | 'actioned') ✅
- `reviewedByUserId`, `reviewedAt`, `actionTaken` ✅

### Aggregates

**Thread Aggregate** — Thread + Comments + Votes + Reports
- **Invariant**: Thread must be 'open' for comments/votes
- **Invariant**: Only author can delete/close/reopen
- **Invariant**: Only author can mark solved (enforced in service)

**Comment Aggregate** — Comment + Replies + Votes
- **Invariant**: Reply depth limited to 2 levels (NOT ENFORCED)
- **Invariant**: Comment author can delete
- **Invariant**: Moderators can hide/restore

### Repository Port Issues

**Issue 1**: Repository methods like `getUserVote` accept `targetType: 'thread' | 'comment' | 'reply'`, but `'reply'` is not a valid `DiscussionReportTargetType`. This creates a type-safe gap.

**Issue 2**: Port methods return various list item types that don't match response DTOs (e.g., `MyCommentListItem` lacks `author` field but API users need author info).

---

## API Review

### Endpoints

| Method | Path | Purpose | Issues |
|--------|------|---------|--------|
| GET | `/discussions/trending` | Trending threads | ⚠️ Cursor not forwarded |
| GET | `/discussions/unanswered` | Unanswered threads | ⚠️ Cursor not forwarded |
| GET | `/discussions/search` | Search threads | ⚠️ Cursor not forwarded |
| GET | `/discussions/threads` | List threads | ⚠️ Cursor not forwarded |
| POST | `/discussions/threads` | Create thread | ✅ |
| GET | `/discussions/threads/:id` | Get thread | ✅ |
| PUT | `/discussions/threads/:id` | Update thread | ✅ |
| DELETE | `/discussions/threads/:id` | Delete thread | ✅ |
| POST | `/discussions/threads/:id/subscribe` | Subscribe | ⚠️ No transaction |
| DELETE | `/discussions/threads/:id/subscribe` | Unsubscribe | ⚠️ No transaction |
| POST | `/discussions/threads/:id/save` | Save thread | ⚠️ No transaction |
| POST | `/discussions/threads/:id/comments` | Create comment | ✅ |
| GET | `/discussions/threads/:id/comments` | List comments | ❌ `parentCommentId` missing from DTO |
| POST | `/discussions/vote` | Vote | ✅ |
| DELETE | `/discussions/vote` | Remove vote | ⚠️ No domain event |
| GET | `/quizzes/:quizId/discussions` | Quiz threads | ✅ |
| GET | `/users/:userId/discussions` | User threads | ✅ |

### DTO Review

**CreateThreadDto** ✅
- Validates `quizId` as UUID v7
- `title` trimmed, 1-255 chars
- `body` trimmed, 1-10000 chars

**VoteDto** ⚠️
- Validates `targetType` against `DISCUSSION_REPORT_TARGET_TYPE` (only 'thread' | 'comment')
- But repository methods accept 'reply' — type inconsistency

**ListCommentsQueryDto** ❌
- Missing `parentCommentId` field
- Can't filter to view replies to a specific comment

**ListThreadsQueryDto** ⚠️
- Missing `isSolved` filter
- `cursor` field accepted but never used

### Implementation Leaks

1. **`listThreads` ignores cursor** — `cursor: query.cursor ?? null` passed to service but never forwarded to repository.

2. **`searchDiscussions` ignores cursor** — Same pattern, pagination broken.

3. **`listUnansweredDiscussions` ignores cursor** — Same pattern.

4. **`enrichComment` silently defaults author to empty string** — If JOIN fails, username becomes `''` instead of throwing.

---

## Concurrency Review

### Race Conditions Fixed (Fix #2)

**1. Comment Creation TOCTOU** ✅ FIXED

```typescript
// discussion.service.ts:821-847
await this.repo.transactionally(async (tx) => {
  const thread = await this.repo.getThreadByIdForUpdate(params.threadId, tx);
  // FOR UPDATE locks the row
  // ...validation...
  const created = await this.repo.createComment(params, tx);
  await this.repo.incrementThreadCommentCount(params.threadId, 1, tx);
});
```

**2. Vote Toggle TOCTOU** ✅ FIXED

```typescript
// discussion.service.ts:1031-1075
await this.repo.transactionally(async (tx) => {
  const thread = await this.repo.getThreadByIdForUpdate(targetId, tx);
  // FOR UPDATE + counter update in same transaction
});
```

**3. Comment Delete TOCTOU** ✅ FIXED

```typescript
// discussion.service.ts:950-968
await this.repo.transactionally(async (tx) => {
  const comment = await this.repo.getCommentByIdForUpdate(commentId, tx);
  // Lock + decrement + delete in same transaction
});
```

### Race Conditions Still Present

**4. Subscribe/Unsubscribe TOCTOU** ❌ UNFIXED

```typescript
// discussion.service.ts:349-372
async subscribeToThread(userId: string, threadId: string): Promise<{ success: true }> {
  const thread = await this.repo.getThreadById(threadId);  // ← Outside transaction
  if (!thread) throw new ThreadNotFoundError(threadId);
  // ...validation...
  await this.repo.subscribeToThread({ userId, threadId });  // ← Separate operation
}
```

- **Risk**: Thread deleted between check and subscribe
- **Impact**: Low — `onConflictDoNothing()` makes this idempotent
- **Fix**: Wrap in `transactionally()`

**5. Save/Unsave TOCTOU** ❌ UNFIXED

```typescript
// discussion.service.ts:389-412
async saveThread(userId: string, threadId: string): Promise<{ success: true }> {
  const thread = await this.repo.getThreadById(threadId);  // ← Outside transaction
  // ...validation...
  await this.repo.saveThread({ userId, threadId });  // ← Separate operation
}
```

- **Risk**: Same as subscribe
- **Fix**: Wrap in `transactionally()`

### Transaction Boundaries

| Operation | Transaction | FOR UPDATE | Issues |
|-----------|-------------|------------|--------|
| createThread | ❌ | ❌ | Thread created with quizId FK constraint |
| createComment | ✅ | ✅ | Correct |
| vote | ✅ | ✅ | Correct |
| removeVote | ✅ | ✅ | No event emitted |
| deleteComment | ✅ | ✅ | Correct |
| subscribeToThread | ❌ | ❌ | TOCTOU window |
| saveThread | ❌ | ❌ | TOCTOU window |
| hideThread | ❌ | ❌ | No counter mutation needed |

---

## Scalability Review

### Strengths

1. **Proper Partial Indexes**
   ```
   idx_discussion_threads_quiz_created WHERE deleted_at IS NULL
   idx_discussion_threads_author_created WHERE deleted_at IS NULL
   idx_discussion_threads_search_vector USING gin WHERE deleted_at IS NULL
   idx_discussion_threads_status_created WHERE deleted_at IS NULL
   ```

2. **CTE for Trending** — Single query pass for comment aggregates instead of correlated subqueries

3. **60-Second Cache for Trending Page 1** — `DiscussionRepository.TRENDING_CACHE_KEY` reduces repeated queries

4. **Cursor Pagination** — O(1) offset for large datasets

5. **Batch Cleanup for Orphaned Votes** — 1000-row batches in `deleteOrphanedVotes()`

### Concerns

1. **Denormalized Counters Can Drift** — Between soft-delete and reconciliation job (3:30 AM), vote/comment counts may be stale

2. **No Index on `repliesCount`** — `listComments` orders by `createdAt` but doesn't filter by reply depth

3. **Full Table Scan in Counter Reconciliation** — `reconcileDiscussionCounts()` scans entire `discussion_comments` table

4. **No Result Caching for Search** — Search results computed fresh every request, no Redis cache

5. **`findRelatedThreads` Complex CTE** — Multiple CTEs with self-joins could be slow on large datasets

---

## Maintainability Review

### Strengths

1. **Consistent File Layout** — Matches project structure (`domain/`, `application/`, `infrastructure/`, `transport/`)

2. **Clear Port Interfaces** — Symbol-typed ports for cross-module integration

3. **Detailed Inline Comments** — Fix #2 explanations, `FOR UPDATE` documentation

4. **Structured Logging** — Event-based logging with correlation IDs

5. **Cursor Mapper Classes** — `QuizDiscussionCursorMapper`, `TrendingDiscussionCursorMapper`, etc.

### Concerns

1. **Minimal Test Coverage** — Only 1 spec file for 80+ file module
   - Missing: repository specs, service specs, controller specs, integration tests
   - Critical paths untested: cursor pagination, soft delete, vote toggle

2. **No Spec for Counter Reconciliation** — `DiscussionCleanupService` has no tests

3. **5 Different Cursor Mapper Classes** — Duplication could be reduced with generic base

4. **`enrichComment` Silent Fallback** — Empty string for missing author hides data issues

5. **Hard-coded Magic Numbers** — `MAX_REPLIES_PER_COMMENT = 100` defined but never validated

---

## Architecture Consistency Review

### vs. Project Architecture

| Aspect | Project Rule | Discussion Module | Status |
|--------|-------------|------------------|--------|
| Layer Order | transport → application → domain → infrastructure | ✅ Follows | ✅ |
| DI Tokens | `Symbol('<module>_<port>')` | ✅ Correct | ✅ |
| Scheduler Location | `infrastructure/scheduler/` | ✅ Correct | ✅ |
| Domain Events | `domain/events/<name>.events.ts` | ✅ Correct | ✅ |
| Repository Port | `domain/ports/<x>-repository.port.ts` | ✅ Correct | ✅ |
| Soft Delete | `deletedAt` column | ✅ Correct | ✅ |
| Transaction Boundary | `@Transactional()` + `FOR UPDATE` | ⚠️ Gap in subscribe/save | ⚠️ |
| Error Hierarchy | `BaseDomainException` | ✅ Correct | ✅ |
| Pagination | Cursor-based | ⚠️ Cursors broken | ⚠️ |
| Test Coverage | Spec co-located | ❌ Minimal | ❌ |

### Cross-Module Dependencies

```
Discussion Module
├── Imports: QUIZ_EXISTENCE_PORT (from QuizModule)
├── Imports: USER_EXISTENCE_PORT (from UserModule)
├── Exports: DISCUSSION_DOMAIN_EVENT_BUS
│   └── Consumed by: NotificationModule (DiscussionNotificationListener)
└── Exports: DISCUSSION_REPOSITORY_PORT
    └── Consumed by: NotificationModule (for subscriber lookups)
```

**Dependency Direction Correct** ✅ — Discussion module is a spoke that imports from quiz/user and exports events to notification hub.

---

## Missing Product Capabilities

### Required Fix (Block Production)

1. **Reply Depth Limit Not Enforced**
   - **Evidence**: `MAX_REPLIES_PER_COMMENT = 100` constant exists in repository but `createComment()` never validates it
   - **Impact**: Users can exceed the 2-level hierarchy documented
   - **Fix**: Add reply depth validation in `createComment()` before insert

2. **Cursor Pagination Broken**
   - **Evidence**: `listThreads()`, `searchDiscussions()`, `listUnansweredDiscussions()` accept cursor but never forward to repository
   - **Impact**: Pagination returns duplicate/inconsistent results on subsequent pages
   - **Fix**: Forward cursor to `this.discussionService.listThreads()` and repository

3. **No Domain Event on Vote Removal**
   - **Evidence**: `removeVote()` updates counters but emits no event
   - **Impact**: Notification pipeline misses un-vote events
   - **Fix**: Emit `vote_removed` event in `removeVote()`

4. **Subscribe/Save Race Conditions**
   - **Evidence**: `subscribeToThread()` and `saveThread()` read thread outside transaction
   - **Impact**: TOCTOU window between existence check and write
   - **Fix**: Wrap in `transactionally()` with `FOR UPDATE`

### Product Discussion

1. **Missing `isSolved` Filter** — Should users be able to filter threads by solved status?

2. **Missing `parentCommentId` in ListComments** — Should the API support viewing replies to a specific comment?

3. **Silent Author Fallback** — `enrichComment()` returns empty string for missing author. Should this fail loudly?

4. **Notification on Vote Change** — Currently vote change (up→down) doesn't emit event. Should authors be notified?

### Future Product

1. **Thread Pinning** — Documented in future extension points
2. **Moderation Appeals** — Documented in future extension points
3. **Rich Text / Markdown** — Documented for comment bodies

### YAGNI

1. **`reply` Target Type** — Repository accepts `'reply'` but `DiscussionReportTargetType` doesn't include it. Dead code or planned feature?

---

## Final Verdict

| Recommendation | Decision | Rationale |
|----------------|----------|-----------|
| Reply depth validation | **Merge Immediately** | Required by documentation, currently unenforced |
| Cursor pagination fixes | **Merge Immediately** | Data consistency issue, returns wrong results |
| Vote removal events | **Merge Immediately** | Breaks event-driven notification pipeline |
| Subscribe/save transactions | **Merge Immediately** | TOCTOU race condition present |
| `reply` target type cleanup | **Product Discussion** | Unknown if intentional or dead code |
| `isSolved` filter | **Future Roadmap** | Nice-to-have, not documented requirement |
| Test coverage expansion | **Merge Immediately** | Cannot ship to production without minimum coverage |

---

## Implementation Plan

### Phase 1: Critical Bug Fixes (Required Before Production)

**Goal:** Fix blocking bugs that produce incorrect results or violate documented invariants

**Items:**

1. **Fix cursor pagination**
   - File: `src/modules/discussion/application/discussion-application.service.ts`
   - Methods: `listThreads()`, `searchDiscussions()`, `listUnansweredDiscussions()`
   - Forward `cursor` parameter to domain service

2. **Add reply depth validation**
   - File: `src/modules/discussion/domain/services/discussion.service.ts`
   - Method: `createComment()`
   - Query `discussionComments` to count replies by `parentCommentId`
   - Throw error if >= 100

3. **Add vote removal events**
   - File: `src/modules/discussion/domain/events/discussion-domain.events.ts`
   - Add `VoteRemovedEvent` interface
   - File: `src/modules/discussion/domain/events/discussion-domain.event-bus.ts`
   - Add `emitVoteRemoved()` method
   - File: `src/modules/discussion/domain/services/discussion.service.ts`
   - Emit event in `removeVote()`

4. **Wrap subscribe/save in transactions**
   - File: `src/modules/discussion/domain/services/discussion.service.ts`
   - Methods: `subscribeToThread()`, `saveThread()`
   - Use `this.repo.transactionally()` with `FOR UPDATE`

5. **Add repository specs for pagination**
   - File: `src/modules/discussion/infrastructure/repositories/discussion.repository.spec.ts`
   - Test: cursor decoding/encoding for all cursor types
   - Test: limit+1 pattern for `hasNextPage`

**Dependencies:** None (isolated fixes)

**Risks:** Low — targeted changes

**Exit Criteria:** All pagination endpoints return correct next-page results, reply depth enforced, vote events emitted

---

### Phase 2: Test Coverage

**Goal:** Achieve minimum viable test coverage

**Items:**

1. **Add `DiscussionService` specs**
   - File: `src/modules/discussion/domain/services/discussion.service.spec.ts`
   - Test: createThread with invalid quiz
   - Test: createComment with closed thread
   - Test: vote toggle (up→down)
   - Test: self-vote prevention

2. **Add `DiscussionApplicationService` specs**
   - File: `src/modules/discussion/application/discussion-application.service.spec.ts`
   - Test: pagination result transformation
   - Test: cursor serialization/deserialization

3. **Add controller specs**
   - File: `src/modules/discussion/transport/controller/discussion.controller.spec.ts`
   - Test: endpoint routing
   - Test: DTO validation

4. **Add `DiscussionCleanupService` specs**
   - File: `src/modules/discussion/infrastructure/scheduler/discussion-cleanup.service.spec.ts`
   - Test: orphan vote cleanup
   - Test: counter reconciliation

**Dependencies:** Phase 1 (pagination fixes in place)

**Risks:** Medium — tests may reveal additional bugs

**Exit Criteria:** Core paths covered by unit tests

---

### Phase 3: Documentation Cleanup

**Goal:** Align documentation with implementation

**Items:**

1. **Clarify `reply` target type** — Is `'reply'` intentional or dead code?
2. **Document `parentCommentId` filter status** — Planned or not implemented?
3. **Update module documentation** — Add note about pending reply depth enforcement

**Dependencies:** Phase 1

**Exit Criteria:** Documentation reflects actual behavior

---

## Dependency Analysis

### Phase Dependencies

```
Phase 1 (Critical Fixes)
│
├── Fix cursor pagination
├── Add reply depth validation
├── Add vote removal events
└── Wrap subscribe/save in transactions
        │
        ▼
Phase 2 (Test Coverage)
│
├── Service specs
├── Controller specs
└── Cleanup service specs
        │
        ▼
Phase 3 (Documentation)
│
└── Align docs with implementation
```

### Critical Path

1. **Cursor Fix → Pagination Correctness** — Cannot ship with broken pagination
2. **Reply Depth → Invariant Enforcement** — Documented requirement not enforced
3. **Transaction Fix → Data Consistency** — TOCTOU windows present in subscribe/save

### Parallel Work

- Phase 1 items 1-4 can be executed in parallel (independent fixes)
- Phase 2 specs can be written in parallel across team members
- Phase 3 independent after Phase 1

### Deferred Work

1. **`isSolved` filter** — Nice-to-have, not documented requirement
2. **Analytics/caching for search** — Only needed at scale
3. **Thread pinning** — Future extension point

---

## Summary of Required Fixes

| Priority | Issue | Location | Impact |
|----------|-------|----------|--------|
| P0 | Cursor not forwarded | `discussion-application.service.ts` | Pagination broken |
| P0 | Reply depth not validated | `discussion.service.ts` | Invariant violation |
| P0 | No vote removal event | `discussion.service.ts` | Notification gap |
| P0 | Subscribe/save no transaction | `discussion.service.ts` | Race condition |
| P1 | `reply` target type mismatch | `types/index.ts` vs repository | Type inconsistency |
| P1 | `parentCommentId` missing from DTO | `ListCommentsQueryDto` | Can't filter replies |
| P2 | Minimal test coverage | Module-wide | Quality risk |

---

## Evidence References

### Source Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `src/modules/discussion/application/discussion-application.service.ts` | 644 | Application orchestration |
| `src/modules/discussion/domain/services/discussion.service.ts` | 1191 | Domain logic |
| `src/modules/discussion/infrastructure/repositories/discussion.repository.ts` | 2037 | Data access |
| `src/modules/discussion/transport/controller/discussion.controller.ts` | 586 | HTTP endpoints |
| `src/modules/discussion/transport/controller/quiz-discussion.controller.ts` | 40 | Quiz-scoped endpoints |
| `src/modules/discussion/transport/controller/user-discussion.controller.ts` | 174 | User-scoped endpoints |
| `src/modules/discussion/transport/presenters/discussion.presenter.ts` | 108 | Response formatting |
| `src/modules/discussion/domain/events/discussion-domain.events.ts` | 147 | Domain events |
| `src/modules/discussion/domain/types/index.ts` | 376 | Domain types |
| `src/modules/discussion/domain/ports/index.ts` | 256 | Port interfaces |
| `src/modules/discussion/domain/errors/index.ts` | 185 | Domain exceptions |
| `src/modules/discussion/domain/policies/discussion-authorization.policy.ts` | 23 | Authorization policy |
| `src/modules/discussion/infrastructure/scheduler/discussion-cleanup.service.ts` | 187 | Cleanup scheduler |
| `src/modules/discussion/dto/request/create-thread.dto.ts` | 38 | Thread creation DTO |
| `src/modules/discussion/dto/request/vote.dto.ts` | 48 | Vote DTOs |
| `src/core/database/schema/discussion/schema.ts` | 416 | Database schema |
| `src/modules/discussion/discussion.module.ts` | 52 | Module definition |
| `docs/modules/discussion.md` | 143 | Module documentation |

### Key Code References

**Cursor Pagination Bug (discussion-application.service.ts:97-114)**
```typescript
async listThreads(filters: {...}): Promise<PaginatedResult<DiscussionThread>> {
  const { items, hasNextPage } = await this.discussionService.listThreads(filters);
  // cursor is in filters but never passed to service
  return paginated(items, {...});
}
```

**Reply Depth Missing (discussion.service.ts:812-847)**
```typescript
async createComment(params: CreateCommentParams): Promise<DiscussionComment> {
  const result = await this.repo.transactionally(async (tx) => {
    const thread = await this.repo.getThreadByIdForUpdate(params.threadId, tx);
    // No check for parentCommentId reply count >= 100
    const created = await this.repo.createComment(params, tx);
    // ...
  });
}
```

**Vote Removal No Event (discussion.service.ts:1080-1112)**
```typescript
async removeVote(params: {...}): Promise<void> {
  await this.repo.transactionally(async (tx) => {
    // Updates counters...
    await this.repo.removeVote({ userId, targetType, targetId }, tx);
  });
  // No this.eventBus.emitVoteRemoved() call
}
```

**Subscribe No Transaction (discussion.service.ts:349-372)**
```typescript
async subscribeToThread(userId: string, threadId: string): Promise<{ success: true }> {
  const thread = await this.repo.getThreadById(threadId);  // Outside transaction
  if (!thread) throw new ThreadNotFoundError(threadId);
  await this.repo.subscribeToThread({ userId, threadId });
  return { success: true };
}
```

**MAX_REPLIES Defined But Not Enforced (discussion.repository.ts:54)**
```typescript
export const MAX_REPLIES_PER_COMMENT = 100;

// Never used in createComment validation
```
