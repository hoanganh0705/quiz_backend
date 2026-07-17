# Notification Module — API Contract Audit

| Field | Value |
| ----- | ----- |
| Module | `notification` (OpenAPI tag: `notifications`) |
| Audit date | 2026-07-17 |
| Auditor mode | Read-only (no code, no DTO, no OpenAPI artifact was modified) |
| Endpoints audited | 11 |
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
| Contract health score | **6.0 / 10** |
| Endpoints audited | 11 |
| Total issues | 12 |
| Critical / High / Medium / Low | 1 / 4 / 4 / 3 |
| Implementation bugs | 4 |
| Documentation issues | 8 |
| Validation inconsistencies | 3 |
| OpenAPI inconsistencies | 5 |
| Swagger example issues | 2 |

> Headline: One Critical runtime bug (PATCH preferences 500s on Redis cache invalidation due to TTL=0 guard), one High issue (notificationId path params accept any string — 500 on non-UUID input), and one High issue (`limit`/`unreadOnly`/`cursor` query params are documented in Swagger but rejected at runtime).

---

## Severity Breakdown

| Severity | Count |
| -------- | ----- |
| Critical | 1 |
| High | 4 |
| Medium | 4 |
| Low | 3 |

---

## Issue Index

| ID | Severity | Endpoint | Title |
| -- | -------- | -------- | ----- |
| N-01 | Critical | `PATCH /notifications/preferences` | Redis cache TTL=0 guard throws 500 |
| N-02 | High | `GET /notifications/:notificationId`, `POST /notifications/:notificationId/read`, etc. | Path param `:notificationId` accepts non-UUID values; 500 instead of 400 |
| N-03 | High | `GET /notifications` | `limit`, `cursor`, `unreadOnly` query params documented in OpenAPI but rejected at runtime |
| N-04 | Medium | `GET /notifications/:notificationId`, `POST /notifications/:notificationId/read` | OpenAPI declares `notificationId` as bare `string` without `format: uuid` |
| N-05 | Medium | `GET /notifications` | OpenAPI `includeArchived` schema has no type (missing `@ApiPropertyOptional`) |
| N-06 | Medium | All error responses | Swagger error examples reference `/quizzes/...` paths — wrong `instance` values |
| N-07 | Low | `GET /notifications/analytics` | Requires `NOTIFICATION_ANALYTICS` permission but no OpenAPI security declaration |
| N-08 | Low | `GET /notifications` | Missing `type` filter in `GetNotificationsQueryDto` despite being used in repository |
| N-09 | Low | `DELETE /notifications/:notificationId` | OpenAPI declares 404+403+204; runtime correctly returns 404 or 403 then 204 — documentation is accurate |

---

## Endpoint-by-Endpoint Findings

### N-01 · Critical · `PATCH /notifications/preferences`

**Current behavior**
500 Internal Server Error: `ttlMs must be a positive number`.

**Root cause**
`NotificationChannelService.invalidatePreferencesCache` calls `this.cache.set(key, '', 0)`. `RedisService.set` has a guard `if (ttlMs <= 0) throw new Error('ttlMs must be a positive number')`. The TTL of `0` (intended as "delete immediately") is rejected.

**Implementation correct?** No.
**Documentation correct?** N/A (implementation bug).
**Recommendation** Fix the cache invalidation call.
**Suggested fix**
Use `this.cache.set(key, '', 1)` (1ms TTL) as a workaround, or introduce a `delete(key)` method to the `CacheProvider` interface and use that instead of TTL=0.
**Safety classification** Safe implementation fix. No contract change.

---

### N-02 · High · `GET /notifications/:notificationId`, `POST /notifications/:notificationId/read`, `POST /notifications/:notificationId/unread`, `DELETE /notifications/:notificationId`

**Current behavior**
500 Internal Server Error on non-UUID inputs (e.g. `not-a-uuid`). Cause chain: `invalid input syntax for type uuid` (SQLSTATE `22P02`).

**Root cause**
Controller declares `@Param('notificationId') notificationId: string` with no pipe. No UUID validation.

**Implementation correct?** No.
**Documentation correct?** No (incomplete).
**Recommendation** Add pipe + OpenAPI `format: uuid`.
**Suggested fix**
- Add `ParseUUIDPipe` to each `:notificationId` parameter.
- Add `format: 'uuid'` to the corresponding OpenAPI parameter schemas.
**Safety classification** Safe implementation + documentation fix. No contract change for valid UUIDs.

---

### N-03 · High · `GET /notifications`

**Current behavior**
Requests with `?limit=2`, `?unreadOnly=true`, `?cursor=...` return 400: `property limit should not exist`. These parameters are documented in Swagger but rejected at runtime.

**Root cause**
Controller handler binds `limit`, `cursor`, and `unreadOnly` as explicit `@Query()` parameters with `@DefaultValuePipe`/`ParseIntPipe`. The `@Query() query: GetNotificationsQueryDto` (which only declares `includeArchived`) is also bound but the `forbidNonWhitelisted: true` ValidationPipe rejects unknown properties.

The documented params (`limit`, `cursor`, `unreadOnly`) are NOT in `GetNotificationsQueryDto` — they exist only as explicit `@Query()` parameter bindings in the controller. The OpenAPI generator produces correct docs from the explicit `@Query()` bindings, but the ValidationPipe's `forbidNonWhitelisted` rejects any query string containing these named parameters because the full DTO (`query: GetNotificationsQueryDto`) doesn't declare them.

**Implementation correct?** No.
**Documentation correct?** Yes (OpenAPI matches the explicit parameter bindings).
**Recommendation** Fix the controller/DTO binding.
**Suggested fix**
Move `limit`, `cursor`, `unreadOnly` into `GetNotificationsQueryDto` and remove the explicit `@Query()` parameter bindings. Change the controller signature to `@Query() query: GetNotificationsQueryDto` only. See `src/modules/quiz/transport/controllers/quiz.controller.ts` for the canonical pattern.
**Safety classification** Safe implementation fix. No contract change.

---

### N-04 · Medium · `GET /notifications/:notificationId`, `POST /notifications/:notificationId/read`, `POST /notifications/:notificationId/unread`, `DELETE /notifications/:notificationId`

**Current behavior**
OpenAPI declares `{ "type": "string" }` with no `format`. Response DTO `NotificationResponseDto` correctly declares `{ type: 'string', format: 'uuid' }` on `notificationId`, but the path parameter is not annotated with `format: uuid`.

**Root cause**
Controller uses bare `@Param('notificationId')` without `@ApiParam({ format: 'uuid' })`.

**Implementation correct?** Partially.
**Documentation correct?** No.
**Recommendation** Add `@ApiParam` with `format: 'uuid'`.
**Suggested fix**
Add `@ApiParam({ name: 'notificationId', type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })` to each endpoint.
**Safety classification** Safe documentation fix. No runtime change.

---

### N-05 · Medium · `GET /notifications`

**Current behavior**
OpenAPI `includeArchived` parameter schema:
```json
"schema": {
  "example": false
}
```
Missing `type: boolean`.

**Root cause**
`GetNotificationsQueryDto.includeArchived` has no `@ApiPropertyOptional` decorator — only `@IsOptional() @Transform() @IsBoolean()`. The `@nestjs/swagger` generator produces an empty schema object when `@ApiPropertyOptional` is missing.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Add `@ApiPropertyOptional({ type: Boolean, description: 'Include archived notifications', example: false })` to `includeArchived` in `GetNotificationsQueryDto`.
**Safety classification** Safe documentation fix.

---

### N-06 · Medium · All notification error responses

**Current behavior**
All error response examples (404, 403) use `ErrorResponseExamples.notFound` and `ErrorResponseExamples.forbidden` which have `instance: '/quizzes/660e8400-e29b-41d4-a716-446655440000'`. These are shared across modules.

**Root cause**
`ErrorResponseExamples` is a shared constant without module-scoped variants.

**Implementation correct?** Yes (runtime is correct).
**Documentation correct?** No (examples are misleading in Swagger UI).
**Recommendation** Introduce notification-scoped error example variants.
**Suggested fix**
Create `ErrorResponseExamples.notificationsNotFound` and `ErrorResponseExamples.notificationsForbidden` with `instance: '/notifications/...'` paths. Same pattern as the leaderboard module audit (L-09).
**Safety classification** Safe documentation fix.

---

### N-07 · Low · `GET /notifications/analytics`

**Current behavior**
200 OK for users with `NOTIFICATION_ANALYTICS` permission, 403 for others. No `security` declaration in OpenAPI.

**Root cause**
Missing `@ApiSecurity` or security declaration on the analytics endpoint.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Add security declaration.
**Suggested fix**
Add `@ApiSecurity('bearerAuth')` or document the permission requirement in the `@ApiOperation` description.
**Safety classification** Safe documentation fix.

---

### N-08 · Low · `GET /notifications`

**Current behavior**
Repository `findByUser` accepts and uses a `type` filter (lines 84-86 of `notification.repository.ts`):
```typescript
if (params.type) {
  conditions.push(eq(notifications.type, params.type));
}
```
`NotificationListParams` declares `type?: NotificationType`. But `GetNotificationsQueryDto` has no `type` field, and the controller doesn't pass it.

**Root cause**
Incomplete wiring: the filter infrastructure exists but isn't exposed.

**Implementation correct?** Yes (repository handles it).
**Documentation correct?** N/A (feature is undocumented).
**Recommendation** Decide whether to expose the type filter.
**Suggested fix**
- Option A: Add `type` to `GetNotificationsQueryDto` and wire it in the controller.
- Option B: Remove the unused `type` filter from `NotificationListParams` and repository.
**Safety classification** Feature addition (Option A) or cleanup (Option B).

---

### N-09 · Low · `DELETE /notifications/:notificationId`

**Current behavior**
Runtime returns:
- 404 if notification doesn't exist
- 403 if notification belongs to another user
- 204 on success

**OpenAPI declares**: 403, 404, 204 — all present.

**Implementation correct?** Yes.
**Documentation correct?** Yes.
**Recommendation** None — this endpoint is correctly documented.
**Note**: Unlike `markAsRead` and `markAsUnread`, the `deleteNotification` endpoint has both `@ApiNotFoundResponse` and `@ApiForbiddenResponse` declared explicitly in the controller (lines 326-334).

---

## Response DTO / Serialization Audit

### NotificationResponseDto — PASSES with caveats

| Field | Type | Nullable | Notes |
| ----- | ---- | -------- | ----- |
| `notificationId` | UUID | No | `@IsUUID()` — correct |
| `userId` | UUID | No | `@IsUUID()` — correct |
| `type` | enum | No | `NOTIFICATION_TYPE_VALUES` — correct |
| `title` | string | No | `@IsString() @IsNotEmpty()` — correct |
| `message` | string | No | `@IsString() @IsNotEmpty()` — correct |
| `metadata` | object | No | `@IsObject()` — correct |
| `channel` | enum | No | `NOTIFICATION_CHANNEL_VALUES` — correct |
| `isRead` | boolean | No | `@IsBoolean()` — correct |
| `readAt` | ISO8601 | Yes | `@IsISO8601()` + nullable — correct |
| `createdAt` | ISO8601 | No | `@IsISO8601()` — correct |
| `expiresAt` | ISO8601 | Yes | `@IsISO8601()` + nullable — correct |

### NotificationPreferencesResponseDto — PASSES

All boolean flags have `@IsBoolean()`. `quietHoursStart` and `quietHoursEnd` have `@IsString()` with nullable.

### NotificationAnalyticsDto — PASSES

All numeric fields correctly lack type declarations (OpenAPI infers `number`).

---

## Authentication & Authorization Audit

| Endpoint | Auth Required | Permission | Runtime Auth | Runtime Perm | Match |
| -------- | ------------- | ---------- | ------------ | ------------ | ----- |
| `GET /notifications` | Yes | None | 401 if no token | — | Yes |
| `GET /notifications/unread-count` | Yes | None | 401 if no token | — | Yes |
| `GET /notifications/analytics` | Yes | `NOTIFICATION_ANALYTICS` | 403 if no permission | 403 → 200 | Yes (permission works) |
| `GET /notifications/preferences` | Yes | None | 401 if no token | — | Yes |
| `PATCH /notifications/preferences` | Yes | None | 401 if no token | — | Yes |
| `GET /notifications/:id` | Yes | None | 401/404 | — | Yes |
| `POST /notifications/:id/read` | Yes | None | 401/404/403 | — | Yes |
| `POST /notifications/:id/unread` | Yes | None | 401/404/403 | — | Yes |
| `POST /notifications/read-all` | Yes | None | 401/204 | — | Yes |
| `DELETE /notifications/read` | Yes | None | 401/200 | — | Yes |
| `DELETE /notifications/:id` | Yes | None | 401/404/403/204 | — | Yes |

**Ownership check behavior**:
- `getNotification`: returns 404 if not found or wrong user (no 403, since lookup is user-filtered)
- `markAsRead`, `markAsUnread`, `deleteNotification`: returns 404 if not found, then 403 if wrong user
- This is correct per the controller docblocks and Phase 5 audit notes.

---

## Consistency Audit

### Positive observations

1. **Presenter layer**: `NotificationPresenter` follows the canonical pattern — one method per endpoint, using `ApiResponse.ok` and `ApiResponse.page` correctly.
2. **Error codes**: `NOTIFICATION_NOT_FOUND` and `NOTIFICATION_FORBIDDEN` are properly registered in `ProblemCodeMapping` with full Phase 5 migration notes.
3. **Error spec**: `notification.errors.spec.ts` is comprehensive — tests code declaration, ProblemCodeMapping resolution, inheritance chain, status codes.
4. **Envelope shape**: All endpoints return `{ data, meta }` with `meta.timestamp` in ISO 8601. Verified by runtime tests.
5. **Pagination**: `meta.pagination.kind = 'cursor'` is correctly set. Default `limit = 20`.
6. **Soft delete**: Repository uses `deletedAt IS NULL` filter, consistent with project standard.

### Issues found

1. **Query parameter wiring** (N-03): `limit`, `cursor`, `unreadOnly` documented but rejected. Contradicts `api.md` which requires query params via DTO.
2. **Path param UUID validation** (N-02): Contradicts `api.md` which requires `ParseUUIDPipe` for UUID path params.
3. **OpenAPI path param format** (N-04): Contradicts `swagger.md` which requires `format: uuid` on UUID path parameters.
4. **Cache invalidation bug** (N-01): Internal-only bug that surfaces as 500 on a user-facing endpoint.

---

## Swagger Example Verification

### `NOTIFICATION_LIST_EXAMPLE` — PASSES
```typescript
{
  data: [NOTIFICATION_ITEM],  // valid NotificationResponseDto shape
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,  // 2026-06-25T10:30:00.000Z — valid ISO 8601
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJjcmVhdGVkQXQi...'  // base64-encoded JSON
    }
  }
}
```
Matches runtime shape. Cursor decodes to `{ createdAt, notificationId }`.

### `NOTIFICATION_UNREAD_COUNT_EXAMPLE` — PASSES
```typescript
{ data: { count: 5 }, meta: { timestamp: EXAMPLE_TIMESTAMP } }
```
Matches runtime response shape.

### `NOTIFICATION_ANALYTICS_EXAMPLE` — PASSES
All numeric values and record structures are valid.

### `NOTIFICATION_PREFERENCES_EXAMPLE` — PASSES
Matches `NotificationPreferencesResponseDto` shape.

### `NOTIFICATION_DETAIL_EXAMPLE` — PASSES
Matches `NotificationResponseDto` shape.

### Error examples — FAILS
`ErrorResponseExamples.notFound` and `ErrorResponseExamples.forbidden` reference `/quizzes/...` paths. These are shared and not notification-scoped.

---

## Prioritization & Migration Plan

### Phase 1 — Fix Critical + High runtime bugs

| Field | Value |
| ----- | ----- |
| Issues | N-01, N-02, N-03 |
| Goal | Make every documented endpoint return 200/4xx for valid input. |
| Reason | N-01, N-02, and N-03 are blocking issues that cause 500 errors on documented endpoints. |
| Dependencies | None. |
| Complexity | Medium |
| Risk | Low |
| Breaking change? | No |
| Migrations / DB | None. |

### Phase 2 — OpenAPI / documentation fixes

| Field | Value |
| ----- | ----- |
| Issues | N-04, N-05, N-06, N-07, N-08 |
| Goal | Make OpenAPI specification accurate and complete. |
| Reason | After Phase 1 fixes, the documentation should match the wire format. |
| Dependencies | Phase 1 should land first. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No |
| Generated SDK | May need regeneration after Phase 1 changes. |

### Phase 3 — Consistency improvements

| Field | Value |
| ----- | ----- |
| Issues | N-08 (type filter exposure decision) |
| Goal | Decide on feature completeness for the `type` filter. |
| Reason | Repository has unused filter infrastructure. |
| Dependencies | None. |
| Complexity | Low |
| Risk | Low |
| Breaking change? | No (additive or cleanup). |

---

## Implementation Strategy

### Phase 1 Details

**N-01 Fix**: Change `invalidatePreferencesCache` to use TTL=1ms instead of TTL=0ms, or introduce a `delete(key)` method to `CacheProvider` interface.

**N-02 Fix**: Add `ParseUUIDPipe` to all `:notificationId` path parameters:
```typescript
// Before
@Param('notificationId') notificationId: string

// After
@Param('notificationId', ParseUUIDPipe) notificationId: string
```

**N-03 Fix**: Consolidate query parameters into `GetNotificationsQueryDto`:
```typescript
// GetNotificationsQueryDto should have:
@ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit?: number;

@ApiPropertyOptional({ type: String, description: 'Cursor for pagination' })
@IsOptional()
@IsString()
cursor?: string;

@ApiPropertyOptional({ type: Boolean, description: 'Filter to unread only', default: false })
@IsOptional()
@Transform(({ value }) => typeof value === 'string' ? value === 'true' : value)
@IsBoolean()
unreadOnly?: boolean;

@ApiPropertyOptional({ type: Boolean, description: 'Include archived notifications', default: false })
@IsOptional()
@Transform(({ value }) => typeof value === 'string' ? value === 'true' : value)
@IsBoolean()
includeArchived?: boolean;

// Controller should use:
async getNotifications(
  @CurrentUser() user: JwtPayload,
  @Query() query: GetNotificationsQueryDto,
) {
  // ...
}
```

### Phase 2 Details

**N-04**: Add `@ApiParam({ format: 'uuid' })` to all notificationId path parameters.
**N-05**: Add missing `@ApiPropertyOptional` to `GetNotificationsQueryDto.includeArchived`.
**N-06**: Create notification-scoped error examples.
**N-07**: Add security declaration to analytics endpoint.
**N-08**: Either expose the `type` filter or remove the unused repository code.

---

## Migration Safety Classification

| Fix | Type | Notes |
| --- | ---- | ----- |
| N-01 | Safe implementation fix | TTL=0 → TTL=1. No contract change. |
| N-02 | Safe implementation + docs fix | Add ParseUUIDPipe. No contract change for valid UUIDs. |
| N-03 | Safe implementation fix | Consolidate DTO. No contract change. |
| N-04 | Safe documentation fix | Add format: uuid. No runtime change. |
| N-05 | Safe documentation fix | Add missing @ApiPropertyOptional. |
| N-06 | Safe documentation fix | Notification-scoped error examples. |
| N-07 | Safe documentation fix | Add security declaration. |
| N-08 | Feature decision | Expose or remove unused filter code. |
| N-09 | None needed | Endpoint is correctly documented. |

---

## Appendix A — Endpoints Inventoried

| # | Method | Path | Auth | Notes |
| - | ------ | ---- | ---- | ----- |
| 1 | GET | `/notifications` | JwtGuard | `getNotifications` |
| 2 | GET | `/notifications/unread-count` | JwtGuard | `getUnreadCount` |
| 3 | GET | `/notifications/analytics` | JwtGuard + Permission | `getAnalytics` |
| 4 | GET | `/notifications/preferences` | JwtGuard | `getPreferences` |
| 5 | PATCH | `/notifications/preferences` | JwtGuard | `updatePreferences` |
| 6 | GET | `/notifications/:notificationId` | JwtGuard | `getNotificationDetail` |
| 7 | POST | `/notifications/:notificationId/read` | JwtGuard | `markAsRead` |
| 8 | POST | `/notifications/:notificationId/unread` | JwtGuard | `markAsUnread` |
| 9 | POST | `/notifications/read-all` | JwtGuard | `markAllAsRead` |
| 10 | DELETE | `/notifications/read` | JwtGuard | `deleteReadNotifications` |
| 11 | DELETE | `/notifications/:notificationId` | JwtGuard | `deleteNotification` |

> Note: WebSocket gateway (`/notifications` namespace) is out of scope for this HTTP API contract audit.

---

## Appendix B — Live Runtime Evidence

```text
==GET /notifications (no auth)==                     STATUS=401  (Authorization header is missing)
==GET /notifications (auth, default limit)==         STATUS=200  {"data":[...],"meta":{"pagination":{"kind":"cursor",...}}}
==GET /notifications?limit=2==                        STATUS=400  (property limit should not exist) ⚠️ N-03
==GET /notifications?unreadOnly=true==               STATUS=400  (property unreadOnly should not exist) ⚠️ N-03
==GET /notifications?cursor=xxx==                    STATUS=400  (property cursor should not exist) ⚠️ N-03
==GET /notifications?includeArchived=true==          STATUS=200  {"data":[...],"meta":{...}} ✓
==GET /notifications/unread-count==                  STATUS=200  {"data":{"count":5},"meta":{...}} ✓
==GET /notifications/preferences==                  STATUS=200  {"data":{...},"meta":{...}} ✓
==PATCH /notifications/preferences (inAppEnabled)==  STATUS=500  (ttlMs must be a positive number) ⚠️ N-01
==GET /notifications/analytics (user)==              STATUS=403  (You do not have permission) ✓
==GET /notifications/{valid-uuid}==                  STATUS=200  {"data":{...},"meta":{...}} ✓
==GET /notifications/invalid-notificationId==       STATUS=500  (invalid input syntax for type uuid) ⚠️ N-02
==POST /notifications/{valid-uuid}/read==             STATUS=204  ✓
==POST /notifications/{valid-uuid}/unread==         STATUS=204  ✓
==POST /notifications/read-all==                     STATUS=204  ✓
==DELETE /notifications/read==                       STATUS=200  {"data":{"deletedCount":N},"meta":{...}} ✓
==DELETE /notifications/{uuid-to-deleted}==          STATUS=404  (NOTIFICATION_NOT_FOUND) ✓
==DELETE /notifications/{other-user-notification}==  STATUS=404  (NOTIFICATION_NOT_FOUND — lookup filtered by user) ⚠️ N-02
```

---

## Appendix C — Files Inspected

- `src/modules/notification/transport/controller/notification.controller.ts`
- `src/modules/notification/transport/presenters/notification.presenter.ts`
- `src/modules/notification/transport/swagger/examples/notification.examples.ts`
- `src/modules/notification/transport/swagger/examples/_timestamp.ts`
- `src/modules/notification/transport/gateway/notification.gateway.ts`
- `src/modules/notification/application/notification-application.service.ts`
- `src/modules/notification/application/notification-scheduler.service.ts`
- `src/modules/notification/domain/notification.service.ts`
- `src/modules/notification/domain/errors/notification.errors.ts`
- `src/modules/notification/domain/errors/notification.errors.spec.ts`
- `src/modules/notification/domain/types/notification.types.ts`
- `src/modules/notification/domain/ports/notification-ports.ts`
- `src/modules/notification/infrastructure/repositories/notification.repository.ts`
- `src/modules/notification/infrastructure/adapters/notification-channel.service.ts`
- `src/modules/notification/dto/request/get-notifications-query.dto.ts`
- `src/modules/notification/dto/request/update-preferences.dto.ts`
- `src/modules/notification/dto/response/notification-response.dto.ts`
- `src/modules/notification/dto/response/notification-analytics-response.dto.ts`
- `src/modules/notification/dto/response/unread-count-response.dto.ts`
- `src/modules/notification/dto/response/deleted-read-notifications-response.dto.ts`
- `src/modules/notification/notification.module.ts`
- `src/core/database/schema/notification/schema.ts`
- `src/core/database/schema/notification/relations.ts`
- `src/core/redis/redis.service.ts`
- `src/common/ports/cache.provider.ts`
- `src/common/errors/problem-code-mapping.ts`
- `src/common/swagger/api-ok.ts`
- `src/common/swagger/swagger-schemas.ts`
- `docs/generated/openapi.json`
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/api.md`
- `docs/standards/swagger.md`
- `docs/standards/validation.md`
- `docs/audits/leaderboard-module-api-contract-audit-2026-07-17.md`
