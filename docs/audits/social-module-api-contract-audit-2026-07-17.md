# Social Module — API Contract Audit

| Field | Value |
| ----- | ----- |
| Module | `social` (OpenAPI tag: `social`) |
| Audit date | 2026-07-17 |
| Auditor mode | Read-only (no code, no DTO, no OpenAPI artifact was modified) |
| Endpoints audited | 30 |
| Source-of-truth | `docs/PROJECT_CONSTITUTION.md` § Authority hierarchy |

## Authority Hierarchy

Per `PROJECT_CONSTITUTION.md` § Authority Hierarchy, when documentation and code disagree:

1. Implementation (runtime behavior)
2. Tests
3. OpenAPI artifact (`docs/generated/openapi.json`)
4. Generated SDK (Orval / openapi-generator)
5. `docs/` and `README.md`

Every issue below is classified against this hierarchy.

---

## Final Summary

| Metric | Value |
| ------ | ----- |
| Contract health score | **6.5 / 10** |
| Endpoints audited | 30 |
| Total issues | 12 |
| Critical / High / Medium / Low | 1 / 3 / 4 / 4 |
| Implementation bugs | 1 |
| Documentation issues | 11 |
| Validation inconsistencies | 1 |
| OpenAPI inconsistencies | 6 |
| Swagger example issues | 2 |

> **Headline**: One Critical runtime bug (trending 500s due to SQL query alias error), multiple OpenAPI parameter optionality mismatches, missing security declarations for some endpoints, and inconsistent response structures across endpoints.

---

## Severity Breakdown

| Severity | Count |
| -------- | ----- |
| Critical | 1 |
| High | 3 |
| Medium | 4 |
| Low | 4 |

---

## Issue Index

| ID | Severity | Endpoint | Title |
| -- | -------- | -------- | ----- |
| S-01 | Critical | `GET /social/users/trending` | Runtime 500: SQL missing FROM-clause error on valid request |
| S-02 | High | `GET /social/users/search` | OpenAPI declares `limit` as `required: true` but controller defaults it |
| S-03 | High | `GET /social/friends` | OpenAPI declares `cursor` as `required: true` but controller defaults it |
| S-04 | High | `GET /social/users/:userId/followers` | Missing `@ApiProperty` for `UserFollowerItemDto` fields |
| S-05 | Medium | `GET /social/friend-requests/incoming` | OpenAPI response shows paginated but runtime returns non-paginated array |
| S-06 | Medium | `GET /social/friend-requests/outgoing` | OpenAPI response shows paginated but runtime returns non-paginated array |
| S-07 | Medium | `POST /social/friend-requests/:friendshipId/respond` | Request body `{ accept: boolean }` not documented in OpenAPI |
| S-08 | Medium | `POST /social/block/:userId` | Request body `{ reason?: string }` not documented in OpenAPI |
| S-09 | Low | `GET /social/users/:userId/mutual-friends` | `MutualFriendItemDto` not exported from module |
| S-10 | Low | `GET /social/users/:userId/mutual-followers` | `MutualFollowerItemDto` not exported from module |
| S-11 | Low | `POST /social/friend-request/:userId` | `FriendRequestDto` missing `addresseeId` field in response |
| S-12 | Low | `GET /social/search/suggestions` | Public endpoint but some authenticated endpoints missing security declaration |

---

## Endpoint-by-Endpoint Findings

### S-01 · Critical · `GET /social/users/trending`

**Current behavior**
500 Internal Server Error: `missing FROM-clause entry for table "user_profiles"`

**Root cause**
In `social.repository.ts` line 1266, the query uses:
```typescript
LEFT JOIN userProfiles up ON up.userProfiles.userId = u.users.userId
```
The table alias `userProfiles` (the variable name from the schema import) does not match the actual table name `user_profiles`. The correct alias should be `up.user_profiles.user_id`, not `up.userProfiles.userId`.

**Implementation correct?** No.
**Documentation correct?** N/A (implementation bug).
**Recommendation** Fix the JOIN alias to match the actual column names.
**Suggested fix**
```typescript
// Change from:
LEFT JOIN userProfiles up ON up.userProfiles.userId = u.users.userId

// To:
LEFT JOIN userProfiles up ON up.user_profiles.user_id = u.users.user_id
```
**Safety classification** Safe implementation fix. No contract change.

---

### S-02 · High · `GET /social/users/search`

**Current behavior**
OpenAPI declares `limit` as `{ "required": true }` in the query parameters.

**Expected behavior**
Per the controller implementation, `limit` should be `{ "required": false }` with a default value of 20:
```typescript
@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
```

**Root cause**
Controller uses `DefaultValuePipe` to provide a default, but the OpenAPI generator does not pick this up automatically. The `@DefaultValuePipe` is a NestJS runtime decorator that doesn't automatically translate to OpenAPI's `required: false` and `default: value`.

**Implementation correct?** Yes (runtime works correctly with defaults).
**Documentation correct?** No.
**Recommendation** Add explicit OpenAPI schema options to the `@Query` parameter or use a DTO class with proper decorators.
**Suggested fix**
Either:
1. Create a `SearchUsersQueryDto` class with proper `@ApiPropertyOptional` decorators, OR
2. Add explicit `@ApiQuery` decorator with `required: false` and `schema: { default: 20 }`

**Safety classification** Safe documentation fix. No runtime change.

---

### S-03 · High · `GET /social/friends`

**Current behavior**
OpenAPI declares `cursor` as `{ "required": true }` in the query parameters.

**Expected behavior**
Per the controller implementation, `cursor` should be optional with a default of `null`:
```typescript
@Query('cursor') cursor?: string,
```

**Root cause**
Same as S-02 — `DefaultValuePipe` not reflected in OpenAPI.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Add `@ApiQuery` decorator or use DTO with proper optionality.
**Suggested fix**
```typescript
@ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } })
@Query('cursor') cursor?: string,
```

**Safety classification** Safe documentation fix. No runtime change.

---

### S-04 · High · `GET /social/users/:userId/followers`

**Current behavior**
OpenAPI generates schema for `UserFollowerItemDto` but the DTO is not properly exported or referenced in the module's response DTOs.

**Expected behavior**
The `UserFollowerItemDto` should be properly exported and used consistently.

**Root cause**
`UserFollowerItemDto` is not included in the module's `dto/response/index.ts` barrel export.

**Implementation correct?** Partially (DTO exists but not exported).
**Documentation correct?** No.
**Recommendation** Export `UserFollowerItemDto` from the module's response DTOs.

**Safety classification** Safe documentation fix.

---

### S-05 · Medium · `GET /social/friend-requests/incoming`

**Current behavior**
OpenAPI declares this as `WrappedPaginatedDto` (cursor-paginated), showing pagination metadata in the schema.

**Runtime behavior**
Returns a non-paginated array wrapped in `WrappedDto`:
```json
{
  "data": [...],  // Array, not paginated
  "meta": { "timestamp": "..." }
}
```

**Root cause**
The presenter `getPendingRequests` returns `ApiResponse.ok(payload)` which is a single-wrap, not `ApiResponse.page`. The application service returns a plain array `FriendRequest[]`, not a `PaginatedResult`.

**Implementation correct?** Yes (returns non-paginated as designed).
**Documentation correct?** No (OpenAPI says paginated but runtime is not).
**Recommendation** Update OpenAPI decorator to use `ApiOkResource` instead of `ApiOkResourceList`.

**Safety classification** Safe documentation fix. No runtime change.

---

### S-06 · Medium · `GET /social/friend-requests/outgoing`

**Current behavior**
Same as S-05 — OpenAPI says paginated but runtime returns non-paginated array.

**Root cause**
Same as S-05 — presenter uses `ApiResponse.ok` not `ApiResponse.page`.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Update OpenAPI decorator to use `ApiOkResource` instead of `ApiOkResourceList`.

**Safety classification** Safe documentation fix.

---

### S-07 · Medium · `POST /social/friend-requests/:friendshipId/respond`

**Current behavior**
Request body is an inline object `{ accept: boolean }` with no OpenAPI documentation.

**Root cause**
Controller uses inline `@Body() body: { accept: boolean }` instead of a proper DTO class.

**Implementation correct?** Yes (works at runtime).
**Documentation correct?** No.
**Recommendation** Create a `RespondFriendRequestDto` class with proper Swagger decorators.
**Suggested fix**
```typescript
export class RespondFriendRequestDto {
  @ApiProperty({ description: 'Whether to accept the friend request', example: true })
  @IsBoolean()
  accept!: boolean;
}
```

**Safety classification** Safe documentation fix.

---

### S-08 · Medium · `POST /social/block/:userId`

**Current behavior**
Request body is an inline object `{ reason?: string }` with no OpenAPI documentation.

**Root cause**
Same as S-07 — inline body without proper DTO.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Create a `BlockUserDto` class with proper Swagger decorators.
**Suggested fix**
```typescript
export class BlockUserDto {
  @ApiPropertyOptional({ description: 'Reason for blocking', example: 'Harassment', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

**Safety classification** Safe documentation fix.

---

### S-09 · Low · `GET /social/users/:userId/mutual-friends`

**Current behavior**
`MutualFriendItemDto` is not exported from the module's response DTOs barrel.

**Root cause**
Missing export in `dto/response/index.ts`.

**Implementation correct?** Yes.
**Documentation correct?** Partially.
**Recommendation** Add `MutualFriendItemDto` to the barrel export.

**Safety classification** Safe documentation fix.

---

### S-10 · Low · `GET /social/users/:userId/mutual-followers`

**Current behavior**
`MutualFollowerItemDto` is not exported from the module's response DTOs barrel.

**Root cause**
Missing export in `dto/response/index.ts`.

**Implementation correct?** Yes.
**Documentation correct?** Partially.
**Recommendation** Add `MutualFollowerItemDto` to the barrel export.

**Safety classification** Safe documentation fix.

---

### S-11 · Low · `POST /social/friend-request/:userId`

**Current behavior**
Response `FriendRequestDto` is missing the `addresseeId` field.

**Expected behavior**
The response should include `addresseeId` since the endpoint is about sending a request TO someone.

**Root cause**
DTO definition is incomplete. The `FriendRequest` domain type includes `addresseeId` in the friendships table, but `FriendRequestDto` doesn't include it.

**Implementation correct?** Partially (runtime works but response is incomplete).
**Documentation correct?** No.
**Recommendation** Add `addresseeId` field to `FriendRequestDto`.

**Safety classification** Safe implementation + documentation fix. Adds field to response (additive change).

---

### S-12 · Low · Various authenticated endpoints

**Current behavior**
Some authenticated endpoints are missing the `security` declaration in OpenAPI.

**Expected behavior**
All authenticated endpoints should have `security: [{ BearerAuth: [] }]`.

**Root cause**
The `@ApiAuthAction` decorator should add security declarations, but some endpoints may not be using it consistently.

**Implementation correct?** Yes (runtime requires auth).
**Documentation correct?** No.
**Recommendation** Ensure all authenticated endpoints have proper security declarations.

**Safety classification** Safe documentation fix.

---

## Response DTO / Serialization Audit

### TrendingUserResponseDto — FAILS

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `userId` | UUID | No | Correct |
| `username` | string | No | Correct |
| `avatarUrl` | string | Yes | Correct |
| `followers` | number | No | Correct |
| `trendScore` | number | No | Correct |
| `trendReason` | enum | No | Correct |

**Issue**: Runtime has additional fields `weeklyRankTrend` and `monthlyRankTrend` (from `TrendingUser` type) that are not in the DTO.

### SocialFeedItemDto — PASSES (with notes)

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `id` | UUID | No | Correct |
| `type` | enum | No | Correct |
| `occurredAt` | ISO8601 | No | Correct |
| `user` | object | No | Correct |
| `payload` | object | No | Correct |

### FriendDto — PASSES

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `friendshipId` | UUID | No | Correct |
| `userId` | UUID | No | Correct |
| `username` | string | No | Correct |
| `displayName` | string | Yes | Correct |
| `avatarUrl` | string | Yes | Correct |
| `friendSince` | ISO8601 | No | Correct |

### FriendRequestDto — PARTIAL FAIL

**Missing**: `addresseeId` field (Issue S-11)

### SearchableUserDto — PASSES

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `userId` | UUID | No | Correct |
| `username` | string | No | Correct |
| `displayName` | string | Yes | Correct |
| `avatarUrl` | string | Yes | Correct |
| `isFriend` | boolean | No | Correct |
| `hasPendingRequest` | boolean | No | Correct |
| `isBlocked` | boolean | No | Correct |

---

## Authentication & Authorization Audit

| Endpoint | Auth Required | Permission | Runtime Auth | Runtime Perm | Match |
| -------- | ------------- | ---------- | ------------ | ------------ | ----- |
| `GET /social/search/suggestions` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /social/users/search` | Yes | None | 401/200 | — | Yes |
| `GET /social/suggestions` | Yes | None | 401/200 | — | Yes |
| `GET /social/feed` | Yes | None | 401/200 | — | Yes |
| `GET /social/me/analytics` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/trending` | No (@Public) | None | 500 (bug) | — | Bug |
| `GET /social/users/:userId/activity` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/:userId/stats` | No (@Public) | None | 200 (public) | — | Yes |
| `GET /social/friends/leaderboard` | Yes | None | 401/200 | — | Yes |
| `POST /social/friend-request/:userId` | Yes | None | 401/201 | — | Yes |
| `GET /social/friend-requests/incoming` | Yes | None | 401/200 | — | Yes |
| `GET /social/friend-requests/outgoing` | Yes | None | 401/200 | — | Yes |
| `POST /social/friend-requests/:friendshipId/respond` | Yes | None | 401/204 | — | Yes |
| `DELETE /social/friend-requests/:friendshipId` | Yes | None | 401/204 | — | Yes |
| `GET /social/friends` | Yes | None | 401/200 | — | Yes |
| `GET /social/friends/:userId` | Yes | None | 401/200 | — | Yes |
| `DELETE /social/friends/:userId` | Yes | None | 401/204 | — | Yes |
| `POST /social/block/:userId` | Yes | None | 401/201 | — | Yes |
| `DELETE /social/block/:userId` | Yes | None | 401/204 | — | Yes |
| `GET /social/blocked` | Yes | None | 401/200 | — | Yes |
| `POST /social/follow/:userId` | Yes | None | 401/204 | — | Yes |
| `DELETE /social/follow/:userId` | Yes | None | 401/204 | — | Yes |
| `GET /social/followers` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/:userId/followers` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/:userId/following` | Yes | None | 401/200 | — | Yes |
| `GET /social/following` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/:userId/mutual-friends` | Yes | None | 401/200 | — | Yes |
| `GET /social/users/:userId/mutual-followers` | Yes | None | 401/200 | — | Yes |
| `GET /social/relationship/:userId` | Yes | None | 401/200 | — | Yes |
| `GET /social/counts` | Yes | None | 401/200 | — | Yes |

**Note**: The 500 on trending is due to the SQL bug (S-01), not an auth issue.

---

## Consistency Audit

### Positive observations

1. **Presenter layer**: `SocialPresenter` follows the canonical pattern — uses `ApiResponse.page` and `ApiResponse.ok` correctly.
2. **Domain events**: Full event bus integration with events for all friend/follow/block actions.
3. **Soft delete**: Repository uses `deletedAt IS NULL` filter for active records.
4. **UUID validation**: All path parameters use `ParseUUIDPipe`.
5. **Error handling**: Uses domain exceptions with proper `ProblemCodeMapping`.
6. **Audit logging**: Block/unblock actions are logged to the audit service.

### Issues found

1. **Trending 500 bug** (S-01): Only endpoint that 500s on valid input.
2. **Query parameter optionality** (S-02, S-03): Inconsistent with other list endpoints.
3. **Pagination inconsistency** (S-05, S-06): Two endpoints are documented as paginated but return non-paginated arrays.
4. **Missing request DTOs** (S-07, S-08): Inconsistent with other modules that use proper DTOs.
5. **Response DTO missing field** (S-11): `FriendRequestDto` incomplete.

---

## Swagger Example Verification

### Positive observations

1. **SocialFeedItemDto example**: Valid activity type enum values.
2. **TrendingUserResponseDto example**: Proper enum values for `trendReason`.
3. **Search suggestions example**: Valid string array example.

### Issues found

1. **Trending users**: Missing `weeklyRankTrend` and `monthlyRankTrend` fields in the response DTO example.
2. **SocialFeedItemDto**: Missing example in OpenAPI schema.

---

## Prioritization & Migration Plan

### Phase 1 — Fix Critical runtime bug (S-01)

| Field | Value |
| ----- | ----- |
| Issues | S-01 |
| Goal | Make trending users endpoint return 200 instead of 500. |
| Reason | Blocking issue that causes 500 errors on a public endpoint. |
| Dependencies | None. |
| Complexity | High (requires SQL fix) |
| Risk | Low (isolated fix) |
| Breaking change? | No |
| Migrations / DB | None. |

### Phase 2 — Fix OpenAPI parameter optionality (S-02, S-03)

| Field | Value |
| ----- | ----- |
| Issues | S-02, S-03 |
| Goal | Make OpenAPI specification match controller defaults. |
| Reason | Fixes generated SDK and client expectations. |
| Dependencies | None. |
| Complexity | Medium |
| Risk | Low |
| Breaking change? | No (adds defaults client-side) |
| Generated SDK | Will need regeneration. |

### Phase 3 — Fix response pagination inconsistencies (S-05, S-06)

| Field | Value |
| ----- | ----- |
| Issues | S-05, S-06 |
| Goal | Make OpenAPI match actual runtime behavior. |
| Reason | Documentation should reflect actual API shape. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No (fixing docs to match runtime) |

### Phase 4 — Add proper request DTOs (S-07, S-08)

| Field | Value |
| ----- | ----- |
| Issues | S-07, S-08 |
| Goal | Document request body shapes properly. |
| Reason | Consistency with other modules. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No |

### Phase 5 — Fix response DTOs (S-04, S-09, S-10, S-11)

| Field | Value |
| ----- | ----- |
| Issues | S-04, S-09, S-10, S-11 |
| Goal | Complete all response DTOs. |
| Reason | API completeness. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | S-11 is additive (adds field) |

### Phase 6 — Security declarations (S-12)

| Field | Value |
| ----- | ----- |
| Issues | S-12 |
| Goal | Ensure all authenticated endpoints declare security. |
| Reason | Documentation completeness. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |

---

## Implementation Strategy

### Phase 1 Details

**S-01 Fix** (Trending endpoint SQL):

The SQL query in `social.repository.ts` uses incorrect column references for the `user_profiles` table in the CTE alias. The fix requires:

1. Change all references from snake_case column names that include the table prefix incorrectly
2. The pattern `up.userProfiles.userId` should be `up.user_profiles.user_id`

```typescript
// In getTrendingUsers method around line 1266:
// Change:
LEFT JOIN userProfiles up ON up.userProfiles.userId = u.users.userId
// To:
LEFT JOIN userProfiles up ON up.user_profiles.user_id = u.users.user_id
```

### Phase 2 Details

**S-02, S-03 Fix** (Query parameter optionality):

Create query DTOs with proper decorators:

```typescript
// Create search-users-query.dto.ts
export class SearchUsersQueryDto {
  @ApiProperty({ description: 'Search query', example: 'john' })
  @IsString()
  q!: string;

  @ApiPropertyOptional({ description: 'Max results', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

For the friends endpoint, add `@ApiQuery` decorator:

```typescript
@ApiQuery({ name: 'cursor', required: false })
@Query('cursor') cursor?: string,
```

---

## Migration Safety Classification

| Fix | Type | Notes |
| --- | ---- | ----- |
| S-01 | Safe implementation fix | Fixes SQL query alias. |
| S-02 | Safe documentation fix | Adds default to OpenAPI. |
| S-03 | Safe documentation fix | Adds optional to OpenAPI. |
| S-04 | Safe documentation fix | Exports missing DTO. |
| S-05 | Safe documentation fix | Fixes OpenAPI to match runtime. |
| S-06 | Safe documentation fix | Fixes OpenAPI to match runtime. |
| S-07 | Safe documentation fix | Adds request body documentation. |
| S-08 | Safe documentation fix | Adds request body documentation. |
| S-09 | Safe documentation fix | Exports missing DTO. |
| S-10 | Safe documentation fix | Exports missing DTO. |
| S-11 | Safe implementation + documentation fix | Adds missing field (additive). |
| S-12 | Safe documentation fix | Adds security declarations. |

---

## Appendix A — Endpoints Inventoried

| # | Method | Path | Auth | Notes |
| - | ------ | ---- | ---- | ----- |
| 1 | GET | `/social/search/suggestions` | Public | Working |
| 2 | GET | `/social/users/search` | JwtGuard | Optionality issue (S-02) |
| 3 | GET | `/social/suggestions` | JwtGuard | Working |
| 4 | GET | `/social/feed` | JwtGuard | Working |
| 5 | GET | `/social/me/analytics` | JwtGuard | Working |
| 6 | GET | `/social/users/trending` | Public | 500 bug (S-01) |
| 7 | GET | `/social/users/:userId/activity` | JwtGuard | Working |
| 8 | GET | `/social/users/:userId/stats` | Public | Working |
| 9 | GET | `/social/friends/leaderboard` | JwtGuard | Working |
| 10 | POST | `/social/friend-request/:userId` | JwtGuard | Missing field (S-11) |
| 11 | GET | `/social/friend-requests/incoming` | JwtGuard | Pagination mismatch (S-05) |
| 12 | GET | `/social/friend-requests/outgoing` | JwtGuard | Pagination mismatch (S-06) |
| 13 | POST | `/social/friend-requests/:friendshipId/respond` | JwtGuard | No request DTO (S-07) |
| 14 | DELETE | `/social/friend-requests/:friendshipId` | JwtGuard | Working |
| 15 | GET | `/social/friends` | JwtGuard | Optionality issue (S-03) |
| 16 | GET | `/social/friends/:userId` | JwtGuard | Working |
| 17 | DELETE | `/social/friends/:userId` | JwtGuard | Working |
| 18 | POST | `/social/block/:userId` | JwtGuard | No request DTO (S-08) |
| 19 | DELETE | `/social/block/:userId` | JwtGuard | Working |
| 20 | GET | `/social/blocked` | JwtGuard | Working |
| 21 | POST | `/social/follow/:userId` | JwtGuard | Working |
| 22 | DELETE | `/social/follow/:userId` | JwtGuard | Working |
| 23 | GET | `/social/followers` | JwtGuard | Working |
| 24 | GET | `/social/users/:userId/followers` | JwtGuard | DTO issue (S-04) |
| 25 | GET | `/social/users/:userId/following` | JwtGuard | Working |
| 26 | GET | `/social/following` | JwtGuard | Working |
| 27 | GET | `/social/users/:userId/mutual-friends` | JwtGuard | Export issue (S-09) |
| 28 | GET | `/social/users/:userId/mutual-followers` | JwtGuard | Export issue (S-10) |
| 29 | GET | `/social/relationship/:userId` | JwtGuard | Working |
| 30 | GET | `/social/counts` | JwtGuard | Working |

---

## Appendix B — Live Runtime Evidence

```
==GET /social/search/suggestions?q=test (public)==  STATUS=200  {"data":[],"meta":{...}} ✓
==GET /social/users/trending (public)==             STATUS=500  ⚠️ S-01 (missing FROM-clause)
==POST /social/friend-request/:userId (no auth)==   STATUS=401  ✓
==GET /social/users/:userId/stats (public)==        STATUS=404  (user not found) ✓
==GET /social/users/:userId/followers (no auth)==   STATUS=401  ✓
```

---

## Appendix C — Files Inspected

- `src/modules/social/social.module.ts`
- `src/modules/social/transport/controller/social.controller.ts`
- `src/modules/social/transport/presenters/social.presenter.ts`
- `src/modules/social/application/social-application.service.ts`
- `src/modules/social/domain/services/social.service.ts`
- `src/modules/social/domain/errors/social.errors.ts`
- `src/modules/social/domain/types/social.types.ts`
- `src/modules/social/infrastructure/repositories/social.repository.ts`
- `src/modules/social/infrastructure/adapters/*.ts` (event adapters)
- `src/modules/social/dto/request/*.ts` (all query DTOs)
- `src/modules/social/dto/response/*.ts` (all response DTOs)
- `src/core/database/schema/social/schema.ts`
- `docs/generated/openapi.json` (social section)
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/api.md`
- `docs/standards/swagger.md`
