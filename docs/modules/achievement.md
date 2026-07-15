# Achievement Module

## Purpose

Owns the **badge and credential catalog, grant rules, and revocation** triggered by user activity across attempts, tournaments, rankings, and streaks. Awards are persisted in the **User module's** `user_badges` table.

## Responsibilities

**Owns**
- Badge catalog (`code`, `name`, `description`, `iconUrl`, `xpReward`)
- Rule-based badge grant evaluation
- Rank-based badge grants (top-10, top-100, etc.)
- Streak milestone tracking
- Admin badge revocation

**Does not own**
- User badge records (User module owns `user_badges`)
- XP computation (Ranking module)
- Streak data (User module)

## Core Concepts

| Concept | Description |
|---|---|
| **Badge** | A credential entry: `code`, `name`, `description`, `iconUrl`, `xpReward`. |
| **BadgeRule** | A grant rule evaluated by `RuleEngineService`. |
| **UserBadge** | An earned badge instance (stored in User module's `user_badges` table). |
| **AchievementHistory** | Immutable log of grants and revocations. |
| **RankAchievement** | A rank-based badge grant rule (evaluated by `RankAchievementService`). |

## Business Rules

- **One badge per user per badge code**: enforced by unique constraint on `(userId, badgeId)`.
- **No automatic revocation**: badges are never stripped automatically. Only admin may revoke.
- **Retroactive evaluation**: admin endpoint allows re-evaluation of all badge rules for any user.
- **Badge audit trail**: every grant and revocation is recorded in `achievement_history`.

## Relationships

```
Badge (catalog)
├── grants → UserBadge (persisted in User module)
├── grant logged in → AchievementHistory
└── evaluated by → RuleEngineService / RankAchievementService

UserBadge  ← stored in User module
└── belongs to → User
```

## Permissions

| Action | Permission |
|---|---|
| Revoke user badge | `ACHIEVEMENT_REVOKE` (Admin) |
| Re-evaluate user badges | `ACHIEVEMENT_ADMIN` (Admin) |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **User** | Persists `UserBadge` records in `user_badges` table. |
| **Ranking** | Subscribes to `rank.changed`, `peak.rank.achieved`, `ranking.milestone` events via `SHARED_RANKING_EVENT_BUS`; evaluates rank-based badge grants. |
| **Attempt** | Subscribes to `attempt.completed` events; evaluates attempt-count badge rules. |
| **Tournament** | Subscribes to `tournament.won` via `SHARED_TOURNAMENT_EVENT_BUS`; evaluates tournament badge rules. |
| **Instance** | Subscribes to instance events for in-game achievement evaluation. |
| **Notification** | Emits badge events via `SHARED_ACHIEVEMENT_EVENT_BUS` consumed by Notification module. |

## Invariants

- Exactly one `UserBadge` per user per badge code.
- Badges are never automatically revoked.
- Every grant and revocation is recorded in `achievement_history`.

## Future Extension Points

- **Badge rarity tiers**: not yet modeled (all badges have equal rarity today).
- **Seasonal badges**: not yet modeled (badge grant windows are not time-constrained).