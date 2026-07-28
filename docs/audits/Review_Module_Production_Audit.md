# Review Module Production-Readiness Audit Report

**Date:** July 28, 2026
**Module:** Review
**Status:** Production-Readiness Review

---

## Executive Summary

The review module is well-architected with clear separation of concerns (CQRS pattern), comprehensive error handling, transactional outbox pattern, idempotency support, and extensive unit/integration test coverage. The domain logic is correctly encapsulated in policy classes, and the soft-delete mechanism properly preserves helpful vote history.

However, several HTTP semantics issues and Swagger documentation gaps require attention before production deployment.

---

## Critical Findings (Must Fix Before Production)

### 1. DELETE Operations Return 200 With Message Bodies

**Severity:** High

**Impact:** Incorrect HTTP semantics; clients may have unexpected behavior expectations.

| Item | Details |
|------|---------|
| **Location** | `src/modules/review/transport/controller/quiz-review.controller.ts`, `review.controller.ts`, `admin-review.controller.ts` |
| **Endpoints** | `DELETE /quizzes/:quizId/reviews`, `DELETE /reviews/:reviewId/helpful`, `DELETE /admin/reviews/:reviewId` |
| **Current** | Returns HTTP 200 with `{ message: "..." }` body |
| **Should Be** | HTTP 204 No Content (empty body) |

The `DeleteReviewResponseDto` and `HelpfulReviewResponseDto` contain message properties, which is incorrect for DELETE operations.

---

### 2. Missing 401 Unauthorized in Swagger for Authenticated Endpoints

**Severity:** High

**Impact:** Incomplete API contract; clients cannot anticipate authentication failures.

| Item | Details |
|------|---------|
| **Location** | `src/modules/review/transport/swagger/review-swagger-decorators.ts` |
| **Endpoints** | `GET /reviews/:reviewId` |

The `GET /reviews/:reviewId` endpoint requires authentication (`@ApiAuth()`), but `ApiGetReviewByIdResponses` does not include `ApiUnauthorizedResponse`, unlike other authenticated endpoints in the module.

---

## Medium Findings

### 3. Missing 404 Not Found in Swagger Decorators

**Severity:** Medium

**Impact:** Inconsistent documentation; clients may not anticipate missing resource scenarios.

| Item | Details |
|------|---------|
| **Location** | `src/modules/review/transport/swagger/review-swagger-decorators.ts` |

| Decorator | Missing Response | Notes |
|-----------|-----------------|-------|
| `ApiListReviewsResponses` | `ApiNotFoundResponse` | Public endpoint - quiz not found should be documented |
| `ApiListMyReviewsResponses` | `ApiNotFoundResponse` | Consistent with other list endpoints |
| `ApiListReviewsByUserResponses` | `ApiNotFoundResponse` | Consistent with other list endpoints |
| `ApiListMyReportedReviewsResponses` | `ApiNotFoundResponse` | Consistent with other list endpoints |
| `ApiGetReviewByIdResponses` | `ApiUnauthorizedResponse` | Missing auth error documentation |

---

### 4. Code Duplication in Pagination Logic

**Severity:** Medium

**Impact:** Maintainability; same pattern repeated in multiple places.

| Item | Details |
|------|---------|
| **Location** | `src/modules/review/application/review.application.service.ts`, `src/modules/review/domain/review.service.ts`, `src/modules/review/domain/review-admin.service.ts` |

The pagination helper pattern appears in 6+ locations:

```13:28:src/modules/review/application/review.application.service.ts
const hasNextPage = rows.length > limit;
const items = hasNextPage ? rows.slice(0, limit) : rows;
const lastItem = items.at(-1);

return {
  items,
  limit,
  hasNextPage,
  nextCursor:
    hasNextPage && lastItem
      ? CursorMapper.serializeReview({
          createdAt: lastItem.createdAt,
          reviewId: lastItem.reviewId,
        })
      : null,
};
```

**Recommendation:** Extract to `pagination.helper.ts` which already exists but is not used by these services.

---

### 5. Inconsistent Pagination Default Limits

**Severity:** Low

**Impact:** Developer confusion; inconsistent defaults across endpoints.

| Endpoint | Default Limit |
|----------|--------------|
| `GET /quizzes/:quizId/reviews` | 20 (from controller) |
| `GET /users/me/reviews` | 10 (from service) |
| `GET /users/me/reported-reviews` | 10 (from service) |
| `GET /admin/reviews/reports` | 20 (from controller) |

**Recommendation:** Standardize pagination defaults. Consider extracting to `review.constants.ts`.

---

### 6. Inconsistent Error Message Constants

**Severity:** Low

**Impact:** Maintenance; messages scattered across two files.

| Item | Details |
|------|---------|
| **Location** | `src/modules/review/review.constants.ts`, `src/modules/review/domain/errors/review-domain.errors.ts` |

Some error messages are defined as constants and imported, while others are inline strings. For example:
- `REVIEW_QUIZ_USER_CONFLICT_MESSAGE` is a constant
- `'You cannot vote on your own review'` is inline in `review.service.ts`

**Recommendation:** Consolidate all error messages to constants.

---

## Low-Priority Findings

### 7. Controller Naming Convention

**Severity:** Low

**Observation:** The class `quizReviewController` uses camelCase (non-standard):

```34:34:src/modules/review/transport/controller/quiz-review.controller.ts
export class quizReviewController {
```

**Recommendation:** Rename to `QuizReviewController` for consistency with NestJS conventions.

---

### 8. Unused Parameter Prefix

**Severity:** Low

**Observation:** The `_user` parameter in `getReviewById` is intentionally unused:

```94:101:src/modules/review/transport/controller/review.controller.ts
async getReviewById(
  @Param('reviewId', new ParseUUIDPipe({ version: '7' })) reviewId: string,
  @CurrentUser() _user: JwtPayload,
) {
  // `_user` is unused at the service layer; it is required
  // solely to force `JwtGuard` to authenticate the request.
```

**Status:** This is intentional and documented. Consider adding a comment or helper decorator for this pattern.

---

### 9. Swagger Decorator Not Applied to All Endpoints

**Severity:** Low

**Observation:** Path parameter decorators (`ApiQuizIdParam`, `ApiReviewIdParam`, etc.) are defined but not used in controllers.

```414:444:src/modules/review/transport/swagger/review-swagger-decorators.ts
export const ApiQuizIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'quizId',
    ...
  });
```

**Impact:** Swagger UI doesn't show parameter descriptions. Consider applying these decorators to controller methods.

---

## Findings Summary by Category

### HTTP Status Codes

| # | Endpoint | Current | Should Be | Severity |
|---|----------|---------|-----------|----------|
| 1 | `DELETE /quizzes/:quizId/reviews` | 200 | 204 | High |
| 2 | `DELETE /reviews/:reviewId/helpful` | 200 | 204 | High |
| 3 | `DELETE /admin/reviews/:reviewId` | 200 | 204 | High |

### Swagger Documentation

| # | Decorator | Missing | Severity |
|---|-----------|---------|----------|
| 4 | `ApiGetReviewByIdResponses` | 401 Unauthorized | High |
| 5 | `ApiListReviewsResponses` | 404 Not Found | Medium |
| 6 | `ApiListMyReviewsResponses` | 404 Not Found | Medium |
| 7 | `ApiListReviewsByUserResponses` | 404 Not Found | Medium |
| 8 | `ApiListMyReportedReviewsResponses` | 404 Not Found | Medium |

### Code Quality

| # | Location | Issue | Severity |
|---|---------|-------|----------|
| 9 | Multiple services | Pagination duplication | Medium |
| 10 | Error handling | Inconsistent message constants | Low |
| 11 | Naming | `quizReviewController` camelCase | Low |

---

## Positive Findings

The following aspects are well-implemented and should be preserved:

1. **Domain Logic Encapsulation**: `ReviewAuthorizationPolicy` and `ReviewReportStatusPolicy` correctly encapsulate authorization and state machine rules.

2. **Transactional Integrity**: The transactional outbox pattern ensures analytics counters remain consistent with review operations.

3. **Idempotency Support**: `IdempotencyService` properly handles duplicate submissions for create, helpful-vote, and report operations.

4. **Soft-Delete Preservation**: Reviews are soft-deleted, preserving helpful vote history for existing voters.

5. **Comprehensive Error Hierarchy**: Domain errors (`ReviewNotFoundError`, `ReviewConflictError`, etc.) are properly structured and mapped to HTTP status codes.

6. **Visibility Gating**: `isVisibleToReviewers` policy correctly prevents operations on hidden/unpublished quizzes.

7. **Race Condition Handling**: `pg_advisory_xact_lock` prevents duplicate review creation under concurrent requests.

8. **Audit Logging**: Admin actions are properly audited with transactional guarantees.

9. **Self-Report Prevention**: Both application-level and database-level constraints prevent self-reporting.

10. **Cursor Pagination**: Properly implemented with sort-dependent cursor shapes for the `helpful` sort.

---

## Implementation Plan

### Phase 1: HTTP Status Code Corrections (Critical)

**Files to modify:**
- `src/modules/review/transport/controller/quiz-review.controller.ts`
- `src/modules/review/transport/controller/review.controller.ts`
- `src/modules/review/transport/controller/admin-review.controller.ts`
- `src/modules/review/transport/swagger/review-swagger-decorators.ts`
- `src/modules/review/dto/response/delete-review-response.dto.ts` (remove)
- `src/modules/review/dto/response/helpful-review-response.dto.ts` (remove message property)

**Steps:**

1. Update `deleteReview` controller method:
   ```typescript
   @Delete(':quizId/reviews')
   @HttpCode(HttpStatus.NO_CONTENT)
   async deleteReview(...): Promise<void> {
     // ... existing logic
   }
   ```

2. Update `removeHelpfulVote` controller method:
   ```typescript
   @Delete(':reviewId/helpful')
   @HttpCode(HttpStatus.NO_CONTENT)
   async removeHelpfulVote(...): Promise<void> {
     // ... existing logic
   }
   ```

3. Update `adminDeleteReview` controller method:
   ```typescript
   @Delete('reviews/:reviewId')
   @HttpCode(HttpStatus.NO_CONTENT)
   async adminDeleteReview(...): Promise<void> {
     // ... existing logic
   }
   ```

4. Update swagger decorators to use `ApiNoContentResponse` instead of success responses for delete operations.

---

### Phase 2: Swagger Documentation Completeness (High)

**Files to modify:**
- `src/modules/review/transport/swagger/review-swagger-decorators.ts`

**Steps:**

1. Add `ApiUnauthorizedResponse` to `ApiGetReviewByIdResponses`.

2. Add `ApiNotFoundResponse` to list endpoints for consistency (quiz not found should be documented even if returned implicitly).

---

### Phase 3: Code Quality Improvements (Medium)

**Files to modify:**
- `src/modules/review/application/review.application.service.ts`
- `src/modules/review/domain/review.service.ts`
- `src/modules/review/domain/review-admin.service.ts`
- `src/modules/review/application/pagination.helper.ts`

**Steps:**

1. Ensure `pagination.helper.ts` exports the shared pagination logic.

2. Update services to use the shared pagination helper.

3. Rename `quizReviewController` to `QuizReviewController`.

4. Consolidate error message constants.

---

## Breaking Changes Summary

| Change | Impact | Migration Path |
|--------|--------|----------------|
| DELETE → 204 | Medium | Clients ignore response body for successful deletes |
| Swagger 401 addition | Low | Clients gain awareness of auth requirement |

---

## Testing Checklist

After implementing changes, verify:

- [ ] `DELETE /quizzes/:quizId/reviews` returns 204
- [ ] `DELETE /quizzes/:quizId/reviews` twice returns 204 (idempotent)
- [ ] `DELETE /reviews/:reviewId/helpful` returns 204
- [ ] `DELETE /reviews/:reviewId/helpful` twice returns 204 (idempotent)
- [ ] `DELETE /admin/reviews/:reviewId` returns 204
- [ ] `GET /reviews/:reviewId` without auth returns 401
- [ ] `GET /reviews/:reviewId` with auth returns 200
- [ ] OpenAPI spec shows all documented responses
- [ ] All existing tests pass
- [ ] Integration tests updated for new status codes

---

## Files Reference

### Endpoints Overview

```
Public Endpoints (no auth):
  GET  /quizzes/:quizId/reviews              → OK (semantic note: quiz 404 missing in docs)
  GET  /quizzes/:quizId/reviews/stats        → OK
  GET  /users/:userId/reviews                → OK (semantic note: user 404 missing in docs)

Authenticated Endpoints:
  POST /quizzes/:quizId/reviews              → OK
  PATCH /quizzes/:quizId/reviews             → OK
  DELETE /quizzes/:quizId/reviews            → NEEDS FIX (200→204)
  GET  /reviews/me                           → OK
  GET  /reviews/:reviewId                    → NEEDS FIX (401 not documented)
  POST /reviews/:reviewId/helpful            → OK
  DELETE /reviews/:reviewId/helpful          → NEEDS FIX (200→204)
  POST /reviews/:reviewId/report             → OK
  GET  /users/me/reviews                    → OK
  GET  /users/me/reviews/:quizId            → OK
  GET  /users/me/reported-reviews           → OK

Admin Endpoints:
  GET  /admin/reviews/reports               → OK
  PATCH /admin/reviews/reports/:reportId   → OK
  DELETE /admin/reviews/:reviewId          → NEEDS FIX (200→204)
  GET  /quizzes/:quizId/reviews/analytics  → OK
```

### Files to Modify

| File | Phase | Priority |
|------|-------|----------|
| `quiz-review.controller.ts` | 1 | Critical |
| `review.controller.ts` | 1, 2 | Critical |
| `admin-review.controller.ts` | 1 | Critical |
| `review-swagger-decorators.ts` | 1, 2 | Critical |
| `delete-review-response.dto.ts` | 1 | Critical |
| `helpful-review-response.dto.ts` | 1 | Critical |
| `review.application.service.ts` | 3 | Medium |
| `review.service.ts` | 3 | Medium |
| `review-admin.service.ts` | 3 | Medium |
| `pagination.helper.ts` | 3 | Medium |
| `quiz-review.controller.ts` (rename) | 3 | Low |

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | 6 endpoints, ~6 files | Medium |
| Phase 2 | 1 file | Low |
| Phase 3 | 5 files | Low |

**Total estimated time:** 2-3 hours

---

## Conclusion

The review module demonstrates solid engineering practices with CQRS pattern, transactional integrity, and comprehensive error handling. The critical findings are limited to HTTP semantics (DELETE operations) and Swagger documentation completeness. These are straightforward fixes that will bring the module to production readiness.

The positive findings (domain policies, idempotency, soft-delete, visibility gating, race condition handling, audit logging) indicate this module has been well-maintained and is production-ready pending the minor corrections outlined above.
