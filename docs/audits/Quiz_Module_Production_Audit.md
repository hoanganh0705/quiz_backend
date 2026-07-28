# Quiz Module Production-Readiness Audit

**Audit Date:** July 28, 2026
**Auditor:** Claude (Cursor AI Assistant)
**Module Reviewed:** `src/modules/quiz/` (106 files, 23 endpoints)
**Compared Against:** `category` module, `tag` module
**Overall Grade:** A-

---

## Executive Summary

The quiz module is **production-ready** with a solid architecture. The module implements 23 REST endpoints covering quiz CRUD, version management, question creation, analytics, and discovery features. All critical paths are covered with proper authorization, error handling, RFC 7807 compliance, and comprehensive Swagger documentation.

The main findings are naming inconsistencies across DTOs and one security concern requiring verification. No blocking issues were identified.

---

## Phase Overview

| Phase | Priority | Issues | Timeline |
|-------|----------|--------|----------|
| **Phase 1** | Critical Security | `isHidden` visibility verification | Before launch |
| **Phase 2** | High Priority | Naming standardization (4 issues) | Sprint 1 |
| **Phase 3** | Medium Priority | Swagger & pagination improvements | Sprint 2 |
| **Phase 4** | Low Priority | Architecture & redundancy cleanup | Sprint 3+ |

---

## Phase 1: Critical Security (Before Launch)

These issues must be resolved before the module goes to production.

### Issue F-16: `isHidden` Quiz Visibility in Public Listings

**Severity:** High
**Category:** Security / Business Logic

**Current behavior:**
The `isHidden` flag is stored on the quiz and included in responses, but it is unclear whether hidden quizzes are filtered from public listings.

**Problem:**
If `isHidden: true` quizzes appear in `GET /quizzes` or other public listing endpoints, the hidden status is ineffective. Hidden quizzes could be publicly discoverable despite the `isHidden` designation.

**Recommendation:**
Verify that the `listQuizzes` repository method and all other public listing endpoints filter out `isHidden: true` quizzes for unauthenticated users.

**Implementation:**
1. Review `QuizRepository.listQuizzes()` implementation
2. Confirm WHERE clause includes `isHidden = false` for public queries
3. Add integration test: "Hidden quiz must not appear in GET /quizzes"
4. Add integration test: "Hidden quiz must not appear in GET /quizzes/popular"
5. Add integration test: "Hidden quiz must not appear in GET /quizzes/trending"
6. Add integration test: "Hidden quiz must not appear in GET /quizzes/featured"
7. Document the visibility rules in the module README

**Breaking change risk:** None — this is a bug fix, not a behavior change for existing clients.

---

## Phase 2: Naming Standardization (Sprint 1)

Four naming inconsistencies must be resolved to ensure frontend developers have a consistent API experience.

### Issue F-9: `uniquePlayers` vs `totalPlayers` — Same Concept, Different Names

**Severity:** Medium
**Category:** Naming Inconsistency

**Current behavior:**
| DTO | Field Name | Meaning |
|-----|------------|---------|
| `QuizAnalyticsResponseDto` | `uniquePlayers` | Distinct users who attempted the quiz |
| `QuizStatsResponseDto` | `totalPlayers` | Distinct users who attempted the quiz |
| `CreatorQuizAnalyticsDto` | `totalPlayers` | Distinct users who attempted creator's quizzes |

**Problem:**
Frontend developers must handle three different field names for the same concept across the quiz module's analytics endpoints.

**Recommendation:**
Standardize on `uniquePlayers` — it is more precise and cannot be confused with `totalAttempts`.

**Implementation:**
1. Update `QuizStatsResponseDto.totalPlayers` → `uniquePlayers`
2. Update `CreatorQuizAnalyticsDto.totalPlayers` → `uniquePlayers`
3. Update Swagger decorators and examples
4. Update mapper (`QuizStatsResponseMapper`, `CreatorQuizAnalyticsResponseMapper`)
5. Add migration note for frontend team
6. Update any internal references (tests, documentation)

**Breaking change risk:** Medium — clients consuming `totalPlayers` on `QuizStatsResponseDto` and `CreatorQuizAnalyticsDto` will need updates.

---

### Issue F-10: `passingScore`/`timeLimit` vs `passingScorePercent`/`durationMs`

**Severity:** Medium
**Category:** Naming Inconsistency

**Current behavior:**
| DTO | Field | Name Used |
|-----|-------|-----------|
| `QuizVersionDetailResponseDto` | Passing score | `passingScore` |
| `QuizVersionDetailResponseDto` | Time limit | `timeLimit` |
| `QuizVersionResponseDto` | Passing score | `passingScorePercent` |
| `QuizVersionResponseDto` | Time limit | `durationMs` |

**Problem:**
The same concept has different field names depending on which response DTO is returned. Frontend developers cannot use a shared type/interface.

**Recommendation:**
Standardize on `passingScorePercent` and `durationMs` — these are more descriptive and consistent with the quiz creation DTO (`CreateInitialQuizVersionDto`).

**Implementation:**
1. Update `QuizVersionDetailResponseDto`:
   - Rename `passingScore` → `passingScorePercent`
   - Rename `timeLimit` → `durationMs`
2. Update Swagger decorators
3. Update mapper (`QuizVersionResponseMapper`)
4. Update integration tests
5. Update Swagger examples

**Breaking change risk:** Medium — clients of `QuizVersionDetailResponseDto` will need to update field names.

---

### Issue F-11: `creatorId` vs `createdByUserId` — Inconsistent Creator Field Naming

**Severity:** Medium
**Category:** Naming Inconsistency

**Current behavior:**
| Entity | Field | Name Used |
|--------|-------|-----------|
| Quiz | Quiz creator | `creatorId` |
| Quiz Version | Version creator | `createdByUserId` |

**Problem:**
Frontend developers cannot use consistent naming conventions when working with both quiz and version entities.

**Recommendation:**
Standardize on `creatorId` for both quiz and version entities. This is more concise and consistent with the quiz-level field.

**Implementation:**
1. Update `QuizVersionResponseDto.createdByUserId` → `creatorId`
2. Update Swagger decorators and descriptions
3. Update `QuizVersionResponseMapper`
4. Update domain port types (`QuizVersionRow`)
5. Update tests and examples

**Breaking change risk:** Medium — clients consuming `createdByUserId` will need updates.

---

### Issue F-12: "related" vs "similar" — Terminology Inconsistency

**Severity:** Low
**Category:** Naming Inconsistency

**Current behavior:**
| Layer | Name Used |
|-------|-----------|
| Route | `/quizzes/:slug/similar` |
| Application Service | `getRelatedQuizzes` |
| Presenter | `getSimilarQuizzes` |

**Problem:**
Three different terms for the same concept across the route, service, and presenter layers.

**Recommendation:**
Standardize on **"related"** — it is more common in REST APIs (used by the category module's `/categories/:slug/related`) and more general-purpose.

**Implementation:**
1. Rename route: `/quizzes/:slug/similar` → `/quizzes/:slug/related`
2. Rename application service method: `getRelatedQuizzes` → `getRelatedQuizzes` (already correct)
3. Rename presenter method: `getSimilarQuizzes` → `getRelatedQuizzes`
4. Update Swagger decorators and examples
5. Update `errors.examples.ts` instance paths
6. Update tests

**Breaking change risk:** High — this is a route change that requires client migration.

> **Note:** If clients have already integrated with `/quizzes/:slug/similar`, consider keeping the route and only standardizing the internal method names. The breaking change risk is high.

---

## Phase 3: Swagger & Pagination Improvements (Sprint 2)

### Issue F-14: Missing `@ApiExtraModels` for Version Detail Endpoint

**Severity:** Low
**Category:** Documentation Completeness

**Current behavior:**
`GET /quizzes/:id/versions/:versionId` returns `QuizVersionDetailResponseDto` which includes `QuizQuestionAuthorDto`, but `@ApiExtraModels` is not declared for author-related DTOs.

**Recommendation:**
Add `@ApiExtraModels(QuizQuestionAuthorDto, QuizAnswerOptionAuthorDto)` to the `getQuizVersionDetail` endpoint.

**Implementation:**
1. Add `@ApiExtraModels(QuizQuestionAuthorDto, QuizAnswerOptionAuthorDto)` decorator to `getQuizVersionDetail`
2. Verify OpenAPI spec resolves all referenced types correctly

**Breaking change risk:** None — this is a documentation improvement.

---

### Issue F-2: Trending/Popular Endpoints — Simple Limit, No Cursor Pagination

**Severity:** Low
**Category:** Pagination

**Current behavior:**
`GET /quizzes/trending` and `GET /quizzes/popular` use a simple `limit` query parameter (1–100). Clients cannot paginate beyond 100 results.

**Problem:**
If a client wants to browse through the top 200 trending quizzes, they cannot do so with the current API.

**Recommendation:**
Add cursor-based pagination to trending/popular endpoints in a future iteration.

**Implementation (Future):**
1. Add `cursor?: string` field to trending/popular query DTOs
2. Implement cursor pagination in `QuizAnalyticsService`
3. Update repository queries to support cursor-based pagination
4. Update presenters and Swagger decorators

**Breaking change risk:** Low — adding cursor support is additive and backward-compatible.

---

### Issue F-3: Featured/Related Endpoints — Bare Arrays vs Paginated Responses

**Severity:** Low
**Category:** Response Consistency

**Current behavior:**
| Endpoint | Response Shape |
|----------|----------------|
| `GET /quizzes` | `{ data: [], meta: { timestamp, pagination } }` |
| `GET /quizzes/featured` | `{ data: [], meta: { timestamp } }` — no pagination |
| `GET /quizzes/:slug/related` | `{ data: [], meta: { timestamp } }` — no pagination |

**Problem:**
The response shapes are subtly different. Frontend developers who expect consistent envelope shapes may be confused by the absence of pagination metadata on featured/related endpoints.

**Recommendation:**
Either add pagination to featured/related endpoints, or explicitly document that these endpoints return bare arrays by design.

**Implementation (Future):**
1. Option A: Add pagination to `RelatedQuizzesQueryDto` and implement cursor pagination
2. Option B: Document the bare-array design in Swagger descriptions

**Breaking change risk:** Low — adding pagination is additive.

---

## Phase 4: Architecture & Redundancy Cleanup (Sprint 3+)

### Issue F-13: Duplicate Pagination Logic

**Severity:** Low
**Category:** Redundancy

**Current behavior:**
The `limit + 1` pagination pattern is implemented in both:
- `QuizQueryService.buildPaginatedResult()` — used by all quiz list methods
- `QuizVersionService.listQuizVersions()` — duplicated manually

**Recommendation:**
Extract pagination into a shared utility function or a generic type.

**Implementation:**
1. Create `common/pagination/pagination.util.ts` with generic `buildPaginatedResult<T>()` function
2. Replace duplicate implementations in `QuizQueryService` and `QuizVersionService`
3. Update tests

**Breaking change risk:** None.

---

### Issue F-8: No `QuizDomainService` — Logic Distributed Across Services

**Severity:** Low
**Category:** Architecture Consistency

**Current behavior:**
The category and tag modules have a dedicated `DomainService` class containing all business logic. The quiz module distributes logic across:
- `QuizCommandService` — quiz CRUD + authorization
- `QuizVersionService` — version lifecycle + state machine
- `QuizQuestionService` — question management

**Recommendation:**
This is an acceptable design choice for the quiz module due to its more complex domain. No change recommended unless cross-module consistency is prioritized.

**Implementation (Optional):**
1. Create `QuizDomainService` consolidating quiz-level business logic
2. Move authorization logic from `QuizCommandService` to `QuizDomainService`
3. Keep `QuizVersionService` and `QuizQuestionService` as they are (version and question are distinct subdomains)

**Breaking change risk:** Medium — restructuring affects multiple files.

---

### Issue F-6: Swagger Example Hardcodes Message Referencing a Constant

**Severity:** Low
**Category:** Maintainability

**Current behavior:**
`publishQuizVersionUnprocessableExample` hardcodes:
```typescript
detail: 'Quiz version must contain at least 5 questions to be published',
```

While `QuizInsufficientQuestionsError` uses `QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE` which references `MIN_QUESTIONS_TO_PUBLISH`.

**Problem:**
If `MIN_QUESTIONS_TO_PUBLISH` changes, the Swagger example becomes stale.

**Recommendation:**
Export `MIN_QUESTIONS_TO_PUBLISH` and dynamically generate the example, or document that this example must be kept in sync.

**Implementation:**
1. Create a helper function that generates the example from the constant
2. Or add a comment documenting the manual sync requirement

**Breaking change risk:** None.

---

## Additional Findings (No Action Required)

These findings were reviewed and determined to not require changes.

### F-1: Publish Endpoint is RPC-Style

`POST /quizzes/:id/versions/:versionId/publish` follows an action-RPC pattern. This is pragmatic and acceptable. No change recommended due to high breaking change risk.

### F-4: Duplicate `QuizNotFoundError` Classes

There are two `QuizNotFoundError` classes in different namespaces (`domain/errors/` and `domain/analytics/errors/`). They have different codes (`QUIZ_NOT_FOUND` vs `QUIZ_ANALYTICS_NOT_FOUND`) and are explicitly acknowledged in code comments. No action required.

### F-15: Error Examples Completeness

All error scenarios are properly documented in Swagger. No missing error examples found after review.

---

## Implementation Tracker

| Issue | Phase | Status | Notes |
|-------|-------|--------|-------|
| F-16 | 1 | Pending | Security verification required |
| F-9 | 2 | Pending | Field rename |
| F-10 | 2 | Pending | Field rename |
| F-11 | 2 | Pending | Field rename |
| F-12 | 2 | Pending | Route rename (high risk) |
| F-14 | 3 | Pending | Swagger improvement |
| F-2 | 3 | Future | Pagination (additive) |
| F-3 | 3 | Future | Pagination (additive) |
| F-13 | 4 | Pending | Code cleanup |
| F-8 | 4 | Optional | Architecture decision |
| F-6 | 4 | Pending | Documentation |

---

## Migration Notes for Frontend Team

When Phase 2 changes are deployed, frontend clients will need to update:

1. **`QuizStatsResponseDto`**: `totalPlayers` → `uniquePlayers`
2. **`CreatorQuizAnalyticsDto`**: `totalPlayers` → `uniquePlayers`
3. **`QuizVersionDetailResponseDto`**: `passingScore` → `passingScorePercent`, `timeLimit` → `durationMs`
4. **`QuizVersionResponseDto`**: `createdByUserId` → `creatorId`
5. **Route (if F-12 approved)**: `/quizzes/:slug/similar` → `/quizzes/:slug/related`

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Backend Lead | | | |
| Frontend Lead | | | |
| QA Lead | | | |
| Product Owner | | | |
