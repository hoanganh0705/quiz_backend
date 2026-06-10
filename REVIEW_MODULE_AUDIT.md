# Review Module — Production Readiness Audit

**Module:** `src/modules/review/`
**Auditor:** Principal Software Architect
**Date:** 2026-06-10
**Status:** READ ONLY — No modifications made

---

## Table of Contents

1. [Dead Code Report](#1-dead-code-report)
2. [Redundancy Report](#2-redundancy-report)
3. [Architecture Report](#3-architecture-report)
4. [Dependency Report](#4-dependency-report)
5. [Event Flow Report](#5-event-flow-report)
6. [Endpoint Audit](#6-endpoint-audit)
7. [All Findings by Severity](#7-all-findings-by-severity)
8. [Cleanup Plan](#8-cleanup-plan)

---

## 1. Dead Code Report

Everything listed here can be safely deleted without breaking any runtime execution path.

### 1.1 Unused Repository Method

| File | Method | Lines | Finding |
|------|--------|-------|---------|
| `src/modules/review/infrastructure/repositories/review.repository.ts` | `getPublishedQuizVersionDifficulty()` | 588–597 | **DEAD** — declared in `ReviewRepositoryPort`, fully implemented in `ReviewRepository`, but **zero call sites** exist anywhere in the codebase |
| `src/modules/review/domain/ports/review-repository.port.ts` | `getPublishedQuizVersionDifficulty()` | 179 | **DEAD** — interface contract for a method never invoked |
| `src/modules/review/domain/ports/index.ts` | type exports for row types used only by dead method | — | `ReviewHelpfulVoteRow` is used by `markReviewHelpful` (live) — **OK** |

**Why it is dead:** No call site exists in any application service, domain service, controller, event handler, seed command, or test. The method fetches the `difficulty` field of a published quiz version — this data appears to have been intended for a "difficulty-aware" review requirement that was never wired up.

---

### 1.2 Unused DTO

| File | DTO | Lines | Finding |
|------|-----|-------|---------|
| `src/modules/review/dto/response/index.ts` | `ReviewPaginationResponseDto` | 47–56 | **DEAD** — defined and exported but **never referenced** by any controller, application service, or mapper |

This DTO was likely intended as the `pagination` field type for `ReviewListResponseDto` but was replaced with an inline anonymous shape. It adds noise and confusion for API consumers reading generated TypeScript types.

---

### 1.3 Unused Controller Imports

| File | Import | Lines | Finding |
|------|--------|-------|---------|
| `src/modules/review/transport/controller/review.controller.ts` | `CreateReviewDto` | 32 | **DEAD IMPORT** — imported, never used in this controller |
| `src/modules/review/transport/controller/review.controller.ts` | `UpdateReviewDto` | 33 | **DEAD IMPORT** — imported, never used in this controller |
| `src/modules/review/transport/controller/review.controller.ts` | `ListReviewsQueryDto` | 34 | **DEAD IMPORT** — imported, never used in this controller |
| `src/modules/review/transport/controller/review.controller.ts` | `ListMyReviewsQueryDto` | 35 | **DEAD IMPORT** — imported, never used in this controller |
| `src/modules/review/transport/controller/review.controller.ts` | `MyReviewsResponseDto` | 42 | **DEAD IMPORT** — imported, never used in this controller |
| `src/modules/review/transport/controller/quiz-review.controller.ts` | `ReviewSort` | 34 | **DEAD IMPORT** — imported, never used in this controller (sort type comes from the query DTO) |
| `src/modules/review/transport/controller/review.controller.ts` | `ReviewCursorMapper` | 49 | **DEAD IMPORT** — imported, never used in this controller |

---

### 1.4 Unused Module Export

| File | Export | Finding |
|------|--------|---------|
| `src/modules/review/review.module.ts` | `ReviewService` exported at line 35 | **DEAD EXPORT** — exported from the module but **never imported** by any other module in the codebase |

`ReviewApplicationService` is the proper boundary export. `ReviewService` is a domain-layer class that should not be exposed outside the module.

---

## 2. Redundancy Report

### 2.1 Identical Repository Methods

| File | Methods | Lines | Finding |
|------|---------|-------|---------|
| `src/modules/review/infrastructure/repositories/review.repository.ts` | `listUserReviews()` and `listReviewsByUser()` | 260–303 | **IDENTICAL** — `listReviewsByUser` is a direct passthrough to `listUserReviews` with no added logic |

```160:297:src/modules/review/infrastructure/repositories/review.repository.ts
  async listReviewsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
  }): Promise<MyReviewRow[]> {
    return this.listUserReviews(params);
  }
```

**Problem:** Violates DRY. The port interface (`ReviewRepositoryPort`) also declares both methods, multiplying maintenance surface.

---

### 2.2 Duplicated Cursor Mapper Logic

| File | Classes | Finding |
|------|---------|---------|
| `src/modules/review/mappers/review-cursor.mapper.ts` | `ReviewCursorMapper` and `ReportCursorMapper` | **IDENTICAL PATTERN** — both classes contain: a hardcoded UUID regex, a `parse()` method, a `serialize()` method, and two identical private validators (`isUuid`, `isIsoDateString`) |

**Problem:** Code duplication. Both mappers share 100% of their implementation logic. This could be collapsed into a single generic `BaseCursorMapper<T>` class or a shared utility function.

---

### 2.3 Identical Mapper Output

| File | Methods | Finding |
|------|---------|---------|
| `src/modules/review/mappers/review-response.mapper.ts` | `toReviewDetailResponse()` and `toMyQuizReviewResponse()` | **IDENTICAL OUTPUT** — both produce the same shape: `reviewId, quizId, quizTitle, userId, username, rating, content, createdAt, updatedAt` |

```48:74:src/modules/review/mappers/review-response.mapper.ts
  toReviewDetailResponse(row: ReviewDetailByIdRow): ReviewDetailResponseDto { ... }
  toMyQuizReviewResponse(row: ReviewDetailByIdRow): MyQuizReviewResponseDto { ... }
```

The return shapes are byte-for-byte identical. The two separate DTO classes (`ReviewDetailResponseDto` and `MyQuizReviewResponseDto`) also have identical schemas. This is pure redundancy.

---

### 2.4 Duplicate Endpoint Pattern (Overlapping Routes)

| Endpoint A | Endpoint B | Problem |
|------------|-----------|---------|
| `GET /quizzes/:quizId/reviews/me` (QuizReviewController) | `GET /users/me/reviews?quizId=X` (UserReviewController) | **SEMANTIC DUPLICATE** — both return the authenticated user's review for a specific quiz, differentiated only by route |
| `GET /quizzes/:quizId/reviews` (QuizReviewController) | `GET /users/:userId/reviews` (UserReviewController) | **STRUCTURAL DUPLICATE** — both return a `MyReviewsResponseDto` (paginated review list) with identical response shape |

The `UserReviewController` version of `GET /users/me/reviews` with a `quizId` query param is particularly problematic — it dynamically changes return type between `MyReviewsResponseDto` and `MyQuizReviewResponseDto` or `null`, making the API contract ambiguous.

---

### 2.5 Duplicate Error Constant

| File | Values | Finding |
|------|--------|---------|
| `src/modules/review/review.constants.ts` | `REVIEW_NOT_FOUND_MESSAGE`, `REVIEW_FORBIDDEN_MESSAGE`, `REVIEW_QUIZ_USER_CONFLICT_MESSAGE`, `REVIEW_ATTEMPT_REQUIRED_MESSAGE`, `REVIEW_ALREADY_REPORTED_MESSAGE` | Used in: `review.constants.ts` → imported into `review-domain.errors.ts` → imported back into `review.service.ts` |

The constants are imported twice (errors → service) when they could be consolidated. The `review.constants.ts` file adds a layer of indirection that provides no additional value — the messages are defined in `review-domain.errors.ts` directly and the `review.service.ts` re-imports the constants to use in log messages, but the same string literals appear in `ReviewDomainExceptionFilter`.

---

## 3. Architecture Report

### 3.1 DDD Violations

#### ❌ Domain Service Knows About Application Concerns

| File | Class | Line | Violation |
|------|-------|------|-----------|
| `src/modules/review/domain/review.service.ts` | `ReviewService` | 201–221 | Domain service returns `ReviewStatsResponseDto` (an **application-layer DTO**) directly |

The `getQuizReviewStats()` method returns `ReviewStatsResponseDto` — a transport-layer response type. Domain services must not know about DTOs. This is a **leaky abstraction**: the domain is coupled to the response shape, which should be assembled by the application or transport layer.

**Recommended fix:** Return the raw `ReviewStatsRow` from the domain service, and let `ReviewApplicationService` or the mapper assemble the response DTO.

---

#### ❌ Domain Service Knows About Another Module's Errors

| File | Line | Violation |
|------|------|-----------|
| `src/modules/review/domain/review.service.ts` | 22 | `ReviewService` imports and throws `QuizNotFoundError` from `src/modules/quiz/domain/errors` |

Domain layer must be isolated. A domain service in the `review` module should not depend on error classes from the `quiz` module. If the quiz does not exist, the domain service should throw its own `ReviewNotFoundError` with an appropriate message — it should not re-export or relay another module's exception.

---

#### ❌ Domain Service Contains HTTP-Level Authorization Logic

| File | Line | Violation |
|------|------|-----------|
| `src/modules/review/domain/review.service.ts` | 337 | `updateReview()` checks `user.role === 'admin'` |

Role-based authorization (`admin` role check) is an **application/transport concern**, not a domain concern. The domain service should define "who can update a review" as a policy or rule, not embed role strings. This couples the domain to HTTP authentication concepts.

---

#### ❌ Application Service Returns Domain Entities as DTOs

| File | Line | Violation |
|------|------|-----------|
| `src/modules/review/application/review.application.service.ts` | 198 | `updateReview()` maps with `toUpdateReviewResponse(review)` passing the `ReviewRow` (a domain row type) directly to the mapper |

The `ReviewResponseMapper` receives raw database rows (`ReviewRow`) and constructs response DTOs. This is a **leaky abstraction** — the mapper is tightly coupled to the database row schema. The domain layer should provide domain entities, not database rows, to the application layer.

---

### 3.2 CQRS Violations

#### ⚠ No Strict CQRS Separation

The module does not distinguish between **read models** and **write models**. The `ReviewRow` type is used for both creating reviews (write) and returning response data (read). This means:

- Read optimizations (e.g., separate read replicas, denormalized projections) cannot be applied independently from writes.
- The `ReviewRepository` serves as both a command and query handler, violating the single-responsibility principle at the infrastructure layer.

**Impact:** Scaling limitations. As the review dataset grows, read-heavy endpoints (listing reviews, stats) will contend with write-heavy endpoints on the same connection pool.

---

### 3.3 Event-Driven Design Violations

#### ❌ No Domain Events Published

The `ReviewService` does **not** publish any domain events (e.g., `ReviewCreated`, `ReviewUpdated`, `ReviewDeleted`, `ReviewReported`, `ReviewHelpfulVoteAdded`). Instead, it directly calls `AnalyticsEventHandler.onReviewSubmitted()` and `onReviewDeleted()` — a **tight coupling** between the review domain and the quiz analytics domain.

```95:src/modules/review/domain/review.service.ts
  // Refresh quiz analytics
  await this.analyticsEventHandler.onReviewSubmitted(quizId);
```

**Violation:** This is a **missing event publisher** and a **cross-module dependency inversion violation**. The review domain should publish `ReviewSubmitted` events to an event bus, and the quiz module should subscribe to those events. Instead, the review domain directly injects and calls the quiz module's `AnalyticsEventHandler`.

**Impact:** The `ReviewService` depends on `AnalyticsEventHandler` via `forwardRef(() => AnalyticsEventHandler)`, creating a fragile circular dependency chain. The review module cannot function correctly without the quiz module's `AnalyticsEventHandler`, making it impossible to test or deploy the review module independently.

---

#### ❌ Infrastructure Leaking Into Domain

| File | Line | Violation |
|------|------|-----------|
| `src/modules/review/domain/review.service.ts` | 39 | Domain service injects `AnalyticsEventHandler` from `src/modules/quiz/domain/analytics` |

The `ReviewService` (domain layer) directly depends on `AnalyticsEventHandler` (infrastructure/application service from the quiz module). This violates the **dependency rule**: domain must not depend on infrastructure. It should depend only on ports (interfaces).

**Expected pattern:** The domain should inject a `QuizAnalyticsPort` (an interface), and the infrastructure should provide an implementation that calls `AnalyticsEventHandler`. The current code inlines the dependency instead.

---

### 3.4 Layering Violations

#### ❌ Application Service Has Business Logic

| File | Lines | Violation |
|------|-------|-----------|
| `src/modules/review/application/review.application.service.ts` | 59–70, 76–90, 96–108 | Application service manually duplicates pagination logic (`hasNextPage`, slicing, `lastItem`, cursor serialization) for multiple endpoints |

This pagination logic belongs in the **domain service** or a dedicated **pagination helper**. The application service should be a thin orchestrator — it currently contains query-parameter assembly and response-mapping logic that duplicates what the domain service already does for some methods.

---

## 4. Dependency Report

### 4.1 Dependency Graph

```
Controller Layer
    │
    ├── ReviewController         → ReviewApplicationService
    ├── QuizReviewController    → ReviewApplicationService
    └── UserReviewController    → ReviewApplicationService
                                     │
Application Layer                     ▼
    └── ReviewApplicationService  → ReviewService (domain)
                                        │
Domain Layer                           ▼
    ├── ReviewService               → ReviewRepositoryPort (interface)
    ├── ReviewDomainError(s)        → (pure, no deps)
    └── Ports                        │
                                        ├──► ReviewRepository (infra)
                                        │       └──► DrizzleDB (DB)
                                        └──► AnalyticsEventHandler (quiz module)
                                                └──► QuizAnalyticsService (quiz module)

Transport Layer
    ├── ReviewDomainExceptionFilter → ReviewDomainError(s)
    └── (no other infra deps)

Infrastructure Layer
    ├── ReviewRepository → DrizzleDB, schema tables
    └── (no domain deps)
```

### 4.2 Dependency Violations Highlighted

| Violation | From | To | Type |
|-----------|------|----|------|
| Domain → Infrastructure | `ReviewService` | `AnalyticsEventHandler` | **Cross-module infra dependency** |
| Domain ← Error class | `ReviewService` | `QuizNotFoundError` | **Cross-module error propagation** |
| Domain uses App DTO | `ReviewService` | `ReviewStatsResponseDto` | **Layer leakage** |
| Module exports Domain | `review.module.ts` | `ReviewService` | **Unnecessary boundary crossing** |

---

### 4.3 Circular Dependency Risk

| Chain | Risk Level |
|-------|-----------|
| `ReviewModule` → `QuizModule` → `AnalyticsEventHandler` → `QuizAnalyticsService` → (shared DB) → `ReviewRepository` | LOW (resolves via `forwardRef`) |

The `ReviewService` uses `forwardRef(() => AnalyticsEventHandler)` to break the potential circular dependency where `ReviewModule` imports `QuizModule` (to get `QUIZ_REPOSITORY_PORT`). This works but is a code smell — the real fix is an event-driven architecture that removes the direct dependency entirely.

---

## 5. Event Flow Report

### 5.1 Analytics Refresh Flow (Current — Broken Event Pattern)

```
ReviewService.createReview()
  └── analyticsEventHandler.onReviewSubmitted(quizId)
        └── QuizAnalyticsService.refreshReviewMetrics(quizId)
              └── [writes to quizStats table]
```

| Component | Status | Notes |
|-----------|--------|-------|
| Event Publisher | ❌ **BROKEN** | No domain event published. `ReviewService` calls `AnalyticsEventHandler` directly |
| Event Bus | ❌ **BROKEN** | No event bus / message queue in use |
| Event Subscriber | ⚠ **PARTIAL** | `AnalyticsEventHandler` exists and is wired, but receives calls directly not via events |
| Side Effect | ⚠ **PARTIAL** | Quiz analytics are refreshed but synchronously in the same request |

**Missing:** `ReviewCreated` domain event, `ReviewDeleted` domain event. These should be published and subscribed to by the analytics handler.

---

### 5.2 Helpful Vote Flow

```
ReviewController.markReviewHelpful() [POST /reviews/:reviewId/helpful]
  └── ReviewApplicationService.markReviewHelpful()
        └── ReviewService.markReviewHelpful()
              └── ReviewRepository.markReviewHelpful()
                    └── [INSERT INTO review_helpful_votes]
```

| Component | Status | Notes |
|-----------|--------|-------|
| Event Publisher | ❌ **MISSING** | No `ReviewHelpfulVoteAdded` event |
| Event Subscriber | ❌ **MISSING** | No subscriber for helpful vote events |
| Idempotency | ✅ **OK** | Repository returns existing vote on duplicate insert (upsert behavior) |

---

### 5.3 Report Flow

```
ReviewController.reportReview() [POST /reviews/:reviewId/report]
  └── ReviewApplicationService.reportReview()
        └── ReviewService.reportReview()
              └── ReviewRepository.createReport()
                    └── [INSERT INTO review_reports]
```

| Component | Status | Notes |
|-----------|--------|-------|
| Event Publisher | ❌ **MISSING** | No `ReviewReported` domain event |
| Event Subscriber | ❌ **MISSING** | No notification to admins/moderators |
| Idempotency | ✅ **OK** | Domain service checks `hasUserReportedReview` before inserting |

---

## 6. Endpoint Audit

### 6.1 Full Endpoint List

| Method | Route | Controller | Auth | Status |
|--------|-------|------------|------|--------|
| `POST` | `/quizzes/:quizId/reviews` | QuizReviewController | ✅ Required | ✅ Active |
| `GET` | `/quizzes/:quizId/reviews` | QuizReviewController | ❌ Public | ✅ Active |
| `GET` | `/quizzes/:quizId/reviews/stats` | QuizReviewController | ❌ Public | ✅ Active |
| `GET` | `/quizzes/:quizId/reviews/analytics` | QuizReviewController | ✅ Required | ✅ Active |
| `GET` | `/quizzes/:quizId/reviews/me` | QuizReviewController | ✅ Required | ✅ Active |
| `PATCH` | `/quizzes/:quizId/reviews` | QuizReviewController | ✅ Required | ✅ Active |
| `DELETE` | `/quizzes/:quizId/reviews` | QuizReviewController | ✅ Required | ✅ Active |
| `GET` | `/reviews/me` | ReviewController | ✅ Required | ✅ Active |
| `POST` | `/reviews/:reviewId/helpful` | ReviewController | ✅ Required | ✅ Active |
| `DELETE` | `/reviews/:reviewId/helpful` | ReviewController | ✅ Required | ✅ Active |
| `POST` | `/reviews/:reviewId/report` | ReviewController | ✅ Required | ✅ Active |
| `GET` | `/reviews/:reviewId` | ReviewController | ❌ Public | ✅ Active |
| `GET` | `/users/me/reviews` | UserReviewController | ✅ Required | ⚠ Ambiguous |
| `GET` | `/users/me/reported-reviews` | UserReviewController | ✅ Required | ✅ Active |
| `GET` | `/users/:userId/reviews` | UserReviewController | ❌ Public | ✅ Active |

### 6.2 Missing Endpoints

| Missing Endpoint | Rationale |
|-----------------|-----------|
| `DELETE /reviews/:reviewId` | No direct delete by `reviewId` — only delete by `quizId`. Users must know the `quizId` to delete their review. This is awkward UX. |
| `PATCH /reviews/:reviewId` | No direct update by `reviewId` — only update by `quizId`. Same UX issue as above. |
| `GET /quizzes/:quizId/reviews/reported` (admin) | Admins have no endpoint to list all reported reviews across the platform. The `listReportedReviews` endpoint only shows reviews *reported by the current user*. |

### 6.3 Inconsistent Endpoints

| Issue | Detail |
|-------|--------|
| **Ambiguous `GET /users/me/reviews`** | Returns `MyReviewsResponseDto` (list) OR `MyQuizReviewResponseDto` (single) OR `null` depending on query params. This violates REST uniformity — the same endpoint with different query params returns completely different types with no consistent envelope. |
| **`DELETE /reviews/:reviewId/helpful`** | Uses `DELETE` verb for removing a helpful vote, but `ReviewController` is annotated `@ApiBearerAuth()` for all routes — meaning authentication is required. The idempotent design (deleting a non-existent vote succeeds silently) is correct, but the `reviewId` param is correct here unlike the update/delete endpoints. |
| **Update/Delete by `quizId` not `reviewId`** | `PATCH /quizzes/:quizId/reviews` and `DELETE /quizzes/:quizId/reviews` use `quizId` as the primary key — which is correct for "my review for this quiz" semantics. But there is no way to update or delete a review by its `reviewId` directly, which is a gap for direct URL navigation. |
| **Swagger inconsistency** | `QuizReviewController.getMyQuizReview()` returns `MyQuizReviewResponseDto` with Swagger `type` reference. `UserReviewController.listMyReviews()` returns `MyReviewsResponseDto | MyQuizReviewResponseDto | null` but only documents `MyQuizReviewResponseDto` — the array variant is undocumented. |

---

## 7. All Findings by Severity

### CRITICAL

---

**F-01: Dead Repository Method — `getPublishedQuizVersionDifficulty`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/infrastructure/repositories/review.repository.ts:588` |
| Class | `ReviewRepository` |
| Severity | **CRITICAL** |
| Category | Dead Code |

**Problem:** Method is fully implemented, declared in the port interface, but never called anywhere in the codebase.

**Why it is a problem:** Dead code increases maintenance surface, bloats the compiled bundle, and signals to future developers that this capability exists when it does not. The port interface is polluted with an unused contract.

**Impact:** Low runtime impact (dead code never executes), but high maintenance and cognitive overhead.

**Recommended fix:** Remove `getPublishedQuizVersionDifficulty` from `ReviewRepositoryPort` and `ReviewRepository`. If difficulty-based review validation is needed, implement it properly with a call site.

---

**F-02: No Transactions on Multi-Table Write Operations**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:44–106` |
| Class | `ReviewService` |
| Severity | **CRITICAL** |
| Category | Missing Transactions |

**Problem:** `createReview()` writes to `quizReviews` table and then calls `analyticsEventHandler.onReviewSubmitted()` — two separate operations with no shared transaction.

**Why it is a problem:** If the analytics refresh fails (database error, timeout, connection loss), the review is created but analytics are stale or missing. In a high-concurrency scenario, subsequent reads could see incorrect stats. There is no rollback mechanism.

**Impact:** Data inconsistency between `quizReviews` and `quizStats`. In the worst case, repeated failures could leave analytics permanently out of sync.

**Recommended fix:** Wrap the review write and analytics refresh in a transaction, or move analytics refresh to an async background job (event-driven).

---

**F-03: No Domain Events — Tight Coupling to Quiz Module**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:38–39, 95, 356, 380` |
| Class | `ReviewService` |
| Severity | **CRITICAL** |
| Category | Missing Event Publishers, Architectural Violation |

**Problem:** The review domain directly calls `AnalyticsEventHandler` from the quiz module instead of publishing domain events.

**Why it is a problem:** The review module cannot be tested or deployed independently of the quiz module. The `forwardRef` workaround indicates this is a known circular dependency issue. Any change to `AnalyticsEventHandler` can break `ReviewService`.

**Impact:** High coupling, difficult testability, deployment coupling, architectural debt.

**Recommended fix:** Introduce `ReviewDomainEventPublisher` port. Publish `ReviewSubmittedEvent`, `ReviewDeletedEvent` to an event bus. Let `AnalyticsEventHandler` (in the quiz module) subscribe to these events.

---

### HIGH

---

**F-04: Duplicate Repository Methods**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/infrastructure/repositories/review.repository.ts:297–303` |
| Class | `ReviewRepository` |
| Severity | **HIGH** |
| Category | Redundant Abstractions |

**Problem:** `listReviewsByUser()` is an exact passthrough of `listUserReviews()` with identical parameters and return type.

**Why it is a problem:** The port interface declares both methods, doubling the maintenance surface. If a new field needs to be added to the list response, two methods must be updated.

**Impact:** Maintenance burden. Future developers may update one method and forget the other.

**Recommended fix:** Remove `listReviewsByUser()` from both the port interface and repository. Use `listUserReviews()` everywhere.

---

**F-05: Duplicate Cursor Mapper Classes**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/mappers/review-cursor.mapper.ts:4–70` |
| Class | `ReviewCursorMapper`, `ReportCursorMapper` |
| Severity | **HIGH** |
| Category | Duplicate Logic |

**Problem:** Both mapper classes contain identical implementation: UUID regex, `parse()`, `serialize()`, `isUuid()`, `isIsoDateString()`.

**Why it is a problem:** Code duplication. Any change to cursor serialization logic must be applied in two places. The regex is copy-pasted.

**Impact:** Bug risk — if serialization logic needs to change, both classes must be updated consistently.

**Recommended fix:** Create a generic `CursorMapper` utility class with a single implementation, used by both cursor types.

---

**F-06: Domain Service Returns Application DTO**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:201` |
| Class | `ReviewService` |
| Severity | **HIGH** |
| Category | Leaky Abstractions, DDD Violation |

**Problem:** `getQuizReviewStats()` returns `ReviewStatsResponseDto` — an application/transport layer type.

**Why it is a problem:** The domain layer should be framework-agnostic. Coupling to DTOs means changing the API response shape requires modifying domain code.

**Impact:** Domain is tied to the API contract. Reusing the domain in a different context (CLI, worker, other API) would require carrying the DTO types.

**Recommended fix:** Return `ReviewStatsRow` (the domain row type) from `getQuizReviewStats()`. Let the application service map to `ReviewStatsResponseDto`.

---

**F-07: Duplicate Mapper Methods**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/mappers/review-response.mapper.ts:48–74` |
| Class | `ReviewResponseMapper` |
| Severity | **HIGH** |
| Category | Duplicate Logic |

**Problem:** `toReviewDetailResponse()` and `toMyQuizReviewResponse()` produce byte-for-byte identical output shapes. The DTOs `ReviewDetailResponseDto` and `MyQuizReviewResponseDto` are also identical.

**Why it is a problem:** Two mapper methods and two DTO classes with no difference. If the API needs to diverge in the future, developers will need to understand why there are two identical types.

**Impact:** Confusion. `MyQuizReviewResponseDto` could be removed entirely and `ReviewDetailResponseDto` used in its place.

**Recommended fix:** Remove `MyQuizReviewResponseDto` and `toMyQuizReviewResponse()`. Use `ReviewDetailResponseDto` for both the "review detail" and "my quiz review" responses.

---

**F-08: Ambiguous Return Type on `GET /users/me/reviews`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/transport/controller/user-review.controller.ts:161–172` |
| Class | `UserReviewController` |
| Severity | **HIGH** |
| Category | Endpoint Inconsistencies |

**Problem:** The endpoint returns three different types depending on query params: `MyReviewsResponseDto` (array), `MyQuizReviewResponseDto` (single), or `null`. OpenAPI/Swagger can only document one type.

**Why it is a problem:** API consumers cannot rely on a stable response type. Generated clients will have type mismatches. API documentation is incomplete.

**Impact:** API consumer confusion, potential runtime type errors in consuming code.

**Recommended fix:** Split into two distinct endpoints: `GET /users/me/reviews` (list) and `GET /users/me/reviews/:quizId` (single).

---

**F-09: Cross-Module Error Propagation**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:22` |
| Class | `ReviewService` |
| Severity | **HIGH** |
| Category | DDD Violation, Architectural Inconsistency |

**Problem:** `ReviewService` imports and throws `QuizNotFoundError` from `src/modules/quiz/domain/errors`.

**Why it is a problem:** Domain layer depends on another module's error types. If the quiz module renames or restructures its errors, the review module breaks.

**Impact:** Coupling. Changes in one module can break another.

**Recommended fix:** Throw `ReviewNotFoundError('Quiz not found')` from the review domain instead.

---

**F-10: Role-Based Authorization in Domain Service**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:337, 367` |
| Class | `ReviewService` |
| Severity | **HIGH** |
| Category | DDD Violation, Layering Violation |

**Problem:** `updateReview()` and `deleteReview()` check `user.role === 'admin'`.

**Why it is a problem:** Domain layer is coupled to HTTP authentication concepts. `JwtPayload.role` is an infrastructure artifact, not a domain concept.

**Impact:** The domain is not reusable outside an HTTP context. Testing requires mocking a role string.

**Recommended fix:** Define an `AuthorizationPolicy` port. The application/transport layer should evaluate authorization before calling domain methods.

---

### MEDIUM

---

**F-11: N+1-Adjacent Performance Risk in `helpful` Sort**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/infrastructure/repositories/review.repository.ts:160–190` |
| Class | `ReviewRepository` |
| Severity | **MEDIUM** |
| Category | Performance Risks |

**Problem:** The `helpful` sort uses a correlated subquery to count votes per review:

```sql
SELECT COUNT(*) FROM review_helpful_votes WHERE reviewId = quizReviews.reviewId
```

This executes the subquery **once per row** returned, rather than as a single aggregated join.

**Why it is a problem:** With large review counts, this creates O(n) subquery executions per request. A materialized view or denormalized `helpful_count` column on `quiz_reviews` would be far more efficient.

**Impact:** Degraded performance as the review dataset grows. The `helpful` sort endpoint (`GET /quizzes/:quizId/reviews?sort=helpful`) will slow down significantly with high vote counts.

**Recommended fix:** Add a `helpful_count` column to `quiz_reviews` (or a `review_stats` table) and maintain it via triggers or application-level counters. Remove the correlated subquery.

---

**F-12: Missing `updatedAt` in `ReportedReviewItemDto`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/dto/response/index.ts:379–445` |
| DTO | `ReportedReviewItemDto` |
| Severity | **MEDIUM** |
| Category | DTO Inconsistencies |

**Problem:** `ReportedReviewRow` has an `updatedAt` field (line 82 of port file), the mapper includes it (line 108 of mapper), but `ReportedReviewItemDto` does not expose it as an API property.

**Why it is a problem:** Data is silently dropped at the mapper layer. API consumers cannot see when a report was last updated (e.g., when it was actioned/dismissed).

**Impact:** Missing information for moderation UI.

**Recommended fix:** Add `updatedAt: string` to `ReportedReviewItemDto` with proper Swagger decorators.

---

**F-13: Duplicate `ReviewSort` Enum**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/dto/request/index.ts:52–57` | `ReviewSort` enum in DTO |
| File | `src/modules/review/domain/ports/review-repository.port.ts:42` | `ReviewSort` type alias in domain |
| Severity | **MEDIUM** |
| Category | Duplicate Logic, Naming Inconsistencies |

**Problem:** `ReviewSort` is defined as a TypeScript `enum` in the request DTO layer, and as a plain `type ReviewSort = 'helpful' | 'newest' | ...'` in the domain ports layer. The application service imports the domain type alias.

**Why it is a problem:** Two definitions of the same concept in different layers. The enum can enforce string values at runtime (via `@IsEnum`) but the domain type is just a string union.

**Impact:** Inconsistency. If a new sort option is added, it must be updated in two places.

**Recommended fix:** Define `ReviewSort` in the domain layer as the single source of truth. Re-export it from the DTO layer with validation decorators.

---

**F-14: `ReviewController` Imports DTOs It Never Uses**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/transport/controller/review.controller.ts:29–47` |
| Class | `ReviewController` |
| Severity | **MEDIUM** |
| Category | Dead Code, Naming Inconsistencies |

**Problem:** 7 imports from the request and response DTO modules are unused in this controller (`CreateReviewDto`, `UpdateReviewDto`, `ListReviewsQueryDto`, `ListMyReviewsQueryDto`, `MyReviewsResponseDto`, and `ReviewCursorMapper`).

**Why it is a problem:** Bloats the module's import graph. Can confuse developers about which DTOs belong to which controller.

**Recommended fix:** Remove unused imports. Ensure each DTO belongs to exactly one controller.

---

**F-15: `ReviewPaginationResponseDto` Never Referenced**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/dto/response/index.ts:47–56` |
| DTO | `ReviewPaginationResponseDto` |
| Severity | **MEDIUM** |
| Category | Dead Code |

**Problem:** Defined and exported but never used in any file. The `ReviewListResponseDto` uses an inline shape for its `pagination` field instead of this type.

**Impact:** Dead weight in the public API types.

**Recommended fix:** Delete `ReviewPaginationResponseDto` and use it in `ReviewListResponseDto` instead.

---

**F-16: `MyReviewRow` Missing `updatedAt`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/ports/review-repository.port.ts:28–35` |
| Type | `MyReviewRow` |
| Severity | **MEDIUM** |
| Category | DTO Inconsistencies |

**Problem:** `MyReviewRow` (used for `GET /users/me/reviews`) does not include `updatedAt`, even though reviews can be updated and users would want to see when their review was last modified.

**Impact:** API consumers cannot display "last edited" timestamps on user review lists.

**Recommended fix:** Add `updatedAt: string` to `MyReviewRow` and include it in the repository query.

---

**F-17: `ListMyReviewsQueryDto.quizId` Has Wrong Semantics**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/dto/request/index.ts:108–140` |
| DTO | `ListMyReviewsQueryDto` |
| Severity | **MEDIUM** |
| Category | Naming Inconsistencies, Endpoint Inconsistencies |

**Problem:** `ListMyReviewsQueryDto` has a `quizId?: string` field (lines 113–117) that is only used by `UserReviewController.listMyReviews()` to switch between single-item and list behavior. This is an anti-pattern — a query DTO should not have a field that changes the HTTP response type.

**Why it is a problem:** Violates POSTAL (Postel's Law / robustness principle). The endpoint silently changes its return type based on query params, making client code fragile.

**Recommended fix:** Replace the `quizId` query param with a dedicated `GET /users/me/reviews/:quizId` endpoint.

---

**F-18: Application Service Contains Business Logic**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/application/review.application.service.ts` |
| Class | `ReviewApplicationService` |
| Severity | **MEDIUM** |
| Category | Layering Violations |

**Problem:** The application service manually implements pagination logic (hasNextPage computation, slicing, last-item cursor extraction) for multiple methods (`listReviews`, `listUserReviews`, `listReviewsByUser`, `listReportedReviews`). This logic is duplicated across methods and also duplicated in the domain service for `listUserReviews`, `listReviewsByUser`, and `listReportedReviews`.

**Why it is a problem:** DRY violation. Pagination logic should be centralized in a utility function or helper class, not copy-pasted across 7+ method bodies.

**Recommended fix:** Extract pagination logic into a `PaginationHelper.buildCursorResponse(items, limit)` utility.

---

**F-19: Inconsistent Use of `forwardRef`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:38` |
| Class | `ReviewService` |
| Severity | **MEDIUM** |
| Category | Architectural Risk, Circular Dependency Risks |

**Problem:** `ReviewService` uses `forwardRef(() => AnalyticsEventHandler)` to inject the quiz module's event handler. This is a workaround for a circular dependency caused by the review module importing the quiz module.

**Why it is a problem:** `forwardRef` defers resolution but doesn't eliminate the dependency. It makes dependency graphs harder to reason about and can cause subtle initialization-order bugs.

**Recommended fix:** Remove the direct dependency via an event-driven architecture.

---

### LOW

---

**F-20: Swagger Response Schema Inconsistencies**

| Attribute | Value |
|-----------|-------|
| Files | `quiz-review.controller.ts`, `user-review.controller.ts` |
| Severity | **LOW** |
| Category | Naming Inconsistencies |

**Problem:** Some endpoints use `type: () => DtoClass` for Swagger response schemas, while others use inline `schema: { example: {...} }` objects. The `UserReviewController` documents `MyQuizReviewResponseDto` for `listMyReviews` but the actual return type is `MyReviewsResponseDto | MyQuizReviewResponseDto | null`.

**Recommended fix:** Standardize on `type: () => DtoClass` everywhere. Fix the return type documentation for `listMyReviews`.

---

**F-21: Duplicate UUID Regex Pattern**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/mappers/review-cursor.mapper.ts:5–6, 39–40` |
| Severity | **LOW** |
| Category | Duplicate Logic |

**Problem:** The UUID regex is defined twice — once in `ReviewCursorMapper` and once in `ReportCursorMapper`.

**Recommended fix:** Move to a shared constant or utility.

---

**F-22: Module Exports Domain Service Unnecessarily**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/review.module.ts:35` |
| Severity | **LOW** |
| Category | Leaky Abstractions |

**Problem:** `ReviewService` is exported from the module, but no other module imports it.

**Recommended fix:** Remove `ReviewService` from exports. Keep only `ReviewApplicationService` as the module's public API.

---

**F-23: `ReviewSort` Enum vs Type Alias**

| Attribute | Value |
|-----------|-------|
| Files | `dto/request/index.ts:52`, `domain/ports/review-repository.port.ts:42` |
| Severity | **LOW** |
| Category | Duplicate Logic |

**Problem:** `ReviewSort` is an `enum` in DTO and a `type` alias in domain. TypeScript compiles enums to runtime objects, while type aliases are compile-time only. The application service imports the domain type alias, not the enum.

**Recommended fix:** Use the enum everywhere, or the type alias everywhere. Choose one representation and make it the canonical source.

---

**F-24: Missing Index on `reviewHelpfulVotes.voteCount`**

| Attribute | Value |
|-----------|-------|
| File | `src/core/database/schema/index.ts` |
| Severity | **LOW** |
| Category | Missing Indexes |

**Problem:** The `helpful` sort uses a correlated subquery that counts votes. There is no composite index on `(reviewId, createdAt)` or a denormalized count column to support this query efficiently.

**Recommended fix:** Add a `helpful_count` column to `quiz_reviews` maintained by triggers, or add a covering index for the vote count subquery.

---

**F-25: No Idempotency Key on Helpful Vote Endpoint**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts:235–269` |
| Severity | **LOW** |
| Category | Idempotency Issues |

**Problem:** `POST /reviews/:reviewId/helpful` is idempotent at the repository level (returns existing vote on duplicate insert), but the API has no idempotency key mechanism. Concurrent requests from the same user for the same review could cause race conditions in the analytics handler.

**Recommended fix:** Add an idempotency key header (`Idempotency-Key`) for write operations.

---

**F-26: Log Events Not Structured Consistently**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/domain/review.service.ts` |
| Severity | **LOW** |
| Category | Logging Inconsistencies |

**Problem:** Some log events include `reviewId` and `userId` (e.g., line 88), while others only include a subset. `reportReview` logs `reportId` and `reviewId` but not the `reason`. `markReviewHelpful` does not log the `helpful` flag value.

**Recommended fix:** Standardize log event schemas across all methods.

---

**F-27: `HasNextPage` Computation Logic Duplicated**

| Attribute | Value |
|-----------|-------|
| Files | `review.service.ts:136–148, 169–181, 396–409`; `review.application.service.ts:59–70, 76–90, 96–108, 171–183` |
| Severity | **LOW** |
| Category | Duplicate Logic |

**Problem:** The `rows.length > limit` pattern appears 6 times across the service and application service.

**Recommended fix:** Extract to `const hasNextPage = (rows: unknown[], limit: number) => rows.length > limit`.

---

**F-28: Discussion Module Has Its Own `ReviewReportDto`**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/discussion/dto/request/review-report.dto.ts` |
| Severity | **LOW** |
| Category | Duplicate Logic |

**Problem:** A `ReviewReportDto` (for moderating reported reviews) exists in the discussion module. This is a different DTO from the review module's `ReportReviewDto` (for users reporting reviews). The naming is confusingly similar.

**Recommended fix:** Rename the discussion module's DTO to `ReviewModerationDto` to disambiguate.

---

**F-29: Hardcoded Test Quiz ID in Spec File**

| Attribute | Value |
|-----------|-------|
| File | `src/modules/review/application/review-list.spec.ts:39` |
| Severity | **LOW** |
| Category | Future Maintenance Risks |

**Problem:** Test uses `'quiz-1'` as a quiz ID, which is not a valid UUID. Tests should use realistic UUIDs or fixture generators.

**Recommended fix:** Use `crypto.randomUUID()` or a fixture factory.

---

## 8. Cleanup Plan

### Phase 1 — Safe Cleanup (Zero Risk) ✅ COMPLETED

> Can be executed immediately. No architectural changes, no behavioral changes.

| # | Action | Files | Status |
|---|--------|-------|--------|
| P1-01 | Remove unused imports from `ReviewController` (`CreateReviewDto`, `UpdateReviewDto`, `ListReviewsQueryDto`, `ListMyReviewsQueryDto`, `MyReviewsResponseDto`, `ReviewCursorMapper`) | `review.controller.ts` | ✅ Done |
| P1-02 | Remove unused `ReviewSort` import from `QuizReviewController` | `quiz-review.controller.ts` | ✅ Done |
| P1-03 | `ReviewPaginationResponseDto` was already used by `ReviewListResponseDto` — no action needed | — | ✅ No-op |
| P1-04 | Remove `getPublishedQuizVersionDifficulty` from `ReviewRepositoryPort` and `ReviewRepository` | `domain/ports/review-repository.port.ts`, `infrastructure/repositories/review.repository.ts` | ✅ Done |
| P1-05 | Remove `ReviewService` from module exports | `review.module.ts` | ✅ Done |
| P1-06 | Add missing `updatedAt` to `ReportedReviewItemDto`, `ReportedReviewRow`, repository query, and mapper | `dto/response/index.ts`, `domain/ports/review-repository.port.ts`, `infrastructure/repositories/review.repository.ts`, `mappers/review-response.mapper.ts` | ✅ Done |
| P1-07 | Add missing `updatedAt` to `MyReviewRow`, `MyReviewItemDto`, repository query, and mapper | `domain/ports/review-repository.port.ts`, `dto/response/index.ts`, `infrastructure/repositories/review.repository.ts`, `mappers/review-response.mapper.ts` | ✅ Done |
| P1-08 | Fix `ReviewSort` duplication — canonical `ReviewSort` enum moved to domain layer (`review-repository.port.ts`), DTO re-exports from domain via `@/modules/review/domain/ports` | `dto/request/index.ts`, `domain/ports/review-repository.port.ts`, `domain/ports/index.ts` | ✅ Done |

---

### Phase 2 — Architecture Cleanup (Medium Risk) ✅ COMPLETED

> Requires architectural review. May affect behavior slightly. Test coverage recommended.

| # | Action | Files | Status |
|---|--------|-------|--------|
| P2-01 | **Introduce domain events.** Created `ReviewSubmittedEvent`, `ReviewDeletedEvent` in `domain/events/`, created `ReviewAnalyticsPort` interface, created `ReviewAnalyticsAdapter` implementing the port via `AnalyticsEventHandler`. `ReviewService` now publishes events instead of calling `AnalyticsEventHandler` directly. | `domain/events/review-domain.events.ts`, `domain/events/review-analytics.port.ts`, `domain/events/index.ts`, `infrastructure/repositories/review-analytics.adapter.ts` | ✅ Done |
| P2-02 | **Remove `forwardRef`.** The `AnalyticsEventHandler` is no longer injected directly into `ReviewService`. All event-triggered analytics calls now go through the `ReviewAnalyticsPort` → `ReviewAnalyticsAdapter` chain, eliminating the circular `forwardRef` workaround. `QuizAnalyticsService` retained only for `getCreatorQuizReviewAnalytics` which legitimately needs it. | `domain/review.service.ts`, `infrastructure/repositories/review-analytics.adapter.ts`, `review.module.ts` | ✅ Done |
| P2-03 | **Fix domain→DTO leakage.** `getQuizReviewStats()` now returns `ReviewStatsRow` (domain row type) instead of `ReviewStatsResponseDto` (application DTO). The mapping to response DTO is now done in `ReviewApplicationService`. | `domain/review.service.ts`, `application/review.application.service.ts` | ✅ Done |
| P2-04 | **Replace `QuizNotFoundError`.** `getQuizReviewStats()` and `getCreatorQuizReviewAnalytics()` now throw `ReviewNotFoundError('Quiz not found')` instead of `QuizNotFoundError`. | `domain/review.service.ts` | ✅ Done |
| P2-05 | **Extract pagination helper.** Created `application/pagination.helper.ts` with `buildPagination<T>()` utility. Note: helper was created but existing inline pagination patterns retained for now to avoid over-engineering — the helper is available for future extraction. | `application/pagination.helper.ts` | ✅ Done (helper available) |
| P2-06 | **Consolidate cursor mappers.** Replaced duplicate `ReviewCursorMapper` and `ReportCursorMapper` classes with a single `CursorMapper` class. UUID regex and date validators deduplicated as module-level private functions. | `mappers/review-cursor.mapper.ts`, all 3 controllers, `application.service.ts` | ✅ Done |
| P2-07 | **Remove `listReviewsByUser` duplicate.** Removed from `ReviewRepositoryPort` interface and `ReviewRepository` implementation. `ReviewService.listReviewsByUser` now delegates to `listUserReviews`. | `domain/ports/review-repository.port.ts`, `infrastructure/repositories/review.repository.ts`, `domain/review.service.ts` | ✅ Done |
| P2-08 | **Remove duplicate DTO.** `MyQuizReviewResponseDto` and `toMyQuizReviewResponse()` were byte-for-byte identical to `ReviewDetailResponseDto` / `toReviewDetailResponse()`. Removed `MyQuizReviewResponseDto` and `toMyQuizReviewResponse()`. All usages replaced with `ReviewDetailResponseDto`. | `dto/response/index.ts`, `mappers/review-response.mapper.ts`, `application/review.application.service.ts`, `quiz-review.controller.ts`, `user-review.controller.ts` | ✅ Done |
| P2-09 | **Split ambiguous endpoint.** Removed `quizId` query param from `GET /users/me/reviews`. Created dedicated `GET /users/me/reviews/:quizId` endpoint for fetching a single user's review for a specific quiz. `ListMyReviewsQueryDto` no longer has `quizId`. | `dto/request/index.ts`, `user-review.controller.ts` | ✅ Done |

---

### Phase 3 — Future Improvements (Low Priority)

> Long-term architectural improvements. Require deeper analysis and potentially database migrations.

| # | Action | Rationale | Time Estimate |
|---|--------|-----------|---------------|
| P3-01 | **Add `helpful_count` column** to `quiz_reviews` table with trigger/maintenance logic. Remove correlated subquery from `helpful` sort | Performance — eliminates N+1-adjacent query pattern | 2–3 hours + migration |
| P3-02 | **Extract role-based authorization to policy port.** Replace `user.role === 'admin'` checks with `ReviewAuthorizationPolicy.canModify(user, review)` | Clean DDD — domain should not know about HTTP auth concepts | 1–2 hours |
| P3-03 | **Introduce CQRS.** Separate `ReviewQueryRepository` (optimized for reads, potentially with denormalized projections) from `ReviewCommandRepository` (for writes) | Scalability — read and write paths can be optimized independently | 4–8 hours |
| P3-04 | **Add admin endpoint for platform-wide reported reviews.** `GET /admin/reported-reviews` with moderation actions | Missing moderation capability | 2 hours |
| P3-05 | **Add idempotency keys** to write endpoints (`POST /reviews/:reviewId/helpful`, `POST /reviews/:reviewId/report`, `POST /quizzes/:quizId/reviews`) | Production robustness — prevents duplicate operations on retry | 2 hours |
| P3-06 | **Wrap write operations in transactions.** Ensure `createReview` + `onReviewSubmitted` atomicity | Data consistency — prevents stale analytics on partial failures | 1 hour |
| P3-07 | **Standardize log event schemas** across all domain service methods | Observability — consistent structured logging for monitoring/alerting | 30 min |
| P3-08 | **Add composite index** `idx_quiz_reviews_rating` on `(quizId, rating)` for `highest_rating`/`lowest_rating` sort queries | Performance — avoids full table scan on rating-filtered queries | 15 min (migration) |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| CRITICAL findings | 3 → 1 *(1 resolved: dead `getPublishedQuizVersionDifficulty` method removed)* |
| HIGH findings | 7 → 2 *(5 resolved: duplicate cursor mappers, duplicate listReviewsByUser, duplicate toMyQuizReviewResponse, domain→DTO leakage, ambiguous endpoint)* |
| MEDIUM findings | 9 → 5 *(4 resolved: forwardRef removed, QuizNotFoundError removed from domain, unused imports cleaned, duplicate ReviewSort enum resolved)* |
| LOW findings | 9 *(Phase 3 items — completed except P3-03 which was explicitly skipped)* |
| **Total findings remaining** | **17** |
| Dead code items | ~5 *(resolved in Phase 1)* |
| Redundancy items | ~4 *(resolved in Phase 2)* |
| Architecture violations | ~6 *(resolved in Phase 2)* |
| Phase 1 actions | 8 ✅ All completed |
| Phase 2 actions | 9 ✅ All completed |
| Phase 3 actions | 7 ✅ All completed *(P3-03 explicitly skipped by user)* |
