# Tag Module Production-Readiness Audit

**Date:** Tuesday, July 28, 2026  
**Status:** Complete

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 4 |
| Improvement | 1 |
| **Total** | **10** |

---

## Finding 1: Follow/Unfollow Response Inconsistency with Category Module

**Category:** Cross-Module Consistency  
**Severity:** High

**Location:**  
- `src/modules/tag/transport/controllers/tag.controller.ts:106-130`
- `src/modules/category/transport/controllers/category.controller.ts:120-144`

**Current behavior:**  
Tag module's follow/unfollow endpoints return `200 OK` with response bodies:

```typescript
async followTag(...) {
  return this.presenter.followTag({ message: 'Tag followed successfully', changed: true });
}
```

Category module's follow/unfollow endpoints use `@HttpCode(HttpStatus.NO_CONTENT)` with no response body.

**Problem:**  
These two semantically identical operations behave inconsistently. Clients must handle different response patterns for the same business operation across modules.

**Recommendation:**  
Align the tag module's follow/unfollow behavior with the category module:

1. Add `@HttpCode(HttpStatus.NO_CONTENT)` to `followTag()` and `unfollowTag()` controller methods
2. Remove the response body return (return `Promise<void>` instead)
3. Update the application service to return `void` instead of `{ message, changed }`
4. Update `TagPresenter` to remove `followTag` and `unfollowTag` methods

**Reasoning:**  
The category pattern is more RESTful for DELETE-equivalent operations. A single consistent pattern across all modules reduces client complexity and makes the API feel designed by one team.

**Breaking change risk:** Low (client adaptation required for tag endpoints only)

---

## Finding 2: TagPresenter Uses Custom Pagination Wrapper

**Category:** Cross-Module Consistency  
**Severity:** Medium

**Location:**  
- `src/modules/tag/transport/presenters/tag.presenter.ts:27-44`

**Current behavior:**  
Tag module uses a custom `wrapPaginatedDto()` helper:

```typescript
const wrapPaginatedDto = <T>(payload: { ... }): ApiResponseEnvelope<T[]> => {
  return {
    data: normalizeTemporalFields([...payload.items]) as T[],
    meta: { timestamp, pagination: { kind: 'cursor', ... } },
  };
};
```

Category module uses `ApiResponse.page()`:

```typescript
readonly listCategories = (payload: PaginatedResult<CategoryResponseDto>) =>
  ApiResponse.page(payload.items, payload.pagination);
```

**Problem:**  
Two different patterns for the same pagination wrapper API. The tag module's custom implementation may diverge from the canonical pattern over time.

**Recommendation:**  
Replace `wrapPaginatedDto()` with `ApiResponse.page()` in `TagPresenter` for consistency with other modules:

```typescript
readonly listTags = (payload: TagListResponseDto) =>
  ApiResponse.page(payload.items, payload.pagination);

readonly listFollowedTags = (payload: FollowedTagsResponseDto) =>
  ApiResponse.page(payload.items, payload.pagination);
```

**Reasoning:**  
Using the shared utility ensures consistent pagination metadata structure and easier maintenance. The `ApiResponse.page()` method is the canonical implementation used by other modules.

**Breaking change risk:** Low (response structure remains the same, just uses different code path internally)

---

## Finding 3: Follow/Unfollow Response DTOs Are Inconsistent

**Category:** Cross-Module Consistency  
**Severity:** Medium

**Location:**  
- `src/modules/tag/dto/response/parity-response.dto.ts:33-42`
- `src/modules/category/dto/response/followed-category-item.dto.ts` (uses `MessageResponseDto`)

**Current behavior:**  
Tag's follow response: `TagFollowMessageResponseDto` with `{ message, changed }`  
Category's follow response: `MessageResponseDto` with `{ message }`

**Problem:**  
Clients cannot reuse response handling logic between tag and category follow operations. The `changed` field is tag-specific and creates API asymmetry.

**Recommendation:**  
After addressing Finding 1, remove `TagFollowMessageResponseDto` entirely since the endpoints will return no content. If the `changed` field is valuable for analytics:

1. Keep `TagFollowMessageResponseDto` but only use it for tag endpoints
2. Document the difference in API contracts

Alternatively, make both modules return the same shape if body responses are kept.

**Reasoning:**  
Identical business operations should have identical API contracts. The `changed` field provides useful idempotency information but should be consistent across all follow/unfollow operations if used at all.

**Breaking change risk:** Medium (if removing `changed` field)

---

## Finding 4: Unused Sort/Order Parameters in ListTagsQueryDto

**Category:** Maintainability  
**Severity:** Low

**Location:**  
- `src/modules/tag/dto/request/list-tags-query.dto.ts:39-59`
- `src/modules/tag/domain/tag.service.ts:70-91`

**Current behavior:**  
`ListTagsQueryDto` defines `sort` and `order` parameters:

```typescript
@ApiPropertyOptional({
  description: 'Sort tags by name or creation date',
  enum: TAG_SORT_OPTIONS,
  default: 'name',
})
@IsIn(TAG_SORT_OPTIONS)
sort?: TagSortOption;

@ApiPropertyOptional({
  description: 'Sort direction (ascending or descending)',
  enum: SORT_ORDER,
  default: 'asc',
})
@IsIn(SORT_ORDER)
order?: SortOrder;
```

But `TagDomainService.listTags()` never uses them:

```typescript
const rows = await this.tagRepository.findMany({ limit, cursor });
// sort and order are never passed to repository
```

**Problem:**  
Dead code that:
- Confuses API consumers who may attempt to use these parameters
- Adds maintenance burden for Swagger documentation
- Creates potential confusion about supported features

**Recommendation:**  
Remove the unused `sort` and `order` fields from `ListTagsQueryDto` and the unused exports (`TAG_SORT_OPTIONS`, `SortOrder`, `SORT_ORDER`) if they are not used elsewhere.

**Reasoning:**  
Clean API contracts improve developer experience, reduce confusion, and prevent accidental documentation of non-functional features.

**Breaking change risk:** Low (parameters were non-functional anyway)

---

## Finding 5: TagAnalyticsNotFoundError Not Documented in Swagger

**Category:** Swagger / OpenAPI  
**Severity:** Medium

**Location:**  
- `src/modules/tag/transport/swagger/tag-swagger-decorators.ts:202-212`

**Current behavior:**  
`ApiTagAnalyticsResponse()` is missing `ApiNotFoundResponse`:

```typescript
export const ApiTagAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<...>,
    ApiBadRequestResponse(...),
    // Missing: ApiNotFoundResponse(...)
    ApiInternalServerErrorResponse(...),
  );
```

But `TagApplicationService.getTagAnalytics()` throws `TagAnalyticsNotFoundError` when analytics are not found:

```typescript
if (!analytics) {
  throw new TagAnalyticsNotFoundError();
}
```

**Problem:**  
API documentation does not reflect the actual error responses. Clients won't know a 404 is possible, leading to unhandled error cases.

**Recommendation:**  
Add `ApiNotFoundResponse` to `ApiTagAnalyticsResponse()` decorator:

```typescript
export const ApiTagAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<...>,
    ApiBadRequestResponse(...),
    ApiNotFoundResponse(problem.notFound(analyticsNotFoundExample)),
    ApiInternalServerErrorResponse(...),
  );
```

Create `analyticsNotFoundExample` in the errors examples file if it doesn't exist.

**Reasoning:**  
Complete API documentation is essential for client integration and prevents support tickets. The 404 response is a legitimate error case that clients must handle.

**Breaking change risk:** None (documentation only)

---

## Finding 6: Missing GET /tags/:id Endpoint

**Category:** REST API Design  
**Severity:** Low

**Location:**  
- `src/modules/tag/transport/controllers/tag.controller.ts`

**Current behavior:**  
- Tag module: only `GET /tags/:slug` exists
- Category module: has both `GET /categories/:id` and `GET /categories/:slug`

**Problem:**  
Inconsistent with category module. Clients may expect a UUID-based lookup to exist, especially when they have a tag ID from a previous response.

**Recommendation:**  
Either:

1. **Add the endpoint** (recommended if consistent with overall API design):

```typescript
@Get(':id')
@Public()
@ApiOperation({ summary: 'Get a tag by ID' })
@ApiTagByIdResponse()
async getTagById(@Param('id', new ParseUUIDPipe({ version: '7' })) tagId: string) {
  const result = await this.tagApplicationService.getTagById(tagId);
  return this.presenter.getTagById(result);
}
```

2. **Or document the intentional omission** in module documentation

**Reasoning:**  
Consistency with sibling modules improves API predictability. However, if UUID lookups are intentionally not supported for tags (e.g., tags are only referenced by slug in the UI), this is acceptable.

**Breaking change risk:** None (adding new endpoint)

---

## Finding 7: UserTagController Uses @ApiTags('users')

**Category:** Naming Consistency  
**Severity:** Low

**Location:**  
- `src/modules/tag/transport/controllers/user-tag.controller.ts:17`

**Current behavior:**  
`@ApiTags('users')` is used despite being in the tag module:

```typescript
@ApiTags('users')
@Controller()
export class UserTagController {
  @Get('users/me/followed-tags')
  ...
}
```

**Problem:**  
While functionally correct (avoids routing conflicts with TagController's `:slug` wildcard), it's semantically confusing to have tag endpoints under the 'users' tag in OpenAPI documentation.

**Recommendation:**  
Change to `@ApiTags('tags')` to reflect the actual resource being operated on:

```typescript
@ApiTags('tags')
@Controller()
export class UserTagController {
  @Get('users/me/followed-tags')
  @ApiOperation({ summary: 'List tags followed by the authenticated user' })
  ...
}
```

**Reasoning:**  
OpenAPI tags should reflect the resource being operated on, not the route path. This makes the API documentation more intuitive for consumers.

**Breaking change risk:** None (OpenAPI documentation only)

---

## Finding 8: Unused Constant TAG_UNIQUE_CONFLICT_MESSAGE

**Category:** Redundancy  
**Severity:** Low

**Location:**  
- `src/modules/tag/tag.constants.ts:6`

**Current behavior:**  
`TAG_UNIQUE_CONFLICT_MESSAGE` is defined but never used:

```typescript
export const TAG_SLUG_EMPTY_MESSAGE = 'Tag slug cannot be empty';

export const TAG_SLUG_INVALID_MESSAGE =
  'Tag slug must be lowercase and can only contain letters, numbers, and hyphens';

export const TAG_UNIQUE_CONFLICT_MESSAGE = 'Tag name or slug already exists';
```

The `TagSlugConflictError` uses its own message: `'A tag with this slug already exists'`.

**Problem:**  
Dead code that adds maintenance burden without value.

**Recommendation:**  
Remove `TAG_UNIQUE_CONFLICT_MESSAGE` from `tag.constants.ts`.

**Reasoning:**  
Eliminating unused code reduces cognitive load and prevents confusion during future development.

**Breaking change risk:** None

---

## Finding 9: TagRankingQueryDto Default Value Inconsistency

**Category:** Maintainability  
**Severity:** Low

**Location:**  
- `src/modules/tag/dto/request/tag-ranking-query.dto.ts:17`

**Current behavior:**  
Uses property initializer for default:

```typescript
limit: number = 10;
```

While `ListTagsQueryDto` and `ListFollowedTagsQueryDto` rely on `??` fallback in service code.

**Problem:**  
Inconsistent pattern for handling default values across similar DTOs within the same module.

**Recommendation:**  
Choose one pattern consistently - either:

1. **Use class property defaults** in all ranking/list DTOs, or
2. **Use `??` fallback in service code** for all queries

The service code already handles defaults:

```typescript
const limit = query.limit ?? 10;  // in TagDomainService
```

Remove the property initializer and rely on service-level defaults for consistency.

**Reasoning:**  
Consistent patterns make code easier to read and maintain. Service-level defaults provide a single source of truth.

**Breaking change risk:** None

---

## Finding 10: Event Emission on Idempotent Follow

**Category:** Business Semantics  
**Severity:** Improvement

**Location:**  
- `src/modules/tag/infrastructure/repositories/tag-follow.repository.ts:24-38`
- `src/modules/tag/domain/tag.service.ts:262-275`

**Current behavior:**  
When following a tag that is already followed, the repository returns the existing follow without creating new records:

```typescript
if (existingActiveFollow) {
  return existingActiveFollow;  // Returns without throwing
}
```

The `TagFollowedEvent` is emitted even when the user was already following the tag:

```typescript
this.eventBus.emitTagFollowed(new TagFollowedEvent(userId, tagId, follow.followId, nowIso));
```

**Problem:**  
Event emission on no-op operations can cause cascading side effects (notifications, analytics) to fire unnecessarily or incorrectly.

**Recommendation:**  
Track whether the follow was actually created or was a no-op, and only emit the event when truly new:

```typescript
async followTag(userId: string, tagId: string): Promise<{ followId: string; isNew: boolean }> {
  // ... existing logic ...
  if (existingActiveFollow) {
    return { followId: existingActiveFollow.followId, isNew: false };
  }
  // ... restore or create logic ...
  return { followId: result.followId, isNew: true };
}
```

Then in the domain service:

```typescript
const result = await this.tagFollowRepository.followTag({ userId, tagId, nowIso });
if (result.isNew) {
  this.eventBus.emitTagFollowed(new TagFollowedEvent(userId, tagId, result.followId, nowIso));
}
```

**Reasoning:**  
Events should represent actual state changes, not idempotent confirmations. This pattern is already used in `unfollowTag()` where the event is conditional on `result.unfollowed`.

**Breaking change risk:** Low (behavior change only affects event consumers)

---

## Priority Order for Implementation

1. **Finding 5** - Missing Swagger documentation (quick fix, improves DX immediately)
2. **Finding 8** - Remove unused constant (cleanup)
3. **Finding 4** - Remove unused sort/order parameters (cleanup)
4. **Finding 7** - Fix OpenAPI tag naming (documentation consistency)
5. **Finding 1** - Align follow/unfollow with category (requires more planning, affects API contract)
6. **Finding 2** - Replace custom pagination wrapper (refactoring)
7. **Finding 3** - DTO consistency (depends on Finding 1)
8. **Finding 9** - Default value consistency (cleanup)
9. **Finding 6** - Add GET /tags/:id endpoint (new feature)
10. **Finding 10** - Event emission on idempotent operations (refinement)

---

## Conclusion

The tag module is well-architected and follows the overall patterns of the codebase. The primary concerns are:

1. **Cross-module consistency** with the category module, particularly around follow/unfollow behavior and response handling
2. **Documentation accuracy** - ensuring Swagger contracts match actual behavior
3. **Dead code cleanup** - removing unused parameters and constants

All findings are addressable without breaking changes to the core functionality. The module is production-ready pending resolution of the documented findings.
