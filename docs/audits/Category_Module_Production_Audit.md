# Category Module Production-Readiness Audit

**Date:** Tuesday, July 28, 2026
**Module:** `src/modules/category`
**Status:** Production-Ready with minor issues

---

## Summary

The category module is well-architected with proper CQRS separation, comprehensive error handling, and solid OpenAPI documentation. However, several issues were identified ranging from **critical data consistency risks** to minor inconsistencies.

---

## Finding 1: Missing `@Transactional` Decorator on Write Operations

| Field | Value |
|-------|-------|
| **Category** | Domain Model Consistency |
| **Severity** | High |
| **Location** | `src/modules/category/transport/controllers/category.controller.ts` lines 117-139 |

### Current Behavior

The `POST /categories/:id/follow` and `DELETE /categories/:id/follow` endpoints lack the `@Transactional()` decorator.

```typescript
@Delete(':id/follow')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
async unfollowCategory(
  @Param('id', new ParseUUIDPipe({ version: '7' })) categoryId: string,
  @CurrentUser() user: JwtPayload,
) {
  const result = await this.categoryApplicationService.unfollowCategory(user.sub, categoryId);
  return this.categoryPresenter.unfollowCategory(result);
}
```

### Problem

These endpoints perform multiple database writes (upsert + log + cache invalidation). Without `@Transactional()`, a failure after the first write could leave the system in an inconsistent state. Other modules in the codebase consistently use `@Transactional()` on similar operations:

- `SocialController`: all friend/block/follow operations have `@Transactional()`
- `InstanceController`: all state-changing operations have `@Transactional()`

### Recommendation

Add `@Transactional()` decorator to both `followCategory` and `unfollowCategory` controller methods.

### Reasoning

While the follow operation uses `onConflictDoUpdate` which is atomic at the DB level, the application layer performs additional writes (event emission, logging). Transactional boundary ensures all-or-nothing semantics.

### Breaking Change Risk

**Low** - Internal behavior only.

---

## Finding 2: Inconsistent HTTP Status Codes for Action Endpoints

| Field | Value |
|-------|-------|
| **Category** | HTTP Status Codes |
| **Severity** | Medium |
| **Location** | `src/modules/category/transport/controllers/category.controller.ts` lines 121-139 |

### Current Behavior

Follow and unfollow endpoints return `200 OK` with a `{ message: "..." }` body:

```typescript
async followCategory(
  @Param('id', new ParseUUIDPipe({ version: '7' })) categoryId: string,
  @CurrentUser() user: JwtPayload,
) {
  const result = await this.categoryApplicationService.followCategory(user.sub, categoryId);
  return this.categoryPresenter.followCategory(result);
}
```

### Problem

The social module uses a different pattern for identical operations:

- `POST /social/follow/:userId` → `204 No Content`
- `DELETE /social/follow/:userId` → `204 No Content`

This inconsistency makes the API feel designed by different teams.

### Recommendation

Consider adopting the social module's pattern:

1. Change `followCategory`/`unfollowCategory` to return `Promise<void>`
2. Return `204 No Content` (idempotent behavior already documented)
3. Update presenters and swagger decorators accordingly

### Reasoning

RESTful best practice for idempotent actions without a resource to return is 204. The current 200 with message body is acceptable but inconsistent with the rest of the API.

### Breaking Change Risk

**Medium** - Clients expecting 200 with body would need updating.

---

## Finding 3: Route Collision Vulnerability with UUID Slugs

| Field | Value |
|-------|-------|
| **Category** | REST API Design |
| **Severity** | Medium |
| **Location** | `src/modules/category/transport/controllers/category.controller.ts` lines 164-180 |

### Current Behavior

```typescript
@Get(':id')
@Public()
@ApiOperation({ summary: 'Get a category by ID' })
async getCategoryById(@Param('id', new ParseUUIDPipe({ version: '7' })) categoryId: string) {

@Get(':slug')
@Public()
@ApiOperation({ summary: 'Get a category by slug' })
async getCategoryBySlug(@Param('slug') slug: string) {
```

### Problem

Both `:id` and `:slug` routes exist in the same controller. The system relies on UUID validation to disambiguate:

- Valid UUID → routed to `getCategoryById`
- Invalid UUID → routed to `getCategoryBySlug`

If someone creates a category with a slug that happens to be a valid UUID (e.g., `science` vs `660e8400-e29b-71d4-a716-446655440000`), the wrong handler is invoked.

### Recommendation

1. Keep the current UUID validation approach as it's a valid pattern
2. Add explicit slug format validation in `getCategoryBySlug`
3. Consider documenting that slugs cannot be valid UUIDs, OR
4. Validate slug format (lowercase, alphanumeric, hyphens) before routing

### Reasoning

This is a known trade-off in NestJS route ordering. The current implementation is fragile but commonly used. A more robust solution would require restructuring the controller.

### Breaking Change Risk

**Low** - Defensive behavior improvement.

---

## Finding 4: Internal Implementation Detail in Error Message

| Field | Value |
|-------|-------|
| **Category** | Error Handling |
| **Severity** | Low |
| **Location** | `src/modules/category/domain/category.service.ts` line 267 |

### Current Behavior

```typescript
throw new CategoryFollowNotFoundError(`You are not following category ${categoryId}`);
```

### Problem

The `CategoryFollowNotFoundError` is constructed with the category ID in the message, which will be exposed in the API response's `detail` field. This leaks an internal implementation detail (UUIDs) to clients.

### Recommendation

Use the generic message without the category ID:

```typescript
throw new CategoryFollowNotFoundError();
```

The error class already has a default message: "You are not following this category"

### Reasoning

Error messages should be user-friendly and not expose internal identifiers. The current approach may help debugging but reveals internal structure to clients.

### Breaking Change Risk

**None**

---

## Finding 5: Swagger Examples Missing `name` Field

| Field | Value |
|-------|-------|
| **Category** | Swagger / OpenAPI |
| **Severity** | Low |
| **Location** | `src/modules/category/transport/swagger/examples/category.examples.ts` lines 113-133 |

### Current Behavior

```typescript
export const CATEGORY_FOLLOWED_LIST_EXAMPLE = {
  data: [
    {
      categoryId: '660e8400-e29b-71d4-a716-446655440000',
      slug: 'general-knowledge',
      imageUrl: 'https://example.com/images/general-knowledge.jpg',
      description: 'Test your knowledge across a wide range of topics',
      followedAt: '2025-06-05T14:30:00.000Z',
    },
  ],
```

### Problem

The `FollowedCategoryItemDto` includes a `name` field, but the example is missing it. This will cause Swagger UI to display incomplete examples.

### Recommendation

Add the `name` field to `CATEGORY_FOLLOWED_LIST_EXAMPLE`:

```typescript
{
  categoryId: '660e8400-e29b-71d4-a716-446655440000',
  name: 'General Knowledge',  // <-- Missing
  slug: 'general-knowledge',
  ...
}
```

### Reasoning

Examples should match the actual response schema. Incomplete examples confuse API consumers.

### Breaking Change Risk

**None**

---

## Finding 6: Deprecated Re-export File Still Present

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Severity** | Low |
| **Location** | `src/modules/category/dto/response/message-response.dto.ts` |

### Current Behavior

```typescript
/**
 * @deprecated Use {@link MessageResponseDto} from `@/common/swagger/swagger-schemas` instead.
 * This file is kept for backward compatibility.
 */
export { MessageResponseDto } from '@/common/swagger/swagger-schemas';
```

### Problem

The file is marked deprecated but still exists. If no code imports from this path, it's dead weight. If code does import from it, those imports should be migrated.

### Recommendation

Search for imports from this path and migrate them, then delete the file:

```bash
grep -r "category/dto/response/message-response" src/
```

### Reasoning

Deprecated files create confusion and maintenance burden. Either use them or remove them.

### Breaking Change Risk

**Medium** - Requires finding and updating any imports.

---

## Finding 7: Inconsistent Swagger Auth Decorator Pattern

| Field | Value |
|-------|-------|
| **Category** | Swagger / OpenAPI |
| **Severity** | Improvement |
| **Location** | `src/modules/category/transport/controllers/category.controller.ts` and `category-swagger-decorators.ts` |

### Current Behavior

The category module uses explicit decorator composition:

```typescript
ApiBearerAuth(AUTH_SECURITY_NAME),
ApiOkResource(MessageResponseDto, {
  description: DESCRIPTIONS.categoryFollow,
  example: CATEGORY_FOLLOW_MESSAGE_EXAMPLE,
}),
ApiBadRequestResponse(problem.badRequest(followBadRequestExample)),
```

### Problem

Other modules use centralized decorators like `@ApiAuth()`.

### Recommendation

Consider extracting common auth/error patterns into a shared decorator, but this is a code quality improvement rather than a bug.

### Reasoning

This is a style inconsistency, not a functional issue. The current approach gives more control but requires more boilerplate.

### Breaking Change Risk

**None**

---

## Finding 8: Default Limit Consistency Across Modules

| Field | Value |
|-------|-------|
| **Category** | Request & Response Consistency |
| **Severity** | Improvement |
| **Location** | `src/modules/category/domain/category.service.ts` line 63 |

### Current Behavior

```typescript
const limit = query.limit ?? 10;
```

### Problem

The category module defaults to 10 items per page, while other modules may use different defaults (e.g., quiz module uses 20).

### Recommendation

Document the default limit of 10 in the OpenAPI schema for `ListCategoriesQueryDto`.

### Reasoning

Explicit documentation prevents client confusion about default behavior.

### Breaking Change Risk

**None**

---

## Positive Observations

The category module demonstrates several **best practices**:

### 1. CQRS Separation
Clean separation between `CategoryApplicationService` (write) and `CategoryQueryService` (read).

### 2. Comprehensive Error Taxonomy
Well-designed error hierarchy with specific codes:
- `CATEGORY_NOT_FOUND`
- `CATEGORY_FOLLOW_NOT_FOUND`
- `CATEGORY_SLUG_CONFLICT`
- `CATEGORY_ALREADY_ACTIVE`
- `CATEGORY_RESTORE_INVARIANT`
- `CATEGORY_ANALYTICS_NOT_FOUND`

### 3. RFC 7807 Compliance
Proper Problem Details response structure with `type`, `title`, `status`, `detail`, and `instance`.

### 4. Swagger Documentation
Thorough examples with endpoint-correct `instance` paths.

### 5. Idempotency
Follow operation correctly documented as idempotent with proper behavior.

### 6. Cursor Pagination
Consistent cursor-based pagination implementation.

### 7. Domain Events
Proper event emission for state changes.

### 8. Soft Delete with Restore
Thoughtful restoration pattern with `CategoryAlreadyActiveError` to prevent double-restore.

---

## Risk Assessment Summary

| Finding | Severity | Breaking Change | Priority |
|---------|----------|-----------------|----------|
| Missing @Transactional | High | Low | Fix first |
| Inconsistent HTTP status codes | Medium | Medium | Consider |
| Route collision vulnerability | Medium | Low | Monitor |
| Error message internal details | Low | None | Fix |
| Swagger example missing field | Low | None | Fix |
| Deprecated re-export file | Low | Medium | Clean up |
| Auth decorator pattern | Improvement | None | Nice to have |
| Default limit documentation | Improvement | None | Nice to have |

---

## Conclusion

The module is **production-ready** with the primary concern being the missing `@Transactional()` decorator on write operations. The other findings are refinements rather than blockers.

**Recommended immediate action:** Add `@Transactional()` to follow/unfollow endpoints to ensure data consistency.
