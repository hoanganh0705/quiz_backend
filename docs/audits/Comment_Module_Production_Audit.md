# Comment Module Production-Readiness Audit Report

**Date:** Tuesday, July 28, 2026  
**Module:** Comment Module (`src/modules/comment`)  
**Status:** Functionally complete, production-readiness review

---

## Executive Summary

The comment module is well-architected with proper layered separation (transport, application, domain, infrastructure), consistent error handling following RFC7807, and thoughtful domain modeling. However, there are **13 findings** identified that should be addressed before production deployment.

| Severity | Count | Blocking? |
|----------|-------|-----------|
| Critical | 1 | Yes |
| High | 1 | Yes |
| Medium | 5 | No |
| Low | 6 | No |

---

## Implementation Phases

### Phase 1: Critical & High Priority Fixes (Before Production)

> **Goal:** Eliminate blocking issues and dead code before deployment.

#### 1.1 Remove Dead Code: `ParentCommentNotFoundError`

**Location:** `src/modules/comment/domain/errors/comment.errors.ts`  
**Severity:** Critical

**Problem:**
`ParentCommentNotFoundError` is defined, exported, and tested, but is **never thrown** anywhere in the codebase. The domain service uses `CommentNotFoundError` for missing parent comments instead.

**Files affected:**
- `src/modules/comment/domain/errors/comment.errors.ts` (remove class, lines 73-78)
- `src/modules/comment/domain/errors/index.ts` (remove export)
- `src/modules/comment/domain/errors/comment.errors.spec.ts` (remove tests)

**Verification:**
```bash
grep -rn "ParentCommentNotFoundError" src/ --include="*.ts" | grep -v ".spec.ts"
# Should return no matches outside the class definition
```

**Breakdown:**

| Step | Task | File | Action |
|------|------|------|--------|
| 1 | Remove `ParentCommentNotFoundError` class | `comment.errors.ts` | Delete lines 73-78 |
| 2 | Remove export from index | `comment.errors/index.ts` | Remove from export list |
| 3 | Remove test cases | `comment.errors.spec.ts` | Delete `ParentCommentNotFoundError` tests |
| 4 | Verify build passes | All | `npm run build` |

---

#### 1.2 Verify HTTP Status Code for Report Creation

**Location:** `src/modules/comment/transport/controller/comment.controller.ts:127`  
**Severity:** High

**Problem:**
The controller declares `@HttpCode(HttpStatus.CREATED)` but returns via `presenter.createReport()` which calls `ApiResponse.ok()`. Need to verify the actual HTTP status returned.

**Verification steps:**
1. Check `ApiResponse.ok()` implementation in `src/common/responses/`
2. If it returns 200, change to use `ApiResponse.created()` or return a proper 201 response
3. Alternatively, remove the presenter wrapper for this endpoint and return directly with 201

**Breakdown:**

| Step | Task | File | Action |
|------|------|------|--------|
| 1 | Check `ApiResponse` implementation | `src/common/responses/api-response.ts` | Verify 201 vs 200 |
| 2 | Fix response if needed | `comment.presenter.ts` | Add `created()` method or fix existing |
| 3 | Update test expectations | `comment.controller.spec.ts` | Assert correct status code |

---

### Phase 2: Medium Priority Improvements (Sprint 2)

> **Goal:** Address semantic and consistency issues that affect API quality.

#### 2.1 Add `operationId` to Swagger Decorators

**Location:** `src/modules/comment/transport/swagger/comment-swagger-decorators.ts`  
**Severity:** Medium

**Problem:**
No `operationId` is defined on any endpoint, which reduces the quality of generated SDKs.

**Changes per endpoint:**

| Endpoint | Operation ID |
|----------|--------------|
| `GET /quizzes/:quizId/comments` | `listQuizComments` |
| `POST /quizzes/:quizId/comments` | `createComment` |
| `GET /comments/:commentId` | `getComment` |
| `PATCH /comments/:commentId` | `editComment` |
| `DELETE /comments/:commentId` | `deleteComment` |
| `PUT /comments/:commentId/vote` | `castVote` |
| `DELETE /comments/:commentId/vote` | `removeVote` |
| `POST /comments/:commentId/reports` | `reportComment` |
| `POST /comments/:commentId/hide` | `hideComment` |
| `POST /comments/:commentId/restore` | `restoreComment` |
| `GET /comments/reports` | `listReports` |
| `POST /comments/reports/:reportId/review` | `reviewReport` |
| `GET /users/me/comments` | `listMyComments` |
| `GET /users/:userId/comments` | `listUserComments` |

**Example change:**
```typescript
ApiOperation({
  operationId: 'listQuizComments',
  summary: 'List comments for a quiz',
  ...
})
```

---

#### 2.2 Consolidate Duplicate Constants

**Location:** `src/modules/comment/dto/response/comment.dto.ts:4`  
**Severity:** Medium

**Problem:**
`VOTE_VALUES` is defined locally while `VOTE_VALUE` exists in `domain/types/index.ts`.

**Fix:**
```typescript
// Before (comment.dto.ts)
const VOTE_VALUES = ['upvote', 'downvote'] as const;

// After (comment.dto.ts)
import { VOTE_VALUE } from '../../domain/types';

export type VoteValueWire = (typeof VOTE_VALUE)[number] | null;
```

---

#### 2.3 Remove Unused Domain Type

**Location:** `src/modules/comment/domain/types/index.ts:213-216`  
**Severity:** Medium

**Problem:**
`CommentVotesCursor` is defined but never used. If popularity sorting is not implemented, this is dead code.

**Decision required:**
- **Option A:** Remove the type if popularity sorting is not planned
- **Option B:** Implement popularity sorting with this cursor

---

#### 2.4 Consider RESTful Route Restructuring for Reports

**Location:** `src/modules/comment/transport/controller/report.controller.ts`  
**Severity:** Medium

**Problem:**
Report routes are inconsistent - `/comments/:commentId/reports` (create) lives in `CommentController` while `/comments/reports` (list) lives in `ReportController`.

**Option A: Keep flat structure (current)**
- Simpler for moderators
- All report endpoints under `/comments/reports`

**Option B: Nested structure**
- `POST /comments/:commentId/reports`
- `GET /comments/:commentId/reports`
- `GET /comments/:commentId/reports/:reportId`

**Recommendation:** Keep current design but document the reasoning.

---

#### 2.5 Add Response Payload for Hide/Restore

**Location:** `src/modules/comment/transport/controller/comment.controller.ts:138-160`  
**Severity:** Medium

**Problem:**
Moderators cannot tell if a hide/restore action actually changed state (no-op vs. actual change).

**Proposed response:**
```typescript
{
  "data": {
    "commentId": "uuid",
    "isHidden": true,
    "changed": true
  },
  "meta": {
    "timestamp": "2026-07-28T..."
  }
}
```

**Breakdown:**

| Step | Task | File |
|------|------|------|
| 1 | Add new DTO for moderation response | `dto/response/moderation-result.dto.ts` |
| 2 | Update controller to return response | `comment.controller.ts` |
| 3 | Add presenter method | `comment.presenter.ts` |
| 4 | Update Swagger decorators | `comment-swagger-decorators.ts` |

---

### Phase 3: Low Priority Polish (Sprint 3+)

> **Goal:** Improve developer experience and maintainability.

#### 3.1 Rename Vote Method for Clarity

**Location:** `src/modules/comment/transport/controller/comment.controller.ts:106`  
**Severity:** Low

**Change:**
```typescript
// Before
async vote(...)

// After
async castVote(...)
```

**Also update Swagger summary:**
```typescript
summary: 'Cast, change, or flip your vote on a comment'
```

---

#### 3.2 Consistent Validation Error Messages

**Location:** `src/modules/comment/dto/request/create-comment.dto.ts:28`  
**Severity:** Low

**Change:**
```typescript
// Before
@IsUUID('7', { message: 'parentCommentId must be a valid UUID' })

// After - use project convention for UUID validation messages
@IsUUID('7')
```

---

#### 3.3 Rename Review Endpoint (Optional)

**Location:** `src/modules/comment/transport/controller/report.controller.ts:54`  
**Severity:** Low

**Option:** Change `reviewReport` to `resolveReport` for clearer semantics.

**Trade-off:** "Review" is also a valid moderation term. Consider keeping as-is if moderators are accustomed to it.

---

#### 3.4 Standardize `MyCommentView.id` Field Name

**Location:** `src/modules/comment/domain/types/index.ts:98-107`  
**Severity:** Low

**Decision:** Either rename `MyCommentView.commentId` to `MyCommentView.id` (breaking change) or document the inconsistency.

---

## Cross-Module Consistency Review

### Pagination Strategy

| Module | Strategy | Endpoint |
|--------|----------|----------|
| Comment | Cursor-based | `/quizzes/:quizId/comments` |
| Ranking | Offset-based | `/leaderboard` |

**Recommendation:** Document the rationale for each approach:
- **Cursor pagination:** Better for infinite scroll, stable page sizes, no duplicate/missing items on fast-changing data
- **Offset pagination:** Better for numbered pages, known total counts, simple UX patterns

Both are valid; ensure frontend team is aligned with each module's approach.

---

## Testing Checklist

### Phase 1 Verification
- [ ] Build passes without errors
- [ ] All tests pass after dead code removal
- [ ] Report creation returns correct 201 status code
- [ ] No `ParentCommentNotFoundError` references remain

### Phase 2 Verification
- [ ] `operationId` values are unique across all endpoints
- [ ] `VOTE_VALUE` constant is imported from single source
- [ ] `CommentVotesCursor` either removed or implemented
- [ ] Hide/Restore returns meaningful state change indicator

### Phase 3 Verification
- [ ] Method names are consistent and descriptive
- [ ] Validation error messages follow project convention
- [ ] All Swagger documentation is accurate

---

## Rollback Plan

If any change causes issues:

1. **Revert the specific file** to the previous commit
2. **Re-run tests** to verify no regressions
3. **Check integration tests** if database schema unchanged

For Phase 1 changes (critical):
- Rollback is straightforward as changes are additive/removal only
- No database migrations required

---

## Sign-Off

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | Pending | Critical fixes required before production |
| Phase 2 | Planned | Sprint 2 improvements |
| Phase 3 | Backlog | Sprint 3+ polish items |

---

*Generated by production-readiness audit process*
