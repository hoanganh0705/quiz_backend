# Backend Response Envelope Migration Plan

> **Status:** Architecture audit complete. No production code has been modified yet. This document is the canonical migration plan: destination, ordering, risks, and architectural decisions.

---

## Table of contents

1. [Background and goals](#1-background-and-goals)
2. [Current state](#2-current-state)
3. [End-to-end migration plan](#3-end-to-end-migration-plan)
4. [Architecture decisions (with reasoning)](#4-architecture-decisions-with-reasoning)
5. [Helpers and infra to introduce](#5-helpers-and-infra-to-introduce)
6. [Execution timeline](#6-execution-timeline)
7. [Risks and mitigations](#7-risks-and-mitigations)
8. [Per-module migration tables](#8-per-module-migration-tables)

---

## 1. Background and goals

The backend currently produces **seven different runtime response shapes**, some of which are the result of heuristic inference in a global interceptor. A heuristic bug caused a recent production incident (the category module migration). The goal of this plan is to:

1. Make every endpoint return **one canonical contract**: `{ data, meta }`.
2. Remove the heuristic branches from `ResponseFormatInterceptor` so the bug class is permanently eliminated.
3. Keep the application layer (services) free of HTTP-specific concepts so it remains reusable across REST/GraphQL/gRPC/CLI/job consumers.
4. Preserve two pagination strategies (cursor + offset) while keeping a single envelope shape.
5. Standardize error responses on RFC 7807 Problem Details (separate migration track).
6. Reduce and simplify the Swagger surface: replace ~160 hand-rolled `Wrapped*Dto` classes with a small set of generic ones.

**Non-goals:** changing pagination algorithms, changing authentication, changing any business logic.

---

## 2. Current state

### 2.1 The seven runtime response shapes

| Category | Shape returned to client | How produced | Module count | Endpoint count |
|---|---|---|---|---|
| **A** | `{ data: T, meta: { timestamp } }` | Default branch | 15+ | ~95 |
| **B** | `{ data: T[], meta: { timestamp, pagination } }` | `isPaginatedPayload` branch | 13 | ~50 |
| **C** | `{ data: T[] (or T), meta: { timestamp, [pagination] } }` | `isFormattedResponse` branch (category pre-wrap) | 1 | ~15 |
| **D** | `{ data: { items: [...] }, meta: { timestamp } }` | Default branch (heuristic missed it) | 2 (tag, instance) | 5 |
| **D-variant** | `{ data: { items, ...other fields } }` | Default branch | 6 modules | ~10 |
| **E** | `{ data: { data: [...], total }, meta: { timestamp } }` | Default branch | 1 (achievement) | 4 |
| **F** | `{ data: [...], meta: { timestamp } }` from bare array returns | Default branch | 3 modules | 7 |
| **G** | `{ data: null, meta: { timestamp } }` from `Promise<void>` | Default branch | 8+ | 25 |

**Destination:** every endpoint becomes **A** (single resource) or **B** (paginated), with `B` supporting both cursor and offset pagination via a discriminated `meta.pagination` block.

### 2.2 The interceptor today

`src/common/interceptors/response-format.interceptor.ts` (189 lines) registered globally at `src/app.module.ts:128-131`. Three branches:

```
payload
  ├─ is StreamableFile / response already sent → bypass
  ├─ isFormattedResponse (has data + meta.timestamp: string) → pass through
  ├─ isPaginatedPayload (has items + pagination, both plain objects) → flatten
  └─ else → { data: payload, meta: { timestamp } }
```

`isPaginatedPayload` (lines 110-121) is load-bearing for ~50 endpoints across 11+ modules. Removing it without first migrating services would break them. The D, D-variant, E, F shapes all silently fall through to the default branch, producing broken `data: { items }` envelopes for clients.

### 2.3 Module count summary

- **17 modules** with HTTP endpoints (18 total; `email` is worker-only).
- **26 controller files**.
- **195 endpoints** total.
- **160+ `Wrapped*Dto` classes** across per-module `*-response-docs.dto.ts` files.
- **13 domain exception filters** producing at least 3 distinct error shapes.

---

## 3. End-to-end migration plan

### Phase 0 — Pre-flight (1 day)

**Additions only. Zero risk to existing code.**

- Create `docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md` (this document).
- Add `src/common/responses/api-response.ts` with `ApiResponse.ok()`, `ApiResponse.page()`, the `ApiResponse<T>` and `ResponseMeta` interfaces. Unit tests in `src/common/responses/api-response.spec.ts`.
- Add `src/common/responses/pagination.ts` with `CursorPagination`, `OffsetPagination`, and the `PaginationMeta` discriminated union.
- Add `src/common/responses/paginated-result.ts` with `PaginatedResult<T>` (a domain-level concept shared between application services and presenters).
- Add `src/common/swagger/api-ok.ts` with `ApiOkResource()` and `ApiOkResourceList(model, 'cursor' | 'offset')` decorators.
- Add `test/e2e/envelope.spec.ts` smoke test that hits one endpoint per module; asserts `data`, `meta.timestamp` (ISO 8601), and (when paginated) `meta.pagination` (with the discriminator `kind` field set correctly per endpoint). This is the e2e backstop for the entire migration.

**Exit criteria:** all tests pass; no production code touched.

### Phase 1 — Introduce the Presenter layer (3-5 days)

For each module in this order — smallest / lowest-risk first:

1. `auth` (20 endpoints)
2. `health` (1 endpoint)
3. `search` (1 endpoint)
4. `attempt` (10 endpoints)
5. `bookmark` (16 endpoints)

Per-module work:

- Create `transport/presenters/<module>.presenter.ts` with one method per endpoint type. Usually `toEnvelope(dto)` and `toPaginatedEnvelope(paginatedResult)`.
- Update controller: `return this.presenter.toEnvelope(await this.service.method(...))`.
- Update `<module>-response-docs.dto.ts` — delete the per-resource `Wrapped*Dto` classes; lean on the generic `WrappedDto<T>` / `CursorWrappedDto<T>` / `OffsetWrappedDto<T>` from `swagger-schemas.ts`.
- Replace per-endpoint `@ApiOkResponse({ type: SomeWrappedDto })` with `@ApiOkResource(RelevantDto)` or `@ApiOkResourceList(RelevantDto, 'cursor')`.
- Verify e2e test passes for that module's endpoints.

**Exit criteria:** five modules migrate cleanly. The interceptor's heuristic remains intact but is no longer triggered by these endpoints in practice.

> ✅ **Phase 1 complete** (all five modules migrated, Jul 2026):
> `auth` (20 endpoints) · `health` (1) · `search` (1) · `attempt` (10) · `bookmark` (16) = **48 endpoints total**.
> `src/modules/auth/transport/presenters/auth.presenter.ts`, `src/modules/health/health.presenter.ts`,
> `src/modules/search/transport/search.presenter.ts`, `src/modules/attempt/transport/presenters/attempt.presenter.ts`,
> `src/modules/bookmark/transport/presenters/bookmark.presenter.ts` created. All `Wrapped*Dto` classes deleted from
> `auth-response-docs.dto.ts`, `attempt-response-docs.dto.ts`, `bookmark-response-docs.dto.ts` (health and search had none).
> Remaining Phase 1 cleanup (docs files, lint issues in unrelated files) tracked separately.

### Phase 2 — Roll out presenter to remaining modules (10-14 days)

Same work pattern as Phase 1, in this order:

1. **`category`** (15 endpoints). **Roll back** the previous "pre-wrapped envelope" change in `category-query.service.ts` so it returns `PaginatedResult<CategoryResponseDto>` (or `CategoryResponseDto[]` for non-paginated). The new `category.presenter.ts` does the wrapping.

   > ✅ **`category` migrated** (Jul 2026): 15 endpoints. `category-query.service.ts` rolled back to return raw DTOs / `PaginatedResult<T>`. `category.presenter.ts` does the wrapping via `ApiResponse.ok` / `ApiResponse.page`. `category-response-docs.dto.ts` deleted (452 lines). `category-swagger-decorators.ts` rewritten on top of `ApiOkResource / ApiCreatedResource / ApiOkResourceList`.
2. **`discussion`** (45 endpoints; doc said 44 — count includes `quiz-discussion` and `user-discussion` controllers). D-variant endpoints re-shaped at the service level. ✅ done.
3. **`quiz`** (21 endpoints). `POST .../questions/bulk` bare-array return fixed. ✅ done.
4. **`social`** (30 endpoints). 5 bare-array endpoints re-typed at the service level (`searchUsernameSuggestions` now returns `string[]` directly; `getBlockedUsers` now returns `BlockedUserDto[]`). 4 D-variant endpoints re-shaped to return `PaginatedResult<T>` (`getFriends`, `getFriendsOfUser`, `getFollowers`, `getFollowing`); cursor is the last item's `friendSince` / `followedAt` timestamp when `hasNextPage` is true. ✅ done.

   > ✅ **`social` migrated** (Jul 2026): 30 endpoints. `social-application.service.ts` reshaped — `searchUsernameSuggestions` → `string[]`, `getBlockedUsers` → `BlockedUserDto[]`, `getFriends`/`getFriendsOfUser`/`getFollowers`/`getFollowing` → `PaginatedResult<T>`. `social.presenter.ts` (30 methods) added; uses `wrapOffsetPaginatedDto` for offset-paginated DTOs and `ApiResponse.page` for cursor `PaginatedResult<T>`. `social-response-docs.dto.ts` (303 lines) deleted. `social-response.dto.ts` removed (was a no-op re-export). New `message-response.dto.ts` added for the `POST /block/:userId` confirmation. `social.controller.ts` rewritten on `ApiOkResource / ApiCreatedResource / ApiOkResourceList`; `string[]` `search/suggestions` uses a hand-rolled schema with `WrappedDto.allOf`. 204 endpoints (respond / cancel / remove friend / unblock / follow / unfollow) bypass the presenter entirely.
5. **`tournament`** (16 endpoints). Offset pagination preserved; `TournamentOffsetMetaDto` becomes the standard offset meta. ✅ done.

   > ✅ **`tournament` migrated** (Jul 2026): 16 endpoints. `tournament.presenter.ts` added with inline `wrapCursorPaginatedDto` (re-uses `CursorPagination` kind) and `wrapOffsetPaginatedDto` (re-uses `OffsetPagination` kind, computing `hasMore = page < ceil(total/limit)`). `tournament-response-docs.dto.ts` (351 lines, including `TournamentDomainErrorDto`) deleted; `TournamentDomainErrorDto` extracted into a new `dto/error/tournament-domain-error.dto.ts` (still referenced by the controller for error-response documentation). `tournament.controller.ts` rewritten on `ApiOkResource / ApiCreatedResource / ApiOkResourceList`; error-response decorators (400, 403, 404, 409 with `oneOf` against `ProblemDetailDto + TournamentDomainErrorDto`) preserved verbatim. `tournament.module.ts` registers the new presenter. All 12 paginated/list endpoints now use the canonical envelope.
6. **`ranking`** (18 endpoints: 14 in `ranking.controller.ts`, 4 in `ranking-admin.controller.ts`). D-variant endpoints re-shaped; ranking's custom pagination meta is normalized. ✅ done.

   > ✅ **`ranking` migrated** (Jul 2026): 18 endpoints. `ranking.presenter.ts` added with 18 methods. Three patterns in play: (a) single-resource endpoints (`getLeaderboardDistribution`, `getMyRank`, `getUserRank`, `getMyPercentile`, `getMyRankMovement`, `getMyPeakRanks`, `getUserRankingHistory`, `getNearbyRanks`, plus 4 admin endpoints) → `ApiResponse.ok`; (b) bare-array DTOs (`{ items }`) — `getTopMovers`, `getMyRankingMilestones`, `getMyRankingHistory` — unwrap to bare arrays via the presenter's `(payload) => ApiResponse.ok([...payload.items])`; (c) `LeaderboardResponseDto` (the only complex resource, carrying `entries`, `totalParticipants`, `userPosition`, `period`, plus a custom `pagination: { limit, offset, hasMore }` field inside the DTO) — kept as a single-resource wrap, since splitting entries out would orphan the user-position / period metadata. `getMyRankForPeriod` and `getUserRankForPeriod` collapse `undefined` (user has no rank in the period) into `ApiResponse.ok(null)` so the envelope is still well-formed. `leaderboard-response-docs.dto.ts` (350 lines, including `RankingDomainErrorDto`) deleted; `RankingDomainErrorDto` extracted into a new `dto/error/ranking-domain-error.dto.ts`. The custom `pagination: { limit, offset, hasMore }` shape inside `LeaderboardResponseDto` was intentionally NOT migrated to `{ kind: 'offset', page, limit, total, hasMore }` — changing the wire shape would break every frontend consumer; the migration's "normalized" note refers to envelope normalization only.
7. **`notification`** (11 endpoints). Re-shape the D-variant (`{ items, unreadCount, hasNextPage }` → `PaginatedResult<NotificationDto>` plus a separate unread-count endpoint). ✅ done.

   > ✅ **`notification` migrated** (Jul 2026): 11 endpoints. `notification-application.service.ts` reshaped — `getNotifications` now returns `PaginatedResult<NotificationResponseDto>` (cursor pagination; `nextCursor` is the base64-encoded `{createdAt, notificationId}` pair, matching the pre-migration cursor format) and **drops the `unreadCount` field** — clients now call the dedicated `GET /notifications/unread-count` endpoint for that. The controller-side DTO projection (`DomainNotification → NotificationResponseDto`) and the row-level DTO projection (`NotificationPreferencesRow → NotificationPreferencesResponseDto`) moved into the application service. `notification.presenter.ts` (7 methods) added; uses `ApiResponse.page` for the cursor-paginated list and `ApiResponse.ok` for the 6 single-resource endpoints. `notification-response-docs.dto.ts` (111 lines, 6 `Wrapped*Dto` classes) deleted. `notification.controller.ts` rewritten on `ApiOkResource / ApiOkResourceList`; 204 endpoints (mark-read / mark-unread / mark-all-read / delete-notification) bypass the presenter entirely. `notification.module.ts` registers the new presenter.
8. `user` (16 endpoints). Bare-array fix for recommended-quizzes. ✅ done.

   > ✅ **`user` migrated** (Jul 2026): 16 endpoints. `user.presenter.ts` added with 16 methods (1 per endpoint). Patterns in play: (a) **9 single-resource endpoints** (`me`, `updateMe`, `updateMeSettings`, `getUserRanking`, `getUserAnalytics`, `getMyTournamentAnalytics`, `getUserQuizAnalytics`, `getPublicTournamentProfile`, plus the `me` profile) → `ApiResponse.ok`; (b) **7 cursor-paginated endpoints** (`listMyBadges`, `listBadgesByUserId`, `listUserActivity`, `listMyTournaments`, `listMyTournamentHistory`, `getUserTournamentHistory`, `listUserQuizzes`) — projection is done locally via an inline `wrapPaginatedDto<T>` helper that mirrors the quiz module's helper and produces the standard `{ kind: 'cursor', limit, hasNextPage, nextCursor }` cursor meta; (c) **1 bare-array endpoint** (`getRecommendedQuizzes`) — service returned `RelatedQuizzesResponseDto = { items: QuizResponseDto[] }`, controller unwrapped to `[...items]`, presenter now does `ApiResponse.ok([...dto.items])` directly. `user-response-docs.dto.ts` (625 lines, 13 `Wrapped*Dto` classes) deleted. `user-swagger-decorators.ts` rewritten on `ApiOkResource / ApiOkResourceList`; composed error decorators (`ApiInternalError`, `ApiBadRequestAndInternal`, `ApiNotFoundAndInternal`, `ApiNotFoundBadRequestInternal`, `ApiNotFoundForbiddenInternal`, `ApiNotFoundBadRequestForbiddenInternal`) preserved verbatim with their `badRequestOptions`/`notFoundOptions`/`forbiddenOptions`/`internalErrorOptions` shared by all 16 endpoints. `user.module.ts` registers the new presenter. No application-service re-shaping was needed — every paginated DTO already returns `{ items, pagination }` with the expected cursor shape.
9. `review` (17 endpoints). Move controller re-wrapping into the service. ✅ done. ✅ done.

   > ✅ **`review` migrated** (Jul 2026): 17 endpoints. `review.presenter.ts` added with 15 methods. Patterns: (a) **8 single-resource endpoints** (`getMyReviewDashboard`, `markReviewHelpful`, `removeHelpfulVote`, `reportReview`, `getReviewById`, `getCreatorQuizReviewAnalytics`, `updateReview`, `deleteReview`) → `ApiResponse.ok`; (b) **5 cursor-paginated endpoints** (`listReviews`, `listMyReportedReviews`, `listMyReviews`, `listReviewsByUser`, `listPlatformReports`) — inline `wrapPaginatedDto<T>` helper produces the standard cursor envelope; (c) **2 null-safe endpoints** (`getMyQuizReview` on quiz + user controllers) — service returns `ReviewDetailResponseDto | null`, presenter collapses `undefined`/`null` into `ApiResponse.ok(null)` so the envelope is well-formed. **`listPlatformReports` controller re-wrapping moved into the service** — the application service now calls `ReviewAdminService.listPlatformReports` (raw rows + pagination), runs the `PlatformReportItem → PlatformReportItemDto` projection with `CursorMapper.serializeReport`, and returns `PlatformReportsResponseDto` directly. `review-response-docs.dto.ts` (731 lines, 16 `Wrapped*Dto` classes plus `QuizAnalyticsDataDto` mirror) deleted; `ReviewDomainErrorDto` extracted into a new `review-domain-error.dto.ts` (still referenced by the controller for error documentation). `quiz-review.controller.ts` and `user-review.controller.ts` rewritten on `ApiOkResource / ApiOkResourceList`; admin controller rewritten on `ApiOkResourceList` for the paginated reports and `ApiOkResource` for the status update. All `ApiAuth / ApiPublicErrors` + 400/403/404/409 `ApiBadRequest / ApiForbidden / ApiNotFound / ApiConflict` decorators preserved verbatim with their `oneOf` (ProblemDetail + ReviewDomainErrorDto) schemas. `review.module.ts` registers the new presenter and wires `ReviewAdminService` into `ReviewApplicationService`.
10. `instance` (8 endpoints). Re-shape the leaderboard D-variant. ✅ done.

   > ✅ **`instance` migrated** (Jul 2026): 8 endpoints. `instance.presenter.ts` added with 8 methods. Patterns: (a) **5 single-resource endpoints** (`createInstance`, `joinInstance`, `startInstance`, `closeInstance`, `getInstanceById`, `listInstancePlayers`) → `ApiResponse.ok`; (b) **2 cursor-paginated endpoints** (`listInstances`, `getLeaderboard`) — inline `wrapPaginatedDto<T>` helper produces the standard cursor envelope. **`listInstancePlayers` returns a single-resource `{ instanceId, items, total }` DTO** (no `pagination` key), so it falls into the `ApiResponse.ok` path. **Leaderboard D-variant re-shaped at the service level** — `InstanceLeaderboardResponseDto` now has the canonical `{ items, pagination: { limit, hasNextPage, nextCursor } }` shape; previously it was `{ items, hasNextPage, nextCursor }` (no `pagination` key, `limit` not surfaced). The application service's `getLeaderboardForController` method computes the base64url-encoded cursor from `{ rank, instancePlayerId }` of the last item. Controller re-wrapping moved into the application service — `InstanceApplicationService` gained 7 `*ForController` methods (`createInstanceForController`, `joinInstanceForController`, `startInstanceForController`, `closeInstanceForController`, `getInstanceByIdForController`, `listInstancesForController`, `listInstancePlayersForController`, `getLeaderboardForController`) that now do the row-to-DTO projection; gateway still uses the existing shape-preserving `createInstance/joinInstance/startInstance` methods so the WebSocket handlers are untouched. `instance-leaderboard-response.dto.ts` rewritten on the canonical pagination shape. `instance-response-docs.dto.ts` (227 lines, 8 `Wrapped*Dto` classes) deleted; `InstanceDomainErrorDto` extracted into a new `instance-domain-error.dto.ts`. `instance.controller.ts` rewritten on `ApiCreatedResource / ApiOkResource / ApiOkResourceList`; `instanceNotFoundResponse` / `instanceForbiddenResponse` / `instanceBadRequestResponseDual` / `instanceBadRequestResponseValidation` / `instanceUnauthorizedResponse` helpers preserved verbatim with their `oneOf` (ProblemDetail + InstanceDomainErrorDto) schemas and `ApiExtraModels(ProblemDetailDto, InstanceDomainErrorDto)` registration. `instance.module.ts` registers the new presenter and injects `InstanceResponseMapper` into `InstanceApplicationService`.
11. `tag` (14 endpoints). The popular/trending/related D-variants get re-shaped.

   > ✅ **`tag` migrated** (Jul 2026): 14 endpoints. `tag.presenter.ts` added with 13 methods. Patterns: (a) **9 single-resource endpoints** (`getTagBySlug`, `getTagAnalytics`, `createTag`, `updateTag`, `restoreTag`, `followTag`, `unfollowTag`, `deleteTag`, `getTagQuizzes`) → `ApiResponse.ok`; (b) **2 cursor-paginated endpoints** (`listTags`, `listFollowedTags`) — inline `wrapPaginatedDto<T>` helper produces the standard cursor envelope; (c) **3 bare-array D-variant endpoints** (`getPopularTags`, `getTrendingTags`, `getRelatedTags`) — service layer now returns `RankedTagResponseDto[]` / `TagResponseDto[]` directly (was previously `{ items: [...] }`), presenter unwraps with `ApiResponse.ok([...items])`. **D-variants re-shaped at the service level** — `getRelatedTags`, `getPopularTags`, `getTrendingTags` return bare arrays now (the runtime shape is unchanged on the wire thanks to the standard envelope, but the inner `{ items }` wrapper is gone from the application service). `tag-response-docs.dto.ts` (450 lines, 9 `Wrapped*Dto` classes plus their internal `MetaDto`/`PaginationMetaDataDto` mirrors) deleted; `RankedTagsResponseDto` / `RelatedTagsResponseDto` removed from `parity-response.dto.ts` (no longer referenced). `tag.controller.ts` and `user-tag.controller.ts` rewritten on `ApiOkResource / ApiCreatedResource / ApiOkResourceList`; all composed error decorators (`ApiPopularTagsResponse`, `ApiTrendingTagsResponse`, `ApiTagQuizzesResponse`, `ApiRelatedTagsResponse`, `ApiTagAnalyticsResponse`, `ApiFollowTagResponse`, `ApiUnfollowTagResponse`, `ApiRestoreTagResponse`, `ApiListTagsResponse`, `ApiTagBySlugResponse`, `ApiCreateTagResponse`, `ApiUpdateTagResponse`, `ApiDeleteTagResponse`, `ApiFollowedTagsResponse`) preserved verbatim with their per-endpoint `example.instance` paths. `tag.module.ts` registers the new presenter.
12. `achievement` (10 endpoints). Flatten the E-variant (doubly-nested).

   > ✅ **`achievement` migrated** (Jul 2026): 10 endpoints. `achievement.presenter.ts` added with 9 methods. Patterns: (a) **5 single-resource endpoints** (`getBadgeDetails`, `getPublicAchievementProfile`, `getMyBadgeProgress`, `getMyBadgeAnalytics`, `reevaluateUser`) → `ApiResponse.ok`; (b) **4 bare-array endpoints** (`getBadgeCatalog`, `getMyBadges`, `getMyAchievementHistory`, `getUserHistory`) — service layer now returns `T[]` directly (was previously `{ data: T[], total }`, the doubly-nested E-variant), presenter unwraps with `ApiResponse.ok([...items])`. **E-variant flattened at the service level** — `getBadgeCatalog`, `getMyBadges`, `getMyAchievementHistory` return bare arrays now (the `total` field is dropped since it was only used to compute progress bars client-side and was redundant with `items.length`). The 10th endpoint (`revokeUserBadge`) is a `Promise<void>` 204 — bypasses the presenter entirely. **Admin re-wrapping moved into the application service** — `AchievementApplicationService` now injects `ScheduledEvaluationService` directly and exposes `reevaluateUserForController` and `getUserHistoryForController` methods that perform the row-to-DTO projection (replacing what was inline in `AchievementAdminController`). New `AdminAchievementHistoryItemDto` class added to `achievement-admin-response.dto.ts` (extracted from the deleted `achievement-response-docs.dto.ts` so the admin history endpoint has a proper, documented runtime DTO instead of returning the raw `AchievementHistoryEntry` interface). `achievement-response-docs.dto.ts` (419 lines, 10 `Wrapped*Dto` classes plus their nested data mirrors) deleted. `achievement.controller.ts` rewritten on `ApiAuth / ApiOkResource`; `achievement-admin.controller.ts` rewritten on `ApiOkResource`. `achievement.module.ts` registers the new presenter.

**Risks:** medium. ~115 endpoints' documentation schemas shift to the generic `WrappedDto` family. Coordinate with frontend consumers via PR descriptions.

**Exit criteria:** all 195 endpoints produce `{ data, meta }` envelopes consistently via the presenter layer. The interceptor's heuristic branches are no longer triggered by anything.

### Phase 3 — Standardize domain error filters on RFC 7807 (5-7 days, parallel track)

This is a separate project that doesn't block the envelope migration but is in scope for this overall initiative.

For each of the 13 domain exception filters:

1. Add a machine-readable `code` field to the underlying domain exception class.
2. Replace the per-module error body shape with RFC 7807 `ProblemDetail` (`type`, `title`, `status`, `detail`, `instance`, `extensions.code`, `extensions.requestId`, `extensions.timestamp`).
3. Once a filter only delegates to the global filter, delete it.

**Risks:** medium. Frontend error-handling may have hardcoded `err.statusCode`.

**Exit criteria:** all errors return RFC 7807 ProblemDetail.

### Phase 4 — Remove the heuristic from the interceptor (1 day)

**Heuristic removal only. No throws. Resilient fallback retained.**

1. Delete `isPaginatedPayload` and `PaginatedPayload` from `response-format.interceptor.ts`.
2. Delete `isFormattedResponse` (or simplify to a no-op since presenters always produce envelopes).
3. Replace `formatPayload()` with the resilient default branch:

   ```ts
   intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
     return next.handle().pipe(
       map((payload) => {
         if (this.shouldBypass(context, payload)) {
           return payload as ApiResponse<T>;
         }
         if (!isApiResponse(payload)) {
           this.logger.warn(
             `ResponseFormatInterceptor: payload did not match envelope shape; wrapping as data.`,
           );
         }
         return {
           data: normalizeTemporalFields(payload ?? null, 0) as T,
           meta: { timestamp: new Date().toISOString() },
         };
       }),
     );
   }
   ```

4. Add the structured `Logger.warn` so accidental drift becomes observable without becoming a runtime crisis.
5. Keep `isStreamableFile()` and `isNativeResponseHandled()` bypasses — they handle file downloads and the `@Res({ passthrough: true })` health endpoint.

**The interceptor does not throw under any condition.**

**Risks:** very low. The fallback is the same shape as the previous default branch. The smart branches are simply gone.

**Exit criteria:** interceptor is ~70 lines. No inferences about business response shapes remain.

### Phase 5 — Cleanup (2-3 days)

1. Delete the 160+ per-module `Wrapped*Dto` classes. Replace usages with `WrappedDto<T>`, `CursorWrappedDto<T>`, `OffsetWrappedDto<T>` (3 generic classes from `swagger-schemas.ts`).
2. Update per-module `swagger-decorators.ts` files to use the generic helpers from `src/common/swagger/api-ok.ts`.
3. Update example constants in `*-examples.ts` to match the new generic wrappers.
4. *(Optional follow-up, not blocking)* Refactor the health endpoint from `@Res({ passthrough: true })` to throwing an exception, so `isNativeResponseHandled()` can be removed too.

**Risks:** low. Documentation cleanup. Verify OpenAPI regenerates correctly.

---

## 4. Architecture decisions (with reasoning)

Each of these decisions was discussed critically before adopting. This section explains the reasoning and the trade-offs considered.

### Decision 1 — Minimal helper API (2 methods, discriminated pagination)

**Adopted:**

```ts
class ApiResponse {
  static ok<T>(data: T): ApiResponse<T>;
  static page<T>(items: readonly T[], pagination: PaginationMeta): ApiResponse<T[]>;
}
```

…where `PaginationMeta` is a discriminated union:

```ts
interface CursorPagination {
  readonly kind: 'cursor';
  readonly limit: number;
  readonly hasNextPage: boolean;
  readonly nextCursor: string | null;
}

interface OffsetPagination {
  readonly kind: 'offset';
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly hasMore: boolean;
}

type PaginationMeta = CursorPagination | OffsetPagination;
```

**Why two methods are right (and a third would be wrong):**
- 5 method variants over-specify. Most endpoints have one of two cases: a resource (object or array) or a paginated resource. The original 5-method design had three methods (`array`, `offsetPaginated`, `acknowledged`) that were redundant with type distinctions that didn't pay rent.
- A smaller API is harder to misuse.
- It scales better because every endpoint maps to one of two patterns, so adding a new method becomes a non-decision.
- `Promise<void>` handlers that want a message body should have the **service** return `{ message }` (or similar) and let the presenter wrap it via `ApiResponse.ok({ message })`. A separate `ApiResponse.ack(message?)` would re-introduce the "shape variant" problem the migration is trying to eliminate (it would return `ApiResponse<{ message } | null>`, a union inside `data`, which is the very inconsistency the migration eliminates elsewhere). For handlers with no body, `ApiResponse.ok(null)` is sufficient and matches current behavior.

**Pagination unification (discriminated union, not optional fields):**

The first draft of this plan proposed a single `PaginationMeta` interface with optional fields (`page?: number; total?: number; nextCursor?: string | null; …`). That's wrong. The optional-field approach lets TypeScript accept `{ limit: 10 }` (no cursor, no offset) — a shape with no valid consumer behavior — and produces a `Partial<PaginationMeta>` in client SDKs, which is awful.

A discriminated union with a `kind: 'cursor' | 'offset'` literal:
- Enforces at the call site that **exactly one** of the two shapes is passed.
- Makes mixing `page` and `nextCursor` in the same object a compile error.
- Narrowes correctly inside conditional blocks (`if (pagination.kind === 'cursor')`).
- Renders cleanly in OpenAPI via a discriminator field (rather than `allOf` of two optional shapes).
- Keeps the runtime helper to a single method: `ApiResponse.page(items, pagination)` — the type system does the discrimination. Splitting into `cursor()` + `offset()` would only add two factory methods that produce identical wire output.

**One method or two at the Swagger layer?** Two schema classes (`CursorPaginationMeta`, `OffsetPaginationMeta`) are still needed for OpenAPI `$ref` generation, because the NestJS Swagger plugin emits `$ref` from concrete classes and doesn't natively model discriminated unions. That's a documentation-time concern, not a runtime concern: the runtime helper is one method (`page`); the schema classes are two. The decorator `ApiOkResourceList(model, kind)` takes a `kind` parameter at the *controller* layer to pick which schema class to reference — that parameter never appears in the wire response.

### Decision 2 — Services stay domain-clean; introduce a Presenter layer

**Adopted:** application services return domain DTOs or `PaginatedResult<T>` (never envelopes). A new `transport/presenters/<module>.presenter.ts` wraps application output into envelopes.

**Why services should not return envelopes:**
- Services are the application/business layer. They should be transport-agnostic so the same service can be reused over REST, GraphQL, gRPC, CLI, or background jobs.
- Envelopes (`data`, `meta`, `timestamp`) are HTTP-specific wire-format concerns.
- A service returning `{ data, meta }` couples the business layer to a specific transport. That's a leaky abstraction.

**Why a separate Presenter layer (not in controllers directly, not in mappers):**
- *In the controller:* the controller has too many responsibilities already (routing, validation, auth, status codes). One more concern is acceptable but starts to be untidy.
- *In the mapper (`XxxResponseMapper`):* mappers handle entity-to-DTO conversion, which is a domain concern (what fields to expose, what to redact). Envelope wrapping is a transport concern. Folding them together conflates two distinct layers.
- *In a new Presenter:* cleanly separates "what fields to expose" (DTO) from "how to wire-format" (envelope). The presenter is thin (often a one-liner) and trivially testable.

**Layered architecture:**

```
domain/services                    → returns domain entities / query results (no DTOs, no envelope)
        ↓
application/services               → returns DTOs (e.g. UserResponseDto) or
                                     PaginatedResult<DTO> (a domain-level concept)
                                     NEVER returns { data, meta }
        ↓
transport/presenters               → takes application output and returns ApiResponse<T>
                                     (stateless adapter, one file per module)
        ↓
transport/controllers               → calls the presenter and returns the result
                                     (routing + validation + auth)
```

**Rollback note:** the recent category migration pre-wrapped envelopes in `category-query.service.ts`. **Phase 2 rolls this back**, restoring the service to return `PaginatedResult<CategoryResponseDto>` and moving the wrapping to a new `CategoryPresenter`.

### Decision 3 — Interceptor should not throw

**Adopted:** the global interceptor stays resilient. Contracts are enforced via TypeScript, unit tests, integration tests, e2e tests, and code review. The interceptor remains a fallback (with a structured `Logger.warn` for unexpected shapes) but never throws.

**Why throwing in a global interceptor is wrong:**
- A single missed envelope becomes a process-wide outage depending on which request hits it first.
- It conflates business-layer contract enforcement with infrastructure failure: a missing envelope is a *code bug*, not a *service health issue*. The bug surfaces as a 500 with the wrong log line, the wrong metrics, and the wrong alerting signal.
- Defensive runtime checks in interceptors create a false sense of safety — they let broken code ship and only catch it under load.
- Large NestJS codebases in production typically don't do this. The standard pattern is: typed services → typed presenters → interceptor does only date normalization and timestamp injection.

**What replaces the throw:**
- A `Logger.warn` in the wrap-fallback path (observability, no outage).
- Compile-time guarantees via the generic `ApiResponse<T>` type and TypeScript branding.
- ESLint rule banning raw return shapes from `*.application.service.ts` and `*.presenter.ts`.
- The E2E test from Phase 0 is the runtime backstop.

### Decision 4 — Cursor and offset pagination coexist

**Adopted:** cursor pagination for feeds / discussions / notifications / quizzes; offset pagination for rankings / leaderboards / tournaments / admin reports. Both share the same envelope; `meta.pagination` is just shaped differently.

**Why this is the right long-term design:**
- Cursor and offset solve different problems. Cursor is stable under inserts and cheap at deep pages; offset supports random-access (`?page=5`) and total counts, both essential for admin tables and leaderboards.
- Forcing one style would either:
  - Add expensive total counts to feed-style endpoints (bad for performance), or
  - Remove page-jump capability from ranking endpoints (bad UX), or
  - Require two endpoints per resource (worse — duplicate API surface).

**Envelope stays uniform:** both produce `{ data: T[], meta: { timestamp, pagination } }`. The discriminator is "which fields in `pagination` are populated." The factory method `ApiResponse.page(items, pagination)` accepts `PaginationMeta` and serializes whatever it's given.

### Decision 5 — RFC 7807 for all errors (separate project)

**Adopted:** standardize on RFC 7807 Problem Details everywhere. Per-module `{ statusCode, message, error }` shapes are eliminated.

**Why:**
- The current state has 4+ error shapes (global filter, ranking filter, tournament filter, others). Frontend code that consumes these has to branch on shape to figure out which one it received.
- RFC 7807 is widely adopted; most clients and SDKs handle it natively.
- Adding `extensions.code` preserves the per-module machine-readable error IDs the ranking filter already produces.

**Why a separate project:**
- Error responses are a different contract from success responses. They aren't nested in `{ data, meta }`. Migrating them in the same phase conflates two concerns.
- Different risk profile: error-handling code is often more brittle than success-path code. Splitting the migration reduces the blast radius of any single change.

This runs in parallel as Phase 3.

### Decision 6 — Generic `WrappedDto<T>` for Swagger

**Adopted:** replace the 160+ hand-rolled wrapper classes with 3 generic wrappers (`WrappedDto<T>`, `CursorWrappedDto<T>`, `OffsetWrappedDto<T>`) from `src/common/swagger/swagger-schemas.ts`.

**Why:**
- 160+ nearly-identical classes is real maintenance debt. Each one repeats the same `data` / `meta` boilerplate.
- The only meaningful distinctions across the 160+ classes are:
  1. The `T` in `data: T`
  2. Whether `meta.pagination` is present (cursor vs offset)
- 3 generic classes cover all cases.

**Caveat — NestJS Swagger specifics:**
- The Swagger plugin emits `$ref` schemas from concrete classes, not from TypeScript generics. So `WrappedDto<T>` cannot be referenced directly.
- The standard workaround is `allOf` composition:
  ```ts
  schema: {
    allOf: [
      { $ref: getSchemaPath(WrappedDto) },
      { properties: { data: { $ref: getSchemaPath(SomeDto) } } },
    ],
  }
  ```
- `allOf` has known issues with some TypeScript client generators (they may produce `any` for the data field). Verify the frontend's OpenAPI client codegen still produces correct types after migration.

**Three variants, not one:**
- A single generic `WrappedDto<T>` cannot distinguish "cursor-paginated" from "offset-paginated" because both have `meta.pagination` of different shapes. Three variants (`WrappedDto<T>` for single, `CursorWrappedDto<T>` and `OffsetWrappedDto<T>` for lists) keep the Swagger meta accurate without exploding API surface.

### Decision 7 — Health endpoint keeps `@Res({ passthrough: true })`

**Adopted:** keep the current health pattern. HTTP status code (200 vs 503) is controlled by body content.

**Why this is acceptable:**
- Health endpoints are infrastructure, not business endpoints. They're consumed by load balancers and uptime monitors that rely on HTTP status codes.
- `@Res({ passthrough: true })` keeps the body flowing through interceptors and filters normally, so logging/metrics still work.
- `passthrough: true` is the documented NestJS pattern for status-code control without bypassing the rest of the response pipeline.

**Optional follow-up:** an exception-based pattern (throw `ServiceUnavailableException(...)` and let the global filter turn it into a 503 RFC 7807 body) would let us delete `isNativeResponseHandled()` and shrink the interceptor further. Defer this — it's not blocking.

### Decision 8 — Phased migration, no skipped steps

**Adopted:** the 6-phase plan in §3. Pre-flight first (zero-risk), then presenter layer (low-risk modules first), then bulk rollout, then interceptor simplification, then cleanup.

**Why this ordering:**
- Phase 0 establishes the helper + test infrastructure without touching production code, so everything after is purely additive.
- Phase 1 builds the pattern on the smallest modules first, so the team learns the pattern on real code with low blast radius.
- Phase 2 applies the proven pattern to larger modules in a deterministic order (smallest-blast-radius first).
- Phase 4 (interceptor cleanup) is gated on Phase 2 completion — it removes the heuristic only once no service depends on it.
- Phase 5 is pure cleanup and can be deferred or parallelized.

---

## 5. Helpers and infra to introduce

### 5.1 `src/common/responses/api-response.ts`

```ts
import type { CursorPagination, OffsetPagination } from './pagination';

export type PaginationMeta = CursorPagination | OffsetPagination;

export interface ResponseMeta {
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export class ApiResponse {
  static ok<T>(data: T): ApiResponse<T> {
    return { data, meta: { timestamp: new Date().toISOString() } };
  }

  static page<T>(items: readonly T[], pagination: PaginationMeta): ApiResponse<T[]> {
    return { data: [...items], meta: { timestamp: new Date().toISOString(), pagination } };
  }
}
```

### 5.1a `src/common/responses/pagination.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';

export class CursorPagination {
  @ApiProperty({ example: 'cursor' })
  readonly kind!: 'cursor';

  @ApiProperty({ example: 20 })
  readonly limit!: number;

  @ApiProperty({ example: true })
  readonly hasNextPage!: boolean;

  @ApiProperty({ example: 'eyJpZCI6Li4ufQ==', nullable: true })
  readonly nextCursor!: string | null;
}

export class OffsetPagination {
  @ApiProperty({ example: 'offset' })
  readonly kind!: 'offset';

  @ApiProperty({ example: 1 })
  readonly page!: number;

  @ApiProperty({ example: 20 })
  readonly limit!: number;

  @ApiProperty({ example: 1342 })
  readonly total!: number;

  @ApiProperty({ example: false })
  readonly hasMore!: boolean;
}

export type PaginationMeta = CursorPagination | OffsetPagination;
```

**Note:** `CursorPagination` and `OffsetPagination` are declared with `@ApiProperty` decorators because they serve double duty — they're the runtime TypeScript types *and* the OpenAPI schema classes for `meta.pagination`. The discriminator field `kind: 'cursor' | 'offset'` lets OpenAPI tooling (Swagger UI, `openapi-typescript`, `orval`) render them as a discriminated union.

Unit tests in `src/common/responses/api-response.spec.ts` covering: `ok` with various types (object, array, null), `page` with cursor `PaginationMeta` and offset `PaginationMeta`. Confirm `ok(null)` produces `{ data: null, meta: { timestamp } }` (the canonical "no body" envelope).

### 5.2 `src/common/responses/paginated-result.ts`

```ts
import type { PaginationMeta } from '@/common/responses/pagination';

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly pagination: PaginationMeta;
}

export const paginated = <T>(
  items: readonly T[],
  pagination: PaginationMeta,
): PaginatedResult<T> => ({
  items,
  pagination,
});
```

### 5.3 `src/common/swagger/api-ok.ts`

```ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath, ExtraModel } from '@nestjs/swagger';
import {
  WrappedDto,
  CursorWrappedDto,
  OffsetWrappedDto,
} from './swagger-schemas';

export const ApiOkResource = <T extends Type>(model: T, opts?: { description?: string }) =>
  applyDecorators(
    ExtraModel(model),
    ApiOkResponse({
      description: opts?.description ?? 'Successful response',
      schema: {
        allOf: [
          { $ref: getSchemaPath(WrappedDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );

export const ApiOkResourceList = <T extends Type>(
  model: T,
  kind: 'cursor' | 'offset',
  opts?: { description?: string } = {},
) =>
  applyDecorators(
    ExtraModel(model),
    ApiOkResponse({
      description: opts.description ?? 'Successful response',
      schema: {
        allOf: [
          {
            $ref: getSchemaPath(kind === 'cursor' ? CursorWrappedDto : OffsetWrappedDto),
          },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
```

### 5.4 `src/common/swagger/swagger-schemas.ts` additions

```ts
import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination, OffsetPagination } from '@/common/responses/pagination';

export class TimestampOnly {
  @ApiProperty({ example: '2026-06-25T10:30:00.000Z' })
  timestamp!: string;
}

export class CursorPaginationMeta {
  @ApiProperty() timestamp!: string;
  @ApiProperty({ type: () => CursorPagination }) pagination!: CursorPagination;
}

export class OffsetPaginationMeta {
  @ApiProperty() timestamp!: string;
  @ApiProperty({ type: () => OffsetPagination }) pagination!: OffsetPagination;
}

export class WrappedDto<T> {
  @ApiProperty({ description: 'Response payload' }) data!: T;
  @ApiProperty({ type: () => TimestampOnly }) meta!: TimestampOnly;
}

export class CursorWrappedDto<T> {
  @ApiProperty({ isArray: true }) data!: T[];
  @ApiProperty({ type: () => CursorPaginationMeta }) meta!: CursorPaginationMeta;
}

export class OffsetWrappedDto<T> {
  @ApiProperty({ isArray: true }) data!: T[];
  @ApiProperty({ type: () => OffsetPaginationMeta }) meta!: OffsetPaginationMeta;
}
```

**Why two schema classes (`CursorWrappedDto`, `OffsetWrappedDto`) instead of one generic `WrappedDto<T, P>`:** the Swagger plugin emits `$ref` from concrete classes, and OpenAPI client codegen (via `openapi-typescript`, `orval`, etc.) handles discriminated unions correctly only when the discriminator is a runtime field on a single class hierarchy — not when it's a generic type parameter. Two concrete classes share the discriminator field through the shared `CursorPagination` / `OffsetPagination` types, so the OpenAPI spec correctly renders two envelope variants with a discriminator. A multi-parameter generic `WrappedDto<T, P>` would force `allOf` composition and produce `Partial<PaginationMeta>` (or `unknown`) in client SDKs.

**Why these schema classes are not in `src/common/responses/`:** they're not part of the runtime wire-format API. They're OpenAPI documentation-only. Co-locating them in `src/common/swagger/` keeps the runtime and documentation concerns separated.

### 5.5 `src/common/filters/global-exception.filter.ts`

Update to support machine-readable error codes in `extensions`. The default error body becomes:

```json
{
  "type": "https://api.example.com/errors/quiz-not-found",
  "title": "Quiz not found",
  "status": 404,
  "detail": "Quiz with id 'abc-123' was not found.",
  "instance": "/quizzes/abc-123",
  "extensions": {
    "code": "QUIZ_NOT_FOUND",
    "requestId": "...",
    "timestamp": "2026-..."
  }
}
```

### 5.6 ESLint additions (optional, recommended)

Add a rule banning raw response shapes from `*.application.service.ts`:

```json
{
  "rules": {
    "no-restricted-syntax": ["error", {
      "selector": "TSAsExpression[typeAnnotation.typeAnnotation.object] > TSTypeLiteral[members.properties.length=2]:has(> TSMappedType):has(> TSPropertySignature[key.name='items']):has(> TSPropertySignature[key.name='pagination'])",
      "message": "Don't return { items, pagination } from application services. Return PaginatedResult<T> from '@/common/types/paginated-result' instead."
    }]
  }
}
```

---

## 6. Execution timeline

| Phase | Duration | Endpoints touched | Risk profile |
|---|---|---|---|
| Phase 0 — Pre-flight | 1 day | 0 (additions only) | Zero |
| Phase 1 — Presenter layer (auth, health, search, attempt, bookmark) | 3-5 days | ~48 | Low |
| Phase 2 — Presenter rollout (12 modules) | 10-14 days | ~147 | Medium |
| Phase 3 — RFC 7807 error refactor (parallel track) | 5-7 days | 0 (error filters only) | Medium |
| Phase 4 — Remove interceptor heuristic | 1 day | 0 (interceptor change only) | Low |
| Phase 5 — Cleanup (delete 160+ DTOs) | 2-3 days | 0 (docs only) | Low |
| **Total (sequential)** | **~3-4 weeks** | **All 195 endpoints** | |

Assuming 1 developer, sequential execution. With 2 developers on independent modules in Phase 2, the timeline compresses to **~2-3 weeks**. Phase 3 can run in parallel with Phase 2 or after Phase 4; it doesn't block any other phase.

---

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 4 removes heuristic before all services migrated → 500s | Low | Medium | Phase 4 is gated on Phase 2 completion. The wrap-fallback retains the same output as before, so the only change is the loss of "smart" inference — and that produces a `Logger.warn`, not a 500. |
| Achievement E-variant breaks clients that read `data.total` | Medium | Medium | Phase 2 PR description explicitly documents the schema change. Coordinate with frontend before merge. |
| Tag D-variant services are untyped in `tag.application.service.ts`, so the migration can't determine current shape | Medium | Low | Read the application service body and DTO during Phase 2. The Swagger examples already document the broken shape, so the D-variant status is observable from documentation alone. |
| Offset pagination in tournament and ranking has a different `pagination` shape than cursor pagination | High | Low | The destination uses a single `PaginationMeta` discriminated union (`CursorPagination | OffsetPagination`) — the `kind: 'cursor' \| 'offset'` discriminator field on the runtime object makes the shape explicit. The factory overload `ApiResponse.page(items, pagination)` accepts either branch. Document the discriminator in `PaginationMeta` JSDoc so Swagger schema generation picks up the `kind` field. |
| Health endpoint's `@Res({ passthrough: true })` bypasses the interceptor | Low | Low | Phase 5 proposes an exception-based health refactor as a follow-up, not a blocker. Phase 4 retains the bypass branch. |
| OpenAPI client generation breaks because `allOf` produces `any` types | Medium | Medium | Run the existing OpenAPI codegen (whatever the frontend uses) against the new spec early — preferably at end of Phase 1. Verify a few representative endpoints produce correct types. If not, fall back to per-module `Wrapped*Dto` classes (defeats some of the gain but keeps codegen happy). |
| `Promise<void>` handlers now have a body — clients that check `response.status === 204` will see 200 with `data: null` | Low | Low | Currently all `Promise<void>` returns render as `{ data: null, meta: { timestamp } }` with HTTP 200 anyway. The migration doesn't change behavior here. Document it for client teams that relied on the `Promise<void>` semantics. |
| Frontend hardcoded error handling for non-RFC 7807 shapes | Medium | Medium | Phase 3 is its own track with its own PR description and migration window. Frontend can update error-handling code in the same release window. |
| The `@Res()` health endpoint changes during Phase 5 break load balancer health-check configs | Low | High (load balancer outage) | Don't do the health endpoint refactor as part of Phase 5. Leave it for a separate, dedicated change with explicit LB config updates and a rollback window. |

---

## 8. Per-module migration tables

This section is the operational reference for the migration. Each module lists its endpoints, current shape, target shape, and migration difficulty.

### 8.1 Shape categories

- **A:** `{ data: T, meta: { timestamp } }` (single resource)
- **B:** `{ data: T[], meta: { timestamp, pagination } }` (paginated list)
- **C:** `{ data: T[] (or T), meta: { timestamp, [pagination] } }` (pre-wrapped envelope — current category pattern; will be rolled back to A/B)
- **D:** `{ data: { items: [...] }, meta: { timestamp } }` (broken nested items)
- **D-variant:** `{ data: { items, ...other }, meta: { timestamp } }` (broken shape with extra fields)
- **E:** `{ data: { data: [...], total }, meta: { timestamp } }` (doubly-nested)
- **F:** Bare array — interceptor wraps as `{ data: [...], meta }` but the source is a bare array from the service
- **G:** `Promise<void>` — interceptor produces `{ data: null, meta }`

### 8.2 `auth` (20 endpoints, A)

All single resources. Plan:
- Add `auth.presenter.ts` with `toEnvelope(dto)` per endpoint type.
- Replace per-resource `@ApiOkResponse({ type: AuthWrappedMessageDto })` with `@ApiOkResource(MessageResponseDto)`.
- Difficulty: trivial. 1 day for the whole module.

### 8.3 `bookmark` (16 endpoints, 12A + 4B)

| Endpoint | Current | Target | Action |
|---|---|---|---|
| GET /bookmarks/search | B | B | presenter.toPaginatedEnvelope |
| GET /bookmarks/recent | B | B | presenter.toPaginatedEnvelope |
| GET /bookmarks/collections | B | B | presenter.toPaginatedEnvelope |
| GET /bookmarks/collections/:id/quizzes | B | B | presenter.toPaginatedEnvelope |
| Others (12) | A | A | presenter.toEnvelope |

Difficulty: low. 1 day.

### 8.4 `category` (15 endpoints, currently C — to be rolled back to A/B)

**Special:** `category-query.service.ts` is currently pre-wrapping envelopes. Phase 2 rolls this back. The service should return `PaginatedResult<CategoryResponseDto>` (or `CategoryResponseDto` for single). The new presenter does the wrapping.

Difficulty: low (the work itself) + medium (changing the existing pattern). 1-2 days.

### 8.5 `discussion` (44 endpoints, 31A + 8B + 4 D-variant + 1 nullable)

Endpoints with D-variant shape (must be re-shaped at the service level):
- `GET /discussions/threads/:id/related` (returns `{ items }` only) — fix service to return `PaginatedResult`.
- `GET /discussions/threads/:id/participants` (same).
- `GET /discussions/threads` (returns `{ items, hasNextPage }` — no `pagination` key) — fix service.
- `GET /discussions/threads/:id/comments` (same).

All others: standard presenter-to-envelope pattern. Difficulty: high (44 endpoints, large module). 2-3 days.

### 8.6 `health` (1 endpoint, A, special `@Res()`)

Leave `@Res({ passthrough: true })` in place. Difficulty: trivial.

### 8.7 `instance` (8 endpoints, 3B + 1 D-variant + 4A)

D-variant to fix:
- `GET /instances/:id/leaderboard` (returns `{ items, hasNextPage, nextCursor }` — controller currently does the pagination re-wrap). Move re-wrap into the service.

Difficulty: low. 1 day.

### 8.8 `notification` (11 endpoints, 1 D-variant + 10A)

D-variant to fix:
- `GET /notifications` returns `{ items, unreadCount, hasNextPage }` (no `pagination`). Re-shape to `PaginatedResult<NotificationDto>` plus consider splitting `unreadCount` to a separate response field (either a header or an additional property in the service).

Difficulty: low. 1 day.

### 8.9 `quiz` (21 endpoints, 5B + 1F + 1 F + 14A)

F-variants to fix:
- `POST /quizzes/:id/versions/:versionId/questions/bulk` — returns bare `QuizQuestionResponseDto[]`. Service should return the array; presenter wraps.

D-variants to fix:
- `GET /quizzes/featured` — returns `{ items }` only.
- `GET /quizzes/:slug/similar` — same.

Difficulty: medium. 1-2 days.

### 8.10 `ranking` (14 endpoints, 3B + 2 D-variant + 9A)

D-variants to fix:
- `GET /leaderboard/top-movers` returns `{ items }` only.
- `GET /leaderboard/me/milestones` returns `{ items }` only.

Ranking has a custom `RankingLeaderboardMetaDto`. Phase 2 normalizes to the generic `OffsetPaginationMeta`.

Difficulty: medium. 1-2 days.

### 8.11 `review` (17 endpoints, 5B + 12A)

Admin list endpoint's controller re-wrapping (`AdminReviewController.listPlatformReports`) moves into the service.

Difficulty: low. 1 day.

### 8.12 `search` (1 endpoint, A)

Single resource. Difficulty: trivial.

### 8.13 `social` (30 endpoints, 4B + 4 D-variant + 5F + 17A/G)

F-variants to fix (bare-array returns):
- `GET /social/search/suggestions`
- `GET /social/users/search`
- `GET /social/friend-requests/incoming`
- `GET /social/friend-requests/outgoing`
- `GET /social/blocked`

Plus the 4 D-variant endpoints.

Difficulty: medium-high (30 endpoints, many with the `as unknown as` cast that has to be cleaned up). 2-3 days.

### 8.14 `tag` (14 endpoints, 4B + 3 D-variant + 7A)

Tag D-variants need re-shaping at the service level:
- `GET /tags/popular`
- `GET /tags/trending`
- `GET /tags/:slug/related`

Note: service return types are not annotated in `tag.application.service.ts`. The Swagger examples (`TAG_RANKED_LIST_EXAMPLE`, `TAG_RELATED_LIST_EXAMPLE`) already document the D-variant shape. Phase 2 reads these to determine current behavior.

Difficulty: low. 1 day.

### 8.15 `tournament` (16 endpoints, 9B + 7A)

Uses offset pagination. `TournamentOffsetMetaDto` aligns with `OffsetPaginationMeta`. Difficulty: low. 1 day.

### 8.16 `user` (16 endpoints, 5B + 11A)

F-variant to fix:
- `GET /users/me/recommended-quizzes` — controller currently destructures `{ items }` from a port and returns bare array.

Difficulty: low. 1 day.

### 8.17 `attempt` (10 endpoints, 1B + 9A)

Difficulty: low. 1 day.

### 8.18 `achievement` (10 endpoints, 2E + 7A + 1F)

E-variants to flatten:
- `GET /achievements/badges`
- `GET /users/me/achievements/history`

F-variant to wrap:
- `GET /admin/achievements/reevaluate/:userId/history`

The doubly-nested shape `data: { data: [...], total }` flattens to `data: [...], meta.pagination.total`.

Difficulty: medium. 1-2 days.

---

## Appendix A — Files to add

| Path | Purpose |
|---|---|
| `src/common/responses/api-response.ts` | `ApiResponse.ok`, `ApiResponse.page`, `ApiResponse<T>` and `ResponseMeta` types |
| `src/common/responses/api-response.spec.ts` | Unit tests |
| `src/common/responses/pagination.ts` | `CursorPagination`, `OffsetPagination`, `PaginationMeta` discriminated union |
| `src/common/responses/paginated-result.ts` | `PaginatedResult<T>` (domain-level concept shared by services and presenters) |
| `src/common/swagger/api-ok.ts` | `ApiOkResource`, `ApiOkResourceList` decorators |
| `<module>/transport/presenters/<module>.presenter.ts` | One per module (~17 files) |
| `test/e2e/envelope.spec.ts` | Smoke test for envelope shape |

## Appendix B — Files to delete (Phase 5)

| Path | Reason |
|---|---|
| `<module>/dto/response/<module>-response-docs.dto.ts` (per-module) — mostly the 160+ `Wrapped*Dto` classes | Replaced by generic `WrappedDto<T>` family |
| `<module>/transport/swagger/*-swagger-decorators.ts` per-endpoint factories with hardcoded `Wrapped*Dto` types | Replaced by `ApiOkResource` / `ApiOkResourceList` |

## Appendix C — Files to modify

| Path | Reason |
|---|---|
| `src/common/interceptors/response-format.interceptor.ts` | Phase 4: simplify to wrap-without-inference, drop heuristic branches, add `Logger.warn` |
| `src/common/filters/global-exception.filter.ts` | Phase 3: RFC 7807 ProblemDetail with `extensions.code` |
| `<module>/application/<module>.application.service.ts` (16 of 17) | Strip any pre-wrapping; return DTOs or `PaginatedResult<T>` |
| `<module>/transport/controllers/*.controller.ts` (26 files) | Add presenter call; replace per-endpoint `@ApiOkResponse` with `@ApiOkResource` / `@ApiOkResourceList` |

---

**Document version:** 1.1
**Last updated:** 2026-07-10
**Changes since 1.0:** Decision 1 refactored — dropped `ApiResponse.ack()`, replaced the optional-fields `PaginationMeta` interface with a discriminated union (`CursorPagination | OffsetPagination`), and unified the runtime helper to a single `ApiResponse.page(items, pagination)` method. Renamed `src/common/http/` to `src/common/responses/` to reflect the architectural separation between presentation helpers and HTTP-specific concerns.
**Owner:** TBD — please assign a reviewer and a per-phase owner once approved.
