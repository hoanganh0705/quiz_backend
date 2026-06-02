# User Profile Domain — Architecture Design

---

## 1. Domain Boundaries

### What Belongs to User Profile Domain

The User Profile Domain is the **public-facing aggregation layer**. It owns:

| Concern | Rationale |
|---|---|
| Profile identity | Display name, avatar URL, bio, tagline — presentation-layer identity |
| Profile settings | Visibility preferences, pinned content, profile theme |
| Profile read model | The materialized view of a user's public profile |
| Activity timeline | Aggregated activity events across all domains |
| Statistics aggregation | The composed statistics view shown on a profile |
| Pinned badges | User-curated badge showcase |

### What Belongs to User Domain

| Concern | Why It Stays in User |
|---|---|
| Authentication credentials | Passwords, sessions, tokens, OAuth providers |
| Account lifecycle | Registration, deletion, suspension, email verification |
| Contact information | Email, phone — these are private by default |
| User preferences | Notification preferences, language, timezone |
| Basic identity core | Username, email, creation date — the immutable identity anchor |

**Key insight:** The User Domain owns *account* identity. The User Profile Domain owns *public presentation* identity. They are different concepts. A user can change their display name, avatar, or bio without touching their account. The Profile domain owns the mutable presentation layer; the User domain owns the immutable account anchor.

### What Belongs to Ranking Domain

| Concern | Why It Stays in Ranking |
|---|---|
| XP ledger | Raw XP amounts per period, transaction log |
| Rank calculation | The RANK() / DENSE_RANK() algorithm |
| Leaderboard data | Who is #1, #2, #3 globally |
| Period reset logic | Weekly / monthly XP reset mechanics |
| Peak rank tracking | Historical peak rank per period |

**Key insight:** Ranking owns the *computation* and *raw data*. Profile aggregates and *presents* it. Profile never recalculates ranks — it queries Ranking.

### What Belongs to Achievement Domain

| Concern | Why It Stays in Achievement |
|---|---|
| Badge definitions | The catalog of all badge types and thresholds |
| Badge evaluation | Logic for when a badge should be awarded |
| Badge grants | Which user earned which badge, when, with what metadata |
| Streak tracking | Consecutive activity streak calculations |

**Key insight:** Achievement owns the *grant decisions*. Profile owns the *showcase* — which badges the user has chosen to display, the order, and the presentation.

### What Belongs to Attempt Domain

| Concern | Why It Stays in Attempt |
|---|---|
| Individual attempt records | Each quiz attempt with score, time, answers |
| Attempt history | Full audit trail of every attempt |
| Score calculation | How scores are computed |

### What Belongs to Tournament Domain

| Concern | Why It Stays in Tournament |
|---|---|
| Tournament participation | Enrollment, bracket, results |
| Tournament standings | Tournament-specific rankings |

### What Belongs to Notification Domain

| Concern | Why It Stays in Notification |
|---|---|
| Notification delivery | Email, push, in-app |
| Notification preferences | Which notifications a user wants to receive |
| Notification history | Full notification log |

### Overlap Resolution Rules

```
Rule 1: Identity anchor (username, email) → User Domain
Rule 2: Presentation identity (display name, avatar, bio) → User Profile Domain
Rule 3: Raw data and computation → Respective source domain
Rule 4: Aggregation and presentation → User Profile Domain
Rule 5: Business decisions (badge evaluation, rank calculation) → Source domain
Rule 6: User-curated selections (pinned badges, hidden stats) → User Profile Domain
```

---

## 2. Profile Aggregate

### Owned Entities

```
Profile
├── profileId: UUID           # Identity anchor (references User.userId)
├── displayName: string        # Mutable presentation name
├── avatarUrl: string | null  # Profile picture
├── bio: string | null        # Free-text biography
├── tagline: string | null    # Short one-liner
├── visibility: ProfileVisibility
├── pinnedBadgeIds: UUID[]    # User-curated badge showcase
├── createdAt: Date
└── updatedAt: Date

ProfileSettings
├── profileId: UUID
├── isPublic: boolean          # Master toggle for profile visibility
├── showStatistics: boolean    # Display stats on public profile
├── showAchievements: boolean  # Display badges on public profile
├── showActivity: boolean      # Display activity timeline on public profile
├── showRankImprovement: boolean
└── showTournamentActivity: boolean
```

### Aggregated References (Not Owned)

```
ProfileReadModel (computed view, not persisted as aggregate)
├── identity: Owned by Profile
├── statistics: Aggregated from Attempt, Ranking
├── rankings: Queried from Ranking
├── badges: Queried from Achievement
├── recentAttempts: Queried from Attempt (last N)
├── recentTournaments: Queried from Tournament (last N)
└── activityTimeline: Aggregated from all domain events
```

### Ownership Model

The Profile aggregate follows **CQRS in its simplest form**:

- **Command side:** `Profile` is the write model. It owns display name, avatar, bio, settings, pinned content. Changes are mutations on the Profile aggregate.

- **Query side:** `ProfileReadModel` is a composed read model. It is **never stored as a document**. It is always assembled by querying the source-of-truth domains at read time (with caching).

---

## 3. Profile Read Model

The `ProfileReadModel` is the primary query result. It is assembled from multiple domains and presented as a unified profile view.

### Core Information

```
ProfileReadModel
├── userId: UUID              # Links to User domain
├── username: string          # From User domain (immutable identifier)
├── displayName: string       # From Profile domain
├── avatarUrl: string | null  # From Profile domain
├── bio: string | null        # From Profile domain
├── tagline: string | null    # From Profile domain
├── memberSince: Date         # From User domain
└── isPublic: boolean          # From ProfileSettings
```

### Statistics

```
StatisticsView
├── totalXp: number            # From Ranking domain (sum of all periods)
├── totalQuizzesCompleted: number  # From Attempt domain
├── totalAttempts: number     # From Attempt domain
├── averageScore: number      # From Attempt domain (weighted average)
├── accuracyRate: number      # From Attempt domain (correct / total)
├── totalTournamentsJoined: number  # From Tournament domain
├── totalTournamentsWon: number    # From Tournament domain
└── longestStreak: number     # From Achievement domain
```

### Ranking Information

```
RankingView
├── globalRank: RankInfo | null       # From Ranking domain
├── weeklyRank: RankInfo | null       # From Ranking domain
├── monthlyRank: RankInfo | null      # From Ranking domain
├── peakAllTimeRank: number | null    # From Ranking domain
├── peakWeeklyRank: number | null     # From Ranking domain
├── peakMonthlyRank: number | null    # From Ranking domain
└── percentile: number                 # Computed from totalParticipants
```

Where `RankInfo`:

```
RankInfo
├── rank: number
├── xp: number
├── totalParticipants: number
├── percentile: number
├── percentileLabel: string  # "Top 1%", "Top 5%", etc.
└── xpToNextRank: number | null
```

### Achievement Information

```
AchievementView
├── totalBadges: number
├── pinnedBadges: BadgeView[]      # From Profile domain (user selection)
├── recentBadges: BadgeView[]     # From Achievement domain (last 5)
└── milestoneProgress: MilestoneView[]
```

Where `BadgeView`:

```
BadgeView
├── badgeId: UUID
├── badgeType: string        # 'rank1', 'top10', 'streak_30', etc.
├── name: string
├── description: string
├── iconUrl: string | null
└── awardedAt: Date
```

### Activity Information

```
ActivityView
├── recentAttempts: AttemptSummary[]     # From Attempt domain
├── recentTournaments: TournamentSummary[]  # From Tournament domain
└── timeline: ActivityEvent[]            # Aggregated from all domains
```

---

## 4. Activity Timeline

### Event-Driven Architecture

The activity timeline is built by subscribing to domain events emitted by other modules. The User Profile Domain acts as an **event consumer**, not an event producer.

### Events to Subscribe To

| Event | Source Domain | Display on Profile | Reason |
|---|---|---|---|
| `attempt.completed` | Attempt | Yes | Shows engagement |
| `achievement.awarded` | Achievement | Yes | Celebrates milestones |
| `tournament.joined` | Tournament | Yes | Shows participation |
| `tournament.completed` | Tournament | Yes | Shows results |
| `tournament.won` | Tournament | Yes | Shows achievement |
| `rank.improved` | Ranking | Yes | Shows progress |
| `rank.milestone` | Ranking | Yes | Shows top-tier achievement |
| `period.reset.completed` | Ranking | No | Internal, not user-facing |
| `consistency.streak` | Achievement | Yes | Shows dedication |
| `badge.earned` | Achievement | Yes | Same as `achievement.awarded` |

### Events to Exclude

| Event | Reason for Exclusion |
|---|---|
| `auth.login` | Too noisy, no meaningful signal |
| `profile.updated` | Self-referential, infinite loop risk |
| `notification.sent` | Internal notification detail |
| `xp.added` | Too granular — shown as aggregate in stats |
| `email.sent` | Internal infrastructure detail |
| `password.changed` | Security-sensitive, private |

### Activity Event Structure

```
ActivityEvent
├── eventId: UUID
├── userId: UUID
├── eventType: ActivityEventType  # Union of subscribed domain events
├── title: string                # Human-readable title
├── description: string           # Human-readable description
├── metadata: Record<string, unknown>  # Domain-specific data
├── occurredAt: Date
└── visibility: 'public' | 'private'
```

### Timeline Composition Rules

1. **Sorted by `occurredAt` descending** — newest first
2. **Paginated** — return last 20 by default, cursor-based pagination
3. **Deduplicated** — if same event type fires multiple times within 1 hour, show only the latest
4. **Filtered by visibility** — private events only shown to the profile owner
5. **Enriched** — raw events are enriched with display data (e.g., quiz title, badge name, rank number)
6. **Limited to last 90 days** — older events are pruned from the timeline view

---

## 5. Statistics Strategy

### Three Categories of Statistics

```
┌─────────────────────────────────────────────────────────┐
│                   Real-Time Statistics                   │
│  (Computed on every read from source of truth)          │
│                                                          │
│  • Total Attempts count      (Attempt domain)            │
│  • Total Badges count        (Achievement domain)        │
│  • Current ranks             (Ranking domain)            │
│  • Tournament participation  (Tournament domain)        │
│                                                          │
│  Tradeoff: Always accurate, higher read latency          │
│  Use for: Critical values shown on profile header        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Cached Statistics                     │
│  (Refreshed on domain events, served from cache)        │
│                                                          │
│  • Average Score                 (recalculate on attempt) │
│  • Accuracy Rate                (recalculate on attempt) │
│  • Total XP                     (recalculate on xp.add) │
│  • Peak Rank                    (recalculate on rank.ch) │
│                                                          │
│  Tradeoff: Near-real-time, low read latency             │
│  Use for: Statistics section of profile                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 Aggregated Statistics                   │
│  (Computed from cached or real-time on demand)          │
│                                                          │
│  • Percentile                   (rank / total)          │
│  • XP to next rank              (leaderboard gap)       │
│  • Rank trend                   (compare to history)    │
│  • Achievement rate             (badges / time)         │
│                                                          │
│  Tradeoff: Computed at read time, fast enough with cache │
│  Use for: Derived metrics in ranking section            │
└─────────────────────────────────────────────────────────┘
```

### Recommended Approach

**Layered caching with event-driven invalidation:**

```
Request for Profile Statistics
         │
         ▼
    Check Redis Cache
         │
    ┌────┴────┐
    │ Cache   │
    │ HIT     │
    │         │
    └────┬────┘
         │
    ┌────┴────┐
    │ Cache   │
    │ MISS    │
    │         │
    └────┬────┘
         │
    Query Source Domains
    (Ranking, Attempt, Achievement, Tournament)
         │
         ▼
    Cache Results in Redis
    (TTL: 5 minutes for stats, 1 minute for ranks)
         │
         ▼
    Return to Client
```

**Cache invalidation events:**

- `attempt.completed` → invalidate average score, accuracy rate, total attempts
- `xp.added` → invalidate total XP, current rank
- `rank.changed` → invalidate rank, percentile, peak rank
- `achievement.awarded` → invalidate badge count, recent badges

**Why this approach:**

- Real-time stats are too expensive on every request (would hit 4+ domains)
- Eventual consistency is acceptable for profile views (not a financial system)
- Cache invalidation via domain events keeps data fresh within seconds
- TTL fallback ensures stale data is eventually refreshed even if events are missed

---

## 6. Privacy Rules

### Information Classification

```
┌─────────────────────────────────────────────────────────┐
│                     PUBLIC                              │
│  Visible to anyone, including unauthenticated users    │
│                                                          │
│  • Username                                             │
│  • Display name                                         │
│  • Avatar                                               │
│  • Public badges (non-hidden)                           │
│  • Public ranks (if profile is public)                 │
│  • Public statistics (if enabled)                       │
│  • Public activity timeline (if enabled)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     PRIVATE                             │
│  Visible only to the profile owner                     │
│                                                          │
│  • Email address                                        │
│  • Account creation date                                │
│  • Private badges (if any)                              │
│  • Hidden statistics                                    │
│  • Hidden activity                                      │
│  • Notification preferences                             │
│  • Private tournament history                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     CONDITIONAL                         │
│  Visible based on user preferences (ProfileSettings)   │
│                                                          │
│  • Bio                   (show_bio setting)             │
│  • Statistics section    (show_statistics setting)      │
│  • Achievements section  (show_achievements setting)    │
│  • Activity timeline     (show_activity setting)        │
│  • Rank improvement notifs (show_rank_improvement)      │
│  • Tournament activity   (show_tournament_activity)     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     HIDDEN                              │
│  Never visible on public profile, owner-only audit      │
│                                                          │
│  • Password and auth credentials                        │
│  • Session tokens                                       │
│  • Internal domain events                              │
│  • Admin-only audit logs                                │
└─────────────────────────────────────────────────────────┘
```

### Privacy Enforcement Strategy

Privacy must be enforced at the **query layer**, not at the domain level. Each domain owns its data and provides raw access. The User Profile Domain's query services apply privacy rules before returning data.

```
ProfileQueryService.getProfile(userId, requesterId)
├── If requesterId === userId → return full profile (PUBLIC + PRIVATE)
├── If profile.visibility === PUBLIC → return PUBLIC + CONDITIONAL
└── If profile.visibility === PRIVATE → return minimal public info only
```

**Rule:** Privacy settings live in the Profile domain, not in source domains. Ranking does not know about profile privacy — it returns raw ranks. Profile applies the privacy filter.

### Privacy Change Handling

When a user changes privacy settings:

1. `ProfileSettings` aggregate is updated (command)
2. Event `profile.settings.changed` is emitted
3. Profile query layer recomputes what's visible
4. No data is deleted from source domains — privacy is a presentation filter

---

## 7. Future Expansion Design

### Design Principles for Extensibility

1. **The ProfileReadModel is open for extension, closed for modification** — new fields can be added without changing the structure
2. **Activity events use a tagged union pattern** — new event types are added to the union, not bolted on
3. **Ports and adapters isolate dependencies** — adding friends/followers does not touch Profile core
4. **Aggregate is small by design** — pinned content, settings, identity. Everything else is composed

### Friends and Followers

```
SocialGraphPort (new port, injected into Profile)
├── getFriends(userId): Promise<UserSummary[]>
├── getFollowers(userId): Promise<UserSummary[]>
├── getFollowing(userId): Promise<UserSummary[]>
├── isFollowing(requesterId, targetId): Promise<boolean>
└── isFriend(requesterId, targetId): Promise<boolean>
```

ProfileReadModel extends:

```
ProfileReadModel
├── ...
├── social: SocialView | null  # null if social feature disabled
└──

SocialView
├── followerCount: number
├── followingCount: number
├── friendCount: number
├── isFollowing: boolean        # relative to requester
└── isFriend: boolean          # relative to requester
```

The SocialGraph port is a new dependency. The Profile aggregate does not change. The ProfileReadModel adds a `social` field.

### Activity Feeds

```
ActivityFeedPort (new port)
├── getFeed(userId, cursor): Promise<FeedItem[]>
├── getFriendsFeed(userId, cursor): Promise<FeedItem[]>
└── getGlobalFeed(cursor): Promise<FeedItem[]>
```

The User Profile domain already has the activity timeline infrastructure (event subscriptions, timeline composition). Activity feeds are a natural extension — the same event aggregation logic applies, with different filtering and ordering rules.

### Reputation Systems

Reputation is a **derived metric**, not an owned entity. Design it as a computed field that can be extended:

```
ReputationView (new, added to ProfileReadModel)
├── score: number
├── breakdown: ReputationBreakdown
└── level: ReputationLevel

ReputationBreakdown
├── fromQuizzes: number    # Weighted by attempt count and accuracy
├── fromTournaments: number
├── fromAchievements: number
└── fromConsistency: number
```

Reputation calculation logic lives in a new `ReputationService` (domain service). It queries existing ports (Ranking, Achievement, Tournament) and computes a score. The ProfileReadModel includes it as an optional computed field.

### Reputation vs. Ranking

```
Ranking   → Competitive position: "You are #42 globally"
Reputation → Community standing: "You are a Trusted Contributor"
```

These are **orthogonal signals**. A user can have a high rank but low reputation (new account, single viral score) or low rank but high reputation (long-term community member). Keep them separate.

### Module Dependency Map (Future State)

```
User Profile Domain
├── Depends on: User, Ranking, Achievement, Attempt, Tournament
├── (Future) Depends on: Social (new module)
└── (Future) Depends on: Reputation (new service)

Achievement Domain
├── Depends on: Ranking (for rank-based badges)
└── No dependencies on Profile

Ranking Domain
├── No dependencies on Profile
└── No dependencies on Achievement

Social Domain (future)
├── Depends on: User
├── Publishes: follow.created, follow.removed, friend.requested, etc.
└── Consumed by: Profile (activity feed)
```

---

## 8. Summary

### Domain Overview

```
User Profile Domain
│
├── Core Responsibility
│   Public-facing user profile: identity presentation, aggregated
│   statistics, activity timeline, and achievement showcase
│
├── Boundaries
│   Owns: Profile aggregate, ProfileSettings, ActivityTimeline,
│         ProfileReadModel composition, privacy enforcement
│   Consumes: Ranking, Achievement, Attempt, Tournament, User
│   Never owns: XP, ranks, badges, attempts, tournament standings
│
├── Key Principle
│   Profile is an aggregator, not an owner. It presents data from
│   other domains with privacy applied and presentation enriched.
│
└── Architecture
    CQRS-lite: Profile (write) + ProfileReadModel (read)
    Event-driven timeline: Subscribes to all activity domains
    Layered caching: Event invalidation + TTL fallback
```

### Module Structure (Future Target)

```
src/modules/user-profile/
├── user-profile.module.ts

├── domain/
│   ├── aggregates/
│   │   ├── profile.aggregate.ts          # Write model
│   │   └── profile-settings.aggregate.ts  # Privacy settings
│   ├── services/
│   │   ├── profile-query.service.ts       # Builds ProfileReadModel
│   │   ├── activity-timeline.service.ts   # Composes timeline
│   │   └── statistics-aggregation.service.ts
│   ├── ports/
│   │   ├── ranking-query.port.ts          # Query ranking data
│   │   ├── achievement-query.port.ts     # Query badge data
│   │   ├── attempt-query.port.ts         # Query attempt data
│   │   ├── tournament-query.port.ts       # Query tournament data
│   │   └── social-graph.port.ts          # Future: friends/followers
│   ├── events/
│   │   ├── profile.events.ts
│   │   └── profile.event-handler.ts       # Consumes external events
│   ├── types/
│   │   ├── profile.types.ts
│   │   ├── activity.types.ts
│   │   └── statistics.types.ts
│   └── errors/
│
├── infrastructure/
│   ├── caching/
│   │   └── profile-cache.service.ts       # Redis caching layer
│   └── query/
│       └── profile-read-model.builder.ts  # Composes read model
│
└── transport/  (minimal — this is a read-heavy domain)
    └── controller/
        └── profile.controller.ts          # GET /profiles/:userId
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Profile owns presentation identity, User owns account identity | Different lifecycles and mutation patterns |
| ProfileReadModel is composed, not stored | Single source of truth in each domain; no data duplication |
| Activity timeline is event-driven | Decouples Profile from domain internals; new domains can add events without modifying Profile |
| Statistics use event-driven cache invalidation | Balances freshness and performance; avoids N+1 queries |
| Privacy is a presentation filter, not a data constraint | Source domains don't need to know about privacy; Profile applies it |
| Social/reputation are ports, not core entities | Profile aggregate stays small; new capabilities are additive |
| Reputation is computed, not stored | Prevents sync issues with source domains |
