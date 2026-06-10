You are a Principal Software Architect performing a production-readiness audit.

Target module:

<MODULE_NAME>

Your job is NOT to explain what the code does.

Your job is to find:

1. Dead code
2. Unused services
3. Unused repositories
4. Unused DTOs
5. Unused events
6. Unused listeners
7. Unused interfaces/ports
8. Unused exports
9. Redundant abstractions
10. Duplicate logic
11. Architectural inconsistencies
12. DDD violations
13. CQRS violations
14. Event-driven design violations
15. Dependency direction violations
16. Layering violations
17. Leaky abstractions
18. Missing integrations
19. Missing event subscriptions
20. Missing event publishers
21. Read-side methods publishing domain events
22. Infrastructure leaking into domain
23. Circular dependency risks
24. Premature abstractions
25. Over-engineered code
26. Under-engineered code
27. Naming inconsistencies
28. Endpoint inconsistencies
29. DTO inconsistencies
30. Validation inconsistencies
31. Error handling inconsistencies
32. Logging inconsistencies
33. Security risks
34. Performance risks
35. N+1 query risks
36. Missing indexes
37. Missing transactions
38. Race condition risks
39. Idempotency issues
40. Future maintenance risks

Audit the ENTIRE module.

Trace actual usage paths.

Do NOT assume a class is used because it exists.

For every service, repository, adapter, listener, DTO, event, port, mapper, controller, and application service:

- Find all references
- Find all injection points
- Find all runtime execution paths
- Determine whether it is actually used

Classify every finding as:

CRITICAL
HIGH
MEDIUM
LOW

For every finding provide:

- File
- Class
- Problem
- Why it is a problem
- Impact
- Recommended fix

Additionally produce:

# Dead Code Report

List everything that can be safely deleted.

# Redundancy Report

List duplicated code and duplicated concepts.

# Architecture Report

Identify:

- DDD violations
- CQRS violations
- Event-driven violations
- Layer violations

# Dependency Report

Show dependency graph:

Controller
→ Application
→ Domain
→ Infrastructure

Highlight violations.

# Event Flow Report

For every event:

Event
→ Publisher
→ Event Bus
→ Subscriber
→ Handler
→ Side Effect

Mark:

✅ Fully wired

⚠ Partial

❌ Broken

# Endpoint Audit

List:

- Missing endpoints
- Redundant endpoints
- Inconsistent endpoints

# Cleanup Plan

Create a prioritized cleanup plan:

Phase 1 (safe cleanup)
Phase 2 (architecture cleanup)
Phase 3 (future improvements)

Do NOT modify code.

Do NOT generate code.

Only perform an exhaustive audit.

DO NOT PRINT OUT ANSWER, INSTEAD OF THAT PRINT OUT THE ANSWER DIRECTLY ON MD FILE

DO NOT ADD TESTING CODE# Quiz Module Production-Readiness Audit Report

**Module:** `src/modules/quiz/`
**Audit Date:** 2026-06-10
**Auditor:** Principal Software Architect
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## Table of Contents

1. [Dead Code Report](#1-dead-code-report)
2. [Redundancy Report](#2-redundancy-report)
3. [Architecture Report](#3-architecture-report)
4. [Dependency Report](#4-dependency-report)
5. [Event Flow Report](#5-event-flow-report)
6. [Endpoint Audit](#6-endpoint-audit)
7. [Findings Summary](#7-findings-summary)
8. [Cleanup Plan](#8-cleanup-plan)

---

## 1. DEAD CODE REPORT

### 1.1 Unused Domain Aggregates

#### Finding #D1: `domain/aggregates/quiz.aggregate.ts`

- **File:** `src/modules/quiz/domain/aggregates/quiz.aggregate.ts`
- **Class:** `QuizAggregate` (mentioned in port comments)
- **Problem:** File contains only a comment block referencing a `QuizAggregate` concept. No actual class, no exports consumed by any file in the codebase.
- **Severity:** MEDIUM
- **Impact:** Dead file inflating the codebase; signals incomplete DDD implementation or abandoned pattern.
- **Why:** Zero import references found across the entire codebase. The aggregate comment is a placeholder with no implementation.
- **Recommended Fix:** Either implement the aggregate root properly or delete the file.

#### Finding #D2: `domain/aggregates/quiz-version.aggregate.ts`

- **File:** `src/modules/quiz/domain/aggregates/quiz-version.aggregate.ts`
- **Class:** `QuizVersionAggregate`
- **Problem:** Same as D1. No implementation, no imports, no usage.
- **Severity:** MEDIUM
- **Impact:** Identical to D1.
- **Recommended Fix:** Delete the file if aggregate pattern is not being used.

#### Finding #D3: `domain/aggregates/quiz-question.aggregate.ts`

- **File:** `src/modules/quiz/domain/aggregates/quiz-question.aggregate.ts`
- **Class:** `QuizQuestionAggregate`
- **Problem:** Same as D1 and D2.
- **Severity:** MEDIUM
- **Recommended Fix:** Delete the file.

### 1.2 Unused Hydrator

#### Finding #D4: `infrastructure/repositories/hydrators/quiz-question.hydrator.ts`

- **File:** `src/modules/quiz/infrastructure/repositories/hydrators/quiz-question.hydrator.ts`
- **Export:** `hydrateQuestions()`, `QuizQuestionAggregate`
- **Problem:** This hydrator is defined but never imported or used by any file. Questions are mapped directly in `QuizQuestionResponseMapper` instead.
- **Severity:** MEDIUM
- **Impact:** Dead code. The pattern is already handled by the response mapper layer.
- **Recommended Fix:** Delete the hydrator file if not used.

### 1.3 Unused Shared Utility

#### Finding #D5: `shared/cursor/cursor-codec.ts`

- **File:** `src/modules/quiz/shared/cursor/cursor-codec.ts`
- **Exports:** `encodeQuizCursor`, `decodeQuizCursor`, `encodeVersionCursor`, `decodeVersionCursor`
- **Problem:** This codec file exists but is NOT imported anywhere. Cursor serialization/deserialization is handled inline within `QuizCursorMapper` in `mappers/quiz-cursor.mapper.ts`.
- **Severity:** LOW
- **Impact:** Redundant code. The `QuizCursorMapper` re-implements the same logic (serialize/parse with base64).
- **Recommended Fix:** Delete this file and consolidate cursor logic in the mapper.

### 1.4 Unused Analytics Types

#### Finding #D6: `domain/analytics/types/index.ts` — unused types

- **File:** `src/modules/quiz/domain/analytics/types/index.ts`
- **Problem:** Need to verify all exported types from the analytics types index are actually used.
- **Severity:** LOW
- **Recommended Fix:** Audit all analytics type exports for consumption. Prune unused ones.

### 1.5 Unused Domain Link Type

#### Finding #D7: `domain/links/quiz-link-ids.ts`

- **File:** `src/modules/quiz/domain/links/quiz-link-ids.ts`
- **Used by:** `QuizCommandService` (the `normalizeLinkIds` function is used)
- **Status:** ACTIVE — used in `QuizCommandService.createQuiz()` and `QuizCommandService.updateQuiz()`. NOT dead code.
- **Resolution:** This is actually used. No action needed.

### 1.6 Unused Slug Utilities

#### Finding #D8: `domain/slug/quiz-slug.ts`

- **File:** `src/modules/quiz/domain/slug/quiz-slug.ts`
- **Used by:** `QuizQueryService.getRelatedQuizzes()`, `QuizQueryService.getQuizBySlug()`, `QuizCommandService.createQuiz()`, `QuizCommandService.updateQuiz()`
- **Status:** ACTIVE — extensively used. NOT dead code.
- **Resolution:** No action needed.

---

## 2. REDUNDANCY REPORT

### Finding #R1: Duplicate Cursor Encoding Logic

- **Location 1:** `src/modules/quiz/shared/cursor/cursor-codec.ts`
- **Location 2:** `src/modules/quiz/mappers/quiz-cursor.mapper.ts`
- **Problem:** Both files implement identical base64 encode/decode for quiz and version cursors. The shared utility is defined but unused while the mapper duplicates the logic.
- **Severity:** MEDIUM
- **Impact:** Maintenance burden — changes must be made in two places. Violates DRY.
- **Recommended Fix:** Use the shared codec in the mapper, or delete the codec file if it adds no value over the inline implementation.

### Finding #R2: Duplicate Pagination Logic Across `QuizQueryService`

- **Location:** `src/modules/quiz/domain/quiz/quiz-query.service.ts` (lines 139-149, 159-169, 179-189, 199-209)
- **Problem:** Four near-identical blocks of pagination slicing and cursor-building logic. Each method (`listQuizzes`, `listUserQuizzes`, `listDraftQuizzes`, `listPublishedQuizzes`) independently computes `hasNextPage`, slices the array, and builds the cursor.
- **Severity:** MEDIUM
- **Impact:** Code duplication. Each change to pagination behavior must be replicated in 4 places.
- **Recommended Fix:** Extract to a private helper method: `_buildPaginatedResult(rows, limit)`.

### Finding #R3: Duplicate `getTrendingQuizzes` Query Pattern

- **Location 1:** `src/modules/quiz/domain/analytics/quiz-analytics.repository.ts` — `getTrendingQuizzes()`
- **Location 2:** `src/modules/quiz/domain/analytics/quiz-analytics.repository.ts` — `getPopularQuizzes()`
- **Problem:** Both methods share nearly identical structure: select from `quizStats` + `quizzes` join, apply category filter in-app, return ranked list. The category filtering is done in application code instead of SQL.
- **Severity:** LOW
- **Recommended Fix:** Consider extracting the base query pattern. However, the duplication is minor and may not warrant extraction given the different ordering columns.

### Finding #R4: Duplicate `getCategoryAnalytics` and `getTagAnalytics` Logic

- **Location:** `src/modules/quiz/domain/analytics/quiz-analytics.repository.ts` (lines 246-432)
- **Problem:** `getCategoryAnalytics` and `getTagAnalytics` share nearly identical computation logic for empty-state returns, `thirtyDaysAgo` cutoff, reduce/sum over stats, and computing average scores.
- **Severity:** LOW
- **Recommended Fix:** Extract shared computation to a private helper method `_computeAnalyticsSummary(stats, thirtyDaysAgo)`.

### Finding #R5: Duplicate Repository Error Mapping

- **Location 1:** `src/modules/quiz/infrastructure/repositories/quiz.repository.ts` — `mapCreateError()`, `mapUpdateError()`
- **Location 2:** `src/modules/quiz/infrastructure/repositories/quiz-version.repository.ts` — `mapInsertError()`
- **Problem:** Both repositories independently implement PostgreSQL error code mapping (`23505` for unique violations, `23503` for FK violations). The logic is nearly identical.
- **Severity:** LOW
- **Impact:** If new error codes need to be added, both files must be updated.
- **Recommended Fix:** Extract to a shared utility or base repository class.

### Finding #R6: Duplicate `isHidden = false` Filter

- **Location:** `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`
- **Problem:** `listQuizzes`, `listByCreatorId`, `listDraftsByCreatorId`, and `listPublishedByCreatorId` all independently add `eq(QUIZ_COLUMNS.isHidden, false)` to their filter arrays. However, `listDraftsByCreatorId` and `listPublishedByCreatorId` use the `QUIZ_VERSION_COLUMNS.status` filter from a `leftJoin` on `quizVersions` but then filter on `eq(QUIZ_VERSION_COLUMNS.status, 'draft')` — which is a LEFT JOIN filter. This is semantically different: it filters rows where the joined version status matches, but `LEFT JOIN + WHERE joined_col = 'draft'` acts like `INNER JOIN` for non-null values.
- **Severity:** LOW
- **Recommended Fix:** Review if `listPublishedByCreatorId` should filter `isHidden` as well.

### Finding #R7: Duplicate Domain Event Emission Pattern

- **Location:** `src/modules/quiz/domain/events/quiz-domain.event-bus.ts`
- **Problem:** `emitQuizCreated`, `emitQuizUpdated`, `emitQuizDeleted`, `emitQuizVersionCreated`, `emitQuizVersionPublished` all call `this.emit(event)` — which is a simple passthrough. The bus could simply expose `emit(event: QuizDomainEvent)` directly without the 5 wrapper methods.
- **Severity:** LOW
- **Recommended Fix:** Simplify the event bus to a single `emit<T extends QuizDomainEvent>(event: T): void` method.

---

## 3. ARCHITECTURE REPORT

### 3.1 DDD Violations

#### Finding #A1: Missing Domain Aggregate Roots

- **Problem:** Despite the existence of `domain/aggregates/` directory (containing placeholder files), there are NO actual aggregate root classes. All business logic resides in "Domain Services" (`QuizCommandService`, `QuizQueryService`, `QuizVersionService`, `QuizQuestionService`), which violates DDD's core principle that the aggregate root should encapsulate business rules and invariants.
- **Current Architecture:**
  - `QuizRepository` directly returns raw row objects
  - Domain services orchestrate between repositories
  - No aggregate root encapsulates entity state transitions
- **Impact:** Business rules are scattered across domain services and application services. Invariants are enforced at the service layer rather than within the aggregate boundary.
- **Severity:** HIGH
- **Recommended Fix:** Implement actual aggregate roots (`QuizAggregate`, `QuizVersionAggregate`) that enforce invariants and manage state transitions. Domain services should become thin orchestrators.

#### Finding #A2: Domain Events Are In-Process Only

- **File:** `src/modules/quiz/domain/events/quiz-domain.event-bus.ts`
- **Problem:** The event bus uses a simple in-process observer pattern (`handlers[]` array). Events are dispatched synchronously within the same request lifecycle. There is no integration event bridge to an external message broker (RabbitMQ, Kafka, etc.).
- **Impact:** Events cannot be consumed by other services (attempt module, notification module, etc.) in a decoupled way. Cross-service communication is tightly coupled.
- **Severity:** HIGH
- **CQRS Impact:** The read-side (analytics) cannot be updated asynchronously via events.
- **Recommended Fix:** Introduce an integration event publisher that bridges domain events to a message broker. Alternatively, document this as a known limitation.

#### Finding #A3: AnalyticsEventHandler Is Never Subscribed

- **File:** `src/modules/quiz/domain/analytics/analytics-event-handler.ts`
- **Problem:** `AnalyticsEventHandler` is defined with methods `onAttemptCompleted`, `onReviewSubmitted`, `onBookmarkAdded`, etc. These methods are NEVER called because the `QuizDomainEventBus.subscribe()` method is never invoked with a handler for `AnalyticsEventHandler`. There is no bootstrap code wiring this up.
- **Impact:** The entire analytics event-driven refresh mechanism is dead code. Metrics are only refreshed via scheduled jobs, not event-driven.
- **Severity:** HIGH
- **Recommended Fix:** Wire up `AnalyticsEventHandler` subscriptions in a module `onModuleInit` hook, or remove the unused handler methods and rely solely on scheduled refresh.

#### Finding #A4: Leaky Abstraction — Infrastructure in Domain

- **File:** `src/modules/quiz/domain/analytics/metrics-calculator.service.ts`
- **Problem:** `MetricsCalculatorService` is a `@Injectable()` domain service that directly injects `DRIZZLE` and constructs raw SQL queries (`count`, `eq`, `and`, `gte`, `sql` from drizzle-orm). This is infrastructure code living in the domain layer.
- **Impact:** Domain layer depends on infrastructure (Drizzle ORM). Violates the Dependency Rule. Also, heavy use of `eslint-disable-next-line` comments indicates fragile type safety.
- **Severity:** HIGH
- **Recommended Fix:** Move query logic to the infrastructure layer. Create a `MetricsRepository` port and implementation. Domain service should remain orchestration-only.

#### Finding #A5: Domain Service Knows About DTOs

- **File:** `src/modules/quiz/domain/analytics/quiz-analytics.service.ts`
- **Problem:** The analytics service references `QuizAnalytics` type from `./types` which contains response-shaped types. Domain types should be pure, not shaped for API responses.
- **Impact:** Domain is aware of presentation concerns.
- **Severity:** MEDIUM
- **Recommended Fix:** Separate domain analytics types from response DTOs.

#### Finding #A6: Application Service Knows About Domain Events

- **File:** `src/modules/quiz/application/quiz.application.service.ts`
- **Problem:** `QuizApplicationService` imports and calls `QuizQueryService.getRelatedQuizzes()` which internally calls `normalizeQuizSlug` and potentially calls `getQuizBySlug` as a side-effect (line 111: `if (relatedQuizzes.length === 0) { await this.getQuizBySlug(normalizedSlug); }`). This is a silent side-effect — fetching data to throw an error if no related quizzes exist. This is cross-cutting concern leakage.
- **Severity:** MEDIUM
- **Recommended Fix:** Separate the "verify quiz exists" concern from the "get related quizzes" query.

### 3.2 CQRS Violations

#### Finding #C1: Analytics Has No Separate Read Model

- **Problem:** The analytics subdomain (`QuizAnalyticsService`, `MetricsCalculatorService`, `TrendingService`, `PopularityService`) reads from the `quiz_stats` table, which is a write target for metrics refresh operations. There is no materialized read model separate from the write model.
- **Impact:** The `quiz_stats` table serves as both source of truth and read model. This creates tight coupling between write and read paths.
- **Severity:** MEDIUM
- **Recommended Fix:** Consider CQRS with a dedicated read model projection. However, the current design may be intentional (denormalized stats table serves as a projection).

#### Finding #C2: `QuizQueryService` Contains Write Operation Side-Effects

- **File:** `src/modules/quiz/domain/quiz/quiz-query.service.ts` (line 111)
- **Problem:** `getRelatedQuizzes()` has a side-effect: if no related quizzes are found, it calls `getQuizBySlug()` which throws `QuizNotFoundError`. This mixes query logic with existence-checking that has side effects (the exception throw).
- **Severity:** LOW
- **Recommended Fix:** Return an empty array instead of throwing, or separate the existence check.

### 3.3 Event-Driven Design Violations

#### Finding #E1: In-Process Events Only (See A2 above)

- All domain events are in-process. No integration events for cross-service communication.

#### Finding #E2: Event Bus Has No Dead Letter Handling

- **File:** `src/modules/quiz/domain/events/quiz-domain.event-bus.ts`
- **Problem:** If a handler in the handlers array throws, the error propagates up the call stack with no dead-letter queue, no retry mechanism, no logging of failed events.
- **Impact:** A failing handler can crash the request or silently swallow errors.
- **Severity:** HIGH
- **Recommended Fix:** Wrap each handler call in a try/catch with error logging.

#### Finding #E3: No Event Sourcing

- **Problem:** Quiz state transitions (create, update, publish, archive) are not stored as an event log. Only the current state is persisted.
- **Impact:** No audit trail, no temporal queries, no event replay capability.
- **Severity:** MEDIUM
- **Recommended Fix:** Consider event sourcing for the quiz aggregate if audit/temporal requirements exist.

### 3.4 Layer Violations

#### Finding #L1: Infrastructure in Domain Layer (See A4 above)

- `MetricsCalculatorService` directly uses Drizzle ORM in domain layer.

#### Finding #L2: QuizSlugConflictError Not Caught by Exception Filter

- **File:** `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`
- **Problem:** `QuizSlugConflictError` is thrown by `mapCreateError()` and `mapUpdateError()` in the repository (infrastructure), but `QuizDomainExceptionFilter` does NOT handle `QuizSlugConflictError`. It handles `QuizConflictError` but not `QuizSlugConflictError`.
- **Impact:** Slug conflict errors will fall through to the "Internal server error" fallback (500), not the proper CONFLICT (409) response.
- **Severity:** CRITICAL
- **Recommended Fix:** Add `QuizSlugConflictError` mapping to `QuizDomainExceptionFilter`.

#### Finding #L3: QuizQuestionPositionConflictError, QuizAnswerOptionPositionConflictError, QuizMultipleCorrectOptionsError Not Caught

- **Files:** `src/modules/quiz/infrastructure/repositories/quiz-question.repository.ts`
- **Problem:** Same as L2. These domain errors are thrown from infrastructure but the exception filter only handles a subset of domain errors.
- **Impact:** These constraint violations return 500 instead of proper 409 CONFLICT or 400 BAD_REQUEST.
- **Severity:** HIGH
- **Recommended Fix:** Add these error types to `QuizDomainExceptionFilter`.

#### Finding #L4: Application Layer Has Business Logic

- **File:** `src/modules/quiz/application/quiz.application.service.ts` (lines 214-234)
- **Problem:** `getTrendingQuizzes()` constructs the response shape directly in the application service, including hardcoding `period: 'weekly'` and building the response object. This should be a mapper's responsibility.
- **Severity:** LOW
- **Recommended Fix:** Move response construction to a mapper.

---

## 4. DEPENDENCY REPORT

### 4.1 Dependency Graph

```
CONTROLLER LAYER
│
├── QuizController
│   ├── QuizApplicationService (application)
│   ├── QuizVersionApplicationService (application)
│   └── QuizQuestionApplicationService (application)
│
└── QuizVersionController
    └── QuizVersionApplicationService (application)

APPLICATION LAYER
│
├── QuizApplicationService
│   ├── QuizQueryService (domain)
│   ├── QuizCommandService (domain)
│   ├── QuizAnalyticsService (domain)
│   ├── QuizResponseMapper (mapper)
│   ├── QuizQuestionResponseMapper (mapper)
│   ├── QuizStatsResponseMapper (mapper)
│   └── CreatorQuizAnalyticsResponseMapper (mapper)
│
├── QuizVersionApplicationService
│   ├── QuizVersionService (domain)
│   ├── QuizVersionResponseMapper (mapper)
│   └── QuizQuestionResponseMapper (mapper)
│
└── QuizQuestionApplicationService
    └── QuizQuestionService (domain)

DOMAIN LAYER
│
├── QuizCommandService
│   ├── QuizRepositoryPort (port)
│   ├── QuizQueryService (domain) ⚠ CIRCULAR
│   ├── QuizDomainEventBusPort (port)
│   └── QuizPolicy (domain)
│
├── QuizQueryService
│   ├── QuizRepositoryPort (port)
│   ├── QuizQuestionRepositoryPort (port)
│   ├── QuizRecommendationRepositoryPort (port)
│   └── QuizAnalyticsRepositoryPort (port)
│
├── QuizVersionService
│   ├── QuizVersionRepositoryPort (port)
│   ├── QuizQuestionRepositoryPort (port)
│   ├── QuizQueryService (domain) ⚠ CIRCULAR
│   └── QuizDomainEventBusPort (port)
│
├── QuizQuestionService
│   ├── QuizQuestionRepositoryPort (port)
│   └── QuizVersionRepositoryPort (port)
│
├── QuizAnalyticsService
│   ├── QuizAnalyticsRepositoryPort (port)
│   ├── MetricsCalculatorService (domain)
│   ├── TrendingService (domain)
│   └── PopularityService (domain)
│
├── MetricsCalculatorService
│   └── DRIZZLE (infrastructure) ⚠ LAYERING VIOLATION
│
├── PopularityService
│   ├── MetricsCalculatorService (domain)
│   └── DRIZZLE (infrastructure) ⚠ LAYERING VIOLATION
│
├── TrendingService
│   ├── QuizAnalyticsRepositoryPort (port)
│   └── DRIZZLE (infrastructure) ⚠ LAYERING VIOLATION
│
└── AnalyticsEventHandler
    └── QuizAnalyticsService (domain)

INFRASTRUCTURE LAYER
│
├── QuizRepository → implements QuizRepositoryPort → uses Drizzle
├── QuizVersionRepository → implements QuizVersionRepositoryPort → uses Drizzle
├── QuizQuestionRepository → implements QuizQuestionRepositoryPort → uses Drizzle
├── QuizAnalyticsRepository → implements QuizAnalyticsRepositoryPort → uses Drizzle
├── QuizRecommendationRepository → implements QuizRecommendationRepositoryPort → uses Drizzle
└── QuizDomainEventBus → implements QuizDomainEventBusPort
```

### 4.2 Dependency Violations

#### Finding #V1: Circular Dependency — QuizCommandService ↔ QuizQueryService

- **Files:** `src/modules/quiz/domain/quiz/quiz-command.service.ts`, `src/modules/quiz/domain/quiz/quiz-query.service.ts`
- **Problem:** `QuizCommandService` injects `QuizQueryService` (line 36), and `QuizQueryService` has `getActiveQuizRecordById()` called by `QuizCommandService`. However, `QuizQueryService` does NOT inject `QuizCommandService` directly. The apparent circular is only in the dependency injection graph, not in actual runtime calls — `QuizQueryService` is read-only and `QuizCommandService` uses it to re-fetch state after mutations.
- **Severity:** MEDIUM
- **Impact:** Potential DI ordering issues if `QuizQueryService` ever needs to call `QuizCommandService`. Currently safe but fragile.
- **Recommended Fix:** Extract the "refetch after mutation" pattern into a shared query helper that both can use without direct coupling.

#### Finding #V2: Circular Dependency — QuizVersionService ↔ QuizQueryService

- **Files:** `src/modules/quiz/domain/version/quiz-version.service.ts`, `src/modules/quiz/domain/quiz/quiz-query.service.ts`
- **Problem:** Same pattern as V1. `QuizVersionService` injects `QuizQueryService`.
- **Severity:** MEDIUM
- **Recommended Fix:** Same as V1.

#### Finding #V3: Domain → Infrastructure (Direct Drizzle ORM in Domain)

- **Files:**
  - `src/modules/quiz/domain/analytics/metrics-calculator.service.ts`
  - `src/modules/quiz/domain/analytics/trending.service.ts` (assumed similar)
  - `src/modules/quiz/domain/analytics/popularity.service.ts`
- **Problem:** Domain services inject `DRIZZLE` directly, bypassing the port/adapter pattern. The domain layer should define ports and infrastructure should implement them.
- **Severity:** HIGH
- **Impact:** Database schema changes (column renames, table changes) require changes in domain code. Domain cannot be tested without a database.
- **Recommended Fix:** Create `MetricsRepositoryPort` and `TrendingRepositoryPort` interfaces in the domain. Implement in infrastructure.

#### Finding #V4: Application → Domain — Direct Mapper Access

- **File:** `src/modules/quiz/application/quiz.application.service.ts`
- **Problem:** Application services directly use mappers (`QuizResponseMapper`, `QuizStatsResponseMapper`, etc.) rather than going through domain services.
- **Severity:** LOW
- **Impact:** Minor coupling. Could be considered appropriate since mapping is a presentation concern.
- **Recommended Fix:** Acceptable as-is, or inject mappers through a port if strict layering is required.

---

## 5. EVENT FLOW REPORT

### Event Map

| Event                       | Publisher                                 | Event Bus                                       | Subscriber         | Handler                                      | Side Effect                                     |
| --------------------------- | ----------------------------------------- | ----------------------------------------------- | ------------------ | -------------------------------------------- | ----------------------------------------------- |
| `QuizCreatedEvent`          | `QuizCommandService.createQuiz()`         | `QuizDomainEventBus.emitQuizCreated()`          | ❌ NONE            | —                                            | —                                               |
| `QuizUpdatedEvent`          | `QuizCommandService.updateQuiz()`         | `QuizDomainEventBus.emitQuizUpdated()`          | ❌ NONE            | —                                            | —                                               |
| `QuizDeletedEvent`          | `QuizCommandService.softDeleteQuizById()` | `QuizDomainEventBus.emitQuizDeleted()`          | ❌ NONE            | —                                            | —                                               |
| `QuizVersionCreatedEvent`   | `QuizVersionService.createQuizVersion()`  | `QuizDomainEventBus.emitQuizVersionCreated()`   | ❌ NONE            | —                                            | —                                               |
| `QuizVersionPublishedEvent` | `QuizVersionService.publishQuizVersion()` | `QuizDomainEventBus.emitQuizVersionPublished()` | ❌ NONE            | —                                            | —                                               |
| Attempt Completed           | `AttemptCommandService` (external)        | —                                               | ✅ Partially wired | `AnalyticsEventHandler.onAttemptCompleted()` | `QuizAnalyticsService.refreshQuizMetrics()`     |
| Review Submitted            | `ReviewService` (external)                | —                                               | ✅ Partially wired | `AnalyticsEventHandler.onReviewSubmitted()`  | `QuizAnalyticsService.refreshReviewMetrics()`   |
| Review Deleted              | `ReviewService` (external)                | —                                               | ✅ Partially wired | `AnalyticsEventHandler.onReviewDeleted()`    | `QuizAnalyticsService.refreshReviewMetrics()`   |
| Bookmark Added              | `BookmarkService` (external)              | —                                               | ✅ Partially wired | `AnalyticsEventHandler.onBookmarkAdded()`    | `QuizAnalyticsService.refreshBookmarkMetrics()` |
| Bookmark Removed            | `BookmarkService` (external)              | —                                               | ✅ Partially wired | `AnalyticsEventHandler.onBookmarkRemoved()`  | `QuizAnalyticsService.refreshBookmarkMetrics()` |

### Legend

- ✅ Fully wired — event is emitted and consumed
- ⚠ Partial — subscriber exists but subscription is not wired up
- ❌ Broken — event is emitted but no subscribers exist

### Event Flow Details

#### `QuizCreatedEvent`

- **Publisher:** `QuizCommandService.createQuiz()` (line 74)
- **Transport:** `QuizDomainEventBus.emitQuizCreated()`
- **Subscription:** None — `QuizDomainEventBus.subscribe()` is never called
- **Status:** ❌ Broken
- **Missing:** No downstream consumers (e.g., attempt module, notification module) are connected to this event.

#### `QuizUpdatedEvent`

- **Publisher:** `QuizCommandService.updateQuiz()` (line 147)
- **Status:** ❌ Broken
- **Missing:** Same as above.

#### `QuizDeletedEvent`

- **Publisher:** `QuizCommandService.softDeleteQuizById()` (line 162)
- **Status:** ❌ Broken
- **Missing:** No cascade cleanup or notification on quiz deletion.

#### `QuizVersionCreatedEvent`

- **Publisher:** `QuizVersionService.createQuizVersion()` (lines 97, 131)
- **Status:** ❌ Broken
- **Missing:** No consumers for version creation events.

#### `QuizVersionPublishedEvent`

- **Publisher:** `QuizVersionService.publishQuizVersion()` (line 318)
- **Status:** ❌ Broken
- **Missing:** This event should trigger analytics refresh, ranking updates, and notification delivery. None are wired.

#### External Events (Attempt, Review, Bookmark)

- **Source:** Other modules (`attempt`, `review`, `bookmark`)
- **Consumer:** `AnalyticsEventHandler`
- **Status:** ⚠ Partial
- **Problem:** `AnalyticsEventHandler` methods are defined but the handler is NEVER instantiated as a subscriber. There is no `onModuleInit` or bootstrap code that calls `QuizDomainEventBus.subscribe(handler)`.

### Finding #EF1: All 5 Quiz Domain Events Are Dead

- **Severity:** CRITICAL
- **Impact:** The entire domain event system for the quiz module is non-functional. All events are emitted but nobody listens.
- **Recommended Fix:** Either remove the event emission code (dead code) or implement subscribers.

### Finding #EF2: AnalyticsEventHandler Subscriptions Not Wired

- **Severity:** CRITICAL
- **Impact:** The event-driven analytics refresh mechanism exists in code but is never connected to the event bus.
- **Recommended Fix:** Add subscription bootstrap in module initialization, or convert to message-queue-based events.

---

## 6. ENDPOINT AUDIT

### 6.1 Endpoint List

| Method   | Path                                              | Controller              | Auth     | Status    |
| -------- | ------------------------------------------------- | ----------------------- | -------- | --------- |
| `POST`   | `/quizzes`                                        | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes`                                        | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/me`                                     | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/me/drafts`                              | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/me/published`                           | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/trending`                               | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/popular`                                | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/me/analytics`                           | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/featured`                               | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/:id/stats`                              | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/:slug/similar`                          | `QuizController`        | Public   | ✅ Active |
| `GET`    | `/quizzes/:slug`                                  | `QuizController`        | Public   | ✅ Active |
| `PATCH`  | `/quizzes/:id`                                    | `QuizController`        | Required | ✅ Active |
| `DELETE` | `/quizzes/:id`                                    | `QuizController`        | Required | ✅ Active |
| `POST`   | `/quizzes/:id/versions`                           | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/:id/versions`                           | `QuizController`        | Required | ✅ Active |
| `GET`    | `/quizzes/:id/versions/:versionId`                | `QuizController`        | Required | ✅ Active |
| `POST`   | `/quizzes/:id/versions/:versionId/questions`      | `QuizController`        | Required | ✅ Active |
| `POST`   | `/quizzes/:id/versions/:versionId/questions/bulk` | `QuizController`        | Required | ✅ Active |
| `PATCH`  | `/quiz-versions/:id`                              | `QuizVersionController` | Required | ✅ Active |
| `POST`   | `/quiz-versions/:id/publish`                      | `QuizVersionController` | Required | ✅ Active |

### 6.2 Endpoint Issues

#### Finding #EP1: Redundant Controllers — `QuizVersionController` Should Be Nested

- **File:** `src/modules/quiz/transport/controller/quiz-version.controller.ts`
- **Problem:** `QuizVersionController` is registered at `/quiz-versions` (root-level) while `QuizVersion` endpoints are also accessible at `/quizzes/:id/versions` through `QuizController`. This creates two URL patterns for the same resource type.
- **Impact:** API inconsistency. Version update (`PATCH /quiz-versions/:id`) is at root level while version creation (`POST /quizzes/:id/versions`) is nested. Version detail (`GET /quizzes/:id/versions/:versionId`) is also nested.
- **Severity:** MEDIUM
- **Recommended Fix:** Consolidate all version endpoints under `/quizzes/:id/versions` for consistency, OR remove the nested routes from `QuizController` and keep only root-level version routes.

#### Finding #EP2: Route Parameter Inconsistency — `:id` vs `:slug`

- **Files:** `src/modules/quiz/transport/controller/quiz.controller.ts`
- **Problem:** Some endpoints use `id` (UUID) as path parameter (`GET :id/stats`, `PATCH :id`, `DELETE :id`) while others use `slug` (`GET :slug/similar`, `GET :slug`). This creates an API inconsistency where clients must know which identifier type to use for each endpoint.
- **Impact:** API usability. No unified resource lookup by ID or slug across all endpoints.
- **Severity:** MEDIUM
- **Recommended Fix:** Support both `id` and `slug` as path parameters, or establish a clear convention (e.g., use ID for authenticated owner operations, slug for public read operations).

#### Finding #EP3: Missing Endpoint — Get Quiz by ID

- **Files:** `src/modules/quiz/transport/controller/quiz.controller.ts`
- **Problem:** There is `GET /quizzes/:slug` to get a quiz by slug, but no `GET /quizzes/:id` to get a quiz by UUID. The `PATCH :id` and `DELETE :id` endpoints exist, but there is no public GET endpoint for a quiz by ID.
- **Impact:** Inconvenient for internal/admin use cases where the quiz ID is known but the slug is not.
- **Severity:** MEDIUM
- **Recommended Fix:** Add `GET /quizzes/:id` endpoint.

#### Finding #EP4: Missing Endpoint — Update Quiz Title/Slug Only

- **Files:** `src/modules/quiz/transport/controller/quiz.controller.ts`
- **Problem:** `PATCH /quizzes/:id` updates all mutable quiz fields. There is no dedicated endpoint for partial updates (e.g., title only, slug only).
- **Impact:** Minor. The current endpoint handles partial updates via DTO optional fields, so this is low priority.
- **Severity:** LOW

#### Finding #EP5: Missing Endpoint — Delete Quiz Version

- **Files:** `src/modules/quiz/transport/controller/quiz.controller.ts`, `src/modules/quiz/transport/controller/quiz-version.controller.ts`
- **Problem:** There is no endpoint to delete a draft quiz version. The only version lifecycle endpoints are create, update, list, detail, and publish.
- **Impact:** Cannot clean up draft versions.
- **Severity:** LOW
- **Recommended Fix:** Add `DELETE /quiz-versions/:id` for draft version cleanup.

---

## 7. FINDINGS SUMMARY

### Critical (CRITICAL)

| #   | Category       | File                              | Problem                                                           |
| --- | -------------- | --------------------------------- | ----------------------------------------------------------------- |
| C1  | Error Handling | `quiz-domain-exception.filter.ts` | `QuizSlugConflictError` not mapped → returns 500 instead of 409   |
| C2  | Event-Driven   | `analytics-event-handler.ts`      | `AnalyticsEventHandler` never subscribed — dead event-driven code |
| C3  | Event-Driven   | All domain events                 | All 5 quiz domain events emitted but no subscribers exist         |

### High (HIGH)

| #   | Category       | File                            | Problem                                                               |
| --- | -------------- | ------------------------------- | --------------------------------------------------------------------- |
| H1  | DDD            | `domain/aggregates/`            | 3 placeholder aggregate files — no actual aggregate roots implemented |
| H2  | DDD            | `metrics-calculator.service.ts` | Infrastructure (Drizzle ORM) injected directly into domain service    |
| H3  | Error Handling | `quiz-question.repository.ts`   | Position conflict errors not caught by filter → 500 responses         |
| H4  | Event-Driven   | `quiz-domain.event-bus.ts`      | No dead-letter handling — failing handler crashes request             |
| H5  | Dependency     | Multiple domain services        | Domain → Infrastructure direct coupling (Drizzle in domain layer)     |

### Medium (MEDIUM)

| #   | Category     | File                                                              | Problem                                               |
| --- | ------------ | ----------------------------------------------------------------- | ----------------------------------------------------- |
| M1  | Dead Code    | `domain/aggregates/quiz.aggregate.ts`                             | Placeholder aggregate file, zero imports              |
| M2  | Dead Code    | `domain/aggregates/quiz-version.aggregate.ts`                     | Same as M1                                            |
| M3  | Dead Code    | `domain/aggregates/quiz-question.aggregate.ts`                    | Same as M1                                            |
| M4  | Dead Code    | `infrastructure/repositories/hydrators/quiz-question.hydrator.ts` | Unused hydrator                                       |
| M5  | Redundancy   | `shared/cursor/cursor-codec.ts`                                   | Duplicate cursor encoding logic                       |
| M6  | Redundancy   | `quiz-query.service.ts`                                           | Duplicate pagination logic (4×)                       |
| M7  | Architecture | `metrics-calculator.service.ts`                                   | Domain service contains infrastructure code           |
| M8  | Architecture | `quiz-analytics.service.ts`                                       | Domain types mixed with response shapes               |
| M9  | Dependency   | `quiz-command.service.ts`                                         | Potential circular dependency with quiz-query service |
| M10 | Dependency   | `quiz-version.service.ts`                                         | Potential circular dependency with quiz-query service |
| M11 | Endpoint     | `quiz-version.controller.ts`                                      | Redundant root-level version routes vs nested routes  |
| M12 | Endpoint     | `quiz.controller.ts`                                              | Route param inconsistency (`:id` vs `:slug`)          |
| M13 | Endpoint     | `quiz.controller.ts`                                              | Missing `GET /quizzes/:id` endpoint                   |

### Low (LOW)

| #   | Category     | File                           | Problem                                                     |
| --- | ------------ | ------------------------------ | ----------------------------------------------------------- |
| L1  | Redundancy   | `quiz-analytics.repository.ts` | Duplicate `getCategoryAnalytics`/`getTagAnalytics` logic    |
| L2  | Redundancy   | `quiz.repository.ts`           | Duplicate error mapping in both repositories                |
| L3  | Redundancy   | `quiz-analytics.repository.ts` | Duplicate trending/popular query patterns                   |
| L4  | Architecture | `quiz-domain.event-bus.ts`     | 5 wrapper methods that just call `this.emit()`              |
| L5  | Architecture | `quiz-query.service.ts`        | Side-effect in `getRelatedQuizzes()`                        |
| L6  | Architecture | `quiz.application.service.ts`  | Business logic in response construction                     |
| L7  | Endpoint     | `quiz-version.controller.ts`   | Missing `DELETE /quiz-versions/:id`                         |
| L8  | Performance  | `getTrendingQuizzes()`         | Sequential DB queries in loop (N+1 for recentAttempts)      |
| L9  | Performance  | `rebuildAllMetrics()`          | Sequential refresh of metrics per quiz — no parallelization |
| L10 | Performance  | `refreshAllTrendingScores()`   | Individual DB writes per quiz instead of batch              |
| L11 | Performance  | `refreshAllPopularityScores()` | Same as above                                               |
| L12 | Logging      | Multiple services              | Consistent structured logging — GOOD PATTERN                |

---

## 8. CLEANUP PLAN

### Phase 1: Safe Cleanup (No Architecture Changes)

**Estimated Risk:** LOW

1. **Delete dead aggregate placeholder files** (3 files)
   - `domain/aggregates/quiz.aggregate.ts`
   - `domain/aggregates/quiz-version.aggregate.ts`
   - `domain/aggregates/quiz-question.aggregate.ts`
   - Impact: Zero — these files contain only comments

2. **Delete unused hydrator file**
   - `infrastructure/repositories/hydrators/quiz-question.hydrator.ts`
   - Impact: Zero — no imports exist

3. **Delete duplicate cursor codec**
   - `shared/cursor/cursor-codec.ts`
   - Impact: Low — cursor logic is already in `QuizCursorMapper`

4. **Fix exception filter — add missing error mappings**
   - `QuizSlugConflictError` → 409 CONFLICT
   - `QuizQuestionPositionConflictError` → 409 CONFLICT
   - `QuizAnswerOptionPositionConflictError` → 409 CONFLICT
   - `QuizMultipleCorrectOptionsError` → 400 BAD_REQUEST
   - Impact: Critical fix — these currently return 500

5. **Add missing `GET /quizzes/:id` endpoint**
   - Impact: Adds functionality, no risk

6. **Add missing `DELETE /quiz-versions/:id` endpoint**
   - Impact: Adds functionality, no risk

7. **Consolidate version endpoints** — choose either nested or root-level
   - Pick one pattern and remove duplication
   - Impact: Breaking API change — requires version bump

### Phase 2: Architecture Cleanup (Moderate Risk)

**Estimated Risk:** MEDIUM

1. **Implement `AnalyticsEventHandler` subscriptions** OR remove dead handler methods
   - Option A: Wire up `QuizDomainEventBus.subscribe()` calls in module `onModuleInit`
   - Option B: Delete unused handler methods and rely on scheduler only
   - Impact: Option B is safer; Option A introduces runtime coupling

2. **Extract duplicate pagination logic**
   - Create private helper `_buildPaginatedResult()` in `QuizQueryService`
   - Impact: Low — purely refactoring

3. **Move `MetricsCalculatorService` to infrastructure layer**
   - Create `MetricsRepositoryPort` interface in domain
   - Move implementation to `infrastructure/repositories/metrics.repository.ts`
   - Impact: Medium — changes DI wiring across the module

4. **Extract duplicate repository error mapping**
   - Create shared utility for PostgreSQL error code mapping
   - Impact: Low — purely refactoring

5. **Implement domain event subscribers** OR remove event emission
   - Option A: Implement consumers for the 5 quiz domain events
   - Option B: Remove `eventBus.emit*()` calls from command services
   - Impact: Option B is safer; Option A requires designing event consumers

6. **Fix circular dependency concerns**
   - Extract "refetch after mutation" pattern to a shared helper
   - Impact: Low — purely refactoring

7. **Add dead-letter handling to event bus**
   - Wrap handler calls in try/catch with error logging
   - Impact: Low — adds robustness

8. **Batch database writes in `refreshAllTrendingScores` and `refreshAllPopularityScores`**
   - Use Drizzle batch upsert instead of individual writes
   - Impact: Medium performance improvement

### Phase 3: Future Improvements (Higher Risk, Long-Term)

**Estimated Risk:** HIGH

1. **Implement actual DDD aggregate roots**
   - `QuizAggregate`, `QuizVersionAggregate`, `QuizQuestionAggregate`
   - Encapsulate invariants and state transitions within aggregates
   - Impact: High — significant refactoring of domain and application layers

2. **Introduce integration event bridge**
   - Bridge domain events to message broker (Kafka/RabbitMQ)
   - Enable cross-service event-driven communication
   - Impact: High — infrastructure change, new dependencies

3. **Implement event sourcing for quiz aggregate**
   - Store state transitions as an event log
   - Enable audit trail and temporal queries
   - Impact: Very High — fundamental architecture change

4. **Implement proper CQRS for analytics**
   - Separate read model projections from write model
   - Use materialized views or dedicated read DB
   - Impact: High — infrastructure and data modeling changes

5. **Add database indexes**
   - `quiz_versions(quiz_id, status)` for version filtering
   - `quiz_categories(category_id)` for category lookups
   - `quiz_stats(trending_score)` and `quiz_stats(popularity_score)` for analytics queries
   - `quiz_attempts(quiz_version_id, status, created_at)` for trending calculations
   - Impact: Low risk — schema migration

6. **Add transaction management awareness**
   - Review all multi-step operations for proper transaction boundaries
   - `QuizCommandService.updateQuiz()` — repository call is transactional (OK)
   - `QuizVersionService.publishQuizVersion()` — repository call is transactional (OK)
   - `QuizQuestionService.createQuizQuestions()` — each question insert is separate (NOT transactional)
   - Impact: Medium — partial transactions could leave inconsistent state

7. **Parallelize `rebuildAllMetrics()`**
   - Use `Promise.all()` with chunking to refresh metrics in parallel
   - Impact: Medium performance improvement

---

## APPENDIX: Files Audited

| File                                                              | Lines    | Purpose                     | Status         |
| ----------------------------------------------------------------- | -------- | --------------------------- | -------------- |
| `quiz.module.ts`                                                  | 109      | Module definition           | Audited        |
| `quiz.constants.ts`                                               | ~20      | Constants                   | Referenced     |
| `application/quiz.application.service.ts`                         | 286      | Main app service            | Audited        |
| `application/quiz-version.application.service.ts`                 | 99       | Version app service         | Audited        |
| `application/quiz-question.application.service.ts`                | 68       | Question app service        | Audited        |
| `domain/quiz/quiz-command.service.ts`                             | 166      | Quiz command domain service | Audited        |
| `domain/quiz/quiz-query.service.ts`                               | 237      | Quiz query domain service   | Audited        |
| `domain/version/quiz-version.service.ts`                          | 330      | Version domain service      | Audited        |
| `domain/question/quiz-question.service.ts`                        | 190      | Question domain service     | Audited        |
| `domain/analytics/quiz-analytics.service.ts`                      | 313      | Analytics domain service    | Audited        |
| `domain/analytics/metrics-calculator.service.ts`                  | 247      | Metrics calculation         | Audited        |
| `domain/analytics/popularity.service.ts`                          | 78       | Popularity scoring          | Audited        |
| `domain/analytics/trending.service.ts`                            | TBD      | Trending scoring            | Referenced     |
| `domain/analytics/analytics-event-handler.ts`                     | 92       | Event handler               | Audited        |
| `domain/analytics/quiz-analytics.repository.ts`                   | 492      | Analytics repo impl         | Audited        |
| `domain/ports/index.ts`                                           | 24       | Port barrel export          | Audited        |
| `domain/ports/quiz-repository.port.ts`                            | 154      | Quiz repo port              | Audited        |
| `domain/ports/quiz-version-repository.port.ts`                    | 105      | Version repo port           | Audited        |
| `domain/ports/quiz-question-repository.port.ts`                   | 68       | Question repo port          | Audited        |
| `domain/ports/quiz-domain-event-bus.port.ts`                      | ~10      | Event bus port              | Audited        |
| `domain/events/quiz-domain.event-bus.ts`                          | 65       | Event bus impl              | Audited        |
| `domain/events/quiz-domain.events.ts`                             | 59       | Event definitions           | Audited        |
| `domain/errors/index.ts`                                          | 13       | Error barrel export         | Audited        |
| `domain/errors/quiz-domain.errors.ts`                             | TBD      | Error definitions           | Referenced     |
| `domain/analytics/errors/quiz-analytics.errors.ts`                | TBD      | Analytics errors            | Referenced     |
| `domain/policies/quiz.policy.ts`                                  | TBD      | Quiz authorization          | Referenced     |
| `domain/policies/quiz-version.policy.ts`                          | TBD      | Version authorization       | Referenced     |
| `domain/version/quiz-version-state-machine.ts`                    | TBD      | Version state machine       | Referenced     |
| `domain/links/quiz-link-ids.ts`                                   | TBD      | Link ID normalization       | Referenced     |
| `domain/slug/quiz-slug.ts`                                        | TBD      | Slug normalization          | Referenced     |
| `infrastructure/repositories/quiz.repository.ts`                  | 655      | Quiz repo impl              | Audited        |
| `infrastructure/repositories/quiz-version.repository.ts`          | 335      | Version repo impl           | Audited        |
| `infrastructure/repositories/quiz-question.repository.ts`         | 211      | Question repo impl          | Audited        |
| `infrastructure/repositories/quiz-recommendation.repository.ts`   | 165      | Recommendation repo         | Audited        |
| `infrastructure/repositories/hydrators/quiz-question.hydrator.ts` | TBD      | Question hydrator           | Audited        |
| `transport/controller/quiz.controller.ts`                         | 442      | Quiz REST controller        | Audited        |
| `transport/controller/quiz-version.controller.ts`                 | 76       | Version REST controller     | Audited        |
| `transport/filters/quiz-domain-exception.filter.ts`               | 73       | Exception filter            | Audited        |
| `scheduler/analytics.scheduler.ts`                                | 85       | Scheduled jobs              | Audited        |
| `mappers/*.ts`                                                    | Various  | Response mappers            | Audited        |
| `dto/request/*.ts`                                                | Various  | Request DTOs                | Audited        |
| `dto/response/*.ts`                                               | Various  | Response DTOs               | Audited        |
| `domain/types/*.ts`                                               | Various  | Domain types                | Audited        |
| `domain/analytics/ports/*.ts`                                     | Various  | Analytics ports             | Audited        |
| `domain/analytics/types/*.ts`                                     | Various  | Analytics types             | Audited        |
| `domain/aggregates/*.ts`                                          | ~50 each | Aggregate placeholders      | Audited (dead) |
| `shared/cursor/cursor-codec.ts`                                   | TBD      | Cursor codec                | Audited (dead) |
