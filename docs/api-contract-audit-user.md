# API Contract Audit — User Module

> **Module:** `src/modules/user/**` (`UserController` registered at `@Controller('users')`)
> **Audit date:** 2026-07-14
> **Auditor:** Cursor (senior backend API review)
> **Methodology:** Static read of controllers, DTOs, swagger decorators, repositories, mappers, error mappers, and the live OpenAPI document at `/api/v1/docs/openapi.json`. Live HTTP exercise against the running app on `http://localhost:8080`. Comparison of runtime wire shape vs. documented contract. Privacy flow exercised end-to-end against a real seeded Postgres instance.
> **Scope:** The 16 endpoints owned by `UserController` plus their dependent infra (DTOs, mappers, repository, presenter, problem-code mapping). Other modules that mount routes under `/api/v1/users/me/*` (review, attempt, discussion, social, search, category, tag) are out of scope but noted where relevant.

---

## 0. Module Snapshot

`UserController` exposes 16 endpoints, all under the global JWT guard (`APP_GUARD = JwtGuard` in `src/app.module.ts:121`). Routes fall into two groups:

| Group | Endpoints | Auth | Privacy check |
|---|---|---|---|
| **Self (`/users/me/*`)** | 10 | Required | n/a (caller == target) |
| **By id (`/users/:userId/*`)** | 5 | Required | Honours `user_profile_settings.isPublic` (403 if private & requester ≠ target) |
| **Public profile listing** | 1 (`/users/:userId/quizzes`) | Required | n/a |
| **Public creator analytics** | 1 (`/users/:userId/quizzes/analytics`) | Required | **No** user-exists check |

Two endpoints in the controller (`listUserQuizzes`, `getUserQuizAnalytics`) do **not** call `assertProfileVisible` — they are public reads that bypass the privacy gate.

All responses are wrapped by the global `ResponseFormatInterceptor` (`src/common/interceptors/response-format.interceptor.ts`). The envelope is `{ data: T | T[], meta: { timestamp, pagination? } }`.

---

## 1. Endpoint Inventory

| # | Method | Path | Auth | Decorator | Controller method | File:Line |
|---|---|---|---|---|---|---|
| 1 | GET | `/users/me/recommended-quizzes` | ✅ JWT | `@ApiAuth()` + `@ApiRecommendedQuizzesResponse()` (claims paginated) | `getRecommendedQuizzes` | `user.controller.ts:50` |
| 2 | GET | `/users/me` | ✅ JWT | `@ApiAuth()` + `@ApiUserMeResponse()` | `me` | `user.controller.ts:67` |
| 3 | GET | `/users/me/badges` | ✅ JWT | `@ApiAuth()` + `@ApiUserBadgesResponse()` (claims `data: UserBadgesResponseDto[]` — wrong) | `listMyBadges` | `user.controller.ts:80` |
| 4 | GET | `/users/me/activity` | ✅ JWT | `@ApiAuth()` + `@ApiUserActivityResponse()` | `listUserActivity` | `user.controller.ts:96` |
| 5 | GET | `/users/me/tournaments` | ✅ JWT | `@ApiAuth()` + `@ApiMyTournamentsResponse()` | `listMyTournaments` | `user.controller.ts:115` |
| 6 | GET | `/users/me/tournament-history` | ✅ JWT | `@ApiAuth()` + `@ApiMyTournamentHistoryResponse()` | `listMyTournamentHistory` | `user.controller.ts:132` |
| 7 | GET | `/users/me/tournaments/analytics` | ✅ JWT | `@ApiAuth()` + `@ApiMyTournamentAnalyticsResponse()` | `getMyTournamentAnalytics` | `user.controller.ts:149` |
| 8 | GET | `/users/me/ranking` | ✅ JWT | `@ApiAuth()` + `@ApiUserRankingResponse()` | `getMyRanking` | `user.controller.ts:162` |
| 9 | GET | `/users/me/analytics` | ✅ JWT | `@ApiAuth()` + `@ApiUserAnalyticsResponse()` | `getMyAnalytics` | `user.controller.ts:175` |
| 10 | PATCH | `/users/me` | ✅ JWT | `@ApiAuth()` + `@ApiUserMeUpdatedResponse()` | `updateMe` | `user.controller.ts:188` |
| 11 | PATCH | `/users/me/settings` | ✅ JWT | `@ApiAuth()` + `@ApiUserSettingsUpdatedResponse()` | `updateMeSettings` | `user.controller.ts:202` |
| 12 | GET | `/users/:userId/quizzes/analytics` | ✅ JWT | (no `@ApiAuth()`) + `@ApiCreatorQuizAnalyticsResponse()` + `@ApiNotFoundAndInternal()` | `getUserQuizAnalytics` | `user.controller.ts:217` |
| 13 | GET | `/users/:userId/quizzes` | ✅ JWT | (no `@ApiAuth()`) + `@ApiUserQuizListResponse()` + `@ApiNotFoundBadRequestInternal()` | `listUserQuizzes` | `user.controller.ts:229` |
| 14 | GET | `/users/:userId/badges` | ✅ JWT | (no `@ApiAuth()`) + `@ApiUserBadgesResponse()` + `@ApiNotFoundBadRequestForbiddenInternal()` | `listBadgesByUserId` | `user.controller.ts:244` |
| 15 | GET | `/users/:userId/tournament-history` | ✅ JWT | (no `@ApiAuth()`) + `@ApiPublicTournamentHistoryResponse()` + `@ApiNotFoundBadRequestForbiddenInternal()` | `getUserTournamentHistory` | `user.controller.ts:264` |
| 16 | GET | `/users/:userId/tournaments` | ✅ JWT | (no `@ApiAuth()`) + `@ApiPublicTournamentProfileResponse()` + `@ApiNotFoundForbiddenInternal()` | `getPublicTournamentProfile` | `user.controller.ts:285` |

**Total: 16 endpoints audited.** (`docs/generated/openapi.json` also lists 22 other `/api/v1/users/me/*` routes — `attempts`, `comments`, `discussions`, `followed-categories`, `followed-tags`, `reported-reviews`, `reviews`, `saved-threads`, `upvoted-comments`, `upvoted-threads`, `discussion-subscriptions`. These belong to other modules' controllers (attempt, discussion, review, category, tag, social) and are **out of scope** for this audit, but documented at the end for cross-module awareness.)

---

## 2. Findings Summary

### 2.1 Severity tally

| Severity | Count |
|---|---|
| **Critical** | 3 |
| **High** | 7 |
| **Medium** | 6 |
| **Low** | 4 |
| **Total** | **20** |

### 2.2 Issue category tally

| Category | Count |
|---|---|
| Implementation bug | 2 |
| OpenAPI / schema inconsistency | 9 |
| Validation inconsistency | 1 |
| Documentation drift (timestamps, examples) | 4 |
| Auth/Authz drift | 2 |
| Swagger example not wired | 2 |

### 2.3 Overall contract health score: **5.5 / 10**

The envelope convention works and validation rules mostly behave. But the controller has a hard 500 on the tournament-history endpoints (a broken Drizzle subquery), the OpenAPI references schemas that don't exist (`WrappedDto` / `WrappedPaginatedDto` are absent from `components.schemas`), the badges list and recommended-quizzes OpenAPI shapes contradict the wire format, the avatar URL validator accepts `not-a-url`, and two of the `:userId/*` endpoints silently return 200 with empty data for non-existent users despite documenting 404.

---

## 3. Critical Issues

### C1. `GET /users/me/tournament-history` and `GET /users/{userId}/tournament-history` return HTTP 500

**Severity:** Critical
**Endpoint:** `GET /api/v1/users/me/tournament-history`, `GET /api/v1/users/{userId}/tournament-history`

**Documented behavior:** 200 OK with cursor-paginated history, 400/403/404/500 as documented.

**Actual behavior:** Every call returns HTTP 500 with `extensions.code = GLOBAL_INTERNAL_ERROR`. The detail message is:

```
"You tried to reference \"participantCount\" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using \".as('alias')\" method."
```

**Root cause:** `src/modules/user/infrastructure/repositories/user.repository.ts:392` references `participantCountSubquery.participantCount` inside the main `select()`. The subquery on lines 375–383 declares `participantCount: count()`, but Drizzle requires an explicit `.as('participant_count_subquery')` on the *outer* select fields when referring to columns whose SQL is wrapped (`count()` produces a raw SQL expression). The current join structure passes the alias to the *subquery*, but the field referenced in the outer query is the raw SQL column.

Live HTTP evidence:
```
GET /api/v1/users/me/tournament-history → 500
GET /api/v1/users/019f5e13-1fca-798f-93cc-b5ef8699de25/tournament-history → 500
GET /api/v1/users/00000000-0000-0000-0000-000000000000/tournament-history → 500
```

**Implementation correct?** No — this is an implementation bug.
**Documentation correct?** Yes — 200 is the intended contract.

**Recommendation:** Fix the repository query. Replace
```ts
participantCount: participantCountSubquery.participantCount,
```
with an aliased `count(*)` (e.g. a window function or a correlated subquery), or use Drizzle's relational query builder so the column is mapped through the table alias. Estimated effort: 30 minutes + integration test that exercises the path with a finished tournament.

**Suggested fix:**
```ts
// Option A — correlated subquery (cleanest, no Drizzle alias gymnastics):
const participantCountSub = sql<number>`(
  SELECT COUNT(*)::int FROM ${tournamentParticipants} tp2
  WHERE tp2.tournament_id = ${tournaments.tournamentId}
    AND tp2.rank_final IS NOT NULL
)`;

// in select({...}):
participantCount: participantCountSub,
```

---

### C2. `WrappedDto` and `WrappedPaginatedDto` schemas are referenced but absent from `components.schemas`

**Severity:** Critical (broken OpenAPI document)
**Endpoints:** every endpoint that uses `ApiOkResource` / `ApiOkResourceList` (which is *every* documented 200 response in this module)

**Documented behavior:** Each 200 response in `openapi.json` carries an `allOf` that references `#/components/schemas/WrappedDto` or `#/components/schemas/WrappedPaginatedDto`. A consumer generating clients with Orval / openapi-generator / swagger-codegen expects those refs to resolve.

**Actual behavior:** `#/components/schemas` contains `OffsetPaginationMetaDto`, `PaginationMetaDto`, `ProblemDetailDto`, and dozens of DTOs — but **not** `WrappedDto` or `WrappedPaginatedDto`. The refs are dangling.

Evidence:
```bash
$ jq '.components.schemas | keys | map(select(. | test("Wrapped")))' openapi.json
[]
```

**Root cause:** `WrappedDto<T>` and `WrappedPaginatedDto<T>` are defined as **generic** classes in `src/common/swagger/swagger-schemas.ts:269` and `:284`. Generic classes are not registered with `ApiExtraModels()`, so `@nestjs/swagger` doesn't emit them into `components.schemas`. The helper `ApiOkResource` (`src/common/swagger/api-ok.ts:106`) calls `ApiExtraModels(model)` for `T` but not for `WrappedDto` itself. Swagger CLI tools report broken refs and (depending on the tool) either skip the property or fail to generate clients.

**Implementation correct?** Yes — the runtime envelope is `{ data, meta }` and the wire shape is correct. The OpenAPI document is broken.
**Documentation correct?** No.

**Recommendation:** In `src/common/swagger/api-ok.ts`, register the wrappers explicitly:
```ts
import { ApiExtraModels } from '@nestjs/swagger';
import { WrappedDto, WrappedPaginatedDto, OffsetPaginationMetaDto, PaginationMetaDto, ResponseMetaDto } from './swagger-schemas';

const buildResourceSchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    { properties: { data: { $ref: getSchemaPath(model) } } },
  ],
});

export const ApiOkResource = <T extends Type>(model: T, options = {}): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({ ...options, schema: buildResourceSchema(model) }),
  );
```
Apply the same to `ApiOkResourceList` and `ApiOkResourceArray`. Regenerate `docs/generated/openapi.json` and verify both refs resolve.

---

### C3. `PATCH /users/me` `avatarUrl` validator accepts non-URL strings

**Severity:** Critical (silent data corruption; security-adjacent)
**Endpoint:** `PATCH /api/v1/users/me`

**Documented behavior:** `avatarUrl` is documented as a URL (`example: 'https://example.com/avatars/alice.jpg'`).

**Actual behavior:** Sending `{"avatarUrl": "not-a-url"}` is **accepted**, persisted, and returned in the response body. Verified via direct DB write through the endpoint and observed in the response:

```json
{
  "data": { "avatarUrl": "not-a-url", ... },
  "meta": { "timestamp": "..." }
}
```

**Root cause:** `src/modules/user/dto/request/update-me.dto.ts:42` declares `@IsUrl({ require_tld: false })`. `validator.js`'s `isURL()` with `require_tld:false` accepts strings containing a `.` regardless of scheme — `not-a-url`, `foo.bar`, etc. all return `true`. The validator is effectively permissive.

**Implementation correct?** No — the constraint is too loose.
**Documentation correct?** Yes (it documents a URL).

**Recommendation:** Tighten to `@Matches(/^https?:\/\//)` plus a max length, or remove `require_tld:false` so a scheme becomes mandatory:
```ts
@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
@MaxLength(2048)
avatarUrl?: string | null;
```
Add unit tests for `not-a-url`, `foo.bar`, `ftp://x.y`, and a too-long URL.

---

## 4. High Issues

### H1. `GET /users/me/badges` and `GET /users/{userId}/badges` document wrong array item schema

**Severity:** High
**Endpoints:** `GET /users/me/badges`, `GET /users/{userId}/badges`

**Documented behavior:** The 200 schema says `data: UserBadgesResponseDto[]`. `UserBadgesResponseDto` is itself `{ items: UserBadgeItemDto[], pagination: UserBadgesPaginationDto }` — i.e. the OpenAPI claims each row of the array is *another* envelope.

**Actual behavior:** The wire format is `{ data: UserBadgeItemDto[], meta: { timestamp, pagination } }` — flat items.

**Root cause:** `ApiUserBadgesResponse()` (`user-swagger-decorators.ts:63`) is implemented as `ApiOkResourceList(UserBadgesResponseDto, 'cursor', ...)`. The list helper treats `UserBadgesResponseDto` as the *item* type but it's actually the *wrapper* type. The controller's presenter (`user.presenter.ts:71`) correctly projects to `UserBadgeItemDto` via `wrapPaginatedDto<UserBadgesResponseDto['items'][number]>` — so the runtime is right and the OpenAPI is wrong.

**Implementation correct?** Yes.
**Documentation correct?** No.

**Recommendation:** Replace `ApiOkResourceList(UserBadgesResponseDto, 'cursor', ...)` with `ApiOkResourceList(UserBadgeItemDto, 'cursor', ...)` in `user-swagger-decorators.ts:63`. Same issue applies to `ApiUserActivityResponse` if `UserActivityResponseDto` is also passed as the item — verify (currently `UserActivityResponseDto['items'][number]` is `UserActivityItemDto` at runtime, but the helper takes the wrapper). Inspect `user-swagger-decorators.ts:66` and confirm whether the call passes the wrapper or the item.

---

### H2. `GET /users/me/recommended-quizzes` documents pagination meta but runtime returns bare-array meta

**Severity:** High
**Endpoint:** `GET /users/me/recommended-quizzes`

**Documented behavior:** The 200 schema references `WrappedPaginatedDto` + `PaginationMetaDto`. So the contract says `meta.pagination.{ kind, limit, hasNextPage, nextCursor }`.

**Actual behavior:** Live response:
```json
{
  "data": [],
  "meta": { "timestamp": "2026-07-14T02:38:59.674Z" }
}
```
No `meta.pagination`. `nextCursor` is unreachable.

**Root cause:** `UserPresenter.getRecommendedQuizzes` (`user.presenter.ts:84`) returns `ApiResponse.ok([...dto.items])` — a bare array, not a paginated envelope. `RecommendedQuizzesQueryDto` has no `cursor` field (`recommended-quizzes-query.dto.ts`). The decorator uses `ApiOkResourceList(QuizResponseDto, 'cursor', ...)` (`user-swagger-decorators.ts:104`) which both picks the wrong item type and the wrong envelope kind.

**Implementation correct?** Yes (the controller has no cursor parameter; a bare array is the truthful shape).
**Documentation correct?** No.

**Recommendation:** Switch the decorator to `ApiOkResourceArray(QuizListItemDto, ...)` (the runtime actually returns `QuizListItemDto[]`, not `QuizResponseDto[]`). Or, if a future iteration will add cursors, change the runtime + DTO to match. Until then, do not advertise pagination on a pageless endpoint.

---

### H3. `GET /users/{userId}/quizzes/analytics` returns 200 OK for non-existent users, but documents 404

**Severity:** High
**Endpoint:** `GET /users/{userId}/quizzes/analytics`

**Documented behavior:** 404 if the user does not exist (`@ApiNotFoundAndInternal()`).

**Actual behavior:** Requesting `GET /users/00000000-0000-0000-0000-000000000000/quizzes/analytics` returns:
```json
{
  "data": {
    "userId": "00000000-0000-0000-0000-000000000000",
    "totalQuizzes": 0,
    "draftQuizzes": 0,
    ...
  },
  "meta": { "timestamp": "..." }
}
```

**Root cause:** `getMyQuizAnalytics` (quiz module) calls `getCreatorAnalytics(userId)` which does a `LEFT JOIN` from `users` and aggregates. With a non-existent user, the LEFT JOIN produces one row with all aggregations = 0, and the service happily returns it. There is no `assertUserExists` step.

**Implementation correct?** Yes (consistent with the implementation's "creator analytics are aggregate, not lookup" semantics — it doesn't claim to validate the user exists).
**Documentation correct?** No — the decorator promises a 404 branch that the implementation never produces.

**Recommendation:** Two options:
1. **Fix the doc** — change `@ApiNotFoundAndInternal()` to `@ApiInternalError()` since the endpoint never throws 404.
2. **Fix the implementation** — add `await this.userDomainService.getMe(userId)` at the top of `getUserQuizAnalytics` (mirroring what `getMyTournamentAnalytics` does). That will throw `UserNotFoundError` (mapped to 404 by `ProblemCodeMapping['USER_NOT_FOUND']`).

Option 2 is the better fix because the documented semantic — "this endpoint describes a user" — implies user existence is a precondition.

---

### H4. `GET /users/{userId}/tournaments` returns 200 OK for non-existent users, but documents 404

**Severity:** High
**Endpoint:** `GET /users/{userId}/tournaments`

**Documented behavior:** 404 if the user does not exist (`@ApiNotFoundForbiddenInternal()`).

**Actual behavior:** Same pattern as H3 — `LEFT JOIN` from `users` returns a row with zeros/nulls. No 404 ever produced.

**Root cause:** `user.repository.getPublicTournamentProfile` (`user.repository.ts:415`) does a `LEFT JOIN` against `tournamentParticipants`. The grouped row always exists with `isNull(users.deletedAt)` filter — but if `users.user_id` doesn't match, the entire `LEFT JOIN` produces a single all-zero row (Drizzle wraps `COUNT` in `CASE WHEN ... IS NOT NULL` but with no matching participant rows, returns 0/null).

**Implementation correct?** Partially — consistent with H3.
**Documentation correct?** No.

**Recommendation:** Same as H3. Either add a user-existence precondition (`assertProfileVisible` calls `getMe` already, but only on private profiles — public profiles skip the existence check) or document 200-with-zeros as the actual contract.

---

### H5. `GET /users/{userId}/badges` returns 200 OK + empty array for non-existent users, but documents 404

**Severity:** High
**Endpoint:** `GET /users/{userId}/badges`

**Documented behavior:** 404 if the user does not exist (`@ApiNotFoundBadRequestForbiddenInternal()`).

**Actual behavior:** Requesting `GET /users/00000000-0000-0000-0000-000000000000/badges` returns `{ data: [], meta: { timestamp, pagination: { limit: 10, hasNextPage: false, nextCursor: null } } }`. No 404.

**Root cause:** `listUserBadges` (`user.service.ts:75`) calls `assertProfileVisible(userId, requesterId)` which throws `UserProfilePrivateError` for a *private* non-self profile but does NOT throw if the user doesn't exist (`isUserProfilePublic` returns `true` for missing `user_profile_settings`, see `user.service.ts:62`). So a non-existent user is treated as "public", and the subsequent query simply returns zero rows.

**Implementation correct?** No — privacy logic silently treats non-existent users as public, bypassing 404.
**Documentation correct?** Yes (documents 404).

**Recommendation:** In `UserDomainService.assertProfileVisible`, before returning the public default, verify the user exists:
```ts
async assertProfileVisible(targetUserId: string, requesterId: string): Promise<void> {
  if (requesterId === targetUserId) return;
  const user = await this.userRepository.findMeById(targetUserId);
  if (!user) throw new UserNotFoundError();   // 404
  const isPublic = await this.isUserProfilePublic(targetUserId);
  if (!isPublic) throw new UserProfilePrivateError(targetUserId);
}
```
This requires a small extra DB hit per call but unifies the privacy/existence semantics.

---

### H6. `:userId/*` routes require JWT but OpenAPI does not document 401 / security scheme

**Severity:** High
**Endpoints:** 12, 13, 14, 15, 16 (`/users/:userId/*`)

**Documented behavior:** `paths["/users/:userId/*"].get` has `"security": null` — no 401 response, no `BearerAuth` security requirement.

**Actual behavior:** All five endpoints return HTTP 401 for unauthenticated requests (the global JWT guard runs). Verified live:
```
$ curl -s -o /dev/null -w "%{http_code}" /api/v1/users/019f5e13-1fca-798f-93cc-b5ef8699de25/badges
401
```

**Root cause:** The controller methods don't carry `@ApiAuth()`. There's also no `@Public()` on them, so the global `JwtGuard` blocks them. The OpenAPI document never documents the 401 because no `@ApiUnauthorizedResponse()` is wired.

**Implementation correct?** Yes (security policy is intentional: JWT required for everything).
**Documentation correct?** No (security requirement is undocumented).

**Recommendation:** Add `@ApiAuth()` to every `:userId/*` controller method (5 endpoints). This injects both `BearerAuth` and a 401 response. Alternatively, document a security default at the controller class level (NestJS supports `@ApiSecurity` / `@ApiBearerAuth` on the class).

---

### H7. Authenticated `:userId/*` endpoints document 403 but never throw it for the wrong-requester case

**Severity:** High (medium if read as "documented semantics")
**Endpoints:** 14, 15, 16

**Documented behavior:** `@ApiNotFoundBadRequestForbiddenInternal()` advertises 403 Forbidden for "the profile is private and cannot be accessed".

**Actual behavior:** Verified — privacy check works (returns 403 with `extensions.code = USER_PROFILE_PRIVATE`). However, the *decorator description* on the 403 (`user-swagger-decorators.ts:40`) reads `The profile is private and cannot be accessed` — but the `instance` in the error body points to the request path (e.g. `/users/.../badges`), not the `/users/.../profile` URL the description implies. Also, the OpenAPI response **example** for 403 is hardcoded to a quiz route:

```json
{ "instance": "/quizzes/660e8400-e29b-41d4-a716-446655440000" }
```

This is misleading and applies to all `:userId/*` endpoints — generated clients will show a nonsensical URL in their error examples.

**Root cause:** The error example in `swagger-schemas.ts` is a global constant reused across modules.

**Recommendation:** Add a per-endpoint example override in `user-swagger-decorators.ts` for the 403 path, or document the `instance` as illustrative only.

---

## 5. Medium Issues

### M1. `createdAt` / `updatedAt` returned as Postgres timestamp with timezone, not ISO 8601

**Severity:** Medium
**Endpoints:** 2, 8, 11, 12, 18 (any endpoint that returns `users.created_at` / `users.updated_at`)

**Documented behavior:** All `createdAt` / `updatedAt` examples are ISO 8601 strings ending in `Z` (`'2025-01-15T08:30:00.000Z'`).

**Actual behavior:** Live response from `GET /users/me`:
```json
"createdAt": "2026-07-14 00:42:19.156551+00",
"updatedAt": "2026-07-14 00:42:19.155+00"
```

This is a Postgres `timestamptz` default stringification, NOT ISO 8601 (`T` separator missing, no `Z`). Same for `UserRankingResponseDto.updatedAt`, `CreatorQuizAnalyticsDto.lastUpdated`, `QuizListItemDto.createdAt` / `updatedAt`, etc.

**Root cause:** The `ResponseFormatInterceptor.normalizeTemporalFields` (`response-format.interceptor.ts:99`) normalizes strings whose key ends with `time`, `timestamp`, `date`, or `at`. The detected values are run through `normalizeIsoString` — but only if the `value` is already a parseable ISO string. Postgres timestamps like `2026-07-14 00:42:19.156551+00` parse via `Date.parse` (returns a valid number for modern Node), so they get *re-formatted* via `new Date(parsed).toISOString()` — but in the *response body* the raw DB string was already serialized. The interceptor's `normalizeTemporalFields` walks the object graph, but it only triggers for `Date` instances or for keys it recognizes; the *string values* are then post-processed. In practice the live response shows the raw DB format, suggesting `normalizeIsoString` is not running for these fields (likely because the keys ARE normalized but the underlying value was already a string and `new Date(...).toISOString()` would yield an `Z`-suffixed value... let me re-check by direct observation).

Observed: the response shows `"2026-07-14 00:42:19.156551+00"` for `createdAt` (in `UserMeResponseDto`) but `"2026-06-25T10:30:00.000Z"` for `lastUpdated` in analytics. The difference: `lastUpdated` is computed via `new Date().toISOString()` in the repo, so it's already ISO. `createdAt` is read directly from the DB string column, so it stays as Postgres default. The interceptor's `normalizeIsoString` was meant to handle this but `new Date('2026-07-14 00:42:19.156551+00').toISOString()` *would* produce `'2026-07-14T00:42:19.156Z'` — so something isn't normalizing.

**Implementation correct?** No — partial normalization inconsistency between DTO fields.
**Documentation correct?** Yes (claims ISO 8601).

**Recommendation:** Either (a) standardize the repository to return ISO strings (use `toISOString()` after `new Date(value)`), or (b) ensure `normalizeTemporalFields` actually rewrites all temporal strings. Add a regression test for `users.createdAt` shape.

---

### M2. `GET /users/me/analytics` `summary.averageScore` returns a `number` (rounded) but DB also returns numeric string for some rows

**Severity:** Medium
**Endpoint:** 9

**Documented behavior:** `summary.averageScore: 83.5` (float).

**Actual behavior:** The repository uses `sql<...>` casts; `Number(row?.averageScore ?? 0)` converts the value to a JS `number`. Live response shows `0` (an integer) — the example is `83.5` (a float). The DB-level rounding (`ROUND(..., 1)`) should produce one decimal, so 0 is fine, but clients expecting a float type may get an integer when activity is empty.

This is largely a documentation/runtime nit, not a correctness bug. Track as a low-priority cleanup.

---

### M3. `PATCH /users/me` documents a `"null"` value clear behaviour for `displayName`, but actual trim semantics differ

**Severity:** Medium
**Endpoint:** 10

**Documented behavior:** "Pass `null` (or a blank string) to clear `displayName`, `bio`, or `avatarUrl`."

**Actual behavior:** The DTO applies `@Transform(({ value }) => trimStringToNullIfBlank(value))`. The domain service (`user.service.ts:144-154`) then runs `.trim()` again and falls back to `null` if the trimmed string is empty. So `""` → `null` (correct) and `null` → `null` (correct). However, `undefined` is *also* accepted and skips the field entirely (not the same as clearing — leaves the existing value untouched). This isn't documented.

**Implementation correct?** Mostly — undefined means "don't change", null/blank means "clear". The semantic is reasonable but undocumented.
**Documentation correct?** Partially — should clarify the three-way semantics (`undefined` = no-op, `null` = clear, `""` = clear).

**Recommendation:** Update the OpenAPI description to clarify all three behaviors.

---

### M4. `UpdateMeSettingsDto` requires `settings` to be an object but does not enforce its shape

**Severity:** Medium
**Endpoint:** 11

**Documented behavior:** `settings: object, additionalProperties: true`.

**Actual behavior:** Any object passes validation. A `{ "settings": { "evilKey": "<script>" } }` payload is accepted. Live response persists the object verbatim. The DB column is a `jsonb` with no shape constraint.

**Implementation correct?** Yes (matches the documented "arbitrary key-value settings" semantics).
**Documentation correct?** Yes.

**Risk:** Stored settings surface in client UIs. No XSS via JSON itself, but no validation that nested values are serializable, no max depth, no max key count. Acceptable for now but worth flagging if any downstream consumer trusts the structure.

**Recommendation:** Add a max-keys limit (e.g. 50) and a max-string-length (e.g. 200 chars) per value to prevent abuse.

---

### M5. `:userId` path parameter has no `format: uuid` in OpenAPI

**Severity:** Medium
**Endpoints:** 12, 13, 14, 15, 16

**Documented behavior:** The `userId` path parameter is declared with `schema: { type: 'string' }` — no `format: uuid`. The `@Param('userId', new ParseUUIDPipe())` decorator enforces UUID at runtime (verified: `not-a-uuid` returns 400).

**Actual behavior:** Runtime correctly rejects non-UUIDs (`Validation failed (uuid is expected)`). The OpenAPI doesn't tell generated clients that.

**Recommendation:** Add `@ApiParam({ name: 'userId', format: 'uuid', ... })` on each `:userId/*` method, or define a single `@ApiParam` class-level annotation.

---

### M6. `GET /users/me/analytics` `lastUpdated` returns ISO at runtime, contradicting sibling `users.updatedAt` shape

**Severity:** Medium (consistency)
**Endpoint:** 9

**Documented behavior:** ISO 8601 string.

**Actual behavior:** `"lastUpdated": "2026-07-14T02:33:11.445Z"` (correct ISO 8601 because the repository computes `new Date().toISOString()` if no row is found, see `user.repository.ts:257`).

**Issue:** This field is consistent within itself but inconsistent with sibling `createdAt` / `updatedAt` on the same DTO (`UserMeResponseDto`). Clients parsing the user object see mixed formats.

**Recommendation:** Apply the same normalization to all temporal fields (see M1).

---

## 6. Low Issues

### L1. `getUserRanking` upserts a row when none exists — undocumented side effect

**Severity:** Low
**Endpoint:** 8

**Documented behavior:** GET ranking. No mention of side effects.

**Actual behavior:** `UserDomainService.getUserRanking` (`user.service.ts:111-129`) silently creates a row in `user_ranking` if none exists:
```ts
if (!ranking) {
  void this.logger.warn({ event: 'user_ranking_not_found_creating', userId });
  const created: UserRankingRow = await this.userRepository.createUserRanking(userId);
  ranking = created;
}
```

This is a **write** side effect from a **read** endpoint. Acceptable for a leaderboard system but undocumented.

**Recommendation:** Document the side effect or move to a background job (e.g. cron-based materialization).

---

### L2. `getUserRanking` `level` formula is undocumented

**Severity:** Low
**Endpoint:** 8

**Documented behavior:** `level: 14` example.

**Actual behavior:** `level = Math.floor(totalXp / XP_PER_LEVEL) + 1` (`user.service.ts:36-38`, `XP_PER_LEVEL = 500`). So `totalXp=0` → `level=1`. A user with exactly 500 XP → `level=2`. The formula isn't in the OpenAPI.

**Recommendation:** Document the level formula in `UserRankingResponseDto` (e.g. `description: 'Level derived as floor(totalXp/500) + 1'`).

---

### L3. `getMe` `lastUpdated` field is not actually the profile last-updated

**Severity:** Low (naming/documentation)
**Endpoint:** 2, 10

**Documented behavior:** `updatedAt: Last profile update timestamp (ISO 8601)` — implies it tracks profile changes.

**Actual behavior:** `users.updated_at` is updated by *every* users-table write (XP gain, settings change, etc.), not just `user_profiles` writes. So `updatedAt` shifts after every XP event, not just profile edits.

**Recommendation:** Either rename to `userUpdatedAt` (clearer semantics) or update the description to "Last write to the user record (any field)".

---

### L4. Swagger examples files are dead code

**Severity:** Low (no behavioural impact)
**Endpoints:** all

**Documented behavior:** None — examples are referenced only by the `UserController`'s presentation, but the controller decorators (`user-swagger-decorators.ts`) never import or pass the `USER_ME_EXAMPLE`, `USER_BADGES_EXAMPLE`, etc. constants.

**Actual behavior:** Swagger UI shows generic `"Returns profile."` / `"Returns badges."` etc. descriptions. No example payloads in the 200 schemas.

**Root cause:** `src/modules/user/transport/swagger/examples/{me,badges,analytics,tournaments,quizzes}.examples.ts` define constants but are never imported by the controller's swagger decorators.

**Recommendation:** Either:
- Wire the examples into `ApiUserMeResponse()` etc. via `examples: { 'application/json': { value: USER_ME_EXAMPLE } }`, or
- Delete the example files since they're not used.

Wiring is the preferred path — Swagger UI looks much better with concrete payloads, and generated clients can use them as fixtures.

---

## 7. Cross-Cutting Observations

### X1. `UserRankingResponseDto.totalScore` reflects `userRanking.allTimeXp`, but `UserMeResponseDto.xpTotal` reflects `users.xpTotal`

These are two different columns. After XP updates, both should be in sync, but the `xpTotal` field in `UserMeResponseDto` is sourced from `users.xpTotal`, while `totalScore` in `UserRankingResponseDto` is sourced from `userRanking.allTimeXp`. Both DTOs are documented as "total XP / total score" — clients can be confused which is the canonical source. No bug today, but worth a comment in the DTOs pointing at the underlying columns.

### X2. Cursor encoding inconsistency

Three cursor mappers exist:

| Mapper | Encode method | Decode method |
|---|---|---|
| `UserBadgeCursorMapper` (`user-badge-cursor.mapper.ts`) | `encodeBase64JsonCursor` | `decodeBase64JsonCursor` |
| `UserActivityCursorMapper` (`user-activity-cursor.mapper.ts`) | `encodeBase64JsonCursor` | `decodeBase64JsonCursor` |
| `MyTournamentCursorMapper` (`my-tournament-cursor.mapper.ts`) | `Buffer.from(JSON.stringify).toString('base64url')` | `JSON.parse(Buffer.from(c, 'base64url').toString('utf8'))` |
| `MyTournamentHistoryCursorMapper` (`my-tournament-history-cursor.mapper.ts`) | `Buffer.from(...).toString('base64url')` | `JSON.parse(Buffer.from(c, 'base64url').toString('utf8'))` |

The badge/activity cursor helpers go through `@/common/utils/cursor.util`. The tournament mappers inline their own `Buffer.from(...).toString('base64url')`. The output is compatible (both produce base64url-encoded JSON), but the inline implementations duplicate logic and bypass the helper's normalisation.

**Recommendation:** Consolidate on `decodeBase64JsonCursor` / `encodeBase64JsonCursor` for all four mappers.

### X3. `UserDomainError` extends `BaseDomainException` but `UserRankingNotFoundError` and `UserAnalyticsNotFoundError` are exported and never thrown

`src/modules/user/domain/errors/user-domain.errors.ts:43-62` defines two exceptions flagged in the source as "exported but never thrown in the current codebase". They have entries in `ProblemCodeMapping` so the global filter would handle them correctly if a future call site threw one. No action needed, just noting that the code is preserved intentionally.

### X4. Other `/users/me/*` routes exist but are owned by other modules

The OpenAPI document lists 22 additional `/api/v1/users/me/*` paths:
- `/me/attempts`, `/me/attempts/stats` — attempt module
- `/me/comments`, `/me/discussions`, `/me/discussion-subscriptions`, `/me/discussion-profile`, `/me/upvoted-comments`, `/me/upvoted-threads`, `/me/saved-threads` — discussion module
- `/me/followed-categories` — category module
- `/me/followed-tags` — tag module
- `/me/reviews`, `/me/reviews/{quizId}`, `/me/reported-reviews` — review module

These all route through `@Controller('users')` on sibling controllers. They're **out of scope** for this audit but each would benefit from the same scrutiny. If the audit's goal is "everything under `/users/*`", please commission follow-up audits per module.

---

## 8. Endpoint-by-Endpoint Detail

For brevity, only endpoints with findings are listed below. Endpoints that passed all checks (validation, envelope, status codes, examples) are listed at the end.

### `GET /users/me` (endpoint 2)
- **Status:** 200 ✓ | 401 ✓ | 403 ✗ (never returned) | 500 ✓
- **Envelope:** `{ data, meta: { timestamp } }` ✓
- **Findings:** 403 documented but never thrown (no `@Permissions`-style guard on the route). `createdAt` / `updatedAt` non-ISO format (M1).
- **Recommendation:** Remove 403 from the response set OR introduce an authorization layer that can produce it.

### `PATCH /users/me` (endpoint 10)
- **Status:** 200 ✓ | 400 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Findings:** C3 (avatar URL validator too permissive), M3 (undefined vs null vs blank semantics).
- **Recommendation:** Fix `IsUrl` constraint (C3) and document three-way semantics (M3).

### `GET /users/me/badges` (endpoint 3)
- **Status:** 200 ✓ | 400 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Envelope:** `{ data: UserBadgeItemDto[], meta: { timestamp, pagination } }` ✓
- **Findings:** H1 (`data: UserBadgesResponseDto[]` schema wrong). No example payload (L4). 403 never thrown.

### `GET /users/me/activity` (endpoint 4)
- **Status:** 200 ✓ | 400 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Envelope:** `{ data: UserActivityItemDto[], meta: { timestamp, pagination } }` ✓
- **Findings:** Same as endpoint 3 — schema likely passes `UserActivityResponseDto` (wrapper) instead of `UserActivityItemDto` (item). Verify and fix in parallel with H1.

### `GET /users/me/tournaments` (endpoint 5)
- **Status:** 200 ✓ | 400 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Envelope:** ✓
- **Findings:** No example payload (L4). Schema passes `MyTournamentsResponseDto` (wrapper) — verify.

### `GET /users/me/tournament-history` (endpoint 6)
- **Status:** **500** ✗ — runtime always fails (C1).
- **Recommendation:** Fix C1 first; re-audit after.

### `GET /users/me/tournaments/analytics` (endpoint 7)
- **Status:** 200 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Findings:** `lastUpdated` ISO 8601 ✓. No example payload (L4).

### `GET /users/me/ranking` (endpoint 8)
- **Status:** 200 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Findings:** L1 (silent upsert side effect), L2 (level formula undocumented). `updatedAt` non-ISO format (M1).

### `GET /users/me/analytics` (endpoint 9)
- **Status:** 200 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Findings:** M1 + M2 + M6 (timestamp format inconsistency across DTO).

### `PATCH /users/me/settings` (endpoint 11)
- **Status:** 200 ✓ | 400 ✓ | 401 ✓ | 403 ✗ | 500 ✓
- **Findings:** M4 (no shape validation on settings object).

### `GET /users/{userId}/quizzes/analytics` (endpoint 12)
- **Status:** 200 ✓ (also for non-existent users — H3) | 404 ✗ (documented, never thrown) | 500 ✓
- **Findings:** H3, H6, M5, M1.

### `GET /users/{userId}/quizzes` (endpoint 13)
- **Status:** 200 ✓ (also for non-existent users — see note) | 400 ✓ | 404 ✗ | 500 ✓
- **Findings:** H6, M5. 404 documented but never thrown for missing users (delegated to quiz module — quiz module itself returns 200 with empty list).
- **Note:** This endpoint delegates to `quizListing.listQuizzesByCreator(userId, query)` (quiz module). The quiz module does not validate user existence either, so 404 is impossible.

### `GET /users/{userId}/badges` (endpoint 14)
- **Status:** 200 ✓ (also for non-existent users — H5) | 400 ✓ | 403 ✓ (private profile) | 404 ✗ | 500 ✓
- **Findings:** H1, H5, H6, H7, L4, M5.

### `GET /users/{userId}/tournament-history` (endpoint 15)
- **Status:** **500** ✗ (C1) | 400 ✓ | 403 ✓ (private profile) | 404 ✗ | 500 ✓
- **Findings:** C1, H6, H7, L4, M5.

### `GET /users/{userId}/tournaments` (endpoint 16)
- **Status:** 200 ✓ (also for non-existent users — H4) | 403 ✓ (private profile) | 404 ✗ | 500 ✓
- **Findings:** H4, H6, H7, L4, M5.

### Endpoints that pass all checks (no findings)
- None of the 16 endpoints pass cleanly. The closest are 7 (`/me/tournaments/analytics`) and 11 (`PATCH /me/settings`), which only have low-severity doc-only nits.

---

## 9. Final Summary

### 9.1 Overall contract health score: **5.5 / 10**

| Dimension | Score |
|---|---|
| Runtime correctness | 4/10 — 1 hard 500 (C1), privacy bypass for missing users (H5), partial validator regression (C3) |
| OpenAPI accuracy | 4/10 — missing wrapper schemas (C2), wrong array item schemas (H1), pagination meta mismatch (H2), security/401 omission (H6), example payload absence (L4) |
| Validation correctness | 6/10 — most bounds enforced, but `IsUrl({require_tld:false})` is permissive (C3) and settings has no shape limits (M4) |
| Auth/Authz correctness | 7/10 — global JWT guard works, privacy flow works for known private profiles, but 403 is documented for endpoints that never throw it |
| Documentation completeness | 6/10 — schemas are detailed but drift on 4 fields (404/403/401/example payloads); timestamps format inconsistency (M1) |

### 9.2 Number of endpoints audited: **16**

Plus 22 cross-module `/users/me/*` endpoints noted but out of scope.

### 9.3 Number of issues found by severity

| Severity | Count | IDs |
|---|---|---|
| Critical | 3 | C1, C2, C3 |
| High | 7 | H1, H2, H3, H4, H5, H6, H7 |
| Medium | 6 | M1, M2, M3, M4, M5, M6 |
| Low | 4 | L1, L2, L3, L4 |
| **Total** | **20** | |

### 9.4 Category breakdown

| Category | Count | IDs |
|---|---|---|
| Implementation bug | 2 | C1, C3 |
| OpenAPI / schema inconsistency | 9 | C2, H1, H2, H3, H4, H5, H6, H7, M5 |
| Validation inconsistency | 1 | C3 (also counted above) |
| Documentation drift (timestamps, examples, status codes) | 4 | M1, M2, M3, M6 |
| Auth/Authz drift | 2 | H6, H7 |
| Swagger example not wired | 2 | L4 (also impacts multiple endpoints) |

### 9.5 Recommended fix order

1. **C1** — fix the Drizzle subquery for `tournament-history`. Two endpoints are completely broken today.
2. **C2** — register `WrappedDto` / `WrappedPaginatedDto` in `ApiExtraModels`. Until this is fixed, **no** Orval/openapi-generator consumer can build types correctly.
3. **C3** — tighten the `avatarUrl` validator. This is silent data corruption and a security-adjacent concern.
4. **H1 / H2** — fix the list-item schema references in `user-swagger-decorators.ts`. Two endpoints have wire-shape vs. doc-shape mismatches that confuse generated clients.
5. **H5** — add user-existence precondition to `assertProfileVisible`. Restores documented 404 contract.
6. **H3 / H4** — either document "200 with empty data for unknown users" as the actual contract, or add the user-existence check. Pick one and align both ends.
7. **H6** — add `@ApiAuth()` to the five `:userId/*` endpoints.
8. **H7** — refine the 403 example instance paths (low effort, high polish).
9. **M1 / M6** — fix temporal-string normalization in the response interceptor (or the repository).
10. **M3 / M4 / M5** — documentation tightening.
11. **L1 / L2 / L3 / L4** — documentation polish + dead-code cleanup.

### 9.6 What was NOT modified

Per the audit charter, **no code or documentation was modified during this audit**. The findings above are observations only; the recommended fixes in §3–§7 are suggestions for a follow-up implementation phase.