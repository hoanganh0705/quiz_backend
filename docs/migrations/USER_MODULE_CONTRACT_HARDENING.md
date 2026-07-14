# Migration Plan — User Module Contract Hardening

> **Source audit:** `docs/api-contract-audit-user.md` (16 endpoints, 20 issues: 3 Critical / 7 High / 6 Medium / 4 Low).
> **Goal:** Bring the user-module API to a state where (a) every documented endpoint actually works, (b) the OpenAPI document is internally consistent and produces working client code, (c) validation matches the contract, and (d) no documented status code is unreachable.
> **Non-goals:** No feature additions. No refactors beyond what is required to land the audit fixes. The envelope convention (`{ data, meta }`) and the RFC 7807 error shape stay unchanged.
> **Conventions:** Phase numbering follows the repo's existing pattern (`test/envelope.e2e-spec.ts` is "Phase 0", `test/rfc7807.e2e-spec.ts` is also "Phase 0"). Each phase ships behind a feature flag only when the change is wire-visible; otherwise it merges directly to `main`. Every phase ends with an updated `docs/generated/openapi.json` and a green e2e backstop.

---

## How to read this plan

- **Phase gates** are the deliverables that MUST be true before the next phase starts. They are framed as observable signals (HTTP status, schema refs, snapshot tests), not "code is merged".
- **Phase ordering** is chosen so each phase is independently shippable and rollback-safe. Critical issues are front-loaded; cosmetic drift is back-loaded.
- **Risk column** ranks (Low / Med / High) the chance of wire-shape regression for clients. Anything rated Med or High gets a feature flag and a staged rollout.
- **Backstops** reference the test files this migration will extend. They mirror the existing `Phase 0` test style.
- **Out-of-scope** items are listed in §10 so we don't forget them but also don't blow up the plan.

---

## Phase 0 — Triage baseline (no code changes)

**Status:** ✅ already done by the audit.
**Deliverable:** `docs/api-contract-audit-user.md`.

This phase establishes the baseline. The remaining phases operate against the inventory and findings in §1, §3–§7 of the audit. Nothing to merge.

---

## Phase 1 — Stop the bleeding (Critical fixes)

**Objective:** Eliminate the three Critical issues (C1, C2, C3) that either break runtime behaviour, break client generation, or corrupt data silently.
**Risk:** High (Phase 1.3 changes a validator; clients sending non-URL `avatarUrl` will start receiving 400). Med (Phase 1.1 affects two endpoints but does not change the success wire shape; only the success code path will start returning 200 instead of 500).

### 1.1 — Fix `tournament-history` 500 (C1)

**Issue:** `UserRepository.listMyTournamentHistory` references a raw `count()` column from a Drizzle subquery without an alias, throwing 500 on every call.

**Files touched:**
- `src/modules/user/infrastructure/repositories/user.repository.ts:375-413`
- `src/modules/user/infrastructure/repositories/user.repository.spec.ts` (new spec covering the happy path and an empty-result path)

**Approach:** Replace the aliased subquery with a correlated scalar subquery (recommended — keeps the LEFT JOIN semantics intact):

```ts
// Inside select({...})
participantCount: sql<number>`(
  SELECT COUNT(*)::int FROM ${tournamentParticipants} tp2
  WHERE tp2.tournament_id = ${tournaments.tournamentId}
    AND tp2.rank_final IS NOT NULL
)`,
```

This drops the `participantCountSubquery` builder entirely and avoids Drizzle's alias-on-raw-column pitfall. The repository signature and DTO are unchanged.

**Backstops:**
- New unit test: seed 1 finished tournament with 5 participants → assert `participantCount: 5`.
- Manual curl: `GET /users/me/tournament-history` must return 200 (was 500).
- Manual curl: `GET /users/{learnerId}/tournament-history` must return 200 for the learner profile.

**Acceptance gate:**
- `pnpm test` green.
- `docs/generated/openapi.json` shows both endpoints unchanged on the 200 schema.
- No 500 in app logs for both endpoints in the dev environment.

**Rollback:** The change is additive on the SQL side and equivalent at the row level; revert the spec + the 4-line repo change if a regression is detected.

---

### 1.2 — Register `WrappedDto` / `WrappedPaginatedDto` in OpenAPI (C2)

**Issue:** The OpenAPI document references `#/components/schemas/WrappedDto` and `#/components/schemas/WrappedPaginatedDto` but they are not emitted in `components.schemas` because they are generic classes and are never passed to `ApiExtraModels()`. Generated clients cannot resolve the envelope shape.

**Files touched:**
- `src/common/swagger/api-ok.ts` (the three helpers `ApiOkResource`, `ApiOkResourceList`, `ApiOkResourceArray`)
- `src/common/swagger/swagger-schemas.ts` (the `@ApiProperty` definitions on `WrappedDto` / `WrappedPaginatedDto` need `type: () => ResponseMetaDto` and `type: () => PaginatedResponseMetaDto` to materialize the inner `meta` shape — they already do; verify)
- `test/openapi-schemas.spec.ts` (new — snapshot tests that the envelope refs resolve)

**Approach:**
```ts
const buildResourceSchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    { properties: { data: { $ref: getSchemaPath(model) } } },
  ],
});

export const ApiOkResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({ ...options, schema: buildResourceSchema(model) }),
  );
```

Apply the same to `ApiOkResourceList` (add `WrappedPaginatedDto`, `PaginatedResponseMetaDto`, `PaginationMetaDto` / `OffsetPaginationMetaDto`) and to `ApiOkResourceArray`. Then regenerate `docs/generated/openapi.json` via `pnpm generate:openapi` and confirm the two refs now resolve.

**Backstops:**
- New spec: `test/openapi-schemas.spec.ts` loads the live OpenAPI doc and asserts no `#/components/schemas/X` reference points to a missing schema.
- Run `pnpm generate:openapi` and diff the result.

**Acceptance gate:**
- `jq '.components.schemas | keys' docs/generated/openapi.json` includes both `WrappedDto` and `WrappedPaginatedDto`.
- All previously-broken refs (currently every 200 response in the user module) now resolve.

**Rollback:** Trivial — the helpers become no-ops on `ApiExtraModels` if reverted. No runtime impact.

---

### 1.3 — Tighten `avatarUrl` validator (C3)

**Issue:** `@IsUrl({ require_tld: false })` accepts strings like `not-a-url`. Silent data corruption; the persisted value is the literal user-supplied garbage.

**Files touched:**
- `src/modules/user/dto/request/update-me.dto.ts:42`
- `src/modules/user/dto/request/update-me.dto.spec.ts` (new — table-driven URL validation)

**Approach:** Replace with a strict validator:
```ts
@IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true })
@MaxLength(2048)
avatarUrl?: string | null;
```

If a client wants to allow `mailto:` or other schemes, follow up with a config option — but for v1 the HTTP/HTTPS-only policy matches the documented `https://example.com/avatars/...` example.

**Risk:** High — this is a wire-visible behaviour change. Two options:

1. **Direct merge** (recommended for an internal API with no public clients yet). The audit found no live client depending on the loose behaviour. The benefit (no garbage persisted) outweighs the (small) risk of rejecting a previously-accepted avatar URL.
2. **Feature flag** behind `USER_AVATAR_URL_STRICT_VALIDATION`. Read the flag in a custom validator pipe. Stage the rollout by enabling it first for admins, then for everyone. Use this path only if a partner integration surfaces.

**Backstops:**
- Unit test table: passes for `https://example.com/x.jpg`, `http://a.b`; fails for `not-a-url`, `foo.bar`, `ftp://x.y`, `mailto:foo@bar`, `https://` (empty host), 2049-char URL.

**Acceptance gate:**
- `PATCH /users/me` returns 400 for invalid `avatarUrl` values; returns 200 for `https://...`.
- `users.avatarUrl` rows in DB are all valid HTTP(S) URLs (post-deployment query).

**Rollback:** Revert the constraint to `require_tld: false`. No data migration needed — garbage rows already in the DB will continue to fail on read for clients that try to display them.

---

### Phase 1 exit gate

- All three Critical issues closed.
- `docs/generated/openapi.json` regenerated.
- All e2e tests (`test/envelope.e2e-spec.ts`, `test/rfc7807.e2e-spec.ts`, new specs from 1.1 and 1.2) green.
- Release notes entry: "User module: tournament-history now returns 200; OpenAPI document is internally consistent; `PATCH /users/me` rejects invalid avatar URLs."

---

## Phase 2 — Align the OpenAPI document with the wire (High fixes)

**Objective:** Bring every user-module endpoint's documented schema into 1:1 alignment with the actual runtime response.
**Risk:** Low — these are documentation-only changes. No runtime behaviour moves.

### 2.1 — Fix the list-item schemas (H1)

**Issue:** `ApiUserBadgesResponse` and (verify) `ApiUserActivityResponse` pass the *wrapper* DTO (`UserBadgesResponseDto`) as the item type, generating `data: UserBadgesResponseDto[]` where `data` is actually `UserBadgeItemDto[]`.

**Files touched:**
- `src/modules/user/transport/swagger/user-swagger-decorators.ts:63-67`
- New spec: `test/openapi-user-lists.spec.ts` — assert each list endpoint's `data.items.$ref` points to the item DTO, not the wrapper DTO.

**Approach:**
```ts
export const ApiUserBadgesResponse = (): MethodDecorator =>
  ApiOkResourceList(UserBadgeItemDto, 'cursor', { description: 'Returns badges.' });

export const ApiUserActivityResponse = (): MethodDecorator =>
  ApiOkResourceList(UserActivityItemDto, 'cursor', { description: 'Returns activity.' });
```

**Backstops:**
- Snapshot the 200 schema for each list endpoint and assert `data.items.$ref` ends in `ItemDto` (not `ResponseDto`).

**Rollback:** Revert the decorator arguments.

---

### 2.2 — Switch recommended-quizzes to bare-array envelope (H2)

**Issue:** `GET /users/me/recommended-quizzes` documents `WrappedPaginatedDto` + `PaginationMetaDto`, but the runtime returns `{ data, meta: { timestamp } }` (no pagination).

**Files touched:**
- `src/modules/user/transport/swagger/user-swagger-decorators.ts:104-105`
- Regenerate `docs/generated/openapi.json`

**Approach:**
```ts
export const ApiRecommendedQuizzesResponse = (): MethodDecorator =>
  ApiOkResourceArray(QuizListItemDto, { description: 'Returns recommended quizzes.' });
```

(The runtime actually emits `QuizListItemDto[]`, not `QuizResponseDto[]` — see the presenter projection in `user.presenter.ts:84`.)

**Backstops:**
- Spec: assert `200.content.schema` has no `meta.pagination` ref.

**Rollback:** Trivial — revert the decorator.

---

### 2.3 — Decide the 404 contract for aggregate user endpoints (H3, H4, H5)

**Issue:** Three endpoints (`/users/{userId}/quizzes/analytics`, `/users/{userId}/tournaments`, `/users/{userId}/badges`) document 404 for non-existent users but return 200 with empty data.

**Decision point (manual):** Choose one of two paths for each endpoint. The plan below picks the **implementation fix** path because the existing controllers already advertise 404 and the privacy/scope semantics depend on it.

#### 2.3a — `/users/{userId}/quizzes/analytics` (H3) — implementation fix

**Files touched:**
- `src/modules/quiz/application/quiz.application.service.ts:250` — add `await this.userDomainService.getMe(userId)` (or a slimmer `assertUserExists` that delegates to the user module) before the analytics call.
- `src/modules/quiz/domain/ports/quiz-listing.port.ts:15-19` — add the dependency if not present.

**Approach:** Inject `USER_DOMAIN_SERVICE` (or a new `USER_EXISTS_PORT` with a single `assertExists(userId): Promise<void>` method). Throw `UserNotFoundError` (already mapped to 404 in `ProblemCodeMapping`).

**Risk:** Med — quiz module now depends on the user module's existence check. The user module already exposes `findMeById` via `USER_REPOSITORY_PORT`, so the cheapest path is to inject the port directly. Avoid creating a circular dependency by going through `getMe` rather than the repository.

#### 2.3b — `/users/{userId}/tournaments` (H4) — implementation fix

**Files touched:**
- `src/modules/user/domain/user.service.ts:336-351` (`getPublicTournamentProfile`) — call `this.getMe(query.userId)` first (mirrors what `getMyTournamentAnalytics` does on line 356).

**Approach:** Reuse the existing 404 contract:
```ts
async getPublicTournamentProfile(query) {
  await this.getMe(query.userId); // throws UserNotFoundError → 404
  const profile = await this.userRepository.getPublicTournamentProfile(query.userId);
  return profile;
}
```

**Risk:** Low — same-module call, same pattern as a sibling method.

#### 2.3c — `/users/{userId}/badges` (H5) — implementation fix

**Files touched:**
- `src/modules/user/domain/user.service.ts:62-73` (`assertProfileVisible`) — verify user exists before defaulting to "public".

**Approach:**
```ts
async assertProfileVisible(targetUserId, requesterId) {
  if (requesterId === targetUserId) return;
  const user = await this.userRepository.findMeById(targetUserId);
  if (!user) throw new UserNotFoundError();
  const isPublic = await this.isUserProfilePublic(targetUserId);
  if (!isPublic) throw new UserProfilePrivateError(targetUserId);
}
```

**Risk:** Low — extra DB read per non-self call (already occurs when `user_profile_settings` row exists). For the "no settings row, user exists" path, one extra round-trip. Acceptable for the documented 404 contract.

**Backstops (all three):**
- Manual: `GET /users/{nonexistent-uuid}/{quizzes/analytics,tournaments,badges}` returns 404 with `extensions.code = USER_NOT_FOUND`.
- Manual: `GET /users/{real-uuid}/{...}` continues to return 200/403 as before.
- New spec: `test/user-existence-404.spec.ts` — boots the app, asserts the three endpoints' 404 path.

**Rollback:** Each fix is one or two lines; revert per endpoint.

---

### 2.4 — Add `@ApiAuth()` to `:userId/*` methods (H6)

**Issue:** Five endpoints (`/users/:userId/*`) require JWT at runtime (global guard) but the OpenAPI documents no `security` block and no 401 response.

**Files touched:**
- `src/modules/user/transport/controller/user.controller.ts:217-302` (5 method decorators)

**Approach:** Add `@ApiAuth()` to each method:
```ts
@Get(':userId/quizzes/analytics')
@ApiAuth()
@ApiOperation({ ... })
@ApiCreatorQuizAnalyticsResponse()
@ApiNotFoundAndInternal()
async getUserQuizAnalytics(...) { ... }
```

The existing `@ApiNotFoundAndInternal()` / `@ApiNotFoundBadRequestInternal()` decorators stay; `@ApiAuth()` adds the 401 + `BearerAuth` security block.

**Risk:** Low — pure documentation change.

**Backstops:**
- Spec: assert each `:userId/*` path has `security: [{ BearerAuth: [] }]` and a 401 response.

**Rollback:** Remove the decorator.

---

### 2.5 — Refine 403 example instance paths (H7)

**Issue:** The 403 example in the global error response schema has `instance: /quizzes/...` which is misleading for user-module 403s.

**Files touched:**
- `src/common/swagger/swagger-schemas.ts` (the global error response builder) — and/or override per-endpoint.
- `src/modules/user/transport/swagger/user-swagger-decorators.ts` — pass per-endpoint examples to `notFoundOptions` / `forbiddenOptions`.

**Approach:** Two-tier fix:
1. Add a `describe:`-style instance placeholder to the global examples (e.g. `instance: '/users/{userId}/...'`).
2. For high-traffic user endpoints, override the example with the actual route pattern.

**Risk:** Low — cosmetic.

**Backstops:**
- Manual: Swagger UI shows a sensible instance path for the 403 example on user endpoints.

---

### Phase 2 exit gate

- All seven High issues closed (H1–H7).
- `docs/generated/openapi.json` regenerated; no broken refs; no documented status code that the implementation cannot produce; no documented response schema that the runtime doesn't match.
- Wire-visible changes (the 404 paths in 2.3) verified by manual curl and a new e2e spec.
- Release notes entry: "User module: 404 now returns for non-existent users on three aggregate endpoints; OpenAPI document is in sync with runtime behaviour."

---

## Phase 3 — Tighten validation and shape (Medium fixes)

**Objective:** Close the remaining inconsistencies that don't break clients but erode trust.
**Risk:** Low.

### 3.1 — Normalize timestamps to ISO 8601 (M1, M6)

**Issue:** Some DTOs return Postgres `timestamptz` defaults (e.g. `"2026-07-14 00:42:19.156551+00"`) while others return `Z`-suffixed ISO strings. `users.createdAt` / `users.updatedAt` and a few sibling fields are the offenders.

**Files touched:**
- `src/modules/user/infrastructure/repositories/user.repository.ts` — every column read that ends in `At` / `Time` / `Date` (use Drizzle's `timestamp({ withTimezone: true, mode: 'string' })` mode if not already, or normalize at read time).
- `src/common/interceptors/response-format.interceptor.ts:99-147` — the existing `normalizeTemporalFields` does some of this; verify it covers keys that *end* with `At` (it does) and that the `Date.parse` path actually rewrites the string.

**Approach:** Two changes:
1. In the repository, cast `createdAt` / `updatedAt` / `lastUpdated` reads through `sql<string>` `toISOString()` casts for any field where the column type is `timestamptz` (default) and the consuming DTO expects ISO 8601. Two options:
   - **At-read** (preferred): `(users.createdAt AT TIME ZONE 'UTC')::text` plus `toISOString()` in TS. Cheap but verbose.
   - **At-write**: enforce ISO 8601 everywhere via the response interceptor — simpler, but requires the interceptor to walk every DTO and rewrite every `*At` / `*Time` / `*Date` field. Already partially implemented; fix the gaps.

2. Add a regression test that asserts every timestamp field in the live `GET /users/me` response matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`.

**Risk:** Low — clients that already accepted the Postgres default format still accept ISO. Clients that strictly checked `T...Z` will start working.

**Backstops:**
- New spec: `test/timestamp-normalization.spec.ts` boots the user module, logs in, asserts every temporal field on `GET /users/me`, `GET /users/me/ranking`, `GET /users/me/analytics` matches the ISO regex.

**Rollback:** Revert the cast / interceptor change. No data migration.

---

### 3.2 — Document three-way semantics on `PATCH /users/me` (M3)

**Issue:** `UpdateMeDto` accepts `undefined` (no-op), `null` (clear), and `""` (clear) with undocumented divergence.

**Files touched:**
- `src/modules/user/dto/request/update-me.dto.ts:7-44` — extend the `@ApiPropertyOptional.description` strings.

**Approach:**
```ts
@ApiPropertyOptional({
  description:
    'Display name shown in the app. Send `null` or a blank string to clear. ' +
    'Omit the field (or send `undefined`) to leave the current value untouched.',
  ...
})
```

**Risk:** None — documentation only.

**Backstops:** Manual Swagger UI check.

---

### 3.3 — Bound the `settings` object shape (M4)

**Issue:** `UpdateMeSettingsDto.settings` accepts arbitrary objects with no max keys, no max depth, no string length cap.

**Files touched:**
- `src/modules/user/dto/request/update-me-settings.dto.ts`

**Approach:** Add a custom validator:
```ts
@IsObject()
@MaxLength(50)              // number of top-level keys (custom validator)
@ValidateNested({ each: false })
@MaxKeyStringLength(200)     // custom validator — each key string ≤ 200 chars
settings!: Record<string, unknown>;
```

Keep the DTO permissive enough to allow nested JSON but bounded enough to prevent abuse. A max-keys limit on the *top level* plus a string-length cap on values is a pragmatic compromise.

**Risk:** Low — well-behaved clients are unaffected.

**Backstops:**
- Unit tests: rejects `{ a: 'x'.repeat(201) }`; rejects `{ a:1, b:2, ... 51 keys }`.

**Rollback:** Revert the validators.

---

### 3.4 — Add `format: uuid` to `:userId` path params (M5)

**Issue:** OpenAPI declares `userId: { type: 'string' }` for all `:userId/*` paths but the runtime enforces UUID via `ParseUUIDPipe`.

**Files touched:**
- `src/modules/user/transport/controller/user.controller.ts:217-302` — add `@ApiParam({ name: 'userId', format: 'uuid' })` on each method, OR consolidate on the class via a single `@ApiParam` constant.

**Approach:** Use the class-level pattern — export a `USER_ID_PATH_PARAM` constant from `user-swagger-decorators.ts`:
```ts
import { ApiParam } from '@nestjs/swagger';
export const ApiUserIdParam = (): MethodDecorator =>
  ApiParam({ name: 'userId', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' });
```

Then stack `@ApiUserIdParam()` on every `:userId/*` method.

**Risk:** None.

**Backstops:** Spec: assert each `:userId/*` parameter has `format: 'uuid'`.

---

### Phase 3 exit gate

- All six Medium issues closed.
- No remaining timestamp drift on user-module responses.
- Release notes entry: "User module: timestamps are now ISO 8601; `settings` payload bounded; `:userId` documented as UUID."

---

## Phase 4 — Polish and dead-code cleanup (Low fixes)

**Objective:** Resolve the remaining nits without changing semantics.
**Risk:** None.

### 4.1 — Document `getUserRanking` upsert side effect (L1)

**Files touched:**
- `src/modules/user/domain/user.service.ts:111-129` — add a comment about the write-on-read semantics.
- `src/modules/user/transport/swagger/user-swagger-decorators.ts` — extend the ranking operation description.

**Approach:** Either:
- (Cheap) Document the side effect in the operation description.
- (Better) Move the upsert into a scheduled job (out of scope for this migration; file a follow-up ticket).

### 4.2 — Document `level` formula (L2)

**Files touched:**
- `src/modules/user/dto/response/user-ranking.dto.ts:26-28`

**Approach:**
```ts
@ApiProperty({
  description:
    'Derived level = floor(totalScore / 500) + 1. Reflects all-time XP progression.',
  example: 14,
})
level!: number;
```

### 4.3 — Clarify `updatedAt` semantics on `UserMeResponseDto` (L3)

**Files touched:**
- `src/modules/user/dto/response/user-me.dto.ts:62-66`

**Approach:**
```ts
@ApiProperty({
  description:
    'Last write to the user record (any column, not just profile). ISO 8601 timestamp.',
  example: '2025-06-01T12:00:00.000Z',
})
updatedAt!: string;
```

### 4.4 — Wire Swagger examples into the decorators (L4)

**Files touched:**
- `src/modules/user/transport/swagger/user-swagger-decorators.ts` — pass `example: USER_ME_EXAMPLE` etc. through to each helper.
- `src/common/swagger/api-ok.ts` — verify the helpers' `example` option is honoured (already supported via `ApiResourceOptions.example`).
- `src/modules/user/transport/swagger/examples/me.examples.ts` — keep the existing constants; add new ones for the endpoints currently missing examples.

**Approach:** Per-decorator wiring:
```ts
import { USER_ME_EXAMPLE } from '../swagger/examples/me.examples';

export const ApiUserMeResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, {
    description: 'Returns profile.',
    example: USER_ME_EXAMPLE,
  });
```

Apply the same pattern to `ApiUserBadgesResponse`, `ApiUserActivityResponse`, `ApiUserRankingResponse`, `ApiUserAnalyticsResponse`, `ApiRecommendedQuizzesResponse`, `ApiUserQuizListResponse`, `ApiMyTournamentsResponse`, `ApiMyTournamentHistoryResponse`, `ApiPublicTournamentHistoryResponse`, `ApiMyTournamentAnalyticsResponse`, `ApiPublicTournamentProfileResponse`, `ApiCreatorQuizAnalyticsResponse`, `ApiUserMeUpdatedResponse`, `ApiUserSettingsUpdatedResponse`.

**Backstops:** Manual Swagger UI check; spec asserts each endpoint's 200 schema has an `example` field.

**Rollback:** Revert the decorator changes.

### 4.5 — Consolidate cursor mappers (X2)

**Files touched:**
- `src/modules/user/mappers/my-tournament-cursor.mapper.ts`
- `src/modules/user/mappers/my-tournament-history-cursor.mapper.ts`

**Approach:** Replace the inline `Buffer.from(JSON.stringify).toString('base64url')` with the shared `encodeBase64JsonCursor` / `decodeBase64JsonCursor` from `@/common/utils/cursor.util`. The output is wire-compatible.

**Backstops:**
- Unit test: `serialize → parse → serialize` is idempotent for both old and new paths; ensure the round-trip yields identical bytes (or equivalent decoded JSON).

---

### Phase 4 exit gate

- All four Low issues closed.
- Cross-cutting observation X2 (cursor mapper consolidation) shipped.
- Release notes entry: "User module: Swagger examples wired; cursor mappers consolidated; documentation polish."

---

## Phase 5 — Cross-module propagation (Optional)

**Objective:** Apply the same audit methodology to the other modules that mount routes under `/users/*` and feed any findings into their own migration plans.

**Status:** Out of scope for this document but listed for completeness.

Modules that own `/users/me/*` routes (per the OpenAPI inventory):

| Module | Routes |
|---|---|
| `src/modules/attempt` | `/users/me/attempts`, `/users/me/attempts/stats` |
| `src/modules/review` | `/users/me/reviews`, `/users/me/reviews/{quizId}`, `/users/me/reported-reviews` |
| `src/modules/discussion` | `/users/me/comments`, `/users/me/discussions`, `/users/me/discussion-subscriptions`, `/users/me/saved-threads`, `/users/me/upvoted-comments`, `/users/me/upvoted-threads`, `/users/{userId}/comments`, `/users/{userId}/discussions`, `/users/{userId}/discussion-profile` |
| `src/modules/category` | `/users/me/followed-categories` |
| `src/modules/tag` | `/users/me/followed-tags` |
| `src/modules/social` | `/users/{userId}/activity` |

If the team wants "everything under `/users/*` audited", commission one audit per module. The user-module audit can serve as the template.

---

## Phase ordering rationale

1. **Phase 1 (Critical)** — stops the bleeding. The 500 on `tournament-history` is a runtime outage; the broken OpenAPI refs break every client; the loose validator corrupts data. Each fix is small, isolated, and reversible.
2. **Phase 2 (High)** — restores the contract. Once Phase 1 ships, the contract matches the runtime; Phase 2 makes the OpenAPI document match too. All changes are documentation-only except the 404 paths (2.3), which carry low risk because they re-use the existing `UserNotFoundError` → 404 mapping.
3. **Phase 3 (Medium)** — tightens validation and shape. The wire shape doesn't change for compliant clients; only edge cases (overlong URLs, invalid schemes, bad timestamps) start returning 400.
4. **Phase 4 (Low)** — polish. Swagger examples, documentation strings, dead-code cleanup. Zero risk.
5. **Phase 5 (Optional)** — propagate the audit to sibling modules.

This ordering means each phase can ship independently without blocking the next.

---

## Risk and rollback summary

| Phase | Wire-shape change? | Risk | Rollback complexity |
|---|---|---|---|
| 1.1 | No (fixes 500 → 200) | Med | Low — 4 lines + spec |
| 1.2 | No (doc only) | Low | Trivial — decorator revert |
| 1.3 | Yes (loose URL → strict URL) | High | Low — revert validator; no data migration |
| 2.1 | No (doc only) | Low | Trivial |
| 2.2 | No (doc only) | Low | Trivial |
| 2.3a/b/c | Yes (200 → 404 for non-existent users) | Med | Low — revert the precondition |
| 2.4 | No (doc only) | Low | Trivial |
| 2.5 | No (doc only) | Low | Trivial |
| 3.1 | Mostly no (Postgres → ISO 8601) | Low | Low — revert cast/interceptor |
| 3.2 | No | None | Trivial |
| 3.3 | Yes (loose settings → bounded) | Low | Low |
| 3.4 | No (doc only) | None | Trivial |
| 4.x | No | None | Trivial |

Wire-visible changes: 1.3 (validator tightening), 2.3a/b/c (404 paths). Everything else is documentation or hardening of edge cases that no well-behaved client would hit.

---

## Acceptance criteria for the whole plan

- All 20 audit issues closed (or formally accepted as "won't fix" with a written rationale).
- `docs/generated/openapi.json` regenerated; no broken `$ref`s; no documented status code that the implementation cannot produce.
- `pnpm test` and `pnpm test:e2e` green, including the new specs introduced by this plan:
  - `test/openapi-schemas.spec.ts` (Phase 1.2)
  - `test/user-existence-404.spec.ts` (Phase 2.3)
  - `test/openapi-user-lists.spec.ts` (Phase 2.1)
  - `test/timestamp-normalization.spec.ts` (Phase 3.1)
- Manual curl matrix against the running app — all 16 endpoints return their documented status codes.
- Release notes drafted for Phases 1, 2, 3, 4.

---

## Suggested PR breakdown

Each phase is one PR (or one PR per sub-step for Phase 2, which has the most work):

| PR | Phase | Title |
|---|---|---|
| PR-1 | 1.1 | `fix(user): alias participantCount subquery in tournament-history` |
| PR-2 | 1.2 | `fix(swagger): register WrappedDto / WrappedPaginatedDto as extra models` |
| PR-3 | 1.3 | `fix(user): tighten avatarUrl validator to require http(s) protocol` |
| PR-4 | 2.1 | `fix(user-swagger): use item DTOs in badges/activity list decorators` |
| PR-5 | 2.2 | `fix(user-swagger): switch recommended-quizzes to bare-array envelope` |
| PR-6 | 2.3a | `fix(quiz): assert user exists before returning creator analytics` |
| PR-7 | 2.3b | `fix(user): assert user exists in getPublicTournamentProfile` |
| PR-8 | 2.3c | `fix(user): assert user exists in assertProfileVisible` |
| PR-9 | 2.4 | `docs(user): annotate :userId/* endpoints with @ApiAuth()` |
| PR-10 | 2.5 | `fix(swagger): refine 403 example instance paths for user module` |
| PR-11 | 3.1 | `fix(user): normalize timestamps to ISO 8601` |
| PR-12 | 3.2 | `docs(user): clarify PATCH /me three-way semantics` |
| PR-13 | 3.3 | `fix(user): bound UpdateMeSettingsDto.settings shape` |
| PR-14 | 3.4 | `docs(user): mark userId path param as uuid format` |
| PR-15 | 4.x | `chore(user): wire swagger examples; document ranking side effect; consolidate cursor mappers` |

PRs 1–3 can ship in parallel. PRs 4–10 should ship in order (they touch the same decorators). PRs 11–14 are independent. PR-15 is cleanup after all the others.

---

## What this plan does NOT do

- Does not change the response envelope convention.
- Does not introduce new endpoints.
- Does not change authentication policy (JWT required everywhere stays).
- Does not migrate data (no schema changes needed for any of the fixes).
- Does not change the global exception filter, the global response interceptor, or the RFC 7807 wire shape.
- Does not address the cross-module `/users/me/*` endpoints owned by other modules — see Phase 5 for that.
- Does not refactor the quiz module beyond the single precondition change in 2.3a.
- Does not introduce rate limiting, caching, or pagination-cursor improvements beyond what is documented.

If any of these are needed, they belong in a separate migration.