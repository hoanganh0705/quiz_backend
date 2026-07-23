# Leaderboard Module Architecture Review

**Module:** Ranking (Leaderboard)
**Date:** Thursday Jul 23, 2026
**Reviewer:** Principal Software Architect
**Status:** Pre-Production Review

---

## Executive Summary

**Overall Score: 7.5 / 10**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Architecture | 8.5/10 | Strong DDD layering with excellent port/adapter patterns |
| Product Design | 8/10 | Comprehensive feature set, well-aligned with gamification |
| Business Modeling | 7.5/10 | Solid domain model with some inconsistencies |
| Domain Modeling | 7/10 | Good separation but scheduler in wrong layer |
| API Design | 8/10 | Clean REST endpoints with proper pagination |
| Concurrency | 6.5/10 | Major concerns with in-process scheduling |
| Scalability | 8/10 | SQL window functions, batch processing |
| Maintainability | 7.5/10 | Well-documented but thin test coverage |
| Extensibility | 7.5/10 | Good event architecture, blocked by scheduler choice |
| Business Alignment | 8/10 | Matches documented requirements well |

---

## Major Strengths

1. **Excellent DDD Layering** — Clear separation between domain, application, infrastructure, and transport layers following project conventions.

2. **Transaction Outbox Pattern** — XP updates and outbox entries commit atomically, guaranteeing at-least-once delivery with idempotency keys.

3. **SQL Window Functions** — Proper use of `RANK()` and `DENSE_RANK()` for tie handling in leaderboard queries.

4. **Advisory Locks for Period Resets** — `pg_advisory_xact_lock` prevents concurrent resets.

5. **Comprehensive Error Handling** — RFC 7807 Problem Details with proper problem codes.

6. **Dirty-Flag Latch Pattern** — Efficient lazy recalculation with `is_dirty` flag and work items queue.

7. **Well-Documented Codebase** — Extensive inline documentation explaining architectural decisions.

8. **Dual Event Bus Architecture** — In-memory dispatch + outbox persistence for reliability.

---

## Major Weaknesses

1. **In-Process Scheduler in Application Layer** — `RankingApplicationService` manages `setInterval` timers directly, violating project architecture and creating scalability issues.

2. **Thin Test Coverage** — Only 5 spec files exist; critical components have no tests.

3. **Daily Period Not Supported** — `RankingPeriod.DAILY` exists but `getXpColumn()` throws errors for daily.

4. **Scheduler State Loss on Restart** — `setInterval` timers are lost on application restart.

5. **Duplicate XP Processing Paths** — Two integration paths exist creating confusion.

6. **Unsafe `determineTrend()` Implementation** — Always returns `'same'`, providing no actual trend data.

---

## Consistency Analysis

### Project Rules → Documentation → Implementation → Tests

| Area | Status | Finding |
|------|--------|---------|
| Layer Responsibilities | ⚠️ Inconsistency | Scheduler (timers) lives in `application/` layer, not `infrastructure/`. Project rules state scheduling belongs in `infrastructure/`. |
| Domain Event Shape | ✅ Consistent | Events are TypeScript interfaces in `domain/events/` per ADR-0014. |
| Error Hierarchy | ✅ Consistent | `BaseDomainException` + `RankingDomainError` + 3 concrete exceptions. |
| Repository Pattern | ✅ Consistent | `RankingRepositoryPort` interface with `RankingRepository` implementation. |
| Outbox Pattern | ✅ Consistent | Transactional outbox for at-least-once delivery per ADR-0014. |
| RFC 7807 Errors | ✅ Consistent | `ProblemCodeMapping` entries for all 3 ranking errors. |
| Cache TTL | ⚠️ Justified | 30-second leaderboard TTL documented as acceptable trade-off. |
| Scheduler Pattern | ❌ Missing | Project rules do not specify in-process `setInterval` pattern. |

---

## Product Review

### From a Real User's Perspective

#### What Works Well
- 13 public API endpoints covering all key leaderboard use cases
- Public endpoints for leaderboard browsing without authentication
- Offset-based pagination with `limit`/`offset` for random page access
- Ghost responses for users with no ranking data (no 404 confusion)
- Period filters (weekly/monthly/all-time) for competitive variety

#### User Experience Concerns

1. **`userPosition` Always Null on Public Leaderboard** — The endpoint documentation explicitly states `userPosition` is always `null` for public queries. Users cannot see their position relative to the global leaderboard without authentication.

2. **30-Second Stale Data** — After earning XP, users must wait up to 30 seconds to see their position update. This may frustrate competitive users.

3. **`trend` Field Always Returns `'same'`** — The `determineTrend()` method always returns `'same'`, meaning the trend indicator is non-functional. This is an implementation bug.

4. **Missing Daily Leaderboard** — The documentation and DTOs reference daily period, but the repository explicitly rejects daily queries with a runtime error.

---

## Business Workflow Review

### State Machine: User Ranking Lifecycle

```
[User Earns XP]
       ↓
[XP Ingestion Service]
       ↓
[Transactional Outbox] → [RankingOutboxProcessor]
       ↓
[Dirty Flag Set] → [Rank Recalculation Queue]
       ↓
[Batch Processor] → [Rank Updated + Peak Check + Milestone Check]
       ↓
[Event Emitted] → [Notification + Cache]
```

### Period Reset Lifecycle

```
[Scheduler Trigger]
       ↓
[Advisory Lock Acquired]
       ↓
[Archive to rank_history]
       ↓
[Reset XP + Rank Fields]
       ↓
[Emit PeriodResetCompleted Event]
       ↓
[Unlock]
```

### Issues Identified

1. **Reset Scheduling Reliability** — `PeriodResetService.isResetDue()` check runs every 30 seconds in `RankingApplicationService`. With multiple instances, each instance independently checks.

2. **Reset Triggered Multiple Times Across Instances** — All N instances run the check every 30 seconds. Advisory lock prevents duplicates but wastes resources.

3. **No Distributed Lock for Scheduler** — The advisory lock is database-level but requires each instance to attempt the lock. A Redis-based distributed lock or leader election would be more efficient.

---

## Domain Review

### Aggregates

#### `UserRanking` (Aggregate Root)

| Field | Type | Notes |
|-------|------|-------|
| `userId` | UUID (PK) | Owns relationship to User |
| `allTimeXp`, `weeklyXp`, `monthlyXp`, `dailyXp` | integer | XP counters per period |
| `allTimeRank`, `weeklyRank`, `monthlyRank`, `dailyRank` | integer | Current rank per period |
| `peak*Rank`, `peak*RankAchievedAt` | integer, timestamp | Best ranks ever achieved |
| `isDirty` | boolean | Latch for lazy recalculation |
| `lastWeeklyResetAt`, `lastMonthlyResetAt`, `lastDailyResetAt` | timestamp | Period boundary tracking |

**Invariant:** `allTimeXp >= weeklyXp`, `allTimeXp >= monthlyXp`, `allTimeXp >= dailyXp` — enforced by CHECK constraints.

**Ownership Assessment:** Correct. `UserRanking` owns its XP and rank state. XP events from external domains are ingested through the outbox pattern.

### Repositories

#### `RankingRepository` Issues

1. **Raw SQL with Dynamic Column Names** — Extensive use of `sql.raw()` for period-specific columns. While safe, it's fragile.

2. **`findXpMismatches()` Logic Gap** — The function checks XP mismatches between `user_ranking.allTimeXp` and `quiz_attempts.xpEarned` but only cross-references quiz attempts, not tournament or achievement XP.

3. **No Transaction in `processDirtyRankings()`** — Reads work items, processes each, then deletes them. If crash occurs after processing but before deletion, items may be reprocessed.

### Domain Events

| Event | Type | Purpose |
|-------|------|---------|
| `XpAddedEvent` | Domain | XP updated successfully |
| `RankChangedEvent` | Domain | User rank changed |
| `PeakRankAchievedEvent` | Domain | New best rank |
| `PeriodResetInitiatedEvent` | Domain | Reset started |
| `PeriodResetCompletedEvent` | Domain | Reset finished |
| `RankingMilestoneEvent` | Domain | Milestone reached |
| `ConsistencyCheckEvent` | Domain | Health check result |

### Value Objects

**`RankingPeriod` Enum Issue:** `DAILY` is defined but not supported by the repository's `getXpColumn()` method, which throws for daily queries. The enum should be removed or the functionality implemented.

---

## API Review

### Public Endpoints (No Auth Required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/leaderboard` | GET | Global leaderboard with period filter |
| `/leaderboard/distribution` | GET | Percentile bucket statistics |
| `/leaderboard/top-movers` | GET | Largest positive rank movements |
| `/leaderboard/:userId` | GET | Public user rank info |
| `/leaderboard/:userId/rank` | GET | User rank for specific period |
| `/leaderboard/:userId/history` | GET | Public ranking history |

### Authenticated Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/leaderboard/me` | GET | Current user's full rank profile |
| `/leaderboard/me/rank` | GET | User's rank for specific period |
| `/leaderboard/me/percentile` | GET | User's percentile position |
| `/leaderboard/me/milestones` | GET | Achievement milestones |
| `/leaderboard/me/nearby` | GET | Users above/below in rank |
| `/leaderboard/me/movement` | GET | Rank change over period |
| `/leaderboard/me/peak-ranks` | GET | Best ranks ever achieved |
| `/leaderboard/me/history` | GET | User's ranking progression |

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/ranking/status` | GET | System health status |
| `/admin/ranking/recalculate` | POST | Trigger rank recalculation |
| `/admin/ranking/reset` | POST | Trigger period reset |
| `/admin/ranking/consistency-check` | POST | Run health check |

### DTO Concerns

1. **`UserRankSummaryDto` nullable handling:** Endpoint returns HTTP 200 with no body when user has no rank. This may be confusing for API consumers.

2. **`TopMoversQueryDto` missing validation:** Uses inline enum array instead of `LeaderboardPeriodEnum`. Creates documentation inconsistency.

3. **`LeaderboardQueryDto.limit` max validation:** Maximum limit of 500 means users cannot fetch the entire leaderboard if it exceeds 500 users.

---

## Concurrency Review

### Race Conditions Identified

#### 1. Dirty Flag + Work Items Race (Medium Risk)

Two concurrent XP events for the same user:
- Event 1: Sets `is_dirty = true`, inserts work item `(user, weekly)`
- Event 2: Sets `is_dirty = true` (already true, no-op), inserts work item `(user, weekly)` → `ON CONFLICT DO NOTHING`

**Mitigation:** Unique constraint on `(user_id, period)` makes concurrent inserts idempotent. ✅ Safe.

#### 2. Rank Recalculation During Period Reset (High Risk)

Timeline:
1. User earns XP → `is_dirty = true`, work item enqueued
2. Weekly reset runs → weekly XP reset to 0
3. Rank recalculation runs → reads stale weekly XP (now 0) or new XP?

**Evidence:** `RankCalculationService.recalculateRanksForUsers()` reads current XP from `user_ranking`. If reset happens between enqueue and processing, the recalculation may use wrong XP values.

**Current Mitigation:** None. ❌ **Needs fix.**

#### 3. Period Reset Multiple Executions (Low Risk)

Multiple instances or rapid scheduler cycles could trigger `resetPeriod()` multiple times. The advisory lock prevents concurrent execution, but all instances still check.

#### 4. Cache Stampede (Medium Risk)

When leaderboard cache expires, multiple concurrent requests all miss cache and hit the database simultaneously.

### Transactions

#### XP Update Transaction (Correct)

```typescript
// XpIngestionService.processXpEvent()
await this.db.transaction(async (tx) => {
  const updatedRanking = await this.rankingRepository.updateXpInTx(tx, {...});
  await this.outbox.scheduleRankingEvent(..., tx);
  await this.rankCalculationService.queueRankRecalculationInTx(tx, ...);
});
```

✅ Correct: XP update + outbox + work item all in same transaction.

#### Rank Recalculation (Missing Transaction)

```typescript
// RankCalculationService.processDirtyRankings()
const workItems = await this.rankingRepository.getPendingRecalculationWorkItems(limit);
// ... process each ...
await this.rankingRepository.completeRecalculationWorkItems(workItemIds);
```

❌ Not atomic: Processing and deletion are separate operations.

### Locking Strategy

| Operation | Lock Type | Scope | Duration |
|-----------|-----------|-------|----------|
| Period Reset | `pg_advisory_xact_lock` | Per-period ID | Transaction |
| Work Item Processing | None | N/A | N/A |
| XP Update | DB transaction | Row-level | Transaction |
| Dirty Flag Update | None | N/A | N/A |

---

## Scalability Review

### Production Readiness Assessment

#### Strengths

1. **SQL Window Functions** — `RANK()` and `DENSE_RANK()` compute ranks efficiently in a single query.

2. **Batch Processing** — `processDirtyRankings()` processes up to 100 work items per cycle.

3. **Index Strategy** — Proper B-tree indexes on rank columns for efficient leaderboard queries.

4. **Pagination** — Offset pagination with max 500 entries prevents unbounded result sets.

5. **Dirty Users Index** — Composite index for efficient dirty user queries.

#### Concerns

1. **`getNextRankXp()` Subquery Performance** — Complex nested subquery could be slow for large leaderboards.

2. **Rank History Growth** — `rank_history` grows unbounded (4000+ rows/day with 1000 users).

3. **Consistency Check Full Table Scan** — Joins against `quiz_attempts` for all users.

4. **`getTopMovers()` Complex CTE** — Requires at least 2 rank history snapshots per user.

5. **Leaderboard Cache Not Shared Across Instances** — Each instance maintains its own cache view.

---

## Maintainability Review

### Code Quality

#### Strengths

1. **Excellent Inline Documentation** — Extensive docstrings explaining architectural decisions.

2. **Consistent Naming** — Clear, descriptive method names throughout.

3. **Type Safety** — Strong TypeScript typing with domain-specific types.

4. **Error Messages** — Descriptive error messages with context.

#### Concerns

1. **Large Repository File** — `ranking.repository.ts` is 1483 lines with many responsibilities.

2. **Duplicate Code** — `_updateXpCore()` has significant code duplication between insert and update paths.

3. **Magic Numbers** — Constants defined but hardcoded values appear elsewhere.

4. **Test Coverage** — Only 5 spec files exist. Critical gaps in repository, service, and integration tests.

### Long-Term Risks

1. **Scheduler Maintenance** — In-process `setInterval` timers are harder to monitor.

2. **Event Schema Evolution** — No event versioning strategy.

3. **Test Debt** — Without comprehensive tests, refactoring is risky.

---

## Architecture Consistency Review

### Project Constitution Compliance

| Rule | Compliance | Evidence |
|------|-------------|----------|
| Layer dependencies flow downward | ⚠️ Partial | Domain imports `RedisService` in `LeaderboardService` |
| Domain has no HTTP concerns | ✅ | Domain exceptions carry only `code` and `message` |
| Repository returns domain types | ✅ | `RankingRepositoryPort` returns typed rows |
| Mappers are pure projections | ✅ | No side effects in mappers |
| Controllers delegate to services | ✅ | `RankingController` delegates to services |
| Presenters wrap responses | ✅ | `RankingPresenter` uses `ApiResponse.ok()` |
| Ports use Symbol tokens | ✅ | `RANKING_REPOSITORY_PORT`, `RANKING_DOMAIN_EVENT_BUS`, etc. |
| Domain events are in-process | ✅ | `RankingDomainEventBus` for fire-and-forget |
| Cross-instance uses outbox | ✅ | `RankingOutboxProcessor` for durability |

### Violations Identified

#### 1. Domain Service Imports RedisService

`LeaderboardService` is in `domain/services/` but imports `CACHE_PROVIDER`:

```typescript
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
```

**Classification:** Architecture inconsistency but functionally necessary. The `CACHE_PROVIDER` is a port (interface).

#### 2. Scheduler in Application Layer

The project constitution doesn't specify where schedulers belong, but `application/` layer should orchestrate, not run background jobs. A dedicated `infrastructure/scheduler/` directory would be more appropriate.

---

## Missing Product Capabilities

### Required Fix

1. **`determineTrend()` Returns Invalid Data** — Always returns `'same'`. Either implement properly or remove from API.

2. **Daily Period Throws Runtime Error** — `getXpColumn()` throws for `RankingPeriod.DAILY`. Either implement daily leaderboard support or remove from enum.

3. **Test Coverage for Critical Paths** — Repository, application services, and domain services have no tests.

### Product Discussion

1. **Ghost Response vs. Empty Response** — Endpoints return HTTP 200 with no body for missing data. Consider returning empty array/object with explicit nulls.

2. **Leaderboard Cache TTL** — 30-second TTL may frustrate competitive users.

3. **Tournament vs. Global Leaderboard Separation** — Should there be cross-pollination or separate systems?

### Future Product

1. **League/Tier System** — Documented as future extension. No implementation yet.

2. **Weighted XP Periods** — Equal weights today; configurable weights for future.

3. **Real-time WebSocket Updates** — No WebSocket transport for live leaderboard updates.

### YAGNI

1. **`bulkProcessXpEvents()` Sequential Processing** — Processes events sequentially. Could be parallelized.

2. **Forced Reset Without Time Validation** — `forceReset()` exists but may never be used.

---

## Final Verdict

| Category | Decision | Rationale |
|----------|----------|-----------|
| Scheduler in Application Layer | **Product Discussion Required** | Works functionally but violates layering spirit. Should move to infrastructure or external scheduler. |
| Daily Period | **Product Discussion Required** | Enum exists but throws at runtime. Either implement or remove. |
| Test Coverage | **Required Fix** | Critical paths have no tests. Must add before production. |
| `determineTrend()` | **Required Fix** | Returns invalid data (always `'same'`). |
| Concurrency Gap | **Required Fix** | Rank recalculation can race with period reset. |
| Event Schema | **Future Roadmap** | No versioning strategy for event evolution. |
| Cache Stampede | **Future Roadmap** | No stampede protection currently. |

### Summary

- **Merge Immediately:** ❌ No
- **Product Discussion Required:** ⚠️ Yes (3 items)
- **Future Roadmap:** ✅ Yes (3 items)
- **Required Fix Before Production:** ❌ Yes (4 items)

---

## Implementation Plan

### Phase 1: Critical Bug Fixes

**Goal:** Fix bugs that cause incorrect behavior.

**Items:**
1. Fix `determineTrend()` to return actual trend data or remove from API
2. Remove or implement `RankingPeriod.DAILY` support
3. Add transaction safety to `processDirtyRankings()`

**Dependencies:** None.

**Risks:** Low. These are targeted fixes.

**Exit Criteria:**
- `determineTrend()` returns `'up'`, `'down'`, `'same'`, or `'new'` based on actual rank history
- Daily period queries either work or return clear error (not runtime exception)
- Rank recalculation + work item deletion are atomic

---

### Phase 2: Test Coverage

**Goal:** Achieve minimum viable test coverage for production readiness.

**Items:**
1. Add repository tests for `RankingRepository` (at minimum: `updateXp`, `getLeaderboard`, `resetPeriod`)
2. Add service tests for `RankCalculationService`
3. Add integration tests for XP ingestion flow

**Dependencies:** Phase 1 must be complete first.

**Risks:** Medium. Testing in-process schedulers requires careful mocking.

**Exit Criteria:**
- Core repository methods have unit tests
- XP ingestion path has integration test
- Consistency check has test coverage

---

### Phase 3: Scheduler Architecture

**Goal:** Move scheduling to appropriate layer.

**Items:**
1. Evaluate BullMQ (already in dependencies) vs. external cron vs. dedicated scheduler service
2. Move `RankingApplicationService` scheduler logic to `infrastructure/scheduler/`
3. Implement distributed lock for reset scheduling

**Dependencies:** Phases 1 and 2 complete.

**Risks:** Medium. Changing scheduler pattern requires careful migration.

**Exit Criteria:**
- Scheduler logic moved from `application/` to `infrastructure/`
- Multiple instances don't redundantly check scheduler conditions
- Scheduler state survives application restart

---

### Phase 4: Performance Optimization

**Goal:** Address scalability concerns identified in review.

**Items:**
1. Optimize `getNextRankXp()` query to handle tied ranks correctly
2. Implement rank history archival or partitioning strategy
3. Add cache stampede protection

**Dependencies:** Phase 3 (need scheduler stable before optimizing).

**Risks:** Low. Performance improvements with defined success metrics.

**Exit Criteria:**
- `getNextRankXp()` handles tied ranks correctly
- Rank history growth is bounded (archival policy defined)
- Cache misses don't cause load spikes

---

## Dependency Analysis

### Technical Dependencies

```
Phase 1 (Bug Fixes)
├── Fix determineTrend()
│   └── Requires: Rank history query access
├── Fix daily period
│   └── Requires: Product decision (implement or remove)
└── Add transaction safety
    └── Requires: Transaction context for rank + work items

Phase 2 (Tests)
├── Repository tests
│   └── Requires: Phase 1 complete
├── Service tests
│   └── Requires: Phase 1 complete
└── Integration tests
    └── Requires: Phase 1 complete

Phase 3 (Scheduler)
├── Evaluate scheduler options
│   └── Requires: Phase 2 complete
├── Move scheduler logic
│   └── Requires: Phase 2 complete
└── Add distributed lock
    └── Requires: Phase 2 complete

Phase 4 (Performance)
├── Optimize query
│   └── Requires: Phase 3 complete
├── Archival strategy
│   └── Requires: Phase 3 complete
└── Cache stampede protection
    └── Requires: Phase 3 complete
```

### Dependency Graph (ASCII)

```
[Critical Bug Fixes] ← Phase 1
        ↓
[Add Test Coverage] ← Phase 2
        ↓
[Scheduler Redesign] ← Phase 3
        ↓
[Performance Tuning] ← Phase 4
```

### Critical Path

Phase 1 → Phase 2 → Phase 3 → Phase 4

All phases must be completed sequentially. Each phase enables the next.

### Parallel Work

None recommended. Each phase builds on the previous.

### Deferred Work

1. **Event Schema Versioning** — Post-production concern
2. **League/Tier System** — Future product feature
3. **WebSocket Updates** — Future product feature
4. **Weighted XP Periods** — Future product feature
5. **Tournament Integration Audit** — Lower priority

---

## Appendix: Key File References

### Core Domain Files
- `src/modules/ranking/domain/services/leaderboard.service.ts` — Leaderboard queries with caching
- `src/modules/ranking/domain/services/xp-ingestion.service.ts` — XP event processing
- `src/modules/ranking/domain/services/rank-calculation.service.ts` — Rank computation
- `src/modules/ranking/domain/services/period-reset.service.ts` — Period resets

### Repository
- `src/modules/ranking/infrastructure/repositories/ranking.repository.ts` — 1483 lines, implements all persistence

### Controllers
- `src/modules/ranking/transport/controller/ranking.controller.ts` — Public and authenticated endpoints
- `src/modules/ranking/transport/controller/ranking-admin.controller.ts` — Admin endpoints

### Application Service
- `src/modules/ranking/application/ranking.application.service.ts` — Scheduler management

### Database Schema
- `src/core/database/schema/ranking/schema.ts` — All ranking tables

### Events
- `src/modules/ranking/domain/events/ranking-domain.events.ts` — Event definitions
- `src/modules/ranking/domain/events/ranking-domain.event-bus.ts` — Event bus implementation

---

*Review completed. All findings are based on evidence from source code, documentation, and architecture files provided.*
