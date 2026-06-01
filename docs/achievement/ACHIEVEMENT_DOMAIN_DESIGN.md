# Achievement Domain — Architecture Design

> **Document Version**: 1.1
> **Created**: 2026-06-01
> **Status**: Design Complete - Aligned with Existing Schema

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema Alignment](#2-schema-alignment)
3. [Domain Boundaries](#3-domain-boundaries)
4. [Achievement Lifecycle](#4-achievement-lifecycle)
5. [Badge Taxonomy](#5-badge-taxonomy)
6. [Evaluation Strategy](#6-evaluation-strategy)
7. [Progress Tracking](#7-progress-tracking)
8. [Badge Rule System](#8-badge-rule-system)
9. [Event Integration](#9-event-integration)
10. [Achievement History](#10-achievement-history)
11. [Future Evolution](#11-future-evolution)
12. [Summary](#12-summary)

---

# 1. Overview

## 1.1 Purpose

The Achievement Domain serves as the authoritative source of truth for gamification accomplishments across the quiz platform. It evaluates user actions, awards badges, tracks progress, and maintains achievement history while remaining decoupled from source domains that generate activity data.

## 1.2 Core Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| Badge Definition | Catalog of all badge types with their evaluation criteria | Implemented (`badges` table) |
| Badge Rules | Flexible rule configuration for badge conditions | Implemented (`badgeRules` table) |
| Badge Grants | Records of which user earned which badge with metadata | Implemented (`userBadges` table) |
| Progress Tracking | Real-time progress toward incremental achievements | Implemented (`userBadges.progress` JSONB) |
| Achievement History | Immutable audit trail of all awards | Design below |
| Streak Evaluation | Evaluate streak thresholds for badge awards | Achievement reads from User Domain |

**Note:** Streak *calculation* belongs to User Domain. Achievement Domain only evaluates streak thresholds for badge awards.

## 1.3 Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                      DESIGN PRINCIPLES                           │
│                                                                  │
│  1. ACHIEVEMENT DOMAIN DOES NOT OWN ACTIVITY DATA               │
│     - Badges are consequences of activity, not activity itself   │
│     - XP belongs to Ranking, attempts belong to Attempt          │
│                                                                  │
│  2. BADGES ARE DOMAIN-AGNOSTIC EVALUATORS                      │
│     - Subscribe to events from all domains                       │
│     - Query source domains only for context data                 │
│                                                                  │
│  3. PROGRESS IS STORED AND COMPUTED                             │
│     - Use existing `userBadges.progress` JSONB field            │
│     - Update progress on events, compute on reads                │
│                                                                  │
│  4. RULES ARE CONFIGURATION, NOT CODE                           │
│     - Use existing `badgeRules.config` JSONB field              │
│     - New rule types added via enum extension + evaluator       │
│                                                                  │
│  5. PROFILE OWNS SHOWCASE, ACHIEVEMENT OWNS DECISIONS          │
│     - Profile decides which badges to display                    │
│       (via `userProfiles.pinnedBadgeIds`)                       │
│     - Achievement decides which badges were earned              │
│                                                                  │
│  6. STREAKS BELONG TO USER DOMAIN                              │
│     - User Domain calculates and stores streak data              │
│     - Achievement Domain reads streak for evaluation              │
│     - Achievement never calculates streaks                       │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. Schema Alignment

## 2.1 Existing Schema Overview

Your codebase already has a solid foundation for the Achievement Domain:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXISTING SCHEMA STRUCTURE                            │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         badges (catalog)                              │   │
│   │                                                                      │   │
│   │  badgeId    - UUID primary key                                       │   │
│   │  slug       - unique identifier (e.g., "top-10-weekly")             │   │
│   │  type       - badgeType enum (diamond, platinum, gold, silver,       │   │
│   │               bronze)                                                │   │
│   │  name       - display name                                           │   │
│   │  description - user-facing description                               │   │
│   │  iconUrl    - badge icon                                            │   │
│   │  isActive   - soft delete / deprecation flag                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ 1:N                                    │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         badgeRules (evaluation)                       │   │
│   │                                                                      │   │
│   │  ruleId     - UUID primary key                                       │   │
│   │  badgeId    - foreign key to badges                                 │   │
│   │  ruleType   - badgeRuleType enum                                    │   │
│   │  priority   - evaluation order (higher = evaluated first)           │   │
│   │  config     - JSONB rule configuration                              │   │
│   │  isActive   - soft delete flag                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         userBadges (grants)                          │   │
│   │                                                                      │   │
│   │  userBadgeId - UUID primary key                                     │   │
│   │  userId      - foreign key to users                                 │   │
│   │  badgeId     - foreign key to badges                               │   │
│   │  earnedAt    - when badge was awarded                              │   │
│   │  progress    - JSONB for incremental achievement tracking            │   │
│   │  metadata    - JSONB for award context                              │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Existing Enums

### badgeType (already implemented)

```
diamond   → Elite tier, hardest to earn
platinum  → Advanced tier
gold      → Intermediate tier
silver    → Beginner tier
bronze    → Starter tier, easiest to earn
```

### badgeRuleType (already implemented)

| Rule Type | Purpose | Example Config |
|-----------|---------|----------------|
| `count` | Count occurrences of an event | `{ metric: "quizzes_completed", threshold: 10, operator: ">=" }` |
| `rank` | Check rank position | `{ period: "all_time", threshold: 10, operator: "<=" }` |
| `rank_period` | Check rank in specific period | `{ period: "weekly", threshold: 5, operator: "<=" }` |
| `streak` | Check consecutive days | `{ threshold: 30, operator: ">=" }` |
| `tournament_win` | Count tournament wins | `{ threshold: 1, operator: ">=" }` |
| `perfect_score` | Count perfect scores | `{ threshold: 10, operator: ">=" }` |
| `xp_total` | Check total XP | `{ threshold: 5000, operator: ">=" }` |

### activityEventType (existing, for event subscriptions)

```
attempt_completed      → Quiz attempt finished
achievement_awarded    → Badge earned (self-event)
tournament_joined      → User joined tournament
tournament_completed   → Tournament finished
tournament_won         → User won tournament
rank_improved          → Rank moved up
rank_milestone         → Reached rank threshold
streak_milestone       → Reached streak threshold
```

## 2.3 Recommended Schema Extensions

Based on the design, the following enhancements are recommended:

### 2.3.1 badges Table Extension

```typescript
// Add to badges table for seasonal/limited-time support
validFrom: timestamp('valid_from', { withTimezone: true, mode: 'string' })
validUntil: timestamp('valid_until', { withTimezone: true, mode: 'string' })
isHidden: boolean('is_hidden').default(false).notNull()

// Add version tracking
version: text('version').default('1.0.0').notNull()
```

### 2.3.2 New Enum Additions

```typescript
// Extend badgeRuleType for future rule types
export const badgeRuleType = pgEnum('badge_rule_type', [
  'count',
  'rank',
  'rank_period',
  'streak',
  'tournament_win',
  'perfect_score',
  'xp_total',
  'seasonal',        // NEW: Event participation
  'social',          // NEW: Friend/referral achievements
]);

// NEW: Badge category for taxonomy
export const badgeCategory = pgEnum('badge_category', [
  'quiz',            // Quiz completion badges
  'xp',              // XP milestone badges
  'ranking',         // Rank achievement badges
  'tournament',      // Tournament badges
  'consistency',     // Streak badges
  'event',           // Limited-time event badges
  'special',         // Hidden, invite, special badges
  'seasonal',        // Seasonal badges
]);
```

### 2.3.3 userBadges Extension

```typescript
// Add for seasonal badge expiration tracking
expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' })

// Add for version tracking at award time
badgeVersion: text('badge_version').default('1.0.0').notNull()

// Add for revocation support (rare cases only)
revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' })
revocationReason: text('revocation_reason')
```

## 2.4 Cross-Domain Data Access

The following data exists in other domains but should be queried by Achievement Domain for evaluation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-DOMAIN DATA QUERY PATTERNS                          │
│                                                                              │
│   Data Needed                    Source Domain    Query Pattern               │
│   ───────────────────────────── ──────────────── ─────────────────────────── │
│   Quiz completion count         quizAttempts    COUNT WHERE status=          │
│   Perfect score count          quizAttempts    COUNT WHERE score=100         │
│   Current XP                   user_ranking    SELECT all_time_xp            │
│   Current rank                 user_ranking    SELECT weekly_rank            │
│   Peak rank                    user_ranking    SELECT peak_all_time          │
│   Tournament wins              tournament_     COUNT WHERE rank=1            │
│                                 participants                              │
│   Daily activity dates         user_activity_  Query activity dates          │
│                                 events                                      │
│   Current streak               users           SELECT current_streak         │
│   Account age                  users           SELECT created_at             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Important:** Achievement Domain should query this data via ports/adapters, not directly access other domain's repositories.

---

# 3. Domain Boundaries

## 3.1 What Belongs Inside Achievement Domain

| Concern | Rationale |
|---------|-----------|
| Badge definitions | The catalog of all badge types (via `badges` table) |
| Badge evaluation | Logic determining when a badge should be awarded based on rules |
| Badge grants | Which user earned which badge (`userBadges` table) |
| Progress tracking | Current progress toward incomplete achievements (`userBadges.progress` JSONB) |
| Achievement history | Immutable audit trail of all awards |
| Streak evaluation | Evaluating streak thresholds for badge awards (reads from User Domain) |
| Rule engine | Interpretation and execution of badge rule configurations (`badgeRules.config` JSONB) |

**Note:** Achievement Domain does NOT calculate streaks. It only reads streak data from User Domain to evaluate badge conditions.

## 3.2 What Belongs Inside User Domain

| Concern | Why It Stays in User |
|---------|---------------------|
| Streak calculation | Consecutive activity streak calculations and storage |
| Streak data | Current streak, longest streak (`users.currentStreak`, `users.longestStreak`) |
| Streak reset logic | When and how to reset streaks on inactivity |

**Key Insight:** User Domain owns streak calculation. Achievement Domain reads streak values from User Domain via ports to evaluate streak-based badges.

## 3.3 What Belongs Inside Ranking Domain

| Concern | Why It Stays in Ranking |
|---------|------------------------|
| XP ledger | Raw XP amounts per period (via `user_ranking` table) |
| Rank calculation | The RANK() algorithm, tie-breaking rules |
| Leaderboard data | Who is #1, #2, #3 globally |
| Period reset logic | Weekly/monthly XP reset mechanics |
| Peak rank tracking | Historical peak rank per period (`peak_all_time_rank`, etc.) |

**Key Insight:** Ranking computes competitive standing. Achievement rewards reaching certain standings. Achievement queries Ranking to evaluate badges but never owns rank data.

## 3.4 What Belongs Inside User Profile Domain

| Concern | Why It Stays in Profile |
|---------|------------------------|
| Profile identity | Display name, avatar, bio |
| Profile settings | Visibility preferences (`user_profile_settings` table) |
| Pinned badges | User-curated badge showcase selection (`user_profiles.pinnedBadgeIds` JSONB) |
| Badge presentation | Which badges to show, in what order |
| Profile statistics | Aggregated statistics view |

**Key Insight:** Profile owns the *curated display* of achievements. Achievement owns the *award decisions*. These are distinct responsibilities.

## 3.5 What Belongs Inside Tournament Domain

| Concern | Why It Stays in Tournament |
|---------|---------------------------|
| Tournament participation | Enrollment, bracket, results (`tournament_participants` table) |
| Tournament standings | Tournament-specific rankings |
| Match outcomes | Who beat whom, when |

**Key Insight:** Tournament determines who wins. Achievement rewards tournament winners with badges. Achievement subscribes to tournament events but never manages tournament data.

## 3.6 What Belongs Inside Attempt Domain

| Concern | Why It Stays in Attempt |
|---------|------------------------|
| Individual attempt records | Each quiz attempt with score, time, answers (`quiz_attempts` table) |
| Attempt history | Full audit trail of every attempt |
| Score calculation | How scores are computed |

**Key Insight:** Attempt tracks quiz performance. Achievement rewards reaching certain performance thresholds. Achievement queries attempt data through ports but never owns attempt records.

## 3.7 Overlap Resolution Rules

```
Rule 1: Raw activity data (XP, attempts, ranks) → Respective source domain
Rule 2: Award decisions (badges earned) → Achievement Domain
Rule 3: Award display (pinned badges, showcase) → User Profile Domain
Rule 4: Evaluation context (progress) → Computed at eval time from source domains
Rule 5: Award history (audit trail) → Achievement Domain
Rule 6: Streak calculation → User Domain
Rule 7: Streak evaluation for badges → Achievement Domain (reads from User Domain)
```

## 3.7 Dependency Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN DEPENDENCY GRAPH                       │
│                                                                  │
│                        ┌─────────────┐                          │
│                        │    User     │                          │
│                        │   Domain    │                          │
│                        │ (streaks,   │                          │
│                        │  activity)  │                          │
│                        └──────┬──────┘                          │
│                               │                                  │
│                               │ reads streak data                │
│                               ▼                                  │
│          ┌────────────────────┼────────────────────┐            │
│          │                    │                    │            │
│          ▼                    ▼                    ▼            │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │   Attempt   │     │  Ranking    │     │ Tournament  │   │
│   │   Domain    │     │   Domain    │     │   Domain    │   │
│   │ (quiz_      │     │(user_       │     │(tournament_ │   │
│   │  attempts)  │     │ ranking)    │     │ participants)│   │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │
│          │                   │                    │             │
│          │                   │                    │             │
│          └───────────────────┼────────────────────┘             │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                         │
│                    │  Achievement    │                         │
│                    │     Domain      │                         │
│                    │  (badges,      │                         │
│                    │   user_badges, │                         │
│                    │   badge_rules)  │                         │
│                    └────────┬────────┘                         │
│                             │                                  │
│                             ▼                                  │
│                    ┌─────────────────┐                         │
│                    │   User Profile  │                         │
│                    │     Domain      │                         │
│                    │ (pinnedBadges) │                         │
│                    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

Legend:
- Solid arrows: Domain events (downstream consumption)
- Dashed arrow: Query-only access via ports (Achievement reads from User Domain for streaks)
- Achievement NEVER calculates streaks - only User Domain does

Achievement Domain:
- Subscribes to: Attempt, Ranking, Tournament, User (events)
- Reads from: User Domain (streak values), Ranking (XP, rank), Attempt (attempts)
- Is queried by: User Profile
- Never imports business logic from other domains
```

---

# 4. Achievement Lifecycle

## 4.1 Complete Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACHIEVEMENT LIFECYCLE                                │
│                                                                              │
│   USER ACTION                                                                │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │   Source    │────▶│   Domain    │────▶│Achievement  │                  │
│   │   Domain    │     │   Event     │     │  Evaluator  │                  │
│   │  (Attempt,  │     │  Emitted    │     │             │                  │
│   │  Ranking,   │     │             │     │             │                  │
│   │ Tournament) │     └─────────────┘     └──────┬──────┘                  │
│   └─────────────┘                                  │                        │
│                                                      │                        │
│                                                      ▼                        │
│                                              ┌─────────────┐                │
│                                              │  Badge Rule │                │
│                                              │   Engine    │                │
│                                              │(badgeRules. │                │
│                                              │  config)    │                │
│                                              └──────┬──────┘                │
│                                                      │                        │
│                           ┌──────────────────────────┼──────────────────┐   │
│                           │                          │                  │   │
│                           ▼                          ▼                  ▼   │
│                    ┌─────────────┐            ┌─────────────┐     ┌─────────────┐
│                    │   Badge     │            │   Badge     │     │   Badge     │
│                    │  NOT YET    │            │  EARNED     │     │   SKIPPED   │
│                    │  EARNED     │            │  (Awarded)  │     │  (Already   │
│                    │             │            │             │     │   Owned)    │
│                    └──────┬──────┘            └──────┬──────┘     └─────────────┘
│                           │                          │                        │
│                           ▼                          ▼                        │
│                    ┌─────────────┐            ┌─────────────┐                │
│                    │   Update    │            │   Create    │                │
│                    │   Progress  │            │ UserBadge   │                │
│                    │ (userBadges │            │  Record     │                │
│                    │ .progress)  │            │             │                │
│                    └─────────────┘            └──────┬──────┘                │
│                                                       │                      │
│                           ┌───────────────────────────┴──────────────────┐   │
│                           │                                          │      │
│                           ▼                                          ▼      │
│                    ┌───────────┐                              ┌───────────┐│
│                    │  Profile  │                              │Notification││
│                    │  Domain   │                              │  Domain   ││
│                    │(pinned    │                              │           ││
│                    │ Badges)   │                              │           ││
│                    └───────────┘                              └───────────┘│
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Stage Explanations

### Stage 1: User Action

The user performs an activity in the system:
- Completes a quiz attempt
- Earns XP from ranking
- Wins a tournament
- Maintains a daily streak

**Ownership:** Source domain (Attempt, Ranking, Tournament)

### Stage 2: Domain Event

The source domain emits a domain event capturing the action:

```typescript
// From existing activityEventType enum:
attempt.completed
├── userId: UUID
├── attemptId: UUID
├── quizId: UUID
├── score: number
├── maxScore: number
├── accuracy: number
├── timeSpentMs: number
├── xpEarned: number
└── timestamp: Date

rank.milestone
├── userId: UUID
├── rank: number
├── percentile: number
├── period: 'weekly' | 'monthly' | 'all_time'
└── timestamp: Date

tournament.won
├── userId: UUID
├── tournamentId: UUID
├── finalRank: number
├── totalParticipants: number
└── timestamp: Date
```

**Ownership:** Source domain emits; Achievement domain consumes.

### Stage 3: Achievement Evaluation

The Achievement Evaluator receives the event and processes it:

```typescript
AchievementEvaluationService.evaluate(event: DomainEvent)
├── 1. Identify applicable badge rules for this event type
│   └── Query `badgeRules` table WHERE ruleType matches event
├── 2. For each rule, query current progress from source domains
│   └── Use ports to query Attempt, Ranking, Tournament data
├── 3. Apply rule logic to determine if threshold is met
│   └── Use `badgeRules.config` JSONB for rule parameters
├── 4. For multi-step achievements, update progress record
│   └── Update `userBadges.progress` JSONB
└── 5. If threshold met and not already earned → award badge
    └── Insert into `userBadges` table
```

**Key Behavior:** Evaluation is idempotent. Re-evaluating the same event for the same user should not produce duplicate awards.

### Stage 4: Badge Awarded

If evaluation determines the badge is earned:

```typescript
// Created in userBadges table:
userBadges record created:
├── userBadgeId: UUID
├── badgeId: UUID (references `badges.badgeId`)
├── userId: UUID
├── earnedAt: Date
├── progress: {} (empty for instant badges)
└── metadata: {
      eventId: UUID,
      eventType: string,
      context: { ... }
    }
```

**Important:** The `metadata` field captures the specific context of the award (e.g., the exact rank achieved, the tournament won). This allows historical accuracy even if badge definitions change.

### Stage 5: Profile Updated

The achievement.awarded event propagates to consuming domains:

```
Consuming Domains:

User Profile Domain:
├── Updates `userProfiles.pinnedBadgeIds` if user chooses to pin
├── Adds to activity timeline (`userActivityEvents`)
└── Triggers cache invalidation for badge count

Notification Domain:
├── Sends achievement notification to user
├── Includes badge details and metadata
└── Respects user notification preferences

Analytics Domain:
├── Tracks achievement rate metrics
├── Records time-to-earn for cohort analysis
└── Monitors badge popularity
```

---

# 5. Badge Taxonomy

## 5.1 Category Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BADGE CATEGORY HIERARCHY                             │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     ACHIEVEMENT DOMAIN                                │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │    QUIZ     │  │     XP      │  │   RANKING   │                 │   │
│   │   │   BADGES    │  │   BADGES    │  │   BADGES    │                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │   │  TOURNAMENT │  │CONSISTENCY │  │    EVENT    │                 │   │
│   │   │   BADGES    │  │   BADGES    │  │   BADGES    │                 │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   │   ┌─────────────┐  ┌─────────────┐                                   │   │
│   │   │   SPECIAL   │  │  SEASONAL  │                                   │   │
│   │   │   BADGES    │  │   BADGES    │                                   │   │
│   │   └─────────────┘  └─────────────┘                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   BADGE TIER HIERARCHY (via badgeType enum)                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  diamond   (hardest) → platinum → gold → silver → bronze (easiest) │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Quiz Badges

**Ownership:** Achievement Domain
**Purpose:** Reward engagement and performance in quiz-taking

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Completion | Complete a certain number of quizzes | First Quiz, 10 Quizzes, 100 Quizzes | `count` |
| Mastery | Achieve perfect or near-perfect scores | Perfect Score, Accuracy Master | `perfect_score` |
| Variety | Attempt quizzes in different categories | Category Explorer, All Categories | `count` |
| Difficulty | Complete hard or expert quizzes | Challenge Accepted, Expert Challenger | `count` |
| Speed | Complete quizzes quickly | Speed Demon, Lightning Fast | `count` |
| Streak | Correct answers in a row | On Fire, Unstoppable | `count` |

**Triggering Events:**
- `attempt.completed` (from Attempt Domain)

**Progress Queries:**
- Count of attempts by user (via `quiz_attempts` table)
- Perfect score count (via `quiz_attempts` WHERE score_percent = 100)
- Categories attempted (via `quiz_categories` join)

## 5.3 XP Badges

**Ownership:** Achievement Domain
**Purpose:** Reward cumulative experience accumulation

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Milestone | Reach XP thresholds | 1K XP, 10K XP, 100K XP | `xp_total` |
| Growth | Earn XP within time periods | Weekly Warrior, Monthly Master | `count` |
| Velocity | Earn XP at certain rates | Rising Star, Speed Leveler | `xp_total` |

**Triggering Events:**
- `xp.earned` (from Ranking Domain via event bridge)
- `rank.updated` (from Ranking Domain)

**Progress Queries:**
- Current total XP (via `user_ranking.all_time_xp`)
- XP earned in period (via `user_ranking.weekly_xp`, `monthly_xp`)
- XP rate calculation (computed from Ranking data)

**Design Note:** Achievement queries Ranking for XP totals but Ranking owns the XP ledger. Achievement only stores badge grants.

## 5.4 Ranking Badges

**Ownership:** Achievement Domain
**Purpose:** Reward competitive achievement

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Tier | Reach certain rank tiers | Top 100, Top 50, Top 10 | `rank` / `rank_period` |
| Percentile | Reach certain percentile thresholds | Top 1%, Elite, Legend | `rank` |
| Improvement | Achieve rank improvements | Rising Champion, Climbing Star | `rank` |
| Period Win | Win a ranking period | Weekly Champion, Monthly Champion | `rank_period` |

**Triggering Events:**
- `rank.updated` (from Ranking Domain)
- `rank.milestone` (from Ranking Domain - already in your enum!)

**Progress Queries:**
- Current rank (via `user_ranking.all_time_rank`, `weekly_rank`, etc.)
- Peak rank achieved (via `user_ranking.peak_all_time_rank`, etc.)
- Rank change delta (computed from Ranking data)

**Design Note:** Your `activityEventType` enum already includes `rank_milestone` - this is perfect for Achievement evaluation.

## 5.5 Tournament Badges

**Ownership:** Achievement Domain
**Purpose:** Reward tournament participation and success

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Participation | Join tournaments | First Tournament, Tournament Regular | `count` |
| Placement | Finish in top positions | Top 10 Finisher, Podium Finish | `tournament_win` |
| Victory | Win tournaments | Tournament Champion, Grandmaster | `tournament_win` |
| Consistency | Perform well across multiple tournaments | Consistent Competitor | `tournament_win` |

**Triggering Events:**
- `tournament.joined` (from Tournament Domain - already in your enum!)
- `tournament.completed` (from Tournament Domain - already in your enum!)
- `tournament.won` (from Tournament Domain - already in your enum!)

**Progress Queries:**
- Tournament participation count (via `tournament_participants` table)
- Tournament placements (via `tournament_participants.rank_final`)
- Tournament wins (via `tournament_participants` WHERE rank_final = 1)

## 5.6 Consistency Badges

**Ownership:** Achievement Domain
**Purpose:** Reward sustained engagement over time

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Daily Streak | Consecutive days of activity | 7-Day Streak, 30-Day Streak | `streak` |
| Weekly Streak | Consecutive weeks of activity | Monthly Dedication, Quarterly Champion | `streak` |
| Return | Return after absence | Welcome Back, Long Time No See | `streak` |

**Triggering Events:**
- `activity.daily` (computed internally)
- `streak.milestone` (from Ranking Domain - already in your enum!)
- `profile.created` (from User Domain)

**Internal Calculation:**
```
StreakService.calculateStreak(userId, period)
├── 1. Query activity dates from userActivityEvents table
├── 2. Find longest consecutive sequence
├── 3. Check if current date continues streak
└── 4. Return streak count and status
```

**Design Note:** Your `users` table already has `currentStreak` and `longestStreak` columns - Achievement can query these directly.

## 5.7 Event Badges

**Ownership:** Achievement Domain
**Purpose:** Reward participation in limited-time events

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Launch | Participate at platform launch | Pioneer, Early Adopter | `count` |
| Anniversary | Participate in anniversary events | 1-Year Member, Anniversary Champion | `seasonal` |
| Seasonal | Participate in seasonal events | Summer Champion, Winter Wonderland | `seasonal` |
| Collaboration | Participate in partnership events | Crossover Champion | `seasonal` |

**Triggering Events:**
- `event.started` (from Event orchestration)
- `event.completed` (from Event orchestration)
- `event.special_badge_awarded` (from Event orchestration)

**Design Note:** Requires `seasonal` rule type extension (see Section 2.3.2).

## 5.8 Special Badges

**Ownership:** Achievement Domain
**Purpose:** Reward exceptional or unique accomplishments

| Badge Type | Description | Example | Rule Type |
|------------|-------------|---------|-----------|
| Hidden | Secret badges with unknown criteria | ??? | Special handling |
| Invite | Refer friends to platform | Ambassador, Influencer | `social` |
| Social | Social interactions | Popular, Helpful Community Member | `social` |
| Expert | Demonstrate category expertise | Category Master, Quiz Wizard | `count` |

**Design Note:** Hidden badges require `isHidden` field extension (see Section 2.3.1). Social badges require `social` rule type extension.

---

# 6. Evaluation Strategy

## 6.1 Strategy Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVALUATION STRATEGY COMPARISON                             │
│                                                                              │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐│
│   │     REAL-TIME       │  │    SCHEDULED        │  │      HYBRID         ││
│   │    EVALUATION       │  │    EVALUATION       │  │    EVALUATION       ││
│   ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤│
│   │                     │  │                     │  │                     ││
│   │  User completes     │  │  Background job     │  │  Real-time for      ││
│   │  action             │  │  runs every hour   │  │  immediate badges   ││
│   │       │             │  │       │             │  │       │             ││
│   │       ▼             │  │       ▼             │  │       ▼             ││
│   │  Achievement        │  │  Scans all users   │  │  Scheduled for      ││
│   │  evaluated          │  │  for badge         │  │  progress badges    ││
│   │  immediately        │  │  conditions        │  │                     ││
│   │                     │  │                     │  │                     ││
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Real-Time Evaluation

### Mechanism

```
Event occurs → Event handler triggered → Badge rules evaluated → Award if eligible
```

### Pros

| Advantage | Explanation |
|-----------|-------------|
| Immediate feedback | Users receive badges moments after earning them |
| High engagement | Instant gratification drives retention |
| Simple logic | No complex scheduling or state management |
| Predictable latency | Consistent evaluation time |

### Cons

| Disadvantage | Explanation |
|--------------|-------------|
| Higher compute per action | Every action triggers evaluation |
| Event handler complexity | Must handle all badge types in event handlers |
| Cross-domain complexity | Multiple events may need evaluation coordination |
| Scalability ceiling | Evaluation scales with action volume |

### Use Cases

```
Best for:
├── Immediate milestone badges (First Quiz Complete)
├── Simple single-action badges (Perfect Score)
├── High-impact badges (Top 10 Rank)
└── User-visible quick wins
```

## 6.3 Scheduled Evaluation

### Mechanism

```
Cron job (hourly) → Query users with pending progress → Evaluate badge rules → Award if eligible
```

### Pros

| Advantage | Explanation |
|-----------|-------------|
| Batch efficiency | Process many users in optimized queries |
| Flexible scheduling | Can adjust evaluation frequency |
| Reduced complexity | Simpler event handlers |
| Better resource utilization | Off-peak processing |

### Cons

| Disadvantage | Explanation |
|--------------|-------------|
| Delayed gratification | Users wait for badge awards |
| Stale progress | Progress shown may not reflect actual state |
| Complex state | Must track evaluation state per user |
| Missed opportunities | Users may lose streak during gap |

### Use Cases

```
Best for:
├── Progress-based badges (7/10 quizzes)
├── Streak maintenance (daily login check)
├── Complex multi-step achievements
└── Low-priority badges
```

## 6.4 Hybrid Strategy (Recommended)

### Mechanism

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HYBRID EVALUATION FLOW                               │
│                                                                              │
│   IMMEDIATE PATH (Real-Time)              DEFERRED PATH (Scheduled)          │
│   ┌─────────────────────────┐            ┌─────────────────────────┐       │
│   │  attempt.completed     │            │  Progress Tracking      │       │
│   │  rank.milestone         │            │  Badge Re-evaluation    │       │
│   │  tournament.won         │            │  Streak Validation       │       │
│   │  xp.milestone           │            │  Batch Badge Awards      │       │
│   └───────────┬─────────────┘            └───────────┬─────────────┘       │
│               │                                        │                     │
│               ▼                                        ▼                     │
│   ┌─────────────────────────┐            ┌─────────────────────────┐       │
│   │  Simple Badge Check    │            │  Complex Badge Check   │       │
│   │  Single condition      │            │  Multi-condition        │       │
│   │  No progress needed    │            │  Progress aggregation   │       │
│   └───────────┬─────────────┘            └───────────┬─────────────┘       │
│               │                                        │                     │
│               ▼                                        ▼                     │
│   ┌─────────────────────────┐            ┌─────────────────────────┐       │
│   │  Immediate Award       │            │  Batch Award Process    │       │
│   │  (if eligible)          │            │  (hourly/daily)         │       │
│   └─────────────────────────┘            └─────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Badge Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BADGE EVALUATION CLASSIFICATION                       │
│                                                                              │
│   IMMEDIATE BADGES (Real-Time)         DEFERRED BADGES (Scheduled)            │
│   ─────────────────────────           ──────────────────────────            │
│   • First action badges               • Progress-based badges               │
│   • Simple milestone badges           • Streak badges                       │
│   • Rank achievements                 • Time-bounded achievements            │
│   • Tournament victories              • Complex cross-domain badges          │
│   • XP thresholds                                                           │
│                                                                              │
│   EVALUATION TYPE IDENTIFIER                                                       │
│   badge.evaluationMode: 'immediate' | 'deferred' | 'both'                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Hybrid is Best

| Criterion | Real-Time | Scheduled | Hybrid |
|-----------|-----------|-----------|--------|
| User satisfaction | +++ | + | ++ |
| Implementation complexity | ++ | ++ | +++ |
| Scalability | ++ | +++ | +++ |
| Resource efficiency | ++ | +++ | ++ |
| Consistency | +++ | ++ | +++ |
| Missed achievements risk | None | High | Low |

**Recommendation:** Use hybrid approach where:
- Real-time handles simple, single-condition badges
- Scheduled handles complex, progress-aggregated badges
- Clear classification in badge definition prevents confusion

---

# 7. Progress Tracking

## 7.1 Progress Tracking Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROGRESS TRACKING MODES                              │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│   │     VISIBLE     │  │     HIDDEN      │  │   CONDITIONAL   │           │
│   ├─────────────────┤  ├─────────────────┤  ├─────────────────┤           │
│   │                 │  │                 │  │                 │           │
│   │  Show exact     │  │  Progress       │  │  Progress       │           │
│   │  progress to    │  │  tracked but    │  │  visible only   │           │
│   │  user: 7/10     │  │  not shown      │  │  after partial  │           │
│   │                 │  │                 │  │  completion     │           │
│   │  "7/10 quizzes"│  │  "???"         │  │  "7/? quizzes" │           │
│   │                 │  │                 │  │                 │           │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Implementation with Existing Schema

Your existing `userBadges` table already supports progress tracking:

```typescript
// userBadges.progress is JSONB
// Example progress structures:

// For count-based badges:
progress: {
  current: 7,
  target: 10,
  lastUpdated: "2026-06-01T10:00:00Z"
}

// For multi-step badges:
progress: {
  steps: {
    science_tournament: { completed: true, completedAt: "..." },
    history_tournament: { completed: false },
    sports_tournament: { completed: false },
    arts_tournament: { completed: false }
  },
  totalSteps: 4,
  completedSteps: 1
}

// For streak badges:
progress: {
  currentStreak: 25,
  longestStreak: 30,
  lastActivityDate: "2026-05-31"
}
```

## 7.3 Hidden Achievements

### Design

Hidden achievements reveal their existence only upon earning. Progress is never visible.

```typescript
// Requires isHidden extension to badges table
Badge Definition:
├── badgeId: 'secret_badge_1'
├── name: '???' (hidden until earned)
├── description: '???' (hidden until earned)
├── isHidden: true
└── revealCriteria: { earned: true }

Display Rules:
├── Before earning: Show nothing
├── Upon earning: Reveal name, description, icon
└── After earning: Normal badge display
```

## 7.4 Incremental Milestones

### Design

Achievements have multiple tiers, each requiring progressive thresholds.

```typescript
// Implemented via multiple badge definitions with tiered slugs
Badge Definition (Tier 1):
├── badgeId: 'quiz_apprentice'
├── slug: 'quiz-apprentice'
├── name: 'Quiz Apprentice'
└── rule: { type: "count", threshold: 10 }

Badge Definition (Tier 2):
├── badgeId: 'quiz_journeyman'
├── slug: 'quiz-journeyman'
├── name: 'Quiz Journeyman'
└── rule: { type: "count", threshold: 50 }

Badge Definition (Tier 3):
├── badgeId: 'quiz_champion'
├── slug: 'quiz-champion'
├── name: 'Quiz Champion'
└── rule: { type: "count", threshold: 100 }

// Or via single badge with tier tracking:
Badge Definition:
├── badgeId: 'quiz_master'
├── name: 'Quiz Master'
├── milestones: [10, 50, 100, 500]
└── progress: { currentTier: 2, currentProgress: 45 }
```

## 7.5 Progress Strategy Recommendation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDED PROGRESS STRATEGY                           │
│                                                                              │
│   DEFAULT: VISIBLE PROGRESS with COUNT FORMAT                                │
│                                                                              │
│   Configuration per badge:                                                  │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  ProgressDisplayConfig:                                             │    │
│   │  ├── visibility: 'visible' | 'hidden' | 'conditional'              │    │
│   │  ├── format: 'count' | 'percentage' | 'both'                       │    │
│   │  ├── showNextMilestone: boolean                                     │    │
│   │  └── conditionalRevealThreshold: number (for 'conditional' mode)     │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   PATTERN SELECTION:                                                         │
│   ├── Simple thresholds (complete X): Count with percentage                 │
│   ├── Tiered milestones: Multiple badge definitions with progressive counts   │
│   └── Secret badges: No progress, reveal on earn                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 8. Badge Rule System

## 8.1 Rule Architecture

Your existing schema already supports a flexible rule system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BADGE RULE ARCHITECTURE                             │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     BADGE DEFINITION                                 │   │
│   │                                                                      │   │
│   │  badges table:                                                        │   │
│   │  {                                                                  │   │
│   │    "badgeId": "...",                                                │   │
│   │    "slug": "quiz-master",                                           │   │
│   │    "type": "gold",  // badgeType enum                               │   │
│   │    "name": "Quiz Master",                                           │   │
│   │    "description": "Complete 100 quizzes"                            │   │
│   │  }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ 1:N                                    │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     BADGE RULE                                        │   │
│   │                                                                      │   │
│   │  badgeRules table:                                                   │   │
│   │  {                                                                  │   │
│   │    "ruleId": "...",                                                 │   │
│   │    "badgeId": "...",                                                │   │
│   │    "ruleType": "count",        // badgeRuleType enum               │   │
│   │    "priority": 0,                                                   │   │
│   │    "config": {                   // JSONB                           │   │
│   │      "metric": "quizzes_completed",                                 │   │
│   │      "threshold": 100,                                               │   │
│   │      "operator": ">="                                               │   │
│   │    },                                                               │   │
│   │    "isActive": true                                                 │   │
│   │  }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Supported Rule Types

### count (already implemented)

Counts occurrences of an event or entity.

```typescript
// badgeRules.config:
{
  "metric": "quizzes_completed",     // or "attempts", "tournaments_joined"
  "threshold": 10,
  "operator": ">=",
  "conditions": [                    // optional filters
    { "field": "quiz.category", "operator": "EQ", "value": "science" }
  ]
}
```

### rank (already implemented)

Checks rank position.

```typescript
// badgeRules.config:
{
  "period": "all_time",              // "all_time" | "weekly" | "monthly"
  "operator": "<=",
  "threshold": 10
}
```

### rank_period (already implemented)

Checks rank in specific period.

```typescript
// badgeRules.config:
{
  "period": "weekly",                // specific period check
  "operator": "<=",
  "threshold": 5
}
```

### streak (already implemented)

Validates streak continuity.

```typescript
// badgeRules.config:
{
  "operator": ">=",
  "threshold": 30
}
```

### tournament_win (already implemented)

Counts tournament wins.

```typescript
// badgeRules.config:
{
  "operator": ">=",
  "threshold": 1
}
```

### perfect_score (already implemented)

Counts perfect scores (100%).

```typescript
// badgeRules.config:
{
  "operator": ">=",
  "threshold": 10
}
```

### xp_total (already implemented)

Checks total XP.

```typescript
// badgeRules.config:
{
  "operator": ">=",
  "threshold": 5000
}
```

## 8.3 Rule Configuration Management

### Configuration Storage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RULE CONFIGURATION HIERARCHY                            │
│                                                                              │
│   SYSTEM RULES (Core)                                                        │
│   ├── Platform milestones                                                    │
│   ├── Essential progression badges                                           │
│   └── Hard-coded, deployment-required                                       │
│                                                                              │
│   ADMIN-CONFIGURED RULES (Dynamic)                                          │
│   ├── New badge definitions                                                  │
│   ├── Threshold adjustments                                                 │
│   ├── Limited-time events                                                   │
│   └── Stored in database, hot-reloadable via badgeRules table               │
│                                                                              │
│   EVENT-DRIVEN RULES (Temporary)                                           │
│   ├── Seasonal events                                                        │
│   ├── Collaboration events                                                   │
│   └── Auto-expire with event end                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rule Ownership

| Rule Type | Owner | Modification | Deployment Required |
|-----------|-------|--------------|-------------------|
| `count` | Achievement Domain | Via badgeRules CRUD | No |
| `rank` | Achievement Domain | Via badgeRules CRUD | No |
| `rank_period` | Achievement Domain | Via badgeRules CRUD | No |
| `streak` | Achievement Domain | Via badgeRules CRUD | No |
| `tournament_win` | Achievement Domain | Via badgeRules CRUD | No |
| `perfect_score` | Achievement Domain | Via badgeRules CRUD | No |
| `xp_total` | Achievement Domain | Via badgeRules CRUD | No |
| `seasonal` | Event Domain | Via event configuration | No |
| `social` | Achievement Domain | Code + rule | Yes |

## 8.4 Rule Extensibility

### Adding New Rule Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RULE EXTENSIBILITY FLOW                             │
│                                                                              │
│   1. Extend badgeRuleType enum:                                           │
│      "FRIEND_COUNT"                                                        │
│                                                                              │
│   2. Implement rule evaluator:                                               │
│      FriendCountRuleEvaluator implements RuleEvaluator                       │
│      ├── validate(badge, userId, context)                                   │
│      ├── evaluate(badge, userId, context)                                   │
│      └── getProgress(badge, userId)                                         │
│                                                                              │
│   3. Register in RuleEngine:                                                │
│      ruleEngine.register('FRIEND_COUNT', FriendCountRuleEvaluator)           │
│                                                                              │
│   4. Use in badge definition:                                              │
│      INSERT INTO badge_rules (rule_type, config)                           │
│      VALUES ('friend_count', '{"threshold": 10}')                          │
│                                                                              │
│   Impact: Code change + enum extension, no schema migration                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Future Achievement Examples

| Requirement | Rule Type | Config |
|-------------|-----------|--------|
| "Invite 10 friends" | `count` | `metric: 'invites_accepted', threshold: 10` |
| "Reach Top 10 Weekly Rank" | `rank_period` | `period: 'weekly', threshold: 10` |
| "Earn 5000 XP in a week" | `count` | `metric: 'weekly_xp', threshold: 5000` |
| "Complete 30-day streak" | `streak` | `threshold: 30` |
| "Win tournaments in different categories" | `count` | `metric: 'category_tournaments', threshold: 5` |
| "Complete Summer Event" | `seasonal` (new) | `eventId: 'summer_2026'` |

---

# 9. Event Integration

## 9.1 Event Consumption Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACHIEVEMENT DOMAIN EVENT CONSUMPTION                      │
│                                                                              │
│   SOURCE DOMAIN           EVENT                    TRIGGERS EVALUATION       │
│   ──────────────          ─────                    ───────────────────       │
│                                                                              │
│   Attempt                 attempt.completed     ✓  Quiz badges              │
│   Attempt                 attempt.started       ✗  (too granular)           │
│   Attempt                 attempt.abandoned     ?  (optional)               │
│                                                                              │
│   Ranking                 xp.earned              ✓  XP badges               │
│   Ranking                 rank.updated           ✓  Ranking badges           │
│   Ranking                 rank.milestone         ✓  Rank milestone badges     │
│   Ranking                 period.reset           ?  (batch evaluation)        │
│                                                                              │
│   Tournament              tournament.joined     ✓  Participation badges     │
│   Tournament              tournament.completed  ✓  Completion badges        │
│   Tournament              tournament.won        ✓  Victory badges           │
│                                                                              │
│   User                    profile.created       ✓  First-time badges        │
│   User                    user.deleted          ✗  (user no longer exists) │
│                                                                              │
│   Achievement (self)      achievement.awarded  ✗  (no recursive eval)      │
│   Achievement (self)      streak.updated        ✓  Streak badges           │
│                                                                              │
│   Event (future)          event.started         ✓  Event participation     │
│   Event (future)          event.completed      ✓  Event completion         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Events to Consume

### attempt.completed

```typescript
{
  "event": "attempt.completed",
  "source": "Attempt Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "Quiz completion badges (count)",
    "Perfect score badges (perfect_score)",
    "Category exploration badges",
    "Difficulty badges"
  ],
  "processingNotes": [
    "Query attempt details for rule evaluation",
    "Update progress for incremental badges",
    "Check for immediate badge awards"
  ]
}
```

### xp.earned / rank.updated

```typescript
{
  "event": "xp.earned / rank.updated",
  "source": "Ranking Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "XP milestone badges (xp_total)",
    "Rank achievement badges (rank, rank_period)",
    "Growth rate badges"
  ],
  "processingNotes": [
    "Use for both real-time and deferred evaluation",
    "Batch updates for progress badges",
    "Query user_ranking table for context"
  ]
}
```

### rank.milestone (already in your enum!)

```typescript
{
  "event": "rank.milestone",
  "source": "Ranking Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "Top 10 badge",
    "Top 50 badge",
    "Top 100 badge",
    "Percentile badges"
  ],
  "processingNotes": [
    "Your enum already has this event type - perfect!",
    "Contains pre-computed milestone context",
    "Use for immediate badge award"
  ]
}
```

### tournament.won / tournament.completed / tournament.joined (already in your enum!)

```typescript
{
  "event": "tournament.won / tournament.completed / tournament.joined",
  "source": "Tournament Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "Tournament victory badges (tournament_win)",
    "Placement badges",
    "Tournament participation badges (count)",
    "Grand Slam (multi-tournament) badges"
  ],
  "processingNotes": [
    "Your enum already has these event types!",
    "Query tournament_participants for context",
    "Evaluate badge rules for multi-tournament badges"
  ]
}
```

### profile.created

```typescript
{
  "event": "profile.created",
  "source": "User Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "First-steps badges",
    "Welcome badges"
  ],
  "processingNotes": [
    "Triggered once per user lifecycle",
    "Award onboarding badges immediately"
  ]
}
```

### streak.milestone (already in your enum!)

```typescript
{
  "event": "streak.milestone",
  "source": "Ranking or User Domain",
  "consumedBy": "Achievement Domain",
  "evaluationTargets": [
    "7-day streak badge",
    "30-day streak badge",
    "100-day streak badge"
  ],
  "processingNotes": [
    "Your enum already has this event type!",
    "Query users.currentStreak for validation"
  ]
}
```

## 9.3 Events NOT to Consume

| Event | Reason for Exclusion |
|-------|---------------------|
| `attempt.started` | Too granular, would cause excessive evaluations |
| `auth.login` | No meaningful achievement signal |
| `notification.sent` | Internal infrastructure detail |
| `email.sent` | Internal infrastructure detail |
| `xp.added` (granular) | Use `xp.earned` aggregate instead |
| `rank.recalculated` | Internal Ranking detail |
| `cache.invalidated` | Internal infrastructure detail |

## 9.4 Event Processing Patterns

### Immediate Processing (Real-Time)

```typescript
EventHandler: handleAttemptCompleted(event)
├── 1. Parse event payload
├── 2. Query badge rules by event type
│   └── SELECT * FROM badge_rules WHERE rule_type IN ('count', 'perfect_score')
├── 3. For each matching rule:
│   ├── Query current progress from source domains
│   ├── Evaluate rule condition
│   └── If eligible and not earned → award badge
└── 4. Emit achievement.awarded event
```

### Batch Processing (Deferred)

```typescript
ScheduledJob: evaluateDeferredBadges()
├── 1. Get all active progress-tracking badges
│   └── SELECT DISTINCT badge_id FROM badge_rules WHERE rule_type IN ('streak')
├── 2. For each badge:
│   ├── Query eligible users (users without this badge)
│   ├── For each user:
│   │   ├── Query current progress from source domains
│   │   ├── Evaluate completion conditions
│   │   ├── Update userBadges.progress
│   │   └── If threshold met → award badge
└── 3. Emit batch achievement.awarded events
```

### Event Ordering Guarantees

```
Requirements:
├── Events must be processed in order per user
├── Duplicate events must be idempotent
└── Out-of-order events must be handled gracefully

Implementation:
├── Use event versioning for schema evolution
├── Store last processed event ID per consumer
└── Validate state before award (check not already earned via unique constraint)
```

---

# 10. Achievement History

## 10.1 History Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACHIEVEMENT HISTORY PRINCIPLES                          │
│                                                                              │
│   1. IMMUTABILITY                                                           │
│      Awarded badges are permanent records. They cannot be deleted.           │
│      This preserves historical accuracy.                                     │
│                                                                              │
│   2. AUDIT TRAIL                                                            │
│      Every badge grant includes the context of earning.                      │
│      This allows historical accuracy even if criteria change.                │
│                                                                              │
│   3. NO REVOCATION                                                           │
│      Badges are not revoked when criteria change.                            │
│      Users keep badges they earned under previous rules.                      │
│                                                                              │
│   4. VERSION TRACKING                                                        │
│      Badge definitions are versioned.                                        │
│      Users earn the version active at award time.                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 History Record Structure

```typescript
// userBadges record (immutable):
{
  userBadgeId: UUID,                    // Unique identifier
  badgeId: UUID,                        // Reference to badge definition
  badgeVersion: "1.0.0",               // Version of badge at award time
  userId: UUID,                         // Recipient
  earnedAt: Date,                       // When earned
  progress: {},                         // Progress at award time
  metadata: {                           // Context at award time
    triggeringEventId: UUID,
    triggeringEventType: string,
    rankAchieved: number,
    xpAtTime: number,
    tournamentId: string,
    category: string,
    streakCount: number,
    ...
  }
}

// badges table (versioned):
{
  badgeId: UUID,
  version: "1.0.0",                    // Semantic version
  slug: "top-10-weekly",
  type: "diamond",
  name: "Top 10 Weekly",
  description: "Reach top 10 in weekly ranking",
  validFrom: Date,                      // When badge becomes available
  validUntil: Date | null,              // When badge expires
  isActive: boolean,
  isHidden: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 10.3 Revocation Strategy

### Why Revocation is Problematic

```
Problems with revocation:
├── Historical inconsistency: Profile shows different badges than history
├── User disappointment: Sudden loss of accomplishment
├── Complex state: Must track revoked vs. active badges
├── Social proof issues: Shared badges no longer reliable
└── Schema complexity: Need revocation table
```

### Alternative: Deprecation

```
Instead of revocation:
├── Mark badge as deprecated (isActive = false)
├── Awarded badges remain but show "Legacy" indicator
├── New users cannot earn deprecated badges
├── New version of badge available with updated criteria
└── Clear messaging: "This badge is no longer available to earn"
```

### Exceptional Cases: Error Correction

```
Only legitimate revocation case:
├── Award granted due to system error (bug, hack, data corruption)
├── Requires admin action with audit log
└── Rare, documented exception

Implementation (requires extension):
├── revokedAt: timestamp
├── revocationReason: text
└── BadgeGrantAuditLog (who, why, when)
```

## 10.4 Badge Versioning

### Why Version?

```
Scenario:
├── v1: "Top 100 Rank" badge with rank <= 100
├── Users earn v1 badge at rank 75
├── Platform grows, now 10,000 users
├── v2: "Top 100 Rank" badge changes to rank <= 10 (elite tier)

Result:
├── User with rank 75 still has v1 badge showing "Top 100"
├── User with rank 75 cannot earn v2 badge (requires rank <= 10)
├── Both badges are correct based on their version
└── Historical accuracy preserved
```

### Versioning Rules

```
Version increment triggers:
├── Badge name changes
├── Badge description changes
├── Badge icon changes
├── Badge criteria changes (thresholds, conditions)
└── Badge category changes

Version increment NOT triggered by:
├── Spelling fixes in description
├── Icon URL changes (same image, different CDN)
├── Internal rule refactoring (no user-visible change)
```

## 10.5 History Queries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACHIEVEMENT HISTORY QUERIES                            │
│                                                                              │
│   UserBadgeHistory(userId)                                                   │
│   ├── SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC   │
│   ├── All badges ever earned (including deprecated)                         │
│   └── Includes metadata for each grant                                      │
│                                                                              │
│   BadgeEarners(badgeId)                                                     │
│   ├── SELECT user_id FROM user_badges WHERE badge_id = ?                    │
│   ├── Filter by version for historical accuracy                             │
│   └── Count for badge popularity metrics                                    │
│                                                                              │
│   BadgeAwardTimeline(userId, from, to)                                      │
│   ├── SELECT * FROM user_badges                                             │
│   │   WHERE user_id = ? AND earned_at BETWEEN ? AND ?                      │
│   ├── Badges earned in date range                                           │
│   └── Grouped by category for analytics                                     │
│                                                                              │
│   FirstBadgeEarned(userId)                                                  │
│   ├── SELECT * FROM user_badges WHERE user_id = ?                          │
│   │   ORDER BY earned_at ASC LIMIT 1                                       │
│   └── Chronologically first badge for "veteran" calculations              │
│                                                                              │
│   RarestBadges(limit)                                                       │
│   ├── SELECT badge_id, COUNT(*) as earner_count                             │
│   │   FROM user_badges GROUP BY badge_id ORDER BY earner_count LIMIT ?    │
│   ├── Badges with fewest total earners                                      │
│   └── For achievement hunting motivation                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 11. Future Evolution

## 11.1 Extension Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACHIEVEMENT DOMAIN EXTENSION                             │
│                                                                              │
│   EXTENSION POINT 1: RULE TYPES                                             │
│   ├── Add new values to badgeRuleType enum                                  │
│   ├── Add new RuleEvaluator implementations                                 │
│   ├── Register in RuleEngine registry                                       │
│   └── No schema changes required (config is JSONB)                          │
│                                                                              │
│   EXTENSION POINT 2: BADGE CATEGORIES                                       │
│   ├── Add new badgeCategory enum values                                     │
│   ├── Update display logic for new category                                 │
│   └── No core architecture changes                                          │
│                                                                              │
│   EXTENSION POINT 3: EVENT SOURCES                                          │
│   ├── Add new activityEventType values                                     │
│   ├── Subscribe to new domain events                                        │
│   ├── Implement new event handlers                                          │
│   └── No rule engine changes                                                │
│                                                                              │
│   EXTENSION POINT 4: PROGRESS TRACKING                                      │
│   ├── Extend JSONB progress structure                                       │
│   ├── Add new progress visualization types                                  │
│   └── No schema changes required                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.2 Seasonal Achievements

### Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SEASONAL ACHIEVEMENT DESIGN                            │
│                                                                              │
│   Badge Definition Extension:                                               │
│   ┌───────────────────────────────────────────────────────────────────────┐  │
│   │  badges table:                                                         │  │
│   │  {                                                                    │  │
│   │    "badgeId": "...",                                                  │  │
│   │    "slug": "summer-2026-champion",                                    │  │
│   │    "validFrom": "2026-06-01",                                         │  │
│   │    "validUntil": "2026-08-31",                                        │  │
│   │    "isActive": true                                                   │  │
│   │  }                                                                    │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   Behavior:                                                                 │
│   ├── Badge only earnable during validFrom to validUntil                   │
│   ├── After validUntil: badge becomes deprecated                           │
│   ├── Earned badges remain in user history                                 │
│   └── New season: new badge with incremented version                       │
│                                                                              │
│   Required Extension: validFrom, validUntil fields to badges table         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.3 Limited-Time Achievements

### Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIMITED-TIME ACHIEVEMENT DESIGN                           │
│                                                                              │
│   Event-Driven Badges:                                                       │
│   ├── Tied to specific events (collaborations, partnerships)               │
│   ├── Automatically created when event announced                            │
│   ├── Automatically deprecated when event ends                             │
│   └── No manual intervention required                                       │
│                                                                              │
│   Flash Achievements:                                                       │
│   ├── Short-duration opportunities (24-72 hours)                          │
│   ├── "Complete 5 quizzes today" style                                   │
│   ├── Progress resets with time window                                     │
│   └── Creates urgency and engagement spikes                                │
│                                                                              │
│   Implementation:                                                            │
│   ├── validUntil field on badge definition                                  │
│   ├── Scheduled job to deprecate expired badges                            │
│   └── Event system creates/removes event badges                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.4 Event Achievements

### Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EVENT ACHIEVEMENT DESIGN                               │
│                                                                              │
│   Event Lifecycle Integration:                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  EVENT DOMAIN ←→ ACHIEVEMENT DOMAIN                                 │  │
│   │                                                                     │  │
│   │  Event Announced                                                    │  │
│   │       │                                                             │  │
│   │       ▼                                                             │  │
│   │  Create event-specific badges (via event domain)                   │  │
│   │       │                                                             │  │
│   │       ▼                                                             │  │
│   │  Users earn badges during event                                     │  │
│   │       │                                                             │  │
│   │       ▼                                                             │  │
│   │  Event Completed                                                     │  │
│   │       │                                                             │  │
│   │       ▼                                                             │  │
│   │  Deprecate event badges (auto or via event)                        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   Collaboration Badges:                                                      │
│   ├── Partner-branded achievements                                          │
│   ├── Cross-platform rewards                                                │
│   ├── Community goals (all users together)                                  │
│   └── Shared visibility (entire platform can track)                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.5 Friend Achievements

### Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRIEND ACHIEVEMENT DESIGN                              │
│                                                                              │
│   Social Rule Type Extension:                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  badgeRules table:                                                   │  │
│   │  {                                                                    │  │
│   │    "ruleType": "social",                                            │  │
│   │    "config": {                                                       │  │
│   │      "subtype": "INVITE_ACCEPTED",                                  │  │
│   │      "operator": ">=",                                               │  │
│   │      "threshold": 10                                                 │  │
│   │    }                                                                  │  │
│   │  }                                                                    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   Social Event Sources (requires extension):                                  │
│   ├── friend.invited (when referral link used)                              │
│   ├── friend.accepted (when invite accepted)                                │
│   ├── friend.badge_shared (when badge shared)                              │
│   └── group.joined (when joining community groups)                          │
│                                                                              │
│   Future Badge Types:                                                         │
│   ├── "Ambassador" - 10 successful invites                                 │
│   ├── "Social Butterfly" - friends who all earned badges                   │
│   └── "Team Player" - group achievement completion                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.6 Community Achievements

### Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMMUNITY ACHIEVEMENT DESIGN                             │
│                                                                              │
│   Collective Goals:                                                           │
│   ├── Platform-wide targets ("All users complete 1M quizzes")               │
│   ├── Category goals ("Community masters 10,000 science quizzes")           │
│   └── Time-bounded targets ("Reach 100K users by end of month")            │
│                                                                              │
│   Implementation Pattern:                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  CommunityProgress (tracked separately)                              │  │
│   │  {                                                                  │  │
│   │    "goalId": "...",                                                │  │
│   │    "name": "Summer Challenge 2026",                                 │  │
│   │    "currentValue": 750000,                                          │  │
│   │    "targetValue": 1000000,                                          │  │
│   │    "contributorCount": 15000,                                       │  │
│   │    "startedAt": "2026-06-01",                                       │  │
│   │    "endsAt": "2026-08-31"                                           │  │
│   │  }                                                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   Community Badge:                                                           │
│   ├── Awarded when community goal reached                                   │
│   ├── All contributing users receive badge                                 │
│   ├── Special indicator for "contributor" vs "witnessed"                  │
│   └── Re-evaluable for new users (must participate to earn)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.7 Evolution Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACHIEVEMENT DOMAIN EVOLUTION                             │
│                                                                              │
│   PHASE 1 (Current): Core Badges - USING EXISTING SCHEMA                   │
│   ├── Quiz completion badges (count)                                      │
│   ├── XP milestone badges (xp_total)                                       │
│   ├── Rank achievement badges (rank, rank_period)                          │
│   ├── Tournament badges (tournament_win)                                   │
│   ├── Perfect score badges (perfect_score)                                 │
│   └── Streak badges (streak)                                              │
│                                                                              │
│   PHASE 2 (Near): Enhanced Features - REQUIRES ENUM/SCHEMA EXTENSION        │
│   ├── Hidden achievements (isHidden field)                                 │
│   ├── Incremental milestones (multiple badge defs)                         │
│   └── Seasonal badges (validFrom/validUntil fields)                        │
│                                                                              │
│   PHASE 3 (Mid): Social Features - REQUIRES NEW DOMAIN                      │
│   ├── Friend referral badges (social rule type)                            │
│   ├── Social sharing badges                                               │
│   └── Community goals (new table)                                          │
│                                                                              │
│   PHASE 4 (Future): Advanced Gamification - REQUIRES EVENT DOMAIN           │
│   ├── Event collaboration badges                                           │
│   ├── Cross-platform badges                                                 │
│   ├── Dynamic difficulty badges                                             │
│   └── AI-curated personalized achievements                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 12. Summary

## 12.1 Domain Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACHIEVEMENT DOMAIN SUMMARY                             │
│                                                                              │
│   CORE RESPONSIBILITY                                                        │
│   Evaluate user actions and award badges while maintaining achievement       │
│   history. Acts as the consequence layer for gamification.                  │
│                                                                              │
│   KEY PRINCIPLES                                                             │
│   ├── Achievement does NOT own activity data                                │
│   ├── Badges are consequences, not activities                              │
│   ├── Rules are configuration, not code (use existing JSONB)               │
│   ├── Progress is stored in userBadges.progress                            │
│   ├── Profile owns showcase, Achievement owns decisions                     │
│   └── History is immutable, badges are versioned                            │
│                                                                              │
│   DEPENDENCIES                                                               │
│   ├── Consumes events from: Attempt, Ranking, Tournament, User, Event       │
│   ├── Queried by: User Profile (for display)                                │
│   └── No business logic dependencies on other domains                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.2 Responsibilities

| Responsibility | Owner | Description |
|----------------|-------|-------------|
| Badge Definitions | Achievement | Catalog of all badge types (`badges` table) |
| Badge Evaluation | Achievement | Decision logic for awarding badges |
| Badge Grants | Achievement | Records of earned badges (`userBadges` table) |
| Progress Tracking | Achievement | Current progress (`userBadges.progress` JSONB) |
| Achievement History | Achievement | Immutable audit trail |
| Streak Evaluation | Achievement | Evaluating streak thresholds for badges (reads from User Domain) |
| Streak Calculation | User Domain | Consecutive activity computation and storage |
| Badge Showcase | User Profile | User-curated badge display (`userProfiles.pinnedBadgeIds`) |
| XP Aggregation | Ranking | Raw XP data and calculations (`user_ranking` table) |
| Rank Calculation | Ranking | Competitive standing computation |
| Tournament Results | Tournament | Tournament outcomes (`tournament_participants` table) |
| Attempt Records | Attempt | Quiz attempt data (`quiz_attempts` table) |

## 12.3 Domain Boundaries Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOMAIN BOUNDARY SUMMARY                                  │
│                                                                              │
│   INSIDE ACHIEVEMENT DOMAIN (already implemented):                           │
│   ├── BadgeDefinition (catalog) → badges table                              │
│   ├── BadgeRule (evaluation) → badgeRules table                             │
│   ├── BadgeGrant (awards) → userBadges table                                │
│   ├── ProgressRecord (tracking) → userBadges.progress JSONB                   │
│   └── RuleEngine (evaluation logic)                                         │
│                                                                              │
│   OUTSIDE ACHIEVEMENT DOMAIN:                                               │
│   ├── XP data → user_ranking table (Ranking Domain)                         │
│   ├── Rank data → user_ranking table (Ranking Domain)                        │
│   ├── Attempt data → quiz_attempts table (Attempt Domain)                   │
│   ├── Tournament data → tournament_participants (Tournament Domain)          │
│   ├── User data → users table (User Domain)                                 │
│   └── Badge display → userProfiles.pinnedBadgeIds (Profile Domain)          │
│                                                                              │
│   ACHIEVEMENT DOMAIN QUERIES (via ports):                                    │
│   ├── Attempt counts → quiz_attempts table                                  │
│   ├── XP totals → user_ranking table                                        │
│   ├── Rank positions → user_ranking table                                   │
│   ├── Tournament history → tournament_participants table                     │
│   ├── Streak data → users table                                             │
│   └── User creation date → users table                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.4 Achievement Lifecycle Summary

```
USER ACTION → DOMAIN EVENT → ACHIEVEMENT EVALUATION → BADGE AWARDED → PROFILE UPDATED
     │              │                  │                    │              │
     │              │                  │                    │              │
  Source          Event             Rule                Badge        Notification
  Domain         Emitted         Evaluated           Granted       Sent
  (Owns)        (Decoupled)     (Achievement)      (userBadges)  (Profile)
```

## 12.5 Evaluation Strategy Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVALUATION STRATEGY SUMMARY                               │
│                                                                              │
│   HYBRID APPROACH RECOMMENDED                                                │
│                                                                              │
│   REAL-TIME (for simple badges):                                            │
│   ├── First actions (profile.created)                                       │
│   ├── Simple thresholds (xp_total, rank)                                   │
│   ├── Rank achievements (rank.milestone)                                   │
│   ├── Tournament victories (tournament.won)                               │
│   └── Immediate milestones                                                 │
│                                                                              │
│   DEFERRED (for complex badges):                                             │
│   ├── Progress-based badges (count with progress tracking)                   │
│   ├── Multi-step achievements                                              │
│   ├── Streak validation                                                     │
│   └── Time-bounded achievements                                             │
│                                                                              │
│   Your existing badgeRuleType supports both patterns!                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.6 Event Integration Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT INTEGRATION SUMMARY                                │
│                                                                              │
│   YOUR EXISTING activityEventType ENUM ALREADY SUPPORTS:                     │
│   ├── attempt_completed → Quiz badges                                       │
│   ├── achievement_awarded → Self-event (do not re-evaluate)                │
│   ├── tournament_joined → Participation badges                             │
│   ├── tournament_completed → Completion badges                            │
│   ├── tournament_won → Victory badges                                     │
│   ├── rank_improved → Rank progress badges                                 │
│   ├── rank_milestone → Rank milestone badges                                │
│   └── streak_milestone → Streak badges                                     │
│                                                                              │
│   PRINCIPLE: Consume events, query source domains for context               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.7 History Strategy Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HISTORY STRATEGY SUMMARY                                │
│                                                                              │
│   IMMUTABLE RECORDS (userBadges table):                                     │
│   ├── Badge grants never deleted                                            │
│   ├── Historical context preserved in metadata JSONB                        │
│   └── Badge versions tracked at award time (future extension)               │
│                                                                              │
│   NO REVOCATION:                                                             │
│   ├── Badges kept when criteria change                                       │
│   ├── Legacy badges marked via isActive = false                            │
│   ├── Users keep earned versions                                             │
│   └── Exception only for system errors (documented)                         │
│                                                                              │
│   VERSIONING (future extension):                                            │
│   ├── Badge definitions are versioned                                       │
│   ├── Users earn version active at award time                                │
│   └── Historical accuracy preserved                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.8 Future Evolution Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FUTURE EVOLUTION SUMMARY                                   │
│                                                                              │
│   READY NOW (using existing schema):                                        │
│   ├── All 7 existing rule types (count, rank, streak, etc.)                │
│   ├── Progress tracking via JSONB                                           │
│   └── Badge grants with metadata                                             │
│                                                                              │
│   REQUIRES ENUM/SCHEMA EXTENSION:                                            │
│   ├── Hidden badges (isHidden field)                                        │
│   ├── Seasonal badges (validFrom/validUntil fields)                        │
│   ├── Seasonal rules (seasonal enum value + code)                           │
│   └── Social rules (social enum value + new domain)                         │
│                                                                              │
│   NO MAJOR REDESIGN REQUIRED for future extensions                          │
│   Your existing schema is well-designed for extensibility!                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.9 Existing Schema vs Design Alignment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA ALIGNMENT CHECKLIST                                │
│                                                                              │
│   ✓ badges table - Implemented with type, slug, name, description          │
│   ✓ badgeRules table - Implemented with ruleType, config, priority         │
│   ✓ userBadges table - Implemented with progress, metadata                  │
│   ✓ badgeType enum - Implemented (diamond, platinum, gold, silver, bronze)  │
│   ✓ badgeRuleType enum - Implemented (7 rule types)                        │
│   ✓ activityEventType enum - Implemented (includes achievement events)     │
│                                                                              │
│   RECOMMENDED EXTENSIONS:                                                    │
│   ○ badges.validFrom, badges.validUntil - For seasonal badges              │
│   ○ badges.isHidden - For secret achievements                               │
│   ○ badges.version - For badge versioning                                  │
│   ○ userBadges.badgeVersion - For award-time versioning                    │
│   ○ userBadges.expiresAt - For time-limited badges                         │
│   ○ userBadges.revokedAt, revocationReason - For error correction          │
│   ○ badgeCategory enum - For taxonomy organization                          │
│   ○ badgeRuleType.seasonal, social - For future rules          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Document maintained by: Principal Software Architect*
*Last updated: 2026-06-01*
*Version: 1.1 - Aligned with existing schema implementation*
