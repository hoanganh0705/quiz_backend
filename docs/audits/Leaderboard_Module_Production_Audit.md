# Leaderboard Module Production-Readiness Audit

**Module:** `ranking` (leaderboard endpoints)  
**Audited:** July 28, 2026  
**Status:** Production-ready with findings below

---

## Executive Summary

The ranking/leaderboard module is well-architected with proper separation of concerns, RFC 7807 error handling, caching with stampede protection, and consistent DTO design. The audit identified **5 findings** — 1 high-severity unused method, 2 medium-severity inconsistencies, and 2 low-severity improvements. No critical security issues or architectural problems were found.

---

## 1. Unused Public Rank Method — Remove Dead Code

**Category:** Maintainability / Dead Code  
**Severity:** High  
**Location:** `src/modules/ranking/domain/services/user-rank.service.ts`, lines 132–148

### Current Behavior

```typescript
async getPublicUserRank(userId: string): Promise<{
  rank: number;
  period: RankingPeriod;
  xp: number;
  displayName: string;
} | null> {
  const rankingWithUser = await this.rankingRepository.getUserRankingWithUser(userId);
  if (!rankingWithUser) return null;
  return {
    rank: rankingWithUser.allTimeRank ?? 0,  // ← Returns 0 when null
    period: RankingPeriod.ALL_TIME,
    xp: rankingWithUser.allTimeXp,
    displayName: rankingWithUser.displayName || rankingWithUser.username,
  };
}
```

### Problem

- The method is never called from any controller or service (`grep` confirms no references)
- If this was intended for a public user rank endpoint (`GET /leaderboard/:userId/public`), it was never wired up
- Returns `rank: 0` when `allTimeRank` is `null`, a misleading value that could be confused with rank #1

### Recommendation

Remove the method entirely. If a public minimal rank view is needed in the future, it should be designed and implemented as a complete feature.

### Implementation

**Phase 1 — Remove Dead Code**

1. Delete `getPublicUserRank` method from `UserRankService`
2. Verify no test files reference this method
3. Commit with message: `refactor(ranking): remove unused getPublicUserRank dead code`

**Breaking change risk:** None — no consumers exist.

---

## 2. Unused Deprecated DTO — Remove Migration Artifact

**Category:** Maintainability / Dead Code  
**Severity:** Medium  
**Location:** `src/modules/ranking/dto/response/leaderboard-entry.dto.ts`, lines 159–190

### Current Behavior

```typescript
/**
 * @deprecated Use `PeakRanksResponseDto` instead.
 * This number-only shape was replaced by the richer `{ rank, achievedAt }`
 * shape so that `/leaderboard/me` and `/leaderboard/me/peak-ranks` expose
 * the same data structure. Kept temporarily for backwards compatibility.
 *
 * @see PeakRanksResponseDto
 */
export class PeakRanksDto {
  weekly!: number | null;
  monthly!: number | null;
  allTime!: number | null;
}
```

### Problem

- Marked `@deprecated` but has no consumers (`grep` confirms zero imports)
- The migration to `PeakRanksResponseDto` is complete — this is a leftover artifact
- Adds noise and maintenance burden

### Recommendation

Remove `PeakRanksDto` entirely.

### Implementation

**Phase 1 — Remove Deprecated DTO**

1. Delete `PeakRanksDto` class from `leaderboard-entry.dto.ts`
2. Delete associated JSDoc comment referencing it
3. Verify `index.ts` barrel exports do not include it (they don't)
4. Commit with message: `refactor(ranking): remove unused PeakRanksDto migration artifact`

**Breaking change risk:** None — no consumers exist.

---

## 3. TopMoversQueryDto Period Enum — Document or Expand

**Category:** API Design / Developer Experience  
**Severity:** Medium  
**Location:** `src/modules/ranking/dto/request/leaderboard-query.dto.ts`, lines 109–131

### Current Behavior

```typescript
export class TopMoversQueryDto {
  @ApiPropertyOptional({
    description: 'Top movers period',
    enum: [LeaderboardPeriodEnum.WEEKLY, LeaderboardPeriodEnum.MONTHLY],
    default: LeaderboardPeriodEnum.WEEKLY,
  })
  @IsEnum(LeaderboardPeriodEnum)
  @IsOptional()
  period?: LeaderboardPeriodEnum = LeaderboardPeriodEnum.WEEKLY;
}
```

### Problem

1. Inline enum restriction `[WEEKLY, MONTHLY]` prevents `all_time` and `daily` — but why?
2. No documented rationale for the exclusion
3. Frontend developers calling `GET /leaderboard/top-movers?period=all_time` get a cryptic 400 validation error
4. The pattern is inconsistent with other leaderboard query DTOs that accept the full `LeaderboardPeriodEnum`

### Recommendation

Either:

**Option A (recommended):** Expand to include `ALL_TIME` since "top movers of all time" is a valid use case:

```typescript
export enum TopMoversPeriodEnum {
  WEEKLY = LeaderboardPeriodEnum.WEEKLY,
  MONTHLY = LeaderboardPeriodEnum.MONTHLY,
  ALL_TIME = LeaderboardPeriodEnum.ALL_TIME,
}
```

**Option B:** Keep the restriction but document the rationale in the description.

### Implementation

**Phase 2 — Improve TopMovers Period Validation**

1. Define `TopMoversPeriodEnum` to match the established pattern (`LeaderboardPeriodEnum` restricting `RankingPeriodEnum.DAILY`):
   ```typescript
   export enum TopMoversPeriodEnum {
     WEEKLY = LeaderboardPeriodEnum.WEEKLY,
     MONTHLY = LeaderboardPeriodEnum.MONTHLY,
     ALL_TIME = LeaderboardPeriodEnum.ALL_TIME,
   }
   ```

2. Update `TopMoversQueryDto.period` to use the new enum with improved description:
   ```typescript
   @ApiPropertyOptional({
     description: 'Top movers period. Only weekly, monthly, and all-time are supported.',
     enum: TopMoversPeriodEnum,
     default: TopMoversPeriodEnum.WEEKLY,
   })
   @IsEnum(TopMoversPeriodEnum)
   ```

3. Update `GetTopMoversQueryHandler` to accept `TopMoversPeriodEnum` (or add mapping function)

4. Commit with message: `feat(ranking): add ALL_TIME support to top-movers period with TopMoversPeriodEnum`

**Breaking change risk:** Low — adds new valid value, does not remove existing ones.

---

## 4. Swagger Tag Singular vs. Plural — Standardize Convention

**Category:** Cross-Module Consistency / Naming  
**Severity:** Low  
**Location:**
- `src/modules/ranking/transport/controller/ranking.controller.ts`, line 137
- `src/modules/ranking/transport/controller/ranking-admin.controller.ts`, line 83

### Current Behavior

```typescript
@ApiTags('leaderboard')  // Singular
```

### Problem

Most other modules use plural tags:
- `'achievements'`, `'reviews'`, `'comments'`, `'bookmarks'`, `'tournaments'`, `'categories'`, `'notifications'`, `'quizzes'`

### Recommendation

Rename to `@ApiTags('leaderboards')` for consistency.

### Implementation

**Phase 3 — Standardize Swagger Tags**

1. Update `ranking.controller.ts`:
   ```typescript
   @ApiTags('leaderboards')
   ```

2. Update `ranking-admin.controller.ts`:
   ```typescript
   @ApiTags('leaderboards')
   ```

3. Update any related test files or OpenAPI spec generators that reference the tag name

4. Commit with message: `style(ranking): use plural 'leaderboards' tag for Swagger consistency`

**Breaking change risk:** Low — Swagger/OpenAPI consumers referencing by tag may need to update.

---

## 5. Inline Enum Restriction — Use Typed Enum

**Category:** Maintainability / Code Quality  
**Severity:** Low  
**Location:** `src/modules/ranking/dto/request/leaderboard-query.dto.ts`, line 112

### Current Behavior

```typescript
enum: [LeaderboardPeriodEnum.WEEKLY, LeaderboardPeriodEnum.MONTHLY],
```

### Problem

1. Not reusable — cannot be used elsewhere
2. Less type-safe — bypasses TypeScript's enum type checking
3. Harder to maintain — adding a new valid period requires editing inline array

### Recommendation

This is addressed by the fix in **Finding #3** (Phase 2). If `TopMoversPeriodEnum` is created, this inline restriction will be replaced with the proper typed enum.

### Implementation

Integrated with Phase 2.

---

## Implementation Phases Summary

### Phase 1: Dead Code Cleanup (Low Risk)

| Task | File | Action |
|------|------|--------|
| Remove `getPublicUserRank` method | `user-rank.service.ts` | Delete lines 132–148 |
| Remove `PeakRanksDto` class | `leaderboard-entry.dto.ts` | Delete lines 159–190 + JSDoc |

**Estimated effort:** 30 minutes  
**Risk:** None

---

### Phase 2: TopMovers Period Improvement (Low Risk)

| Task | File | Action |
|------|------|--------|
| Define `TopMoversPeriodEnum` | `leaderboard-query.dto.ts` | Add new enum |
| Update `TopMoversQueryDto.period` | `leaderboard-query.dto.ts` | Use new enum with improved description |
| Add mapping function if needed | `get-top-movers.query.ts` | Accept new enum |

**Estimated effort:** 1 hour  
**Risk:** None (additive change)

---

### Phase 3: Swagger Tag Standardization (Low Risk)

| Task | File | Action |
|------|------|--------|
| Update `ranking.controller.ts` tag | `ranking.controller.ts` | `'leaderboard'` → `'leaderboards'` |
| Update `ranking-admin.controller.ts` tag | `ranking-admin.controller.ts` | `'leaderboard'` → `'leaderboards'` |
| Update any test references | Various | Search and update |

**Estimated effort:** 30 minutes  
**Risk:** Low — consumer may need to update tag references

---

## Positive Observations (No Changes Needed)

The following aspects are well-implemented and should be preserved:

| Area | Observation |
|------|-------------|
| **Caching** | `getOrSetWithStampedeProtection` with appropriate TTLs prevents thundering herd |
| **UUID validation** | `ParseUUIDPipe({ version: '7' })` rejects invalid input at boundary |
| **Error handling** | RFC 7807 with `RANKING_*` codes via global exception filter |
| **Period abstraction** | `RankingPeriodEnum` / `LeaderboardPeriodEnum` properly separate concerns |
| **Trend naming** | `RankTrend` with `up`/`down`/`same`/`new` is semantically clear |
| **Domain architecture** | Clear separation: domain services, application services, repositories, controllers |
| **Null responses** | Unknown users return ghost responses, not 404s — appropriate for public endpoints |
| **Pagination** | Offset-based with `limit`/`offset` correctly documented |

---

## Out of Scope

- **Security**: No SQL injection (parameterized queries), no auth bypasses, admin endpoints properly guarded
- **HTTP status codes**: Correct usage (200 for reads)
- **Response envelope**: All responses correctly wrapped in `ApiResponse.ok()` format
- **Repository**: SQL queries well-documented with tie-handling comments
