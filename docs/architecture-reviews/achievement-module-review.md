# Achievement Module Architecture Review

> Review Date: Thursday, Jul 23, 2026
> Reviewer: Principal Software Architect
> Module: Achievement

---

## Executive Summary

**Overall Score: 5.5/10**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Architecture | 7/10 | Follows project conventions, but infrastructure leaks into domain |
| Product Design | 5/10 | Core features work, but significant stub methods |
| Business Modeling | 6/10 | Badge grant/revoke modeled correctly, but history mechanism missing |
| Domain Modeling | 6/10 | Services exist but many are non-functional stubs |
| API Design | 5/10 | Inconsistent pagination, DTO naming issues |
| Concurrency | 6/10 | Race conditions handled via DB constraints, but in-memory cache is problematic |
| Scalability | 5/10 | In-memory caching, no distributed cache invalidation |
| Maintainability | 6/10 | Code organization is clear, but stub code is misleading |
| Extensibility | 6/10 | Rule engine pattern is extensible, but deferred evaluation is broken |
| Business Alignment | 5/10 | Core workflow exists, but many documented features are unimplemented |

---

## Major Strengths

1. **Robust Database Design** - The `badges`, `userBadges`, and `badgeRules` tables are well-structured with proper indexes, foreign keys, and partial unique constraints preventing duplicate awards.

2. **Clean Event Architecture** - The three-layer event system (domain bus, shared bus, outbox) follows the project ADR-0014 correctly. The `AchievementOutboxProcessorService` implements proper retry with exponential backoff.

3. **Correct Error Handling** - Domain exceptions follow the RFC 7807 pattern with proper `ProblemCodeMapping` entries. Error codes are well-structured (`ACHIEVEMENT_*`, `BADGE_*`, `USER_BADGE_*`).

4. **Transaction Safety** - Badge awards and outbox writes happen atomically within the same transaction.

5. **Idempotency** - The outbox processor handles idempotency conflicts gracefully with `onConflictDoNothing` and skip-on-duplicate logic.

---

## Major Weaknesses

1. **Non-functional Deferred Evaluation** - `ScheduledEvaluationService.evaluateBadge()` contains a TODO and empty `eligibleUsers` array, making all deferred badge evaluation broken.

2. **Stub Application Services** - At least 8 methods return hardcoded empty arrays, `null`, or `0` values, making them non-functional:
   - `getHistoryEntry()`, `wasBadgePreviouslyRevoked()`, `getRecentAwards()`, `getAwardsByCategory()` in `AchievementHistoryService`
   - `getPlatformStats()` with `uniqueEarners = 0`
   - `getTrendAnalysis()` returns empty arrays
   - `getBadgeRevocationHistory()`, `reverseRevocation()` stubs
   - `getTopEarners()` returns empty array

3. **Missing Achievement History Table** - Documentation describes an `achievement_history` table for immutable audit logs, but implementation derives history from `userBadges.revokedAt`. This cannot capture grant-only events.

4. **In-Memory Cache Without Invalidation** - `RuleEngineService` caches badge definitions for 60 seconds. In multi-instance deployments, badge updates won't propagate immediately.

5. **Inconsistent Pagination** - Controllers return bare arrays while project standard expects `{ items: T[], total: number }` for paginated endpoints.

---

## Consistency Analysis

### Project Rules → Documentation → Implementation → Tests

| Finding | Classification | Impact |
|---------|---------------|--------|
| `achievement_history` table documented but not implemented | Documentation outdated | Cannot create immutable audit log of grants without revocations |
| Pagination returns bare arrays instead of `{ items, total }` | Implementation bug | Inconsistent with project API standard |
| `uniqueEarners` hardcoded to `0` in `getPlatformStats()` | Implementation bug | Analytics return incorrect data |
| No achievement module spec files except `achievement.errors.spec.ts` | Missing tests | Core functionality untested |
| `BadgeType` enum values (`rank1`, `streak_7`) used as badge IDs in code | Product ambiguity | Type system and data model mismatch |
| In-memory cache in `RuleEngineService` | Architecture inconsistency | No distributed cache invalidation mechanism |

---

## Product Review

**From a real user's perspective:**

### What Works
- Viewing badge catalog
- Viewing my badges
- Badge progress tracking
- Badge revocation

### What Doesn't Work
- Deferred badge evaluation (broken)
- Badge history queries (mostly stubs)
- Platform analytics (broken with `uniqueEarners = 0`)

### What's Confusing
- The `BadgeType` enum has string values like `'rank1'` but badges use UUID v7 IDs

### Missing from User's Perspective
- Real-time badge notification delivery status
- Clear explanation of badge rarity tiers
- Badge expiration mechanics

---

## Business Workflow Review

### State Machine

```
User Activity (attempt, ranking, streak, tournament)
         ↓
Event Listener Adapter (attempts, ranking, tournament, etc.)
         ↓
RuleEngineService.evaluateEvent() OR RankAchievementService.checkRankAchievements()
         ↓
┌────────┴────────┐
↓                 ↓
hasBadge?      conditionMet?
↓                 ↓
[awardBadge]    [skip]
         ↓
    ┌────┴────┐
    ↓         ↓
[outbox write] [domain event]
    ↓
[return]
```

### Transitions

| Transition | Trigger | Action |
|-----------|---------|--------|
| User earns badge | Condition met | Grant in `userBadges` + outbox event |
| Admin revokes badge | Permission check | Sets `revokedAt` + outbox event |
| Deferred evaluation runs | Cron job | **BROKEN** - empty eligible users |

---

## Domain Review

### Aggregates

#### Badge (Catalog)
- **Owns:** badge metadata, rule associations
- **Correctly models:** name, description, icon, rarity, validity windows

#### UserBadge (Awarded Badge Instance)
- **Owns:** user-badge relationship, grant metadata
- **Correctly enforces:** unique constraint on `(userId, badgeId)` where `revokedAt IS NULL`

### Value Objects

#### BadgeType
- **Issue:** Enum values like `RANK_1 = 'rank1'` don't match UUID-based badge IDs used in practice.

#### RuleConfig
- **Well-structured** with `metric`, `threshold`, `operator`, `period`.

### Repositories

#### AchievementRepositoryPort
- **Well-defined port interface.** Implementation handles:
  - Idempotent badge awards
  - Partial unique constraint for active badges
  - Proper indexing strategy
  - Transactional outbox writes

### Domain Services

#### RuleEngineService
- **Functional but with in-memory caching risk:**
  ```typescript
  export class RuleEngineService {
    private badgeDefinitionsCache: Map<string, BadgeDefinitionRow> = new Map();
    private rulesCache: Map<string, BadgeRuleRow[]> = new Map();
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL_MS = 60_000; // 1 minute
  ```

#### BadgeRevocationService
- **Well-structured** with proper validation and audit trail support.

#### ScheduledEvaluationService
- **BROKEN** - `evaluateBadge()` method contains empty `eligibleUsers` array.

---

## API Review

### Endpoint Analysis

| Endpoint | Method | Issue |
|----------|--------|-------|
| `/achievements/badges` | GET | Returns bare array instead of `{ items, total }` |
| `/achievements/me/badges` | GET | Returns bare array instead of `{ items, total }` |
| `/achievements/users/:userId/badges/:badgeId` | DELETE | Returns void, no response body |
| `/achievements/me/badges/analytics` | GET | Returns `{ totalBadges, rareBadges, completionRate, latestBadgeEarnedAt }` |
| `/achievements/me/badges/:badgeId/progress` | GET | Returns progress object |
| `/achievements/me/achievements/history` | GET | Returns history array |
| `/admin/achievements/reevaluate/:userId` | POST | Returns reevaluation result |
| `/admin/achievements/reevaluate/:userId/history` | GET | Returns admin history |

### DTO Issues

#### BadgeCatalogItemResponseDto.id
Documentation says `id!: string` with example `'top_10'` but database uses UUID v7:

```typescript
export class BadgeCatalogItemResponseDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  id!: string;
}
```

#### Presenter Returns Bare Arrays
```typescript
readonly getBadgeCatalog = (items: BadgeCatalogItemResponseDto[]) => ApiResponse.ok([...items]);
readonly getMyBadges = (items: MyBadgeItemDto[]) => ApiResponse.ok([...items]);
```

**Project standard requires `{ items: T[], total: number }` for paginated endpoints.**

---

## Concurrency Review

### Protected Scenarios

| Scenario | Protection | Evidence |
|---------|-----------|----------|
| Duplicate Badge Awards | Partial unique constraint | `uq_user_badges_user_badge_active` |
| Outbox Idempotency | onConflictDoNothing | `achievement.repository.impl.ts:146-149` |
| Badge Revocation | WHERE includes revokedAt IS NULL | `achievement.repository.impl.ts:534` |

### Unprotected Scenarios

| Scenario | Risk Level | Description |
|----------|------------|-------------|
| Rule Engine Cache Stampede | Medium | On cache expiry, multiple concurrent requests refresh simultaneously |
| In-Memory State | High | Badge/rule changes take up to 60 seconds to propagate across instances |

---

## Scalability Review

| Concern | Assessment | Evidence |
|---------|-----------|----------|
| Repository queries | Properly indexed; no N+1 in batch methods | `getBadgeEarnersCounts()` |
| Caching | In-memory only; no Redis or distributed cache | `RuleEngineService` |
| Pagination | Offset-based with proper LIMIT/OFFSET | Repository methods |
| Event publishing | Uses outbox pattern for durability | `AchievementOutboxProcessorService` |
| Background jobs | Cron-based with stagger delay | `ScheduledEvaluationService` |

**Risk:** In-memory cache in `RuleEngineService` won't scale across multiple instances without distributed cache invalidation.

---

## Maintainability Review

### Positives
- Clean folder structure following project conventions
- Well-commented code with design rationale
- Consistent error handling pattern
- TypeScript interfaces for all domain concepts

### Negatives
- Stub methods are misleading without clear documentation
- `TODO` comment in production code without tracking issue
- Multiple methods return `Promise.resolve([])` making them hard to distinguish from intentional empty results

---

## Architecture Consistency Review

### Following Project Conventions
- Layered architecture (domain/application/infrastructure/transport)
- Symbol-typed ports
- Domain event bus pattern
- Outbox pattern for at-least-once delivery
- RFC 7807 error handling
- Presenters wrapping responses

### Deviating from Conventions
- Pagination returns bare arrays instead of `{ items, total }`
- In-memory cache instead of Redis
- Missing achievement module OpenAPI spec tests

---

## Missing Product Capabilities

### Required Fixes

| Capability | Why Required | Evidence |
|------------|--------------|----------|
| Deferred badge evaluation | Deferred badges never get awarded | `eligibleUsers: string[] = []` in `evaluateBadge()` |
| Fix `uniqueEarners = 0` | Platform analytics are broken | Line 161 in `getPlatformStats()` |
| Consistent pagination | API inconsistency | Controllers return bare arrays |

### Product Discussion

| Capability | Why Needs Discussion |
|-----------|---------------------|
| Achievement history table | Currently history is derived from revoked records; cannot capture grants-only |
| XP reward computation | Documentation says "XP computation (Ranking module)" but no evidence in code |

### Future Product

| Capability | Why Future |
|-----------|------------|
| Badge rarity tiers | Documentation mentions "not yet modeled" |
| Seasonal badges | Documentation mentions "badge grant windows are not time-constrained" |
| Time-to-earn analytics | `averageTimeToEarn: 0` hardcoded |

### YAGNI

| Capability | Why YAGNI |
|-----------|-----------|
| `calculateEarningVelocity()` | No consumer exists |
| `getTimeToNextMilestone()` | No API endpoint calls this |

---

## Final Verdict

| Recommendation | Decision | Rationale |
|----------------|----------|----------|
| Deferred badge evaluation | **Product Discussion Required** | The scheduled evaluation infrastructure exists but is broken. Before fixing, product must clarify: which badge types should use deferred evaluation vs immediate? |
| Analytics stubs | **Merge Immediately** | These are internal analytics methods with no external consumers. Can be fixed post-merge. |
| Pagination consistency | **Merge Immediately** | Architectural fix, not a breaking change since no external consumers depend on current behavior |
| History table | **Future Roadmap** | Significant design work needed; impacts multiple modules |

---

## Implementation Plan

### Phase 1: Critical Bug Fixes (Week 1)

**Goal:** Fix broken core functionality that prevents badge awards.

#### Items
1. Implement `ScheduledEvaluationService.evaluateBadge()` - resolve eligible users from rule config
2. Add user streak/rank queries to resolve eligibility
3. Add tests for deferred evaluation

#### Dependencies
- Requires: User module streak data access
- Required by: Nothing (blocking current functionality)

#### Risks
- Incorrect user resolution could award badges to wrong users
- Performance impact of querying all users for deferred badges

#### Exit Criteria
- Deferred badges (evaluationMode='deferred' or 'both') are correctly awarded to eligible users

---

### Phase 2: Data Consistency Fixes (Week 1-2)

**Goal:** Fix incorrect analytics and API inconsistencies.

#### Items
1. Implement `uniqueEarners` count in `getPlatformStats()`
2. Fix pagination to return `{ items, total }` structure
3. Update OpenAPI specs
4. Add pagination contract tests

#### Dependencies
- Requires: Phase 1 completion (for testing)
- Required by: Nothing

#### Risks
- Breaking change if any external clients depend on current bare array response

#### Exit Criteria
- Platform analytics show correct `uniqueEarners` count
- All paginated endpoints return `{ items, total }`
- OpenAPI spec tests pass

---

### Phase 3: Missing Feature Implementation (Week 2-3)

**Goal:** Implement documented but unimplemented features.

#### Items
1. Implement `AchievementHistoryService` stub methods:
   - `getHistoryEntry()` - query by userBadgeId
   - `wasBadgePreviouslyRevoked()` - check revoked records
   - `getRecentAwards()` - query with ORDER BY earnedAt DESC
   - `getAwardsByCategory()` - filter by badge category

2. Implement `BadgeAnalyticsService` stub methods:
   - `getTopEarners()` - order by earnedAt for badge
   - `getTrendAnalysis()` - aggregate over time periods

3. Implement `BadgeRevocationService` methods:
   - `getBadgeRevocationHistory()` - query revoked records
   - `reverseRevocation()` - clear revokedAt, re-award

#### Dependencies
- Requires: Phase 1-2 completion
- Required by: Nothing

#### Risks
- Multiple database queries if not optimized

#### Exit Criteria
- All documented service methods return meaningful data
- Unit tests cover all service methods

---

### Phase 4: Distributed Cache (Week 3-4)

**Goal:** Fix scalability issues with in-memory cache.

#### Items
1. Add Redis cache for badge definitions and rules
2. Implement cache invalidation on badge/rule mutations
3. Add distributed lock for cache refresh

#### Dependencies
- Requires: Phase 1-3 completion
- Required by: Multi-instance deployments

#### Risks
- Redis dependency adds infrastructure complexity
- Cache invalidation timing must be correct

#### Exit Criteria
- Badge/rule changes visible within 5 seconds across all instances
- Cache stampede prevention via distributed lock

---

## Dependency Analysis

```
Phase 1 (Deferred Evaluation)
├── Requires: User streak data access (new port?)
└── Blocks: Nothing

Phase 2 (Data Consistency)
├── Requires: Phase 1 tests
└── Blocks: Nothing

Phase 3 (Feature Implementation)
├── Requires: Phases 1-2
└── Blocks: Nothing

Phase 4 (Distributed Cache)
├── Requires: All previous phases
└── Enables: Multi-instance deployments
```

---

## Dependency Graph

```
[Deferred Evaluation]     [Data Consistency]
        │                        │
        └──────────┬─────────────┘
                   │
                   ▼
        [Feature Implementation]
                   │
                   ▼
           [Distributed Cache]
                   │
                   ▼
          [Production Ready]
```

---

## Critical Path

**Phase 1 → Phase 2 → Phase 3 → Phase 4 → Production**

**Estimated Duration: 4 weeks**

---

## Parallel Work

1. **Documentation update** - Fix `achievement_history` table documentation to reflect actual implementation
2. **OpenAPI spec generation** - Generate and commit `openapi.json` after pagination fix
3. **Test coverage** - Add achievement module spec files in parallel with implementation

---

## Deferred Work

1. **Achievement history table** - Consider adding dedicated `achievement_history` table for immutable audit log (separate design doc)
2. **XP reward computation** - Clarify with product; may belong in Ranking module
3. **Badge rarity tiers** - Future product feature
4. **Seasonal badges** - Future product feature

---

## Evidence Summary

| Finding | File | Lines |
|---------|------|-------|
| Empty eligibleUsers array | `scheduled-evaluation.service.ts` | 189-193 |
| Stub return null | `achievement-history.service.ts` | 104-110 |
| Stub return false | `achievement-history.service.ts` | 176-183 |
| uniqueEarners = 0 | `badge-analytics.service.ts` | 161-162 |
| Empty trend analysis | `badge-analytics.service.ts` | 304-322 |
| Bare array pagination | `achievement.presenter.ts` | 40-44 |
| DTO example mismatch | `badge-catalog-item-response.dto.ts` | 4 |
| In-memory cache | `rule-engine.service.ts` | 42-45 |
| Missing history table | `docs/modules/achievement.md` | - |

---

## Appendix: Key Files Reviewed

### Domain Layer
- `src/modules/achievement/domain/errors/achievement.errors.ts`
- `src/modules/achievement/domain/types/achievement.types.ts`
- `src/modules/achievement/domain/services/rule-engine.service.ts`
- `src/modules/achievement/domain/services/rank-achievement.service.ts`
- `src/modules/achievement/domain/services/badge-revocation.service.ts`
- `src/modules/achievement/domain/events/achievement.events.ts`
- `src/modules/achievement/domain/events/achievement-domain.event-bus.ts`

### Application Layer
- `src/modules/achievement/application/achievement.application.service.ts`
- `src/modules/achievement/application/achievement-history.service.ts`
- `src/modules/achievement/application/progress-tracking.service.ts`
- `src/modules/achievement/application/analytics/badge-analytics.service.ts`

### Infrastructure Layer
- `src/modules/achievement/infrastructure/repositories/achievement.repository.impl.ts`
- `src/modules/achievement/infrastructure/scheduled/scheduled-evaluation.service.ts`
- `src/modules/achievement/infrastructure/outbox/achievement-outbox-processor.service.ts`
- `src/modules/achievement/infrastructure/adapters/attempt-listener.adapter.ts`
- `src/modules/achievement/infrastructure/adapters/ranking-event-listener.adapter.ts`
- `src/modules/achievement/infrastructure/adapters/achievement-notification-listener.adapter.ts`

### Transport Layer
- `src/modules/achievement/transport/controller/achievement.controller.ts`
- `src/modules/achievement/transport/controller/achievement-admin.controller.ts`
- `src/modules/achievement/transport/presenters/achievement.presenter.ts`

### Database Schema
- `src/core/database/schema/achievement/schema.ts`

### Documentation
- `docs/modules/achievement.md`
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/architecture.md`
- `docs/adr/0014-event-architecture.md`
