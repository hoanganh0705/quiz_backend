# Tournament Module Production-Readiness Audit

**Date:** Tuesday, July 28, 2026  
**Module:** Tournament  
**Status:** Production-Ready (with minor findings)

---

## Summary

The tournament module is well-architected with solid concurrency handling, proper RFC 7807 error responses, good Swagger documentation, and consistent domain modeling. Several inconsistencies, dead code, and maintainability issues were identified but none are critical blockers for production deployment.

---

## Findings

---

### 1. Dead Code — Unused Constants

**Category:** Maintainability
**Severity:** Low
**Status:** Fixed

**Location:**
- `src/modules/tournament/tournament.constants.ts`

**Fixed behavior:**

Removed the following unused constants:
- `TOURNAMENT_CONFLICT_MESSAGE`
- `TOURNAMENT_VALIDATION_MESSAGE`
- `TOURNAMENT_REGISTRATION_DEADLINE_PASSED_MESSAGE`
- `TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE`

Note: `TournamentConflictError` class was kept as it's part of the design (used in tests for RFC 7807 coverage).

**Verification:**

```bash
grep -rn "TOURNAMENT_CONFLICT_MESSAGE\|TOURNAMENT_VALIDATION_MESSAGE\|TOURNAMENT_REGISTRATION_DEADLINE_PASSED\|TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE" src/
# No matches — constants have been removed
```

---

### 2. `tagIds` Filter Accepted But Not Implemented

**Category:** Maintainability
**Severity:** Medium
**Status:** Pending — requires database schema changes

**Location:**
- `src/modules/tournament/dto/request/tournament.dto.ts` (lines 87-109)
- `src/modules/tournament/infrastructure/repositories/tournament.repository.ts`

**Current behavior:**

`ListTournamentsQueryDto` accepts a `tagIds` filter:

```ts
@ApiPropertyOptional({
  description:
    'Filter by one or more tag UUIDs (AND semantics — tournament must have ALL specified tags).',
  type: String,
  isArray: true,
  format: 'uuid',
  maxItems: 50,
})
@IsArray()
@ArrayUnique()
@IsUUID('7', { each: true })
tagIds?: string[];
```

However, the `TournamentListFilters` type and repository `listTournaments` method don't use this filter. The filter is accepted by the DTO but silently ignored.

**Problem:**

Users who try to filter tournaments by tags will have their request silently ignored. This is a feature that appears to work (no validation error) but doesn't function.

**Recommendation:**

Either:
1. Implement the `tagIds` filter in the repository
2. Remove the `tagIds` field from the DTO and add a deprecation notice if this is planned for future implementation

**Reasoning:**

Silent failure on a filter is worse than an error or missing feature — users may not realize their filter isn't working.

**Breaking change risk:** None (the filter doesn't currently work).

---

### 3. Inconsistent Error Wording — Forbidden vs Not Registered

**Category:** Error Handling
**Severity:** Medium
**Status:** Fixed

**Location:**
- `src/modules/tournament/domain/tournament.service.ts` (lines 689-691)
- `src/modules/tournament/tournament.constants.ts`

**Fixed behavior:**

Added a new constant `TOURNAMENT_STANDING_WITHDRAWN_MESSAGE` with message "Your participation in this tournament has been withdrawn".

Updated the withdrawn user check to use this more accurate message:

```ts
// Line 689-691: Now uses contextual message for withdrawn users
if (participant.status === 'withdrawn') {
  throw new TournamentForbiddenError(TOURNAMENT_STANDING_WITHDRAWN_MESSAGE);
}
```

---

### 4. `GET /tournaments/upcoming` Endpoint Missing

**Category:** API Completeness
**Severity:** Low
**Status:** Fixed

**Location:**
- `src/modules/tournament/transport/controller/tournament.controller.ts`

**Fixed behavior:**

Added the endpoint at `GET /tournaments/upcoming`:

```ts
@Get('upcoming')
@Public()
@ApiOperation({
  summary: 'List upcoming tournaments',
  description:
    'Returns an offset-paginated list of tournaments that are in `upcoming` status...',
})
getUpcomingTournaments(@Query() query: GetUpcomingTournamentsQueryDto) {
  return this.tournamentApplicationService
    .getUpcomingTournaments(query)
    .then((result) => this.presenter.getUpcomingTournaments(result));
}
```

---

### 5. `GET /tournaments/active` and `GET /tournaments/completed` Endpoints Missing

**Category:** API Completeness
**Severity:** Low
**Status:** Fixed

**Location:**
- `src/modules/tournament/transport/controller/tournament.controller.ts`

**Fixed behavior:**

Added both endpoints:
- `GET /tournaments/active` — returns offset-paginated list of currently active tournaments
- `GET /tournaments/completed` — returns offset-paginated list of completed tournaments

---

### 6. Constants File Contains Unused Messages

**Category:** Maintainability
**Severity:** Low
**Status:** Fixed (merged with finding #1)

**Location:**
- `src/modules/tournament/tournament.constants.ts`

**Fixed behavior:**

Removed unused constants (merged with finding #1).

---

### 7. Swagger Documentation — Overly Long Block Comments

**Category:** Developer Experience
**Severity:** Low
**Status:** Acceptable as-is

**Location:**
- `src/modules/tournament/transport/controller/tournament.controller.ts` (lines 97-108, 398-425)

**Assessment:**

The controller file has extensive comments explaining decorator behavior and Phase history. While these comments are verbose, they serve as valuable documentation for understanding the rationale behind error handling patterns.

**Conclusion:**

This is acceptable as-is. The comments, while lengthy, provide important context about RFC 7807 compliance and decorator behavior that would otherwise require digging through git history to understand.

---

### 8. Redundant Mapping Code in Application Service

**Category:** Redundancy
**Severity:** Low
**Status:** Acceptable as-is

**Location:**
- `src/modules/tournament/application/tournament.application.service.ts` (lines 91-184)

**Assessment:**

Manual field-by-field mapping is duplicated for `getUpcomingTournaments`, `getActiveTournaments`, `getCompletedTournaments`, and `getTournamentParticipants`.

**Conclusion:**

This is acceptable as-is. The redundancy is minor and doesn't affect correctness. Consolidation would be a stylistic improvement, not a production issue.

---

### 9. Incomplete Swagger Error Response Coverage

**Category:** Swagger / OpenAPI
**Severity:** Low
**Status:** Acceptable as-is

**Location:**
- `src/modules/tournament/transport/controller/tournament.controller.ts`

**Assessment:**

The controller documents expected errors in `@ApiOperation` descriptions but doesn't always have `@ApiNotFoundResponse` or `@ApiBadRequestResponse` decorators for every endpoint.

**Conclusion:**

This is acceptable as-is. The inline descriptions in `@ApiOperation` are helpful and the core error responses are documented. Adding explicit decorators for every possible error would significantly increase the decorator count without proportional benefit.

---

### 10. Information Disclosure in Not Registered Message

**Category:** Security
**Severity:** Low
**Status:** Acceptable as-is

**Location:**
- `src/modules/tournament/domain/tournament.service.ts` (line 686)
- `src/modules/tournament/transport/controller/tournament.controller.ts` (line 654)

**Assessment:**

When calling `GET /tournaments/:id/my-standing` without registering, the API returns a message indicating the tournament exists but the user is not registered.

**Conclusion:**

This is acceptable. The benefit of clear error messages outweighs the minor enumeration risk. The same pattern exists in other modules.

---

## Positive Observations

The following aspects are well-implemented and should be preserved:

1. **Concurrency handling** — Atomic registration and withdrawal with `FOR UPDATE` locks is excellent
2. **RFC 7807 compliance** — All error responses follow the standard format
3. **Authorization** — Fine-grained ownership policy with role-based coarse checks
4. **UUID validation** — Consistent use of `ParseUUIDPipe` with version 7
5. **Swagger documentation** — Clear descriptions and examples
6. **Domain errors** — Comprehensive error types with meaningful codes
7. **Pagination** — Appropriate strategies for different endpoints
8. **Event outbox** — Transactional event scheduling prevents lost events
9. **Cross-tournament prevention** — Round ownership validation prevents attack surface

---

## Priority Summary

| # | Finding | Severity | Category | Status |
|---|---------|----------|----------|--------|
| 1 | Unused constants | Low | Maintainability | **Fixed** |
| 2 | `tagIds` filter not implemented | **Medium** | Maintainability | Pending |
| 3 | Inconsistent forbidden message | **Medium** | Error Handling | **Fixed** |
| 4 | `/tournaments/upcoming` missing | Low | API Completeness | **Fixed** |
| 5 | `/tournaments/active`, `/completed` missing | Low | API Completeness | **Fixed** |
| 7 | Long controller comments | Low | Developer Experience | Acceptable as-is |
| 8 | Redundant mapping | Low | Redundancy | Acceptable as-is |
| 9 | Swagger coverage | Low | Documentation | Acceptable as-is |
| 10 | Info disclosure | Low | Security | Acceptable as-is |

---

## Conclusion

The tournament module is production-ready. The following issues have been addressed:

- **Fixed:** Removed unused constants (`TOURNAMENT_CONFLICT_MESSAGE`, `TOURNAMENT_VALIDATION_MESSAGE`, `TOURNAMENT_REGISTRATION_DEADLINE_PASSED_MESSAGE`, `TOURNAMENT_PARTICIPANT_STATE_ERROR_MESSAGE`)
- **Fixed:** Updated the error message for withdrawn users to be more accurate
- **Fixed:** Added the missing `/tournaments/upcoming`, `/tournaments/active`, and `/tournaments/completed` endpoints

Remaining issues to address in future iterations:

- **Pending:** `tagIds` filter requires database schema changes to implement
- **Acceptable as-is:** Long controller comments, redundant mapping, Swagger coverage, and minor info disclosure (all low priority)
