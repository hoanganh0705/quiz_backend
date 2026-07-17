# Leaderboard Module — API Contract Audit

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Module           | `ranking` (OpenAPI tag: `leaderboard`)                                |
| Audit date       | 2026-07-17                                                            |
| Auditor mode     | Read-only (no code, no DTO, no OpenAPI artifact was modified)         |
| Endpoints audited | 17 (12 public/protected read + 4 admin + 1 cross-module instance)     |
| Source-of-truth  | `docs/PROJECT_CONSTITUTION.md` § Authority hierarchy                  |

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

| Metric                         | Value                                |
| ------------------------------ | ------------------------------------ |
| Contract health score          | **3.6 / 10**                         |
| Endpoints audited              | 17                                   |
| Total issues                   | 20                                   |
| Critical / High / Medium / Low | 4 / 4 / 5 / 7                        |
| Implementation bugs            | 8                                    |
| Documentation issues           | 13                                   |
| Validation inconsistencies     | 2                                    |
| OpenAPI inconsistencies        | 5                                    |
| Swagger example issues         | 3                                    |

> Headline: four Critical implementation bugs make the production leaderboard unreadable. `GET /leaderboard` returns 500, the public `:userId` lookups accept non-UUID values and 500 on the database, `/leaderboard/me/nearby` 500s on a reserved-keyword SQL clash, and `POST /admin/ranking/reset` 500s on every call.

---

## Severity Breakdown

| Severity | Count |
| -------- | ----- |
| Critical | 4     |
| High     | 4     |
| Medium   | 5     |
| Low      | 7     |

---

## Issue Index

| ID    | Severity | Endpoint                                                                                       | Title                                                                                          |
| ----- | -------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| L-01  | Critical | `GET /leaderboard`                                                                             | SQL references non-existent `u.display_name` column                                             |
| L-02  | Critical | `GET /leaderboard/:userId`, `/history`, `/rank`                                               | Path parameter `:userId` accepts non-UUID values; 500 instead of 400                            |
| L-03  | Critical | `GET /leaderboard/me/nearby`                                                                   | SQL syntax error: CTE name `current_user` collides with reserved keyword                       |
| L-04  | Critical | `POST /admin/ranking/reset?period=weekly`                                                      | Manual reset fails: drizzle dynamic-key `where` clause is empty                                 |
| L-05  | High     | `GET /leaderboard/top-movers`, `/me/milestones`, `/me/history`                                 | OpenAPI declares `WrappedPaginatedDto` (cursor) but runtime returns bare array                  |
| L-06  | High     | `GET /leaderboard`                                                                             | Endpoint is `@Public()` but description claims `userPosition` is filled when authenticated      |
| L-07  | High     | `GET /leaderboard` query param `period`                                                        | Daily period is accepted at the API but invalid in `getLeaderboard` repository                  |
| L-08  | Medium   | `GET /leaderboard/distribution`                                                                | Endpoint is `@Public()` but Swagger description does not mention anonymous access                |
| L-09  | Medium   | All `/leaderboard/*` error responses                                                           | Swagger examples for `/auth/login` and `/quizzes` leak into leaderboard error responses         |
| L-10  | Medium   | All DTOs exposing UUID fields                                                                  | Generated OpenAPI declares UUIDs as bare `string` (no `format: uuid`)                           |
| L-11  | Medium   | All date/timestamp DTOs                                                                        | Generated OpenAPI declares timestamps as bare `string` (no `format: date-time`)                |
| L-12  | Medium   | `GET /leaderboard/me/rank`, `/leaderboard/:userId/rank`                                        | DTO has `period` and `resetInSeconds` but values are not meaningful                             |
| L-13  | Medium   | `GET /leaderboard/me/rank?period=daily`, `/leaderboard/:userId/rank?period=daily`              | Request echoes `period=daily` but response `period` is always `all_time`                        |
| L-14  | Low      | `GET /leaderboard/:userId`                                                                     | Description contradicts `LeaderboardResponseDto` semantics                                     |
| L-15  | Low      | `GET /leaderboard/me`, `/leaderboard/:userId`                                                  | Peak ranks shape mismatch: `UserRankResponseDto.peakRanks` vs `/peak-ranks` endpoint            |
| L-16  | Low      | `GET /leaderboard/me/movement`                                                                 | Direction enum mismatch with `RankingMilestoneDto` neighbor                                     |
| L-17  | Low      | `GET /leaderboard/me/percentile`                                                               | `percentileLabel` not exposed despite description mentioning labels                             |
| L-18  | Low      | `POST /admin/ranking/reset`                                                                    | Description claims `period` defaults to "all due periods" but no-arg path is conditional       |
| L-19  | Low      | `GET /leaderboard/me/history`                                                                  | Pagination semantics on history are misleading                                                  |
| L-20  | Low      | `POST /admin/ranking/consistency-check`                                                        | `severity` is a free-form string in DTO                                                         |

---

## Endpoint-by-Endpoint Findings

### L-01 · Critical · `GET /leaderboard`

**Current behavior**
500 Internal Server Error on every call (`all_time`, `daily`, `weekly`, `monthly`). Cause chain: `column u.display_name does not exist` (SQLSTATE `42703`) in `getLeaderboard` and `getUserRankingWithUser`.

**Documented behavior**
Should return 200 OK with the leaderboard payload: `{ entries, totalParticipants, userPosition, period, pagination }`.

**Root cause**
`RankingRepository.getLeaderboard` and `getUserRankingWithUser` SELECT `u.display_name`. The `users` table has only `username`; `display_name` lives on `user_profiles`. No JOIN to `user_profiles`.

**Implementation correct?** No.
**Documentation correct?** Yes.
**Recommendation** Fix SQL.
**Suggested fix**
Replace `u.display_name` with `up.display_name` and add `LEFT JOIN user_profiles up ON up.user_id = u.user_id`. Keep the public DTO field `displayName` (already nullable in `LeaderboardEntryDto`).
**Safety classification** Safe implementation fix. SQL-only. No public contract change.

---

### L-02 · Critical · `GET /leaderboard/:userId`, `/leaderboard/:userId/history`, `/leaderboard/:userId/rank`

**Current behavior**
500 Internal Server Error on non-UUID inputs (e.g. `not-a-uuid`, `1000`). Cause chain: `invalid input syntax for type uuid` (SQLSTATE `22P02`) in drizzle query against `user_ranking` / `users` tables.

**Documented behavior**
Per `api.md`, path params must be parsed via `ParseUUIDPipe` / `ParseUUIDOrSlugPipe`; validation should return RFC 7807 Bad Request. `swagger.md` requires `@ApiParam({ format: 'uuid' })`.

**Root cause**
`RankingController.getUserRank`, `getUserRankingHistory`, `getUserRankForPeriod` declare `@Param('userId') userId: string` with no pipe. The generated OpenAPI declares `"type": "string"` with no `format`.

**Implementation correct?** No.
**Documentation correct?** No (incomplete).
**Recommendation** Add pipe + OpenAPI `format`.
**Suggested fix**
- Add `ParseUUIDPipe` (or the project's `ParseUUIDOrSlugPipe` if slugs are also valid) to each `:userId` parameter.
- Add `format: 'uuid'` to the corresponding OpenAPI parameter schemas.

**Safety classification** Safe implementation + documentation fix. No contract change for valid UUIDs.

---

### L-03 · Critical · `GET /leaderboard/me/nearby`

**Current behavior**
500 Internal Server Error. Cause: `syntax error at or near "current_user"` (SQLSTATE `42601`).

**Documented behavior**
Should return 200 OK with `{ data: { above, me, below }, meta: { timestamp } }`.

**Root cause**
`RankingRepository.getNearbyRanks` declares a CTE named `current_user`, which is a reserved keyword in PostgreSQL (`CURRENT_USER` returns the current session user).

**Implementation correct?** No.
**Documentation correct?** Yes.
**Recommendation** Rename the CTE.
**Suggested fix** Rename `current_user` to `current_user_rank` (or any non-reserved identifier) in the WITH clause of `getNearbyRanks`.
**Safety classification** Safe implementation fix. No public contract change.

---

### L-04 · Critical · `POST /admin/ranking/reset?period=weekly`

**Current behavior**
500 Internal Server Error (`RANKING_PERIOD_RESET_ERROR`). Server log: `update "user_ranking" set "weekly_rank" = $1, ... where  > 0` — the LEFT operand of `>` is missing, so PostgreSQL refuses to parse.

**Documented behavior**
Should return 200 OK with `{ message, period }`.

**Root cause**
`RankingRepository.resetPeriod` writes `.where(sql\`${userRanking[xpColumn as keyof typeof userRanking]} > 0\`)`. With `xpColumn = 'weekly_xp'`, this should produce `where "user_ranking"."weekly_xp" > 0`, but the dynamic property access apparently resolves to empty in the parameterized SQL builder.

**Implementation correct?** No.
**Documentation correct?** Yes.
**Recommendation** Replace the dynamic `sql` template with a typed drizzle helper.
**Suggested fix**
Use `gt(userRanking[xpColumn as 'weekly_xp' | 'all_time_xp' | 'monthly_xp'], 0)` instead of building `sql` template. Same SQL effect, no dynamic identifier.
**Safety classification** Safe implementation fix. No public contract change.

---

### L-05 · High · `GET /leaderboard/top-movers`, `/leaderboard/me/milestones`, `/leaderboard/me/history`

**Current behavior**
Real responses:

```json
{ "data": [], "meta": { "timestamp": "..." } }
```

No `pagination` object. Verified by `curl` on all three endpoints.

**Documented behavior**
Each endpoint decorated with `@ApiOkResourceList(Dto, 'cursor', ...)`. The generated OpenAPI references `#/components/schemas/WrappedPaginatedDto` with `meta.pagination: $ref PaginationMetaDto`.

**Root cause**
Presenters `getTopMovers`, `getMyRankingMilestones`, `getMyRankingHistory` return `ApiResponse.ok([...payload.items])`. The list is unwrapped into a bare array under `data`, contradicting the `WrappedPaginatedDto` schema. These endpoints accept no offset or cursor parameters anyway, so they cannot honor `PaginationMetaDto`.

**Implementation correct?** No (wire shape contradicts OpenAPI).
**Documentation correct?** No (OpenAPI implies pagination that the implementation does not implement).
**Recommendation** Pick one canonical shape.

**Suggested fix (option A, lower risk)**
Treat these as small, non-paginated lists and replace `@ApiOkResourceList` with `@ApiOkArray` (or wrap via a new `WrappedArrayDto` schema). Keep the runtime envelope unchanged. Add a `kind: 'array'` discriminator if clients need to distinguish.

**Suggested fix (option B)**
Keep `WrappedPaginatedDto` and update presenters to return `{ items, page: { limit, hasMore } }`. Requires adding `limit` / `cursor` query params to each endpoint.

**Safety classification** Option A: safe documentation fix (but generated SDK shape changes — coordinate with frontend). Option B: additive contract change.

---

### L-06 · High · `GET /leaderboard`

**Current behavior**
Method decorator: `@Public()`. Signature: `@Query() query: LeaderboardQueryDto`. `currentUserId` is never passed to `LeaderboardService.getGlobalLeaderboard`. `userPosition` is always `null` regardless of `Authorization` header.

**Documented behavior**
Description: "The response includes the authenticated user's rank position if a valid JWT is provided." `LeaderboardResponseDto.userPosition` is documented as nullable. OpenAPI example shows `userPosition: null`, which is consistent with runtime — only the description text is inconsistent.

**Root cause**
Either the description is aspirational or the auth wiring was removed.

**Implementation correct?** Yes (matches OpenAPI example).
**Documentation correct?** No (description overpromises).
**Recommendation** Decide on intent.

**Suggested fix (option A, lowest risk)**
Remove the JWT sentence from the `getGlobalLeaderboard` description. Document `userPosition` as "always `null` on the public variant".

**Suggested fix (option B, faithful to original intent)**
Flip the endpoint to `@UseGuards(JwtGuard, OptionalAuthGuard)` and pass the user id when present so `userPosition` is actually populated. Update the security blocks in OpenAPI to reflect optional auth.

**Safety classification** Option A: documentation-only. Option B: backward-compatible (anonymous callers still get a response).

---

### L-07 · High · `GET /leaderboard` query param `period`

**Current behavior**
`LeaderboardQueryDto.period` allows `daily`. The repository's `getXpColumn(RankingPeriod.DAILY)` throws `Error('Daily leaderboard is not supported by user_ranking snapshots')`. `getLeaderboard` would explode if the SQL bug were fixed and a `daily` query reached the repository. (Other repository methods raise the same error.)

**Documented behavior**
`LeaderboardQueryDto` and `LeaderboardDistributionQueryDto` advertise the full enum `daily|weekly|monthly|all_time` via `@IsEnum(RankingPeriodEnum)`.

**Root cause**
Schema / repository drift: the `user_ranking` snapshot only tracks `all_time` / `weekly` / `monthly`. Daily XP is captured separately and is not part of the leaderboard query path.

**Implementation correct?** Yes (rejects unsupported values).
**Documentation correct?** No (advertises a value the repository cannot serve).
**Recommendation** Decide whether `daily` should be supported.

**Suggested fix (short-term, safe)**
Exclude `daily` from the leaderboard DTOs and from `RankMovementQueryDto` / `TopMoversQueryDto` (already restricted).

**Suggested fix (long-term)**
Support `daily` by snapshotting daily XP into `user_ranking.daily_xp` and adapting `getXpColumn`.

**Safety classification** Documentation fix is additive removal of an enum value — a breaking client change. Requires ADR-style deprecation: return 400 with a `Deprecation` header for one release, then remove. Long-term implementation is a non-breaking addition.

---

### L-08 · Medium · `GET /leaderboard/distribution`

**Current behavior**
200 OK with `{ totalUsers, remainingUsers, buckets }` for anonymous callers.

**Documented behavior**
Description only says "Returns distribution statistics...". `security` block correctly omitted.

**Root cause**
Documentation completeness, not a bug.

**Implementation correct?** Yes.
**Documentation correct?** No (incomplete).
**Recommendation** Add one sentence.
**Suggested fix**
Add: "Public endpoint. No authentication required." Matches the style used by the other `@Public()` routes in this controller.
**Safety classification** Safe documentation fix.

---

### L-09 · Medium · All `/leaderboard/*` error responses

**Current behavior**
All four error responses (400, 401, 403, 500) under leaderboard paths use generic examples whose `instance` field is `'/auth/login'` or `'/quizzes'`.

**Documented behavior**
Should reference the actual leaderboard endpoint path.

**Root cause**
`ErrorResponseExamples.badRequest` and `ErrorResponseExamples.unauthorized` are shared across modules. The global ProblemDetail filter writes the real `instance` so the example is purely cosmetic, but it is misleading in Swagger UI.

**Implementation correct?** Yes (runtime is correct).
**Documentation correct?** No (examples leak across modules).
**Recommendation** Introduce leaderboard-scoped example variants.
**Suggested fix**
Make `ErrorResponseExamples.leaderboard*` variants (or remove the `instance` field from the shared examples so they stay neutral). Lowest-cost option: stop pinning `instance` to `/quizzes`.
**Safety classification** Safe documentation fix.

---

### L-10 · Medium · All DTOs exposing UUID fields

**Current behavior**
`userId`, `targetUserId`, etc. are emitted as `{ type: 'string' }` only. Verified in `LeaderboardEntryDto`, `TopMoverDto`, `NearbyRankEntryDto`, `RankingMilestoneDto`, `PublicRankingHistoryResponseDto`, etc.

**Documented behavior**
`PROJECT_CONSTITUTION.md` requires UUIDv7 IDs. `api.md` requires path params to declare `format: 'uuid'`.

**Root cause**
`@ApiProperty` on these DTOs does not pass `{ format: 'uuid' }`. `@IsUUID()` validation is also missing on the DTOs that consume `userId`, so the runtime accepts arbitrary strings until the database layer rejects them (see L-02).

**Implementation correct?** Partially (no `@IsUUID()` on request DTOs).
**Documentation correct?** No.
**Recommendation** Add `format: 'uuid'` and an `@IsUUID()` validator helper.
**Suggested fix**
Introduce a shared `ApiUuidProperty()` decorator. Combine with L-02 to add `@IsUUID()` on the request DTOs that consume `userId` directly.
**Safety classification** Safe documentation fix. Adding `@IsUUID()` to body fields is a hardening change — confirm no client is sending v4 UUIDs as `userId` before enabling strict validation.

---

### L-11 · Medium · All date/timestamp DTOs

**Current behavior**
`start`, `end`, `recordedAt`, `achievedAt`, `lastActivityAt`, `achievedAt`, `nextConsistencyCheck`, `nextPeriodReset.*` all emit `{ type: 'string' }`.

**Documented behavior**
`PROJECT_CONSTITUTION.md` requires ISO 8601 timestamps. `api.md` requires `format: 'date-time'` for date-time fields.

**Root cause**
`@ApiProperty({ example: '2026-06-30T10:00:00.000Z' })` without `format: 'date-time'`.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Add an `ApiTimestampProperty()` helper.
**Suggested fix**
Introduce `ApiTimestampProperty()` and replace `@ApiProperty({ example: '...Z' })` across the module. Orval / openapi-generator clients can be regenerated to pick up stricter typings.
**Safety classification** Safe documentation fix. Generated SDKs may produce stricter TS types, but no runtime change.

---

### L-12 · Medium · `GET /leaderboard/me/rank`, `/leaderboard/:userId/rank`

**Current behavior**
Returns `{ rank, denseRank, percentile, percentileLabel, xp, xpToNextRank, nextRankXp, trend, trendAmount, period, resetInSeconds }`. Verified by `curl` on `?period=daily` (returns `period: 'all_time'` — see L-13).

**Documented behavior**
`UserRankSummaryDto` documents the same fields.

**Root cause**
`UserRankService.getUserRankForPeriod` hard-codes the response `period` to `'weekly' | 'monthly' | 'all_time'` (never `'daily'`), and `resetInSeconds` is always `0`. The query param has no observable effect on these two fields.

**Implementation correct?** No (fields are dead/duplicated).
**Documentation correct?** Yes (matches DTO shape).
**Recommendation** Either remove the dead fields or compute them.
**Suggested fix**
- Option A: drop `period` and `resetInSeconds` from the DTO (treat as redundant with the request).
- Option B: actually compute them via `getPeriodStart` and `PeriodResetService.getNextResetTime`.

**Safety classification** Documentation change is non-breaking. Implementation change is internal-only.

---

### L-13 · Medium · `GET /leaderboard/me/rank?period=daily`, `/leaderboard/:userId/rank?period=daily`

**Current behavior**
Verified: `?period=daily` returns `"period":"all_time"` for `me/rank`. Same for `:userId/rank`.

**Documented behavior**
Should return the requested period's data.

**Root cause**
Mapping logic in `UserRankService.getUserRankForPeriod` ignores the requested period for the response field.

**Implementation correct?** No.
**Documentation correct?** Yes.
**Recommendation** Echo the requested period and compute `resetInSeconds`.
**Suggested fix**
Echo the requested `period` (after enum→domain mapping) and compute `resetInSeconds` from `PeriodResetService.getNextResetTime`. Resolve together with L-12.
**Safety classification** Safe implementation fix. Adds a new value to the response (additive change).

---

### L-14 · Low · `GET /leaderboard/:userId`

**Current behavior**
Description: "Returns public rank information for a specific user (all periods). If the user has no ranking data, returns a ghost response with null ranks (no 404)."

**Documented behavior**
`UserRankResponseDto` has `global.weekly/monthly/allTime` (no daily).

**Root cause**
Description says "all periods" but the DTO omits `daily`.

**Implementation correct?** Yes.
**Documentation correct?** No.
**Recommendation** Tighten the description.
**Suggested fix** Change "all periods" to "weekly, monthly, all-time".
**Safety classification** Safe documentation fix.

---

### L-15 · Low · `GET /leaderboard/me`, `/leaderboard/:userId`

**Current behavior**
`/leaderboard/me` returns `peakRanks: { weekly, monthly, allTime }: number | null`. `/leaderboard/me/peak-ranks` returns `{ daily, weekly, monthly, allTime }: { rank, achievedAt } | null`.

**Documented behavior**
Two different shapes for the same underlying data.

**Root cause**
Two DTOs: `PeakRanksDto` vs `PeakRanksResponseDto`.

**Implementation correct?** Yes (matches its own DTO).
**Documentation correct?** Yes (matches its own DTO).
**Recommendation** Align the two surfaces.

**Suggested fix**
Either expose `peakRanks` in `/me` as the full `{ rank, achievedAt }` shape, or document the simpler number-only variant. Note that the implementation data model has both `peakDailyRank` and `dailyRank`, so the gap is real.

**Safety classification** Additive change. No breaking contract (the simpler shape is a strict subset of the richer one).

---

### L-16 · Low · `GET /leaderboard/me/movement`

**Current behavior**
`RankMovementResponseDto.direction` enum: `['up', 'down', 'stable', 'unknown']`. `RankTrend` (used elsewhere): `['up', 'down', 'same', 'new']`.

**Documented behavior**
Two distinct vocabularies for similar concepts.

**Root cause**
Two parallel enums (`RANK_DIRECTION_VALUES` vs `RANK_TREND_VALUES`).

**Implementation correct?** Yes (matches its own DTO).
**Documentation correct?** Yes (matches its own DTO).
**Recommendation** Decide on one vocabulary.

**Suggested fix**
If the intent is the same, replace `direction` / `trend` with a single `RankTrend` enum and migrate generated clients.

**Safety classification** Breaking client change (different enum values). Requires deprecation window or product decision.

---

### L-17 · Low · `GET /leaderboard/me/percentile`

**Current behavior**
DTO has `rank`, `totalUsers`, `percentile`, `betterThanUsers`, `worseThanUsers`. No `percentileLabel`.

**Documented behavior**
`UserRankPositionDto` (used elsewhere) includes `percentileLabel: 'Top 5%'`. The endpoint description mentions percentile only.

**Root cause**
DTO is missing the label that is computed in `getPercentileLabel()`.

**Implementation correct?** Yes.
**Documentation correct?** No (inconsistent with sibling DTO).
**Recommendation** Either drop the label from related DTOs (consistency) or add it here.
**Suggested fix** Decide between unifying on a `percentileLabel` field across DTOs or removing it everywhere except the top-level `/me` response.
**Safety classification** Additive, safe.

---

### L-18 · Low · `POST /admin/ranking/reset`

**Current behavior**
Code branches on `query.period`: if absent, calls `performDailyReset` / `performWeeklyReset` / `performMonthlyReset` (each only fires at the right UTC time, otherwise logs a skip and returns 0).

**Documented behavior**
Description: "Otherwise resets all due periods (daily, weekly, monthly)."

**Root cause**
`performWeeklyReset` and `performMonthlyReset` short-circuit unless it is exactly the reset time, so calling `/admin/ranking/reset` mid-week returns 200 with 0 users affected — the description promises more than the implementation delivers.

**Implementation correct?** Yes.
**Documentation correct?** No (overpromises).
**Recommendation** Document the conditional behavior or expose an explicit `force` flag.
**Suggested fix**
Document that the no-arg path is a "trigger the scheduled resets if due" operation, and offer a separate `force` flag (or use `forceReset` internally) for an unconditional reset.
**Safety classification** Documentation only.

---

### L-19 · Low · `GET /leaderboard/me/history`

**Current behavior**
Endpoint accepts `period`, `from`, `to`. No `limit` / `offset` / `cursor`. The OpenAPI schema declares `WrappedPaginatedDto` with a `pagination` object.

**Documented behavior**
OpenAPI schema implies cursor pagination. Controller description does not mention any pagination.

**Root cause**
Same as L-05 — `@ApiOkResourceList` was applied without ever wiring a cursor / offset.

**Implementation correct?** No (no actual pagination).
**Documentation correct?** No (implies pagination that does not exist).
**Recommendation** Add real pagination or remove the wrapper.

**Suggested fix**
- Option A: introduce `limit` / `offset` and a `hasMore` response field.
- Option B: document the endpoint as bounded by the snapshot interval (no pagination) and remove the paginated wrapper. Resolve together with L-05.

**Safety classification** Documentation change is safe. Adding pagination is additive (default `limit` = current behavior).

---

### L-20 · Low · `POST /admin/ranking/consistency-check`

**Current behavior**
`ConsistencyReportIssueDto.severity: string`. Actual runtime values: `'high'`, `'medium'`, `'low'`, ... (per `rankCalculation.service`).

**Documented behavior**
Plain `string`. No enum constraint.

**Root cause**
`@ApiProperty({ type: String })` with no enum.

**Implementation correct?** Yes.
**Documentation correct?** No (no enum constraint).
**Recommendation** Replace with an enum.
**Suggested fix**
Replace with an enum (`'low' | 'medium' | 'high' | 'critical'`) and validate at the boundary. Update generated SDK.
**Safety classification** Documentation tightening. Existing payloads stay valid.

---

## Prioritization & Migration Plan

Phases are ordered to (1) restore the running API, (2) tighten the contract without breaking the wire format, (3) clean up documentation. Each phase is independently mergeable.

### Phase 1 — Restore runtime: fix the four Critical implementation bugs

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issues           | L-01, L-02, L-03, L-04                                                                             |
| Goal             | Make every documented leaderboard endpoint return 200 / 4xx for valid input. No public contract changes. |
| Reason           | Today the global leaderboard, public user rank lookup, nearby ranks, and manual period reset all return 500. Every other audit step depends on these endpoints being functional. |
| Dependencies     | None.                                                                                              |
| Complexity       | Medium                                                                                             |
| Risk             | Low                                                                                                |
| Breaking change? | No                                                                                                 |
| Migrations / DB  | No schema changes. Only SQL fixes in the repository.                                              |
| Tests            | Add integration tests: valid UUID for `:userId` → 200, invalid UUID → 400, public leaderboard → 200, admin reset with seeded users → 200. |

### Phase 2 — Validation hardening: UUID + enum consistency

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issues           | L-10, L-07, L-13                                                                                   |
| Goal             | Reject invalid input at the boundary and stop echoing the wrong `period` in responses.             |
| Reason           | Even after L-02 fixes the public endpoints, request bodies and other query parameters accept free-form strings. Consistency with `api.md` requires UUID / date validation across the module. |
| Dependencies     | Phase 1 must land first (otherwise the validator still accepts the values that later fail at the database). |
| Complexity       | Low                                                                                                |
| Risk             | Low                                                                                                |
| Breaking change? | Possibly (L-07)                                                                                    |
| Migrations / DB  | None.                                                                                              |
| L-07 deprecation plan | Removing `daily` from `LeaderboardQueryDto` is a client breaking change. Announce a 30-day deprecation, return 400 with a `Deprecation` header first, then remove. |

### Phase 3 — Response DTO / serialization cleanup

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issues           | L-12, L-15, L-17                                                                                   |
| Goal             | Make `UserRankSummaryDto`, `UserRankResponseDto.peakRanks`, and `UserPercentileResponseDto` internally consistent. |
| Reason           | The DTOs carry dead / duplicated fields that confuse generated SDKs and force frontend workarounds. |
| Dependencies     | None.                                                                                              |
| Complexity       | Low                                                                                                |
| Risk             | Low                                                                                                |
| Breaking change? | No (additive)                                                                                      |

### Phase 4 — OpenAPI / Swagger documentation fixes

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Issues             | L-05, L-09, L-11, L-14, L-18, L-19, L-20                                                       |
| Goal               | Make the generated `openapi.json` match the wire format and the intended enums, and fix misleading descriptions. |
| Dependencies       | Phase 3 should land first so response DTOs are stable before SDK regeneration.                 |
| Complexity         | Medium                                                                                         |
| Risk               | Medium                                                                                         |
| Breaking change?   | Possible (SDK regen)                                                                           |
| Generated SDK      | Regenerate Orval / openapi-generator output. Frontend repos will need a coordinated bump.      |

### Phase 5 — Authorization behavior + consistency polish

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issues           | L-06, L-08, L-16                                                                                   |
| Goal             | Either implement optional auth on `GET /leaderboard` so `userPosition` actually populates, or remove the misleading claim from the description. Align rank-direction vocabulary. |
| Dependencies     | None.                                                                                              |
| Complexity       | Medium                                                                                             |
| Risk             | Low                                                                                                |
| Breaking change? | Depends (L-16)                                                                                     |
| L-16 deprecation plan | Unifying the direction / trend enum is a breaking client change. Pick one vocabulary, add a deprecation alias for the old values, remove after one release. |

### Phase 6 — Consistency & low-priority cleanup

| Field            | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issues           | (residual low-priority items)                                                                      |
| Goal             | Tidy up the residual items: shared `ErrorResponseExamples` for leaderboard, decorative formatting in admin descriptions, and a one-line note on `forceReset` semantics for ops. |
| Complexity       | Low                                                                                                |
| Risk             | Low                                                                                                |
| Breaking change? | No                                                                                                 |

---

## Implementation Strategy

- Each phase is designed to be a single reviewable PR. Avoid bundling unrelated fixes.
- Run `pnpm generate:openapi` after every DTO change so the Swagger UI and SDK stay in sync.
- Schema changes (none proposed here) must wait for ADR review; Phase 1 is SQL-only.
- Phase 2's L-07 change is the only backward-incompatible fix that affects external clients; communicate with the frontend team and announce a deprecation window.
- Phase 4 may require regenerating generated SDKs (Orval / openapi-generator) and bumping the frontend package; coordinate the SDK regen with a release branch.

---

## Migration Safety Classification

| Fix | Type                                | Notes                                                |
| --- | ----------------------------------- | ---------------------------------------------------- |
| L-01 | Safe implementation fix            | SQL-only. No contract change.                        |
| L-02 | Safe implementation + docs fix     | No contract change for valid UUIDs.                  |
| L-03 | Safe implementation fix            | No contract change.                                  |
| L-04 | Safe implementation fix            | No contract change.                                  |
| L-05 | Safe documentation fix (option A)  | Generated SDK shape may change; coordinate.          |
| L-06 | Safe documentation fix (option A)  | Or additive behavior change (option B).               |
| L-07 | Breaking client contract           | Deprecate `daily` over one release window.            |
| L-08 | Safe documentation fix             | -                                                    |
| L-09 | Safe documentation fix             | -                                                    |
| L-10 | Safe documentation + hardening     | Hardening is additive.                                |
| L-11 | Safe documentation fix             | Generated SDK may get stricter TS types.              |
| L-12 | Safe documentation fix             | Or internal-only implementation change.              |
| L-13 | Safe implementation fix            | Additive change.                                     |
| L-14 | Safe documentation fix             | -                                                    |
| L-15 | Additive change                    | Strict subset, non-breaking.                          |
| L-16 | Breaking client contract           | Requires deprecation window / product decision.      |
| L-17 | Additive, safe                     | -                                                    |
| L-18 | Safe documentation fix             | -                                                    |
| L-19 | Safe documentation fix (option A)  | Or additive pagination (option B).                   |
| L-20 | Safe documentation fix             | Existing payloads remain valid.                       |

---

## Appendix A — Endpoints Inventoried

| # | Method | Path                                  | Auth                              | Notes |
| - | ------ | ------------------------------------- | --------------------------------- | ----- |
| 1 | GET    | `/leaderboard`                        | Public (`@Public()`)              | `getGlobalLeaderboard` |
| 2 | GET    | `/leaderboard/distribution`           | Public                            | `getLeaderboardDistribution` |
| 3 | GET    | `/leaderboard/top-movers`             | Public                            | `getTopMovers` |
| 4 | GET    | `/leaderboard/me`                     | `JwtGuard`                        | `getMyRank` |
| 5 | GET    | `/leaderboard/me/rank`                | `JwtGuard`                        | `getMyRankForPeriod` |
| 6 | GET    | `/leaderboard/me/percentile`          | `JwtGuard`                        | `getMyPercentile` |
| 7 | GET    | `/leaderboard/me/milestones`          | `JwtGuard`                        | `getMyRankingMilestones` |
| 8 | GET    | `/leaderboard/me/nearby`              | `JwtGuard`                        | `getNearbyRanks` |
| 9 | GET    | `/leaderboard/me/movement`            | `JwtGuard`                        | `getMyRankMovement` |
| 10 | GET   | `/leaderboard/me/peak-ranks`          | `JwtGuard`                        | `getMyPeakRanks` |
| 11 | GET   | `/leaderboard/me/history`             | `JwtGuard`                        | `getMyRankingHistory` |
| 12 | GET   | `/leaderboard/:userId`                | Public                            | `getUserRank` |
| 13 | GET   | `/leaderboard/:userId/history`        | Public                            | `getUserRankingHistory` |
| 14 | GET   | `/leaderboard/:userId/rank`           | Public                            | `getUserRankForPeriod` |
| 15 | GET   | `/admin/ranking/status`               | `PermissionsGuard` + `RANKING_ADMIN` | `getStatus` |
| 16 | POST  | `/admin/ranking/recalculate`          | `PermissionsGuard` + `RANKING_ADMIN` | `triggerRecalculation` |
| 17 | POST  | `/admin/ranking/reset`                | `PermissionsGuard` + `RANKING_ADMIN` | `triggerPeriodReset` |
| 18 | POST  | `/admin/ranking/consistency-check`    | `PermissionsGuard` + `RANKING_ADMIN` | `triggerConsistencyCheck` |

> Three additional leaderboard-shaped endpoints exist outside this module (`/instances/:id/leaderboard` in `instance`, `/tournaments/:id/leaderboard` in `tournament`, `/friends/:id/leaderboard` in `social`). They are out of scope for this audit.

---

## Appendix B — Live Runtime Evidence

Selected curl probes against the running NestJS instance on `localhost:8080`. All status codes reproduced.

```text
==GET /leaderboard (public, all_time, limit=3)==          STATUS=500  (column u.display_name does not exist)
==GET /leaderboard?period=daily==                          STATUS=500  (column u.display_name does not exist)
==GET /leaderboard?period=invalid==                        STATUS=400  (period must be one of: daily, weekly, monthly, all_time)
==GET /leaderboard?limit=999==                             STATUS=400  (limit must not be greater than 500)
==GET /leaderboard?offset=-1==                             STATUS=400  (offset must not be less than 0)
==GET /leaderboard?limit=abc==                             STATUS=400  (limit must not be greater than 500; limit must not be less than 1; limit must be an integer number)
==GET /leaderboard/distribution==                          STATUS=200  {"data":{"totalUsers":2,"remainingUsers":0,"buckets":[{"label":"Top 10","count":2}]},"meta":{"timestamp":"..."}}
==GET /leaderboard/top-movers==                            STATUS=200  {"data":[],"meta":{"timestamp":"..."}}
==GET /leaderboard/top-movers?limit=999==                  STATUS=400  (limit must not be greater than 100)
==GET /leaderboard/top-movers?period=invalid==             STATUS=400  (period must be one of: daily, weekly, monthly, all_time)
==GET /leaderboard/not-a-uuid==                            STATUS=500  (invalid input syntax for type uuid: "not-a-uuid")
==GET /leaderboard/1000/history==                         STATUS=500  (invalid input syntax for type uuid: "1000")
==GET /leaderboard/1000/rank==                             STATUS=500  (invalid input syntax for type uuid: "1000")
==GET /leaderboard/me (no auth)==                          STATUS=401  (Authorization header is missing)
==GET /leaderboard/me/rank (no auth)==                     STATUS=401
==GET /leaderboard/me/percentile?period=invalid==          STATUS=400
==GET /leaderboard/me/milestones (auth)==                  STATUS=200  {"data":[{"milestone":"TOP_10","rank":1,"achievedAt":"..."}],"meta":{...}}
==GET /leaderboard/me/nearby==                             STATUS=500  (syntax error at or near "current_user")
==GET /leaderboard/me/nearby?radius=99==                   STATUS=400  (radius must not be greater than 10)
==GET /leaderboard/me/movement?period=invalid==            STATUS=400
==GET /leaderboard/me/peak-ranks==                         STATUS=200  {"data":{"daily":{"rank":1,...},"weekly":{...},...},"meta":{...}}
==GET /leaderboard/me/history==                            STATUS=200  {"data":[],"meta":{"timestamp":"..."}}
==GET /leaderboard/me/history?from=2026-12-01&to=2026-01-01== STATUS=400  (from date must be before or equal to the to date)
==GET /leaderboard/me/history?from=not-a-date==            STATUS=400  (from must be a valid ISO 8601 date string)
==GET /admin/ranking/status (no auth)==                    STATUS=401
==GET /admin/ranking/status (with user)==                 STATUS=403  (You do not have permission to access this resource)
==GET /admin/ranking/status (with admin)==                 STATUS=200  {"data":{"schedulerRunning":true,"dirtyQueueSize":0,...}}
==POST /admin/ranking/recalculate (user)==                 STATUS=403
==POST /admin/ranking/recalculate (admin)==                STATUS=200  {"data":{"message":"Recalculation triggered for all periods"},"meta":{...}}
==POST /admin/ranking/reset?period=invalid (admin)==       STATUS=400
==POST /admin/ranking/reset (admin)==                      STATUS=500  (RANKING_PERIOD_RESET_ERROR; SQL: where  > 0)
==POST /admin/ranking/consistency-check (admin)==          STATUS=200  {"data":{"totalIssues":1,"fixed":1,"issues":[{"type":"xp_mismatch","description":"2 users have XP mismatches","severity":"high"}]}}
```

---

## Appendix C — Files Inspected

- `src/modules/ranking/transport/controller/ranking.controller.ts`
- `src/modules/ranking/transport/controller/ranking-admin.controller.ts`
- `src/modules/ranking/transport/presenters/ranking.presenter.ts`
- `src/modules/ranking/domain/services/leaderboard.service.ts`
- `src/modules/ranking/domain/services/user-rank.service.ts`
- `src/modules/ranking/domain/services/period-reset.service.ts`
- `src/modules/ranking/domain/ports/ranking-repository.port.ts`
- `src/modules/ranking/application/ranking.application.service.ts`
- `src/modules/ranking/application/get-nearby-ranks.query.ts`
- `src/modules/ranking/infrastructure/repositories/ranking.repository.ts`
- `src/modules/ranking/dto/request/leaderboard-query.dto.ts`
- `src/modules/ranking/dto/request/ranking-admin-query.dto.ts`
- `src/modules/ranking/dto/response/leaderboard-entry.dto.ts`
- `src/modules/ranking/dto/response/leaderboard-response.dto.ts`
- `src/modules/ranking/dto/response/leaderboard-stats.dto.ts`
- `src/modules/ranking/dto/response/leaderboard-history.dto.ts`
- `src/core/database/schema/auth/schema.ts`
- `src/core/database/schema/ranking/schema.ts`
- `src/commands/seed/development/ranking.seed.ts`
- `src/commands/seed/foundation/user.seed.ts`
- `src/common/guards/jwt.guard.ts` (referenced)
- `src/common/responses/api-response.ts` (referenced)
- `docs/generated/openapi.json`
- `docs/modules/ranking.md`
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/api.md`
- `docs/standards/validation.md`
- `docs/standards/swagger.md`
- `docs/architecture/authorization-flow.md`
- `docs/adr/0004-pagination-strategy.md`