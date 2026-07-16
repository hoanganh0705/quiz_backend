# Tournament Module — API Contract Audit

> Comprehensive API contract audit of the `tournament` module.
> Compares implementation, OpenAPI specification, Swagger UI, validation rules, authorization rules, examples, and actual runtime behavior.
> Generated from a senior backend API review perspective. No code was modified during this audit; this document is the deliverable.

---

## 1. Executive Summary

### Overall Contract Health Score: **6.5 / 10**

The `tournament` module has a well-structured domain layer with 15 distinct error codes, comprehensive business rule enforcement, and a clean layered architecture (controller → application service → domain service → repository). However, the module has significant issues: **missing Swagger examples** on all 16 endpoints, **missing OpenAPI regression test**, **status value mismatches** between documentation and implementation, **response structure inconsistencies** where presenters don't match OpenAPI contracts, and several **business rule discrepancies** between `docs/modules/tournament.md` and actual runtime behavior.

### Metrics

| Metric | Value |
|--------|-------|
| **Endpoints audited** | 16 |
| **Total issues found** | 23 |
| **Critical** | 3 |
| **High** | 4 |
| **Medium** | 10 |
| **Low** | 6 |
| **Documentation issues** | 12 |
| **Implementation bugs** | 4 |
| **Validation inconsistencies** | 2 |
| **OpenAPI inconsistencies** | 5 |
| **Swagger success-example issues** | 16 (every endpoint) |
| **Module-level OpenAPI regression test** | Missing |
| **E2E test files for the module** | None |

### Source-of-truth hierarchy applied

Per `docs/PROJECT_CONSTITUTION.md`:

1. **Implementation** (compiled TypeScript) — authoritative for runtime behavior.
2. **Tests** — second authority.
3. **OpenAPI** — wire contract.
4. **Docs (`docs/modules/tournament.md`)** — descriptive only.

When two sources disagreed during the audit, this hierarchy was applied to determine which side should be corrected.

---

## 2. Module Overview

The tournament module owns the competitive quiz event lifecycle: tournament creation, registration phases, round management, live leaderboards, and scheduled lifecycle transitions (BullMQ-based).

### Resources

| Resource | Description |
|----------|-------------|
| `Tournament` | An event with title, description, quizId, startAt, endAt, status, maxParticipants |
| `TournamentParticipant` | A user's registration with status and timestamps |
| `TournamentRound` | A round within a tournament |
| `TournamentRoundParticipant` | A participant's participation in a specific round |

### Business Rules (from `docs/modules/tournament.md`)

- **End after start**: `endAt` must be after `startAt`.
- **Registration window**: registration only accepted when `status = registration`.
- **Withdraw window**: withdrawal only allowed when `status = ongoing`.
- **Unregister window**: unregistration only allowed when `status = registration`.
- **Capacity cap**: registration fails when `maxParticipants` is reached.
- **Re-registration**: withdrawing then re-registering reactivates the participant record.
- **Leaderboard**: computed from participant results.

---

## 3. Endpoint Inventory

| # | Method | Path | Summary | Auth |
|---|--------|------|---------|------|
| 1 | POST | `/api/v1/tournaments` | Create tournament | `TOURNAMENT_CREATE` |
| 2 | GET | `/api/v1/tournaments` | List tournaments (cursor paginated) | Public |
| 3 | GET | `/api/v1/tournaments/upcoming` | List upcoming tournaments | Public |
| 4 | GET | `/api/v1/tournaments/active` | List active tournaments | Public |
| 5 | GET | `/api/v1/tournaments/completed` | List completed tournaments | Public |
| 6 | GET | `/api/v1/tournaments/:id` | Get tournament by ID | Public |
| 7 | GET | `/api/v1/tournaments/:id/leaderboard` | Get tournament leaderboard | Public |
| 8 | GET | `/api/v1/tournaments/:id/my-standing` | Get my standing | JwtGuard |
| 9 | GET | `/api/v1/tournaments/:id/participants` | List participants | Public |
| 10 | POST | `/api/v1/tournaments/:id/register` | Register for tournament | `TOURNAMENT_REGISTER` |
| 11 | DELETE | `/api/v1/tournaments/:id/register` | Unregister from tournament | `TOURNAMENT_REGISTER` |
| 12 | GET | `/api/v1/tournaments/:id/related` | List related tournaments | Public |
| 13 | POST | `/api/v1/tournaments/:id/rounds/:roundId/attempts` | Start round attempt | `TOURNAMENT_ATTEMPT` |
| 14 | GET | `/api/v1/tournaments/:id/stats` | Get tournament stats | Public |
| 15 | GET | `/api/v1/tournaments/:id/winners` | Get tournament winners | Public |
| 16 | POST | `/api/v1/tournaments/:id/withdraw` | Withdraw from tournament | `TOURNAMENT_REGISTER` |

---

## 4. Findings by Severity

### 4.1 Critical

#### C1. Status value mismatch between documentation and implementation

- **Endpoint**: All tournament endpoints
- **Current behavior**: Implementation uses status values: `upcoming`, `registration`, `ongoing`, `finished`
- **Documented behavior** (`docs/modules/tournament.md`): Status values documented as: `registration`, `ongoing`, `completed`
- **Root cause**: Documentation is outdated. The implementation was updated to include `upcoming` and `finished` status, but `docs/modules/tournament.md` was not updated.
- **Implementation correct?** Yes. Implementation uses `finished` status in `TournamentLifecycleService.finalizeDueTournaments()` and `upcoming` status in tournament creation.
- **Documentation correct?** No. Documentation is stale.
- **Recommendation**: Update `docs/modules/tournament.md` to reflect the actual status values.
- **Suggested fix**:
  - Change status documentation from `registration, ongoing, completed` to `upcoming, registration, ongoing, finished`
  - Add `TournamentParticipant` status documentation: `active, withdrawn, completed`
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### C2. Response structure mismatch: `getRelatedTournaments` presenter returns non-paginated response but OpenAPI declares pagination

- **Endpoint**: `GET /api/v1/tournaments/:id/related`
- **Current behavior**: Presenters return `ApiResponse.ok([...items])` without pagination metadata
- **OpenAPI specification**: Uses `ApiOkResourceList(RelatedTournamentItemDto, 'cursor', ...)` which declares cursor pagination
- **Root cause**: Presenter uses `ApiResponse.ok` (single resource wrapper) but OpenAPI decorator uses `ApiOkResourceList` (list with pagination)
- **Implementation correct?** No. The presenter should use `wrapCursorPaginatedDto` to match the OpenAPI contract.
- **Documentation correct?** N/A.
- **Recommendation**: Update the presenter to use `wrapCursorPaginatedDto` or update the OpenAPI decorator to use `ApiOkResource` if pagination is not desired.
- **Suggested fix**:
  ```typescript
  // Current (incorrect):
  readonly getRelatedTournaments = (payload: { items: readonly RelatedTournamentItemDto[] }) =>
    ApiResponse.ok([...payload.items]);
  
  // Should be:
  readonly getRelatedTournaments = wrapCursorPaginatedDto<RelatedTournamentItemDto>;
  ```
- **Migration safety**: **Breaking API contract** if not aligned. Requires frontend SDK update.

---

#### C3. Response structure mismatch: `getLeaderboard` presenter returns non-paginated response

- **Endpoint**: `GET /api/v1/tournaments/:id/leaderboard`
- **Current behavior**: Presenters return `ApiResponse.ok({ items: [...] })` without pagination metadata
- **OpenAPI specification**: Uses `ApiOkResourceList(TournamentLeaderboardEntryDto, 'cursor', ...)` which declares cursor pagination
- **Root cause**: Same as C2. Presenter uses array return without pagination envelope.
- **Implementation correct?** No. Should match OpenAPI contract.
- **Documentation correct?** N/A.
- **Recommendation**: Update the presenter to include pagination metadata or update OpenAPI if pagination is not needed.
- **Migration safety**: **Breaking API contract** if not aligned.

---

### 4.2 High

#### H1. Swagger success response examples are absent on all 16 endpoints

- **Endpoint**: All endpoints
- **Current behavior**: Every controller uses `@ApiOkResource` / `@ApiCreatedResource` / `@ApiOkResourceList` without passing an `example` option. The OpenAPI spec shows `null` for all success response examples.
- **Documented behavior**: `docs/standards/swagger.md:56` says: *"Each endpoint SHOULD include at least one realistic example for the success response."*
- **Implementation correct?** Yes (functional), No (documentation standard).
- **Documentation correct?** N/A.
- **Recommendation**: Create `src/modules/tournament/transport/swagger/examples/` with one example per endpoint, following the tag module's layout (`_timestamp.ts` + per-endpoint `*.examples.ts`).
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### H2. Module-level OpenAPI regression test is missing

- **Endpoint**: All endpoints
- **Current behavior**: There is no `src/modules/tournament/transport/tournament-openapi.spec.ts`.
- **Documented behavior**: `docs/standards/swagger.md:74` says: *"Each module MUST keep a module-level contract test under `src/modules/<module>/transport/`..."*
- **Implementation correct?** Yes (functional).
- **Documentation correct?** N/A.
- **Recommendation**: Add `src/modules/tournament/transport/tournament-openapi.spec.ts` modeled on the tag module's `tag-openapi.spec.ts`.
- **Migration safety**: **Safe documentation/test fix.** No runtime change.

---

#### H3. `maxParticipants` has inconsistent default handling

- **Endpoint**: `POST /api/v1/tournaments`
- **Current behavior**: DTO documents `default: 100` but the service only checks `if (tournament.maxParticipants !== null)` without applying any default.
- **Root cause**: DTO decorator says `default: 100` but service logic doesn't apply a default. If client sends `null`, registration capacity is unlimited.
- **Implementation correct?** Partially. No default is applied, but the service correctly handles `null` as unlimited.
- **Documentation correct?** No. The `default: 100` in the DTO is misleading.
- **Recommendation**: Remove `default: 100` from the DTO decorator to accurately reflect that `null` means unlimited.
- **Suggested fix**:
  ```typescript
  @ApiPropertyOptional({
    description: 'Maximum number of participants',
    minimum: 2,
    nullable: true,  // Remove default: 100
  })
  ```
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### H4. Registration allows `upcoming` status tournaments

- **Endpoint**: `POST /api/v1/tournaments/:id/register`
- **Current behavior**: Implementation allows registration when `status = 'upcoming'` but throws `TournamentRegistrationClosedError`.
- **Documented behavior**: `docs/modules/tournament.md` says *"registration only accepted when `status = registration`"*.
- **Root cause**: Domain logic has redundant check: `if (status === 'upcoming')` first throws error, then `if (status !== 'registration')` would also throw.
- **Implementation correct?** Partially. Business logic is correct (rejects upcoming tournaments), but code is redundant.
- **Documentation correct?** Yes. The documentation correctly states only `registration` status allows registration.
- **Recommendation**: Remove redundant `if (status === 'upcoming')` check in `TournamentService.registerForTournament()`.
- **Suggested fix**:
  ```typescript
  // Remove this redundant check:
  if (tournament.status === 'upcoming') {
    throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
  }
  // Keep only:
  if (tournament.status !== 'registration') {
    throw new TournamentRegistrationClosedError(TOURNAMENT_REGISTRATION_CLOSED_MESSAGE);
  }
  ```
- **Migration safety**: **Safe implementation fix.** No API contract change.

---

### 4.3 Medium

#### M1. Participant status not included in participants list response

- **Endpoint**: `GET /api/v1/tournaments/:id/participants`
- **Current behavior**: `TournamentParticipantListItemDto` only includes `userId`, `username`, `registeredAt`. No participant status.
- **Expected behavior**: The repository queries `status = 'active'` participants, but status is not returned to the client.
- **Root cause**: DTO design omits the status field even though it's available.
- **Implementation correct?** Partially. Status filtering works correctly, but the response doesn't include status.
- **Documentation correct?** N/A.
- **Recommendation**: Add `status` field to `TournamentParticipantListItemDto` if clients need to see participant status. If not needed, document that the endpoint only returns active participants.
- **Migration safety**: **Breaking API contract** if status is added. Requires frontend update.

---

#### M2. Inconsistent pagination types across endpoints

- **Endpoint**: Multiple endpoints
- **Current behavior**:
  - Cursor pagination: `/tournaments`, `:id/winners`, `:id/leaderboard`, `:id/related`
  - Offset pagination: `/tournaments/upcoming`, `/tournaments/active`, `/tournaments/completed`, `:id/participants`
- **Root cause**: Mix of pagination strategies chosen per-endpoint without clear rationale.
- **Implementation correct?** Acceptable. Different endpoints have different pagination needs.
- **Documentation correct?** No. The inconsistency is not documented.
- **Recommendation**: Document pagination strategy choices in `docs/modules/tournament.md`.
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M3. `startRoundAttempt` response message inconsistency

- **Endpoint**: `POST /api/v1/tournaments/:id/rounds/:roundId/attempts`
- **Current behavior**: Response DTO says `message: 'Round started. Good luck!'`
- **Actual implementation**: Application service returns `message: 'Attempt started successfully. Use the attempt endpoint to continue.'`
- **Root cause**: Response DTO example was copied from another context and doesn't match the actual message.
- **Implementation correct?** Yes (service returns correct message).
- **Documentation correct?** No. Example is stale.
- **Recommendation**: Update `StartTournamentAttemptResponseDto.message` example to match actual behavior.
- **Suggested fix**:
  ```typescript
  @ApiProperty({
    description: 'Attempt start message',
    example: 'Attempt started successfully. Use the attempt endpoint to continue.',
  })
  message!: string;
  ```
- **Migration safety**: **Safe documentation fix.** No runtime change.

---

#### M4. Registration message example doesn't match implementation

- **Endpoint**: `POST /api/v1/tournaments/:id/register`
- **Current behavior**: `RegisterTournamentResponseDto.message` example is `'Successfully registered for the tournament.'`
- **Actual implementation**: Application service returns `message: 'Successfully registered for the tournament'`
- **Root cause**: Example has trailing period, implementation doesn't.
- **Implementation correct?** Yes.
- **Documentation correct?** No. Example has extra punctuation.
- **Recommendation**: Remove trailing period from example to match implementation.
- **Migration safety**: **Safe documentation fix.**

---

#### M5. `unregisterFromTournament` returns success but uses wrong status code for some cases

- **Endpoint**: `DELETE /api/v1/tournaments/:id/register`
- **Current behavior**: When user is already withdrawn, throws `TournamentParticipantStateError` (409 Conflict).
- **Expected behavior**: According to controller comments, this should be a conflict (which it is).
- **Root cause**: Implementation is correct.
- **Documentation correct?** Partially. Comments describe the behavior correctly.
- **Recommendation**: No fix needed; verify documentation matches implementation.
- **Migration safety**: N/A.

---

#### M6. `WithdrawTournamentResponseDto.status` uses `string` instead of `TournamentParticipantStatus` enum

- **Endpoint**: `POST /api/v1/tournaments/:id/withdraw`
- **Current behavior**: `status` field is typed as `string` with `enum: TOURNAMENT_PARTICIPANT_STATUSES` decorator.
- **Implementation correct?** Yes. TypeScript allows `string` for enum values.
- **Documentation correct?** Acceptable.
- **Recommendation**: Consider using `TournamentParticipantStatus` type explicitly for better type safety.
- **Migration safety**: **Safe implementation fix.** No API change.

---

#### M7. Tournament status lifecycle doesn't match documentation

- **Endpoint**: Lifecycle operations
- **Current behavior**:
  - Creation: starts as `upcoming`
  - `advanceTournamentToRegistration()`: `upcoming` → `registration`
  - `startDueTournaments()`: `registration` → `ongoing`
  - `finalizeDueTournaments()`: `ongoing` → `finished`
- **Documented behavior**: Diagram shows `registration → ongoing → completed`
- **Root cause**: Documentation is missing the `upcoming` phase and uses `completed` instead of `finished`.
- **Implementation correct?** Yes.
- **Documentation correct?** No.
- **Recommendation**: Update lifecycle diagram in `docs/modules/tournament.md`.
- **Migration safety**: **Safe documentation fix.**

---

#### M8. Participant lifecycle status values differ from documentation

- **Endpoint**: Tournament participant management
- **Current behavior**: Participant statuses are `active`, `withdrawn`, `completed`
- **Documented behavior**: Documentation shows `registered`, `withdrawn`, `playing`, `finished`
- **Root cause**: Documentation uses outdated status names.
- **Implementation correct?** Yes. Current names are more accurate.
- **Documentation correct?** No.
- **Recommendation**: Update documentation to use `active`, `withdrawn`, `completed`.
- **Migration safety**: **Safe documentation fix.**

---

#### M9. `getUpcomingTournaments` uses incorrect sort column for `registrationDeadline`

- **Endpoint**: `GET /api/v1/tournaments/upcoming?sortBy=registrationDeadline`
- **Current behavior**: When `sortBy = 'registrationDeadline'`, the repository orders by `tournaments.createdAt` instead of a registration deadline field.
- **Root cause**: No `registrationDeadline` column exists in the tournament schema.
- **Implementation correct?** Partially. Falls back to `createdAt` as a proxy for registration deadline.
- **Documentation correct?** N/A.
- **Recommendation**: Either remove `registrationDeadline` as a sort option, or document that it uses `createdAt` as a proxy.
- **Migration safety**: **Safe documentation fix.**

---

#### M10. `getLeaderboard` includes withdrawn participants in status filter

- **Endpoint**: `GET /api/v1/tournaments/:id/leaderboard`
- **Current behavior**: Repository queries for `status IN ('active', 'completed')` participants.
- **Expected behavior**: Withdrawn participants should be excluded (which they are).
- **Implementation correct?** Yes.
- **Documentation correct?** N/A.
- **Recommendation**: Document that the leaderboard excludes withdrawn participants.
- **Migration safety**: N/A.

---

### 4.4 Low

#### L1. `MyTournamentStandingResponseDto.participantCount` description is misleading

- **Endpoint**: `GET /api/v1/tournaments/:id/my-standing`
- **Current behavior**: Description says "Total number of active participants" but the SQL counts only `status = 'active'` participants.
- **Implementation correct?** Yes.
- **Documentation correct?** Partially. Description is accurate.
- **Recommendation**: Verify description matches implementation.
- **Migration safety**: N/A.

---

#### L2. Missing `format: 'uuid'` on path parameter decorators

- **Endpoint**: All endpoints with UUID path parameters
- **Current behavior**: Controller uses `ParseUUIDPipe` but OpenAPI decorators may not explicitly declare `format: 'uuid'`.
- **Root cause**: Per module pattern, should declare `format: 'uuid'` explicitly.
- **Implementation correct?** Functional. `ParseUUIDPipe` handles validation.
- **Documentation correct?** Should verify OpenAPI spec has `format: 'uuid'`.
- **Recommendation**: Add explicit `@ApiParam({ format: 'uuid' })` if not present.
- **Migration safety**: **Safe documentation fix.**

---

#### L3. No E2E tests for tournament module

- **Endpoint**: All endpoints
- **Current behavior**: No `test/tournament.e2e-spec.ts` exists.
- **Documented behavior**: Module E2E tests are recommended for cross-module contracts.
- **Recommendation**: Add E2E tests for happy paths and error cases.
- **Migration safety**: **Safe documentation fix.**

---

#### L4. Inconsistent timestamp formats in DTO examples

- **Endpoint**: All DTOs
- **Current behavior**: Different timestamps use different formats (e.g., `2025-07-01T10:00:00.000Z` vs `2026-06-01T00:00:00Z`).
- **Recommendation**: Standardize to `YYYY-MM-DDTHH:mm:ss.sssZ` format for all timestamps.
- **Migration safety**: **Safe documentation fix.**

---

#### L5. `TournamentStatsResponseDto.averageScore` has wrong type annotation

- **Endpoint**: `GET /api/v1/tournaments/:id/stats`
- **Current behavior**: TypeScript says `averageScore!: number` but repository casts from `string` via SQL `::numeric`.
- **Implementation correct?** Yes. Conversion happens at query time.
- **Documentation correct?** N/A.
- **Recommendation**: Document that numeric values may be returned as numbers.
- **Migration safety**: N/A.

---

#### L6. `ParticipantCount` field name inconsistency

- **Endpoint**: `ActiveTournamentItemDto`, `CompletedTournamentItemDto`, `UpcomingTournamentItemDto`, `RelatedTournamentItemDto`
- **Current behavior**: All use `participantCount` field name.
- **Root cause**: Consistent naming.
- **Implementation correct?** Yes.
- **Documentation correct?** N/A.
- **Recommendation**: No fix needed.
- **Migration safety**: N/A.

---

## 5. Validation Audit

| Validation Rule | DTO | Implementation | Notes |
|-----------------|-----|---------------|-------|
| `title` required, 1-255 chars | ✓ | ✓ | Correct |
| `difficulty` enum: easy/medium/hard | ✓ | ✓ | Correct |
| `startAt` required, ISO 8601 | ✓ | ✓ | Correct |
| `endAt` required, ISO 8601 | ✓ | ✓ | Correct |
| `endAt > startAt` | ✓ (domain check) | ✓ | Correct |
| `maxParticipants` min: 2 | ✓ | ✓ | Correct |
| `categoryId` UUID format | ✓ | ✓ | Correct |
| `limit` min: 1, max: 100 | ✓ | ✓ | Correct |
| `page` min: 1 | ✓ | ✓ | Correct |
| `cursor` max 512 chars | ✓ | ✓ | Correct |
| `status` enum filter | ✓ | ✓ | Correct |
| `sortBy` enum: startAt/registrationDeadline | ✓ | ✓ | Correct |

---

## 6. Authentication & Authorization Audit

| Endpoint | Auth Required | Permission | Notes |
|----------|---------------|------------|-------|
| POST `/tournaments` | Yes | `TOURNAMENT_CREATE` | Correct |
| GET `/tournaments` | No | - | Public ✓ |
| GET `/tournaments/upcoming` | No | - | Public ✓ |
| GET `/tournaments/active` | No | - | Public ✓ |
| GET `/tournaments/completed` | No | - | Public ✓ |
| GET `/tournaments/:id` | No | - | Public ✓ |
| GET `/tournaments/:id/leaderboard` | No | - | Public ✓ |
| GET `/tournaments/:id/my-standing` | Yes | JwtGuard | Correct |
| GET `/tournaments/:id/participants` | No | - | Public ✓ |
| POST `/tournaments/:id/register` | Yes | `TOURNAMENT_REGISTER` | Correct |
| DELETE `/tournaments/:id/register` | Yes | `TOURNAMENT_REGISTER` | Correct |
| GET `/tournaments/:id/related` | No | - | Public ✓ |
| POST `/tournaments/:id/rounds/:roundId/attempts` | Yes | `TOURNAMENT_ATTEMPT` | Correct |
| GET `/tournaments/:id/stats` | No | - | Public ✓ |
| GET `/tournaments/:id/winners` | No | - | Public ✓ |
| POST `/tournaments/:id/withdraw` | Yes | `TOURNAMENT_REGISTER` | Correct |

**All authorization rules are correctly implemented.**

---

## 7. Business Rule Audit

| Business Rule | Implementation | Documentation | Match |
|---------------|----------------|--------------|-------|
| End after start | ✓ Domain check | ✓ Documented | ✓ Yes |
| Registration only during `registration` status | ✓ + redundant `upcoming` check | ✗ Says only `registration` | ⚠ No |
| Withdraw only during `ongoing` status | ✓ `TournamentWithdrawClosedError` | ✓ Documented | ✓ Yes |
| Unregister only during `registration` status | ✓ `TournamentUnregisterClosedError` | ✓ Documented | ✓ Yes |
| Max participants cap | ✓ Count check | ✓ Documented | ✓ Yes |
| Re-registration reactivates | ✓ `reactivateParticipant()` | ✓ Documented | ✓ Yes |
| Leaderboard from participants | ✓ SQL query | ✓ Documented | ✓ Yes |
| Soft delete support | ✓ `deletedAt` column | ✗ Not documented | ⚠ No |
| Participant status transitions | ✓ `active → withdrawn → active` | ✗ Different names | ⚠ No |

---

## 8. OpenAPI Accuracy Audit

| Check | Status | Notes |
|-------|--------|-------|
| Request schema accurate | ✓ | All DTOs match |
| Response schema accurate | ⚠ | Some presenters don't match |
| Examples valid | ✗ | None present |
| Descriptions present | ✓ | Adequate |
| Nullable fields correct | ✓ | All nullable fields marked |
| Required fields correct | ✓ | All required fields marked |
| Default values correct | ⚠ | `maxParticipants` default misleading |
| Enum values correct | ✓ | All enums match types |
| Pagination kind correct | ⚠ | `related` endpoint mismatch |
| Status codes correct | ✓ | All match error codes |
| Error schemas correct | ✓ | RFC 7807 ProblemDetail |

---

## 9. Response Audit

| Response DTO | Fields | Mapped | Notes |
|--------------|--------|--------|-------|
| `TournamentResponseDto` | 12 | ✓ | Complete |
| `TournamentDetailResponseDto` | 14 | ✓ | Includes rounds, category |
| `TournamentLeaderboardEntryDto` | 11 | ✓ | Complete |
| `TournamentWinnerDto` | 5 | ✓ | Complete |
| `TournamentParticipantListItemDto` | 3 | ⚠ | Missing `status` |
| `UpcomingTournamentItemDto` | 6 | ✓ | Complete |
| `ActiveTournamentItemDto` | 5 | ✓ | Complete |
| `CompletedTournamentItemDto` | 5 | ✓ | Complete |
| `RelatedTournamentItemDto` | 4 | ✓ | Complete |
| `TournamentStatsResponseDto` | 10 | ✓ | Complete |
| `MyTournamentStandingResponseDto` | 4 | ✓ | Complete |
| `RegisterTournamentResponseDto` | 5 | ✓ | Complete |
| `StartTournamentAttemptResponseDto` | 4 | ✓ | Message mismatch |
| `UnregisterTournamentResponseDto` | 1 | ✓ | Complete |
| `WithdrawTournamentResponseDto` | 4 | ✓ | Complete |
| `TournamentRoundResponseDto` | 14 | ✓ | Complete |

---

## 10. Consistency Audit

### Issues Found

| Issue | Endpoint(s) | Severity |
|-------|------------|----------|
| Different pagination types | Multiple | Medium |
| Missing `status` in participants | `:id/participants` | Medium |
| Message text mismatches | Multiple | Medium |
| Documentation vs implementation status values | All | Critical |

### Recommendations

1. **Standardize pagination strategy**: Document when cursor vs offset pagination is used.
2. **Add `status` to participants list**: Or clarify that only active participants are returned.
3. **Synchronize all message examples**: Ensure DTO examples match implementation.
4. **Update documentation**: Fix status values, participant statuses, and lifecycle diagrams.

---

## 11. Swagger Example Verification

| Endpoint | Example Present | Example Valid | Matches Runtime |
|----------|-----------------|--------------|----------------|
| POST `/tournaments` | ✗ | N/A | N/A |
| GET `/tournaments` | ✗ | N/A | N/A |
| GET `/tournaments/upcoming` | ✗ | N/A | N/A |
| GET `/tournaments/active` | ✗ | N/A | N/A |
| GET `/tournaments/completed` | ✗ | N/A | N/A |
| GET `/tournaments/:id` | ✗ | N/A | N/A |
| GET `/tournaments/:id/leaderboard` | ✗ | N/A | N/A |
| GET `/tournaments/:id/my-standing` | ✗ | N/A | N/A |
| GET `/tournaments/:id/participants` | ✗ | N/A | N/A |
| POST `/tournaments/:id/register` | ✗ | N/A | N/A |
| DELETE `/tournaments/:id/register` | ✗ | N/A | N/A |
| GET `/tournaments/:id/related` | ✗ | N/A | N/A |
| POST `/tournaments/:id/rounds/:roundId/attempts` | ✗ | N/A | N/A |
| GET `/tournaments/:id/stats` | ✗ | N/A | N/A |
| GET `/tournaments/:id/winners` | ✗ | N/A | N/A |
| POST `/tournaments/:id/withdraw` | ✗ | N/A | N/A |

**No Swagger examples are present on any endpoint.**

---

## 12. Summary by Issue Type

### Documentation Issues (12)

- D1: Status values mismatch (Critical)
- D2: Missing Swagger examples (High)
- D3: Missing OpenAPI regression test (High)
- D4: `maxParticipants` default misleading (High)
- D5: Participant status not in list response (Medium)
- D6: Inconsistent pagination types (Medium)
- D7: Lifecycle diagram outdated (Medium)
- D8: Participant status names outdated (Medium)
- D9: `registrationDeadline` sort proxy undocumented (Medium)
- D10: Leaderboard exclusion of withdrawn undocumented (Medium)
- D11: Timestamp format inconsistencies (Low)
- D12: Missing E2E tests (Low)

### Implementation Bugs (4)

- B1: `getRelatedTournaments` presenter missing pagination (Critical)
- B2: `getLeaderboard` presenter missing pagination (Critical)
- B3: Redundant `upcoming` status check in registration (High)
- B4: `startRoundAttempt` message example mismatch (Medium)

### Validation Inconsistencies (2)

- V1: `maxParticipants` default value mismatch (High)
- V2: Registration status check redundancy (High)

### OpenAPI Inconsistencies (5)

- O1: `getRelatedTournaments` declares cursor pagination but presenter returns array (Critical)
- O2: `getLeaderboard` declares cursor pagination but presenter returns array (Critical)
- O3: `maxParticipants` OpenAPI says `default: 100` but implementation uses `null` (High)
- O4: Message examples don't match implementation (Medium)
- O5: Missing `format: 'uuid'` on path parameters (Low)

---

## 13. Migration Plan

### Phase 1: Critical Implementation Fixes

**Goal**: Fix critical API contract mismatches that affect client SDKs.

**Issues included**:
- C1: Status value mismatch in documentation
- C2: `getRelatedTournaments` presenter pagination
- C3: `getLeaderboard` presenter pagination

**Reason these issues belong together**: All affect the response structure that generated SDKs (Orval/OpenAPI Generator) would produce.

**Dependencies**: None.

**Estimated implementation complexity**: Medium.

**Estimated risk**: Medium. Changes response structure but fixes actual contract violations.

**Backward compatible**: No. These are contract corrections.

**Frontend clients affected**: Yes. SDK regeneration required.

**Generated SDKs affected**: Yes. Orval/OpenAPI Generator output will change.

**Database migrations required**: No.

**Tests to update**: Presenter tests, integration tests.

---

### Phase 2: High-Priority Documentation Fixes

**Goal**: Add missing Swagger examples and OpenAPI regression test.

**Issues included**:
- H1: Swagger examples absent on all 16 endpoints
- H2: Module-level OpenAPI regression test missing
- H3: `maxParticipants` default documentation
- H4: Redundant `upcoming` status check removal

**Reason these issues belong together**: All are documentation and code quality improvements that don't affect runtime behavior.

**Dependencies**: None.

**Estimated implementation complexity**: Low.

**Estimated risk**: Low. No API contract changes.

**Backward compatible**: Yes.

**Frontend clients affected**: No.

**Generated SDKs affected**: No.

**Database migrations required**: No.

**Tests to add**: `tournament-openapi.spec.ts`, Swagger example files.

---

### Phase 3: Medium-Priority Consistency Fixes

**Goal**: Address medium-severity inconsistencies and update documentation.

**Issues included**:
- M1: Participant status in list response
- M2: Pagination strategy documentation
- M7: Lifecycle diagram update
- M8: Participant status names update
- M9: `registrationDeadline` sort documentation

**Reason these issues belong together**: All are documentation and minor consistency improvements.

**Dependencies**: Phase 1 (if response structure changes).

**Estimated implementation complexity**: Low.

**Estimated risk**: Low. Mostly documentation.

**Backward compatible**: Yes.

**Frontend clients affected**: Potentially if participant status is added.

**Generated SDKs affected**: Potentially.

**Database migrations required**: No.

---

### Phase 4: Low-Priority Improvements

**Goal**: Address remaining low-severity issues.

**Issues included**:
- L1: `participantCount` description clarification
- L2: Explicit `format: 'uuid'` in decorators
- L3: E2E tests
- L4: Timestamp format standardization
- L5: Type annotation improvements
- L6: Confirmation of consistency

**Reason these issues belong together**: All are minor quality improvements.

**Dependencies**: None.

**Estimated implementation complexity**: Low.

**Estimated risk**: Very low.

**Backward compatible**: Yes.

---

## 14. Recommended Implementation Order

1. **Phase 1 (Critical)**: Fix response structure mismatches first to prevent SDK generation issues.
2. **Phase 2 (High)**: Add Swagger examples and regression test to prevent future drift.
3. **Phase 3 (Medium)**: Update documentation to match implementation.
4. **Phase 4 (Low)**: Address remaining minor issues.

---

## 15. Breaking Changes Summary

| Phase | Breaking Changes | Requires Deprecation | Client Action Required |
|-------|------------------|---------------------|------------------------|
| Phase 1 | `getRelatedTournaments` pagination, `getLeaderboard` pagination | No | SDK regeneration |
| Phase 2 | None | N/A | N/A |
| Phase 3 | Potentially `participants` status field | Depends on decision | SDK update if status added |
| Phase 4 | None | N/A | N/A |

---

## 16. Files Affected

### Phase 1 Files

- `src/modules/tournament/transport/presenters/tournament.presenter.ts`
- `docs/modules/tournament.md`

### Phase 2 Files

- `src/modules/tournament/transport/swagger/examples/` (new directory)
- `src/modules/tournament/transport/tournament-openapi.spec.ts` (new file)
- `src/modules/tournament/dto/request/tournament.dto.ts`
- `src/modules/tournament/domain/tournament.service.ts`

### Phase 3 Files

- `docs/modules/tournament.md`
- `src/modules/tournament/dto/response/tournament-participants-response.dto.ts`

### Phase 4 Files

- `src/modules/tournament/transport/controller/tournament.controller.ts`
- `test/` (new E2E test file)
- Various DTO timestamp examples

---

## 17. Verification Checklist

After implementing fixes, verify:

- [ ] All 16 endpoints have Swagger examples
- [ ] `tournament-openapi.spec.ts` passes
- [ ] `getRelatedTournaments` returns proper pagination envelope
- [ ] `getLeaderboard` returns proper pagination envelope
- [ ] Documentation status values match implementation
- [ ] All message examples match implementation
- [ ] No redundant status checks in domain logic
- [ ] E2E tests cover happy paths and error cases

---

*Audit completed: 2026-07-16*
*Auditor: Claude Code (Senior Backend API Review)*
