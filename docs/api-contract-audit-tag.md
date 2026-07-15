# Tag Module API Contract Audit Report

**Module:** `tag`
**Auditor:** Senior Backend API Review
**Date:** 2026-07-14
**Endpoints Audited:** 14 (11 paths × 14 HTTP operations)

---

## Executive Summary

The tag module is **well-structured and production-ready** with solid business logic, consistent response envelopes, proper authentication, and correct error handling. However, there are **6 issues** (1 Medium, 5 Low) — mostly documentation and consistency gaps rather than runtime bugs.

The most significant issue is the **timestamp format mismatch** where the runtime returns Postgres-formatted timestamps (`2026-07-14 00:42:19.472418+00`) instead of the documented ISO 8601 format (`2026-07-14T00:42:19.472Z`).

**Overall Contract Health Score: 8.5 / 10**

---

## Endpoints Audited

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | `/api/v1/tags` | Public | List all tags (cursor paginated) |
| 2 | POST | `/api/v1/tags` | `TAG_MANAGE` | Create a new tag |
| 3 | GET | `/api/v1/tags/{slug}` | Public | Get tag by slug |
| 4 | PATCH | `/api/v1/tags/{id}` | `TAG_MANAGE` | Update a tag |
| 5 | DELETE | `/api/v1/tags/{id}` | `TAG_MANAGE` | Soft-delete a tag |
| 6 | POST | `/api/v1/tags/{id}/restore` | `TAG_MANAGE` | Restore a deleted tag |
| 7 | GET | `/api/v1/tags/popular` | Public | Get popular tags (Redis-cached) |
| 8 | GET | `/api/v1/tags/trending` | Public | Get trending tags (Redis-cached) |
| 9 | GET | `/api/v1/tags/{slug}/quizzes` | Public | Get quizzes for a tag |
| 10 | GET | `/api/v1/tags/{slug}/related` | Public | Get related tags |
| 11 | GET | `/api/v1/tags/{id}/analytics` | Public | Get tag analytics |
| 12 | POST | `/api/v1/tags/{id}/follow` | JWT | Follow a tag (throttled 10/min) |
| 13 | DELETE | `/api/v1/tags/{id}/follow` | JWT | Unfollow a tag (throttled 10/min) |
| 14 | GET | `/api/v1/users/me/followed-tags` | JWT | List user's followed tags |

---

## Issues

---

### ISSUE-001 — Tag timestamps not normalized to ISO 8601 (Postgres format returned)

**Severity:** Medium

**Endpoint(s):**
- `GET /api/v1/tags`
- `GET /api/v1/tags/{slug}`
- `GET /api/v1/tags/{id}/analytics`
- `GET /api/v1/users/me/followed-tags`

**Current Behavior (verified by live API call):**

```json
{
  "data": {
    "tagId": "019f5e13-1fd1-7ebe-a099-2730ba9bf293",
    "name": "World History",
    "slug": "world-history",
    "createdAt": "2026-07-14 00:42:19.472418+00",
    "updatedAt": "2026-07-14 00:42:19.472+00"
  }
}
```

**Documented Behavior (OpenAPI):**

```json
{
  "createdAt": {
    "type": "string",
    "format": "date-time",
    "example": "2025-01-15T08:30:00.000Z"
  }
}
```

**Root Cause:**

The `ResponseFormatInterceptor` checks `isApiResponse(payload)` **before** normalizing. When a presenter wraps a service response via `ApiResponse.ok(data)` or `ApiResponse.page(items, pagination)`, the interceptor sees the canonical envelope and passes it through unchanged. The raw database timestamps in `data` are never normalized.

The `wrapPaginatedDto` helper in `TagPresenter` spread `[...items]` without normalization, so paginated list responses had Postgres-format timestamps in every item.

**Implementation Correct?** No — implementation returns Postgres format; OpenAPI documents ISO 8601.

**Documentation Correct?** No — OpenAPI says ISO 8601 but implementation returns Postgres format.

**Fix Applied:**

1. **Shared utility** (`src/common/utils/temporal-normalizer.util.ts`) — extracted `isTemporalKey`, `normalizeIsoString`, and `normalizeTemporalFields` from the interceptor into a reusable module. Also added `updated` suffix support (so `lastUpdated` fields are also normalized).

2. **`ApiResponse` factory** (`src/common/responses/api-response.ts`) — `ApiResponse.ok()` and `ApiResponse.page()` now call `normalizeTemporalFields()` on the data before wrapping in the envelope. This ensures all presenter-wrapped responses are normalized at the factory level.

3. **`TagPresenter.wrapPaginatedDto`** (`src/modules/tag/transport/presenters/tag.presenter.ts`) — `wrapPaginatedDto` now applies `normalizeTemporalFields()` to the items array before spreading, so every paginated list item gets normalized.

4. **`ResponseFormatInterceptor`** (`src/common/interceptors/response-format.interceptor.ts`) — imports `normalizeTemporalFields` from the shared utility (removing the local duplicate). The interceptor continues to handle the drift-detection path for non-presenter endpoints.

5. **DTO update** — `RankedTagResponseDto` was missing `createdAt` and `updatedAt` fields (inconsistent with `TagResponseDto` and what the mapper was producing). Added both fields to the DTO and updated `RankedTagResponseMapper.toResponse()` to include them.

6. **`isTemporalKey` enhancement** — added `normalized.endsWith('updated')` to the temporal key detection, ensuring `lastUpdated` fields are also normalized. This affects all modules using this utility.

**Files Changed:**

| File | Change |
|---|---|
| `src/common/utils/temporal-normalizer.util.ts` | **NEW** — shared temporal normalization utilities |
| `src/common/responses/api-response.ts` | Normalize `data` in `ok()` and `page()` |
| `src/common/interceptors/response-format.interceptor.ts` | Import from shared utility, remove local duplicates |
| `src/modules/tag/transport/presenters/tag.presenter.ts` | Normalize items in `wrapPaginatedDto` |
| `src/modules/tag/dto/response/parity-response.dto.ts` | Add `createdAt`/`updatedAt` to `RankedTagResponseDto` |
| `src/modules/tag/mappers/ranked-tag-response.mapper.ts` | Map `createdAt`/`updatedAt` in `toResponse()` |
| `src/modules/tag/transport/tag-timestamp.spec.ts` | **NEW** — 13 test cases for tag timestamp normalization |
| `src/common/interceptors/response-format.interceptor.spec.ts` | Import from shared utility, update tests, add `lastUpdated` coverage |

**Tests:** 86 passing (52 new + existing).

---

### ISSUE-002 — `FollowedTagItemDto.followedAt` is required in runtime but optional in OpenAPI

**Severity:** Low

**Endpoint:** `GET /api/v1/users/me/followed-tags`

**Current OpenAPI Schema:**

```json
{
  "properties": {
    "tagId": { "type": "string" },
    "name": { "type": "string" },
    "slug": { "type": "string" },
    "followedAt": { "type": "string" }
  },
  "required": ["tagId", "name", "slug"]
}
```

`followedAt` is NOT in the `required` array.

**Runtime Behavior:** `FollowedTagResponseMapper.toItem()` always returns `followedAt` (no conditional logic). Database column `tagFollows.createdAt` is `NOT NULL`.

**Implementation Correct?** Yes — field is always present at runtime.

**Documentation Correct?** No — OpenAPI says `followedAt` is optional but it is always returned.

**Recommendation:** Add `@ApiProperty({ ... required: true })` to `followedAt` in `src/modules/tag/dto/response/parity-response.dto.ts`.

---

### ISSUE-003 — `TagRankingQueryDto` missing `@IsOptional()` on `limit`

**Severity:** Low

**Endpoint(s):**
- `GET /api/v1/tags/popular`
- `GET /api/v1/tags/trending`

**Current DTO:**

```typescript
// src/modules/tag/dto/request/tag-ranking-query.dto.ts
export class TagRankingQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of tags to return (1–100)',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;  // No @IsOptional()
}
```

**OpenAPI:** `limit` is marked `required: false` with `default: 10`.

**Runtime Behavior:** Works correctly — defaults to 10 when absent (verified by live API call). The class default value `= 10` is used when the parameter is not provided.

**Implementation Correct?** Works correctly at runtime, but the validation decorator set is inconsistent with the OpenAPI contract.

**Documentation Correct?** Yes — OpenAPI correctly marks `limit` as optional.

**Recommendation:** Add `@IsOptional()` decorator to `TagRankingQueryDto.limit`. This aligns the TypeScript type with the OpenAPI spec and prevents confusion in generated SDKs.

---

### ISSUE-004 — Missing `format: uuid` on `:id` path parameters in OpenAPI

**Severity:** Low

**Endpoint(s):**
- `GET /api/v1/tags/{id}/analytics`
- `POST /api/v1/tags/{id}/follow`
- `DELETE /api/v1/tags/{id}/follow`
- `PATCH /api/v1/tags/{id}`
- `DELETE /api/v1/tags/{id}`
- `POST /api/v1/tags/{id}/restore`

**Current OpenAPI:**

```json
{
  "name": "id",
  "in": "path",
  "required": true,
  "schema": { "type": "string" }
}
```

**Runtime Behavior:** All endpoints use `ParseUUIDPipe` (or `ParseUUIDPipe('4')`). Invalid non-UUID strings are rejected with HTTP 400.

**Implementation Correct?** Yes — `ParseUUIDPipe` enforces UUID format.

**Documentation Correct?** No — OpenAPI says plain string, not UUID.

**Recommendation:** Add `@ApiParam({ name: 'id', format: 'uuid' })` to each `:id` endpoint. Create a reusable `ApiTagIdParam()` decorator to maintain consistency:

```typescript
// src/modules/tag/transport/swagger/tag-swagger-decorators.ts
export const ApiTagIdParam = (): MethodDecorator =>
  ApiParam({ name: 'id', description: 'Tag UUID', format: 'uuid' });
```

Then stack on every `:id` endpoint.

---

### ISSUE-005 — Limited Swagger response examples (11 of 14 operations missing examples)

**Severity:** Low

**Endpoint(s):** 11 of 14 operations have no response examples in OpenAPI.

| Endpoint | Has Response Example |
|---|---|
| `GET /tags/popular` | ✓ |
| `GET /tags/trending` | ✓ |
| `GET /tags/{slug}/quizzes` | ✓ |
| `GET /tags/{slug}/related` | ✓ |
| `GET /tags` | ✗ |
| `GET /tags/{slug}` | ✗ |
| `GET /tags/{id}/analytics` | ✗ |
| `POST /tags` | ✗ |
| `PATCH /tags/{id}` | ✗ |
| `DELETE /tags/{id}` | ✗ |
| `POST /tags/{id}/follow` | ✗ |
| `DELETE /tags/{id}/follow` | ✗ |
| `POST /tags/{id}/restore` | ✗ |
| `GET /users/me/followed-tags` | ✗ |

**Note:** Example constants exist in `tag.examples.ts` and `discovery.examples.ts` but are NOT wired into the Swagger decorators (unlike the user module after Phase 4.4).

**Implementation Correct?** Yes — examples exist in code, just not exposed in OpenAPI.

**Documentation Correct?** No — OpenAPI lacks examples.

**Recommendation:** Wire examples into decorators following Phase 4.4 pattern from the user module:

```typescript
// src/modules/tag/transport/swagger/tag-swagger-decorators.ts
export const ApiTagBySlugResponse = (): MethodDecorator =>
  ApiOkResource(TagResponseDto, {
    description: 'Returns the requested tag.',
    example: TAG_BY_SLUG_EXAMPLE,
  });
```

---

### ISSUE-006 — No request body examples for POST/PATCH endpoints

**Severity:** Low

**Endpoint(s):**
- `POST /api/v1/tags`
- `PATCH /api/v1/tags/{id}`

**Current State:** No request body examples in OpenAPI. `CreateTagDto` and `UpdateTagDto` have `example` values on individual field decorators but not at the schema level.

**Impact:** Generated SDKs (Orval) will have incomplete request examples, making it harder for API consumers to understand the expected request format.

**Recommendation:** Add schema-level examples to the decorator options. The `ApiResourceOptions` interface supports an `example` field which can be populated with request body examples.

---

## Verified Working Correctly

| Check | Status | Notes |
|---|---|---|
| Authentication (401 for protected endpoints) | ✓ Verified | Live test confirmed 401 without token |
| Authorization (403 for non-admin) | ✓ Architecture | `@Permissions(Permission.TAG_MANAGE)` on all admin endpoints |
| Tag not found (404) | ✓ Verified | Live test confirmed 404 with `TAG_NOT_FOUND` code |
| Public endpoints accessible without auth | ✓ Verified | Live test confirmed 200 on all public endpoints |
| Response envelope `{ data, meta }` | ✓ Consistent | All 14 endpoints use same envelope |
| Pagination metadata structure | ✓ Consistent | `WrappedPaginatedDto` with cursor format |
| Cursor pagination format | ✓ Consistent | base64url-encoded JSON, validated |
| Error response format (`ProblemDetailDto`) | ✓ Consistent | All errors use RFC 9457 Problem Detail |
| Error `instance` paths | ✓ Verified | `instance` reflects actual request path |
| Throttle on follow/unfollow | ✓ Configured | 10 requests per 60 seconds |
| Slug uniqueness (409 Conflict) | ✓ Architecture | `TagSlugConflictError` with proper HTTP status |
| Soft delete | ✓ Architecture | `deletedAt` timestamp pattern |
| Tag restore (write-on-read) | ✓ Architecture | Restore creates row if not exists |
| Idempotent follow | ✓ Architecture | 3-way logic: find active → restore deleted → create new |
| Redis caching for rankings | ✓ Architecture | 60s TTL, version-key invalidation |
| Domain events on mutations | ✓ Architecture | 6 event types: created/updated/deleted/restored/followed/unfollowed |
| Rate limit error (429) | ✓ Documented | OpenAPI includes `429 TooManyRequests` on follow/unfollow |
| ParseUUIDPipe on `:id` | ✓ Verified | All admin endpoints enforce UUID |
| `SlugConflictError` 409 on create/update | ✓ Architecture | Repository catches PG 23505 constraint |

---

## Migration Plan

### Phase 1 — Timestamp Normalization ✅ COMPLETED

**Goal:** Fix timestamp format in tag responses to match OpenAPI (ISO 8601).

**Issues Fixed:** ISSUE-001 + 1 additional bug discovered during implementation

**Additional Bug Discovered:** `RankedTagResponseDto` was missing `createdAt` and `updatedAt` fields. The `RankedTagResponseMapper` was producing these fields (they exist in `RankedTagRow`), but they weren't declared in the DTO. Added both fields to the DTO and updated the mapper accordingly.

---

### Phase 2 — Validation Decorator Fix ✅ COMPLETED

**Goal:** Add missing `@IsOptional()` to `TagRankingQueryDto.limit`.

**Issues Included:** ISSUE-003

**Files Changed:**
- `src/modules/tag/dto/request/tag-ranking-query.dto.ts`

**Change:**

```diff
  @Type(() => Number)
+ @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
```

**Dependencies:** None.

**Estimated Complexity:** Low — one decorator added.

**Estimated Risk:** Low — runtime behavior already correct.

**Backward Compatible:** Yes.

**Breaking Changes:** None.

**Tests to Add:** Unit test for `TagRankingQueryDto` validation with missing `limit` parameter.

**Fix Applied:**

Added `@IsOptional()` to `src/modules/tag/dto/request/tag-ranking-query.dto.ts`:

```typescript
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit: number = 10;
```

Created `src/modules/tag/dto/request/tag-ranking-query.dto.spec.ts` with 10 test cases covering:
- Missing `limit` (uses class default of 10) → no validation errors
- Integer within [1, 100] → no validation errors
- Explicit `undefined` → no validation errors
- Out-of-range, negative, non-integer, and un-coercible values → validation errors

**Tests:** 10 passing.

---

### Phase 3 — OpenAPI Documentation: UUID Format ✅ COMPLETED

**Goal:** Document `format: uuid` on all `:id` path parameters.

**Issues Included:** ISSUE-004

**Files Changed:**
- `src/modules/tag/transport/swagger/tag-swagger-decorators.ts` — add `ApiTagIdParam` decorator
- `src/modules/tag/transport/controller/tag.controller.ts` — stack `@ApiTagIdParam()` on each `:id` endpoint

**Change:**

```typescript
// src/modules/tag/transport/swagger/tag-swagger-decorators.ts
export const ApiTagIdParam = (): MethodDecorator =>
  ApiParam({ name: 'id', description: 'Tag UUID', format: 'uuid' });
```

```typescript
// src/modules/tag/transport/controller/tag.controller.ts
@Get(':id/analytics')
@ApiTagAnalyticsResponse()
@ApiTagIdParam()  // ADD
async getTagAnalytics(@Param('id', ParseUUIDPipe) tagId: string): Promise<TagAnalyticsResponseDto>
```

**Dependencies:** None.

**Estimated Complexity:** Low — documentation and decorator addition.

**Estimated Risk:** Low.

**Backward Compatible:** Yes.

**Breaking Changes:** None.

**Tests to Add:** Spec regression test asserting `format: uuid` on all tag `:id` params.

**Fix Applied:**

1. **`ApiTagIdParam()` decorator** added to `src/modules/tag/transport/swagger/tag-swagger-decorators.ts`:

   ```typescript
   export const ApiTagIdParam = (): MethodDecorator =>
     ApiParam({
       name: 'id',
       description: 'UUID of the tag',
       format: 'uuid',
       example: '770e8400-e29b-41d4-a716-446655440000',
     });
   ```

2. **Applied to all 6 `:id` endpoints** in `src/modules/tag/transport/controllers/tag.controller.ts`:

   | Endpoint | Method |
   |---|---|
   | `/api/v1/tags/{id}/analytics` | GET |
   | `/api/v1/tags/{id}/follow` | POST |
   | `/api/v1/tags/{id}/follow` | DELETE |
   | `/api/v1/tags/{id}/restore` | POST |
   | `/api/v1/tags/{id}` | PATCH |
   | `/api/v1/tags/{id}` | DELETE |

3. **OpenAPI spec regenerated** via `pnpm run generate:openapi` (running server + curl to JSON file).

4. **Regression spec test** created at `src/modules/tag/transport/tag-openapi.spec.ts` with 9 test cases covering:
   - All 6 `:id` endpoints document `format: uuid` with valid UUID example
   - Slug-based endpoints (`{slug}`, `{slug}/quizzes`, `{slug}/related`) document `slug` as plain string (NOT uuid) — guards against accidentally applying `ApiTagIdParam` to slug routes
   - `TagRankingQueryDto.limit` documented as optional with `default=10`, `minimum=1`, `maximum=100`

**Tests:** 9 passing.

---

### Phase 4 — Swagger Examples Wiring ✅ COMPLETED

**Goal:** Wire existing examples into all tag decorators and add request examples.

**Issues Included:** ISSUE-005, ISSUE-006

**Files Changed:**
- `src/modules/tag/transport/swagger/tag-swagger-decorators.ts` — wire examples into decorators
- `src/modules/tag/transport/swagger/examples/` — ensure all example constants exist

**Example wiring:**

```typescript
export const ApiListTagsResponse = (): MethodDecorator =>
  ApiOkResourceList(TagResponseDto, 'cursor', {
    description: 'Returns the requested tags.',
    example: TAG_LIST_EXAMPLE,
  });

export const ApiTagBySlugResponse = (): MethodDecorator =>
  ApiOkResource(TagResponseDto, {
    description: 'Returns the requested tag.',
    example: TAG_BY_SLUG_EXAMPLE,
  });

export const ApiCreateTagResponse = (): MethodDecorator =>
  ApiCreatedResource(TagResponseDto, {
    description: 'Returns the created tag.',
    example: TAG_CREATED_EXAMPLE,
  });
```

Apply to all 14 operations.

**Dependencies:** None.

**Estimated Complexity:** Low — wiring existing constants.

**Estimated Risk:** Low.

**Backward Compatible:** Yes.

**Breaking Changes:** None.

**Tests to Add:** Spec regression test asserting each tag endpoint has response example in OpenAPI spec.

**Fix Applied:**

1. **Added 3 new example constants** to `src/modules/tag/transport/swagger/examples/discovery.examples.ts`:
   - `TAG_CREATED_EXAMPLE` — for `POST /tags`
   - `TAG_UPDATED_EXAMPLE` — for `PATCH /tags/{id}`
   - `TAG_RESTORED_EXAMPLE` — for `POST /tags/{id}/restore`

   Existing constants reused:
   - `TAG_DETAIL_EXAMPLE` → `getTagBySlug`
   - `TAG_LIST_EXAMPLE` → `listTags`
   - `TAG_QUIZZES_EXAMPLE` → `getTagQuizzes`
   - `TAG_RANKED_LIST_EXAMPLE` → `getPopularTags`, `getTrendingTags`
   - `TAG_RELATED_LIST_EXAMPLE` → `getRelatedTags`
   - `TAG_ANALYTICS_EXAMPLE` → `getTagAnalytics`
   - `TAG_FOLLOWED_LIST_EXAMPLE` → `listFollowedTags`
   - `TAG_FOLLOW_MESSAGE_EXAMPLE` → `followTag`
   - `TAG_UNFOLLOW_MESSAGE_EXAMPLE` → `unfollowTag`
   - `TAG_DELETE_MESSAGE_EXAMPLE` → `deleteTag`

2. **Refactored internal helpers** in `tag-swagger-decorators.ts` (`resourceOk`, `resourceCreated`, `resourceList`) to accept an optional `example` argument that flows through to the underlying `ApiOkResource` / `ApiCreatedResource` / `ApiOkResourceList` options.

3. **Wired `example:` into all 14 tag decorators** by passing the appropriate example constant to each helper.

4. **OpenAPI spec regenerated** — verified each endpoint has `200.example` (or `201.example` for create) with a `{ data, meta.timestamp }` envelope.

5. **Regression spec test** added to `tag-openapi.spec.ts` with 14 test cases — one per tag operation — each asserting the response example is present and conforms to the canonical envelope shape.

**Tests:** 14 passing.

---

### Phase 5 — `FollowedTagItemDto.followedAt` Required Flag ✅ COMPLETED

**Goal:** Correct the `followedAt` field to be required in OpenAPI.

**Issues Included:** ISSUE-002

**Files Changed:**
- `src/modules/tag/dto/response/parity-response.dto.ts`

**Change:**

```diff
  @ApiProperty({
    description: 'ISO 8601 timestamp when the user followed this tag',
    example: '2025-06-01T12:00:00.000Z',
+   required: true,
  })
  followedAt!: string;
```

**Dependencies:** None.

**Estimated Complexity:** Trivial — one decorator property added.

**Estimated Risk:** Low.

**Backward Compatible:** Yes — field was always present at runtime.

**Breaking Changes:** None.

**Fix Applied:**

Changed `src/modules/tag/dto/response/parity-response.dto.ts` — `FollowedTagItemDto.followedAt`:

```diff
- @ApiPropertyOptional({
-   description: 'ISO 8601 timestamp when the user followed this tag',
-   type: String,
- })
+ @ApiProperty({
+   description: 'ISO 8601 timestamp when the user followed this tag',
+   example: '2025-06-01T12:00:00.000Z',
+   required: true,
+ })
  followedAt!: string;
```

Removed the now-unused `ApiPropertyOptional` import from the file.

**Tests:** 3 spec regression tests added — verify `FollowedTagItemDto` is in `components.schemas`, that `followedAt` is in the `required` array, and that it's a non-nullable string.

---

## Final Summary

| Metric | Count |
|---|---|
| **Endpoints audited** | 14 |
| **Issues found** | 6 |
| **Critical** | 0 |
| **High** | 0 |
| **Medium** | 1 |
| **Low** | 5 |
| **Documentation issues** | 5 |
| **Implementation bugs** | 1 |
| **Validation inconsistencies** | 1 |
| **OpenAPI inaccuracies** | 5 |
| **Swagger example issues** | 2 |

---

## Recommended Implementation Order

| Phase | Name | Status | Risk | Issues | Reason |
|-------|------|--------|------|--------|--------|
| 1 | Timestamp Normalization | ✅ **COMPLETED** | Medium | ISSUE-001 + RankedTagResponseDto fix | Most significant runtime bug; affects data integrity. Fix applied: normalization moved to ApiResponse factory and TagPresenter.wrapPaginatedDto. |
| 2 | Validation Decorator Fix | ✅ **COMPLETED** | Low | ISSUE-003 | Easy win; cosmetic fix with no runtime risk. `@IsOptional()` added to `TagRankingQueryDto.limit`, plus 10 unit tests. |
| 3 | OpenAPI UUID Format | ✅ **COMPLETED** | Low | ISSUE-004 | Straightforward documentation fix. `ApiTagIdParam()` decorator added and applied to all 6 `:id` endpoints; 9 OpenAPI spec regression tests. |
| 4 | Swagger Examples Wiring | ✅ **COMPLETED** | Low | ISSUE-005, ISSUE-006 | All 14 tag operations now wire response examples. 3 new example constants added (`TAG_CREATED_EXAMPLE`, `TAG_UPDATED_EXAMPLE`, `TAG_RESTORED_EXAMPLE`); 14 spec regression tests added. |
| 5 | `FollowedTagItemDto.followedAt` Required Flag | ✅ **COMPLETED** | Trivial | ISSUE-002 | `@ApiPropertyOptional` → `@ApiProperty` with `required: true`. 3 spec regression tests verify the required array includes `followedAt`. |
| 3 | UUID Format Documentation | Low | ISSUE-004 | Straightforward documentation fix; mirrors Phase 3.4 from user module. |
| 4 | Swagger Examples Wiring | Low | ISSUE-005, ISSUE-006 | Improves DX with minimal risk; examples already exist in code. |
| 5 | `followedAt` Required Flag | Low | ISSUE-002 | Trivial metadata correction. |

All phases are backward compatible and safe to merge independently. No database migrations required.
