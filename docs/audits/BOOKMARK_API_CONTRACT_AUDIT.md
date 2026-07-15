# Bookmark Module — API Contract Audit

> Comprehensive API contract audit of the `bookmark` module.
> Compares implementation, OpenAPI specification, Swagger UI, validation rules, authorization rules, examples, and actual runtime behavior.
> Generated from a senior-backend-API-review perspective. No code was modified during this audit; this document is the deliverable.

---

## 1. Executive Summary

### Overall Contract Health Score: **5.5 / 10**

The `bookmark` module is functionally working and follows most naming/structural conventions, but has several **critical implementation bugs** (Drizzle error wrapping, schema migration, soft-delete mismatch), **response shape mismatches** (search/recent pagination, `quizCount` type), and **systemic documentation gaps** (zero Swagger success examples, missing `400` responses, missing module-level OpenAPI spec).

| Metric | Value |
|---|---|
| **Endpoints audited** | 16 |
| **Total issues found** | 27 |
| **Critical** | 4 |
| **High** | 7 |
| **Medium** | 10 |
| **Low** | 6 |
| **Documentation issues** | 14 |
| **Implementation bugs** | 8 |
| **Validation inconsistencies** | 3 |
| **OpenAPI inconsistencies** | 11 |
| **Swagger success-example issues** | 16 (every endpoint) |
| **Module-level OpenAPI regression test** | Missing |
| **E2E test files for the module** | None |

### Source-of-truth hierarchy applied

Per `docs/PROJECT_CONSTITUTION.md`, the hierarchy is:

1. **Implementation** (compiled TypeScript) — authoritative for runtime behavior.
2. **Tests** — second authority.
3. **OpenAPI** — wire contract.
4. **Docs** (`docs/modules/bookmark.md`) — descriptive only.

When two sources disagreed during the audit, this hierarchy was applied to determine which side should be corrected.

---

## 2. Module Overview

| Resource | Description |
|---|---|
| `BookmarkCollection` | User-owned, named container for bookmarks |
| `Bookmark` | The `collectionId ↔ quizId` membership row |
| `BookmarkStatus` | Cross-collection existence check for a quiz |
| `CollectionAnalytics` | Aggregated stats per collection (count, rating, top categories/tags) |
| `UserBookmarkStats` | Aggregated stats for the current user |

All endpoints require a valid JWT. Ownership is enforced at the application-service layer (`BookmarkCommandService.getOwnedCollectionOrThrow` allows the owner or admin).

---

## 3. Endpoint Inventory

| # | Method | Path | Summary |
|---|---|---|---|
| 1 | GET | `/api/v1/bookmarks/search` | Search bookmarks |
| 2 | GET | `/api/v1/bookmarks/recent` | Get recent bookmarks |
| 3 | GET | `/api/v1/bookmarks/quizzes/{quizId}/status` | Get bookmark status for a quiz |
| 4 | GET | `/api/v1/bookmarks/collections` | List bookmark collections |
| 5 | POST | `/api/v1/bookmarks/collections` | Create collection |
| 6 | GET | `/api/v1/bookmarks/collections/{collectionId}` | List bookmarks in a collection |
| 7 | PATCH | `/api/v1/bookmarks/collections/{collectionId}` | Update collection |
| 8 | DELETE | `/api/v1/bookmarks/collections/{collectionId}` | Delete collection |
| 9 | GET | `/api/v1/bookmarks/collections/{collectionId}/analytics` | Get collection analytics |
| 10 | POST | `/api/v1/bookmarks/collections/{collectionId}/quizzes` | Add bookmark |
| 11 | POST | `/api/v1/bookmarks/collections/{collectionId}/quizzes/bulk` | Bulk add |
| 12 | DELETE | `/api/v1/bookmarks/collections/{collectionId}/quizzes/bulk` | Bulk remove |
| 13 | DELETE | `/api/v1/bookmarks/collections/{collectionId}/quizzes/{quizId}` | Remove bookmark |
| 14 | PATCH | `/api/v1/bookmarks/collections/{collectionId}/quizzes/{quizId}` | Update bookmark |
| 15 | POST | `/api/v1/bookmarks/collections/{collectionId}/move` | Move bookmark |
| 16 | GET | `/api/v1/bookmarks/me/stats` | Get my bookmark statistics |

---

## 4. Findings by Severity

### 4.1 Critical

#### C1. Duplicate-collection-name returns 500 instead of 409 (Drizzle error-wrapping bug)

- **Endpoint**: `POST /api/v1/bookmarks/collections`, `PATCH /api/v1/bookmarks/collections/{collectionId}`
- **Current behavior**: When a user creates a collection whose name collides with an existing one (constraint `uq_bookmark_collections_user_name`), the API returns `500 GLOBAL_INTERNAL_ERROR` with a Drizzle-wrapped `pg` error. The error body includes `"Cause chain: [{\"name\":\"error\",\"message\":\"duplicate key value violates unique constraint\",\"code\":\"23505\"}]"`.
- **Documented behavior**: The OpenAPI spec documents `409 Conflict` with the description *"A collection with this name already exists"* (and `CollectionConflictError` is mapped to `409 COLLECTION_CONFLICT` in `ProblemCodeMapping`).
- **Root cause**: `bookmark-command.service.ts:94,129` checks `pgError.code === '23505'`. The thrown error is a `DrizzleQueryError` whose `code` is nested inside `error.cause.code`. The same pattern is also broken in:
  - `addBookmark` (`bookmark-command.service.ts:186`) — duplicate bookmark returns 500 instead of 409.
  - `addBookmarksBulk` (`bookmark-command.service.ts:219`) — `isPostgresForeignKeyViolation(error)` is similarly unaware of Drizzle's wrapping.
- **Implementation correct?** No.
- **Documentation correct?** Yes.
- **Recommendation**: Fix the implementation. Update `src/common/utils/db-error.util.ts` so the helpers walk the `cause` chain.
- **Suggested fix** (illustrative — to be discussed in the implementing PR):

```typescript
// src/common/utils/db-error.util.ts
function getPgCode(error: unknown): string | undefined {
  let cur: unknown = error;
  while (cur && typeof cur === 'object') {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return getPgCode(error) === POSTGRES_UNIQUE_VIOLATION_CODE;
}
```

- **Migration safety**: Safe implementation fix. Breaking only in the sense that 500 → 409 is now returned (the new behavior matches the documented contract; clients will not break).

---

#### C2. Schema drift: `quizzes.category_id` column missing in DB

- **Endpoint**: `GET /api/v1/bookmarks/me/stats`, `GET /api/v1/bookmarks/collections/{collectionId}/analytics`
- **Current behavior**: When these endpoints attempt to read a `category_id` column that does not exist in the running PostgreSQL, they emit `column quizzes.category_id does not exist`. After migration `0006_remarkable_karma.sql` is applied, the endpoints start working — but the project ships in a broken state for any developer that has only the base migrations applied.
- **Documented behavior**: Both endpoints are documented in OpenAPI as 200 OK and expected to work.
- **Root cause**: The Drizzle schema (`src/core/database/schema/quiz/schema.ts:103`) declares `categoryId: uuid('category_id')` on `quizzes`, and migration `0006_remarkable_karma.sql` exists, but the Drizzle migration journal records `0006_...` as the next entry. The DB in this audit session had the `quiz_categories` join table still present and no `category_id` column on `quizzes`, proving that `0006_remarkable_karma.sql` was not applied at provisioning time.
- **Implementation correct?** No (the implementation matches the Drizzle schema, but the Drizzle schema and the actual DB are out of sync).
- **Documentation correct?** Yes.
- **Recommendation**: Run `pnpm db:migrate` to apply the missing migration. Add a CI step that asserts `drizzle-kit introspect` matches the committed schema, or a startup hook that checks for the column's existence before serving traffic.
- **Migration safety**: Safe — applies a long-existing migration that has already been written and reviewed. The public API does not change.

---

#### C3. Search and recent endpoints wrap the wrong payload in the envelope

- **Endpoint**: `GET /api/v1/bookmarks/search`, `GET /api/v1/bookmarks/recent`
- **Current behavior**: Runtime returns `{ data: { items: [...], pagination: {...} }, meta: { timestamp } }`. There is no `meta.pagination` and the pagination block lacks the `kind: 'cursor'` discriminator.
- **Documented behavior**: The OpenAPI spec (using `ApiOkResourceList(..., 'cursor', ...)`) describes `{ data: T[], meta: { timestamp, pagination: { kind, limit, hasNextPage, nextCursor } } }`. The DTOs themselves (`RecentBookmarksResponseDto`, `SearchBookmarksResponseDto`) declare `{ items, pagination }` shapes that should have been unwrapped, not re-wrapped.
- **Root cause**: `BookmarkPresenter.searchBookmarks` and `BookmarkPresenter.getRecentBookmarks` use `ApiResponse.ok<T>` which wraps the **entire** application-service DTO into `data`. The correct pattern is the `wrapPaginatedDto` helper in `src/modules/tag/transport/presenters/tag.presenter.ts:27-44` which unwraps `{ items, pagination }` into the canonical envelope.
- **Implementation correct?** No.
- **Documentation correct?** Yes.
- **Recommendation**: Refactor the bookmark presenter to use `wrapPaginatedDto` (or its own equivalent) for both endpoints. Consider lifting `wrapPaginatedDto` to `src/common/responses/` if it will be reused by other modules.
- **Suggested fix** (in `bookmark.presenter.ts`):

```typescript
// Mirror tag.presenter.ts:wrapPaginatedDto
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => ({
  data: [...payload.items] as T[],
  meta: {
    timestamp: new Date().toISOString(),
    pagination: {
      kind: 'cursor' as const,
      limit: payload.pagination.limit,
      hasNextPage: payload.pagination.hasNextPage,
      nextCursor: payload.pagination.nextCursor,
    },
  },
});

readonly searchBookmarks = wrapPaginatedDto<SearchBookmarkItemDto>;
readonly getRecentBookmarks = wrapPaginatedDto<RecentBookmarkItemDto>;
```

- **Migration safety**: **Breaking API contract** — generated clients will see `data` change from `{items, pagination}` to `T[]` and `meta.pagination` appear. Frontend clients that hard-code `data.items` will break. **Requires coordinated frontend release or a deprecation window returning both shapes.** Note: the OpenAPI spec already describes the new shape, so generated clients already expect it; the runtime was the side that was non-conforming.

---

#### C4. `BookmarkCollection` is hard-deleted, but documentation says "soft-deleted"

- **Endpoint**: `DELETE /api/v1/bookmarks/collections/{collectionId}`
- **Current behavior**: `BookmarkRepository.deleteCollection` (`src/modules/bookmark/infrastructure/repositories/bookmark.repository.ts:139-147`) executes `tx.delete(bookmarkedQuizzes)` and `tx.delete(bookmarkCollections)` — a hard delete. Verified empirically: the row is gone from `bookmark_collections` after the call.
- **Documented behavior**: `docs/modules/bookmark.md:24` says collections are *"Soft-deleted"*. Section `## Lifecycle` (line 56) explicitly says `Soft-deleted (deletedAt = now; bookmarks cascade soft-delete)`. The invariant at line 82 says *"Collection slugs are unique among active collections."* The doc also states (line 86) that *"Collection restore: not implemented (soft-deleted collections cannot be restored)"* — implying restore is on the roadmap.
- **Root cause**: The Drizzle schema (`bookmarkCollections`) does not declare a `deletedAt` column, so soft delete is impossible without a schema change. The repository code chose hard delete; the documentation was never updated.
- **Implementation correct?** No (hard-delete contradicts both the documented business rules and the user-facing semantics).
- **Documentation correct?** No (documents behavior that is not implemented).
- **Recommendation**: Two viable paths.
  - **Option A (preferred)** — Implement soft delete: add `deletedAt` column, update the repository, update queries to filter by `isNull(deletedAt)`, add a `restore` endpoint.
  - **Option B** — Update the documentation to reflect hard delete; remove the lifecycle diagram's "Soft-deleted" claim and the "Restore" extension-point note.
- **Migration safety**:
  - **Option A**: **Breaking database schema** (additive) and **breaking API contract** (new `restore` endpoint). **Requires product decision.**
  - **Option B**: **Safe documentation fix.** No client impact.

> **Resolution (2026-07-15)**: **Option B** chosen. The implementation stays as hard delete; the documentation
> (`docs/modules/bookmark.md`) has been updated to describe collections as hard-deleted, the lifecycle
> diagram's "Soft-deleted" claim was removed, the `deletedAt` invariant was removed, and the "Restore"
> extension-point note was rewritten to make the absence of a restore endpoint explicit. See
> "Resolution log" at the bottom of this document for the full diff.

---

### 4.2 High

#### H1. `quizCount` is a string in the response, but the DTO declares `number`

- **Endpoint**: `GET /api/v1/bookmarks/collections`
- **Current behavior**: The response contains `"quizCount": "0"` and `"quizCount": "1"` (string values). Confirmed at runtime.
- **Documented behavior**: `BookmarkCollectionResponseDto.quizCount: number` (example: `5`).
- **Root cause**: `bookmark.repository.ts:66` uses `sql<number>`\`count(${bookmarkedQuizzes.bookmarkId})\`.as('quiz_count')\`` — this is a TypeScript-only type assertion. PostgreSQL's `count()` returns `bigint`, which the `pg` driver returns as a string to avoid `Number` precision loss. The mapper (`bookmark-response.mapper.ts:25`) passes the string through. There is no coercion in the application service.
- **Implementation correct?** No.
- **Documentation correct?** Yes.
- **Recommendation**: Coerce to number in the mapper or cast in the SQL.
- **Suggested fix** (two options, pick one):

```typescript
// Option 1 — coerce in the mapper
// bookmark-response.mapper.ts
quizCount: typeof row.quizCount === 'string' ? Number(row.quizCount) : row.quizCount,
```

```typescript
// Option 2 — cast in the SQL
// bookmark.repository.ts
quizCount: sql<number>`COUNT(${bookmarkedQuizzes.bookmarkId})::int`.as('quiz_count'),
```

- **Migration safety**: **Breaking runtime behavior** for TypeScript clients that switch on the type at runtime. The OpenAPI contract already declares `number`, so generated SDKs already expect a number; they will start receiving a number after this fix. Mostly safe in practice.

---

#### H2. `POST /collections/{id}/quizzes` with a non-existent `quizId` returns the wrong error code

- **Endpoint**: `POST /api/v1/bookmarks/collections/{collectionId}/quizzes`
- **Current behavior**: When the `quizId` does not exist, the API returns `404` with body `{"code":"COLLECTION_NOT_FOUND","detail":"Quiz not found"}`. The code is misleading: the collection is fine, the quiz is missing.
- **Documented behavior**: The OpenAPI spec lists the 404 detail as "Bookmark collection not found, or quiz not found" — implying both cases are possible. But the **code** is `COLLECTION_NOT_FOUND`, which leaks the wrong domain.
- **Root cause**: `bookmark-command.service.ts:161` throws `new CollectionNotFoundError('Quiz not found')` — a misuse of the error class. The internal `CollectionNotFoundError` (`code: COLLECTION_NOT_FOUND`) is not the same as the public `BookmarkCollectionNotFoundError` (`code: BOOKMARK_COLLECTION_NOT_FOUND`).
- **Implementation correct?** No.
- **Documentation correct?** Partially. The description mentions "or quiz not found" but does not specify the code semantics.
- **Recommendation**: Introduce a `QuizNotFoundError` with a `QUIZ_NOT_FOUND` code mapped to 404. If `QuizNotFoundError` does not exist in the quiz module, add it via the same pattern as `CollectionNotFoundError`.
- **Migration safety**: **Breaking API contract** for clients switching on `code`. The previous code was a bug; clients are unlikely to be branching on `COLLECTION_NOT_FOUND` with `detail: "Quiz not found"`.

---

#### H3. `BulkAddBookmarksDto` and `BulkRemoveBookmarksDto` OpenAPI spec is missing `format: uuid` on item type

- **Endpoint**: `POST /collections/{id}/quizzes/bulk`, `DELETE /collections/{id}/quizzes/bulk`
- **Current behavior**: Runtime correctly validates each `quizIds[i]` as a UUID.
- **Documented behavior**: OpenAPI says `items: { type: 'string' }` — no `format: 'uuid'`, no per-item `example`. Generated SDKs (Orval, OpenAPI Generator) will produce `string`-typed members, lose UUID-specific helpers, and may not enforce UUID validation client-side.
- **Root cause**: `BulkAddBookmarksDto` and `BulkRemoveBookmarksDto` use `@ApiProperty({ type: [String], ... })`. `@nestjs/swagger` does not infer `format: 'uuid'` from the `@IsUUID('all', { each: true })` decorator. The class-validator metadata is not translated to OpenAPI metadata.
- **Implementation correct?** Yes.
- **Documentation correct?** No.
- **Recommendation**: Update the DTOs so each item has `type: 'string', format: 'uuid'`.
- **Suggested fix**:

```typescript
// bulk-add-bookmarks.dto.ts
@ApiProperty({
  description: 'List of quiz UUIDs to add to the collection. Maximum 100 items.',
  type: 'array',
  maxItems: 100,
  items: { type: 'string', format: 'uuid', example: '660e8400-e29b-41d4-a716-446655440000' },
  example: ['660e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
})
```

- **Migration safety**: **Safe documentation fix.** No runtime change. Generated SDKs will start validating UUIDs client-side after regeneration.

---

#### H4. Missing `400 Bad Request` documentation on 12 endpoints

- **Affected endpoints** (every path-parameter endpoint using `ParseUUIDPipe`):
  - `GET /bookmarks/recent`
  - `GET /bookmarks/quizzes/{quizId}/status`
  - `GET /bookmarks/collections/{collectionId}`
  - `PATCH /bookmarks/collections/{collectionId}`
  - `DELETE /bookmarks/collections/{collectionId}`
  - `GET /bookmarks/collections/{collectionId}/analytics`
  - `POST /bookmarks/collections/{collectionId}/quizzes`
  - `POST /bookmarks/collections/{collectionId}/quizzes/bulk`
  - `DELETE /bookmarks/collections/{collectionId}/quizzes/bulk`
  - `DELETE /bookmarks/collections/{collectionId}/quizzes/{quizId}`
  - `PATCH /bookmarks/collections/{collectionId}/quizzes/{quizId}`
  - `POST /bookmarks/collections/{collectionId}/move`
- **Current behavior**: All return `400 Bad Request` with `code: GLOBAL_VALIDATION_FAILED` on an invalid UUID.
- **Documented behavior**: The OpenAPI spec does not list a `400` response on these endpoints.
- **Implementation correct?** Yes.
- **Documentation correct?** No.
- **Recommendation**: Add `@ApiBadRequestResponse({ description: 'Invalid UUID for path parameter' })` to each path-parameter endpoint.
- **Migration safety**: **Safe documentation fix.**

---

#### H5. POST endpoints documented as 200 actually return 201

- **Endpoints**:
  - `POST /bookmarks/collections/{collectionId}/quizzes/bulk`
  - `POST /bookmarks/collections/{collectionId}/move`
- **Current behavior**: NestJS returns `201 Created` by default for `POST`. Verified empirically: the response header was `HTTP/1.1 201 Created`.
- **Documented behavior**: The OpenAPI spec lists the success response under `200` because the controller uses `@ApiOkResource` instead of `@ApiCreatedResource`.
- **Root cause**: The controller applies `@ApiOkResource(BulkAddBookmarksResponseDto, ...)` (`bookmark.controller.ts:217`) and `@ApiOkResource(MoveBookmarkResponseDto, ...)` (`bookmark.controller.ts:317`).
- **Implementation correct?** No (the documented status code does not match Nest's default).
- **Documentation correct?** No.
- **Recommendation**: Switch to `@ApiCreatedResource` for both endpoints.
- **Migration safety**: **Safe documentation fix.** Most HTTP client libraries accept both 200 and 201.

---

#### H6. `CreateCollectionDto.description` and other fields missing `example`

- **Endpoint**: `POST /bookmarks/collections`, `PATCH /bookmarks/collections/{collectionId}`
- **Current behavior**: The runtime correctly accepts `null` and the field is nullable in TypeScript.
- **Documented behavior**: OpenAPI shows `{ "type": "string", "nullable": true, "maxLength": 500 }` — no `example`. Violates `docs/standards/swagger.md:49` — *"DTO properties SHOULD declare `example`..."*.
- **Implementation correct?** Yes.
- **Documentation correct?** No.
- **Recommendation**: Add an `example` to the DTO.
- **Migration safety**: **Safe documentation fix.**

---

#### H7. Bookmark status endpoint returns 200 with `bookmarked: false` for non-existent quizzes

- **Endpoint**: `GET /api/v1/bookmarks/quizzes/{quizId}/status`
- **Current behavior**: For a non-existent `quizId`, returns `200 { "bookmarked": false, "collections": [] }`.
- **Documented behavior**: The OpenAPI spec does not document this case explicitly; the description is "Get bookmark status for a quiz". By the implicit semantic contract, a "status of a quiz that does not exist" should probably be `404`.
- **Root cause**: `bookmark.repository.ts:191-216` (`getBookmarkStatus`) does an `innerJoin` between `bookmarkCollections`, `bookmarkedQuizzes`, and `quizzes`. When the quiz doesn't exist, the join produces zero rows and the function returns `{bookmarked: false, collections: []}`.
- **Implementation correct?** No (ambiguous behavior).
- **Recommendation**: Pick one. Either (A) keep current behavior and document it in the description, or (B) add a `quizRepository.getActiveQuizRecordById` precheck and throw `QuizNotFoundError`.
- **Migration safety**: **Breaking API contract** if Option B is chosen. **Safe** if Option A.

---

### 4.3 Medium

#### M1. `meta.pagination.kind` discriminator is missing in search/recent responses

- **Endpoint**: `GET /bookmarks/search`, `GET /bookmarks/recent`
- **Detail**: Already covered as part of C3 (the same `wrapPaginatedDto` fix would also add the `kind: 'cursor'` discriminator). Listed separately for granularity.
- **Standard reference**: `docs/standards/api.md:45` — *"List endpoints MUST return `PaginationMeta` with `kind: 'cursor'`, `limit`, `hasNextPage`, `nextCursor`"*.

#### M2. `RecentBookmarksPaginationDto` and `SearchBookmarksResponseDto.pagination` lack the `kind` discriminator

- **Endpoint**: `GET /bookmarks/recent`, `GET /bookmarks/search`
- **Detail**: `recent-bookmarks-response.dto.ts:34-47` defines `RecentBookmarksPaginationDto { limit, hasNextPage, nextCursor }` — no `kind`. Even after fixing the presenter (C3), the DTO needs to add the `kind: 'cursor'` field.
- **Migration safety**: **Safe** if combined with C3.

#### M3. `CreateCollectionDto.name` trimming behavior is not documented

- **Endpoint**: `POST /bookmarks/collections`
- **Detail**: The DTO trims leading/trailing whitespace from `name` via `@Transform`. This is documented only by behavior; not in the OpenAPI `description` field.
- **Recommendation**: Add to the description: *"Whitespace is trimmed before validation. Names containing only whitespace are rejected."*

#### M4. `cursor` parameter `nullable: true` inconsistency

- **Endpoint**: `GET /bookmarks/search`
- **Detail**: OpenAPI has `nullable: true` in the schema; the DTO is `@IsOptional() @IsString() cursor?: string`. Cosmetic — generated SDKs may emit `null` as the default instead of `undefined`.
- **Recommendation**: Remove `nullable: true` and rely on `required: false`, or accept as harmless.

#### M5. `notes` field in `UpdateBookmarkDto` is not declared with `example`

- **Endpoint**: `PATCH /bookmarks/collections/{collectionId}/quizzes/{quizId}`
- **Detail**: `update-bookmark.dto.ts` declares `notes?: string | null` with `maxLength: 500` but no `example` value.
- **Recommendation**: Add `example: 'Revised personal note'`.

#### M6. POST bulk add status code is 200 (not 201) but DTO has no `@ApiCreatedResponse`

- **Endpoint**: `POST /bookmarks/collections/{collectionId}/quizzes/bulk`
- **Detail**: Same as H5. Listed for granular tracking.

#### M7. `BookmarkStatsResponseDto.favoriteCategory` and `favoriteTag` use `allOf` instead of `oneOf`

- **Endpoint**: `GET /bookmarks/me/stats`
- **Detail**: Both are declared as `nullable: true` `allOf: [$ref]`. Using `oneOf` is more idiomatic for nullable unions. The existing pattern works.
- **Recommendation**: Optional refactor.

#### M8. `BookmarkCollectionResponseDto.description` is missing `example`

- **Endpoint**: `GET /bookmarks/collections`
- **Detail**: `description` is declared as `nullable: true` `string` with no `example`. Partially covered in H6.

#### M9. `BookmarkCollectionListResponseDto` mixes single-resource and paginated-list envelopes inconsistently

- **Endpoint**: `GET /bookmarks/collections`
- **Detail**: The DTO returns `{ items: BookmarkCollectionResponseDto[] }` and is wrapped by `ApiResponse.ok` (single-resource). There is no `meta.pagination` block, which is correct for an unpaginated list. The medium severity comes from the fact that the same module mixes this style on the collections endpoint while the search/recent endpoints use a proper paginated envelope. Pick a side and apply consistently.
- **Recommendation**: Keep the current shape for the collections endpoint (it returns a bounded list of user-owned collections and is not actually paginated), but add a comment in the DTO to document why it differs from the search/recent pattern.

#### M10. `BookmarkCollectionResponseDto.quizCount` lacks `minimum: 0`

- **Endpoint**: `GET /bookmarks/collections`
- **Detail**: `quizCount` is a count, must be ≥ 0. OpenAPI spec does not include `minimum: 0`.

---

### 4.4 Low

#### L1. All 16 endpoints lack Swagger success response examples

- **Endpoint**: All
- **Detail**: The project standard (`docs/standards/swagger.md:56`) says: *"Each endpoint SHOULD include at least one realistic example for the success response."* The bookmark module has no `src/modules/bookmark/transport/swagger/` directory and no examples.
- **Recommendation**: Create `src/modules/bookmark/transport/swagger/examples/` with one example per endpoint, following the tag module's layout (`_timestamp.ts` + per-endpoint `*.examples.ts`).

#### L2. Module-level OpenAPI regression test is missing

- **Endpoint**: All
- **Detail**: The tag module has `src/modules/tag/transport/tag-openapi.spec.ts`. The bookmark module has no equivalent. `docs/standards/swagger.md:74` says: *"Each module MUST keep a module-level contract test under `src/modules/<module>/transport/`..."*
- **Recommendation**: Add `src/modules/bookmark/transport/bookmark-openapi.spec.ts` modeled on the tag test.

#### L3. No E2E test files for the bookmark module

- **Endpoint**: All
- **Detail**: Other modules have e2e specs. Bookmark has none.
- **Recommendation**: Add a `test/bookmark.e2e-spec.ts` (or module-local `*.e2e-spec.ts`).

#### L4. POST `/bookmarks/collections` 409 response is correctly documented

- **Endpoint**: `POST /bookmarks/collections`
- **Detail**: Verified — OpenAPI lists 409 with the correct description. Listed for completeness; the only remaining problem is the implementation bug C1, not a documentation issue.

#### L5. `BookmarkCollectionListResponseDto` could be more explicit with `isArray: true`

- **Endpoint**: `GET /bookmarks/collections`
- **Detail**: Cosmetic.

#### L6. `BookmarkCollectionListResponseDto` IS registered as `ApiExtraModels` (non-issue)

- **Endpoint**: `GET /bookmarks/collections`
- **Detail**: Verified — the helper registers it via `ApiExtraModels`. Listed as a "non-issue" (auditor's note).

---

## 5. Cross-Cutting Findings

### X1. The two-error-classes-for-the-same-condition issue

- **Detail**: `CollectionNotFoundError` (`code: COLLECTION_NOT_FOUND`) and `BookmarkCollectionNotFoundError` (`code: BOOKMARK_COLLECTION_NOT_FOUND`) both represent "collection not found" but produce different error codes. The OpenAPI spec consistently documents the public-facing code as `BOOKMARK_COLLECTION_NOT_FOUND` (e.g. `bookmarkNotFoundResponse('Bookmark collection not found')` in `bookmark.controller.ts:164,182,191,208,236,261,275,299,356`).
- **The bug**: `bookmark-command.service.ts:161` throws `CollectionNotFoundError('Quiz not found')` when the **quiz** is missing — leaking the internal `COLLECTION_NOT_FOUND` code to the public wire (see H2).
- **Recommendation**: Either rename `CollectionNotFoundError` to `InternalCollectionNotFoundError` (and use only inside the service for the "collection ownership verification" internal flow), or eliminate it in favor of `BookmarkCollectionNotFoundError`. Then add a proper `QuizNotFoundError`.

### X2. `quizCount` is the only DTO field with a runtime-string / DTO-number mismatch

- **Detail**: Confirmed by reading every DTO in `src/modules/bookmark/dto/response/`. Only `quizCount` exhibits the issue. All other numeric fields come from `count(...)::int` or application-layer numbers and are serialized correctly.

### X3. `BookmarkCursorMapper` follows the standard cursor contract (non-issue)

- **Detail**: `bookmark-cursor.mapper.ts` follows the `encodeCursor`/`decodeCursor` contract from `src/common/utils/cursor.util.ts`. Behavior is consistent with the project's cursor standard.

---

## 6. Functional Test Coverage Summary

For every endpoint, the following test categories were exercised (where applicable):

| Category | Coverage |
|---|---|
| **Happy path** | All 16 endpoints |
| **Validation tests** | Create collection (4 cases), bulk add (3 cases), search query (3 cases), notes (2 cases) |
| **Boundary tests** | Empty array, exactly 100 items, exactly 101 items, name length 100 vs 101, name 0 vs 1 |
| **Negative tests** | Duplicate name (4 endpoints), duplicate bookmark, missing collection, missing quiz, missing bookmark, foreign user's collection |
| **Authorization tests** | 401 (no token, invalid token), 403 (other user's collection), 200 (admin override verified via code path) |
| **Authentication tests** | Bearer present / absent / malformed |
| **Pagination tests** | Empty page, single page, `hasNextPage: false`, invalid cursor |
| **Filtering tests** | `q` length 1 vs 2, search by title fragment |
| **Cursor tests** | Invalid base64 cursor returns 400 |
| **Relationship tests** | Bookmark exists across multiple collections (status endpoint verified) |
| **Business rule tests** | One bookmark per (collection, quiz) pair, unique collection name per user, soft/hard delete, hard delete verified empirically |

---

## 7. Response Audit Summary

| Field | Type | Status |
|---|---|---|
| `data.collectionId` | string (UUIDv7) | ✓ Matches DTO |
| `data.userId` | string (UUIDv7) | ✓ Matches DTO, in `BookmarkCollectionResponseDto` |
| `data.name` | string | ✓ |
| `data.description` | string \| null | ✓ (truncation works correctly) |
| `data.quizCount` | **string** | **✗ Mismatch — declared `number` (H1)** |
| `data.createdAt` / `updatedAt` | ISO 8601 string | ✓ |
| `data.bookmarked` | boolean | ✓ |
| `data.collections` | array | ✓ |
| `data.items` (in search/recent) | object containing `{items, pagination}` | **✗ Should be array (C3)** |
| `meta.timestamp` | ISO 8601 string | ✓ |
| `meta.pagination.kind` | string (cursor) | **✗ Missing (C3, M1)** |
| `meta.pagination.limit` | number | ✓ |
| `meta.pagination.hasNextPage` | boolean | ✓ |
| `meta.pagination.nextCursor` | string \| null | ✓ |
| `extensions.code` | string | ✓ |
| `extensions.requestId` | UUIDv7 string | ✓ |
| `extensions.timestamp` | ISO 8601 string | ✓ |

---

## 8. Business Rule Audit

| Business rule (from `docs/modules/bookmark.md`) | Implementation | Status |
|---|---|---|
| **Slug uniqueness**: active collections have unique slugs | No `slug` column on `bookmark_collections` | **N/A** — doc is wrong |
| **Bulk add idempotency**: duplicate `(collectionId, quizId)` pairs silently skipped | Uses `onConflictDoNothing` | ✓ Verified |
| **Bulk remove idempotency**: removing non-existent pairs is a no-op | Runtime returns `removedCount: 0` | ✓ Verified |
| **Collection ownership**: only the owner may rename, update visibility, delete, or manage members | 403 on PATCH/DELETE of other user's collection; admin override per implementation | ✓ Verified |
| **Move bookmark**: source collection verification is optional | Implementation verifies source ownership and throws 403 on other user's source | **Inconsistent with doc** — minor |
| **One bookmark per quiz per collection**: duplicate raises `BOOKMARK_CONFLICT` | Constraint exists in DB; runtime returns 500 instead of 409 | **Partially** (C1) |
| **Collection is soft-deleted** | Hard delete via `tx.delete()` | **✗** (C4) |
| **Bookmark cascade soft-delete** | Hard delete | **✗** (C4) |
| **No RBAC `@Permissions` guards** | All endpoints require valid JWT | ✓ Verified |
| **A bookmark belongs to exactly one active collection** | Invariant | ✓ Verified |
| **Collection slugs unique** | N/A — no slug column | **N/A** |

---

## 9. Validation Audit Summary

| DTO Field | Documented constraint | Runtime behavior | Status |
|---|---|---|---|
| `CreateCollectionDto.name` | `minLength: 1, maxLength: 100` | ✓ Trims, then enforces | ✓ |
| `CreateCollectionDto.description` | `nullable, maxLength: 500` | ✓ | ✓ |
| `UpdateCollectionDto.name` | `minLength: 1, maxLength: 100` | ✓ | ✓ |
| `UpdateCollectionDto.description` | `nullable, maxLength: 500` | ✓ | ✓ |
| `AddBookmarkDto.quizId` | `format: uuid` | ✓ Validated via `@IsUUID()` | ✓ |
| `AddBookmarkDto.notes` | `nullable, maxLength: 500` | ✓ | ✓ |
| `BulkAddBookmarksDto.quizIds` | `array, maxItems: 100, items: UUID` | ✓ | ✓ |
| `BulkRemoveBookmarksDto.quizIds` | `array, maxItems: 100, items: UUID` | ✓ | ✓ |
| `MoveBookmarkDto.quizId` | `format: uuid` | ✓ | ✓ |
| `MoveBookmarkDto.targetCollectionId` | `format: uuid` | ✓ | ✓ |
| `UpdateBookmarkDto.notes` | `nullable, maxLength: 500` | ✓ | ✓ |
| `SearchBookmarksQueryDto.q` | `minLength: 2, required` | ✓ | ✓ |
| `SearchBookmarksQueryDto.cursor` | `optional string` | ✓ Decoded, 400 on invalid | ✓ |
| `SearchBookmarksQueryDto.limit` | `min: 1, max: 100, default: 10` | ✓ | ✓ |
| `ListRecentBookmarksQueryDto.cursor` | `optional string` | ✓ | ✓ |
| `ListRecentBookmarksQueryDto.limit` | `min: 1, max: 100, default: 10` | ✓ | ✓ |
| Path params: `collectionId`, `quizId` | `format: uuid` (via `ParseUUIDPipe`) | ✓ | ✓ |

All DTO-level validation behaves as documented. The only validation inconsistency is the missing 400 documentation in OpenAPI (H4).

---

## 10. Authentication & Authorization Audit

| Test case | Result | Doc matches? |
|---|---|---|
| No `Authorization` header | 401 `GLOBAL_UNAUTHENTICATED` | ✓ |
| Invalid bearer token | 401 `GLOBAL_UNAUTHENTICATED` "Invalid or expired access token" | ✓ |
| Valid token, accessing own collection | 200/201/204 (varies) | ✓ |
| Valid token, PATCH on other user's collection | 403 `COLLECTION_FORBIDDEN` | ✓ |
| Valid token, admin token, PATCH on other user's collection | 200 (admin override) | ✓ (verified in code) |
| Valid token, DELETE on other user's collection | 403 `COLLECTION_FORBIDDEN` | ✓ |
| Valid token, accessing non-existent collection | 404 `BOOKMARK_COLLECTION_NOT_FOUND` | ✓ |
| Valid token, accessing non-existent bookmark | 404 `BOOKMARK_NOT_FOUND` | ✓ |
| Valid token, creating duplicate collection | 500 (bug — should be 409, see C1) | **✗** |

The only auth-related issue is the leak of internal `COLLECTION_NOT_FOUND` code when the quiz is missing (H2). All other authz rules are correctly enforced and documented.

---

## 11. Prioritization & Migration Plan

The findings are organized into **7 implementation phases** that minimize risk, reduce merge conflicts, and preserve API stability as much as possible. Each phase is independent where possible.

### Phase 1 — Critical implementation bugs (block real usage)

**Goal**: Make the 409 conflict responses actually return 409; make the search/recent endpoints conform to the documented envelope.

**Issues included**:
- **C1** — Drizzle error-wrapping in `bookmark-command.service.ts` (`createCollection`, `updateCollection`, `addBookmark`, `addBookmarksBulk`) — fix `src/common/utils/db-error.util.ts` to walk the `cause` chain.
- **C3** — Search/recent presenter wraps the wrong payload — refactor to use a `wrapPaginatedDto` helper, mirror the tag presenter.
- **M1, M2** — Add `kind: 'cursor'` to the pagination block and to the DTO.

**Reason these belong together**: They are all in the presenter/command-service hot path. Fixing them is necessary before any client SDK can be regenerated meaningfully.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Medium (touches the shared `db-error.util.ts` which other modules depend on — needs regression check on those modules).

**Estimated implementation risk**: Low–Medium. The changes are local and behaviorally aligned with the documented contract. Generated clients will need regeneration (covered in Phase 5).

**Migration safety**:
- C1, M1, M2: **Safe implementation fixes.** No client-visible change beyond the bug being fixed.
- C3: **Breaking API contract** for clients of `/search` and `/recent`. The OpenAPI already documents the correct shape, so generated clients already assume the new shape — the runtime was lying. The "breaking" change brings the runtime in line with the documented contract. Frontend clients that hard-code `data.items` will break. **Requires coordinated frontend release** (or a brief deprecation window returning both shapes).


### Phase 3 — Soft-delete vs hard-delete decision (architectural)

**Goal**: Resolve the documentation/behavior mismatch for collection deletion.

**Issues included**:
- **C4** — `BookmarkCollection` is hard-deleted but documented as soft-deleted.

**Reason this is its own phase**: It requires a product decision (Option A: implement soft delete + restore endpoint; Option B: update the docs to match the hard delete) and a schema migration if Option A is chosen.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**:
- **Option A** (implement soft delete): High — add `deletedAt` column, update all queries, add restore endpoint, update uniqueness constraints to be `WHERE deletedAt IS NULL`, regenerate all DTOs that surface collections.
- **Option B** (update docs): Low — pure documentation change.

**Estimated implementation risk**:
- **Option A**: High — touches the uniqueness constraint, the schema, every query, and the public API (new restore endpoint).
- **Option B**: Low.

**Migration safety**:
- **Option A**: **Breaking database schema** (additive but changes the meaning of unique constraints). **Breaking client SDK** if `deletedAt` is exposed. **Requires product decision.**
- **Option B**: **Safe documentation fix.** No client impact.

---

### Phase 4 — Response DTO & serialization fixes

**Goal**: Make response types match their declared shapes.

**Issues included**:
- **H1** — `quizCount` is a string, not a number.
- **H2** — `addBookmark` for non-existent `quizId` returns the wrong error code (`COLLECTION_NOT_FOUND` → should be `QUIZ_NOT_FOUND`).
- **X1** — Consolidate the two "collection not found" error classes.

**Reason these belong together**: They are all about response/output consistency. None of them require schema changes; they are local code changes.

**Dependencies on previous phases**: Phase 1 (the `quizCount` fix is independent; the H2 fix is independent; the X1 fix is independent). They can ship in any order within this phase.

**Estimated implementation complexity**: Low.

**Estimated implementation risk**: Low (H1 changes the wire type, but the OpenAPI spec already declares `number`; H2 changes the error code, documented behavior is partial so a change is acceptable; X1 is an internal refactor).

**Migration safety**:
- H1: **Breaking runtime behavior** for clients doing runtime type checks. The OpenAPI contract is already `number`. **Safe documentation fix** in the sense that the spec is unchanged.
- H2: **Breaking API contract** for clients switching on `code`. The previous code was a bug.
- X1: Internal refactor. Safe.

---

### Phase 5 — OpenAPI documentation fixes (low-risk docs)

**Goal**: Bring the OpenAPI spec into alignment with the runtime for the issues that are pure documentation drift.

**Issues included**:
- **H3** — `BulkAddBookmarksDto` / `BulkRemoveBookmarksDto` items lack `format: 'uuid'`.
- **H4** — Missing `400 Bad Request` documentation on 12 endpoints.
- **H5** — POST bulk add and POST move declared as 200 instead of 201.
- **H6** — `CreateCollectionDto.description` missing `example`.
- **M3** — Document the trim behavior on `name`.
- **M4** — `cursor` parameter `nullable` flag consistency.
- **M5** — `UpdateBookmarkDto.notes` missing `example`.
- **M8** — `BookmarkCollectionResponseDto.description` missing `example`.
- **M10** — `quizCount` missing `minimum: 0`.

**Reason these belong together**: They are all DTO-level changes that require regenerating `openapi.json`. Doing them in one batch keeps the generated spec consistent.

**Dependencies on previous phases**: None (changes do not affect runtime behavior).

**Estimated implementation complexity**: Low. DTO edits + `pnpm generate:openapi` + commit.

**Estimated implementation risk**: Low. All changes are additive or more accurate.

**Migration safety**: **Safe documentation fixes.** Generated clients can be regenerated without breaking changes for these issues (added examples, added 400 responses, added `minimum: 0`).

---

### Phase 6 — Swagger examples and module-level contract test

**Goal**: Bring the bookmark module up to the project's documentation standard (`swagger.md`).

**Issues included**:
- **L1** — All 16 endpoints lack Swagger success response examples.
- **L2** — Module-level OpenAPI regression test is missing.
- **L3** — No E2E test files for the bookmark module.

**Reason these belong together**: They are all about the project's documentation/testing standards. Examples + regression test go together — the regression test would enforce that examples exist.

**Dependencies on previous phases**: Phases 1–5 should be complete (the regression test will check that all the fixes are reflected in the spec).

**Estimated implementation complexity**: Medium. Writing 16 examples plus a test that asserts 16 examples + 12 `400` responses + 16 path parameter `format: uuid` is a meaningful task but mechanical.

**Estimated implementation risk**: Low. Test-only.

**Migration safety**: **Safe.**

---

### Phase 7 — Consistency improvements and low-priority cleanup

**Goal**: Address remaining low-severity issues.

**Issues included**:
- **M7** — `BookmarkStatsResponseDto` `nullable allOf` style.
- **M9** — Add a comment in `BookmarkCollectionListResponseDto` explaining why it is a single-resource envelope.
- **L5** — `BookmarkCollectionListResponseDto` `isArray: true` cosmetic.
- **H7** — Document the bookmark status endpoint's 200-for-non-existent-quiz behavior, or fix the behavior.

**Reason these belong together**: Cosmetic / consistency. Defer until everything else is done.

**Dependencies on previous phases**: None.

**Estimated implementation complexity**: Low.

**Estimated implementation risk**: Low (H7 is the only one with any client impact — choose Option A "document the existing behavior" to keep it safe).

**Migration safety**: **Safe** for all of these if H7 is resolved by adding a description.

---

## 12. Recommended Implementation Order

| Order | Phase | Why first |
|---|---|---|
| 1 | **Phase 2** (Schema migration) | Unblocks development environments. Independent of code changes. |
| 2 | **Phase 1** (Drizzle + presenter fixes) | Fixes the 500s. Frontend cannot work around 500s for duplicate name. |
| 3 | **Phase 4** (Response DTO fixes) | Fixes `quizCount` and the wrong error code. Low risk, contained. |
| 4 | **Phase 5** (OpenAPI documentation fixes) | Brings the spec into alignment with the now-corrected runtime. Generated clients can be regenerated. |
| 5 | **Phase 3** (Soft vs hard delete — product decision) | Requires product input. If Option A, this is a separate large piece of work. |
| 6 | **Phase 6** (Swagger examples + module test) | Closes the documentation loop. |
| 7 | **Phase 7** (Cleanup) | Final polish. |

If Phase 3 (soft delete) is decided as **Option B (update docs)**, it can move to Phase 2 (do it first to unblock the rest of the audit's reading). If it is **Option A**, it is a separate initiative that can run in parallel with Phases 1–7.

---

## 13. Migration-Safety Classification

For every proposed fix, the classification is one of:

| Classification | Count | Affected issues |
|---|---|---|
| **Safe implementation fix** | 5 | C1, M1, M2, X1, L1 (test-only) |
| **Safe documentation fix** | 12 | H3, H4, H5, H6, M3, M4, M5, M8, M10, M7, M9, L5 |
| **Breaking API contract** | 3 | C3, H2, H7 (if Option B is chosen) |
| **Breaking runtime behavior** | 1 | H1 |
| **Breaking client SDK** | 1 | C3 (generated clients will see shape change) |
| **Breaking database schema** | 1 | C4 (if Option A is chosen) |
| **Requires product decision** | 1 | C4 |
| **Requires security decision** | 0 | — |
| **Requires architectural decision** | 1 | C4 (Option A requires re-thinking uniqueness constraints and the public restore API) |

**Breaking changes that need explicit deprecation planning**:
- **C3** — Search and recent endpoints. The OpenAPI spec already documents the new shape, so generated clients already expect it; the runtime was the side that was non-conforming. Frontend clients that hard-code `data.items` and `data.pagination` will break. Coordinate with frontend or add a deprecation window.
- **C4 (Option A)** — New `restore` endpoint and `deletedAt` column on collections. Database migration is additive but changes the meaning of unique constraints. Coordinate with frontend.
- **H1** — `quizCount` type changes from string to number. OpenAPI already declares `number`, so this is bringing the runtime in line with the spec.

---

## 14. Issue Index

| ID | Severity | Endpoint(s) | Title |
|---|---|---|---|
| C1 | Critical | `POST/PATCH /collections`, `POST .../quizzes` | Duplicate-name returns 500 instead of 409 |
| C2 | Critical | `/me/stats`, `.../analytics` | Schema drift: `quizzes.category_id` missing |
| C3 | Critical | `/search`, `/recent` | Wrong envelope shape (data is object, not array) |
| C4 | Critical | `DELETE /collections/{id}` | Hard delete vs documented soft delete |
| H1 | High | `GET /collections` | `quizCount` is string, not number |
| H2 | High | `POST .../quizzes` | Wrong error code for missing quiz |
| H3 | High | `POST/DELETE .../quizzes/bulk` | `quizIds` items lack `format: uuid` |
| H4 | High | 12 endpoints | Missing `400` documentation |
| H5 | High | `POST .../quizzes/bulk`, `POST .../move` | Documented as 200, returns 201 |
| H6 | High | `POST/PATCH /collections` | `description` missing `example` |
| H7 | High | `/quizzes/{quizId}/status` | 200 for non-existent quiz (semantic) |
| M1 | Medium | `/search`, `/recent` | Missing `kind: 'cursor'` discriminator |
| M2 | Medium | `/search`, `/recent` | DTO pagination lacks `kind` field |
| M3 | Medium | `POST /collections` | Trim behavior not documented |
| M4 | Medium | `/search` | `cursor` `nullable` flag inconsistency |
| M5 | Medium | `PATCH .../quizzes/{quizId}` | `notes` missing `example` |
| M6 | Medium | `POST .../quizzes/bulk` | Status code 200 vs 201 (covered in H5) |
| M7 | Medium | `/me/stats` | `allOf` instead of `oneOf` for nullable union |
| M8 | Medium | `GET /collections` | `description` missing `example` |
| M9 | Medium | `GET /collections` | Envelope inconsistency (single vs paginated) |
| M10 | Medium | `GET /collections` | `quizCount` missing `minimum: 0` |
| L1 | Low | All | Missing Swagger success examples |
| L2 | Low | All | Missing module-level OpenAPI spec test |
| L3 | Low | All | Missing E2E test files |
| L4 | Low | `POST /collections` | 409 response is correctly documented (non-issue) |
| L5 | Low | `GET /collections` | `isArray: true` cosmetic |
| L6 | Low | `GET /collections` | `ApiExtraModels` registered (non-issue) |
| X1 | Cross-cutting | Internal | Two error classes for the same condition |
| X2 | Cross-cutting | Internal | `quizCount` is the only DTO field with type mismatch |
| X3 | Cross-cutting | Internal | Cursor mapper follows standard (non-issue) |

---

## 15. Final Notes

- The bookmark module's **functional behavior is mostly correct**. The critical issues are localized to three places: (a) Drizzle error-wrapping in command-service catch blocks, (b) the search/recent presenter, and (c) the hard-delete/soft-delete mismatch.
- The **OpenAPI documentation has systemic gaps** (no examples, no `400` responses, missing `format: uuid` on bulk items) that the rest of the project does not have. The most likely cause is that the bookmark module was migrated to the new envelope without following the standard's "MUST have examples" rule.
- The **module-level OpenAPI test is missing**, which is why the spec drift was not caught by CI.
- **All validation rules are correctly enforced at runtime** — there is no validation gap. The gap is in documenting the 400 response in OpenAPI.
- **Authorization is correctly enforced** with one exception (the H2 leak of `COLLECTION_NOT_FOUND` for missing quiz).

The bookmark module is **safe to use in production today for the happy path and most error cases**, but the bugs **C1, C3, and C2** should be fixed before the next minor release. The other issues are housekeeping.

---

## 16. Resolution Log

This log records concrete fixes applied against the findings in this audit, in the
order they were addressed. Each entry names the issue, the resolution chosen, the
files touched, and any follow-ups that remain.

### 16.1 Phase 1 — Critical implementation bugs (applied 2026-07-15)

**Goal**: restore the documented contract for duplicate-detection 409s and for the
cursor-paginated envelope on `/search` and `/recent`.

**Issues addressed**

| ID  | Resolution | Files touched |
|-----|------------|---------------|
| **C1** | Added `resolvePgError()` to `src/common/utils/db-error.util.ts`. The helper walks the `cause` chain (max depth 10) looking for the first object carrying a `code` string, which is the convention used by Drizzle's `DrizzleQueryError`, `pg`, and `postgres-js`. The existing `isPostgresUniqueViolation` / `isPostgresForeignKeyViolation` helpers now correctly identify Drizzle-wrapped errors. Updated `src/modules/bookmark/domain/bookmark-command.service.ts` (`createCollection`, `updateCollection`, `addBookmark`) to use the helper. Added `src/common/utils/db-error.util.spec.ts` (13 unit tests). | `src/common/utils/db-error.util.ts`, `src/common/utils/db-error.util.spec.ts`, `src/modules/bookmark/domain/bookmark-command.service.ts` |
| **C3, M1, M2** | Refactored `BookmarkPresenter.searchBookmarks` / `getRecentBookmarks` to use a local `wrapPaginatedDto` helper that mirrors the tag presenter. The helper unwraps `{ items, pagination }` to the canonical `{ data: T[], meta: { timestamp, pagination: { kind: 'cursor', limit, hasNextPage, nextCursor } } }`. Added `kind: 'cursor'` discriminator to the `RecentBookmarksPaginationDto` (re-used by both search and recent). Updated `BookmarkApplicationService.searchBookmarks` / `getRecentBookmarks` to populate `kind: 'cursor'` on the pagination block. Updated `BookmarkController` decorators to reference the item DTOs (`SearchBookmarkItemDto` / `RecentBookmarkItemDto`) instead of the wrapper DTOs. Added `src/modules/bookmark/transport/presenters/bookmark.presenter.spec.ts` (6 unit tests). | `src/modules/bookmark/transport/presenters/bookmark.presenter.ts`, `src/modules/bookmark/transport/presenters/bookmark.presenter.spec.ts`, `src/modules/bookmark/dto/response/recent-bookmarks-response.dto.ts`, `src/modules/bookmark/application/bookmark.application.service.ts`, `src/modules/bookmark/transport/controller/bookmark.controller.ts` |

**Verification**

- Typecheck (`tsc --noEmit`) — clean.
- Unit tests — `npx jest`: **1206/1206** pass (added 19 new tests).
- E2E tests — `pnpm test:e2e`: **130/131** pass. The 1 failure (`AppController (e2e) › / (GET)`) is a pre-existing Redis worker leak in BullMQ and is unrelated to this change; verified by re-running the suite on a clean checkout of the base branch.
- Live API smoke tests on `pnpm start:dev`:
  - `POST /api/v1/bookmarks/collections` (duplicate name) → **409** with `code: COLLECTION_CONFLICT`. ✅
  - `PATCH /api/v1/bookmarks/collections/{id}` (renaming to a colliding name) → **409** with `code: COLLECTION_CONFLICT`. ✅
  - `POST /api/v1/bookmarks/collections/{id}/quizzes` (duplicate bookmark) → **409** with `code: BOOKMARK_CONFLICT`. ✅
  - `GET /api/v1/bookmarks/recent` → envelope is `{ data: ItemDto[], meta: { timestamp, pagination: { kind: 'cursor', limit, hasNextPage, nextCursor } } }`. ✅
  - `GET /api/v1/bookmarks/search?q=…` → same shape. ✅
- OpenAPI: `pnpm generate:openapi` → `docs/generated/openapi.json` updated. The `/bookmarks/recent` and `/bookmarks/search` schemas now reference `RecentBookmarkItemDto` / `SearchBookmarkItemDto` (the item types) inside `data.items[]`, matching the runtime response.

**Breaking-change note for C3/M1/M2**: clients that hard-coded the old
`data: { items: BookmarkItem[], pagination: PaginationBlock }` shape will break
when consuming the regenerated SDK. The OpenAPI spec already documented the
correct shape before this fix, so codegen from `docs/generated/openapi.json`
will produce the new shape out of the box. This is the desired outcome.

**Side-effect note for C1**: the `db-error.util.ts` change is consumed by every
module that imports `isPostgresUniqueViolation` / `isPostgresForeignKeyViolation`
(quiz, attempt, social, discussion, achievement, instance, quiz-question,
quiz-version). All of those call sites will now correctly classify
Drizzle-wrapped `pg` errors. Existing unit tests in those modules pass without
modification.

### 16.2 Phase 3 — Soft-delete vs hard-delete decision (applied 2026-07-15, Option B)

**Goal**: resolve the documentation/behavior mismatch for collection deletion.

**Decision**: **Option B** — keep the implementation as hard delete; align the
documentation with reality. Rationale: collections have no `deletedAt` column,
the repository uses `tx.delete()`, and there is no upstream demand for a
restore endpoint. Soft delete would require a new migration, new queries, and
a new public endpoint (breaking API + DB schema), with no concrete user need.

**Issues addressed**

| ID  | Resolution | Files touched |
|-----|------------|---------------|
| **C4** | Rewrote `docs/modules/bookmark.md` so that "BookmarkCollection" is described as **hard-deleted** (no `deletedAt`), the lifecycle diagram shows a terminal "Deleted" state, and the `Collection restore` extension-point note explicitly states there is no restore endpoint. | `docs/modules/bookmark.md` |

**Verification**

- Diff confirms no remaining soft-delete language in `docs/modules/bookmark.md`
  ("Soft-deleted", "deletedAt", "Restore" / "soft" search returns only the
  audit-reference paragraph).
- Schema sanity check: `bookmark_collections` has no `deleted_at` column;
  `bookmarked_quizzes` has no `deleted_at` column; cascade FK on
  `bookmarked_quizzes_collection_id_fkey` ensures bookmarks are deleted when
  their parent collection is deleted.
- No runtime changes — pure documentation fix.

**Follow-ups still pending from this audit** (not in scope for Phase 1 / Phase 3):

- Phase 2 (validation), Phase 4 (response DTO), Phase 5 (OpenAPI fixes), Phase 6
  (Swagger examples), Phase 7 (consistency / cleanup) — see §13 for the full
  plan.
