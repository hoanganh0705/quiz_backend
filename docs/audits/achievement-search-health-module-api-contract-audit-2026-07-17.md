# API Contract Audit Report

## Achievement, Search, and Health Modules

**Audit Date:** Friday Jul 17, 2026
**Auditor:** Senior Backend API Review
**Modules Audited:** Achievement, Search, Health

---

## Executive Summary

A comprehensive API contract audit was conducted on the achievement, search, and health modules. The audit verified OpenAPI specification accuracy, runtime behavior, authentication/authorization rules, validation rules, and response schemas.

### Overall Findings

| Metric | Count |
|--------|-------|
| Total Endpoints Audited | 13 |
| Critical Issues | 2 |
| High Issues | 3 |
| Medium Issues | 4 |
| Low Issues | 3 |

---

## ENDPOINT INVENTORY

### Achievement Module (10 endpoints)

| # | Method | Path | Auth | Permission |
|---|--------|------|------|------------|
| 1 | GET | `/api/v1/achievements/badges` | Public (doc) / Private (runtime) | - |
| 2 | GET | `/api/v1/achievements/me/badges` | Required | - |
| 3 | GET | `/api/v1/achievements/badges/:badgeId` | Public (doc) / Private (runtime) | - |
| 4 | DELETE | `/api/v1/achievements/users/:userId/badges/:badgeId` | Required | ACHIEVEMENT_REVOKE |
| 5 | GET | `/api/v1/achievements/users/:userId/achievements` | Required | - |
| 6 | GET | `/api/v1/achievements/users/me/badges/:badgeId/progress` | Required | - |
| 7 | GET | `/api/v1/achievements/users/me/achievements/history` | Required | - |
| 8 | GET | `/api/v1/achievements/users/me/badges/analytics` | Required | - |
| 9 | POST | `/api/v1/admin/achievements/reevaluate/:userId` | Required | ACHIEVEMENT_ADMIN |
| 10 | GET | `/api/v1/admin/achievements/reevaluate/:userId/history` | Required | ACHIEVEMENT_ADMIN |

### Search Module (1 endpoint)

| # | Method | Path | Auth | Permission |
|---|--------|------|------|------------|
| 1 | GET | `/api/v1/search` | Public | - |

### Health Module (1 endpoint)

| # | Method | Path | Auth | Permission |
|---|--------|------|------|------------|
| 1 | GET | `/api/v1/health` | Public | - |

---

## DETAILED FINDINGS

---

### CRITICAL ISSUES

---

#### Issue #1: Search Endpoint SQL Error - Invalid SQL Query

**Severity:** Critical
**Endpoint:** `GET /api/v1/search`
**Status:** Runtime Bug (Implementation Incorrect)

**Current Behavior:**
The search endpoint returns HTTP 500 with error:
```
"missing FROM-clause entry for table \"up\""
```

**Root Cause:**
In `src/modules/search/application/search.application.service.ts`, the `searchUsers()` method uses Drizzle ORM's query builder which generates invalid SQL. The problem is in lines 120-131:

```typescript
const rows = await this.db
  .select({
    userId: users.userId,
    username: users.username,
    displayName: userProfiles.displayName,
    rank: sql<number>`greatest(${userRank}, ${displayNameRank})`,
  })
  .from(users)
  .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
  .where(and(isNull(users.deletedAt), or(userSearchCondition, displayNameSearchCondition)))
  .orderBy(sql`rank DESC`, sql`length(${users.username}) ASC`, users.username)
  .limit(limit);
```

The `userSearchCondition` and `displayNameSearchCondition` are generated using raw SQL fragments (`sql\`...\``) that reference `users.user_search_vector` and `up.display_name`, but these aliases (`up`) are only valid inside raw SQL strings, not in Drizzle's query builder context.

**Impact:**
- The search endpoint is completely non-functional
- All search functionality across users, quizzes, and discussions fails
- This is a breaking runtime error that affects all clients

**Recommendation:**
The search module's `searchUsers()` method should use raw SQL queries consistently (like `searchQuizzes()` and `searchDiscussions()` do) or properly integrate the Drizzle query builder throughout. The current mixed approach causes SQL generation issues.

**Suggested Fix:**
Either:
1. Convert `searchUsers()` to use raw SQL queries like the other search methods, OR
2. Properly structure the Drizzle query with subqueries or CTEs for the search conditions

**Safe Implementation Fix:** Yes - this is a bug fix that restores intended functionality without changing the API contract.

---

#### Issue #2: Authorization Mismatch - Badge Catalog Endpoint

**Severity:** Critical
**Endpoint:** `GET /api/v1/achievements/badges`
**Status:** Authorization Drift

**Current Behavior:**
The endpoint requires authentication (returns 401 without token).

**Documented Behavior:**
The OpenAPI specification and controller decorators indicate this endpoint should be public (no `@ApiAuth()` decorator, no security requirement in the spec).

**Root Cause:**
The controller lacks the `@Public()` decorator. The class-level `JwtGuard` (globally registered) applies to all endpoints that don't explicitly opt out with `@Public()`.

**Evidence:**
- Controller at `src/modules/achievement/transport/controller/achievement.controller.ts:65-84`
- No `@Public()` decorator present
- No security requirement in OpenAPI spec (verified at line 27608-27662)
- Runtime test confirms 401 response

**Recommendation:**
Add `@Public()` decorator to the `getBadgeCatalog()` method to match the documented behavior.

**Suggested Fix:**
```typescript
@Get('badges')
@Public()
@ApiOkResource(BadgeCatalogItemResponseDto, { ... })
async getBadgeCatalog(@Query() query: PaginationQueryDto) { ... }
```

**Safe Implementation Fix:** Yes - this restores the intended public access without changing the API contract.

---

### HIGH ISSUES

---

#### Issue #3: Authorization Mismatch - Badge Details Endpoint

**Severity:** High
**Endpoint:** `GET /api/v1/achievements/badges/:badgeId`
**Status:** Authorization Drift

**Current Behavior:**
The endpoint requires authentication (returns 401 without token).

**Documented Behavior:**
The OpenAPI specification indicates this endpoint should be public (no security requirement in the spec).

**Root Cause:**
Same as Issue #2 - the controller lacks the `@Public()` decorator.

**Recommendation:**
Add `@Public()` decorator to the `getBadgeDetails()` method to match the documented behavior.

**Suggested Fix:**
```typescript
@Get('badges/:badgeId')
@Public()
@ApiOkResource(BadgeDetailsResponseDto, { description: 'Badge details returned' })
@ApiNotFound('Badge not found')
async getBadgeDetails(@Param('badgeId', new ParseUUIDPipe()) badgeId: string) { ... }
```

**Safe Implementation Fix:** Yes - this restores the intended public access without changing the API contract.

---

#### Issue #4: Search Query Parameter Validation Mismatch

**Severity:** High
**Endpoint:** `GET /api/v1/search`
**Status:** Validation Drift

**Current Behavior:**
The `q` parameter is **required** at runtime. Requests without `q` return 400 validation error.

**Documented Behavior:**
The OpenAPI specification marks `q` as `required: false`.

**Root Cause:**
In `src/modules/search/dto/search-query.dto.ts`, the `q` field lacks the `@IsOptional()` decorator:

```typescript
@ApiPropertyOptional({
  description: 'Search term used across users, quizzes, and discussion threads',
  example: 'nestjs advanced',
  minLength: 2,
})
@Transform(({ value }: { value: unknown }) => { ... })
@IsString()
@MinLength(2)
q!: string;  // Missing @IsOptional()
```

**Recommendation:**
Either:
1. Add `@IsOptional()` decorator to `q` to match the OpenAPI spec, OR
2. Update OpenAPI spec to mark `q` as `required: true`

Since the application service has a guard (`if (!query) throw BadRequestException`), the intended behavior is that `q` should be required. Option 2 (updating OpenAPI) is recommended for consistency with actual behavior.

**Safe Documentation Fix:** Yes - updating OpenAPI to reflect actual behavior.

---

#### Issue #5: OpenAPI Schema - `badgeId` Parameter Missing UUID Format

**Severity:** High
**Endpoint:** `GET /api/v1/achievements/badges/:badgeId`
**Status:** OpenAPI Inconsistency

**Current Behavior:**
The `badgeId` parameter accepts any string value.

**Documented Behavior:**
Per project standards (`docs/standards/swagger.md`), UUID path parameters MUST set `format: 'uuid'`.

**Root Cause:**
The controller uses `ParseUUIDPipe()` but doesn't document the format in OpenAPI. The OpenAPI schema shows:

```json
{
  "name": "badgeId",
  "required": true,
  "in": "path",
  "schema": {
    "type": "string"
    // Missing: "format": "uuid"
  }
}
```

**Evidence:**
Per `docs/standards/swagger.md`: "UUIDv7 path parameters MUST set `format: 'uuid'` explicitly (this is enforced by `tag-openapi.spec.ts`)."

**Recommendation:**
Update the OpenAPI schema to include `"format": "uuid"` for the `badgeId` parameter.

**Suggested Fix:**
Add `@ApiParam({ name: 'badgeId', format: 'uuid', ... })` to the endpoint decorator chain.

**Safe Documentation Fix:** Yes - adding missing format specification.

---

### MEDIUM ISSUES

---

#### Issue #6: OpenAPI Schema - `userId` Parameter Missing UUID Format (Multiple Endpoints)

**Severity:** Medium
**Endpoints:**
- `DELETE /api/v1/achievements/users/:userId/badges/:badgeId`
- `GET /api/v1/achievements/users/:userId/achievements`
- `POST /api/v1/admin/achievements/reevaluate/:userId`
- `GET /api/v1/admin/achievements/reevaluate/:userId/history`

**Status:** OpenAPI Inconsistency

**Current Behavior:**
The `userId` parameter accepts any string value.

**Documented Behavior:**
Per project standards, UUID path parameters MUST set `format: 'uuid'`.

**Root Cause:**
Same as Issue #5 - the `ParseUUIDPipe()` usage isn't documented in OpenAPI.

**Recommendation:**
Add UUID format specification to all `userId` path parameters across achievement endpoints.

**Safe Documentation Fix:** Yes - adding missing format specifications.

---

#### Issue #7: Badge Catalog Response Schema Type Mismatch

**Severity:** Medium
**Endpoint:** `GET /api/v1/achievements/badges`
**Status:** OpenAPI Inconsistency

**Current Behavior:**
The response `data` field is documented as a single object.

**Documented Behavior:**
The endpoint returns a list/array of badges, but the OpenAPI schema shows:

```json
"data": {
  "$ref": "#/components/schemas/BadgeCatalogItemResponseDto"
}
```

This is the schema for a single item, not an array.

**Root Cause:**
The `@ApiOkResource` decorator is used with a single DTO type, but the actual response is an array.

**Evidence:**
- Controller returns `BadgeCatalogItemResponseDto[]` via presenter
- OpenAPI schema shows single object reference

**Recommendation:**
Use `@ApiOkResourceArray` or the correct array variant to properly document the response as an array.

**Suggested Fix:**
Update the decorator to properly indicate array response type.

**Safe Documentation Fix:** Yes - correcting the schema to match actual response.

---

#### Issue #8: My Badges Response Schema Type Mismatch

**Severity:** Medium
**Endpoint:** `GET /api/v1/achievements/me/badges`
**Status:** OpenAPI Inconsistency

**Current Behavior:**
Same as Issue #7 - the response is an array but documented as a single object.

**Root Cause:**
Same root cause - `@ApiOkResource` used instead of array variant.

**Recommendation:**
Use proper array response decoration.

**Safe Documentation Fix:** Yes - correcting the schema to match actual response.

---

#### Issue #9: Achievement History Response Schema Type Mismatch

**Severity:** Medium
**Endpoint:** `GET /api/v1/achievements/users/me/achievements/history`
**Status:** OpenAPI Inconsistency

**Current Behavior:**
Same as Issue #7 - the response is an array but documented as a single object.

**Root Cause:**
Same root cause - `@ApiOkResource` used instead of array variant.

**Recommendation:**
Use proper array response decoration.

**Safe Documentation Fix:** Yes - correcting the schema to match actual response.

---

### LOW ISSUES

---

#### Issue #10: OpenAPI Schema - `description` Field Type Incorrect

**Severity:** Low
**DTOs Affected:**
- `BadgeCatalogItemResponseDto`
- `BadgeDetailsResponseDto`
- `MyBadgeItemDto`

**Status:** OpenAPI Inconsistency

**Current Behavior:**
The `description` field is typed as `"type": "object"` in OpenAPI.

**Expected Behavior:**
The `description` field should be `"type": "string"` since it's a nullable string.

**Root Cause:**
The `@nestjs/swagger` library generates `"type": "object"` when `nullable: true` is used without explicit `type`.

**Evidence:**
```json
"description": {
  "type": "object",  // Should be "string"
  "description": "Badge description",
  "example": "Reach Top 10 ranking",
  "nullable": true
}
```

**Recommendation:**
Explicitly specify `type: 'string'` alongside `nullable: true` in the DTO decorators.

**Safe Documentation Fix:** Yes - correcting the type specification.

---

#### Issue #11: Missing OpenAPI Examples

**Severity:** Low
**Endpoint:** `GET /api/v1/achievements/badges`
**Status:** Documentation Incomplete

**Current Behavior:**
No response examples are provided in the OpenAPI specification for the badge catalog endpoint.

**Recommendation:**
Add realistic examples for the badge catalog response showing multiple badge items.

**Safe Documentation Fix:** Yes - adding example data.

---

#### Issue #12: Admin History Response Schema Type Mismatch

**Severity:** Low
**Endpoint:** `GET /api/v1/admin/achievements/reevaluate/:userId/history`
**Status:** OpenAPI Inconsistency

**Current Behavior:**
Same as Issue #7 - the response is an array but documented as a single object.

**Root Cause:**
Same root cause - `@ApiOkResource` used instead of array variant.

**Recommendation:**
Use proper array response decoration.

**Safe Documentation Fix:** Yes - correcting the schema to match actual response.

---

## FINDINGS SUMMARY

### By Severity

| Severity | Count | Issues |
|----------|-------|--------|
| Critical | 2 | #1 (Search SQL Error), #2 (Auth - Badge Catalog) |
| High | 3 | #3 (Auth - Badge Details), #4 (Search Validation), #5 (UUID Format) |
| Medium | 4 | #6 (UUID Format - Multiple), #7 (Schema - Catalog), #8 (Schema - My Badges), #9 (Schema - History) |
| Low | 3 | #10 (Type Object), #11 (Missing Examples), #12 (Schema - Admin History) |

### By Category

| Category | Count |
|----------|-------|
| Implementation Bugs | 2 (#1 Search SQL, #2/#3 Auth) |
| OpenAPI Schema Issues | 7 (#5, #6, #7, #8, #9, #10, #12) |
| Validation Inconsistencies | 1 (#4) |
| Documentation Issues | 3 (#10, #11, #12) |

---

## CONSISTENCY OBSERVATIONS

### Positive Findings

1. **Error Response Format:** All error responses consistently use RFC 7807 format with proper `type`, `title`, `status`, `detail`, `instance`, and `extensions.code`.

2. **Response Envelope:** All successful responses correctly use the `{ data, meta: { timestamp } }` envelope structure.

3. **Pagination Structure:** Pagination query parameters (`limit`, `offset`) are consistently documented across achievement endpoints.

4. **Health Check Implementation:** The health endpoint correctly implements the 3-tier status system (up/degraded/down) with proper HTTP status codes.

5. **Authentication Flow:** Protected endpoints consistently return 401 for missing/invalid tokens and 403 for insufficient permissions.

### Areas for Improvement

1. **Array Response Documentation:** Multiple endpoints return arrays but use single-object response decorators. This is a recurring pattern that should be standardized.

2. **UUID Format Documentation:** Path parameters with `ParseUUIDPipe()` are inconsistently documented with `format: 'uuid'` in OpenAPI.

3. **Public Endpoint Declaration:** Public endpoints need explicit `@Public()` decorator to avoid accidental protection by the global `JwtGuard`.

---

## MIGRATION PLAN

### Phase 1: Critical Bug Fixes

**Goal:** Restore core functionality that is currently broken.

**Issues Included:**
- #1: Search SQL Error (Critical Implementation Bug)
- #2: Badge Catalog Authorization (Authorization Bug)

**Reason These Belong Together:** Both are critical issues that prevent intended functionality from working.

**Dependencies:** None.

**Estimated Implementation Complexity:** Medium
**Estimated Implementation Risk:** Low
**Backward Compatible:** Yes
**Requires Database Migration:** No
**Affects Generated SDKs:** No

**Implementation Steps:**
1. Fix the SQL query generation in `searchUsers()` method
2. Add `@Public()` decorator to `getBadgeCatalog()` endpoint
3. Run integration tests to verify fixes
4. Test search functionality with actual data

---

### Phase 2: Authorization Corrections

**Goal:** Align runtime authorization with documented behavior.

**Issues Included:**
- #3: Badge Details Authorization

**Reason These Belong Together:** Authorization consistency for public-facing endpoints.

**Dependencies:** None (independent of Phase 1).

**Estimated Implementation Complexity:** Low
**Estimated Implementation Risk:** Low
**Backward Compatible:** Yes
**Requires Database Migration:** No
**Affects Generated SDKs:** No

**Implementation Steps:**
1. Add `@Public()` decorator to `getBadgeDetails()` endpoint
2. Verify no security implications of public access
3. Test the endpoint without authentication

---

### Phase 3: Validation and Query Parameter Corrections

**Goal:** Align validation behavior with documentation.

**Issues Included:**
- #4: Search Query Validation Mismatch

**Reason These Belong Together:** Validation rule alignment.

**Dependencies:** Phase 1 (search must work first).

**Estimated Implementation Complexity:** Low
**Estimated Implementation Risk:** Medium (changes API contract for error case)
**Backward Compatible:** No (adds new validation error)
**Requires Database Migration:** No
**Affects Generated SDKs:** No (adds error case that SDKs should handle anyway)

**Implementation Steps:**
1. Decide whether to make `q` optional (update validation) or required (update OpenAPI)
2. If making required: Update OpenAPI to mark `q` as required
3. If making optional: Add `@IsOptional()` and handle empty query gracefully
4. Update error responses in examples

---

### Phase 4: OpenAPI Schema Corrections

**Goal:** Ensure OpenAPI specification accurately documents the API.

**Issues Included:**
- #5: UUID format for badgeId
- #6: UUID format for userId (multiple endpoints)
- #7: Badge catalog response type (array vs object)
- #8: My badges response type
- #9: History response type
- #10: Description field type
- #11: Missing examples
- #12: Admin history response type

**Reason These Belong Together:** All are OpenAPI documentation corrections.

**Dependencies:** None (independent of other phases).

**Estimated Implementation Complexity:** Low to Medium
**Estimated Implementation Risk:** Low
**Backward Compatible:** Yes (documentation only)
**Requires Database Migration:** No
**Affects Generated SDKs:** Yes (schema accuracy for code generation)

**Implementation Steps:**
1. Add `@ApiParam` decorators with `format: 'uuid'` for all UUID path parameters
2. Change `@ApiOkResource` to `@ApiOkResourceArray` for array-returning endpoints
3. Add explicit `type: 'string'` for nullable string fields
4. Add response examples to all achievement endpoints
5. Regenerate OpenAPI spec: `pnpm generate:openapi`
6. Run OpenAPI regression tests

---

## VERIFICATION CHECKLIST

Before closing this audit, verify:

- [ ] Search endpoint returns valid results for all three sections (users, quizzes, discussions)
- [ ] Badge catalog is accessible without authentication
- [ ] Badge details is accessible without authentication
- [ ] Protected endpoints correctly require authentication
- [ ] All UUID path parameters have `format: 'uuid'` in OpenAPI
- [ ] Array-returning endpoints are documented as arrays
- [ ] Pagination works correctly with limit/offset parameters
- [ ] Error responses follow RFC 7807 format consistently
- [ ] Health check returns correct status for all three states (up/degraded/down)
- [ ] OpenAPI regression tests pass

---

## RECOMMENDED NEXT STEPS

1. **Immediate:** Address Phase 1 critical issues (Search SQL and Badge Catalog auth)
2. **Short-term:** Complete Phases 2-4 to fully align implementation with documentation
3. **Ongoing:** Add module-level OpenAPI spec tests (similar to `tag-openapi.spec.ts`) for achievement, search, and health modules to prevent regression
4. **Review:** Consider adding `@Public()` decorator documentation to the project standards

---

## APPENDIX: FILES REVIEWED

### Controllers
- `src/modules/achievement/transport/controller/achievement.controller.ts`
- `src/modules/achievement/transport/controller/achievement-admin.controller.ts`
- `src/modules/search/transport/search.controller.ts`
- `src/modules/health/health.controller.ts`

### Services
- `src/modules/achievement/application/achievement.application.service.ts`
- `src/modules/search/application/search.application.service.ts`
- `src/modules/health/health.presenter.ts`

### Presenters
- `src/modules/achievement/transport/presenters/achievement.presenter.ts`
- `src/modules/search/transport/search.presenter.ts`
- `src/modules/health/health.presenter.ts`

### DTOs
- `src/modules/achievement/dto/response/badge-catalog-item-response.dto.ts`
- `src/modules/achievement/dto/response/badge-details-response.dto.ts`
- `src/modules/achievement/dto/response/my-badges-response.dto.ts`
- `src/modules/achievement/dto/response/achievement-history-item-response.dto.ts`
- `src/modules/achievement/dto/response/public-achievement-profile-response.dto.ts`
- `src/modules/achievement/dto/response/user-badge-analytics-response.dto.ts`
- `src/modules/achievement/dto/response/badge-progress-response.dto.ts`
- `src/modules/achievement/dto/response/achievement-admin-response.dto.ts`
- `src/modules/search/dto/search-query.dto.ts`
- `src/modules/search/dto/response/search-response.dto.ts`
- `src/modules/health/dto/health-status.dto.ts`

### OpenAPI Specification
- `docs/generated/openapi.json` (lines 27608-28278, 33115-33275)

### Project Standards
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/api.md`
- `docs/standards/swagger.md`
- `docs/adr/0004-pagination-strategy.md`
- `docs/adr/0003-error-response.md`

### Module Documentation
- `docs/modules/achievement.md`
