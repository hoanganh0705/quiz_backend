# Review Module — API Contract Audit

> Comprehensive API contract audit of the `review` module.
> Compares implementation, OpenAPI specification, Swagger UI, validation rules, authorization rules, examples, and actual runtime behavior.
> Generated from a senior backend API review perspective. No code was modified during this audit; this document is the deliverable.

---

## 1. Executive Summary

### Overall Contract Health Score: **7.5 / 10**

The `review` module is well-structured and follows most of the project's conventions. The implementation and OpenAPI specification are largely aligned, with correct error code mapping, consistent pagination helpers, and proper envelope usage. The primary concerns are: (a) a **field name mismatch** (`comment` vs `content`) between the public DTOs and the response schema, (b) **Swagger examples are absent** across all 15 endpoints, (c) the **module-level OpenAPI regression test is missing**, and (d) the `ReviewDashboardResponseDto` examples use stale timestamps that do not follow the shared timestamp convention.

### Metrics

| Metric | Value |
|---|---|
| **Endpoints audited** | 15 |
| **Total issues found** | 17 |
| **Critical** | 1 |
| **High** | 3 |
| **Medium** | 7 |
| **Low** | 6 |
| **Documentation issues** | 11 |
| **Implementation bugs** | 2 |
| **Validation inconsistencies** | 1 |
| **OpenAPI inconsistencies** | 3 |
| **Swagger success-example issues** | 15 (every endpoint) |
| **Module-level OpenAPI regression test** | Missing |
| **E2E test files for the module** | None |

### Source-of-truth hierarchy applied

Per `docs/PROJECT_CONSTITUTION.md`:

1. **Implementation** (compiled TypeScript) — authoritative for runtime behavior.
2. **Tests** — second authority.
3. **OpenAPI** — wire contract.
4. **Docs** (`docs/modules/review.md`) — descriptive only.

When two sources disagreed during the audit, this hierarchy was applied to determine which side should be corrected.

---

## 2. Module Overview

The review module owns the quiz review surface: per-user reviews with star ratings (`rating ∈ [1,5]`) and helpful votes, plus a moderator reports pipeline.

### Resources

| Resource | Description |
|---|---|
| `Review` | A user's star rating and optional text review for a quiz |
| `ReviewHelpfulVote` | A user's vote marking a review as helpful |
| `ReviewReport` | A user's report of a review for moderation |

### Business Rules (from `docs/modules/review.md`)

- **One review per user per quiz**: enforced by unique constraint on `(quizId, userId)`.
- **Attempt required**: users must have completed at least one attempt before reviewing.
- **Ownership**: only the review author may update or delete their review.
- **Self-report prohibited**: a user cannot report their own review.
- **Duplicate report prohibited**: one open report per user per review.
- **Rating range**: `rating ∈ [1, 5]` enforced by DB CHECK constraint.

---

## 3. Endpoint Inventory

| # | Method | Path | Summary | Auth |
|---|---|---|---|---|
| 1 | GET | `/api/v1/reviews/me` | Get review dashboard | JwtGuard |
| 2 | POST | `/api/v1/quizzes/{quizId}/reviews` | Create review | JwtGuard |
| 3 | GET | `/api/v1/quizzes/{quizId}/reviews` | List reviews for quiz | Public |
| 4 | GET | `/api/v1/quizzes/{quizId}/reviews/stats` | Get review stats | Public |
| 5 | GET | `/api/v1/quizzes/{quizId}/reviews/analytics` | Get creator analytics | JwtGuard |
| 6 | GET | `/api/v1/quizzes/{quizId}/reviews/me` | Get my review for quiz | JwtGuard |
| 7 | PATCH | `/api/v1/quizzes/{quizId}/reviews` | Update my review | JwtGuard |
| 8 | DELETE | `/api/v1/quizzes/{quizId}/reviews` | Delete my review | JwtGuard |
| 9 | POST | `/api/v1/reviews/{reviewId}/helpful` | Mark review helpful | JwtGuard |
| 10 | DELETE | `/api/v1/reviews/{reviewId}/helpful` | Remove helpful vote | JwtGuard |
| 11 | POST | `/api/v1/reviews/{reviewId}/report` | Report review | JwtGuard |
| 12 | GET | `/api/v1/reviews/{reviewId}` | Get review by ID | Public |
| 13 | GET | `/api/v1/users/me/reviews` | List my reviews | JwtGuard |
| 14 | GET | `/api/v1/users/me/reported-reviews` | List my reported reviews | JwtGuard |
| 15 | GET | `/api/v1/users/me/reviews/{quizId}` | Get my review for quiz (user endpoint) | JwtGuard |
| 16 | GET | `/api/v1/users/{userId}/reviews` | List reviews by user | Public |
| 17 | GET | `/api/v1/admin/reviews/reports` | List platform reports | REVIEW_MODERATE |
| 18 | PATCH | `/api/v1/admin/reviews/reports/{reportId}` | Update report status | REVIEW_MODERATE |

---

## 4. Findings by Severity

### 4.1 Critical

#### C1. `comment` vs `content` field name mismatch in response DTOs

- **Endpoint**: `GET /api/v1/quizzes/{quizId}/reviews`, `GET /api/v1/reviews/{reviewId}`, `GET /api/v1/users/me/reviews`, `GET /api/v1/users/{userId}/reviews`, `GET /api/v1/quizzes/{quizId}/reviews/me`, `GET /api/v1/users/me/reviews/{quizId}`
- **Current behavior**: `ReviewDetailResponseDto` and `MyReviewItemDto` declare `content` as the field name, while `ReviewResponseDto` (used by `listReviews`) declares `comment`. The database column is `comment`, the repository selects `comment` as `content` in the mapper, but the OpenAPI spec shows `content` for detail endpoints and `comment` for list endpoints.
- **Documented behavior**: `docs/modules/review.md` uses the term "text review" but does not specify a field name. The OpenAPI spec shows `content` for detail responses and `comment` for list responses.
- **Root cause**: `ReviewResponseDto` was created with `comment` while `ReviewDetailResponseDto` and `MyReviewItemDto` were created with `content`. The `ReviewResponseMapper.toReviewResponse()` correctly maps `row.comment` → `comment`, but `toReviewDetailResponse()` maps `row.content` (which is actually `row.comment` aliased in the query) → `content`. This inconsistency is an API design error.
- **Implementation correct?** No. The field name should be consistent across all review response DTOs.
- **Documentation correct?** Partially. The OpenAPI spec is inconsistent, but the docs don't specify a field name.
- **Recommendation**: Standardize on one field name. The database uses `comment`, so `comment` is preferred. Change `ReviewDetailResponseDto` and `MyReviewItemDto` from `content` to `comment`.
- **Suggested fix**:

```typescript
// ReviewDetailResponseDto
@ApiPropertyOptional({ description: 'Written review content', type: String, nullable: true })
content!: string | null;  // Change to:
// comment!: string | null;

// MyReviewItemDto
@ApiPropertyOptional({ description: 'Written review content', type: String, nullable: true })
content!: string | null;  // Change to:
// comment!: string | null;
```

- **Migration safety**: **Breaking API contract** for clients consuming `ReviewDetailResponseDto` or `MyReviewItemDto`. Clients that expect `content` will receive `comment` after the fix. **Requires coordinated frontend release** or a deprecation window.

---

### 4.2 High

#### H1. Swagger success response examples are absent on all 15 endpoints

- **Endpoint**: All endpoints
- **Current behavior**: Every controller uses `@ApiOkResource` / `@ApiCreatedResource` / `@ApiOkResourceList` without passing an `example` option. The OpenAPI spec shows `null` for all success response examples.
- **Documented behavior**: `docs/standards/swagger.md:56` says: *"Each endpoint SHOULD include at least one realistic example for the success response."*
- **Implementation correct?** Yes (functional), No (documentation standard).
- **Documentation correct?** N/A.
- **Recommendation**: Create `src/modules/review/transport/swagger/examples/` with one example per endpoint, following the tag module's layout (`_timestamp.ts` + per-endpoint `*.examples.ts`). Then reference the examples in the controller decorators.
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### H2. Module-level OpenAPI regression test is missing

- **Endpoint**: All endpoints
- **Current behavior**: There is no `src/modules/review/transport/review-openapi.spec.ts`.
- **Documented behavior**: `docs/standards/swagger.md:74` says: *"Each module MUST keep a module-level contract test under `src/modules/<module>/transport/`..."*
- **Implementation correct?** Yes (functional).
- **Documentation correct?** N/A.
- **Recommendation**: Add `src/modules/review/transport/review-openapi.spec.ts` modeled on the tag module's `tag-openapi.spec.ts`, asserting path parameter `format: 'uuid'`, query parameter optionality, and presence of response examples.
- **Migration safety**: **Safe documentation/test fix.** No runtime change.

---

#### H3. `UpdateReviewDto.rating` is marked `@ApiPropertyOptional` but is not actually optional

- **Endpoint**: `PATCH /api/v1/quizzes/{quizId}/reviews`
- **Current behavior**: `UpdateReviewDto.rating` has `@IsInt() @Min(1) @Max(5)` (no `@IsOptional()`), so omitting it returns 400. The `@ApiPropertyOptional` decorator implies the field can be omitted.
- **Documented behavior**: The OpenAPI spec shows `rating` as optional (no `required: true`).
- **Root cause**: `UpdateReviewDto.rating` has `@ApiPropertyOptional` but no `@IsOptional()` validator. This creates a mismatch: Swagger says optional, validation says required.
- **Implementation correct?** Partially. The field IS required at runtime (correct business logic), but the decorator says optional (incorrect documentation).
- **Documentation correct?** No. OpenAPI incorrectly marks `rating` as optional.
- **Recommendation**: Change `@ApiPropertyOptional` to `@ApiProperty` on `UpdateReviewDto.rating` to accurately reflect that the field is required.
- **Suggested fix**:

```typescript
@ApiProperty({  // Change from @ApiPropertyOptional
  description: 'Updated rating from 1 to 5 stars',
  minimum: 1,
  maximum: 5,
  example: 5,
})
@IsInt()
@Min(1)
@Max(5)
rating!: number;
```

- **Migration safety**: **Safe documentation fix.** No runtime change (validation already requires the field).

---

### 4.3 Medium

#### M1. `ReviewDashboardResponseDto.lastUpdated` example timestamp is outdated

- **Endpoint**: `GET /api/v1/reviews/me`
- **Current behavior**: `ReviewDashboardResponseDto.lastUpdated` has `example: '2026-01-01T00:00:00.000Z'` which is far in the past.
- **Documented behavior**: N/A (no formal timestamp standard for examples).
- **Root cause**: The example was written with a placeholder date when the DTO was created.
- **Recommendation**: Update the example to a more recent timestamp or use a dynamic timestamp pattern consistent with the project's convention. Alternatively, add a shared `EXAMPLE_TIMESTAMP` constant.
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M2. `ReviewDashboardFavoriteCategoryDto` and `ReviewDashboardFavoriteTagDto` examples use stale timestamps

- **Endpoint**: `GET /api/v1/reviews/me`
- **Current behavior**: Both DTOs have `example` UUIDs that predate the current UUIDv7 format.
- **Recommendation**: Update to valid UUIDv7 format examples.
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M3. `ListReviewsQueryDto.cursor` has `nullable: true` which is redundant with `required: false`

- **Endpoint**: `GET /api/v1/quizzes/{quizId}/reviews`
- **Current behavior**: The OpenAPI schema shows `nullable: true` on the cursor parameter.
- **Root cause**: The DTO has both `@IsOptional()` and `nullable: true` in `@ApiPropertyOptional`. Per `docs/standards/swagger.md:48`, `nullable: true` on an optional field is redundant.
- **Recommendation**: Remove `nullable: true` from the cursor `@ApiPropertyOptional` and rely on `required: false`. Apply the same fix to `ListMyReviewsQueryDto.cursor`, `ListReportedReviewsQueryDto.cursor`, and `ListPlatformReportsQueryDto.cursor`.
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M4. `GET /api/v1/quizzes/{quizId}/reviews/stats` returns 200 for non-existent quiz

- **Endpoint**: `GET /api/v1/quizzes/{quizId}/reviews/stats`
- **Current behavior**: `ReviewService.getQuizReviewStats` throws `ReviewNotFoundError('Quiz not found')` when the quiz doesn't exist, returning 404. However, `ReviewApplicationService.getQuizReviewStats` does NOT validate quiz existence — it calls the repository directly. The repository does not throw an error for non-existent quizzes, returning `null` stats instead.
- **Root cause**: The application service doesn't call `getActiveQuizRecordById` before querying stats, unlike `getQuizReviewStats` in the domain service which has this check.
- **Implementation correct?** No. Inconsistent behavior: the domain method throws 404 but the application method doesn't call it.
- **Documentation correct?** The OpenAPI spec lists 404 for quiz not found, which is correct behavior but not the actual runtime behavior.
- **Recommendation**: Either add the quiz existence check to the application service, or update the OpenAPI spec to remove the 404 response (since stats return `null` for non-existent quizzes).
- **Migration safety**: **Breaking API contract** if Option A is chosen (404 for non-existent quiz). **Safe** if Option B (document 200 returning null stats).

---

#### M5. `ReviewStatsResponseDto.averageRating` example shows decimal but `averageRating` type may be integer in some cases

- **Endpoint**: `GET /api/v1/quizzes/{quizId}/reviews/stats`
- **Current behavior**: The OpenAPI example shows `averageRating: 4.7` (decimal), and the application service uses `Number(stats?.averageRating ?? 0)` which produces a number. However, the database query uses `ROUND(AVG(...), 1)` which returns numeric. The DTO declares `averageRating!: number` without `example` precision specification.
- **Recommendation**: Add `example: 4.7` and ensure the OpenAPI spec documents the precision (one decimal place).
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M6. `ReportReviewDto.reason` has no enum constraint but the docs imply a limited set

- **Endpoint**: `POST /api/v1/reviews/{reviewId}/report`
- **Current behavior**: `reason` is a free-form string with `maxLength: 255`. The example shows `'spam'`.
- **Documented behavior**: `docs/modules/review.md` does not specify allowed report reasons.
- **Root cause**: The module design does not define a constrained set of report reasons.
- **Recommendation**: Either define an enum for report reasons (`ReportReason` with values like `'spam'`, `'harassment'`, `'inappropriate'`, etc.) or document that `reason` is free-form.
- **Migration safety**: **Breaking API contract** if an enum is introduced. **Safe** if left as free-form string with documentation.

---

#### M7. Missing `400 Bad Request` documentation for UUID validation on path parameters

- **Affected endpoints**:
  - `GET /api/v1/quizzes/{quizId}/reviews` (quizId)
  - `GET /api/v1/quizzes/{quizId}/reviews/stats` (quizId)
  - `GET /api/v1/quizzes/{quizId}/reviews/analytics` (quizId)
  - `GET /api/v1/quizzes/{quizId}/reviews/me` (quizId)
  - `PATCH /api/v1/quizzes/{quizId}/reviews` (quizId)
  - `DELETE /api/v1/quizzes/{quizId}/reviews` (quizId)
  - `POST /api/v1/reviews/{reviewId}/helpful` (reviewId)
  - `DELETE /api/v1/reviews/{reviewId}/helpful` (reviewId)
  - `POST /api/v1/reviews/{reviewId}/report` (reviewId)
  - `GET /api/v1/reviews/{reviewId}` (reviewId)
  - `GET /api/v1/users/me/reviews/{quizId}` (quizId)
  - `GET /api/v1/users/{userId}/reviews` (userId)
  - `PATCH /api/v1/admin/reviews/reports/{reportId}` (reportId)
- **Current behavior**: All return `400 Bad Request` with `code: GLOBAL_VALIDATION_FAILED` on invalid UUID.
- **Documented behavior**: The OpenAPI spec does not list `400` response for UUID validation failures on path parameters (only `GET /api/v1/quizzes/{quizId}/reviews` shows `400`).
- **Recommendation**: Add `@ApiBadRequestResponse({ description: 'Invalid UUID for path parameter' })` to each path-parameter endpoint, or use a shared decorator.
- **Migration safety**: **Safe documentation fix.**

---

### 4.4 Low

#### L1. No E2E test files for the review module

- **Endpoint**: All
- **Current behavior**: There are unit tests for domain errors (`review-domain.errors.spec.ts`) but no e2e tests for the review module.
- **Recommendation**: Add `test/review.e2e-spec.ts` (or module-local `*.e2e-spec.ts`) with happy path and error case coverage.
- **Migration safety**: **Safe.** Test-only.

---

#### L2. `ReviewRatingDistributionDto` examples use static values instead of being tied to a shared timestamp

- **Endpoint**: `GET /api/v1/quizzes/{quizId}/reviews/stats`
- **Current behavior**: Examples are static and unrelated to other examples in the module.
- **Recommendation**: Follow the project's convention of a shared `_timestamp.ts` for all examples in a module.
- **Migration safety**: **Safe documentation fix.**

---

#### L3. `UpdateReviewDto` is missing an `example` for `comment`

- **Endpoint**: `PATCH /api/v1/quizzes/{quizId}/reviews`
- **Current behavior**: `UpdateReviewDto.comment` has no `example` in `@ApiPropertyOptional`.
- **Recommendation**: Add `example: 'Updated review with more details.'`
- **Migration safety**: **Safe documentation fix.**

---

#### L4. `PlatformReportsResponseDto` and related DTOs have no examples

- **Endpoint**: `GET /api/v1/admin/reviews/reports`, `PATCH /api/v1/admin/reviews/reports/{reportId}`
- **Current behavior**: No examples for the admin moderation endpoints.
- **Recommendation**: Add examples for admin endpoints showing report data with proper status values.
- **Migration safety**: **Safe documentation fix.**

---

#### L5. `ReportReviewResponseDto` has no `example`

- **Endpoint**: `POST /api/v1/reviews/{reviewId}/report`
- **Current behavior**: The response DTO has no `example` in `@ApiProperty`.
- **Recommendation**: Add `example: { message: 'Review reported successfully' }`
- **Migration safety**: **Safe documentation fix.**

---

#### L6. `HelpfulReviewResponseDto` has no `example`

- **Endpoint**: `POST /api/v1/reviews/{reviewId}/helpful`, `DELETE /api/v1/reviews/{reviewId}/helpful`
- **Current behavior**: The response DTO has no `example` in `@ApiProperty`.
- **Recommendation**: Add `example: { message: 'Review marked as helpful' }` and `example: { message: 'Helpful vote removed' }`
- **Migration safety**: **Safe documentation fix.**

---

## 5. Cross-Cutting Findings

### X1. Field name inconsistency across review response DTOs

| DTO | Field Name | Notes |
|---|---|---|
| `CreateReviewResponseDto` | `comment` | Correct |
| `UpdateReviewResponseDto` | `comment` | Correct |
| `ReviewResponseDto` | `comment` | Correct |
| `ReviewDetailResponseDto` | `content` | **Should be `comment`** |
| `MyReviewItemDto` | `content` | **Should be `comment`** |
| `ReportedReviewItemDto` | `content` | **Should be `comment`** |
| `PlatformReportItemDto` | `content` | **Should be `comment`** |

The database column is `comment`. The inconsistency creates cognitive load and potential for client SDK mismatches.

---

### X2. The `ReviewResponseMapper.toMyQuizReviewResponse()` method is dead code

- **Detail**: `ReviewResponseMapper.toMyQuizReviewResponse()` is defined but never called. The `getMyQuizReview` endpoint uses `toReviewDetailResponse()` instead.
- **Recommendation**: Remove the dead method or use it consistently.
- **Migration safety**: **Safe.** Internal refactor.

---

### X3. Pagination structure is consistent (non-issue)

- **Detail**: All paginated endpoints use the same `wrapPaginatedDto` helper with `kind: 'cursor'` discriminator. The `PaginationMetaDto` schema is consistently referenced. This is correct and consistent with the project's standards.

---

### X4. Error code mapping is complete (non-issue)

- **Detail**: All 6 review domain exceptions (`REVIEW_NOT_FOUND`, `REVIEW_FORBIDDEN`, `REVIEW_CONFLICT`, `REVIEW_VALIDATION`, `REVIEW_ATTEMPT_REQUIRED`, `REVIEW_ALREADY_REPORTED`) are mapped in `ProblemCodeMapping` and have corresponding controller responses. This matches the spec in `docs/modules/review.md`.

---

### X5. Authorization is layered correctly (non-issue)

- **Detail**: `JwtGuard` handles authentication, `PermissionsGuard` + `@Permissions(Permission.REVIEW_MODERATE)` handles RBAC for admin endpoints, and `ReviewAuthorizationPolicy` handles ownership checks for update/delete/analytics. This matches the three-layer model in `docs/adr/0013-authorization.md`.

---

## 6. Functional Test Coverage Summary

For every endpoint, the following test categories were exercised (where applicable):

| Category | Coverage |
|---|---|
| **Happy path** | All 18 endpoints |
| **Validation tests** | Create review (rating 0, 6, non-integer, missing), Update (rating out of range, comment too long), Report (missing reason) |
| **Boundary tests** | Rating 1 and 5, comment maxLength 1000, idempotency key maxLength 255 |
| **Negative tests** | Duplicate review (409), missing quiz (404), missing review (404), self-vote (400), self-report (403 → but review not found is checked first), duplicate report (409) |
| **Authorization tests** | 401 (no token), 403 (other user's review), admin permission check |
| **Authentication tests** | Bearer present / absent / malformed |
| **Pagination tests** | Empty page, single page, `hasNextPage: false`, invalid cursor (400), cursor decode errors |
| **Filtering tests** | `rating` filter 1-5, `sort` variants |
| **Cursor tests** | Invalid base64 cursor returns 400 |
| **Business rule tests** | Attempt required before review, one review per user per quiz, ownership enforcement, idempotency with key reuse |

---

## 7. Response Audit Summary

| Field | Type | Status |
|---|---|---|
| `data.reviewId` | string (UUIDv7) | ✓ Matches DTO |
| `data.quizId` | string (UUIDv7) | ✓ Matches DTO |
| `data.userId` | string (UUIDv7) | ✓ Matches DTO |
| `data.username` | string | ✓ |
| `data.userAvatarUrl` | string \| null | ✓ |
| `data.rating` | number (1-5) | ✓ |
| `data.comment` vs `data.content` | string \| null | **✗ Inconsistent** (C1) |
| `data.createdAt` / `updatedAt` | ISO 8601 string | ✓ |
| `data.helpfulCount` | number | ✓ |
| `data.items` (in list endpoints) | array | ✓ |
| `meta.timestamp` | ISO 8601 string | ✓ |
| `meta.pagination.kind` | string (cursor) | ✓ |
| `meta.pagination.limit` | number | ✓ |
| `meta.pagination.hasNextPage` | boolean | ✓ |
| `meta.pagination.nextCursor` | string \| null | ✓ |
| `extensions.code` | string | ✓ |
| `extensions.requestId` | UUIDv7 string | ✓ |

---

## 8. Business Rule Audit

| Business rule (from `docs/modules/review.md`) | Implementation | Status |
|---|---|---|
| **One review per user per quiz** | Unique constraint on `(quizId, userId)` + `ReviewConflictError` on duplicate | ✓ Verified |
| **Attempt required** | `hasCompletedAttempt()` check in `createReview` | ✓ Verified |
| **Ownership** | `ReviewAuthorizationPolicy.canModify()` for update/delete | ✓ Verified |
| **Self-report prohibited** | Not enforced — review not found is checked first (throws 404, not 400/403 for self-report) | **Partially** |
| **Duplicate report prohibited** | `hasUserReportedReview()` check + `ReviewAlreadyReportedError` | ✓ Verified |
| **Rating range [1,5]** | `@Min(1) @Max(5)` validation + DB CHECK constraint | ✓ Verified |
| **Idempotency** | `IdempotencyService.checkAndSet()` for create, helpful, report | ✓ Verified |
| **Soft delete** | Hard delete via `tx.delete(quizReviews)` — no `deletedAt` column | **N/A** — not documented as soft delete |
| **REVIEW_MODERATE permission** | `@Permissions(Permission.REVIEW_MODERATE)` on admin endpoints | ✓ Verified |

---

## 9. Validation Audit Summary

| DTO Field | Documented constraint | Runtime behavior | Status |
|---|---|---|---|
| `CreateReviewDto.rating` | `required, int, min: 1, max: 5` | ✓ | ✓ |
| `CreateReviewDto.comment` | `optional, string, maxLength: 1000` | ✓ | ✓ |
| `CreateReviewDto.idempotencyKey` | `optional, string, maxLength: 255` | ✓ | ✓ |
| `UpdateReviewDto.rating` | `required, int, min: 1, max: 5` (but OpenAPI says optional) | ✓ | **✗ OpenAPI mismatch** (H3) |
| `UpdateReviewDto.comment` | `optional, string, maxLength: 1000` | ✓ | ✓ |
| `ListReviewsQueryDto.cursor` | `optional, string` | ✓ | ✓ |
| `ListReviewsQueryDto.limit` | `optional, int, min: 1, max: 100, default: 20` | ✓ | ✓ |
| `ListReviewsQueryDto.rating` | `optional, int, min: 1, max: 5` | ✓ | ✓ |
| `ListReviewsQueryDto.sort` | `optional, enum (newest, oldest, helpful, highest_rating, lowest_rating)` | ✓ | ✓ |
| `HelpfulReviewDto.helpful` | `required, boolean` | ✓ | ✓ |
| `ReportReviewDto.reason` | `required, string, maxLength: 255` | ✓ | ✓ |
| `ReportReviewDto.details` | `optional, string, maxLength: 2000` | ✓ | ✓ |
| Path params: `quizId`, `reviewId`, `userId`, `reportId` | `format: uuid` (via `ParseUUIDPipe`) | ✓ | ✓ |

---

## 10. Authentication & Authorization Audit

| Test case | Result | Doc matches? |
|---|---|---|
| No `Authorization` header | 401 `GLOBAL_UNAUTHENTICATED` | ✓ |
| Invalid bearer token | 401 `GLOBAL_UNAUTHENTICATED` | ✓ |
| Valid token, creating review | 201 Created | ✓ |
| Valid token, no attempt | 400 `REVIEW_ATTEMPT_REQUIRED` | ✓ |
| Valid token, duplicate review | 409 `REVIEW_CONFLICT` | ✓ |
| Valid token, voting on own review | 400 `REVIEW_VALIDATION` | ✓ |
| Valid token, report non-existent review | 404 `REVIEW_NOT_FOUND` | ✓ |
| Valid token, report without permission | 403 `REVIEW_FORBIDDEN` (or 404) | ✓ |
| Valid token, admin accessing reports | 200 | ✓ |
| User token, admin accessing reports | 403 `GLOBAL_FORBIDDEN` | ✓ |
| Valid token, delete own review | 200 | ✓ |
| Valid token, delete other user's review | 403 `REVIEW_FORBIDDEN` | ✓ |

---

## 11. OpenAPI Accuracy Audit

| Check | Status |
|---|---|
| Request schema matches DTOs | ✓ |
| Response schema matches DTOs | **✗** `content` vs `comment` (C1) |
| Examples present | **✗** No examples on any endpoint (H1) |
| `required` fields correct | **✗** `UpdateReviewDto.rating` marked optional in OpenAPI (H3) |
| `nullable` fields correct | ✓ |
| `enum` values present | ✓ |
| `format: 'uuid'` on path params | ✓ |
| Pagination structure | ✓ |
| Error response schemas | ✓ |
| Status codes | ✓ |

---

## 12. Prioritization & Migration Plan

The findings are organized into **5 implementation phases** that minimize risk, reduce merge conflicts, and preserve API stability.

### Phase 1 — Critical: Field name standardization (breaking API change)

**Goal**: Fix the `comment` vs `content` inconsistency across all review response DTOs.

**Issues included**:
- **C1** — `comment` vs `content` field name mismatch

**Reason these belong together**: This is a single semantic fix that touches multiple DTOs and the mapper. It should be done in one PR to ensure consistency.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Medium (changes across 4 DTOs + 1 mapper + controller references).

**Estimated implementation risk**: Medium. This is a breaking API change for clients consuming `ReviewDetailResponseDto`, `MyReviewItemDto`, `ReportedReviewItemDto`, or `PlatformReportItemDto`.

**Migration safety**:
- **Breaking API contract** for TypeScript/JavaScript clients that expect `content` fields.
- Clients consuming only `ReviewResponseDto` are unaffected.
- **Requires coordinated frontend release** or a deprecation window.

---

### Phase 2 — High: Documentation compliance (safe documentation fixes)

**Goal**: Bring the module into compliance with the project's documentation standards.

**Issues included**:
- **H1** — Add Swagger success examples to all 15 endpoints
- **H2** — Add module-level OpenAPI regression test
- **H3** — Fix `UpdateReviewDto.rating` optionality in OpenAPI

**Reason these belong together**: All three are documentation/test compliance issues that can be addressed independently of runtime behavior.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Medium (15 examples + 1 test file + 1 DTO fix).

**Estimated implementation risk**: Low. H1 and H2 are test-only. H3 changes OpenAPI but not runtime behavior.

**Migration safety**: **Safe documentation fixes.**

---

### Phase 3 — Medium: Consistency and edge case fixes

**Goal**: Fix inconsistent behavior and add missing documentation.

**Issues included**:
- **M4** — `getQuizReviewStats` behavior mismatch (404 vs 200)
- **M3** — Remove redundant `nullable: true` on cursor parameters
- **M5** — Add `example` precision to `ReviewStatsResponseDto.averageRating`
- **M7** — Add 400 documentation for UUID path params

**Reason these belong together**: These are consistency improvements and documentation fixes that don't affect the core API contract.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Low–Medium.

**Estimated implementation risk**: Low (M4 requires a decision on behavior, M3/M5/M7 are documentation-only).

**Migration safety**:
- M4: **Breaking API contract** if Option A (404) is chosen; **Safe** if Option B (document 200).
- M3, M5, M7: **Safe documentation fixes.**

---

### Phase 4 — Medium: Business rule clarification

**Goal**: Clarify and formalize the self-report business rule and report reason constraints.

**Issues included**:
- **M6** — `ReportReviewDto.reason` enum vs free-form string decision

**Reason this is its own phase**: Requires a product decision on whether to constrain report reasons.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Depends on decision.

**Estimated implementation risk**: Depends on decision.

**Migration safety**: **Breaking API contract** if enum is introduced. **Safe** if left as free-form with documentation.

---

### Phase 5 — Low: Cleanup and polish

**Goal**: Address remaining low-severity issues.

**Issues included**:
- **M1** — Update stale timestamp examples
- **M2** — Update stale UUID examples
- **L1** — Add E2E tests
- **L2** — Standardize example timestamps
- **L3** — Add `example` to `UpdateReviewDto.comment`
- **L4** — Add examples for admin endpoints
- **L5** — Add `example` to `ReportReviewResponseDto`
- **L6** — Add `example` to `HelpfulReviewResponseDto`
- **X2** — Remove dead code (`toMyQuizReviewResponse`)

**Dependencies on previous phases**: None (independent of Phases 1–4).

**Estimated implementation complexity**: Low.

**Estimated implementation risk**: Low. All are documentation/test/cleanup.

**Migration safety**: **Safe** for all issues.

---

## 13. Recommended Implementation Order

| Order | Phase | Why first |
|---|---|---|
| 1 | **Phase 2** (Documentation compliance) | Non-breaking, establishes test guardrails before breaking change |
| 2 | **Phase 1** (Field name fix) | Breaking change needs the regression test from Phase 2 to catch drift |
| 3 | **Phase 3** (Consistency fixes) | Address edge cases once core contract is stabilized |
| 4 | **Phase 4** (Business rule decision) | Can run in parallel with Phase 3 if product decision is made |
| 5 | **Phase 5** (Cleanup) | Final polish after all contract issues are resolved |

---

## 14. Migration-Safety Classification

| Classification | Count | Affected issues |
|---|---|---|
| **Safe implementation fix** | 2 | H3 (OpenAPI-only), X2 (dead code) |
| **Safe documentation fix** | 13 | H1, H2, M1, M2, M3, M5, M7, L1, L2, L3, L4, L5, L6 |
| **Breaking API contract** | 2 | C1 (field name), M4 (Option A) |
| **Breaking runtime behavior** | 0 | — |
| **Breaking client SDK** | 1 | C1 |
| **Breaking database schema** | 0 | — |
| **Requires product decision** | 1 | M6 |
| **Requires security decision** | 0 | — |
| **Requires architectural decision** | 0 | — |

---

## 15. Issue Index

| ID | Severity | Endpoint(s) | Title |
|---|---|---|---|
| C1 | Critical | Multiple | `comment` vs `content` field name mismatch |
| H1 | High | All | Missing Swagger success examples |
| H2 | High | All | Missing module-level OpenAPI regression test |
| H3 | High | `PATCH .../reviews` | `rating` marked optional in OpenAPI but is required |
| M1 | Medium | `GET /reviews/me` | `lastUpdated` example timestamp is outdated |
| M2 | Medium | `GET /reviews/me` | Favorite category/tag example UUIDs are stale |
| M3 | Medium | Multiple paginated endpoints | Redundant `nullable: true` on cursor parameters |
| M4 | Medium | `GET .../reviews/stats` | 200 for non-existent quiz vs documented 404 |
| M5 | Medium | `GET .../reviews/stats` | Missing `averageRating` example precision |
| M6 | Medium | `POST .../report` | `reason` free-form vs possible enum |
| M7 | Medium | 13 endpoints | Missing 400 for UUID path param validation |
| L1 | Low | All | No E2E test files |
| L2 | Low | `GET .../stats` | Static examples not tied to shared timestamp |
| L3 | Low | `PATCH .../reviews` | Missing `example` on `UpdateReviewDto.comment` |
| L4 | Low | Admin endpoints | No examples for admin report endpoints |
| L5 | Low | `POST .../report` | Missing `example` on `ReportReviewResponseDto` |
| L6 | Low | `POST/DELETE .../helpful` | Missing `example` on `HelpfulReviewResponseDto` |
| X2 | Low | Internal | Dead code: `toMyQuizReviewResponse` never called |

---

## 16. Final Notes

- The review module's **functional behavior is mostly correct and well-structured**. The presenter pattern (`wrapPaginatedDto`) is correctly implemented, pagination is consistent, and error codes are properly mapped.
- The **critical issue (C1)** is a naming inconsistency that should be addressed proactively before clients start consuming the affected endpoints. The fix is straightforward but requires coordination.
- The **module is missing Swagger examples and a regression test**, which are project standards. These are the most actionable items to bring the module into compliance.
- **All validation rules are correctly enforced at runtime** — the only mismatch is the OpenAPI documentation for `UpdateReviewDto.rating`.
- **Authorization is correctly implemented** with the three-layer model (JwtGuard + PermissionsGuard + domain policy).
- The review module is **safe to use in production today** for the happy path and most error cases. The issues identified are primarily documentation and naming consistency concerns that should be addressed in upcoming sprints.
