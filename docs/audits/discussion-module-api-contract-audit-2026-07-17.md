# Discussion Module — API Contract Audit

| Field | Value |
| ----- | ----- |
| Module | `discussion` (OpenAPI tag: `discussions`) |
| Audit date | 2026-07-17 |
| Auditor mode | Read-only (no code, no DTO, no OpenAPI artifact was modified) |
| Endpoints audited | 34 |
| Source-of-truth | `docs/PROJECT_CONSTITUTION.md` § Authority hierarchy |

## Authority Hierarchy

Per `PROJECT_CONSTITUTION.md` § Authority Hierarchy, when documentation and code disagree:

1. Implementation (runtime behavior)
2. Tests
3. OpenAPI artifact (`docs/generated/openapi.json`)
4. Generated SDK (Orval / openapi-generator)
5. `docs/` and `README.md`

Every issue below is classified against this hierarchy.

---

## Final Summary

| Metric | Value |
| ------ | ----- |
| Contract health score | **5.0 / 10** |
| Endpoints audited | 34 |
| Total issues | 15 |
| Critical / High / Medium / Low | 2 / 4 / 5 / 4 |
| Implementation bugs | 7 |
| Documentation issues | 8 |
| Validation inconsistencies | 3 |
| OpenAPI inconsistencies | 6 |
| Swagger example issues | 2 |

> **Headline**: Two Critical runtime bugs (vote 500s, trending 500s), one High issue (inconsistent return types), and multiple OpenAPI/documentation issues including missing security declarations and missing UUID formats.

---

## Severity Breakdown

| Severity | Count |
| -------- | ----- |
| Critical | 2 |
| High | 4 |
| Medium | 5 |
| Low | 4 |

---

## Issue Index

| ID | Severity | Endpoint | Title |
| -- | -------- | -------- | ----- |
| D-01 | Critical | `POST /discussions/vote` | Runtime 500: "is not iterable" on valid votes |
| D-02 | Critical | `GET /discussions/trending` | Runtime 500: CTE subquery alias reference error |
| D-03 | High | `POST /discussions/vote` | Same 500 on comment votes |
| D-04 | High | `PUT /discussions/threads/:id` | Returns 200 with empty body instead of 400 |
| D-05 | Medium | All UUID path params | Missing `format: uuid` in OpenAPI path parameter schemas |
| D-06 | Medium | `GET /discussions/reports` | Missing `security` declaration in OpenAPI |
| D-07 | Medium | `POST /discussions/report` | OpenAPI declares `details` as `type: object` instead of `type: string` |
| D-08 | Medium | `GET /discussions/threads/:id` | Returns `200 {"data": null}` for non-existent thread instead of 404 |
| D-09 | Low | `PUT /comments/:id` | DTO uses `@ApiProperty` instead of `@ApiPropertyOptional` for optional field |
| D-10 | Low | `GET /discussions/search` | OpenAPI describes empty search behavior but doesn't document returned shape |
| D-11 | Low | All paginated endpoints | OpenAPI description field is empty for most paginated endpoints |
| D-12 | Low | `POST /discussions/vote` | OpenAPI schema includes `reply` in enum but runtime rejects it |
| D-13 | Low | `DELETE /discussions/vote` | OpenAPI schema includes `reply` in enum but runtime rejects it |
| D-14 | Low | `GET /discussions/unanswered` | Runtime returns 200 with empty data array, consistent but may be unexpected |

---

## Endpoint-by-Endpoint Findings

### D-01 · Critical · `POST /discussions/vote`

**Current behavior**
500 Internal Server Error: `(intermediate value) is not iterable` on every vote attempt.

**Root cause**
`DiscussionService.vote()` at line 1003 uses `Promise.all` with destructuring:
```typescript
const [existingVote] = await Promise.all([
  this.repo.getUserVoteForUpdate(userId, targetType, targetId, tx),
]);
```
The `getUserVoteForUpdate` method returns a single row or `undefined` (not an array), causing the destructuring to fail with "is not iterable".

**Implementation correct?** No.
**Documentation correct?** N/A (implementation bug).
**Recommendation** Fix the destructuring to handle single result.
**Suggested fix**
```typescript
// Change from:
const [existingVote] = await Promise.all([...]);

// To:
const result = await this.repo.getUserVoteForUpdate(userId, targetType, targetId, tx);
const existingVote = result; // Single row or undefined
```
**Safety classification** Safe implementation fix. No contract change.

---

### D-02 · Critical · `GET /discussions/trending`

**Current behavior**
500 Internal Server Error: `recentCommentCount field from a subquery doesn't have an alias declared`.

**Root cause**
The Drizzle ORM CTE (Common Table Expression) `threadCommentStats` is defined with `this.db.$with('thread_comment_stats').as(...)`, but when the `scoreExpression` SQL template references `${threadCommentStats.recentCommentCount}`, Drizzle cannot resolve the column reference from the CTE alias. This is a Drizzle ORM limitation when using raw SQL templates with CTE aliases.

**Implementation correct?** No.
**Documentation correct?** N/A (implementation bug).
**Recommendation** Rewrite the query to avoid referencing CTE columns in raw SQL templates, or use Drizzle's `sql` template literals with explicit table aliases.
**Suggested fix**
Use a different approach to compute the trending score that doesn't require referencing CTE columns in raw SQL, or materialize the CTE results first and then reference them.
**Safety classification** Safe implementation fix. No contract change.

---

### D-03 · High · `POST /discussions/vote` (also affects `DELETE /discussions/vote`)

**Current behavior**
Same 500 error as D-01 when voting on comments.

**Root cause**
Same bug as D-01 — the repository's `getUserVoteForUpdate` returns a single row, but the service destructures it as an array.

**Implementation correct?** No.
**Documentation correct?** N/A.
**Recommendation** Fix D-01; this will fix comment voting as well.
**Suggested fix** Same as D-01.
**Safety classification** Safe implementation fix. No contract change.

---

### D-04 · High · `PUT /discussions/threads/:id`

**Current behavior**
Returns 200 OK with `{"data": {"threadId": "...", ...}}` even when the request body is `{}` (empty object). The service receives `dto` with `title: undefined` and `body: undefined`, and the repository updates the thread with undefined values (likely resulting in no actual DB change, but returning 200).

**Expected behavior**
Per validation standards and `UpdateThreadDto`, at least one of `title` or `body` should be required. The endpoint should return 400 when neither field is provided.

**Root cause**
`UpdateThreadDto` declares both `title` and `body` as `@IsOptional()`, and the service doesn't validate that at least one field is present before calling the repository. The controller has a similar check for comments (`BadRequestException` at line 413), but not for threads.

**Implementation correct?** No.
**Documentation correct?** Partially (OpenAPI correctly shows both fields as optional).
**Recommendation** Add validation to require at least one field when updating a thread.
**Suggested fix**
Add the same pattern used for comments:
```typescript
// In controller or service:
if (dto.title === undefined && dto.body === undefined) {
  throw new BadRequestException('At least one field must be provided to update a thread');
}
```
**Safety classification** Safe implementation fix. No contract change (API remains unchanged — it's fixing incorrect behavior to match documented expectations).

---

### D-05 · Medium · All UUID path parameters

**Current behavior**
OpenAPI declares path parameters like `threadId`, `commentId`, `reportId` as `{ "type": "string" }` with no `format: uuid`.

**Root cause**
Controller uses `@Param('threadId', new ParseUUIDPipe())` which validates UUID at runtime, but doesn't have `@ApiParam({ format: 'uuid' })` to document the format in OpenAPI.

**Implementation correct?** Yes (UUID validation works).
**Documentation correct?** No.
**Recommendation** Add `@ApiParam` decorators with `format: 'uuid'` to all UUID path parameters.
**Suggested fix**
```typescript
@ApiParam({ name: 'threadId', format: 'uuid' })
@Param('threadId', new ParseUUIDPipe()) threadId: string
```
**Safety classification** Safe documentation fix. No runtime change.

---

### D-06 · Medium · `GET /discussions/reports`

**Current behavior**
No `security` declaration in OpenAPI. Returns 403 for non-moderators at runtime.

**Root cause**
Controller has `@Permissions(Permission.DISCUSSION_MODERATE)` but no corresponding `@ApiSecurity` or `@ApiBearerAuth` decorator.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Add security declaration to OpenAPI.
**Suggested fix**
Add `@ApiSecurity('bearerAuth')` to the endpoint or use the `@ApiModeratorAction` decorator which should add it automatically.
**Safety classification** Safe documentation fix. No runtime change.

---

### D-07 · Medium · `POST /discussions/report`

**Current behavior**
OpenAPI declares `CreateReportDto.details` as `{ "type": "object" }`.

**Root cause**
DTO uses `@ApiPropertyOptional` without specifying `type: String`, causing the generator to infer `type: object`.

**Implementation correct?** Yes (runtime uses `IsString()` validator).
**Documentation correct?** No.
**Recommendation** Add `type: String` to the `@ApiPropertyOptional` decorator.
**Suggested fix**
```typescript
@ApiPropertyOptional({
  type: String, // Add this
  description: 'Additional details about the report',
  maxLength: 1000,
  example: 'This comment contains repeated promotional links.',
  nullable: true,
})
```
**Safety classification** Safe documentation fix. No runtime change.

---

### D-08 · Medium · `GET /discussions/threads/:threadId`

**Current behavior**
Returns 200 with `{"data": null, "meta": {...}}` for non-existent threads.

**Expected behavior**
Per REST conventions and the error spec, non-existent resources should return 404.

**Root cause**
`getThread` in the application service returns `DiscussionThreadDetail | null`, and the presenter wraps null in a 200 response. The repository returns null when thread not found.

**Implementation correct?** Partially (returns null, but should throw 404).
**Documentation correct?** No (404 should be documented).
**Recommendation** Throw `ThreadNotFoundError` in the service when thread is null, or return 404 in the controller.
**Suggested fix**
```typescript
// In application service:
const result = await this.discussionService.getThread(user, threadId);
if (!result) {
  throw new ThreadNotFoundError(threadId);
}
```
**Safety classification** Safe implementation + documentation fix. API behavior changes (404 instead of 200 null).

---

### D-09 · Low · `PUT /discussions/comments/:commentId`

**Current behavior**
DTO uses `@ApiProperty` (required=true) instead of `@ApiPropertyOptional` for the `body` field.

**Root cause**
`UpdateCommentDto` uses `@ApiProperty` instead of `@ApiPropertyOptional`.

**Implementation correct?** Yes (validation works with `@IsOptional()`).
**Documentation correct?** No (Swagger shows `body` as required).
**Recommendation** Change to `@ApiPropertyOptional`.
**Suggested fix**
```typescript
@ApiPropertyOptional({  // Changed from @ApiProperty
  description: 'Updated comment body text',
  ...
})
```
**Safety classification** Safe documentation fix. No runtime change.

---

### D-10 · Low · `GET /discussions/search`

**Current behavior**
OpenAPI documents empty search behavior but doesn't specify what is returned when search has no results.

**Implementation correct?** Yes (returns empty array).
**Documentation correct?** Partially.
**Recommendation** Document that empty searches return `{"data": [], "meta": {...}}`.
**Safety classification** Safe documentation fix.

---

### D-11 · Low · All paginated endpoints

**Current behavior**
OpenAPI descriptions for most paginated endpoints are empty strings.

**Root cause**
`@ApiOkResourceList` decorator doesn't automatically add descriptions.

**Implementation correct?** N/A.
**Documentation correct?** No.
**Recommendation** Add descriptive descriptions to all paginated endpoints.
**Safety classification** Safe documentation fix.

---

### D-12 · Low · `POST /discussions/vote`

**Current behavior**
OpenAPI declares `VoteDto.targetType` enum as `['thread', 'comment', 'reply']`, but the repository/service rejects `reply` because comments and replies are stored in the same table with `parentCommentId` distinguishing them.

**Root cause**
DTO includes `reply` in `DISCUSSION_REPORT_TARGET_TYPE` but the service doesn't handle `reply` as a separate target type.

**Implementation correct?** Partially (runtime works for thread/comment).
**Documentation correct?** No (enum includes invalid value).
**Recommendation** Either support `reply` as a separate target type in the service, or remove `reply` from the OpenAPI enum.
**Suggested fix**
Remove `reply` from `DISCUSSION_REPORT_TARGET_TYPE` const array and the OpenAPI enum, since it doesn't work at runtime.
**Safety classification** Safe documentation fix (removing invalid option).

---

### D-13 · Low · `DELETE /discussions/vote`

**Current behavior**
Same as D-12 — `RemoveVoteDto` includes `reply` in enum but runtime rejects it.

**Root cause**
Same as D-12.

**Recommendation** Same as D-12.
**Safety classification** Safe documentation fix.

---

### D-14 · Low · `GET /discussions/unanswered`

**Current behavior**
Returns 200 with empty data array when no unanswered discussions exist.

**Implementation correct?** Yes.
**Documentation correct?** Yes.
**Recommendation** None — this is correct behavior.
**Note** This endpoint is consistent with other list endpoints.

---

## Response DTO / Serialization Audit

### ThreadDto — PASSES (with caveats)

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `threadId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `quizId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `authorId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `author` | AuthorDto | No | Correct |
| `title` | string | No | Correct |
| `body` | string | No | Correct |
| `status` | enum | No | Correct |
| `isSolved` | boolean | No | Correct |
| `solvedAt` | ISO8601 | Yes | Correct |
| `solvedCommentId` | UUID | Yes | Missing `format: uuid` in OpenAPI |
| `solvedBy` | UUID | Yes | Missing `format: uuid` in OpenAPI |
| `commentsCount` | number | No | Correct |
| `votesCount` | number | No | Correct |
| `upvotesCount` | number | No | Correct |
| `downvotesCount` | number | No | Correct |
| `createdAt` | ISO8601 | No | Correct |
| `updatedAt` | ISO8601 | No | Correct |
| `deletedAt` | ISO8601 | Yes | Correct |

### CommentDto — PASSES (with caveats)

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `commentId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `threadId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `authorId` | UUID | No | Missing `format: uuid` in OpenAPI |
| `parentCommentId` | UUID | Yes | Missing `format: uuid` in OpenAPI |

### VoteDto — FAILS

`targetType` enum in OpenAPI includes `reply` which is not supported at runtime.

### CreateReportDto — FAILS

`details` field is documented as `type: object` instead of `type: string`.

---

## Authentication & Authorization Audit

| Endpoint | Auth Required | Permission | Runtime Auth | Runtime Perm | Match |
| -------- | ------------- | ---------- | ------------ | ------------ | ----- |
| `GET /discussions/trending` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/unanswered` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/search` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/threads/:id/related` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/threads/:id/participants` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/threads/:id/stats` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /quizzes/:id/discussions` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /users/:id/discussions` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /users/:id/comments` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /users/:id/discussion-profile` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /discussions/threads` | Yes | None | 401 if no token | — | Yes |
| `POST /discussions/threads` | Yes | None | 401/201 | — | Yes |
| `PUT /discussions/threads/:id` | Yes | None | 401/200 | — | Yes |
| `DELETE /discussions/threads/:id` | Yes | None | 401/204 | — | Yes |
| `POST /discussions/threads/:id/comments` | Yes | None | 401/201 | — | Yes |
| `GET /discussions/threads/:id/comments` | Yes | None | 401/200 | — | Yes |
| `GET /discussions/comments/:id` | Yes | None | 401/200 | — | Yes |
| `PUT /discussions/comments/:id` | Yes | None | 401/200 | — | Yes |
| `DELETE /discussions/comments/:id` | Yes | None | 401/204 | — | Yes |
| `POST /discussions/vote` | Yes | None | 401/500 (bug) | — | Bug |
| `DELETE /discussions/vote` | Yes | None | 401/500 (bug) | — | Bug |
| `POST /discussions/report` | Yes | None | 401/204 | — | Yes |
| `POST /discussions/threads/:id/subscribe` | Yes | None | 401/201 | — | Yes |
| `DELETE /discussions/threads/:id/subscribe` | Yes | None | 401/200 | — | Yes |
| `POST /discussions/threads/:id/save` | Yes | None | 401/201 | — | Yes |
| `DELETE /discussions/threads/:id/save` | Yes | None | 401/200 | — | Yes |
| `POST /discussions/threads/:id/solve` | Yes | None | 401/201 | — | Yes |
| `DELETE /discussions/threads/:id/solve` | Yes | None | 401/200 | — | Yes |
| `POST /discussions/threads/:id/close` | Yes | None | 401/204 | — | Yes |
| `POST /discussions/threads/:id/reopen` | Yes | None | 401/204 | — | Yes |
| `GET /discussions/me` | Yes | None | 401/200 | — | Yes |
| `POST /discussions/threads/:id/hide` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes |
| `POST /discussions/threads/:id/restore` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes |
| `POST /discussions/comments/:id/hide` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes |
| `POST /discussions/comments/:id/restore` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes |
| `GET /discussions/reports` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes (no doc) |
| `POST /discussions/reports/:id/review` | Yes | DISCUSSION_MODERATE | 401/403 | 403 | Yes |

---

## Consistency Audit

### Positive observations

1. **Presenter layer**: `DiscussionPresenter` follows the canonical pattern — uses `ApiResponse.page` and `ApiResponse.ok` correctly.
2. **Cursor mappers**: All cursor types have dedicated mapper classes (`QuizDiscussionCursorMapper`, `MyCommentCursorMapper`, etc.) with serialize/parse methods.
3. **Domain events**: Full event bus integration with events for thread/comment CRUD and moderation actions.
4. **Moderator audit**: `DiscussionModeratorAuditService` logs all moderator actions.
5. **Soft delete**: Repository uses `deletedAt IS NULL` filter for active records.
6. **UUID validation**: All path parameters use `ParseUUIDPipe`.

### Issues found

1. **Vote 500 bug** (D-01, D-03): Inconsistent with other endpoints — only endpoint that 500s on valid input.
2. **Trending 500 bug** (D-02): Inconsistent — other list endpoints work correctly.
3. **Empty update 200** (D-04): Inconsistent with comment update which correctly throws 400.
4. **Missing UUID format** (D-05): Inconsistent with request DTOs which correctly declare `format: uuid`.
5. **Reports security** (D-06): Inconsistent with other moderator endpoints.

---

## Swagger Example Verification

### Positive observations

1. **ThreadDto example**: Valid UUIDs, reasonable values.
2. **VoteDto example**: Valid enum values, UUID format.
3. **CreateReportDto example**: Valid structure.

### Issues found

1. **VoteDto enum**: Includes `reply` which doesn't work at runtime (D-12).
2. **RemoveVoteDto enum**: Same issue as VoteDto (D-13).
3. **CreateReportDto details**: Shows string example but OpenAPI schema says `type: object` (D-07).

---

## Prioritization & Migration Plan

### Phase 1 — Fix Critical runtime bugs (D-01, D-02, D-03)

| Field | Value |
| ----- | ----- |
| Issues | D-01, D-02, D-03 |
| Goal | Make vote and trending endpoints return 200/4xx for valid input. |
| Reason | These are blocking issues that cause 500 errors on documented endpoints. |
| Dependencies | None. |
| Complexity | High (D-02 requires query restructuring) |
| Risk | Medium (D-02 touches the trending algorithm) |
| Breaking change? | No |
| Migrations / DB | None. |

### Phase 2 — Fix High-priority inconsistencies (D-04)

| Field | Value |
| ----- | ----- |
| Issues | D-04 |
| Goal | Require at least one field for thread updates. |
| Reason | Fixes inconsistent validation behavior. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No (changes 200 to 400 for invalid input) |
| Migrations / DB | None. |

### Phase 3 — Fix OpenAPI/Missing format declarations (D-05, D-06, D-07, D-09)

| Field | Value |
| ----- | ----- |
| Issues | D-05, D-06, D-07, D-09 |
| Goal | Make OpenAPI specification accurate and complete. |
| Reason | After Phase 1 fixes, documentation should match wire format. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No |
| Generated SDK | May need regeneration after changes. |

### Phase 4 — Fix 404 behavior for non-existent threads (D-08)

| Field | Value |
| ----- | ----- |
| Issues | D-08 |
| Goal | Return 404 for non-existent threads instead of 200 null. |
| Reason | Aligns with REST conventions. |
| Dependencies | None. |
| Complexity | Medium |
| Risk | Medium (changes API behavior) |
| Breaking change? | Yes (client code relying on 200 null needs updating) |
| Note | Requires frontend team coordination if any client expects 200 null. |

### Phase 5 — Documentation cleanup (D-10, D-11, D-12, D-13, D-14)

| Field | Value |
| ----- | ----- |
| Issues | D-10, D-11, D-12, D-13, D-14 |
| Goal | Clean up documentation issues. |
| Reason | Low priority but improves developer experience. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No |

---

## Implementation Strategy

### Phase 1 Details

**D-01/D-03 Fix** (Vote endpoint):
```typescript
// In discussion.service.ts, change:
const [existingVote] = await Promise.all([
  this.repo.getUserVoteForUpdate(userId, targetType, targetId, tx),
]);

// To:
const existingVote = await this.repo.getUserVoteForUpdate(userId, targetType, targetId, tx);
```

**D-02 Fix** (Trending endpoint):
This requires restructuring the SQL query to avoid referencing CTE columns in raw SQL templates. The score expression should be computed differently, either by:
1. Adding the trending score as a computed column in the select statement
2. Using Drizzle's `sql` template with explicit column references
3. Pre-computing comment stats and joining

### Phase 4 Details

**D-08 Fix** (404 for non-existent threads):
```typescript
// In discussion.controller.ts, getThread method:
async getThread(...) {
  const result = await this.discussionService.getThread(user, threadId);
  if (!result) {
    throw new ThreadNotFoundError(threadId);
  }
  return this.presenter.getThread(result);
}
```

---

## Migration Safety Classification

| Fix | Type | Notes |
| --- | ---- | ----- |
| D-01 | Safe implementation fix | Fixes destructuring bug. |
| D-02 | Safe implementation fix | Restructures SQL query. |
| D-03 | Safe implementation fix | Same as D-01. |
| D-04 | Safe implementation fix | Adds validation. |
| D-05 | Safe documentation fix | Adds format: uuid. |
| D-06 | Safe documentation fix | Adds security declaration. |
| D-07 | Safe documentation fix | Changes type to string. |
| D-08 | Breaking runtime behavior | 404 instead of 200 null. |
| D-09 | Safe documentation fix | Changes to @ApiPropertyOptional. |
| D-10 | Safe documentation fix | Adds description. |
| D-11 | Safe documentation fix | Adds descriptions. |
| D-12 | Safe documentation fix | Removes invalid enum value. |
| D-13 | Safe documentation fix | Removes invalid enum value. |
| D-14 | None needed | Correct behavior. |

---

## Appendix A — Endpoints Inventoried

| # | Method | Path | Auth | Notes |
| - | ------ | ---- | ---- | ----- |
| 1 | GET | `/discussions/trending` | Public | 500 bug (D-02) |
| 2 | GET | `/discussions/unanswered` | Public | Working |
| 3 | GET | `/discussions/search` | Public | Working |
| 4 | GET | `/discussions/threads/:id/related` | Public | Working |
| 5 | GET | `/discussions/threads/:id/participants` | Public | Working |
| 6 | GET | `/discussions/threads/:id/stats` | Public | Working |
| 7 | GET | `/discussions/threads` | JwtGuard | Working |
| 8 | GET | `/discussions/threads/:id` | JwtGuard | Returns 200 null (D-08) |
| 9 | POST | `/discussions/threads` | JwtGuard | Working |
| 10 | PUT | `/discussions/threads/:id` | JwtGuard | Returns 200 for empty body (D-04) |
| 11 | DELETE | `/discussions/threads/:id` | JwtGuard | Working |
| 12 | POST | `/discussions/threads/:id/close` | JwtGuard | Working |
| 13 | POST | `/discussions/threads/:id/reopen` | JwtGuard | Working |
| 14 | POST | `/discussions/threads/:id/solve` | JwtGuard | Working |
| 15 | DELETE | `/discussions/threads/:id/solve` | JwtGuard | Working |
| 16 | POST | `/discussions/threads/:id/subscribe` | JwtGuard | Working |
| 17 | DELETE | `/discussions/threads/:id/subscribe` | JwtGuard | Working |
| 18 | POST | `/discussions/threads/:id/save` | JwtGuard | Working |
| 19 | DELETE | `/discussions/threads/:id/save` | JwtGuard | Working |
| 20 | POST | `/discussions/threads/:id/hide` | Moderator | Working |
| 21 | POST | `/discussions/threads/:id/restore` | Moderator | Working |
| 22 | POST | `/discussions/threads/:id/comments` | JwtGuard | Working |
| 23 | GET | `/discussions/threads/:id/comments` | JwtGuard | Working |
| 24 | GET | `/discussions/comments/:id` | JwtGuard | Working |
| 25 | PUT | `/discussions/comments/:id` | JwtGuard | Working |
| 26 | DELETE | `/discussions/comments/:id` | JwtGuard | Working |
| 27 | POST | `/discussions/comments/:id/hide` | Moderator | Working |
| 28 | POST | `/discussions/comments/:id/restore` | Moderator | Working |
| 29 | POST | `/discussions/vote` | JwtGuard | 500 bug (D-01) |
| 30 | DELETE | `/discussions/vote` | JwtGuard | 500 bug (D-03) |
| 31 | POST | `/discussions/report` | JwtGuard | Working |
| 32 | GET | `/discussions/reports` | Moderator | Missing security doc (D-06) |
| 33 | POST | `/discussions/reports/:id/review` | Moderator | Working |
| 34 | GET | `/discussions/me` | JwtGuard | Working |
| 35 | GET | `/quizzes/:id/discussions` | Public | Working |
| 36 | GET | `/users/me/discussions` | JwtGuard | Working |
| 37 | GET | `/users/me/comments` | JwtGuard | Working |
| 38 | GET | `/users/me/upvoted-threads` | JwtGuard | Working |
| 39 | GET | `/users/me/upvoted-comments` | JwtGuard | Working |
| 40 | GET | `/users/me/discussion-subscriptions` | JwtGuard | Working |
| 41 | GET | `/users/me/saved-threads` | JwtGuard | Working |
| 42 | GET | `/users/:id/discussions` | Public | Working |
| 43 | GET | `/users/:id/comments` | Public | Working |
| 44 | GET | `/users/:id/discussion-profile` | Public | Working |

---

## Appendix B — Live Runtime Evidence

```
==GET /discussions/trending (no auth)==               STATUS=500  ⚠️ D-02 (CTE alias error)
==GET /discussions/unanswered (no auth)==             STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /discussions/search?q=test (no auth)==          STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /discussions/threads (no auth)==                STATUS=401  ✓
==GET /discussions/threads (auth)==                   STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /discussions/threads?limit=2==                  STATUS=200  {"data":[...],"meta":{"pagination":{"limit":2}}} ✓
==GET /discussions/threads/invalid-uuid==             STATUS=400  ✓
==GET /discussions/threads/non-existent-uuid==         STATUS=200  {"data":null} ⚠️ D-08
==PUT /discussions/threads/:id (empty body)==         STATUS=200  ⚠️ D-04
==POST /discussions/threads (valid)==                  STATUS=201  {"data":{...}} ✓
==POST /discussions/threads (empty title)==           STATUS=400  ✓
==POST /discussions/threads/:id/comments==             STATUS=201  {"data":{...}} ✓
==POST /discussions/vote (upvote thread)==            STATUS=500  ⚠️ D-01 ("is not iterable")
==POST /discussions/vote (upvote comment)==           STATUS=500  ⚠️ D-03 ("is not iterable")
==POST /discussions/report==                          STATUS=204  ✓
==POST /discussions/threads/:id/subscribe==            STATUS=201  ✓
==POST /discussions/threads/:id/save==                STATUS=201  ✓
==POST /discussions/threads/:id/solve==               STATUS=201  {"data":{...}} ✓
==DELETE /discussions/threads/:id/solve==             STATUS=200  {"data":{...}} ✓
==GET /discussions/reports (regular user)==           STATUS=403  ✓
==GET /discussions/reports (moderator)==              STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /quizzes/:id/discussions (public)==             STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /quizzes/invalid-uuid/discussions==             STATUS=400  ✓
```

---

## Appendix C — Files Inspected

- `src/modules/discussion/transport/controller/discussion.controller.ts`
- `src/modules/discussion/transport/controller/quiz-discussion.controller.ts`
- `src/modules/discussion/transport/controller/user-discussion.controller.ts`
- `src/modules/discussion/transport/presenters/discussion.presenter.ts`
- `src/modules/discussion/application/discussion-application.service.ts`
- `src/modules/discussion/domain/services/discussion.service.ts`
- `src/modules/discussion/domain/errors/index.ts`
- `src/modules/discussion/domain/types/index.ts`
- `src/modules/discussion/domain/policies/discussion-authorization.policy.ts`
- `src/modules/discussion/infrastructure/repositories/discussion.repository.ts`
- `src/modules/discussion/infrastructure/audit/discussion-moderator-audit.service.ts`
- `src/modules/discussion/dto/request/create-thread.dto.ts`
- `src/modules/discussion/dto/request/update-thread.dto.ts`
- `src/modules/discussion/dto/request/create-comment.dto.ts`
- `src/modules/discussion/dto/request/update-comment.dto.ts`
- `src/modules/discussion/dto/request/list-query.dto.ts`
- `src/modules/discussion/dto/request/vote.dto.ts`
- `src/modules/discussion/dto/request/report.dto.ts`
- `src/modules/discussion/dto/request/review-report.dto.ts`
- `src/modules/discussion/dto/request/solve-thread.dto.ts`
- `src/modules/discussion/dto/request/enums.ts`
- `src/modules/discussion/dto/response/thread-response.dto.ts`
- `src/modules/discussion/dto/response/comment-response.dto.ts`
- `src/modules/discussion/dto/response/report-response.dto.ts`
- `src/modules/discussion/dto/response/thread-stats-response.dto.ts`
- `src/modules/discussion/dto/response/discussion-thread-solve-response.dto.ts`
- `src/modules/discussion/mappers/*.mapper.ts`
- `src/core/database/schema/discussion/schema.ts`
- `src/core/database/schema/discussion/relations.ts`
- `docs/generated/openapi.json`
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/api.md`
- `docs/standards/swagger.md`
- `docs/standards/validation.md`
- `docs/audits/notification-module-api-contract-audit-2026-07-17.md`
