# User Module

## Purpose

Owns **user identity extensions beyond authentication**: profiles, settings, XP-based rankings, earned badges, activity timelines, and tournament participation records.

> Auth-related concerns (registration, login, password, session, OAuth) belong to the **Auth module**.

## Responsibilities

**Owns**
- User profiles (`displayName`, `bio`, `avatar`)
- Per-user notification and visibility settings
- XP-based ranking records (`currentXp`, `allTimeXp`, `dailyXp`, streak)
- Earned badge records
- Activity event timeline (append-only)
- Tournament participation records (registered, withdrew, completed)
- Tournament analytics for a user

**Does not own**
- Authentication credentials, sessions, tokens, OAuth accounts (Auth module)
- Quiz authoring (Quiz module)
- Attempt tracking (Attempt module)
- Badges catalog (Achievement module)

## Core Concepts

| Concept | Description |
|---|---|
| **UserProfile** | Public identity beyond auth: `displayName`, `bio`, `avatarUrl`. |
| **UserProfileSettings** | Notification preferences, visibility (public/private profile). |
| **UserRanking** | XP and streak: `currentXp`, `allTimeXp`, `dailyXp`, `currentStreak`, `longestStreak`, `rank`. |
| **UserBadge** | A badge instance earned by a user (`badgeId`, `earnedAt`). |
| **Badge** | A badge catalog entry (`code`, `name`, `description`, `iconUrl`, `xpReward`). |
| **UserActivityEvent** | An append-only timeline event (`eventType`, `metadata`). |
| **TournamentParticipant** | User's participation record in a tournament (`status`, `finalRank`). |

## Business Rules

- **Profile visibility**: private profiles return `USER_PROFILE_PRIVATE` (403) to non-owners.
- **Profile uniqueness**: `displayName` is unique (enforced by DB unique index).
- **Streak tracking**: `currentStreak` and `longestStreak` are computed by `StreakService` based on daily activity events.
- **XP accumulation**: XP is earned through quiz attempts (from the **Attempt module**) and rank milestones (from the **Ranking module**). This module reads those events but does not originate XP.
- **Badge earning**: awarded by the **Achievement module**; this module holds the `user_badges` records.
- **Lazy creation**: a `UserRanking` row is created on first access via `createUserRanking()`.
- **Activity timeline**: append-only; each event is cursor-paginated.

## Relationships

```
User (Auth module — owns identity)
    ↑
    owns profile, settings, ranking, badges, activity
    ↓
UserProfile
UserProfileSettings
UserRanking  ← updated by Ranking module events
UserBadge    ← created by Achievement module
UserActivityEvent
TournamentParticipant  ← managed by Tournament module
```

## Lifecycle

### UserProfile

```
No profile (implicit default)
    ↓ first access / profile update
Profile created or updated
    ↓ (no delete — profiles persist after account soft-delete)
```

### UserRanking

```
Not created (lazy)
    ↓ first XP event
Created with initial XPs and streak 0
    ↓ daily activity events
Streak updated (currentStreak increments / resets to 1)
    ↓ (no deletion)
```

### UserBadge

```
Not earned
    ↓ Achievement module awards badge
Badge earned (userId, badgeId, earnedAt)
    ↓ (never removed automatically — only via admin revocation)
```

## Permissions

No RBAC `@Permissions` are used in the User module. All endpoints require a valid JWT; data is scoped to `currentUserId`.

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Auth** | Reads `UserMeRow` for profile data. The Auth module constructs `JwtPayload`. |
| **Ranking** | Consumes `rank.changed` events to update `UserRanking`. Emits `user.streak_updated`. |
| **Achievement** | Awards `UserBadge` entries. |
| **Quiz** | Reads creator analytics via `QUIZ_LISTING_PORT`. |
| **Tournament** | Reads tournament participation records for user tournament endpoints. |

## Invariants

- A `UserRanking` row always belongs to exactly one active user.
- `currentStreak` cannot be negative.
- `allTimeXp` is monotonically non-decreasing (never decreases on updates).
- Activity events are never deleted or modified after insertion.

## Future Extension Points

- **Profile verification**: the current `isVerified` flag lives in Auth; a profile-specific verification tier is not implemented.
- **Social profile links**: not yet modeled (future consideration for sharing public profile URLs).