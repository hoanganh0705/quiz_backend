# Instance Module Production-Readiness Audit

**Module:** `src/modules/instance`
**Date:** Tuesday, July 28, 2026
**Reviewer:** Production Audit
**Status:** Ready for Production (with findings)

---

## Summary

The instance module is well-architected with solid domain modeling, proper optimistic locking, and comprehensive error handling. The state machine design (`open → countdown → running → closed/finished`) is sound, and the separation between domain, application, and transport layers is clean. Several findings warrant attention before production release; none are blockers, but medium-severity items should be addressed.

---

## Scope

Reviewed files:
- `src/modules/instance/transport/controller/instance.controller.ts`
- `src/modules/instance/application/instance.application.service.ts`
- `src/modules/instance/domain/instance.service.ts`
- `src/modules/instance/domain/errors/instance-domain.errors.ts`
- `src/modules/instance/domain/ports/instance-repository.port.ts`
- `src/modules/instance/infrastructure/repositories/quiz-instance.repository.ts`
- `src/modules/instance/transport/gateway/instance.gateway.ts`
- `src/modules/instance/transport/filters/ws-exception.filter.ts`
- `src/modules/instance/transport/presenters/instance.presenter.ts`
- `src/modules/instance/mappers/instance-response.mapper.ts`
- `src/modules/instance/dto/request/instance.dto.ts`
- `src/modules/instance/dto/response/*.dto.ts`
- `src/modules/instance/instance.constants.ts`
- `src/modules/instance/types/instance.types.ts`
- `src/common/errors/problem-code-mapping.ts`

---

## Findings

### Finding 1

**Category:** HTTP Status Codes
**Severity:** Medium

**Location:** `src/modules/instance/transport/controller/instance.controller.ts`, line 399

**Current behavior:** `POST /instances/{id}/start` returns 200 OK.

**Problem:** The endpoint transitions an instance from `countdown` → `running` and emits events asynchronously. This is semantically a 202 Accepted (accepted for processing, not yet complete). Other similar state-transition endpoints across the backend use 202 for async operations.

**Recommendation:** Consider returning 202 Accepted for `startInstance`, `closeInstance`, and `cancelCountdown` since these operations trigger downstream effects (WebSocket broadcasts, scheduler interactions).

**Reasoning:** REST semantics: 202 indicates the request has been accepted but processing is not complete. This is more accurate for state machines with side effects.

**Breaking change risk:** Low — this only changes the HTTP status code, not the response body.

---

### Finding 2

**Category:** HTTP Status Codes
**Severity:** Low

**Location:** `src/modules/instance/transport/controller/instance.controller.ts`, line 360

**Current behavior:** `POST /instances/{id}/join` returns 200 OK.

**Problem:** The join operation creates a new player record in the database. REST semantics suggest 201 Created for resource creation, or 202 Accepted since the join triggers events.

**Recommendation:** Consider returning 201 Created or 202 Accepted to align with resource-creation semantics.

**Reasoning:** Consistency with `registerForTournament` which uses 201 (see `tournament.controller.ts` line 656).

**Breaking change risk:** Low.

---

### Finding 3

**Category:** Error Handling
**Severity:** Medium

**Location:** `src/modules/instance/domain/instance.service.ts`, lines 189–192

**Current behavior:**
```typescript
} catch (error) {
  if (error instanceof Error && error.message === 'INSTANCE_FULL') {
    throw new InstanceFullError(INSTANCE_FULL_MESSAGE);
  }
```

**Problem:** Error detection by string comparison of `error.message === 'INSTANCE_FULL'` is fragile. This relies on an exact string match thrown from the repository layer (`quiz-instance.repository.ts:440`). If the repository error message ever changes, this detection silently breaks and the wrong error propagates.

**Recommendation:** Use a typed error class or error code from the repository instead of string matching. The repository should throw `InstanceFullError` directly, or use a distinct error type that can be caught reliably.

**Reasoning:** String-based error detection is a maintenance hazard. If the repository's `throw new Error('INSTANCE_FULL')` message changes to "The instance is at capacity" or "INSTANCE_FULL_CAPACITY", this catch block silently stops matching.

**Breaking change risk:** Low (only affects internal error propagation).

---

### Finding 4

**Category:** Domain Model Consistency
**Severity:** Low

**Location:** `src/modules/instance/domain/ports/instance-repository.port.ts`

**Current behavior:** The port interface includes `createInstance()` alongside `createInstanceWithHost()`.

**Problem:** `createInstance()` is declared in the port but never called anywhere in the codebase. Only `createInstanceWithHost()` is used, which handles both instance creation and host player insertion atomically.

**Recommendation:** Remove `createInstance()` from the port interface and its implementation in `quiz-instance.repository.ts`.

**Reasoning:** Dead code increases maintenance burden and misleads future developers about the intended API surface.

**Breaking change risk:** None (removing unused code).

---

### Finding 5

**Category:** Maintainability
**Severity:** Low

**Location:** `src/modules/instance/instance.constants.ts` and `src/modules/instance/types/instance.types.ts`

**Current behavior:**

```typescript
// instance.constants.ts
export const INSTANCE_STATUSES = ['open', 'countdown', 'running', 'closed', 'finished'] as const;

// types/instance.types.ts
export const INSTANCE_STATUSES = ['open', 'countdown', 'running', 'closed', 'finished'] as const;
```

**Problem:** The same constant exists in two places. Changes must be synchronized manually.

**Recommendation:** Keep the definition in `types/instance.types.ts` and import it in `instance.constants.ts` (or vice versa) for a single source of truth.

**Reasoning:** DRY principle violation. Inconsistency could lead to subtle bugs if one copy is updated without the other.

**Breaking change risk:** None.

---

### Finding 6

**Category:** Maintainability
**Severity:** Low

**Location:** `src/modules/instance/application/instance.application.service.ts`, lines 187–198

**Current behavior:**
```typescript
logCountdownIdempotencyKey(params: {...}): void {
  this.logger.debug({...}); // Synchronous logging
}
```

**Problem:** While the current implementation is synchronous (just logging), the comment indicates this should eventually integrate with an `IdempotencyService`. The method signature returns `void`, which will require changes when proper idempotency is implemented.

**Recommendation:** Document the future contract in a TODO comment or create a placeholder for the `IdempotencyService` integration to make the intended behavior explicit.

**Reasoning:** Prevents confusion about the idempotency implementation status.

**Breaking change risk:** None.

---

### Finding 7

**Category:** Cross-Module Consistency
**Severity:** Low

**Location:** `src/modules/instance/dto/response/instance-action-response.dto.ts`

**Current behavior:** `StartCountdownResponseDto` returns rich state data (`instanceId`, `status`, `countdownStartedAt`, `countdownEndsAt`), while other action responses (`JoinInstanceResponseDto`, `StartInstanceResponseDto`, `CloseInstanceResponseDto`) return only `{ message: string }`.

**Problem:** Inconsistent response shapes across action endpoints. Frontend developers must handle different response formats depending on which action was performed.

**Recommendation:** Consider whether `StartCountdownResponseDto` should return the same `{ message: string }` shape as other action responses, with the detailed state accessible via `GET /instances/{id}` after the action completes.

**Reasoning:** API consistency aids frontend development. If the countdown state is critical, it should be accessible via the standard detail endpoint rather than returned from the action endpoint.

**Breaking change risk:** Medium — changes response shape.

---

### Finding 8

**Category:** Naming Consistency
**Severity:** Low

**Location:** `src/modules/instance/domain/errors/instance-domain.errors.ts`

**Current behavior:** Error codes mix patterns:
- `INSTANCE_NOT_HOST` (negation + role)
- `INSTANCE_NOT_OPEN` (negation + state)
- `INSTANCE_ALREADY_STARTED` (past tense + state)
- `INSTANCE_COUNTDOWN_ALREADY_STARTED` (compound)

**Problem:** While internally consistent, the naming pattern is not uniform. Some use `NOT_X`, others use `ALREADY_X`.

**Recommendation:** This is acceptable as-is if the pattern is intentional (negation for preconditions that aren't met, past tense for invariants that are violated). However, document the naming convention in the module's error handling guide.

**Reasoning:** Consistency aids debugging and API documentation. The current mix is readable but not strictly consistent.

**Breaking change risk:** High (changes error codes).

---

### Finding 9

**Category:** Swagger / OpenAPI
**Severity:** Low

**Location:** `src/modules/instance/transport/controller/instance.controller.ts`

**Current behavior:** Many endpoints lack explicit `operationId` in their `@ApiOperation` decorators.

**Problem:** Generated SDKs may use auto-generated operation names that are less stable than explicit ones.

**Recommendation:** Add explicit `operationId` values to key endpoints for more stable SDK generation:

```typescript
@ApiOperation({
  summary: 'Create instance',
  operationId: 'createInstance',
  ...
})
```

**Reasoning:** Improves SDK stability and tooling compatibility.

**Breaking change risk:** None.

---

### Finding 10

**Category:** Security
**Severity:** Medium

**Location:** `src/modules/instance/transport/gateway/instance.gateway.ts`, lines 19–20

**Current behavior:**
```typescript
const ERR_NOT_HOST = { code: 'NOT_HOST', message: 'Only the host can perform this action' };
const ERR_FORBIDDEN = { code: 'FORBIDDEN', message: 'You do not have permission for this action' };
```

**Problem:** The Socket.IO error format (`{ code, message }`) differs from the REST API's RFC 7807 format. Any unexpected error falls through to the generic `INTERNAL_ERROR` response, which is correct security behavior, but frontend developers need to know both formats exist.

**Recommendation:** Document the WebSocket error contract separately from the REST API error contract. Consider whether Socket.IO errors should eventually align with the same error structure.

**Reasoning:** Frontend developers need to know that REST API errors and WebSocket errors have different formats.

**Breaking change risk:** None (this is an improvement, not a fix).

---

### Finding 11

**Category:** Maintainability
**Severity:** Improvement

**Location:** `src/modules/instance/domain/instance.service.ts`, line 662

**Current behavior:**
```typescript
static readonly COUNTDOWN_DURATION_MS = 5_000;
```

**Problem:** The countdown duration is hardcoded. While this is documented, it cannot be changed without a code deployment.

**Recommendation:** Consider exposing this via environment configuration in a future phase if tunability is needed. For now, document the constant clearly.

**Reasoning:** Hardcoded magic values are harder to tune in production environments.

**Breaking change risk:** None (not changing current behavior).

---

### Finding 12

**Category:** Request & Response Consistency
**Severity:** Low

**Location:** `src/modules/instance/dto/request/instance.dto.ts` and controller methods

**Current behavior:** DTOs define `limit?: number = 20` (TypeScript default), and controllers also provide `query.limit ?? 20` (fallback default).

**Problem:** The default is defined in two places (DTO and controller). If one changes without the other, behavior becomes inconsistent.

**Recommendation:** Prefer a single source of truth for defaults. Either:
1. Remove the TypeScript default from DTOs and let controllers handle all defaults, OR
2. Remove controller fallbacks and rely on DTO defaults

**Reasoning:** Reduces maintenance burden and prevents inconsistencies.

**Breaking change risk:** None (values are currently aligned).

---

## Items Not Flagged (Correct As-Is)

The following aspects of the instance module are production-ready and do not require changes:

| Item | Assessment |
|------|------------|
| Optimistic locking implementation | Well-designed with proper version checking and re-read logic |
| RFC 7807 ProblemDetail usage | Consistent with the rest of the backend |
| Domain events | Properly structured with clear event sourcing |
| Repository port pattern | Clean separation of concerns |
| Cursor-based pagination | Properly implemented with base64url encoding |
| Status code mappings | Appropriate use of 400/403/404/409/422 |
| WebSocket event architecture | Correctly uses Redis adapter for horizontal scaling |
| Notification fallback | Gracefully degrades when notification port is unavailable |
| `COUNTDOWN_DURATION_MS` constant | Clearly documented with reasoning for 5-second value |

---

## Findings Summary

| # | Category | Severity | Location | Type |
|---|----------|----------|----------|------|
| 1 | HTTP Status Codes | Medium | `instance.controller.ts:399` | `startInstance` should return 202 |
| 2 | HTTP Status Codes | Low | `instance.controller.ts:360` | `joinInstance` could return 201/202 |
| 3 | Error Handling | Medium | `instance.service.ts:189–192` | String-based error detection is fragile |
| 4 | Domain Model | Low | `instance-repository.port.ts` | Dead `createInstance()` method |
| 5 | Maintainability | Low | `instance.constants.ts` / `types/instance.types.ts` | Duplicate `INSTANCE_STATUSES` |
| 6 | Maintainability | Low | `instance.application.service.ts:187–198` | Idempotency TODO marker |
| 7 | Cross-Module | Low | `instance-action-response.dto.ts` | Inconsistent response shapes |
| 8 | Naming | Low | `instance-domain.errors.ts` | Mixed error naming patterns |
| 9 | Swagger | Low | `instance.controller.ts` | Missing `operationId` values |
| 10 | Security | Medium | `instance.gateway.ts:19–20` | WebSocket error format differs from REST |
| 11 | Maintainability | Improvement | `instance.service.ts:662` | Hardcoded countdown duration |
| 12 | Consistency | Low | DTO + controller defaults | Duplicate default definitions |

**Medium severity:** 3 items
**Low severity:** 7 items
**Improvement:** 2 items

---

## Recommendation

The instance module is **production-ready** with the following priority actions:

1. **Before production** (Medium severity):
   - Fix Finding 3: Use typed error from repository instead of string matching
   - Address Finding 10: Document WebSocket vs REST error format difference

2. **Post-production cleanup** (Low severity):
   - Remove dead `createInstance()` method (Finding 4)
   - Consolidate `INSTANCE_STATUSES` (Finding 5)
   - Add explicit `operationId` values (Finding 9)
   - Unify default handling (Finding 12)

3. **Future consideration** (Improvement):
   - Consider 202 status codes for state transitions (Finding 1)
   - Evaluate consistent response shapes (Finding 7)
   - Expose countdown duration via config (Finding 11)
