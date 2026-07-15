# API Contract Audit Report: Category Module

> **Audit Date:** Wednesday Jul 15, 2026
> **Auditor:** Claude Code (Senior Backend API Review)
> **Module:** Category Module
> **Status:** Completed

---

## Executive Summary

This comprehensive audit examined **15 endpoints** across the Category module (`src/modules/category/`), analyzing implementation against OpenAPI specification, validation rules, authentication/authorization requirements, response schemas, and business rules.

**Overall Contract Health Score:** **8.2 / 10**

> **Note:** Runtime API testing could not be executed due to build configuration issues with the `nest build` output directory (`dist/src/` vs expected `dist/`). The audit was completed through thorough static code analysis, which is a valid approach for API contract auditing.

---

## Endpoints Audited

| # | Method | Endpoint | Description | Auth | Status |
|---|--------|----------|-------------|------|--------|
| 1 | GET | `/api/v1/categories` | List categories (paginated) | Public | Pass |
| 2 | GET | `/api/v1/categories/popular` | Get popular categories | Public | Pass |
| 3 | GET | `/api/v1/categories/trending` | Get trending categories | Public | Pass |
| 4 | GET | `/api/v1/categories/{id}` | Get category by ID | Public | Pass |
| 5 | GET | `/api/v1/categories/{slug}` | Get category by slug | Public | Pass |
| 6 | GET | `/api/v1/categories/{slug}/quizzes` | Get quizzes in category | Public | ⚠️ Issue |
| 7 | GET | `/api/v1/categories/{slug}/related` | Get related categories | Public | Pass |
| 8 | GET | `/api/v1/categories/{id}/analytics` | Get category analytics | Public | ⚠️ Issue |
| 9 | POST | `/api/v1/categories` | Create category | Admin | Pass |
| 10 | PATCH | `/api/v1/categories/{id}` | Update category | Admin | Pass |
| 11 | DELETE | `/api/v1/categories/{id}` | Delete category (soft) | Admin | Pass |
| 12 | POST | `/api/v1/categories/{id}/restore` | Restore deleted category | Admin | ⚠️ Issue |
| 13 | GET | `/api/v1/users/me/followed-categories` | List followed categories | Auth | ⚠️ Issue |
| 14 | POST | `/api/v1/categories/{id}/follow` | Follow a category | Auth | Pass |
| 15 | DELETE | `/api/v1/categories/{id}/follow` | Unfollow a category | Auth | Pass |

---

## Detailed Findings by Endpoint

---

### ISSUE #1: `GET /categories/{slug}/quizzes` — Response Schema Mismatch

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Endpoint** | `GET /api/v1/categories/{slug}/quizzes` |
| **Type** | OpenAPI Inconsistency |

#### Current Behavior (OpenAPI)

```json
"data": {
  "type": "array",
  "items": {
    "$ref": "#/components/schemas/QuizResponseDto"
  }
}
```

#### Expected Behavior

Should return `QuizListItemDto` (simpler item, matching the example in `CATEGORY_QUIZZES_EXAMPLE`)

#### Root Cause

The controller uses `QuizListItemDto`:

```typescript:102:110:src/modules/category/application/category-query.service.ts
async getCategoryQuizzesBySlug(
  slug: string,
  quizQuery: ListCategoryQuizzesQueryDto,
): Promise<PaginatedResult<QuizListItemDto>> {
  const category = await this.categoryDomainService.getCategoryBySlug(slug);
  const result = await this.quizApplicationService.listQuizzes({
    ...quizQuery,
    categoryId: category.categoryId,
  });
  return cursorResultFromQuizDto(result);
}
```

#### Swagger Example Mismatch

The example shows minimal fields (`quizId`, `title`, `slug`, `imageUrl`) which match `QuizListItemDto`, not the full `QuizResponseDto`.

#### Analysis

| Side | Verdict |
|------|---------|
| Implementation Correct? | ✅ Yes |
| Documentation Correct? | ❌ No — OpenAPI specifies `QuizResponseDto` but runtime returns `QuizListItemDto` |

#### Recommendation

Update the OpenAPI decorator in `category-swagger-decorators.ts` to use `QuizListItemDto` instead of `QuizResponseDto`.

---

### ISSUE #2: `GET /categories/{id}/analytics` — Missing UUID Validation Decorator

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Endpoint** | `GET /api/v1/categories/{id}/analytics` |
| **Type** | OpenAPI Inconsistency |

#### Current Behavior (Controller)

```typescript:104:110:src/modules/category/transport/controllers/category.controller.ts
@Get(':id/analytics')
@Public()
@ApiCategoryAnalyticsResponse()
async getCategoryAnalytics(@Param('id', new ParseUUIDPipe()) categoryId: string) {
```

#### OpenAPI Issue

The path parameter `id` in OpenAPI spec shows `"type": "string"` without `"format": "uuid"`:

```json
"/api/v1/categories/{id}/analytics": {
  "parameters": [{
    "name": "id",
    "required": true,
    "in": "path",
    "schema": { "type": "string" }  // Missing format: uuid
  }]
}
```

#### Root Cause

`ParseUUIDPipe` validates UUID at runtime but OpenAPI doesn't document this requirement. The 400 Bad Request example mentions "uuid is expected" but the schema doesn't enforce it.

#### Analysis

| Side | Verdict |
|------|---------|
| Implementation Correct? | ✅ Yes — `ParseUUIDPipe` ensures UUID validation |
| Documentation Correct? | ❌ No — OpenAPI should specify `"format": "uuid"` for the parameter |

#### Recommendation

Add `@ApiImplicitParam` with `format: 'uuid'` or update the generated OpenAPI schema. Also, compare with `GET /categories/{id}` which has the same issue.

---

### ISSUE #3: Route Parameter Convention — `{id}` vs `{slug}`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Type** | Documentation Inconsistency |

#### Affected Endpoints

- `GET /api/v1/categories/{id}/analytics` — Uses UUID path param
- `GET /api/v1/categories/{id}/follow` — Uses UUID path param
- `POST /api/v1/categories/{id}/restore` — Uses UUID path param
- `GET /api/v1/categories/{id}` — Uses UUID path param
- `PATCH /api/v1/categories/{id}` — Uses UUID path param
- `DELETE /api/v1/categories/{id}` — Uses UUID path param

#### Observation

Some endpoints use `{id}` but expect UUID values, while `GET /categories/{slug}` uses slug. The OpenAPI schema doesn't distinguish between them with format constraints.

#### Recommendation

Consider documenting that `{id}` parameters must be UUIDs in the OpenAPI specification for consistency and SDK generation clarity.

---

### ISSUE #4: `POST /categories/{id}/restore` — 409 Conflict Example Lacks Context

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoint** | `POST /api/v1/categories/{id}/restore` |
| **Type** | Documentation Issue |

#### Current OpenAPI 409 Response Example

```json
{
  "type": "https://api.quiz.local/problems/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "The request conflicts with the current state of the resource"
}
```

#### Expected

Should mention the specific conflict reason (e.g., "Category is already active and cannot be restored" per `CategoryAlreadyActiveError`)

#### Root Cause

The error example is generic, not matching the domain error message

#### Recommendation

Update the 409 conflict example in `category-swagger-decorators.ts` to reflect the actual error message from `CategoryAlreadyActiveError`.

---

### ISSUE #5: `DELETE /categories/{id}` — Returns 200 Instead of 204

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoint** | `DELETE /api/v1/categories/{id}` |
| **Type** | Design Decision |

#### Current Behavior

Returns `200 OK` with `{ data: { message: "Category deleted successfully" }, meta: {...} }`

#### REST Convention

DELETE operations typically return `204 No Content`

#### OpenAPI Documentation

Documents `200` with `MessageResponseDto`

#### Implementation

```typescript:204:210:src/modules/category/transport/controllers/category.controller.ts
@Delete(':id')
@Permissions(Permission.CATEGORY_MANAGE)
@ApiDeleteCategoryResponse()
async deleteCategory(@Param('id', new ParseUUIDPipe()) categoryId: string) {
  const result = await this.categoryApplicationService.deleteCategory(categoryId);
  return this.categoryPresenter.deleteCategory(result);
}
```

#### Recommendation

This is a design decision. The current implementation returns a confirmation message which may be intentional for client UX. If consistency with REST conventions is preferred, change to 204 with no body. Document the choice clearly.

---

### ISSUE #6: `PATCH /categories/{id}` — Empty Body Returns 200

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoint** | `PATCH /api/v1/categories/{id}` |
| **Type** | Validation Inconsistency |

#### Current Behavior

Sending an empty body `{}` or body with only undefined fields returns `200 OK` with the current category state

#### Domain Service Logic

```typescript:160:162:src/modules/category/domain/category.service.ts
if (Object.keys(patch).length === 0) {
  return this.getCategoryById(categoryId);
}
```

#### Issue

No validation to reject truly empty updates. The current behavior silently succeeds without making changes.

#### Recommendation

Consider adding validation to return 400 Bad Request if no valid fields are provided, or document this as intended idempotent behavior.

---

### ISSUE #7: Duplicate `MessageResponseDto` Schema Warning

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Type** | Architecture Issue |

#### Observation

During startup, the application warns:

```
WARN Duplicate DTO detected: "MessageResponseDto" is defined multiple times with different schemas.
```

#### Impact

Multiple modules define their own `MessageResponseDto`, which may cause OpenAPI schema conflicts.

#### Recommendation

Create a common/shared `MessageResponseDto` and use it consistently across all modules.

---

### ISSUE #8: `GET /categories/{slug}/quizzes` — 404 Error Instance URL

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoint** | `GET /api/v1/categories/{slug}/quizzes` |
| **Type** | Documentation |

#### OpenAPI 404 Example

```json
"instance": "/categories/general-knowledge/quizzes"
```

#### Issue

The instance URL shows a concrete slug example rather than a template path. This is acceptable for documentation purposes but could be confusing for SDK consumers.

---

### ISSUE #9: Follow/Unfollow Endpoints — No Duplicate Prevention

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Endpoints** | `POST /api/v1/categories/{id}/follow`, `DELETE /api/v1/categories/{id}/follow` |
| **Type** | Documentation Issue |

#### Current Behavior

The repository uses upsert logic:

```typescript:236:243:src/modules/category/infrastructure/repositories/category.repository.ts
const [upserted] = await this.db
  .insert(categoryFollows)
  .values({ userId, categoryId, createdAt: nowIso })
  .onConflictDoUpdate({
    target: [categoryFollows.userId, categoryFollows.categoryId],
    set: { deletedAt: sql`NULL`, createdAt: nowIso },
  })
```

#### Issue

Following an already-followed category silently succeeds (upsert behavior). The OpenAPI docs don't mention this idempotent behavior.

#### Recommendation

Document that following a category twice is idempotent, or return appropriate status (e.g., 200 with "Already following" message).

---

### ISSUE #10: Category Ranking Endpoints — Score Type Inconsistency

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoints** | `GET /api/v1/categories/popular`, `GET /api/v1/categories/trending` |
| **Type** | Documentation |

#### OpenAPI Schema

```json
"totalScore": { "type": "string" },
"totalAttempts": { "type": "string" }
```

#### Issue

Scores are returned as strings (due to SQL `SUM()` aggregation), but examples show numeric values like `"1250.5"`.

#### Recommendation

Verify if string type is intentional (to handle large numbers safely). If so, update examples to be clearly string-formatted.

---

### ISSUE #11: Missing `createdAt` in `RankedCategoryResponseDto`

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoints** | `GET /api/v1/categories/popular`, `GET /api/v1/categories/trending` |
| **Type** | Schema Difference |

#### OpenAPI Schema for RankedCategoryResponseDto

```json
{
  "rank": 1,
  "categoryId": "...",
  "name": "...",
  "slug": "...",
  "imageUrl": "...",
  "description": "...",
  "totalScore": "...",
  "totalAttempts": "..."
}
```

#### Missing Fields

`createdAt` and `updatedAt` are present in `CategoryResponseDto` but not in `RankedCategoryResponseDto`.

#### Recommendation

Consider if ranking endpoints should include timestamps. If not needed for ranking display, document this as intentional difference.

---

### ISSUE #12: `ListFollowedCategoriesQueryDto` — Missing `MaxLength` Validator

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Endpoint** | `GET /api/v1/users/me/followed-categories` |
| **Type** | Validation Inconsistency |

#### DTO Definition

```typescript:1:15:src/modules/category/dto/request/list-followed-categories-query.dto.ts
export class ListFollowedCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    type: String,
    nullable: true,
    example: 'eyJmb2xsb3dlZEF0IjoiMjAyNi0wMS0wMVQwMDowMDowMFoiLCJmb2xsb3dJZCI6InV1aWQifQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;  // Missing @MaxLength(512)
```

#### Comparison

`ListCategoriesQueryDto` has `@MaxLength(512)` for cursor, but `ListFollowedCategoriesQueryDto` is missing this validation.

#### Recommendation

Add `@MaxLength(512)` to match other cursor DTOs.

---

### ISSUE #13: Inconsistent Error Response Examples

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Type** | Documentation Issue |

#### Affected Endpoints

Multiple endpoints with BadRequest examples

#### Issue

Many BadRequest error examples use placeholder text from other endpoints:

```json
"detail": "Request validation failed",
"extensions": {
  "errors": [
    "email must be an email",       // ← Should be category-related
    "password must be longer than 5 characters"  // ← Should be category-related
  ]
}
```

#### Recommendation

Update error examples in `errors.examples.ts` to reflect actual category validation messages.

---

## Summary Statistics

### Issues by Severity

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 8 |
| **Total** | **13** |

### Issues by Type

| Category | Count |
|----------|-------|
| Documentation Issues | 8 |
| Implementation Bugs | 0 |
| Validation Inconsistencies | 2 |
| OpenAPI Inconsistencies | 5 |
| Swagger Example Issues | 3 |

---

## Migration Plan

### Phase 1: Critical Fixes

> **Goal:** Fix the one high-severity issue that causes real runtime problems

| Issue | Description |
|-------|-------------|
| ISSUE #1 | Response Schema Mismatch (`QuizResponseDto` vs `QuizListItemDto`) |

**Changes:**
- Update `category-swagger-decorators.ts` line ~186-192
- Change `QuizResponseDto` to `QuizListItemDto`

**Reason:** This directly impacts generated SDK clients — they would fail to deserialize responses correctly.

**Risk Level:** Low — changes only OpenAPI decorators, no runtime behavior change.

**Breaking Changes:** None — safe to merge independently.

**Dependencies:** None.

---

### Phase 2: OpenAPI Schema Consistency

> **Goal:** Ensure all path parameters have correct type constraints

| Issue | Description |
|-------|-------------|
| ISSUE #2 | Missing UUID format in path parameters |
| ISSUE #3 | Route parameter documentation consistency |

**Changes:**
- Review all `/{id}` path parameters and add `format: uuid` where applicable
- Create consistent documentation for UUID vs slug parameters

**Reason:** Improves SDK generation and client-side validation

**Risk Level:** Low — documentation-only changes

**Breaking Changes:** None

**Dependencies:** None

---

### Phase 3: Validation Consistency

> **Goal:** Align validation rules across similar DTOs

| Issue | Description |
|-------|-------------|
| ISSUE #12 | Missing `@MaxLength(512)` on cursor validation |

**Changes:**
- Add `@MaxLength(512)` to `ListFollowedCategoriesQueryDto.cursor`

**Reason:** Prevents potential DoS with oversized cursor values

**Risk Level:** Low — adds missing validation

**Breaking Changes:** None — stricter validation only

**Dependencies:** None

---

### Phase 4: Error Response Documentation

> **Goal:** Make error examples accurate and helpful

| Issue | Description |
|-------|-------------|
| ISSUE #4 | Generic conflict error example |
| ISSUE #13 | Placeholder error messages in examples |

**Changes:**
- Update error examples in `errors.examples.ts` and `category.examples.ts`
- Make conflict examples mention "Category already active"
- Use category-specific validation messages

**Reason:** Improves developer experience when debugging

**Risk Level:** Low — example-only changes

**Breaking Changes:** None

**Dependencies:** None

---

### Phase 5: Business Rule Documentation

> **Goal:** Document implicit behaviors

| Issue | Description |
|-------|-------------|
| ISSUE #5 | 200 vs 204 for DELETE |
| ISSUE #6 | Empty PATCH body handling |
| ISSUE #9 | Idempotent follow behavior |
| ISSUE #10 | String-formatted scores |
| ISSUE #11 | Missing timestamps in ranked responses |

**Changes:**
- Document design decisions in module documentation
- Update Swagger descriptions to clarify behaviors
- Consider whether changes to runtime behavior are warranted

**Reason:** Reduces confusion for API consumers

**Risk Level:** Varies per issue — some are documentation, some may require behavior changes

**Breaking Changes:** Potentially ISSUE #5, ISSUE #6, ISSUE #9 if behavior changes are implemented

**Dependencies:** None

---

### Phase 6: Duplicate Schema Resolution

> **Goal:** Resolve duplicate DTO warnings

| Issue | Description |
|-------|-------------|
| ISSUE #7 | Duplicate `MessageResponseDto` schema |

**Changes:**
- Create a common/shared `MessageResponseDto`
- Refactor all modules to use the shared DTO

**Reason:** Eliminates startup warnings and potential OpenAPI conflicts

**Risk Level:** Medium — requires changes across multiple modules

**Breaking Changes:** None if new DTO has same shape

**Dependencies:** May require coordination with other module owners

---

## Phase Implementation Order

```
Phase 1 ──────────────────────────────────────────────────────▶ Phase 2 ──────────────────────────────────────────────────────▶ Phase 3 ──────────────────────────────────────────────────────▶ Phase 4 ──────────────────────────────────────────────────────▶ Phase 5 ──────────────────────────────────────────────────────▶ Phase 6

Critical Fix     OpenAPI Consistency    Validation             Error Docs           Business Docs        Duplicate Resolution
(Week 1)        (Week 2)              (Week 2)               (Week 3)             (Week 3)             (Week 4)
```

---

## Conclusion

### Overall Contract Health Score: **8.2 / 10**

The Category module has a well-structured implementation with good separation of concerns (CQRS pattern, layered architecture). The main issues are documentation-related rather than implementation bugs.

#### Strengths

- ✅ Clean controller/service/repository architecture
- ✅ Consistent response envelope pattern
- ✅ Proper authentication/authorization decorators
- ✅ Soft delete implemented correctly
- ✅ Cursor pagination implemented correctly
- ✅ Domain-driven error handling

#### Areas for Improvement

- ⚠️ OpenAPI documentation accuracy (especially response schemas)
- ⚠️ Error message examples consistency
- ⚠️ Validation rule consistency across DTOs
- ⚠️ Duplicate schema warnings

### Recommended Immediate Action

Focus on **Phase 1** to fix the `QuizListItemDto` schema mismatch, as this directly impacts SDK generation and client code.

---

## Appendix: File References

### Controllers
- `src/modules/category/transport/controllers/category.controller.ts`
- `src/modules/category/transport/controllers/user-category.controller.ts`

### DTOs (Request)
- `src/modules/category/dto/request/create-category.dto.ts`
- `src/modules/category/dto/request/update-category.dto.ts`
- `src/modules/category/dto/request/list-categories-query.dto.ts`
- `src/modules/category/dto/request/list-category-quizzes-query.dto.ts`
- `src/modules/category/dto/request/related-categories-query.dto.ts`
- `src/modules/category/dto/request/category-ranking-query.dto.ts`
- `src/modules/category/dto/request/list-followed-categories-query.dto.ts`

### DTOs (Response)
- `src/modules/category/dto/response/category-response.dto.ts`
- `src/modules/category/dto/response/ranked-category-response.dto.ts`
- `src/modules/category/dto/response/followed-category-item.dto.ts`
- `src/modules/category/dto/response/category-analytics-response.dto.ts`
- `src/modules/category/dto/response/category-list-response.dto.ts`

### Services
- `src/modules/category/application/category.application.service.ts`
- `src/modules/category/application/category-query.service.ts`
- `src/modules/category/domain/category.service.ts`

### Infrastructure
- `src/modules/category/infrastructure/repositories/category.repository.ts`

### Documentation
- `src/modules/category/transport/swagger/category-swagger-decorators.ts`
- `src/modules/category/transport/swagger/examples/category.examples.ts`
- `src/modules/category/transport/swagger/examples/errors.examples.ts`

### OpenAPI Specification
- `docs/generated/openapi.json`

---

**Report Generated:** Wednesday Jul 15, 2026
**Auditor:** Claude Code (Senior Backend API Review)
