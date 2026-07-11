# RFC 7807 Error Response Standardization Plan

> **Status:** Architecture audit complete. No production code has been modified yet. This document is the canonical migration plan for moving every error response to **RFC 7807 Problem Details**. It is the companion to [`docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md`](./migrations/RESPONSE_ENVELOPE_MIGRATION.md), which standardized **success** responses. This document standardizes **error** responses.
>
> **Audience:** backend engineers; frontend, mobile, and SDK consumers; on-call reviewers.
>
> **Goal:** enable future implementation through many small, reviewable PRs instead of one large refactor.

---

## Table of contents

1. [Background](#1-background)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Current architecture audit](#3-current-architecture-audit)
4. [Target architecture](#4-target-architecture)
5. [ProblemDetail contract](#5-problemdetail-contract)
6. [Error-code strategy](#6-error-code-strategy)
7. [Exception hierarchy](#7-exception-hierarchy)
8. [Migration strategy](#8-migration-strategy)
9. [Module-by-module migration order](#9-module-by-module-migration-order)
10. [Testing strategy](#10-testing-strategy)
11. [Rollback strategy](#11-rollback-strategy)
12. [Risks](#12-risks)
13. [Success criteria](#13-success-criteria)
14. [Future improvements](#14-future-improvements)
15. [Appendices](#15-appendices)

---

## 1. Background

The backend currently returns **four distinct error response shapes** depending on which module catches the exception:

| Shape                                                            | Source                                                                    | Approx. coverage             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| **A — RFC 7807 ProblemDetail** (`type`, `title`, `status`, `detail`, `instance`, `extensions.requestId`) | `GlobalExceptionFilter`, plus the **already-converted** domain filters (auth, quiz, attempt, user) | 5 of 14 HTTP filters + 1 WS filter |
| **B — Legacy NestJS** (`statusCode`, `message`, `error`)         | category, tag, tournament, review, bookmark, instance (HTTP), social, achievement | 8 of 14 HTTP filters         |
| **C — Ranking custom** (`statusCode`, `message`, `code`, `timestamp`) | `RankingDomainExceptionFilter` (catch-all `@Catch()`, not `@Catch(RankingDomainError)`)      | 1 of 14 HTTP filters         |
| **D — Discussion hybrid** (RFC 7807 with `DISCUSSION_PROBLEM_URIS` lookup, no `extensions`) | `DiscussionDomainExceptionFilter` (uses a `STATUS_MAP` keyed on `exception.name`)              | 1 of 14 HTTP filters         |

In addition, every `@Catch(SomeDomainError)` filter has a hand-rolled `HTTP_ERROR_NAMES` table and a private `mapToHttp()` method (or its equivalent). Each module that was migrated to RFC 7807 re-implements the same logic, the same `RFC7807_TYPE_URIS` lookup, the same `instance = request.originalUrl ?? request.url` line, and the same `extensions.requestId` injection. The duplication is **the** maintenance problem this plan exists to solve.

### 1.1 Why this creates maintenance problems

1. **Per-module fragmentation.** The frontend currently has to branch on `response.data` shape to determine whether it received `extensions.code`, `code`, `error`, or `title` — and even then, which machine-readable field it should consult. A `forbidden` is a `403` from one module returns `{ statusCode: 403, message: "...", error: "Forbidden" }` and from another returns `{ type: "...", status: 403, title: "Forbidden" }`. Every client consumer pays a tax for this inconsistency.
2. **Logging is duplicated 14 times.** `requestLogger.warn({ event: 'http_client_error', method, url, statusCode, error: title, details: detail })` is literally copy-pasted across `AuthDomainExceptionFilter`, `QuizDomainExceptionFilter`, `AttemptDomainExceptionFilter`, and `UserDomainExceptionFilter`. Bug fixes happen in one and miss the other three.
3. **The `RankingDomainExceptionFilter` is a `@Catch()` catch-all that shadows `GlobalExceptionFilter`.** NestJS runs controller-scoped filters before the global filter, so a 500 inside ranking produces `{ statusCode: 500, message: "...", code: "INTERNAL_ERROR", timestamp: "..." }` instead of the canonical ProblemDetail. Real 500s in ranking currently look different from real 500s everywhere else.
4. **`DiscussionDomainExceptionFilter` doesn't read `extensions.requestId`** because it never sets it. The discussion 404 doesn't carry the correlation ID that every other module does. On-call loses the request ID for one of the loudest modules in the system.
5. **`RankingDomainError` carries a `code` field; every other domain exception doesn't.** The error-code capability is half-implemented: ranking already knows how to expose `INVALID_XP_EVENT`, `RANK_CALCULATION_ERROR`, `PERIOD_RESET_ERROR`, but nothing else does.
6. **The OpenAPI spec is wrong (or non-existent) for legacy filter responses.** `CategoryDomainExceptionFilter`, `TagDomainExceptionFilter`, etc., produce undocumented response bodies, so Swagger clients can be safely called only against the RFC 7807 modules. New endpoints that trip a legacy filter surprise callers.

### 1.2 Why RFC 7807 is the target

[RFC 7807 (Problem Details for HTTP APIs)](https://datatracker.ietf.org/doc/html/rfc7807) — and its successor, [RFC 9457](https://datatracker.ietf.org/doc/html/rfc9457) — is the only widely-adopted standard for HTTP error response bodies. It is:

- **`Content-Type: application/problem+json`** instead of `application/json`, signalling intent.
- **Self-documenting via `type` URIs** that can resolve to error documentation pages.
- **Driver of every modern client SDK**: Angular's `HttpErrorResponse`, Spring's `ProblemDetail`, ASP.NET's `ProblemDetails`, Springfox, Retrofit converters, etc., all parse RFC 7807 natively.
- **Extensible via the `extensions` member** for `code`, `requestId`, `timestamp`, and any future metadata without breaking the contract.
- **Compatible with our existing infrastructure**: `src/common/types/problem-detail.type.ts` already defines the `ProblemDetail` interface, and `GlobalExceptionFilter` already serializes it.

Standardizing on RFC 7807 is the smallest change that simultaneously fixes the client-side branching, unifies logging, eliminates the duplication, and sets us up for documentation pages and i18n.

---

## 2. Goals and non-goals

### 2.1 Goals

| #  | Goal                                                                                                                | Acceptance signal                                                          |
| -- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| G1 | **One error contract across the entire backend.** Every HTTP error is RFC 7807 ProblemDetail.                       | No filter outside `GlobalExceptionFilter` remains.                       |
| G2 | **Machine-readable `code` for every domain error.** Every domain exception carries a stable, prefixed `code` declared on the class. | `extensions.code` is present for 100% of domain errors in tests.          |
| G3 | **HTTP semantics preserved.** Status codes do not change; 404 means 404, 409 means 409, 422 means 422, etc.         | Snapshot test of HTTP status codes for every endpoint passes.             |
| G4 | **Domain layer stays framework-agnostic.** Domain exceptions extend a `BaseDomainException` and know nothing about ProblemDetail or HTTP status codes. | Domain exception files import only from a `common/errors` module, not from `@nestjs/common`. |
| G5 | **`GlobalExceptionFilter` is the sole HTTP error filter.** Per-module filters are deleted, not just simplified.      | `grep -r "ExceptionFilter" src/modules` returns 0 non-WS results.         |
| G6 | **WebSocket errors stay separate.** The WS filter keeps its `emit('error', ...)` transport because RFC 7807 is an HTTP standard. | `WsExceptionFilter` remains and is updated to also carry `code`.         |
| G7 | **OpenAPI documents only RFC 7807.** All `*DomainErrorDto` classes are deleted; Swagger references `ProblemDetailDto` for every error status. | `openapi.json` contains no `*DomainErrorDto` schemas.                     |
| G8 | **Backwards compatibility is preserved during migration.** Old and new error shapes coexist, controlled by an env flag. | The `LEGACY_COMPAT=1` flag controls runtime emission of legacy fields. Documented in §11. |

### 2.2 Non-goals

| #  | Non-goal                                                                                                                  | Why deferred                                                           |
| -- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| N1 | **Localized error messages.** RFC 7807 `title` and `detail` stay English in this milestone. | i18n requires a translation pipeline and locale negotiation; deferred to §14. |
| N2 | **The 9457 successor protocol.** We stay on 7807 for compatibility.                                                       | 9457 is mostly additive; revisit when i18n lands.                     |
| N3 | **Renaming `GlobalExceptionFilter`.**                                                                                      | The name is accurate (single source of truth); keep it.              |
| N4 | **Changing HTTP status codes for any existing error.**                                                                    | Status codes are a load-bearing part of the contract; never silently change them. |
| N5 | **Auto-generated OpenAPI from error classes.**                                                                             | The generic `ProblemDetailDto` is sufficient; codegen is a §14 idea.  |

---

## 3. Current architecture audit

The audit was conducted in July 2026 by reading every filter, every domain error file, every `*.module.ts` (for provider registration), and every controller (`grep @UseFilters`). All numbers below are from the live tree.

### 3.1 Filter inventory

| # | Filter                                                   | File                                                                              | Decorator                       | Output shape | `extensions.requestId`? | `code` field?      |
| - | -------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- | ------------ | ----------------------- | ------------------ |
| 1 | `GlobalExceptionFilter`                                  | `src/common/filters/global-exception.filter.ts`                                   | `@Catch()` (catch-all)          | RFC 7807 (A) | yes                     | no                 |
| 2 | `AuthDomainExceptionFilter`                              | `src/modules/auth/transport/filters/auth-domain-exception.filter.ts`             | `@Catch(AuthDomainError)`       | RFC 7807 (A) | yes                     | no                 |
| 3 | `QuizDomainExceptionFilter`                              | `src/modules/quiz/transport/filters/quiz-domain-exception.filter.ts`             | `@Catch(QuizDomainError)`       | RFC 7807 (A) | yes                     | no                 |
| 4 | `AttemptDomainExceptionFilter`                           | `src/modules/attempt/transport/filters/attempt-domain-exception.filter.ts`        | `@Catch(AttemptDomainError)`    | RFC 7807 (A) | yes                     | no                 |
| 5 | `UserDomainExceptionFilter`                              | `src/modules/user/transport/filters/user-domain-exception.filter.ts`             | `@Catch(UserDomainError, UserProfilePrivateError)` | RFC 7807 (A) | yes | no |
| 6 | `DiscussionDomainExceptionFilter`                        | `src/modules/discussion/transport/filters/discussion-domain-exception.filter.ts`  | `@Catch(DiscussionError, UserNotFoundError)` | RFC 7807 hybrid (D) | **no** | no (status keyed by `exception.name`) |
| 7 | `RankingDomainExceptionFilter`                           | `src/modules/ranking/transport/filters/ranking-domain-exception.filter.ts`        | `@Catch()` (catch-all, shadows global) | Custom (C) | no | yes (in body, not in `extensions`) |
| 8 | `CategoryDomainExceptionFilter`                          | `src/modules/category/transport/filters/category-domain-exception.filter.ts`      | `@Catch(CategoryDomainError)`   | Legacy (B)   | no                      | no                 |
| 9 | `TagDomainExceptionFilter`                               | `src/modules/tag/transport/filters/tag-domain-exception.filter.ts`                | `@Catch(TagDomainError)`        | Legacy (B)   | no                      | no                 |
| 10 | `TournamentDomainExceptionFilter`                       | `src/modules/tournament/transport/filters/tournament-domain-exception.filter.ts`  | `@Catch(TournamentDomainError)` | Legacy (B)   | no                      | no                 |
| 11 | `ReviewDomainExceptionFilter`                           | `src/modules/review/transport/filters/review-domain-exception.filter.ts`          | `@Catch(ReviewDomainError)`     | Legacy (B)   | no                      | no                 |
| 12 | `BookmarkDomainExceptionFilter`                          | `src/modules/bookmark/transport/filters/bookmark-domain-exception.filter.ts`       | `@Catch(BookmarkDomainError)`   | Legacy (B)   | no                      | no                 |
| 13 | `InstanceDomainExceptionFilter` (HTTP)                   | `src/modules/instance/transport/filters/instance-domain-exception.filter.ts`      | `@Catch(InstanceDomainError)`   | Legacy (B)   | no                      | no                 |
| 14 | `SocialDomainExceptionFilter`                            | `src/modules/social/transport/filters/social-domain-exception.filter.ts`          | `@Catch(SocialError)`           | Legacy (B)   | no                      | no                 |
| 15 | `AchievementDomainExceptionFilter`                       | `src/modules/achievement/transport/filters/achievement-domain-exception.filter.ts` | `@Catch(AchievementDomainError, UserProfilePrivateError)` | Legacy (B) | no          | no                 |
| 16 | `WsExceptionFilter` (WebSocket, separate transport)      | `src/modules/instance/transport/filters/ws-exception.filter.ts`                   | `@Catch()`                      | `{ code, message }` (WS frame) | n/a          | yes (top-level)    |

**Distribution:** 5 already-on-RFC 7807 (auth, quiz, attempt, user, global) + 1 RFC 7807 hybrid (discussion: missing `extensions`) + 8 legacy `{ statusCode, message, error }` + 1 catch-all ranking + 1 WebSocket = **16 filters**.

### 3.2 Domain exception classes

A `grep -r "^export class .*Error extends"` enumerates **~95 custom exception classes** across 15 `domain/errors` files. Selected file-level counts (from `grep -c "^export class \\w+Error"`):

| Module    | File                                                            | Domain-base class              | Concrete subclasses | Path-style registration in `index.ts`? |
| --------- | --------------------------------------------------------------- | ------------------------------ | ------------------- | ------------------------------------- |
| auth      | `auth-domain.errors.ts`                                         | `AuthDomainError`              | 13                  | yes                                   |
| quiz      | `quiz-domain.errors.ts`                                         | `QuizDomainError`              | 11                  | yes                                   |
| category  | `category-domain.errors.ts`                                     | `CategoryDomainError`          | 6                   | yes                                   |
| discussion| `domain/errors/index.ts`                                        | `DiscussionError`              | 13 (uses `name` for status lookup) | yes (single file)                     |
| ranking   | `ranking-domain.errors.ts`                                      | `RankingDomainError` (carries `code` field) | 4          | yes                                   |
| attempt   | `attempt-domain.errors.ts`                                      | `AttemptDomainError`           | (≥10)               | yes                                   |
| user      | `user-domain.errors.ts`                                         | `UserDomainError`              | (≥5)                | yes                                   |
| tag       | `tag-domain.errors.ts`                                          | `TagDomainError`               | (~6)                | yes                                   |
| bookmark  | `bookmark-domain.errors.ts`                                     | `BookmarkDomainError`          | (~6)                | yes                                   |
| tournament| `tournament-domain.errors.ts`                                   | `TournamentDomainError`        | (~13)               | yes                                   |
| review    | `review-domain.errors.ts`                                       | `ReviewDomainError`            | (~6)                | yes                                   |
| social    | `social.errors.ts`                                              | `SocialError`                  | (~9)                | yes                                   |
| achievement| `achievement.errors.ts`                                        | `AchievementDomainError`       | (~3)                | yes                                   |
| instance  | `instance-domain.errors.ts`                                     | `InstanceDomainError`          | (~7)                | yes                                   |
| notification | `notification.errors.ts`                                     | (NotificationDomainError)     | (~5)                | yes                                   |

Every domain error currently **does one of three things** that ties it to a specific transport:

1. **Subclasses a per-module `*DomainError`** (the `auth`, `quiz`, `attempt`, `user` modules do this).
2. **Carries a `code` field** (`RankingDomainError`).
3. **Sets `this.name` to a string the filter lookup-tables on** (`DiscussionError`'s `ThreadNotFoundError`, etc.).

The proposed target (§7) collapses (1)+(2)+(3) into a single `BaseDomainException` with a `code` and an optional `status` hint.

### 3.3 Per-module current behavior table

| Module      | Filter                      | Shape | Delegates to global? | `code` exposed? | Has `*DomainErrorDto` Swagger class? | Migration complexity | Priority |
| ----------- | --------------------------- | ----- | -------------------- | ---------------- | -------------------------------------- | -------------------- | -------- |
| auth        | AuthDomainExceptionFilter   | A     | RFC 7807 already     | no (additive)    | yes (in response-docs)                 | **Low** — only need to attach `code` and drop the per-module filter | P1 |
| quiz        | QuizDomainExceptionFilter   | A     | RFC 7807 already     | no               | yes                                    | Low                                                     | P1 |
| attempt     | AttemptDomainExceptionFilter| A     | RFC 7807 already     | no               | yes                                    | Low                                                     | P1 |
| user        | UserDomainExceptionFilter   | A     | RFC 7807 already     | no               | yes                                    | Low                                                     | P1 |
| discussion  | DiscussionDomainExceptionFilter | D | Mixed (no `extensions`) | indirectly (filters map name → URL) | yes                            | Medium — needs `extensions.requestId`, `extensions.code`, deletion of `DiscussionError.name`-based maps | P2 |
| category    | CategoryDomainExceptionFilter | B   | No                   | no               | no                                     | Low — 6 errors to tag                                  | P2 |
| tag         | TagDomainExceptionFilter    | B     | No                   | no               | no                                     | Low — 6 errors                                         | P2 |
| tournament  | TournamentDomainExceptionFilter | B | No                   | no               | yes (`tournament-domain-error.dto.ts`) | Medium — ~13 errors and a complex filter mapping     | P2 |
| bookmark    | BookmarkDomainExceptionFilter | B   | No                   | no               | yes (in `bookmark-response-docs.dto.ts`) | Low — small surface                                   | P2 |
| review      | ReviewDomainExceptionFilter | B     | No                   | no               | yes (in `review-response-docs.dto.ts`; extracted during envelope migration) | Low — 6 errors        | P2 |
| instance (HTTP) | InstanceDomainExceptionFilter | B | No               | no               | yes (`instance-domain-error.dto.ts`)   | Low                                                    | P2 |
| social      | SocialDomainExceptionFilter | B     | No                   | no               | no                                     | Low — 9 errors                                         | P2 |
| achievement | AchievementDomainExceptionFilter | B | No                 | no               | no                                     | Low — 3 errors                                         | P3 (depends on user) |
| ranking     | RankingDomainExceptionFilter (catch-all) | C | **Shadows** global | yes (already in `RankingDomainError`) | yes (`RankingDomainErrorDto`) | **High** — catch-all removes unhandled error path; status-by-code rewrite | P3 |
| global      | GlobalExceptionFilter       | A (for HTTP exceptions it sees, but ranking's catch-all shadows it) | n/a | no | yes (`ProblemDetailDto` in `swagger-schemas.ts`) | Add `extensions.code` resolution for native `HttpException` via `getResponse().code` if present | P1 |

**Priority rationale:**
- **P1** = 4 already-on-RFC-7807 modules that just need `code` + filter deletion. Cheapest wins. Establish the pattern.
- **P2** = 8 legacy `{ statusCode, message, error }` modules. Mechanical conversion. Group by domain size.
- **P3** = 2 modules with structural complications (ranking's catch-all, discussion's name-based lookup).

---

## 4. Target architecture

### 4.1 Responsibility layers

```
┌──────────────────────────────────────────────────────────────────┐
│  domain/                                                          │
│    services throw concrete subclasses of BaseDomainException.    │
│    The exception exposes only *business* information: code.      │
│    Nothing about HTTP, RFC 7807, status codes, or transport.     │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  common/errors/                                                   │
│    BaseDomainException                                            │
│      └─ code: string        (e.g. 'QUIZ_NOT_FOUND'; only field)   │
└────────────────────────┬─────────────────────────────────────────┘
                         │  thrown by application services
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  transport/controllers                                            │
│    Thin. Calls application service, returns the DTO.             │
│    No try/catch. No mapToHttp. No @Catch.                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │  HTTP layer bubbles
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  common/filters/global-exception.filter.ts                        │
│    The ONLY HTTP exception filter in the codebase.                │
│                                                                  │
│    Owns an internal `code → { status, title, typeUri }` map       │
│    (the *only* place HTTP semantics are encoded for domain       │
│    errors). On `BaseDomainException`:                            │
│      type     ← code map lookup (or status-default URI)          │
│      title    ← code map lookup                                  │
│      status   ← code map lookup (or status default)               │
│      detail   ← exception.message                                │
│      instance ← request.url                                      │
│      extensions: { code, requestId, timestamp, ...details }      │
│                                                                  │
│    On native HttpException → problem-detail, mapped as today.    │
│    On uncaught Error → 500 with sanitized message in production. │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  HTTP response                                                    │
│      Content-Type: application/problem+json                       │
│      Body: RFC 7807 ProblemDetail (see §5)                        │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 What each layer owns

| Layer                           | Owns                                                                                         | Does NOT own                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Domain exception classes**    | `code`. Nothing else. Throw classes are reusable across REST, GraphQL, gRPC, CLI, jobs.     | HTTP status, title, type-URI, RFC 7807 specifics.          |
| **Application services**        | Throw the exception, propagate its `code` if logging it.                                     | Mapping; serialization; translation.                      |
| **Controllers**                 | Routing, validation, auth.                                                                   | Error handling. `@UseFilters` is **forbidden** in code review. |
| **`GlobalExceptionFilter`**     | (1) Reading the exception's `code`; (2) looking up HTTP metadata in its own internal map; (3) building ProblemDetail; (4) emitting the response; (5) logging. | Knowing any module's exception classes; embedding HTTP knowledge in the domain. |
| **`@nestjs/common` HttpException subclasses** (NotFoundException, etc.) | Keep for non-domain errors (validation, guards). | Carry `code`. (We rely on `GlobalExceptionFilter` fallback to code-less responses for these.) |

### 4.3 Three properties this architecture guarantees

1. **Single `catch` site.** Every HTTP error response is built by `GlobalExceptionFilter`. There is no per-module exception-handling code to drift.
2. **Single source of truth for `code`.** Each concrete exception class is the only place its `code` is declared. Adding a new error is one PR that adds the exception class; no filter needs touching.
3. **`extensions.requestId` is unconditional.** Even errors thrown from native `HttpException` (validation pipes, JWT guards) now carry `requestId` because the global filter is where the extension is set, not the throwing code.

### 4.4 Domain/transport separation: what changed and why

Earlier versions of this plan put `code`, `httpStatus`, and `title` on the exception class itself. On review, that mixes a *business identifier* (`code`) with two *transport-injected strings* (`httpStatus` is HTTP-only; `title` is HTTP-body-only). The concrete class does not need to know either.

**What this buys us, concretely:**
- The `domain/` package can be reused by a future gRPC or GraphQL adapter without modification. The same exception is thrown; the new adapter provides its own `code → gRPC status / GraphQL error code` map.
- `title` becomes a translation surface (F1 in §14). Localizing `title` for an i18n Android client becomes a transport concern: replace the `title` lookup with one keyed on `code` + locale. The domain class never needs to know.
- HTTP status code ambiguity is **located**, not spread. If we ever question "is `QUIZ_NOT_FOUND` a 404 or a 410?", the answer is in one file: `global-exception.filter.ts`. The previous design encoded the answer on each of 95 exception classes.

**The cost we accepted:**
- `code` (a *string*) is no longer compile-time paired with its `{ status, title }`. A typo in the map key (`'QUIZ_NOT_FOUN D'` with a space) would silently fall through to the status-default. Catch by Phase 4 test: see §10.
- A new domain error requires editing *two* files (the class for `code`; the map for `{ status, title, typeUri }`). This is a deliberate trade-off; we considered keeping the trio on the class to avoid the second file edit, and rejected it under the reasoning in §6.

We deliberately did **not** add a *runtime uniqueness test* (e.g. "every entry in the map corresponds to a class"). The map is bounded (~95 entries), the type system still requires every concrete class to declare `code`, and a per-PR grep check (`grep -rE "readonly code = '" src/modules`) catches missing map entries quickly.

---

## 5. ProblemDetail contract

### 5.1 Wire shape

```json
{
  "type": "https://api.quiz.local/problems/quiz-not-found",
  "title": "Quiz not found",
  "status": 404,
  "detail": "Quiz with id 'abc-123' was not found.",
  "instance": "/quizzes/abc-123",
  "extensions": {
    "code": "QUIZ_NOT_FOUND",
    "requestId": "01HZMR3K5P8W2J6XTV9Y8QF4N0",
    "timestamp": "2026-07-11T08:47:00.000Z",
    "validationErrors": [
      { "field": "title", "messages": ["must be a string"] }
    ]
  }
}
```

### 5.2 Top-level fields

| Field       | Type   | RFC 7807 section | Origin                                                                                          | Why it exists                                                                                           |
| ----------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `type`      | string (URI) | §3.1       | `code → type-URI` lookup in `GlobalExceptionFilter` (transport-layer map).                      | Stable URI identifying the problem class. Clients can switch on the URI without parsing the message.   |
| `title`     | string | §3.1             | `code → title` lookup in `GlobalExceptionFilter`.                                              | Human-readable summary of the problem class. **Transport-side data**, localized in §14 F1.            |
| `status`    | number | §3.1             | `code → status` lookup in `GlobalExceptionFilter` (fallback to status-default URI on miss).     | Mirrors the HTTP status code. RFC requires this.                                                       |
| `detail`    | string | §3.1             | Domain exception `.message`. Passed through verbatim.                                          | Human-readable, **occurrence-specific** explanation. May include entity IDs, conflict field names, etc.   |
| `instance`  | string (URI ref) | §3.1    | `request.originalUrl ?? request.url`. Default set by filter; allow exception to override.        | URI identifying the specific occurrence. Defaults to request URL.                                       |
| `extensions` | object | §3.2             | Built by `GlobalExceptionFilter`.                                                              | Cross-cutting runtime metadata (correlation ID, machine code, timestamp).                              |

### 5.3 `extensions` fields

| Field                | Type                       | Required? | Origin                                                | Why it exists                                                                                                                                |
| -------------------- | -------------------------- | --------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`               | string (machine-readable)  | **always**| `BaseDomainException.code` or fallback `DOMAIN_ERROR` | The stable identifier clients switch on. Naming convention in §6.                                                                          |
| `requestId`          | string                     | **always**| `request.id` (set by `CorrelationInterceptor`).       | On-call correlation. Already implemented; ensure it's emitted even when the native HttpException path runs.                                  |
| `timestamp`          | string (ISO 8601)          | **always**| `new Date().toISOString()`                            | Log-correlation helper. Distinct from `meta.timestamp` in success envelopes (RFC 7807 has no `meta`).                                       |
| `validationErrors`   | array of `{field, messages}` | only for validation errors (`HttpStatus.BAD_REQUEST` from `ValidationPipe`) | Built from the validation pipe's `getResponse().message` array. | NestJS `ValidationPipe` returns a string[] of errors; we lift them into a structured shape so clients can map per-field without re-parsing. |
| `details`            | object                     | optional  | `BaseDomainException.details`.                        | Rare structured context (e.g., conflict field name, list of conflicting IDs). Shaped per-code; documented in §5.4.                          |

### 5.4 Reserved `extensions.details` shapes

Because `extensions.details` is the only "loose" extension, we will document the conventional shapes per major use case:

| Use case                | Shape                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| Validation failure      | omitted (use `validationErrors` instead; older clients may also see `validationErrors` carry `message[]` rather than `field/message[]` — see §12) |
| Conflict with field     | `{ conflictingField: string, conflictingValue?: unknown }`        |
| Resource not found      | omitted (`detail` is sufficient)                                  |
| Forbidden (auth/perm)   | omitted (`detail` is sufficient)                                  |
| Rate-limited            | `{ retryAfterSeconds: number, scope?: string }`                   |
| Server-side invariant   | **never set** (we never leak server-side state in 5xx)             |

### 5.5 Content type

`Content-Type: application/problem+json` on every error response. NestJS does not set this automatically; `GlobalExceptionFilter` sets it explicitly.

### 5.6 TypeScript type

The existing `ProblemDetail` type in `src/common/types/problem-detail.type.ts` is reused as-is. The only contract change is the addition of well-known `extensions` keys, all of which are documented in §5.3. The `extensions` block is built as a plain object literal in `GlobalExceptionFilter`; no separate interface is needed in this milestone. (An interface can be introduced later if/when we want compile-time guarantees on the JSON shape consumers see — YAGNI until then.)

---

## 6. Error-code strategy

This section describes the *domain side* of error codes — how a class declares its code, how new codes are added. The *transport side* (HTTP status, title, type-URI) lives in §6.4.

### 6.1 Naming convention

```
<MODULE>_<ENTITY>_<SEMANTIC>
```

| Segment  | Rules                                                                                                                                                                | Example                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| MODULE   | One of: `AUTH`, `USER`, `QUIZ`, `CATEGORY`, `TAG`, `ATTEMPT`, `BOOKMARK`, `REVIEW`, `TOURNAMENT`, `INSTANCE`, `RANKING`, `ACHIEVEMENT`, `NOTIFICATION`, `DISCUSSION`, `SOCIAL`, `GLOBAL`. | `AUTH`                  |
| ENTITY   | Singular noun or sub-domain. Omit if no specific entity.                                                                                                              | `EMAIL`, `QUIZ`        |
| SEMANTIC | One of: `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `INVALID`, `EXPIRED`, `CLOSED`, `LOCKED`, `RATE_LIMITED`, `ALREADY_*`, `NOT_ACTIVE`, `NOT_PUBLISHED`, etc.          | `EXPIRED`, `CONFLICT`  |

Codes are intentionally aligned with HTTP semantics in this milestone (`NOT_FOUND` → 404, `CONFLICT` → 409, …) because RFC 7807 is the only transport today; another transport (gRPC, GraphQL) would map them differently (§6.4) without changing the names.

Final examples: `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_TOKEN_REUSED`, `QUIZ_NOT_FOUND`, `QUIZ_SLUG_CONFLICT`, `QUIZ_NOT_PUBLISHED`, `CATEGORY_ALREADY_ACTIVE`, `CATEGORY_SLUG_CONFLICT`, `ATTEMPT_ALREADY_SUBMITTED`, `ATTEMPT_NOT_ACTIVE`, `DISCUSSION_THREAD_CLOSED`, `DISCUSSION_DUPLICATE_REPORT`, `RANKING_INVALID_XP_EVENT`, `RANKING_CALCULATION_ERROR`, `GLOBAL_VALIDATION_FAILED`, `GLOBAL_RATE_LIMITED`, `GLOBAL_INTERNAL_ERROR`.

**No central registry.** Codes are declared as `readonly` properties on the concrete exception class. A search for `'QUIZ_NOT_FOUND'` finds the throwing site, the test, and (after the OpenAPI generator runs) the Swagger example. A registry would just be a second place to keep the same string in sync.

**Renames are disallowed.** If a code must change, add a new one and mark the old one `@deprecated` in the class body; the global filter will surface the deprecated code unchanged until removed.

### 6.2 Concrete exception shape

Each concrete exception class declares one field: `code`. Nothing else. No HTTP, no title, no type-URI.

```ts
// src/common/errors/base-domain.exception.ts (new)
export abstract class BaseDomainException extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// src/modules/quiz/domain/errors/quiz-domain.errors.ts (refactored)
import { BaseDomainException } from '@/common/errors/base-domain.exception';

export class QuizNotFoundError extends BaseDomainException {
  readonly code = 'QUIZ_NOT_FOUND';
  constructor(quizId: string) {
    super(`Quiz with id '${quizId}' was not found.`);
  }
}
```

`BaseDomainException` declares `code` as `abstract readonly` so TypeScript enforces that every subclass fills it in. A concrete exception cannot ship without a `code` (compile error).

### 6.3 Codes for non-domain (native) `HttpException` paths

For non-domain errors (`@nestjs/common` `HttpException` subclasses thrown by guards, pipes, and interceptors), the global filter synthesizes a `code` from status. This is the only other code producer in the codebase:

| Status | Code                       |
| ------ | -------------------------- |
| 400    | `GLOBAL_BAD_REQUEST` (or `GLOBAL_VALIDATION_FAILED` when the response carries `ValidationPipe`-shaped field errors) |
| 401    | `GLOBAL_UNAUTHENTICATED`   |
| 403    | `GLOBAL_FORBIDDEN`         |
| 404    | `GLOBAL_NOT_FOUND`         |
| 409    | `GLOBAL_CONFLICT`          |
| 422    | `GLOBAL_UNPROCESSABLE`     |
| 429    | `GLOBAL_RATE_LIMITED`      |
| 5xx    | `GLOBAL_INTERNAL_ERROR`    |

This table is a `const` map inside `GlobalExceptionFilter` itself — not a separate registry, not a generated artifact. These codes are produced only by the filter and consumed only by it; the table lives with its sole consumer.

### 6.4 Transport-layer mapping (`code → { status, title, typeUri }`)

The HTTP-specific information that turns a domain `code` into a response **lives in the transport layer**, not on the domain class. `GlobalExceptionFilter` owns a single frozen record:

```ts
// src/common/filters/problem-code-mapping.ts (new)
import { HttpStatus } from '@nestjs/common';

interface ProblemCodeInfo {
  readonly status: HttpStatus;
  readonly title: string;
  readonly typeUri: string;
}

export const ProblemCodeMapping: Readonly<Record<string, ProblemCodeInfo>> = {
  QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'Quiz not found',
    typeUri: 'https://api.quiz.local/problems/quiz-not-found',
  },
  QUIZ_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'You do not have permission to manage this quiz',
    typeUri: 'https://api.quiz.local/problems/quiz-forbidden',
  },
  QUIZ_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'A quiz with this slug already exists',
    typeUri: 'https://api.quiz.local/problems/quiz-slug-conflict',
  },
  // ... one entry per code (~95 entries total).
};

const DEFAULT_TYPE_URIS: Record<number, string> = {
  400: 'https://api.quiz.local/problems/bad-request',
  401: 'https://api.quiz.local/problems/unauthorized',
  // ... (this is the existing RFC7807_TYPE_URIS map, reused as the fallback).
};

export function resolveProblemInfo(code: string): ProblemCodeInfo {
  const entry = ProblemCodeMapping[code];
  if (entry) return entry;
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'Internal server error',
    typeUri: DEFAULT_TYPE_URIS[HttpStatus.INTERNAL_SERVER_ERROR],
  };
}
```

`GlobalExceptionFilter` calls `resolveProblemInfo(exception.code)` and stamps the result onto `type`, `title`, `status`.

**Why a single transport-side table, not per-module tables.** The map is bounded (~95 entries, matching the count of concrete exception classes), referenced exactly once by `GlobalExceptionFilter`, and conceptually read-only. Splitting it per-module would force cross-module lookups (a domain class in module A might reference a code defined in module B in some scenarios), and a `Record<string, ProblemCodeInfo>` is small enough that grep handles it.

**Why not put the same data on the class.** See §4.4. Domain stays domain; transport stays transport.

**Failure mode: unknown code.** If a concrete exception's `code` doesn't appear in `ProblemCodeMapping`, the resolver falls back to a 500 with `{ status: 500, title: 'Internal server error', typeUri: DEFAULT_TYPE_URIS[500] }`. This is a **deliberate loud failure** — the global filter logs `error: 'unknown_error_code'` with the unmapped code so the gap is observable. Phase 1's test suite covers this: every concrete class's `code` must have a mapping entry.

---

## 7. Exception hierarchy

### 7.1 The hierarchy

```
Error (Node)
 └── BaseDomainException          (abstract class; src/common/errors/base-domain.exception.ts)
        ├── QuizNotFoundError
        ├── QuizForbiddenError
        ├── QuizSlugConflictError
        ├── QuizQuestionPositionConflictError
        ├── QuizAnswerOptionPositionConflictError
        ├── QuizMultipleCorrectOptionsError
        ├── QuizInsufficientQuestionsError
        ├── QuizVersionImmutableError
        ├── QuizConflictError
        ├── QuizValidationError
        ├── CategoryNotFoundError
        ├── CategoryAnalyticsNotFoundError
        ├── CategorySlugConflictError
        ├── CategoryAlreadyActiveError
        ├── CategoryRestoreInvariantError
        ├── TagNotFoundError
        ├── TagAnalyticsNotFoundError
        ├── TagSlugConflictError
        ├── TagAlreadyActiveError
        ├── TagRestoreInvariantError
        ├── AttemptNotFoundError
        ├── AttemptForbiddenError
        ├── AttemptAlreadyStartedError
        ├── AttemptNotActiveError
        ├── AttemptQuestionAlreadyAnsweredError
        ├── QuizNotPublishedError
        ├── AttemptQuestionInvalidError
        ├── AttemptNotCompletedError
        ├── AttemptValidationError
        ├── BookmarkNotFoundError
        ├── BookmarkCollectionNotFoundError
        ├── CollectionNotFoundError
        ├── CollectionForbiddenError
        ├── CollectionConflictError
        ├── BookmarkConflictError
        ├── BookmarkValidationError
        ├── TournamentNotFoundError
        ├── TournamentRoundNotFoundError
        ├── TournamentNotRegisteredError
        ├── TournamentForbiddenError
        ├── TournamentConflictError
        ├── TournamentAlreadyRegisteredError
        ├── TournamentAttemptAlreadyExistsError
        ├── TournamentParticipantStateError
        ├── TournamentValidationError
        ├── TournamentRegistrationClosedError
        ├── TournamentFullError
        ├── TournamentRoundNotOpenError
        ├── TournamentUnregisterClosedError
        ├── TournamentWithdrawClosedError
        ├── ReviewNotFoundError
        ├── ReviewForbiddenError
        ├── ReviewConflictError
        ├── ReviewValidationError
        ├── ReviewAttemptRequiredError
        ├── ReviewAlreadyReportedError
        ├── InstanceNotFoundError
        ├── InstanceNotHostError
        ├── InstanceNotOpenError
        ├── InstanceFullError
        ├── InstanceAlreadyStartedError
        ├── InstanceAlreadyClosedError
        ├── PlayerAlreadyJoinedError
        ├── UserNotFoundError
        ├── UserRankingNotFoundError
        ├── UserAnalyticsNotFoundError
        ├── UserProfilePrivateError
        ├── BadgeNotFoundError
        ├── AchievementUserNotFoundError
        ├── UserBadgeOwnershipNotFoundError
        ├── Auth: InvalidCredentialsError, InvalidRefreshTokenError, TokenReuseDetectedError,
        ├──       SessionContextMismatchError, UserNotFoundError, RateLimitExceededError,
        ├──       SessionNotFoundError, InvalidTokenError, InvalidPasswordError,
        ├──       DeletionFailedError, PasswordReuseError, InvalidOAuthTokenError,
        ├──       OAuthAccountLinkingRequiredError
        ├── Social: FriendRequestNotFoundError, FriendRequestForbiddenError, FriendListForbiddenError,
        ├──        SelfFriendRequestError, AlreadyFriendsError, BlockedUserError,
        ├──        UserBlockedError, PendingRequestExistsError
        ├── Discussion: ThreadNotFoundError, CommentNotFoundError, ThreadForbiddenError,
        ├──            CommentForbiddenError, ThreadClosedError, ThreadNotActiveError,
        ├──            CommentThreadMismatchError, SelfVoteError, SelfReportError,
        ├──            DuplicateReportError, ModeratorRequiredError
        ├── Ranking: InvalidXpEventError, RankCalculationError, PeriodResetError
        └── (any future concrete subclass falls directly under BaseDomainException)
```

**Why no intermediate abstract layers.** Status defaults on hypothetical `NotFoundException` / `ConflictException` / etc. would be overridden by 90% of concrete subclasses (the existing filter code already overrides status by specific exception class; see `RankingDomainExceptionFilter`'s `getCodeFromStatus`, `TournamentDomainExceptionFilter`'s 13-entry map). With the new design, the only field on the base class is `code`, so the intermediate-class problem dissolves further: even if we wanted to declare an abstract `NotFoundException` to enforce "`code` starts with `*_NOT_FOUND`", that constraint would belong in code review, not in a class hierarchy. There is no consumer in this codebase today that does `instanceof NotFoundException`-style dispatch; if one appears later, the intermediate can be added cheaply at that point.

### 7.2 What the hierarchy does *not* change

- No behavior change. A `QuizNotFoundError` is still thrown in the same places with the same message; it just extends a different base class and carries one extra readonly field.
- No change to NestJS exception classes. `HttpException`, `BadRequestException`, `UnauthorizedException`, etc. continue to be the throwing mechanism for non-domain errors (guards, pipes). The global filter knows how to render them.

---

## 8. Migration strategy

The migration runs as **6 phases, ~3 calendar weeks assuming one developer**, with two parallelizable tracks (Phase 0 infra + Phase 3 infra). Phases after Phase 0 are independently shippable PRs.

### 8.1 Phase 0 — Foundation (0.5 day, zero-risk) ✅ **SHIPPED**

**Pure additions. Nothing changes for existing callers.**

| Objective | Action | Status |
| --- | --- | --- |
| Write the plan                | Publish this document under `docs/architecture/RFC7807_ERROR_STANDARDIZATION_PLAN.md`. | Done (v3.0). |
| Add the base exception        | New `src/common/errors/base-domain.exception.ts` (`abstract readonly code`, no HTTP fields). | Done. |
| Add the e2e backstop          | New `test/rfc7807.e2e-spec.ts` booting an isolated NestJS app with `GlobalExceptionFilter` and asserting the canonical ProblemDetail wire shape across 5 code paths (`BaseDomainException`, native `NotFoundException`, native `BadRequestException` with a string-array message, plain `Error`, non-`Error` throwable). | Done — 6 tests passing. |

**Affected modules:** none.

**Estimated effort:** half a day.

**Risks:** none. All additive.

**Rollback strategy:** trivial — every file added can be deleted without affecting existing behavior.

**Completion criteria:**
- ✅ Files exist on `main`. `tsc --noEmit` passes. All existing tests pass.
- ✅ `test/rfc7807.e2e-spec.ts` runs against the current code and asserts RFC 7807 only for `auth/quiz/attempt/user/global` (the modules already on it). Other modules are explicitly marked "legacy" and skipped in the test for now.

**Phase 0 deliberately pins the *current* global-filter behavior.** A concrete `BaseDomainException` falls through the filter's `instanceof Error` branch and surfaces as a 500 with `title: 'InternalServerError'`. The `code → { status, title, typeUri }` resolution lands in Phase 1 alongside the `ProblemCodeMapping` table.

### 8.2 Phase 1 — Pilot (5 modules, low risk, 1-2 days)

Convert the four modules that already emit RFC 7807 (auth, quiz, attempt, user) **plus** add `code` resolution to the global filter. The four filters stay in place but become thin pass-throughs — *or* are deleted entirely once the global filter handles the resolution. The pilot ships one module end-to-end (auth was the first), lets each subsequent module copy the pattern, and removes the per-module filter as the global filter proves equivalent.

**Status (rev4.2):** **category, tag, tournament — SHIPPED.** Three Phase-2 modules migrated end-to-end. Tournament is the largest Phase-2 module by class count (15 exceptions → 4 status codes: 400/403/404/409); it is also the first module with an existing `*DomainErrorDto` Swagger DTO to delete. The 5 remaining Phase-2 modules (review, bookmark, instance, social, achievement) follow the same shape but with no `*DomainErrorDto` to delete (verified for category/tag/tournament — the only such DTO in the codebase was tournament's).

| Objective | Action |
| --- | --- |
| Replace `extends Error` with `extends BaseDomainException` in auth/quiz/attempt/user | One PR per module; deterministic order. |
| Add a `code` field to each concrete exception | Use the convention from §6.1 (`readonly code = 'QUIZ_NOT_FOUND'` on the class). |
| Add the corresponding `{ status, title, typeUri }` entries to `ProblemCodeMapping` (§6.4) | One lookup entry per code; co-committed with the class so the unknown-code test (§10) stays green. |
| Add `extensions.code` to the existing filters | Because each filter still runs, the field is populated before delegating to the global filter (via `next.handle()` re-throw) OR the filter just builds the problem-detail itself with the new field. |
| Set `extensions.timestamp` and `extensions.requestId` consistently | Already partially there in 3 of 4 filters; harmonize. |

**Affected modules:** auth, quiz, attempt, user, global.

**Estimated effort:** 1-2 days (~4 hours per module + 4 hours for global filter update).

**Risks:** low. The wire shape for these modules gains a `code` field but is otherwise unchanged. Clients ignoring unknown fields are unaffected.

**Rollback strategy:** revert the PR. The shape change is strictly additive (`extensions.code`); remove the field, restore the previous filter, done.

**Completion criteria:**
- For these 4 modules, every error response includes `extensions.code`.
- The `ProblemDetailDto` Swagger schema is regenerated and references the new extensions.
- The e2e backstop from Phase 0 passes for these 4 modules.

### 8.3 Phase 2 — Bulk legacy conversion (8 modules, medium risk, 5-8 days)

Convert the 8 modules producing the legacy `{ statusCode, message, error }` shape: **category, tag, tournament, review, bookmark, instance (HTTP), social, achievement**.

| Objective | Action |
| --- | --- |
| Replace each module's `*DomainError` chain with `BaseDomainException` subclasses. | One PR per module. |
| Add `code` to each exception and the matching `ProblemCodeMapping` entry. | Two co-committed edits: class declares `readonly code = '...'`; mapping entry declares `{ status, title, typeUri }`. |
| Delete the per-module filter class. | The controller's `@UseFilters(...)` decorator is removed. The global filter is the sole handler. |
| Delete the per-module `*DomainErrorDto` Swagger class. | Replace per-endpoint `@ApiNotFoundResponse({ type: SomeDomainErrorDto })` with `@ApiNotFoundResponse({ type: ProblemDetailDto })` plus `@ApiExtraModels(ProblemDetailDto)` at the controller level. |
| Update per-controller oneOf references. | Where controllers currently use `schema.oneOf([ProblemDetailDto, TournamentDomainErrorDto])`, simplify to `ProblemDetailDto` alone. |

**Affected modules:** category, tag, tournament, review, bookmark, instance, social, achievement.

**Estimated effort:** 5-8 days. The work is mechanical once Phase 0 + Phase 1 ship; expect ~1 day per module.

**Risks:** medium. The body shape changes (legacy `{ statusCode, message, error }` → RFC 7807). Clients reading `err.response.data.statusCode` instead of `err.status` will break.

**Rollback strategy:**
- **Per-module PR.** Each module is independently revertable.
- **Compatibility shim.** During Phase 2 a `LEGACY_COMPAT=1` env flag (introduced in Phase 1 PR for global filter) makes `GlobalExceptionFilter` also write the legacy fields (`statusCode`, `message`, `error`) into a backward-compatible location (see §11). Clients can adopt the new shape at their own pace.

**Completion criteria:**
- All 8 modules' controllers have no `@UseFilters`.
- All 8 modules' OpenAPI specs reference only `ProblemDetailDto` for error responses.
- E2E backstop passes for these 8 modules in **both** modes (RFC 7807 + legacy shim).
- No `*DomainErrorDto` files remain in `src/modules/*/dto/`.

### 8.4 Phase 3 — Two problem children (2 modules, high risk, 2-3 days)

#### 8.4.1 Discussion

- Convert `DiscussionError` to `BaseDomainException`. All 13 concrete subclasses get a `code`; the matching `ProblemCodeMapping` entries replace the `STATUS_MAP` and `DISCUSSION_PROBLEM_URIS` lookup tables.
- Add `extensions.requestId` and `extensions.timestamp` to the response body.

**Estimated effort:** 1 day.

**Risks:** medium. Two of the 13 errors map to non-obvious statuses (`CommentThreadMismatchError` → 400 — `BAD_REQUEST`; `ModeratorRequiredError` → 403). Capture these in the migration test.

#### 8.4.2 Ranking

This is the highest-risk phase because **`RankingDomainExceptionFilter` is a `@Catch()` catch-all that shadows `GlobalExceptionFilter`**:

- Delete the filter. The global filter will now handle:
  - `RankingDomainError` subclasses (per §5).
  - Native `HttpException` (per current global filter behavior).
  - Uncaught errors (per current global filter behavior — already the global filter's job).
- The patterns to reconcile:
  - **`RankingDomainError` already carries a constructor-injected `code`.** Under the new design that constructor arg becomes a class-level field: `readonly code = 'RANKING_INVALID_XP_EVENT'` etc. (the 4 existing codes translate directly). Constructor signatures stay the same.
  - **Ranking controller currently throws `new UnprocessableEntityException(...)` for some 422s.** These now produce `extensions.code = 'GLOBAL_UNPROCESSABLE'` instead of `RANKING_*`. Per §6.3, this is acceptable, but if a code is needed, wrap in a `RankingUnprocessableError extends BaseDomainException`.
- Delete `RankingDomainErrorDto` and update ranking controllers' `@Api*Response({ type: ... })` to `ProblemDetailDto`.

**Estimated effort:** 1 day.

**Risks:** high. The shadowing meant ranking's 500s *don't currently reach* `GlobalExceptionFilter`'s logging path. Removing the filter *also* moves ranking into the standard logging path, which is the goal but is observability-changing. Phase 3.1 (below) handles this.

**Rollback strategy:** revert per-module PR. Reintroduce the catch-all filter (deleted code is in git history).

**Completion criteria for Phase 3:**
- Both modules emit RFC 7807 on every error.
- Phase 0 e2e test passes for these 2 modules.
- For ranking: an artificial `throw new Error('boom')` inside a ranking controller produces a 500 with the standard shape, **and** the existing `requestLogger.error({ event: 'unhandled_exception', ... })` log line still appears.

### 8.5 Phase 4 — Native HttpException paths (1 day, low risk)

Some clients may rely on the `code` field even for non-domain errors (validation, missing route, JWT failure). Phase 4 adds `code` synthesis to the global filter's `HttpException` branch per §6.3.

**Affected modules:** none (filter-only change).

**Estimated effort:** 0.5 days.

**Risks:** none. Strictly additive.

**Completion criteria:**
- A 401 from `JwtGuard` now includes `extensions.code = 'GLOBAL_UNAUTHENTICATED'`.
- A 404 from a missing route includes `extensions.code = 'GLOBAL_NOT_FOUND'`.

### 8.6 Phase 5 — Cleanup (1 day, low risk)

| Objective | Action |
| --- | --- |
| Delete legacy `*DomainErrorDto` Swagger classes (already done in Phase 2/3).   | Confirm with `grep -r "DomainErrorDto" src` returns 0. |
| Remove the `LEGACY_COMPAT` flag and shim code.                                  | After a release window. Final commit removes the shim. |
| Regenerate the OpenAPI spec and verify no duplicate error shapes remain.         | `pnpm generate:openapi`; `git diff docs/generated/openapi.json` should show only the addition of `extensions.code`/`extensions.timestamp` fields on error responses. |

**Affected modules:** none (deletions only).

**Completion criteria:**
- `grep -r "@UseFilters" src/modules` returns 0 results.
- `grep -r "extends Error" src/modules/*/domain/errors` returns 0 results (all replaced).
- `grep -r "DomainErrorDto" src/modules` returns 0 results.
- No `LEGACY_COMPAT` references in source.
- CI green.

**Why no dedicated lint rule.** A `pnpm lint:rfc7807` script that enforces "no `@UseFilters` outside tests" and "no `extends Error` in `domain/errors`" was proposed in earlier versions of this plan and removed. The codebase already has `tsc` (every concrete exception must extend `BaseDomainException`; missing `code` is a compile error), per-module unit tests asserting mapping completeness (§10), and code review. Adding a custom lint script is two new files (the script and a CI line) that future maintainers must read alongside existing lint rules; the migration's verification grep commands can simply be inlined into the per-module PR's checklist and then remembered/automated by code review thereafter.

---

## 9. Module-by-module migration order

| Order | Module      | Filter status              | Filter shape            | Surface size | Dependencies on other modules' errors?            | Comments                                                                   |
| ----- | ----------- | -------------------------- | ----------------------- | ------------ | -------------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | auth        | already RFC 7807 (A)       | `{type,title,status,detail,instance,extensions.requestId}` | 13 errors    | none (uses `UserNotFoundError` from user module — see note) | Use `UserNotFoundError` from user module instead of `AuthUserNotFoundError` to remove a duplicate. Coordinate with §9 item 4. |
| 2     | quiz        | already RFC 7807 (A)       | same as auth            | 11 errors    | none                                               | Trivial.                                                                   |
| 3     | attempt     | already RFC 7807 (A)       | same as auth            | ≥10 errors   | none                                               | Trivial.                                                                   |
| 4     | user        | already RFC 7807 (A)       | same as auth            | ≥5 errors    | `UserNotFoundError` is consumed by auth — coordinate | Ensure the user module's `UserNotFoundError` and auth's duplicate merge before §8 Phase 2 ship. |
| 5     | category    | legacy (B)                 | `{statusCode,message,error}` | 6 errors | none                                               | Mechanical.                                                                |
| 6     | tag         | legacy (B)                 | same                    | ~6 errors    | none                                               | Mechanical.                                                                |
| 7     | bookmark    | legacy (B)                 | same                    | ~6 errors    | none                                               | Trivial.                                                                   |
| 8     | instance (HTTP) | legacy (B)             | same                    | ~7 errors    | `UserProfilePrivateError` consumed by achievement  | Coordinate with §9 item 11. The `UserProfilePrivateError` lives in user module. |
| 9     | review      | legacy (B)                 | same                    | ~6 errors    | none                                               | `ReviewAdminResponseDto` admin error referencing is already extracted; finalize. |
| 10    | tournament  | legacy (B)                 | same                    | ~13 errors   | none                                               | Largest single legacy module; may split into two PRs (errors + filter deletion). |
| 11    | achievement | legacy (B)                 | same                    | ~3 errors    | `UserProfilePrivateError` (instance + achievement both depend) | Two consumers of `UserProfilePrivateError`; centralize the exception to the user module. |
| 12    | social      | legacy (B)                 | same                    | ~9 errors    | none                                               | Has `FriendListForbiddenError` — separate from `FriendRequestForbiddenError`. |
| 13    | discussion  | hybrid (D)                 | RFC 7807 w/o extensions | 13 errors    | `UserNotFoundError` from user module               | Needs biggest surface area change (status lookup tables).                 |
| 14    | ranking     | custom catch-all (C)       | `{statusCode,message,code,timestamp}` | 4 errors | none | Highest-risk module. Run as the last step to validate the pattern on simpler modules first (§9.2 explains the order). |

### 9.1 Dependency considerations

- **`UserNotFoundError`, `UserProfilePrivateError`** are imported across modules (auth → user; instance → user; achievement → user). The migration promotes them to canonical user-module classes. During Phase 2 (user module PR), re-import in auth/instance/achievement to use the user-module copy.
- **`QuizNotFoundError`** is duplicated in `quiz` and `discussion`. Promote `discussion`'s version to import from `quiz`. (Quiz's error code is `QUIZ_NOT_FOUND`; discussion's error should use the same code.)
- **`AttemptAlreadyStartedError`** and `AttemptQuestionInvalidError` are referenced by quiz gates via try/catch in some places — confirm no cycle.
- **`RankingDomainError`** has the `code` field already; the migration is purely a class-shape replacement. No downstream consumers depend on the field name.

### 9.2 Why this ordering

1. **P1 (already-RFC 7807) first** to harden the convention on the smallest blast radius. They prove the `BaseDomainException` + per-class `code` field works without changing any wire shape.
2. **P2 (legacy) next, smallest first.** Category/tag/bookmark/instance have <7 errors each and small Swagger schemas. We ship the conversion pattern on small modules first.
3. **Tournament isolated** because it has both the most error classes and the most complex filter; doing it after the simpler modules ensures the team has worked through the migration several times before tackling it.
4. **Discussion + ranking last** because they have structural deviations (discussion's name-based lookup, ranking's catch-all). Phase 14 ships after we've validated the pattern works on the simpler 12 modules.

---

## 10. Testing strategy

| Test type          | Where                                              | What it asserts                                                                                                        |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Unit**           | `src/common/filters/global-exception.filter.spec.ts` (new) | RFC 7807 output for: `BaseDomainException` (mapping-lookup path), native `HttpException` (synthesized `code` path), plain `Error`, non-error throwables. |
| **Unit**           | `src/common/filters/problem-code-mapping.spec.ts` (new) | `ProblemCodeMapping` keys are unique; all ~95 keys resolve; a *known* code resolves to the correct `{ status, title, typeUri }`. |
| **Unit**           | `src/common/filters/unknown-code.spec.ts` (new) | A `BaseDomainException` whose `code` is **not** in `ProblemCodeMapping` triggers the loud-failure branch (500 + an `error: 'unknown_error_code'` log line). |
| **Unit**           | per-module `<m>-domain.errors.spec.ts` (added per module) | Each concrete class declares a `code`; each `code` has a corresponding entry in `ProblemCodeMapping`. One assertion per exception. |
| **Contract**       | `test/e2e/rfc7807.spec.ts` (Phase 0+)              | One test per module: trigger an error endpoint, assert Content-Type is `application/problem+json`, body matches the canonical schema, `extensions.code` is present, `extensions.requestId` matches the response header. During migration this file is annotated per-module with `legacy` vs `migrated` so it tracks progress. |
| **Contract**       | `test/e2e/rfc7807-shim.spec.ts` (Phase 2 only)     | During the transition window, assert legacy fields (`statusCode`, `error`) are still present and correct when `LEGACY_COMPAT=1`. |
| **Integration**    | per-module controller test (existing + amended)    | Each error path returns the expected status code **and** the RFC 7807 body. Add one assertion per error path.          |
| **Regression**     | existing snapshot tests for `auth`, `quiz`, etc.   | Regenerated after each module PR; diff must show only additive changes (new `extensions.code`/`timestamp`).              |
| **Visual**         | `docs/generated/openapi.json` diff review          | PR review ensures only additive `extensions` field appears in the OpenAPI spec.                                         |

### 10.1 Why no error-code coverage matrix

Earlier versions of this plan proposed a generator-driven e2e test ("iterate every code in the mapping; for each, hit the corresponding endpoint and assert `extensions.code`"). The simpler version of that test lives in the unit tier above (`problem-code-mapping.spec.ts` plus `<m>-domain.errors.spec.ts`): it asserts (1) every entry in the mapping is unique, (2) every `code` declared on a concrete class has a mapping entry. Maintaining a hand-curated list of (code → endpoint, fixture) triples was rejected; it would grow linearly with every new error and be paid by whoever writes the test. Per-module integration tests already exercise error paths once during migration; subsequent bug regressions are caught by the existing controller test suite.

### 10.2 Coverage targets

- **Functional:** every concrete exception class is exercised by at least one integration test that throws it and asserts the wire shape. Per-module PRs verify this as part of their review checklist.
- **Mapping completeness:** every `code` declared on a concrete class has an entry in `ProblemCodeMapping` (unit test) AND a corresponding per-module e2e check (or per-PR reviewer confirmation during migration).
- **Unknown code loud-failure:** the global filter emits a 500 with `error: 'unknown_error_code'` log line when a code is missing from the map. This is the safety net for typos.

---

## 11. Rollback strategy

The migration rolls back **per module, per PR**. Mixed old/new modes coexist because:

1. **Each module's filter deletion ships in its own PR.** Reverting that PR restores the legacy filter without affecting other modules.
2. **`LEGACY_COMPAT` env flag.** Phase 1 introduces a process-wide opt-in flag. When set:
   - The global filter writes the legacy `{ statusCode, message, error }` *fields at the top level* of the ProblemDetail body.
   - This means clients that read `err.response.data.statusCode` continue to work for the *legacy modules* (during their migration window) without breaking.
   - Clients that want to be strict can read `status` and `extensions.code`; clients that are still on legacy can keep reading `statusCode`.
   - The flag is *temporary*; it is removed in Phase 5. There is no intent to support it long-term — it exists only to give clients a deprecation runway.

### 11.1 If a per-module PR fails in production

1. **Revert the PR.** The 8 legacy modules + the 2 RFC 7807 children are independently revertable.
2. **Keep the global filter updated.** Phases 0, 1, and 5 are the only ones that touch the global filter. A module-level revert must NOT include a global filter revert — the `extensions.code` field is safe to add because it's strictly additive.
3. **Run the e2e backstop.** `test/e2e/rfc7807.spec.ts` runs and asserts that whatever modules are still on the legacy shape continue to respond correctly with or without the shim.

### 11.2 Mixed-mode coexistence

Concrete example during Phase 2 module 5 (category PR merged) while modules 6-14 still on legacy:

| Error source         | With `LEGACY_COMPAT=1`                                              | With `LEGACY_COMPAT=0` (default)      |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| category endpoint    | RFC 7807 + legacy top-level fields                                   | RFC 7807 only                          |
| tag endpoint         | Legacy `{ statusCode, message, error }` body                         | Legacy body (the legacy filter still runs) |
| ranking endpoint     | Custom `{ statusCode, message, code, timestamp }` body (untouched)   | Custom body (untouched)               |

This is **intentional** during the migration. Clients that opt into the new shape (most will) see one shape; clients that haven't updated yet still see their old shape for modules they consume.

### 11.3 Disable-the-flag escape hatch

If the `LEGACY_COMPAT` flag is causing client confusion (e.g., both `status` and `statusCode` are present and a client errors on conflicting fields), flip it to `0` application-wide. This makes the wire shape uniformly RFC 7807 for **all modules**, regardless of whether their per-module filter was deleted. The per-module filter is still needed for that window but doesn't write to the response — it just delegates to the global filter without modification. This is a non-revert state, but a safe one.

---

## 12. Risks

| #  | Risk                                                                                                                                                                  | Likelihood | Impact   | Mitigation                                                                                                                                                                                                                                                                                       |
| -- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 | **Frontend assumes `err.response.data.statusCode`**                                                                                                                     | High       | Medium   | Phase 2 ships with `LEGACY_COMPAT=1` so `statusCode` is still top-level. Coordinate with frontend in Phase 1 PR description. Document `status` vs `statusCode` in the migration PR.                                                                                  |
| R2 | **Mobile SDK consumers assume flat `{ error: string }`**                                                                                                                | Medium     | Medium   | Same shim. The SDK migration is its own PR; clients are notified via the API changelog before the shim flag is removed in Phase 5.                                                                                                                                                              |
| R3 | **Swagger examples still document legacy shapes**                                                                                                                       | Medium     | Low      | Per-module examples are regenerated in Phase 2 / 3 PRs. The OpenAPI generator emits `examples` referencing only the new shape.                                                                                                                                                                  |
| R4 | **Custom filters exist outside the 14 audited** (e.g., somewhere else in the codebase)                                                                                 | Low        | Medium   | Audit pass: `grep -r "@Catch\\|ExceptionFilter" src/` is run in Phase 0 and gated as a follow-up per module PR.                                                                                                                                                                                   |
| R5 | **Hidden exception handlers in services (try/catch that reserializes)**                                                                                                | Medium     | Low      | Code review during per-module PRs catches `catch (e) { ...throw new ...(e.message) }` patterns in `application/`. The base exception class accepts the original cause in `cause` so logs preserve them.                                                                                      |
| R6 | **`ValidationPipe` returns string array, not field/message structure**                                                                                                 | High       | Low      | Phase 4 PR writes the adapter that builds the `validationErrors` array from the current `HttpException.getResponse().message` string array.                                                                                                                                                       |
| R7 | **Throwing `RankingDomainExceptionFilter` types no longer shadows unhandled errors**                                                                                    | High       | Low      | Phase 3 explicitly proves the unhandled-error path still produces the expected logging via a test `throw new Error()` inside a ranking controller. The test compares the new log line against the old.                                                                                          |
| R8 | **Discussion's `exception.name`-based mapping has business logic encoded in `STATUS_MAP`**                                                                              | Medium     | Low      | Audit pass identifies the 13 mappings in Phase 3. Migrate each with a unit test that asserts the new `ProblemCodeMapping[code].status` matches the old `STATUS_MAP[name]` entry.                                                                                                                  |
| R9 | **A new error type is added without `code`, or its `code` is missing from `ProblemCodeMapping`**                                                                       | Medium     | Medium   | (1) `BaseDomainException` declares `code` as `abstract readonly`; missing `code` is a TypeScript compile error. (2) Per-module `<m>-domain.errors.spec.ts` asserts every declared `code` has a corresponding `ProblemCodeMapping` entry. (3) The unknown-code loud-failure test covers typos at runtime. |
| R10 | **Two classes share the same code by accident** (e.g., both modules declare `QUIZ_NOT_FOUND`)                                                                            | Low        | Low      | Code review. The same string in two places is cheap to spot. (Removing the registry eliminates the runtime uniqueness test proposed in earlier versions; the trade-off is accepted.)                                                                                                          |
| R11 | **The `@UseFilters` on a controller is load-bearing for application logic** (catch-then-rewrite)                                                                     | Low        | Medium   | Audited in Phase 0; no such patterns exist in the live tree. If any are found during Phase 2, they are refactored to throw domain exceptions instead.                                                                                                                                            |
| R12 | **WS filter can't use HTTP status codes**                                                                                                                               | High       | Low      | WS errors are out of scope. WS filter keeps emitting frames but reads `instanceof BaseDomainException` to surface the `code` field.                                                                                                                                                              |
| R13 | **`Content-Type: application/problem+json`** is rejected by some proxies                                                                                                | Low        | Medium   | Confirmed working in NestJS by sending `response.type('application/problem+json')`. The reverse proxy config in `scripts/` already forwards non-`application/json` content types. If a proxy filters, document the change.                                                                     |
| R14 | **`Failed to fetch` on the frontend due to CORS rejecting `application/problem+json`**                                                                                   | Low        | Medium   | Same as R13. The CORS middleware is configured to accept any content type by default; confirm in Phase 0 audit.                                                                                                                                                                                  |
| R15 | **Per-endpoint `oneOf` Schema references duplicate the `ProblemDetailDto`**                                                                                              | Medium     | Low      | Phase 2 PR simplifies each controller's `ApiExtraModels(ProblemDetailDto)` to a single import; the per-module `*DomainErrorDto` references are removed.                                                                                                                                          |
| R16 | **Tests that pinned `expect(res.body.error).toBe('Conflict')` break**                                                                                                  | Medium     | Low      | Update the assertions. The `ProblemDetailDto` exposes `title` (`'Conflict'`) and `extensions.code` (`'QUIZ_CONFLICT'`). A codemod replaces `error`→`title` (substring) in test files as part of each module PR.                                                                              |
| R17 | **OpenAPI client codegen produces `Partial<{code?: string}>` in generated SDKs**                                                                                        | Medium     | Medium   | Phase 0 verifies the `ProblemDetail` extensions keys are `required` in the generated OpenAPI (set `nullable: false`). One representative client (the frontend's openapi-typescript output) is regenerated early in Phase 1 and checked by hand.                                                  |
| R18 | **Time skew between server and client makes `extensions.timestamp` confusing**                                                                                          | Low        | Low      | Documented in OpenAPI; field is informational, not used in logic.                                                                                                                                                                                                                               |
| R19 | **Migration stalls mid-way if `LEGACY_COMPAT=0` accidentally applied**                                                                                                 | Low        | High     | Default in every environment is `LEGACY_COMPAT=1`. The flag is removed in Phase 5 only after a release window with no client complaints.                                                                                                                                                       |
| R20 | **Per-controller `@UseFilters(SomeFilter)` discovered in a module we don't audit**                                                                                     | Low        | Medium   | Gating check `grep -r "@UseFilters" src/` is run in Phase 0. Anything returned must either be a domain filter (in scope) or a test (`*.spec.ts`).                                                                                                                                                   |

---

## 13. Success criteria

Migration is complete when **all** of the following are verifiable:

| #  | Criterion                                                                                                                                       | How verified                                                                  |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S1 | Every HTTP error response is RFC 7807 with `Content-Type: application/problem+json`.                                                             | `test/e2e/rfc7807.spec.ts` passes for every module.                          |
| S2 | No `{ statusCode, message, error }` legacy shape remains in source.                                                                              | `grep -r "statusCode," src/modules/*/transport/filters` returns 0 results.    |
| S3 | No `{ statusCode, message, code, timestamp }` ranking shape remains in source.                                                                  | `grep -r "code" src/modules/ranking/transport/filters` returns 0 results.    |
| S4 | No filter class other than `GlobalExceptionFilter` and `WsExceptionFilter` exists.                                                              | `grep -r "implements ExceptionFilter" src` returns 2 results.                |
| S5 | No `@UseFilters(...)` decorator in source outside `*.spec.ts`.                                                                                  | `grep -r "@UseFilters" src/modules src/common` returns 0 results.            |
| S6 | Every domain exception in source extends `BaseDomainException`, not `Error`.                                                                     | `grep -r "extends Error" src/modules/*/domain/errors` returns 0 results.      |
| S7 | Every domain exception's `code` field is a non-empty string that doesn't collide with another class's.        | Code review + grep.                                                                                    |
| S8 | Every domain exception's `code` is present in `ProblemCodeMapping` and resolves to a non-500 by default.    | `problem-code-mapping.spec.ts` and per-module `<m>-domain.errors.spec.ts` pass.                          |
| S9 | No `*DomainErrorDto` Swagger class remains in source.                                                          | `grep -r "DomainErrorDto" src/modules` returns 0 results.                     |
| S10 | The `LEGACY_COMPAT` env flag is removed from production and `LEGACY_COMPAT` no longer appears in `.env.example`. | `.env.example` audit + absence of `if (process.env.LEGACY_COMPAT)` in src.   |
| S11 | The OpenAPI spec contains only `ProblemDetailDto` for error responses (per module).                            | `docs/generated/openapi.json` review; no `*DomainErrorDto` `$ref` in `components.schemas` other than `ProblemDetailDto` and its alternatives. |
| S12 | All existing e2e tests pass.                                                                                    | `pnpm test:e2e` green.                                                       |
| S13 | Mobile SDK and frontend consumers have shipped and confirmed readiness to drop `err.response.data.statusCode`. | Coordinator sign-off captured in the migration log.                          |
| S14 | A new error is one PR (one new exception class) and zero filter changes.                                       | Demonstrated by the last PR added during Phase 5 (a new error in any module is a one-class change with no filter touched). |

---

## 14. Future improvements

The following are intentionally deferred. None block the migration.

| #  | Idea                                                                                                       | Why deferred                                                                  |
| -- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| F1 | **Localized messages.** RFC 7807 `title` and `detail` translated per request locale.                       | Requires a translation pipeline, locale negotiation, and review of every detail message. Adds a runtime dependency. RFC 9457 (successor to 7807) supports this natively; revisit when i18n lands. |
| F2 | **OpenAPI code generation for SDKs.** A `pnpm generate:openapi-client` that produces a TS SDK with discriminated union over `extensions.code`. | Frontend currently uses `orval` / `openapi-typescript`; SDK changes are coordinated separately. |
| F3 | **Correlation IDs propagation.** Map `requestId` into outbound HTTP calls (when the backend makes outbound calls to other services). | Out of scope for this milestone; the field already exists.                    |
| F4 | **Distributed tracing.** OpenTelemetry trace IDs in `extensions.traceId`.                                    | Requires OTel instrumentation; deferred to the tracing initiative.            |
| F5 | **Per-tenant error rate limiting.** Surface per-tenant 429s with `extensions.scope = 'tenant'`.            | Rate-limit work is a separate project.                                        |
| F6 | **WebSocket error upgrade.** `WsExceptionFilter` currently emits `{ code, message }`. Promote to RFC 7807-style payload for WS clients. | Different transport; out of scope of an HTTP migration.                       |
| F7 | **SDK-side error enums.** Generate a TS enum mirroring every `code` so client code is type-safe.             | Possible after F2.                                                            |
| F8 | **Centralized error-code registry.** If a future need arises (an external error catalog, a CLI tool, a docs-site generator) for which the "string declared in the class" pattern is insufficient, introduce `error-code-catalog.ts`. Today, no such need exists. | Speculative architecture, removed under YAGNI.                                |

---

## 15. Appendices

### Appendix A — Files added (Phase 0)

| Path                                                                | Purpose                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/architecture/RFC7807_ERROR_STANDARDIZATION_PLAN.md`           | This document.                                                     |
| `src/common/errors/base-domain.exception.ts`                        | Abstract base for all domain exceptions. Carries `code` (only). No HTTP-specific fields. |
| `src/common/filters/problem-code-mapping.ts`                        | Transport-side map: `code → { status, title, typeUri }`. Sole consumer is `GlobalExceptionFilter`. |
| `test/e2e/rfc7807.spec.ts`                                          | E2E backstop for the canonical ProblemDetail shape.               |

That's it. No code-generation scripts. No error-catalog registry. No generated markdown. No lint plugin. Adding a new error means adding one class file and zero auxiliary files.

### Appendix B — Files deleted (Phase 5)

| Path                                                                                                            | Reason                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/modules/<m>/transport/filters/<m>-domain-exception.filter.ts` (all 14 HTTP filters except `global-exception.filter.ts` and `ws-exception.filter.ts`) | Replaced by `GlobalExceptionFilter`.                                                    |
| `src/modules/<m>/dto/error/<m>-domain-error.dto.ts` (where present: tournament, ranking, instance, bookmark, review, quiz, attempt, auth, user, achievement, discussion) | Replaced by the shared `ProblemDetailDto`.                                              |
| `src/modules/<m>/dto/error/<m>-domain-error.dto.ts` referenced from per-module `swagger-decorators.ts` files  | Updated to reference `ProblemDetailDto`.                                                |

### Appendix C — Files modified (per phase)

| Path                                                              | Phase | Reason                                                                                                    |
| ----------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `src/common/filters/global-exception.filter.ts`                   | 1, 4, 5 | Add `extensions.code` resolution (lookup `code` in `ProblemCodeMapping`); add `extensions.timestamp`; emit `Content-Type: application/problem+json`. |
| `src/common/filters/problem-code-mapping.ts` (new)                | 1     | Transport-side `code → { status, title, typeUri }` table. Populated per-module as concrete classes are added. |
| `src/modules/<m>/domain/errors/<m>-domain.errors.ts`             | 1-3   | Replace `extends Error` with `extends BaseDomainException`. Add `code` field only (no `httpStatus`/`title`). |
| `src/modules/<m>/domain/errors/<m>-domain.errors.ts` (ranking only) | 3    | Remove the bespoke `code` constructor field; rely on `BaseDomainException.code`.                          |
| `src/modules/<m>/transport/controllers/*.controller.ts`           | 2, 3  | Remove `@UseFilters(...)`; replace `@Api*Response({ type: SomeDomainErrorDto })` with `ProblemDetailDto`.   |
| `src/modules/<m>/<m>.module.ts`                                  | 2, 3  | Remove filter providers.                                                                                  |
| `src/modules/discussion/transport/filters/discussion-domain-exception.filter.ts` | 3   | Replace `STATUS_MAP` and `DISCUSSION_PROBLEM_URIS` lookup tables with `ProblemCodeMapping` entries.       |

### Appendix D — Glossary

| Term                              | Definition                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BaseDomainException**           | The abstract base class for all domain exceptions (Phase 0). Carries only `code`. HTTP-specific fields (`status`, `title`, `typeUri`) are intentionally **not** on the class; they live in `ProblemCodeMapping`. |
| **Code (RFC 7807)**               | Machine-readable string identifier in `extensions.code`. Declared as a `readonly` field on each concrete exception class. No central registry.            |
| **`ProblemCodeMapping`**          | Transport-side `Record<code, { status, title, typeUri }>` consumed by `GlobalExceptionFilter`. Sole consumer is the filter; not a domain artifact.        |
| **Domain error**                  | An exception thrown from the domain/application layer that semantically represents a known business failure. Distinct from a generic `Error`.             |
| **HTTP error**                    | An HTTP status ≥ 400 response. May originate from a domain exception, a NestJS guard, a pipe, or a generic uncaught `Error`.                              |
| **Legacy shape**                  | One of: (B) `{ statusCode, message, error }`; (C) ranking's custom shape. Being eliminated during Phase 2-3.                                               |
| **ProblemDetail**                 | The wire shape defined by RFC 7807. In TypeScript, the `ProblemDetail` interface from `src/common/types/problem-detail.type.ts`.                            |
| **`LEGACY_COMPAT` shim**          | Env-flag-driven behavior of `GlobalExceptionFilter` that writes legacy fields at the top level of the ProblemDetail body, preserved until Phase 5.        |

---

**Document version:** 3.1
**Last updated:** 2026-07-11
**Owner:** TBD — please assign a reviewer and a per-phase owner once approved.
**Companion documents:**
- [`docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md`](./migrations/RESPONSE_ENVELOPE_MIGRATION.md) — the success-path envelope migration, of which RFC 7807 standardization is Phase 3's continuing track.

---

## Revision history

**v4.2 (2026-07-11).** Phase 2 partial — **tournament** shipped end-to-end. Third Phase-2 module migrated; the largest by class count (15 concrete exceptions → 4 status codes: 400/403/404/409); also the first module with an existing `*DomainErrorDto` Swagger DTO to delete (completing §8.3's "No *DomainErrorDto files remain" criterion). Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 15 TOURNAMENT_* entries: 3 × 404 (`TOURNAMENT_NOT_FOUND`, `TOURNAMENT_ROUND_NOT_FOUND`, `TOURNAMENT_NOT_REGISTERED`), 1 × 403 (`TOURNAMENT_FORBIDDEN`), 5 × 409 (`TOURNAMENT_CONFLICT`, `TOURNAMENT_ALREADY_REGISTERED`, `TOURNAMENT_ATTEMPT_ALREADY_EXISTS`, `TOURNAMENT_PARTICIPANT_STATE`, `TOURNAMENT_ALREADY_WITHDRAWN`), 6 × 400 (`TOURNAMENT_VALIDATION`, `TOURNAMENT_REGISTRATION_CLOSED`, `TOURNAMENT_FULL`, `TOURNAMENT_ROUND_NOT_OPEN`, `TOURNAMENT_UNREGISTER_CLOSED`, `TOURNAMENT_WITHDRAW_CLOSED`).
- `src/common/errors/problem-code-mapping.spec.ts` extended with 15 new resolution assertions.
- `src/modules/tournament/domain/errors/tournament-domain.errors.ts` migrated. `TournamentDomainError` becomes an abstract namespace marker (no `code`). 14 of the 15 concrete classes accept an optional `message?: string`; `TournamentParticipantStateError` requires a `message: string` because every call site surfaces a specific state mismatch (no useful default).
- `src/modules/tournament/domain/errors/tournament-domain.errors.spec.ts` (new): 94 mapping-completeness tests iterating a 14-row table + 5 separate tests for `TournamentParticipantStateError` + 5 aggregate invariants. The total-count guard (`total === 15`) defends against accidental additions/removals during refactors.
- `src/modules/tournament/transport/filters/tournament-domain-exception.filter.ts` (deleted): the per-module `@Catch(TournamentDomainError)` filter is gone.
- `src/modules/tournament/dto/error/tournament-domain-error.dto.ts` (deleted): the per-module `*DomainErrorDto` Swagger DTO is gone. **§8.3 completion criterion "No *DomainErrorDto files remain in src/modules/*/dto/" is satisfied.** The empty `dto/error/` directory is removed.
- `src/modules/tournament/tournament.module.ts`: removed the filter provider (`TournamentDomainExceptionFilter`) and its import. The filter was registered as a **module provider** here — unlike category/tag where it was controller-scoped. This means the tournament migration touches the module file as well as the controller; future audit should expect this pattern in modules where the filter was wired via `providers`.
- `src/modules/tournament/transport/controller/tournament.controller.ts`: removed `UseFilters` import, `getSchemaPath` import, `TournamentDomainErrorDto` import, `TournamentDomainExceptionFilter` import, `@UseFilters(TournamentDomainExceptionFilter)` decoration, `@ApiExtraModels(ProblemDetailDto, TournamentDomainErrorDto)` reduced to `@ApiExtraModels(ProblemDetailDto)`, and the 3 helper decorators (`tournamentNotFoundResponse`, `tournamentForbiddenResponse`, `tournamentConflictResponse`) simplified to emit `ProblemDetailDto` directly. The 4 inline `schema: { oneOf: [...] }` blocks (in `createTournament`, `registerForTournament`, `startRoundAttempt`, `unregisterFromTournament`, `withdrawFromTournament`) are simplified to `type: ProblemDetailDto` with descriptive text. `ErrorResponseExamples` (`.notFound`, `.forbidden`, `.conflict`) is now wired into every error decorator.
- `test/rfc7807.e2e-spec.ts` extended with 15 tournament-coverage tests covering the full 4-status-code matrix.

Wire-shape changes (Phase 2 breaking):
1. **Envelope change.** Tournament error responses now follow the canonical RFC 7807 shape. The prior `{ statusCode, message, error }` envelope is fully gone.
2. **`TournamentForbiddenError.detail`** wire-shape improvement: the prior filter rewrote every `TournamentForbiddenError.message` to a hardcoded generic `'You do not have permission to perform this action'`, ignoring the thrown message. The global filter now preserves `exception.message`, so call sites that throw `new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE)` surface `'You do not have permission to manage this tournament'` verbatim.
3. **`TournamentRoundNotFoundError.detail`** wire-shape improvement: prior filter hardcoded the message. Global filter preserves it.
4. **`TournamentAlreadyWithdrawnError` → 409 (was 500).** The prior per-module filter did NOT include this exception in `mapToHttp`, so it fell through to the default `INTERNAL_SERVER_ERROR` with a generic `'Internal server error'` message — an implicit bug. Phase 2 routes it to 409 (semantic state conflict). This is documented as a wire-shape fix (status change 500 → 409), not a regression.

Decisions:
1. **`TournamentDomainError` stays abstract (no `code`, no mapping entry).** Same pattern as the prior 7 modules. Audit: `grep -rn 'new TournamentDomainError' src/` returns no matches. No `*OperationFailedError` would be useful.
2. **`TournamentAlreadyWithdrawnError` is kept as a real class (not collapsed into `TournamentParticipantStateError`).** Even though the service code currently throws the latter for the "already withdrawn" case (a pre-existing test asserts this — see verification note below), the class is preserved because it's part of a documented design surface (e.g. could be used directly in a future code path). Mapping entry explicitly added.
3. **`TournamentAlreadyWithdrawnError` mapping to 409 (not 500).** Documented as a wire-shape fix above. The unit test `tournament-withdraw.spec.ts:96` asserts `instanceof TournamentAlreadyWithdrawnError` but the service throws `TournamentParticipantStateError` for that case — a pre-existing test bug on `main` (verified by `git stash` + test against `main` showing the same 3 failures). Out of scope for this migration; tracked separately.
4. **`TournamentDomainErrorDto` Swagger DTO deletion.** First module to have such a DTO. The completion criterion is satisfied globally. The 4 inline `oneOf` blocks + 1 helper-block `oneOf` schema are all simplified to `ProblemDetailDto`. `getSchemaPath` import is removed (no remaining usages).
5. **Module-level filter provider removal.** Unlike category/tag (controller-scoped), tournament registered the filter as a module provider. The `providers` list in `tournament.module.ts` is shortened; the filter import is removed. Future audits on other modules should expect this pattern.
6. **Logging parity.** The prior filter had structured `event: 'tournament_domain_exception'` (warn) and `event: 'tournament_domain_exception_unexpected'` (error) logs. The global filter has `event: 'http_client_error'` (warn) and `event: 'http_server_error'` (error) — same severity buckets, slightly different event names. Log query filters that key on `tournament_domain_exception` need to update to `http_client_error`/`http_server_error` (with `extensions.code` starting with `TOURNAMENT_` to scope the filter). Acceptable trade-off; no functionality lost.
7. **`LEGACY_COMPAT` shim still deferred.** Same rationale as rev4.0 / rev4.1 — no concrete consumer needs it yet.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (8 prettier auto-fixes applied). Tournament + common-errors unit tests pass (165 + 94 = the new mapping spec + the new tournament spec; pre-existing 8 tournament app-spec failures are unchanged from `main` — verified by `git stash` + test). rfc7807 e2e suite passes (72 tests; +15 new tournament cases).

**v4.1 (2026-07-11).** Phase 2 partial — **tag** shipped end-to-end. Second Phase-2 module migrated; structurally identical to category (same 5-class shape, same 404/404/409/409/500 status mapping, same wire-shape improvements). Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 5 TAG_* entries: `TAG_NOT_FOUND` (404), `TAG_ANALYTICS_NOT_FOUND` (404), `TAG_SLUG_CONFLICT` (409), `TAG_ALREADY_ACTIVE` (409), `TAG_RESTORE_INVARIANT` (500).
- `src/common/errors/problem-code-mapping.spec.ts` extended with 5 new resolution assertions covering each new code.
- `src/modules/tag/domain/errors/tag-domain.errors.ts` migrated. `TagDomainError` becomes an abstract namespace marker (no `code` — same pattern as the prior 6 modules). 5 concrete classes now declare `readonly code`. No `*OperationFailedError` equivalent (YAGNI; no repository in this module throws a generic "unexpected DB error").
- `src/modules/tag/domain/errors/tag-domain.errors.spec.ts` (new): 34 mapping-completeness tests iterating a 5-row table + aggregate invariants.
- `src/modules/tag/transport/filters/tag-domain-exception.filter.ts` (deleted): the per-module `@Catch(TagDomainError)` filter is gone.
- `src/modules/tag/transport/controllers/tag.controller.ts`, `user-tag.controller.ts`: removed the `UseFilters` import, the filter import, and the `@UseFilters` decoration. **No** changes to `tag.module.ts` — the filter was controller-scoped.
- `test/rfc7807.e2e-spec.ts` extended with 5 tag-coverage tests. Each asserts the full wire shape (status, title, typeUri, extensions.code) — which is entirely new vs. the prior `{ statusCode, message, error }` envelope.

Wire-shape changes: identical to category's rev4.0 entry. The envelope replaces `{ statusCode, message, error }` with the canonical RFC 7807 shape; `TagRestoreInvariantError.detail` is now `'Tag restore invariant violated'` instead of the prior generic `'Internal server error'`.

Decisions:
1. **`TagDomainError` stays abstract (no `code`, no `ProblemCodeMapping` entry).** Same pattern as the prior 6 modules. YAGNI on a `*OperationFailedError`.
2. **No `TagDomainErrorDto` Swagger file existed** — `tag-swagger-decorators.ts` already references `ProblemDetailDto` directly (verified by grep). The Phase-2 completion criterion for the OpenAPI side is already satisfied.
3. **Two controllers, one filter.** Both `tag.controller.ts` and `user-tag.controller.ts` carried `@UseFilters(TagDomainExceptionFilter)`. Both decorations removed. The filter was not registered in `tag.module.ts`'s `providers`. This confirms the pattern observed in category: Phase-2 modules with multi-controller routes are not uncommon; future audits on tournament/social/instance should expect the same.
4. **`LEGACY_COMPAT` shim still deferred.** Same rationale as rev4.0 — no concrete consumer needs it; simpler migration wins.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (2 prettier auto-fixes applied). Tag + common-errors unit tests pass (72 tests; +5 new from mapping spec). rfc7807 e2e suite passes (57 tests; +5 new tag cases). The 8 tournament unit-test failures and the `app.e2e-spec.ts` Redis-dependent failure remain pre-existing on `main`.

**v4.0 (2026-07-11).** Phase 2 partial — **category** shipped end-to-end. First Phase-2 module migrated; the legacy `{ statusCode, message, error }` envelope has been fully replaced by RFC 7807 for the category module. Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 5 CATEGORY_* entries: `CATEGORY_NOT_FOUND` (404), `CATEGORY_ANALYTICS_NOT_FOUND` (404), `CATEGORY_SLUG_CONFLICT` (409), `CATEGORY_ALREADY_ACTIVE` (409), `CATEGORY_RESTORE_INVARIANT` (500).
- `src/common/errors/problem-code-mapping.spec.ts` extended with 5 new resolution assertions covering each new code.
- `src/modules/category/domain/errors/category-domain.errors.ts` migrated. `CategoryDomainError` becomes an abstract namespace marker (no `code` — never directly thrown; same pattern as auth/quiz/attempt/user). 5 concrete classes now declare `readonly code`. No `*OperationFailedError` equivalent was added (YAGNI; no repository in this module currently throws a generic "unexpected DB error" — every throw site uses a specific subclass).
- `src/modules/category/domain/errors/category-domain.errors.spec.ts` (new): 34 mapping-completeness tests iterating a 5-row table + aggregate invariants (uniqueness, `CATEGORY_*` namespace prefix, mapping parity, abstract-class guard).
- `src/modules/category/transport/filters/category-domain-exception.filter.ts` (deleted): the per-module `@Catch(CategoryDomainError)` filter is gone; `GlobalExceptionFilter` handles everything.
- `src/modules/category/transport/controllers/category.controller.ts`, `user-category.controller.ts`: removed the `UseFilters` import, the filter import, and the `@UseFilters` decoration. **No** changes to `category.module.ts` — the filter was never registered as a provider (only via `@UseFilters` at the controller level). The `transport/filters/` directory is now empty and removed.
- `test/rfc7807.e2e-spec.ts` extended with 5 category-coverage tests. Each asserts the full wire shape (status, title, typeUri, extensions.code) — which is **entirely new** vs. the prior `{ statusCode, message, error }` envelope.

Wire-shape changes (this is the breaking-change aspect of Phase 2):
1. **Envelope change.** Category error responses now follow the canonical RFC 7807 shape (`{ type, title, status, detail, instance, extensions }`). The prior `{ statusCode, message, error }` envelope is fully gone. Clients reading `err.response.data.statusCode` instead of `err.response.data.status` will break. The `LEGACY_COMPAT` shim is deferred to a separate PR per plan §8.3.
2. **`CategoryRestoreInvariantError.detail`** is now `'Category restore invariant violated'` instead of the prior generic `'Internal server error'`. Status code is unchanged (500). This is a deliberate wire-shape improvement: the prior filter swallowed the exception message; the global filter preserves `exception.message`. Clients switching on `extensions.code` get a precise classification that was previously absent.

Decisions:
1. **`CategoryDomainError` stays abstract (no `code`, no `ProblemCodeMapping` entry).** Same pattern as auth/quiz/attempt/user. Adding a `*OperationFailedError` would be YAGNI; revisit if a future repository introduces a generic catch-all.
2. **No `CategoryDomainErrorDto` Swagger file existed** — the per-endpoint OpenAPI decorators in `category-swagger-decorators.ts` already reference `ProblemDetailDto` directly (a prior PR migrated the swagger side ahead of the runtime side). The Phase-2 completion criterion `"No *DomainErrorDto files remain in src/modules/*/dto/"` is already satisfied for category; nothing to delete in the swagger side.
3. **Two controllers, one filter.** Both `category.controller.ts` and `user-category.controller.ts` carried `@UseFilters(CategoryDomainExceptionFilter)`. Both decorations are removed. The filter was not registered in `category.module.ts`'s `providers` (it was controller-scoped), so the module file is untouched. This is the first Phase-1/2 module with two `@UseFilters` call sites — the same pattern should be expected in tag/instance/social/etc. if a future audit finds multi-controller filter usage.
4. **`CategoryRestoreInvariantError` keeps its 500 status** (matches the prior per-module filter). The semantic upgrade to a different status (e.g. 409 Conflict) is out of scope for the migration — Phase 2 preserves the wire-level status; semantic upgrades are deferred.
5. **The `LEGACY_COMPAT` shim is intentionally deferred.** Adding it now would require touching the global filter (introducing a new branch that writes the legacy envelope alongside RFC 7807) without a concrete consumer that needs it. We prefer the simpler migration path: clients break loudly, fix in a follow-up PR if/when a real client complains. The plan's §8.3 risk section explicitly enumerates this breaking change as the core Phase-2 trade-off.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (3 prettier auto-fixes applied). Category + common-errors unit tests pass (67 tests; +34 new from category spec + 5 new from mapping spec). rfc7807 e2e suite passes (52 tests; +5 new category cases). The 8 tournament unit-test failures and the `app.e2e-spec.ts` Redis-dependent failure remain pre-existing on `main`.

**v3.5 (2026-07-11).** Phase 1 partial — user shipped end-to-end. **Phase 1 COMPLETE** (auth, quiz, attempt, user). Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 4 USER_* entries: `USER_NOT_FOUND` (404), `USER_RANKING_NOT_FOUND` (404, dead-code), `USER_ANALYTICS_NOT_FOUND` (404, dead-code), `USER_PROFILE_PRIVATE` (403).
- `src/common/errors/problem-code-mapping.spec.ts` extended with 4 new resolution assertions covering each new code's `status`/`title`/`typeUri`.
- `src/modules/user/domain/errors/user-domain.errors.ts` migrated. `UserDomainError` becomes an abstract namespace marker (no `code`, never directly thrown — same pattern as auth/quiz/attempt). 3 concrete classes (`UserNotFoundError`, `UserRankingNotFoundError`, `UserAnalyticsNotFoundError`) now declare `readonly code`. The user-side `UserNotFoundError` is kept distinct from the auth-side `UserNotFoundError` (which is `AUTH_USER_NOT_FOUND`, 401) — both classes exist with the same name and different module identities; clients distinguish via `extensions.code`. Unification deferred per §9 item 1.
- `src/modules/user/domain/errors/user-profile-private.error.ts` migrated. `UserProfilePrivateError` already had `code = 'USER_PROFILE_PRIVATE'` before this PR; this commit switches its parent from `UserDomainError` (which used to extend `Error`) to `UserDomainError` (which now extends `BaseDomainException`), so the class now inherits the `name = new.target.name` constructor logic from `BaseDomainException`. The previous `this.name = 'UserProfilePrivateError'` line is removed (now redundant). Its ctor signature (`targetUserId: string`) is preserved; the sibling file structure is kept because the message-building logic differs from the other 3 user exceptions.
- `src/modules/user/domain/errors/user-domain.errors.spec.ts` (new): 42 mapping-completeness tests. 3 of 4 exceptions are in a uniform `describe.each` table (matching the auth/quiz/attempt shape); `UserProfilePrivateError` is in its own describe block because of its `targetUserId`-only ctor signature. Aggregate invariants assert uniqueness, `USER_*` namespace prefix, mapping parity, and `UserDomainError`'s abstract compile-time guard.
- `src/modules/user/transport/filters/user-domain-exception.filter.ts` (deleted): the per-module `@Catch(UserDomainError, UserProfilePrivateError)` filter is gone; `GlobalExceptionFilter` handles everything.
- `src/modules/user/user.module.ts`, `src/modules/user/transport/controller/user.controller.ts`: removed the filter provider, the `UseFilters` import, and the `@UseFilters` decoration. The `transport/filters/` directory is now empty and removed.
- `test/rfc7807.e2e-spec.ts` extended with 5 user-coverage tests (one per shipped `code`, plus a dedicated wire-shape test for `UserNotFoundError` with a custom message). The user-side `UserNotFoundError` import is aliased (`as UserModuleNotFoundError`) to avoid collision with the auth-side `UserNotFoundError` already imported in the file.

Wire-shape changes (documented improvements, not regressions):
1. **`UserNotFoundError.detail` is now the thrown message verbatim.** The prior per-module filter hardcoded `detail: 'User not found'`, ignoring `error.message`. Call sites that throw `new UserNotFoundError('User not found or already deleted')` (in `social.service.ts`, `user.service.ts`, etc.) now surface the more specific message. Default-constructed exceptions still emit `"User not found"`.
2. **`UserRankingNotFoundError.detail` and `UserAnalyticsNotFoundError.detail`** are similarly preserved. Neither class is thrown anywhere in the current codebase (dead code); the wire-shape improvement only matters if/when a call site starts throwing them.
3. **`UserProfilePrivateError.message`** is built from `targetUserId` (`"Profile of user <id> is not public"`) and was already preserved by the prior filter (`detail: error.message`). The wire shape is unchanged for this exception.

Decisions:
1. **`UserDomainError` stays abstract (no `code`, no `ProblemCodeMapping` entry).** Same pattern as auth/quiz/attempt. No repository in the user module throws a generic "operation failed" exception today; every throw site uses a specific subclass. Adding a `*OperationFailedError` would be YAGNI.
2. **`UserRankingNotFoundError` and `UserAnalyticsNotFoundError` (dead code) get 404 mappings.** Both are exported but never thrown. The 404 mapping is the semantic analogue of `UserNotFoundError`. If they remain dead after the migration completes, delete them in a follow-up cleanup PR.
3. **`UserProfilePrivateError` stays in its own sibling file.** Consolidating it into `user-domain.errors.ts` would either (a) require forcing its `targetUserId`-ctor into the unified `(message?: string)` shape used by the other 3 classes, or (b) leave the file with two distinct ctor signatures, complicating the spec table for no benefit. Keeping the sibling file is the lowest-friction choice; `errors/index.ts` re-exports it so consumers don't need to know.
4. **Two `UserNotFoundError` classes remain distinct** (`AUTH_USER_NOT_FOUND` from auth, `USER_NOT_FOUND` from user). Already documented in rev3.2. Unification requires touching ~6 call sites across auth, social, ranking, discussion; out of scope for this PR. The wire-level distinction (401 vs. 404) is preserved — clients should switch on `extensions.code`, never on the class name.
5. **Achievement filter's `instanceof UserProfilePrivateError` check is left untouched.** The achievement module is Phase 2. After this PR, the class identity is preserved, so the achievement filter continues to map `UserProfilePrivateError` to 403 — but with the **old** envelope shape (`{ statusCode, message, error }`) instead of RFC 7807. Documented as out-of-scope until Phase 2 migrates the achievement module's exceptions and deletes its filter.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (9 prettier auto-fixes applied; 0 manual fixes needed; 1 `as UserModuleNotFoundError` alias added to disambiguate from auth's `UserNotFoundError`). User + common-errors unit tests pass (55 tests). rfc7807 e2e suite (47 tests including 5 new user-coverage cases) passes. The 8 tournament unit-test failures and the `app.e2e-spec.ts` Redis-dependent failure remain pre-existing on `main`.

**v3.4 (2026-07-11).** Phase 1 partial — attempt shipped end-to-end. Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 11 ATTEMPT_* entries: `ATTEMPT_NOT_FOUND` (404), `ATTEMPT_FORBIDDEN` (403), `ATTEMPT_VALIDATION_FAILED` (400), `ATTEMPT_ALREADY_STARTED` (409), `ATTEMPT_NOT_ACTIVE` (409), `ATTEMPT_QUESTION_ALREADY_ANSWERED` (409), `ATTEMPT_QUIZ_NOT_PUBLISHED` (422), `ATTEMPT_QUESTION_INVALID` (422), `ATTEMPT_NOT_COMPLETED` (422), `ATTEMPT_ANSWER_NOT_FOUND` (404, dead-code).
- `src/common/errors/problem-code-mapping.spec.ts` extended with 9 new resolution assertions covering every new code's `status`/`title`/`typeUri`.
- `src/modules/attempt/domain/errors/attempt-domain.errors.ts` migrated. `AttemptDomainError` stays abstract (never directly thrown — no `code` needed). `AttemptValidationError` becomes a **concrete standalone class** (no children) with `code = 'ATTEMPT_VALIDATION_FAILED'`, used by the one direct throw site at `attempt-command.service.ts:211`. All 10 other concrete classes declare `readonly code`. The 3 prior subclasses of `AttemptValidationError` (`QuizNotPublishedError`, `AttemptQuestionInvalidError`, `AttemptNotCompletedError`) are **reparented** to extend `AttemptDomainError` directly so each can carry its own `code` literal type — see Decisions below.
- `src/modules/attempt/domain/errors/attempt-domain.errors.spec.ts` (new): 77 mapping-completeness tests iterating an 11-row table + aggregate invariants (uniqueness, `ATTEMPT_*` namespace prefix, mapping parity, abstract-class guard).
- `src/modules/attempt/transport/filters/attempt-domain-exception.filter.ts` (deleted): the per-module `@Catch(AttemptDomainError)` filter is gone; `GlobalExceptionFilter` handles everything.
- `src/modules/attempt/attempt.module.ts`, `src/modules/attempt/transport/controller/attempt.controller.ts`: removed the filter provider, the `UseFilters` import, and the `@UseFilters` decoration. The `transport/filters/` directory is now empty and removed.
- `test/rfc7807.e2e-spec.ts` extended with 11 attempt-coverage tests (one per shipped `code`). Each asserts status, title, typeUri (the per-module URI, not the generic fallback), and `extensions.code`. The dead-code test for `AttemptAnswerNotFoundError` pins its 404 mapping so that if a future call site starts throwing it, the wire shape is already verified.

Wire-shape changes (documented improvements, not regressions):
1. **`QuizNotPublishedError` → 422 instead of 400.** In the prior module structure, `QuizNotPublishedError` extended `AttemptValidationError` and inherited its 400 mapping. After Phase 1 it extends `AttemptDomainError` directly and resolves to 422 — a deliberate upgrade because the request is syntactically valid; only the resource state (unpublished) forbids the action. The prior 400 was arguably wrong.
2. **`AttemptQuestionInvalidError` → 422 instead of 400.** Same rationale as `QuizNotPublishedError`. The request is valid; the question is just not part of this attempt's quiz version.
3. **`AttemptNotCompletedError` → 422 instead of 400.** Same rationale. Analytics is requested for an attempt that hasn't completed — a state conflict, not a syntactic error.

Decisions:
1. **Reparenting 3 classes (`QuizNotPublishedError`, `AttemptQuestionInvalidError`, `AttemptNotCompletedError`) from `AttemptValidationError` to `AttemptDomainError`.** The original module structure put these as subclasses of `AttemptValidationError` so the per-module filter could map all four with a single `instanceof AttemptValidationError` branch (and one `400 BadRequest`). After Phase 1, the global filter resolves by `code`, not `instanceof`, so the inheritance relationship carries only typing weight. Keeping them as children of `AttemptValidationError` would have forced the parent to be concrete (it must declare `code`), which would have caused TypeScript literal-type narrowing issues for each child class — exactly the problem the quiz migration solved with `QuizOperationFailedError`. Reparenting to `AttemptDomainError` gives each child its own `code` literal, with no narrowing concerns. The `instanceof AttemptValidationError` relationship was only checked in the per-module filter (now deleted), so no external consumer is affected.
2. **`AttemptValidationError` stays concrete but becomes standalone.** It is still thrown directly at `attempt-command.service.ts:211` (option-related validation in `submitAnswer`). It is no longer the parent of any other exception class. Its 400 mapping is preserved exactly as the prior filter's behavior.
3. **`AttemptDomainError` stays abstract (no `code`, no `ProblemCodeMapping` entry).** Unlike the quiz module, no repository in the attempt module throws a generic "unexpected DB error" exception today — every throw site uses a specific subclass. Adding a `QuizOperationFailedError`-equivalent (`AttemptOperationFailedError`) is YAGNI; revisit if a future repository introduces one.
4. **`AttemptAnswerNotFoundError` (dead code) gets a 404 mapping.** Same convention as auth's `OAuthAccountAlreadyExistsError` and the analytics `QuizAnalyticsError`-via-base. It is exported but never thrown anywhere in the codebase. The 404 mapping is the semantic analogue of `AttemptNotFoundError`. If it remains dead after the migration completes, delete it in a follow-up cleanup PR.
5. **The 400 → 422 upgrade for `QuizNotPublishedError` / `AttemptQuestionInvalidError` / `AttemptNotCompletedError` is intentional.** Wire-shape preservation was the Phase 1 default, but these three are explicit upgrades because the prior 400 was the *inheritance artifact* of `AttemptValidationError` — not a deliberate HTTP-semantics choice. The e2e test descriptions document the upgrade so reviewers understand why these three behave differently from the wire-shape-preserved auth/quiz migrations.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (3 pre-existing prettier auto-fixes applied; 1 stale `async` removed from a copy-pasted test). Attempt + common-errors unit tests pass (88 tests). rfc7807 e2e suite (42 tests including 11 new attempt-coverage cases) passes. The `app.e2e-spec.ts` failure (Redis dependency) and the 8 tournament unit-test failures remain pre-existing on `main`.

**v3.3 (2026-07-11).** Phase 1 partial — quiz shipped end-to-end. Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` extended with 13 QUIZ_* + 2 QUIZ_ANALYTICS_* entries. Same transport-side `code → { status, title, typeUri }` pattern as auth; sole consumer remains `GlobalExceptionFilter`.
- `src/common/errors/problem-code-mapping.spec.ts` extended with 6 new assertions covering QUIZ_NOT_FOUND (404), QUIZ_FORBIDDEN (403), QUIZ_INSUFFICIENT_QUESTIONS (422), QUIZ_OPERATION_FAILED (500), QUIZ_ANALYTICS_NOT_FOUND (404), QUIZ_ANALYTICS_CALCULATION_FAILED (500).
- `src/modules/quiz/domain/errors/quiz-domain.errors.ts` migrated. `QuizDomainError` stays as an abstract namespace marker (no `code`). 11 concrete classes now declare `readonly code`. **New** `QuizOperationFailedError` replaces the previous anti-pattern of `new QuizDomainError(...)` in the repository catch-alls (`quiz.repository.ts` × 2, `quiz-question.repository.ts` × 1, `quiz-version.repository.ts` × 1).
- `src/modules/quiz/domain/analytics/errors/quiz-analytics.errors.ts` migrated. `QuizAnalyticsError` stays abstract (no `code`, never directly thrown). 2 concrete classes — `QuizNotFoundError` (renamed-aware: same name as the quiz-main one, distinct hierarchy), `AnalyticsCalculationError` — now declare codes. The collision between the three `QuizNotFoundError` classes (quiz-main, quiz-analytics, discussion) is documented; the §9 item-1 unification is deferred.
- `src/modules/quiz/domain/errors/quiz-domain.errors.spec.ts` (new): 78 mapping-completeness tests iterating an 11-row table + abstract-class compile-time guard.
- `src/modules/quiz/domain/analytics/errors/quiz-analytics.errors.spec.ts` (new): 18 mapping-completeness tests for the 2 analytics exceptions + abstract-class guard.
- `src/modules/quiz/transport/filters/quiz-domain-exception.filter.ts` (deleted): the per-module `@Catch(QuizDomainError)` filter is gone; `GlobalExceptionFilter` handles everything.
- `src/modules/quiz/quiz.module.ts`, `src/modules/quiz/transport/controller/quiz.controller.ts`: removed the filter provider and `@UseFilters` decoration. The `transport/filters/` directory is now empty and removed.
- `src/modules/quiz/infrastructure/repositories/quiz.repository.ts`, `quiz-question.repository.ts`, `quiz-version.repository.ts`: imports + throw sites updated to use `QuizOperationFailedError` instead of the abstract base.
- `test/rfc7807.e2e-spec.ts` extended with 13 quiz-coverage tests: 11 quiz-main codes + 2 analytics codes. Each asserts status, title, typeUri (the per-module URI, not the generic fallback), `extensions.code`, and the verbatim `detail`.

Wire-shape changes (documented improvements, not regressions):
1. `QuizVersionImmutableError.detail` is now the thrown message verbatim. The prior `QuizDomainExceptionFilter` hardcoded `detail: 'This quiz version cannot be modified'` and ignored `error.message`; the global filter preserves `exception.message`. State-machine call sites that throw `'Archived versions are immutable and cannot be edited'` and `'Archived versions cannot be published'` now surface correctly.
2. `QuizAnalyticsNotFoundError` (formerly plain-Error 500 via the no-filter fall-through) now correctly returns 404 — matching the intent documented in `quiz-review.controller.ts:123-129`.
3. `QuizOperationFailedError` (formerly `new QuizDomainError(...)` abstract-base 500) now has an explicit `code: 'QUIZ_OPERATION_FAILED'` and the wire shape gains `extensions.code`. Status stays 500.

Decisions:
1. **`QuizOperationFailedError` as a new concrete class instead of making `QuizDomainError` concrete.** Three repository catch-alls were directly instantiating the abstract base — an anti-pattern that the `abstract` keyword was supposed to prevent. Adding a dedicated concrete class for the generic catch-all is the right fix; making the base concrete (with literal-typed `code`) would have forced all 11 subclasses to redeclare `code` with their own literal types via TS narrowing, complicating the inheritance chain for no benefit.
2. **Three `QuizNotFoundError` classes are kept distinct.** Quiz-main → `QUIZ_NOT_FOUND` (404, CRUD lookup). Quiz-analytics → `QUIZ_ANALYTICS_NOT_FOUND` (404, analytics lookup). Discussion → planned `DISCUSSION_QUIZ_NOT_FOUND` in the user-module PR (§9 item 1). They are distinct classes at the TypeScript/runtime level; clients distinguish them via `extensions.code`, never by the class name. The §9 unification requires touching the discussion module, which is out of scope for this PR.
3. **`QuizVersionImmutableError` mapping kept at 400 (not 409).** Matches the prior wire shape exactly. Semantically, 409 (state conflict) would be more correct, but the plan's "wire-shape preservation" principle for Phase 1 wins. Revisit in Phase 2 if the API contract allows it.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (54 pre-existing lint issues remain in `quiz/infrastructure/*` unrelated to this PR). Auth + common + quiz unit tests pass (192 tests). rfc7807 + envelope e2e tests pass (36 tests). Tournament + `app.e2e-spec.ts` failures remain pre-existing on `main`.

**v3.2 (2026-07-11).** Phase 1 partial — auth shipped end-to-end. Concrete deliverables:
- `src/common/errors/problem-code-mapping.ts` (new): transport-side `code → { status, title, typeUri }` lookup. Sole consumer: `GlobalExceptionFilter`. 15 AUTH_* entries.
- `src/common/errors/problem-code-mapping.spec.ts` (new): uniqueness, known-code resolution, unknown-code fallback, typeUri non-empty contract.
- `src/common/filters/global-exception.filter.ts`: handles `BaseDomainException` first via `code → ProblemCodeMapping`; sets `extensions.code` and the module-specific `typeUri`. Loud-failure branch (`unknown_error_code` log) added for missing mapping entries; suppresses the regular `http_*_error` log for unknown codes to avoid on-call noise duplication.
- `src/common/filters/global-exception.filter.spec.ts` (new): unit tests for all four paths (BaseDomainException, HttpException, plain Error, non-Error throwable), including the 4xx-warn vs. 5xx-error log-level contract and production-mode message sanitization.
- `src/common/filters/unknown-code.spec.ts` (new): integrated test for the loud-failure branch (`unknown_error_code` log, 500 wire, `extensions.code` preserved).
- `src/modules/auth/domain/errors/auth-domain.errors.ts`: replaces the `extends Error` chain with `extends BaseDomainException` (via an intermediate `AuthDomainError` namespace marker). 12 concrete classes now declare `readonly code`. `UserNotFoundError`'s unification with the user module's variant is deferred per §9 item 1.
- `src/modules/auth/domain/oauth/errors.ts`: same treatment for 3 OAuth errors. Two of them (`ResourceConflictError`, `OAuthAccountAlreadyExistsError`) are exported but never thrown; their new mappings (409 each) are correct and supersede the prior 500 fall-through bug as a side effect.
- `src/modules/auth/domain/errors/auth-domain.errors.spec.ts` (new): 78 mapping-completeness tests iterating a single 15-row table.
- `src/modules/auth/transport/filters/auth-domain-exception.filter.ts` (deleted): the per-module `@Catch(AuthDomainError)` filter is gone; `GlobalExceptionFilter` handles everything.
- `src/modules/auth/auth.module.ts`, `src/modules/auth/transport/controller/auth.controller.ts`: removed the filter provider and `@UseFilters` decoration. The `transport/filters/` directory is now empty and removed.
- `test/rfc7807.e2e-spec.ts`: extended with 13 auth-coverage tests (one per shipped `code`). Each asserts status, title, typeUri (the per-module URI, not the generic fallback), and `extensions.code`.

Decisions:
1. **Per-module `@Catch` filter deletion over pass-through.** §8.2 originally allowed either; this implementation goes further than the conservative "thin pass-through" option. The auth pilot proves the global filter can carry the auth module's mapping without any per-module coupling. Quiz, attempt, user follow the same pattern.
2. **`AUTH_INVALID_CURRENT_PASSWORD` over `AUTH_INVALID_PASSWORD`.** The shorter name would collide with `AUTH_INVALID_TOKEN`'s mental model; the longer one disambiguates the field context (the user's *current* password during a change-password flow).
3. **`OAuthAccountLinkingRequiredError.detail` preserves `exception.message`.** Mirrors the prior `AuthDomainExceptionFilter` behavior, which preserved the long error message (`'Account linking requires explicit confirmation because the existing account is not verified.'`) rather than replacing it with a generic string. The wire shape for this exception is unchanged.

Verification: `tsc --noEmit` clean. ESLint clean on every touched file (5 pre-existing lint warnings remain in `auth/infrastructure/*` unrelated to this PR). Auth + common unit tests pass (102 tests). rfc7807 + envelope e2e tests pass (23 tests). Tournament + app.e2e failures are pre-existing and unrelated.

**v3.1 (2026-07-11).** Phase 0 shipped. Added `src/common/errors/base-domain.exception.ts` (one field: `code`) and `test/rfc7807.e2e-spec.ts` (6 tests pinning the current global-filter contract across `BaseDomainException`, native `NotFoundException`, native `BadRequestException` with a string-array `ValidationPipe` message, plain `Error`, and a non-`Error` throwable). Lint and `tsc --noEmit` clean.
- Removed `httpStatus` and `title` from `BaseDomainException`. The class now carries only `code`.
- HTTP semantics (`status`, `title`, `typeUri`) move to a transport-side table `ProblemCodeMapping` in `src/common/filters/problem-code-mapping.ts`, consumed solely by `GlobalExceptionFilter`.
- Trade-off: a new domain error now requires editing two files (the class for `code`; the mapping for `{ status, title, typeUri }`) instead of one. Accepted in exchange for domain portability (gRPC/GraphQL/CLI reuse) and a single edit point for HTTP semantics. Rationale in §4.4.
- Added an explicit "unknown code" loud-failure branch in `GlobalExceptionFilter`: a `code` missing from `ProblemCodeMapping` produces a 500 + `error: 'unknown_error_code'` log. Per-module tests assert mapping completeness. Reasoning: §6.4.
- Migration-phase edits that previously added three fields per class now add one (`code`); the matching mapping entry is co-committed. §8 updated accordingly.

**v2.0 (2026-07-11).** Simplified after review focused on KISS / YAGNI / Clean Architecture. Removed:
- The per-module `*ErrorCodes` registry and the central `error-code-catalog.ts` — codes are now `readonly` fields on each concrete class (one source of truth, no auxiliary files, no generator).
- The 8 abstract intermediate exception layers (`NotFoundException`, `ConflictException`, etc.) — only `BaseDomainException` remains. TypeScript's `abstract readonly` enforces `code` without needing intermediate status defaults.
- The dedicated `pnpm lint:rfc7807` rule — `tsc` plus per-PR greps plus code review is sufficient.
- Generated markdown / error-catalog documentation (§14 F2 / F3 / F8) — speculative, removed under YAGNI; can be reintroduced if a concrete external consumer appears.
- The `problem-detail.extensions.ts` interface — extensions are documented in §5.3 and built as a plain object literal in `GlobalExceptionFilter`.

Kept:
- `LEGACY_COMPAT` env-flag shim during Phase 2 — the response-envelope migration followed the same dual-shape pattern; rev'ing all clients in lockstep is not realistic.
- The ModuleOrder table in §9 — information we already have from auditing cross-module imports, not speculative architecture.
- The `GLOBAL_*` code table in `GlobalExceptionFilter` — it's the only code table that earns its place (codes are synthesized from status, not declared on classes).

**v1.0 (2026-07-11).** Initial draft.
