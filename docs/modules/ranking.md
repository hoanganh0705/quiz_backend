# Ranking Module

## Purpose

Owns the **XP accumulation and rank computation** for all user activities. Aggregates XP events from attempts, tournaments, and badges; computes daily/weekly/monthly/all-time ranks; tracks rank-change milestones; and manages scheduled period resets via a transactional outbox.

## Responsibilities

**Owns**
- XP event ingestion and accumulation
- Rank computation (daily, weekly, monthly, all-time) using SQL window functions
- Leaderboards
- Rank-change notifications
- Period resets (daily, weekly, monthly) via BullMQ
- Dirty-flag latch for lazy rank recalculation

**Does not own**
- XP-earning events themselves (originated by Attempt, Achievement, Tournament modules)
- User profiles (User module)

## Core Concepts

| Concept | Description |
|---|---|
| **UserRanking** | XP records per period: `currentXp`, `allTimeXp`, `dailyXp`, `weeklyXp`, `monthlyXp`, `currentRank`, `peakRank`. |
| **RankHistory** | Immutable record of a rank change event for a user. |
| **RankingMilestone** | Record of a milestone rank achievement (`rank_10`, `rank_100`, `rank_1000`). |
| **RankRecalculationWorkItem** | Outbox entry for deferred rank recalculation. |

## Business Rules

- **Transactional outbox**: XP updates and outbox entries commit atomically in the same DB transaction.
- **Dirty-flag latch**: XP changes set `is_dirty = true` on the ranking row, triggering lazy recalculation on next read.
- **Period resets**: daily, weekly, monthly resets are scheduled via BullMQ; `currentXp` is rolled into period-specific columns.
- **Consistency check**: auto-detects and fixes XP mismatches and rank gaps.
- **SQL window functions**: `RANK()` and `DENSE_RANK()` compute global and period ranks in batch.

## Relationships

```
UserRanking  ← updated by XP events from Attempt, Tournament, Achievement modules
├── belongs to → User
├── has many → RankHistory
├── has many → RankingMilestones
└── has many → RankRecalculationWorkItems
```

## Permissions

| Action | Permission |
|---|---|
| Admin status, recalculate, reset, consistency-check | `RANKING_ADMIN` (Admin) |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Attempt** | Subscribes to `attempt.completed` via `ATTEMPT_DOMAIN_EVENT_BUS`; ingests XP events. |
| **Tournament** | Subscribes to tournament events via `SHARED_TOURNAMENT_EVENT_BUS`; ingests XP events. |
| **Achievement** | Subscribes to badge award events via `SHARED_ACHIEVEMENT_EVENT_BUS`; ingests XP events. |
| **Notification** | Emits `rank.changed` and `peak.rank.achieved` via `RANKING_DOMAIN_EVENT_BUS` consumed by Notification module. |

## Invariants

- `allTimeXp` is monotonically non-decreasing.
- A rank is always consistent with the ordered XP values at the time of last recalculation.
- Outbox entries are processed exactly once (idempotency key per work item).

## Future Extension Points

- **League/tier system**: not yet modeled (rank numbers exist but tier thresholds are not defined).
- **Weighted XP periods**: not yet modeled (daily/weekly/monthly XP weights are equal today).