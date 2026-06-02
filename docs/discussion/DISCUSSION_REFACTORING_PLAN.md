# Discussion Domain — Refactoring Plan

> Review date: 2026-06-02
> Current score: **6.4 / 10**

---

## 1. What Is Good

### Schema
- Four clean tables: `discussion_threads`, `discussion_comments`, `discussion_votes`, `discussion_reports`.
- Denormalized `upvotesCount`/`downvotesCount`/`commentsCount`/`repliesCount` on threads and comments — correct for read-heavy discussion pages.
- Soft-delete with `deletedAt` + `status` dual-gate preserves audit trail while preventing accidental data exposure.
- `onDelete('cascade')` on FKs keeps referential integrity clean.

### Vote Logic
- Three-way branch (same vote → remove, different vote → flip, no vote → add) is correct.
- Delta math in the flip branch is accurate.
- Vote denormalization updates are batched in the same method as the upsert.

### Domain Boundary
- Discussion Domain correctly owns threads, comments, votes, and reports.
- Read-only cross-boundary touches (`quizzes` for existence check, `users`/`userProfiles` for author enrichment) are low-risk.
- No ownership of User, Quiz, Notification, or Social concerns.

### Architecture
- Layered architecture (Application → Domain → Repository) is consistent with Social, Quiz, and Ranking modules.
- Error taxonomy is appropriate: 12 specific error classes covering not-found, forbidden, state-conflict, and duplicate cases.
- Thread lifecycle is well-scoped: author can create/update/delete/close/reopen; moderators can hide.
- Domain events now enable Notification integration (Phase 3).
- `QuizExistencePort` decouples Discussion from Quiz schema (Phase 3).

---

## 2. What Is Missing

| Issue | Location | Severity | Status |
|---|---|---|---|
| No moderator review endpoint | Controller (missing route) | High | ✅ Fixed |
| No pagination on `listReports` | Controller (missing route) | Medium | ✅ Fixed (Phase 3) |
| No rate limiting on vote/report endpoints | Controller | Medium | ✅ Fixed (Phase 2) |
| No input validation on request DTOs | Controller (uses inline body objects) | High | ✅ Fixed (Phase 1) |
| No author enrichment on `createComment` return | Repository | Low | Pending |
| Hardcoded `limit: 100` in `getThreadDetail` replies | Repository | Medium | ✅ Fixed (Phase 3) |
| N+1 query in `getCommentReplies` | Repository | Medium | ✅ Fixed (Phase 3) |
| No domain events (blocks Notification integration) | Domain service | Medium | ✅ Fixed (Phase 3) |
| `reviewReport` has no authorization check | Domain service | Medium | ✅ Fixed (Phase 1) |
| Cross-module `quizzes` queried without port | Domain service | Low | ✅ Fixed (Phase 3) — `QuizExistencePort` added |

---

## 3. What Is Unnecessary

| Item | Location | Action | Status |
|---|---|---|---|
| `DuplicateVoteError` | `domain/errors/index.ts` | Removed — toggle mechanic absorbs it; error was never thrown | ✅ Removed |
| `ThreadAlreadyExistsError` | `domain/errors/index.ts` | Removed — no service threw it; unique constraint could be added separately if needed | ✅ Removed |
| `DuplicateReportError` dead code | `domain/errors/index.ts` | Fixed — `uq_discussion_reports_reporter_target` constraint added in Phase 1 so the `isPostgresUniqueViolation` check now fires correctly | ✅ Fixed |
| `reviewReport` no-op authorization | Domain service | Fixed — endpoint now exists with `@Permissions` guard (Phase 1) | ✅ Fixed |
| `deleteComment` no thread status check | Domain service | Intentionally asymmetric — deleting should be allowed on closed threads | Kept as-is |
| `Patch` unused import | Controller | Removed in Phase 1 | ✅ Removed |
| Redundant `quizId` spread | App service `listThreads` | Removed in Phase 1 | ✅ Removed |
| `isThreadAuthor` and `isCommentAuthor` | Repository port + impl | Removed | ✅ Removed |

## 4. Consistency Issues

| Issue | Gap vs Other Modules | Status |
|---|---|---|
| No request DTOs | Social, Quiz use `dto/request/*.dto.ts` with `class-validator` + `@ApiProperty`. | ✅ Fixed (Phase 1) |
| No Swagger decorators | All other modules use `@ApiTags`, `@ApiOperation`, `@ApiCreatedResponse`, `@ApiOkResponse`. | ✅ Fixed (Phase 1) |
| No `events/` directory | Social, Achievement, Quiz all have `domain/events/` with event interfaces + in-process event bus. | Pending (Phase 3) |
| No cross-module port abstraction | Social injects `UserSearchPort` and `RankingPort` via adapters. Discussion imports `quizzes` schema directly. | Pending (Phase 3) |
| No moderator guard on `hideThread` / `hideComment` | Social uses `@Permissions('admin', 'moderator')` on restricted routes. | ✅ Fixed (Phase 1) |

---

## 5. Technical Debt

### Severity: High

1. ~~**`hideComment` is a no-op.**~~ Fixed in Phase 1 — now calls `repo.updateCommentStatus`.

2. ~~**`discussion_reports` has no unique constraint on `(reporter_id, target_type, target_id)`.**~~ Fixed in Phase 1 — `uq_discussion_reports_reporter_target` added to schema.

3. ~~**`listReports` is unreachable.**~~ Fixed in Phase 3 — `GET /discussions/reports` moderator route added.

### Severity: Medium

4. ~~**N+1 query in `getCommentReplies`.**~~ Fixed in Phase 3 — `getRepliesByParentIds` batches all replies in a single `inArray` query.

5. ~~**Hardcoded `limit: 100` in `getThreadDetail` for replies.**~~ Fixed in Phase 3 — `MAX_REPLIES_PER_COMMENT` constant used throughout.

6. ~~**No rate limiting on vote/report endpoints.**~~ Fixed in Phase 2.

7. ~~**Missing `@Permissions` guard on moderator actions.**~~ Fixed in Phase 1.

8. **`updateThread` has no guard against empty title/body.** The DB schema check `btrim(title) > 0` catches it, but returns a generic constraint error. Low priority — the request DTOs added in Phase 1 help at the input layer.

### Severity: Low

9. ~~**`DuplicateVoteError` and `ThreadAlreadyExistsError` are dead code.**~~ Removed in Phase 2.

10. ~~**`Patch` import unused** in controller.~~ Removed in Phase 1.

11. **`updateTargetVotes` takes `targetType: string`** instead of the union type — loses type safety on the if/else dispatch.

12. **`enrichThread` and `enrichComment` use `as` casts** on every row field. Consistent with `SocialRepository` pattern — acceptable.

13. ~~**Cross-module `quizzes` queried without port.**~~ Fixed in Phase 3 — `QuizExistencePort` introduced.

14. **No author enrichment on `createComment` return.** The returned `DiscussionComment` has `authorId` but no enriched `author` object. `enrichComment` is called in `createComment` which joins author data, so the DTO should be populated. Verify before treating as debt.

---

## 6. Recommended Improvements

### Priority 1 — Fix Breaking Gaps (do before production)

- [x] Add request DTOs with `class-validator` decorators for all controller endpoints
- [x] Implement `hideComment` (add single `updateCommentStatus` repo call)
- [x] Add moderator review route: `POST /discussions/reports/:reportId/review` with `@Permissions('admin', 'moderator')`
- [x] Add unique constraint on `discussion_reports(reporter_id, target_type, target_id)` — `uq_discussion_reports_reporter_target` added to schema

### Priority 2 — Consistency Parity (1 day)

- [x] Add Swagger decorators (`@ApiTags`, `@ApiProperty`, `@ApiOperation`, `@ApiResponse`) to all controller methods
- [x] Remove dead code: `DuplicateVoteError`, `ThreadAlreadyExistsError`, unused helpers (`isThreadAuthor`, `isCommentAuthor`)
- [x] Remove unused `Patch` import from controller
- [x] Add `@Throttle` rate limiting to vote and report endpoints
- [x] Add `@Permissions('admin', 'moderator')` guard to `hideThread`, `hideComment`, review route

### Priority 3 — Performance and Extensibility (2–3 days)

- [ ] Fix N+1 in `getCommentReplies` by joining author data inline (same pattern as `listComments`)
- [ ] Replace hardcoded `limit: 100` with a named constant (`MAX_REPLIES_PER_COMMENT`)
- [ ] Add domain events directory (`comment_created`, `reply_created`, `thread_closed`, `content_reported`) — required before Notification integration
- [ ] Introduce `QuizExistencePort` to decouple from direct `quizzes` schema import
- [ ] Add moderator list route: `GET /discussions/reports` with status filter and cursor pagination

---

## 7. MVP Readiness Assessment

| Dimension | Score | Notes |
|---|---|---|
| Architecture Quality | 9/10 | Domain events and `QuizExistencePort` now in place. Missing: `CommentExistencePort` (for replies), notification integration subscriber. |
| Domain Boundaries | 9/10 | `QuizExistencePort` decouples from quizzes table. Events enable Notification integration. |
| Maintainability | 9/10 | Dead code removed, request DTOs, Swagger, consistent patterns throughout. |
| Scalability | 8/10 | N+1 fixed with batch fetch. Denormalized counts correct. Vote toggle O(1). Constant replaces hardcoded limit. |
| Consistency with Codebase | 10/10 | Domain events, port pattern, adapters — fully consistent with Social, Achievement, and Quiz modules. |
| Security | 9/10 | `@Permissions` guards, `@Throttle`, unique constraints, input validation all in place. |

**All phases complete. Overall: 9.0 / 10**

---

## 8. Refactoring Phases

### Phase 1 — Fix Breaking Gaps

**Time estimate: 1–2 days**

| # | Task | Status | Files |
|---|---|---|---|
| 1.1 | Add request DTOs with `class-validator` for all endpoints | ✅ Done | `dto/request/create-thread.dto.ts`, `update-thread.dto.ts`, `create-comment.dto.ts`, `update-comment.dto.ts`, `vote.dto.ts`, `report.dto.ts`, `review-report.dto.ts`, `list-query.dto.ts`, `dto/request/index.ts` |
| 1.2 | Implement `hideComment` in domain service | ✅ Done | `domain/services/discussion.service.ts`, `domain/ports/index.ts`, `infrastructure/repositories/discussion.repository.ts` |
| 1.3 | Add `POST /discussions/reports/:reportId/review` route with role guard | ✅ Done | `transport/controller/discussion.controller.ts` |
| 1.4 | Add unique constraint to `discussion_reports` | ✅ Done | `core/database/schema/index.ts` |

### Phase 2 — Consistency Parity

**Time estimate: 1 day**

| # | Task | Status | Files |
|---|---|---|---|
| 2.1 | Add Swagger decorators to all controller methods | ✅ Done | `transport/controller/discussion.controller.ts` |
| 2.2 | Remove dead code: `DuplicateVoteError`, `ThreadAlreadyExistsError`, `isThreadAuthor`, `isCommentAuthor` | ✅ Done | `domain/errors/index.ts`, `domain/ports/index.ts`, `infrastructure/repositories/discussion.repository.ts` |
| 2.3 | Remove unused `Patch` import and redundant `quizId` spread | ✅ Done | `transport/controller/discussion.controller.ts`, `application/discussion-application.service.ts` |
| 2.4 | Add `@Throttle` to vote/report endpoints | ✅ Done | `transport/controller/discussion.controller.ts` |
| 2.5 | Add `@Permissions` guard to moderator actions | ✅ Done | `transport/controller/discussion.controller.ts` |

### Phase 3 — Performance and Extensibility

**Time estimate: 2–3 days**

| # | Task | Status | Files |
|---|---|---|---|
| 3.1 | Fix N+1 in `getCommentReplies` — batch-fetch replies with `getRepliesByParentIds` using `inArray` | ✅ Done | `infrastructure/repositories/discussion.repository.ts` |
| 3.2 | Replace `limit: 100` with `MAX_REPLIES_PER_COMMENT` constant | ✅ Done | `infrastructure/repositories/discussion.repository.ts` |
| 3.3 | Add domain events: `discussion-domain.events.ts`, `discussion-event-bus.port.ts`, `discussion-domain.event-bus.ts` | ✅ Done | `domain/events/` |
| 3.4 | Emit events from service: `comment_created`, `reply_created`, `content_reported`, `thread_closed`, etc. | ✅ Done | `domain/services/discussion.service.ts` |
| 3.5 | Add `GET /discussions/reports` moderator route with pagination | ✅ Done | `transport/controller/discussion.controller.ts`, `application/discussion-application.service.ts`, `domain/services/discussion.service.ts`, `dto/request/list-reports-query.dto.ts`, `dto/response/index.ts` |
| 3.6 | Add `QuizExistencePort` for `checkQuizExists` abstraction | ✅ Done | `domain/ports/quiz-existence.port.ts`, `infrastructure/adapters/quiz-existence.adapter.ts`, `discussion.module.ts` |

---

*Last reviewed: 2026-06-02 — All phases complete*
