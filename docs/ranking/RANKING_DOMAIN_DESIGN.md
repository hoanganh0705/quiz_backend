# Ranking Domain Design Specification

> **Document Version**: 1.0
> **Created**: 2026-05-30
> **Status**: Design Complete - Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Phase 1: Foundation](#phase-1-foundation)
3. [Phase 2: Core Features](#phase-2-core-features)
4. [Phase 3: Leaderboards & APIs](#phase-3-leaderboards--apis)
5. [Phase 4: Refinements](#phase-4-refinements)
6. [Phase 5: Future Expansions](#phase-5-future-expansions)
7. [Implementation Notes](#implementation-notes)

---

# 1. Overview

## 1.1 Purpose

The Ranking Domain serves as the authoritative source of truth for all user performance metrics and competitive standings across the quiz platform.

## 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| XP Aggregation | Calculate and store cumulative XP from all qualifying activities |
| Rank Computation | Determine ordinal positions based on aggregated scores |
| Ranking Periods | Manage time-bounded ranking windows (weekly, monthly, all-time) |
| Leaderboard Data | Provide ordered snapshots for display purposes |
| Rank History | Track and store historical ranking snapshots for analysis |

## 1.3 Domain Boundaries

### Belongs Inside Ranking Domain

| Responsibility | Description |
|----------------|-------------|
| XP Aggregation | Accumulating XP from all qualifying activities |
| Rank Computation | Determining ordinal positions |
| Ranking Periods | Managing time-bounded ranking windows |
| Leaderboard Data | Providing ordered snapshots |
| Rank History | Tracking historical snapshots |
| Ranking Policies | Enforcing rules for ties, inactive users |
| Ranking Queries | Serving rank lookups, percentile calculations |

### Does NOT Belong Inside Ranking Domain

| Concern | Owner Domain |
|---------|-------------|
| XP Source Logic | Attempt Domain (how much XP a quiz awards) |
| User Identity | User Domain (profile, authentication) |
| Quiz Metadata | Quiz Domain (categories, difficulty) |
| Tournament Brackets | Tournament Domain (seeding, matchups) |
| Badge Assignment | Achievement Domain (conditions, awards) |

## 1.4 Cross-Domain Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `xp.earned` | Attempt → Ranking | `{ userId, amount, source, attemptId, timestamp }` |
| `rank.updated` | Ranking → Notification | `{ userId, newRank, period, change }` |
| `rank.milestone` | Ranking → Achievement | `{ userId, rank, percentile, period }` |
| `leaderboard.changed` | Ranking → External | `{ period, topChanges }` |

---

# Phase 1: Foundation

## Objective

Establish the core ranking infrastructure with XP aggregation and basic rank storage.

## Deliverables

- [ ] Schema enhancements to `user_ranking` table
- [ ] XP ingestion service
- [ ] Basic rank calculation logic
- [ ] Event listener for `xp.earned` events

## 1.1 Schema Enhancements

### Current State

```typescript
// Existing user_ranking table
{
  userId: uuid('user_id').primaryKey(),
  allTimeXp: integer('all_time_xp').default(0),
  weeklyXp: integer('weekly_xp').default(0),
  monthlyXp: integer('monthly_xp').default(0),
  allTimeRank: integer('all_time_rank'),
  weeklyRank: integer('weekly_rank'),
  monthlyRank: integer('monthly_rank'),
  updatedAt: timestamp('updated_at'),
}
```

### Required Enhancements

```typescript
// New fields to add
{
  // Period boundary tracking
  lastWeeklyResetAt: timestamp('last_weekly_reset_at'),
  lastMonthlyResetAt: timestamp('last_monthly_reset_at'),

  // Peak rank tracking
  peakAllTimeRank: integer('peak_all_time_rank'),
  peakWeeklyRank: integer('peak_weekly_rank'),
  peakMonthlyRank: integer('peak_monthly_rank'),
  peakRankAchievedAt: timestamp('peak_rank_achieved_at'),

  // Activity tracking
  lastActivityAt: timestamp('last_activity_at'),
}
```

### Database Migration

```
1. Add new columns to user_ranking table
2. Set initial values for existing records
3. Create indexes for new query patterns
4. Add check constraints for positive ranks
```

## 1.2 XP Ingestion Service

### Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                   XP INGESTION SERVICE                       │
│                                                              │
│  1. Subscribe to xp.earned events                         │
│  2. Validate event payload                                  │
│  3. Update user's XP in all active periods                 │
│  4. Mark user as "dirty" for rank recalculation            │
│  5. Publish rank.calculated event                         │
└─────────────────────────────────────────────────────────────┘
```

### Processing Logic

```typescript
async function ingestXpEvent(event: XpEarnedEvent): Promise<void> {
  // 1. Validate event
  if (!event.userId || !event.amount || event.amount <= 0) {
    throw new InvalidXpEventError(event);
  }

  // 2. Check period boundaries
  const now = new Date();
  const needsWeeklyReset = shouldResetWeekly(event.timestamp);
  const needsMonthlyReset = shouldResetMonthly(event.timestamp);

  // 3. Update XP (atomic operation)
  await db.transaction(async (tx) => {
    // Reset periods if needed
    if (needsWeeklyReset) {
      await tx.update(userRanking)
        .set({ weeklyXp: 0, lastWeeklyResetAt: now })
        .where(/* all users */);
    }
    if (needsMonthlyReset) {
      await tx.update(userRanking)
        .set({ monthlyXp: 0, lastMonthlyResetAt: now })
        .where(/* all users */);
    }

    // Update user's XP
    await tx.update(userRanking)
      .set({
        allTimeXp: sql`all_time_xp + ${event.amount}`,
        weeklyXp: sql`weekly_xp + ${event.amount}`,
        monthlyXp: sql`monthly_xp + ${event.amount}`,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(userRanking.userId, event.userId));
  });

  // 4. Queue for rank recalculation
  await rankRecalculationQueue.add({
    userId: event.userId,
    periods: ['weekly', 'monthly', 'allTime'],
  });

  // 5. Check for tier milestones
  await checkMilestones(event.userId);
}
```

## 1.3 Basic Rank Calculation

### Ordinal Ranking Algorithm

```typescript
async function calculateRanks(period: RankingPeriod): Promise<void> {
  const xpField = getXpField(period); // weekly_xp, monthly_xp, or all_time_xp

  // Use window function for efficient ranking
  const rankedUsers = await db.execute(sql`
    WITH ranked AS (
      SELECT
        user_id,
        ${xpField} as xp,
        ROW_NUMBER() OVER (
          ORDER BY ${xpField} DESC, created_at ASC
        ) as rank
      FROM user_ranking
      JOIN users ON users.user_id = user_ranking.user_id
      WHERE deleted_at IS NULL AND ${xpField} > 0
    )
    UPDATE user_ranking ur
    SET ${getRankField(period)} = ranked.rank,
        updated_at = NOW()
    FROM ranked
    WHERE ur.user_id = ranked.user_id
  `);
}
```

### Rank Recalculation Triggers

| Trigger | Action |
|---------|--------|
| XP earned | Queue incremental update |
| Weekly reset | Full weekly recalculation |
| Monthly reset | Full monthly recalculation |
| Hourly cron | Consistency verification |
| Manual trigger | Admin-initiated recalc |

---

# Phase 2: Core Features

## Objective

Implement ranking periods, refresh strategies, and business rules.

## Deliverables

- [ ] Period reset logic (weekly/monthly)
- [ ] Hybrid refresh strategy implementation
- [ ] Tie-breaking rules
- [ ] Rank history archival

## 2.1 Period Reset Logic

### Weekly Reset

```
Schedule: Every Monday 00:00:00 UTC

Process:
┌─────────────────────────────────────────────────────────────┐
│                   WEEKLY RESET PROCESS                       │
│                                                              │
│  1. Lock ranking updates (prevent XP ingestion during reset)│
│  2. Archive current week rankings to rank_history          │
│  3. Reset weekly_xp to 0 for all users                    │
│  4. Update last_weekly_reset_at timestamp                 │
│  5. Unlock ranking updates                                  │
│  6. Publish week.ended event                              │
└─────────────────────────────────────────────────────────────┘
```

### Monthly Reset

```
Schedule: 1st of each month 00:00:00 UTC

Process:
┌─────────────────────────────────────────────────────────────┐
│                  MONTHLY RESET PROCESS                       │
│                                                              │
│  1. Lock ranking updates                                    │
│  2. Archive current month rankings                         │
│  3. Reset monthly_xp to 0                                  │
│  4. Update last_monthly_reset_at                           │
│  5. Award monthly achievement milestones                   │
│  6. Unlock ranking updates                                 │
│  7. Publish month.ended event                              │
└─────────────────────────────────────────────────────────────┘
```

### Reset Implementation

```typescript
async function performWeeklyReset(): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);

  await db.transaction(async (tx) => {
    // 1. Archive current rankings
    await tx.insert(rankHistory).from(
      db.select({
        userId: userRanking.userId,
        period: literal('weekly'),
        periodStart: userRanking.lastWeeklyResetAt,
        periodEnd: now,
        xp: userRanking.weeklyXp,
        rank: userRanking.weeklyRank,
      }).from(userRanking)
    );

    // 2. Reset weekly XP
    await tx.update(userRanking)
      .set({
        weeklyXp: 0,
        weeklyRank: null,
        lastWeeklyResetAt: now,
      });

    // 3. Recalculate initial weekly ranks
    await recalculateWeeklyRanks(tx);
  });

  // 4. Publish event
  await eventBus.publish('week.ended', { weekStart });
}
```

## 2.2 Hybrid Refresh Strategy

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 RANKING REFRESH ARCHITECTURE                 │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐ │
│  │   Live      │     │  Incremental │     │  Scheduled  │ │
│  │   Events    │────▶│  Processor  │     │  Full       │ │
│  │   (XP)      │     │  (30s batch)│     │  Refresh    │ │
│  └─────────────┘     └──────┬──────┘     │  (Hourly)   │ │
│                              │             └──────┬──────┘ │
│                              ▼                    │        │
│                     ┌────────────────┐            │        │
│                     │  Rank Cache    │◀───────────┘        │
│                     │  (Redis/Memory)│                     │
│                     └────────┬───────┘                     │
│                              │                              │
│                              ▼                              │
│                     ┌────────────────┐                     │
│                     │ Leaderboard   │                     │
│                     │ Queries        │                     │
│                     └────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

| Component | Timing | Scope | Description |
|-----------|--------|-------|-------------|
| Event Processor | Immediate | Single user | Updates XP, marks user dirty |
| Incremental Rank Update | Every 30s | Up to 100 users | Batch recalculation |
| Scheduled Full Refresh | Hourly | All users | Consistency verification |
| Cache TTL | 60s | Leaderboards | Read cache |
| Cache TTL | 10s | User ranks | Personal rank cache |

### Incremental Rank Update

```typescript
async function processDirtyRankings(): Promise<void> {
  // Get batch of dirty users (max 100)
  const dirtyUsers = await getDirtyUsers({ limit: 100 });

  if (dirtyUsers.length === 0) return;

  // Calculate affected user sets
  const affectedUserIds = new Set<string>();
  for (const user of dirtyUsers) {
    affectedUserIds.add(user.userId);
    // Add users who might be pushed down
    affectedUserIds.add(...await getUsersWithSimilarXp(user, 'above'));
  }

  // Batch recalculate
  await db.transaction(async (tx) => {
    for (const period of ['weekly', 'monthly', 'allTime'] as const) {
      await recalculateRanksForUsers(tx, period, [...affectedUserIds]);
    }
  });

  // Clear dirty flags
  await clearDirtyFlags(dirtyUsers.map(u => u.userId));

  // Invalidate caches
  await invalidateCaches([...affectedUserIds]);
}
```

### Scheduled Consistency Check

```typescript
// Run every hour
async function performConsistencyCheck(): Promise<ConsistencyReport> {
  const issues: RankingIssue[] = [];

  // Check for drift between stored XP and sum of events
  const xpMismatches = await findXpMismatches();
  issues.push(...xpMismatches);

  // Check for gaps in rank sequence
  const rankGaps = await findRankGaps();
  issues.push(...rankGaps);

  // Check for users with NULL rank but XP > 0
  const missingRanks = await findMissingRanks();
  issues.push(...missingRanks);

  // Auto-fix if possible
  if (issues.length > 0) {
    await fixRankingIssues(issues);
    await logConsistencyReport(issues);
  }

  return { totalIssues: issues.length, fixed: issues.length };
}
```

## 2.3 Tie-Breaking Rules

### Rule T1: XP Tie Resolution

```
When two or more users have identical XP:

Primary Sort:    XP (descending)
Tiebreaker 1:    Earlier achievement of XP milestone
Tiebreaker 2:    Earlier account creation date
Tiebreaker 3:    Alphabetical username (last resort)
```

### Rule T2: Rank Assignment with Ties

```
Example: 3 users tie for 5th place

┌─────────┬──────────────────────────────┐
│ User    │ Assigned Rank                │
├─────────┼──────────────────────────────┤
│ Alice   │ 5 (tied with Bob, Carol)      │
│ Bob     │ 5 (tied with Alice, Carol)   │
│ Carol   │ 5 (tied with Alice, Bob)     │
│ David   │ 8 (next available rank)       │
└─────────┴──────────────────────────────┘

Display: "Rank 5" for all three tied users
Next Rank: 8 (skipping 6, 7)
```

### Rule T3: Rank Numbering

```
- Ranks start at 1 (top position)
- No gaps in rank sequence (except ties)
- "Rank 1" is always the highest XP user
```

### Implementation

```typescript
const RANK_ORDER = `
  ORDER BY
    xp DESC,
    xp_milestone_achieved_at ASC,
    user_created_at ASC,
    username ASC
`;
```

## 2.4 Rank History

### Table Schema

```typescript
export const rankHistory = pgTable('rank_history', {
  historyId: uuid('history_id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  period: text('period').notNull(), // 'weekly' | 'monthly' | 'all_time'
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  xpAtEnd: integer('xp_at_end').notNull(),
  rankAchieved: integer('rank_achieved'),
  peakRank: integer('peak_rank'),
  peakXp: integer('peak_xp'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Archival Triggers

| Trigger | Action |
|---------|--------|
| Weekly reset | Archive weekly rankings |
| Monthly reset | Archive monthly rankings |
| User deletion | Final archive before deletion |
| Season end | Archive season rankings |

---

# Phase 3: Leaderboards & APIs

## Objective

Build leaderboard serving infrastructure and public APIs.

## Deliverables

- [ ] Leaderboard query service
- [ ] User rank lookup service
- [ ] Public API endpoints
- [ ] Caching layer

## 3.1 Leaderboard Service

### Leaderboard Types

| Type | Scope | Period Support |
|------|-------|----------------|
| Global | All users | weekly, monthly, all_time |
| Category | Per category | weekly, monthly, all_time |
| Tournament | Per tournament | final only |
| Friends | User's friends | weekly, monthly, all_time |
| Seasonal | Per season | weekly, final |

### Query Patterns

```typescript
interface LeaderboardQuery {
  type: 'global' | 'category' | 'friends';
  period: 'weekly' | 'monthly' | 'all_time';
  limit?: number;      // default: 100, max: 500
  offset?: number;     // for pagination
  categoryId?: string; // for category type
  userId?: string;     // for friends type
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalParticipants: number;
  userPosition?: UserRankPosition;
  period: {
    start: Date;
    end: Date | null; // null for all_time
    resetIn: number;   // seconds until next reset
  };
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  xp: number;
  isTied: boolean;
  trend?: 'up' | 'down' | 'same';
}

interface UserRankPosition {
  rank: number;
  percentile: number;
  xp: number;
  xpToNextRank: number;
  nextRankXp: number;
}
```

### Implementation

```typescript
async function getGlobalLeaderboard(
  query: LeaderboardQuery
): Promise<LeaderboardResponse> {
  const xpField = getXpField(query.period);
  const rankField = getRankField(query.period);

  // Check cache first
  const cacheKey = `leaderboard:global:${query.period}:${query.limit}:${query.offset}`;
  const cached = await cache.get<LeaderboardResponse>(cacheKey);
  if (cached) return cached;

  // Query leaderboard
  const entries = await db.query.userRanking.findMany({
    with: { user: true },
    orderBy: [desc(xpField)],
    limit: query.limit,
    offset: query.offset,
  });

  const totalParticipants = await db.$count(userRanking, sql`${xpField} > 0`);

  const response: LeaderboardResponse = {
    entries: entries.map((e, i) => ({
      rank: (query.offset || 0) + i + 1,
      userId: e.userId,
      displayName: e.user.displayName || e.user.username,
      avatarUrl: e.user.avatarUrl,
      xp: e[xpField],
      isTied: false, // Calculate based on adjacent entries
    })),
    totalParticipants,
    period: getPeriodInfo(query.period),
  };

  // Cache for 60 seconds
  await cache.set(cacheKey, response, { ttl: 60 });

  return response;
}
```

## 3.2 User Rank Service

### Rank Discovery

```typescript
interface UserRankResponse {
  global: {
    weekly: RankInfo;
    monthly: RankInfo;
    allTime: RankInfo;
  };
  peakRanks: {
    weekly?: number;
    monthly?: number;
    allTime?: number;
  };
  lastActivityAt: Date;
}

interface RankInfo {
  rank: number | null;
  percentile: number | null;
  xp: number;
  xpToNextRank: number | null;
  trend: 'up' | 'down' | 'same' | 'new';
  trendAmount: number | null;
}
```

### Percentile Calculation

```typescript
function calculatePercentile(rank: number, totalUsers: number): number {
  if (rank <= 0 || totalUsers <= 0) return 0;
  return Math.round(((totalUsers - rank) / totalUsers) * 100 * 100) / 100;
}

// Display mapping
const PERCENTILE_LABELS: Record<string, string> = {
  '100': 'Top 1%',
  '95-99': 'Top 5%',
  '90-94': 'Top 10%',
  '75-89': 'Top 25%',
  '50-74': 'Top Half',
  '0-49': 'Keep Climbing!',
};
```

## 3.3 API Endpoints

### Public Endpoints

```
GET  /api/v1/leaderboard
     ?period=weekly|monthly|all_time
     &limit=100
     &offset=0

GET  /api/v1/leaderboard/categories/:categoryId
     ?period=weekly|monthly|all_time

GET  /api/v1/leaderboard/me
     ?period=weekly|monthly|all_time

GET  /api/v1/leaderboard/:userId

GET  /api/v1/users/:userId/rank
     ?period=weekly|monthly|all_time
```

### Response Formats

```typescript
// GET /api/v1/leaderboard
interface LeaderboardResponseDto {
  entries: {
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    xp: number;
  }[];
  totalParticipants: number;
  period: {
    type: 'weekly' | 'monthly' | 'all_time';
    start: string;
    end?: string;
    resetInSeconds: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// GET /api/v1/leaderboard/me
interface MyRankResponseDto {
  rank: number;
  percentile: number;
  percentileLabel: string;
  xp: number;
  xpToNextRank: number | null;
  trend: 'up' | 'down' | 'same' | 'new';
  trendAmount: number | null;
  period: 'weekly' | 'monthly' | 'all_time';
}
```

## 3.4 Caching Strategy

### Cache Keys

| Key Pattern | TTL | Invalidation |
|-------------|-----|--------------|
| `leaderboard:global:{period}` | 60s | On rank update batch |
| `leaderboard:category:{categoryId}:{period}` | 60s | On category rank update |
| `rank:user:{userId}` | 10s | On user XP update |
| `rank:user:{userId}:{period}` | 10s | On user XP update |
| `total:users:{period}` | 300s | On user create/delete |

### Cache Invalidation

```typescript
// On rank recalculation
async function invalidateLeaderboardCache(period: RankingPeriod): Promise<void> {
  await cache.deletePattern(`leaderboard:*:${period}`);
}

// On user XP update
async function invalidateUserRankCache(userId: string): Promise<void> {
  await cache.deletePattern(`rank:user:${userId}*`);
}

// Bulk invalidation on reset
async function invalidateAllCaches(): Promise<void> {
  await cache.deletePattern('leaderboard:*');
  await cache.deletePattern('rank:user:*');
  await cache.deletePattern('total:*');
}
```

---

# Phase 4: Refinements

## Objective

Implement fairness rules, edge cases, and polish.

## Deliverables

- [ ] Inactivity handling
- [ ] New user experience
- [ ] Returning user flow
- [ ] Rank notifications

## 4.1 Inactivity Handling

### Rules

| Inactivity Duration | Weekly/Monthly | All-Time |
|--------------------|-----------------|----------|
| 0-30 days | Rank preserved | Rank preserved |
| 30-90 days | Eligible for rank drop | Rank preserved |
| 90+ days | Rank may be removed | Rank preserved |

### Implementation

```typescript
async function processInactivityDrops(): Promise<void> {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const ninetyDaysAgo = subDays(new Date(), 90);

  // Mark users inactive 30+ days
  await db.update(userRanking)
    .set({ status: 'inactive' })
    .where(
      and(
        lt(userRanking.lastActivityAt, thirtyDaysAgo),
        isNull(userRanking.status)
      )
    );

  // For weekly/monthly: allow rank changes after 90 days
  // This is handled in query logic, not stored
}

// In leaderboard query
const INACTIVITY_CUTOFF = subDays(new Date(), 90);

function getLeaderboardQuery(period: RankingPeriod) {
  return db.select()
    .from(userRanking)
    .innerJoin(users)
    .where(
      and(
        eq(userRanking.weeklyXp, 0), // inactive condition
        gt(userRanking.lastActivityAt, INACTIVITY_CUTOFF) // not too old
      )
      // OR no condition for all_time ranking
    );
}
```

## 4.2 New User Experience

### Rules

```
Rule F1: Grace Period
  - New users (< 7 days) shown with "New" badge
  - Not penalized in rankings for inactivity
  - Displayed separately in "Rising Stars" section
```

### Implementation

```typescript
interface UserRankResponse {
  // ... other fields
  badges: {
    isNew: boolean;      // < 7 days
    isRisingStar: boolean; // top weekly gainer
    isActive: boolean;   // activity in last 7 days
  };
}

// Calculate on query
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const userAge = Date.now() - new Date(user.createdAt).getTime();
const isNew = userAge < SEVEN_DAYS_MS;
```

## 4.3 Returning User Flow

### Rules

```
Rule F3: Returning Users
  - Previous ranks not restored automatically
  - Must re-accumulate for current period
  - All-Time XP preserved and continues
  - Display: "Welcome back! Rank #X in All-Time"
```

### Implementation

```typescript
interface ReturningUserInfo {
  wasInactive: boolean;
  daysSinceLastActivity: number;
  welcomeBackMessage: boolean;
}

// Detect returning user
const LAST_ACTIVITY_CUTOFF = subDays(new Date(), 30);
const user = await getUserWithRanking(userId);

if (user.lastActivityAt && user.lastActivityAt < LAST_ACTIVITY_CUTOFF) {
  return {
    wasInactive: true,
    daysSinceLastActivity: differenceInDays(new Date(), user.lastActivityAt),
    welcomeBackMessage: true,
  };
}
```

## 4.4 Rank Notifications

### Notification Types

| Event | Notification |
|-------|--------------|
| Enter top 10 | "You're in the Top 10!" |
| Enter top 100 | "New personal best: Rank #X" |
| Rank up | "+5 positions this week!" |
| Milestone XP | "You've earned 10,000 XP!" |
| Weekly winner | "You're #1 this week!" |

### Implementation

```typescript
async function checkAndSendRankNotifications(
  userId: string,
  previousRank: number,
  newRank: number,
  period: RankingPeriod
): Promise<void> {
  const notifications: Notification[] = [];

  // Top 10 achievement
  if (previousRank > 10 && newRank <= 10) {
    notifications.push({
      userId,
      type: 'rank.milestone.top10',
      title: "You're in the Top 10!",
      body: `Congratulations! You've reached rank #${newRank} ${period}`,
    });
  }

  // Rank improvement
  const improvement = previousRank - newRank;
  if (improvement >= 5) {
    notifications.push({
      userId,
      type: 'rank.improvement',
      title: `+${improvement} positions!`,
      body: `You've moved up ${improvement} spots this ${period}`,
    });
  }

  // Send all notifications
  await notificationService.sendBatch(notifications);
}
```

---

# Phase 5: Future Expansions

## Objective

Design for extensibility to support future ranking types.

## 5.1 Category Rankings

### Schema Extension

```typescript
// New entity for category-specific rankings
export const categoryRanking = pgTable('category_ranking', {
  categoryRankingId: uuid('category_ranking_id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull(),
  userId: uuid('user_id').notNull(),
  allTimeXp: integer('all_time_xp').default(0),
  weeklyXp: integer('weekly_xp').default(0),
  monthlyXp: integer('monthly_xp').default(0),
  allTimeRank: integer('all_time_rank'),
  weeklyRank: integer('weekly_rank'),
  monthlyRank: integer('monthly_rank'),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### XP Event Enhancement

```typescript
interface XpEarnedEvent {
  userId: string;
  amount: number;
  source: 'quiz' | 'tournament' | 'bonus';
  attemptId?: string;
  categoryId?: string;  // New: category context
  timestamp: Date;
}

// XP ingestion updates both global and category rankings
async function ingestXpEvent(event: XpEarnedEvent): Promise<void> {
  // Update global ranking (existing)
  await updateGlobalRanking(event);

  // Update category ranking if applicable
  if (event.categoryId) {
    await updateCategoryRanking(event.categoryId, event);
  }
}
```

## 5.2 Friend Rankings

### Query-Time Computation

```typescript
async function getFriendLeaderboard(
  userId: string,
  period: RankingPeriod
): Promise<FriendLeaderboardResponse> {
  // 1. Get user's friends
  const friends = await friendService.getFriends(userId);
  const userIds = [...friends.map(f => f.friendId), userId];

  // 2. Get rankings for all friends
  const rankings = await db.query.userRanking.findMany({
    where: inArray(userRanking.userId, userIds),
    with: { user: true },
  });

  // 3. Sort by period XP
  const xpField = getXpField(period);
  rankings.sort((a, b) => b[xpField] - a[xpField]);

  // 4. Find current user's position
  const currentUserRank = rankings.findIndex(r => r.userId === userId) + 1;

  return {
    entries: rankings.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      xp: r[xpField],
      isCurrentUser: r.userId === userId,
    })),
    currentUserRank,
    totalFriends: rankings.length,
  };
}
```

## 5.3 Tournament Rankings

### Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│              TOURNAMENT RANKING INTEGRATION                  │
│                                                              │
│  Existing: tournament_participants table                      │
│  Enhancement: Ranking-specific queries and indexes            │
│                                                              │
│  Tournament Completion Flow:                                │
│  1. Tournament ends → determine final scores              │
│  2. Set rank_final for all participants                    │
│  3. Award tournament XP bonuses                           │
│  4. Update global rankings                                 │
│  5. Send rank notifications                                │
└─────────────────────────────────────────────────────────────┘
```

### Query

```typescript
async function getTournamentLeaderboard(
  tournamentId: string,
  limit: number = 100
): Promise<TournamentLeaderboardEntry[]> {
  return db.query.tournamentParticipants.findMany({
    where: eq(tournamentParticipants.tournamentId, tournamentId),
    with: { user: true },
    orderBy: [
      desc(tournamentParticipants.totalScore),
      asc(tournamentParticipants.totalTimeMs),
    ],
    limit,
  });
}
```

## 5.4 Seasonal Rankings

### Schema

```typescript
export const seasons = pgTable('seasons', {
  seasonId: uuid('season_id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  isActive: boolean('is_active').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const seasonRanking = pgTable('season_ranking', {
  seasonRankingId: uuid('season_ranking_id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id').notNull(),
  userId: uuid('user_id').notNull(),
  xpEarned: integer('xp_earned').default(0),
  currentRank: integer('current_rank'),
  peakRank: integer('peak_rank'),
  finalRank: integer('final_rank'),  // Set when season ends
  rewardsClaimed: boolean('rewards_claimed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Season Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    SEASON LIFECYCLE                          │
│                                                              │
│  1. SEASON START                                             │
│     - Create season_ranking records for all active users     │
│     - Tag xp.earned events with season_id                   │
│     - Announce season start                                 │
│                                                              │
│  2. DURING SEASON                                           │
│     - Accumulate XP in season_ranking                       │
│     - Calculate live season leaderboards                    │
│     - Award mid-season achievements                         │
│                                                              │
│  3. SEASON END                                              │
│     - Calculate final ranks                                 │
│     - Set final_rank for all participants                   │
│     - Distribute season rewards                             │
│     - Archive to rank_history                               │
│     - Start new season                                      │
└─────────────────────────────────────────────────────────────┘
```

---

# Implementation Notes

## Priority Order

1. **Phase 1** (Foundation) - Start here, everything builds on this
2. **Phase 2** (Core Features) - Period management is critical
3. **Phase 3** (Leaderboards & APIs) - Public-facing features
4. **Phase 4** (Refinements) - Polish and user experience
5. **Phase 5** (Future Expansions) - Optional, depends on roadmap

## Testing Checklist

### Unit Tests
- [ ] XP ingestion with all period combinations
- [ ] Rank calculation with ties
- [ ] Percentile calculation accuracy
- [ ] Period reset logic
- [ ] Inactivity handling

### Integration Tests
- [ ] End-to-end: quiz completion → rank update
- [ ] Event flow: xp.earned → ranking update → leaderboard
- [ ] Cache invalidation on updates

### Performance Tests
- [ ] Rank calculation with 10,000 users
- [ ] Leaderboard query response time < 100ms
- [ ] Cache hit rate > 90%

## Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| Rank calculation latency | > 5s per batch |
| Cache hit rate | < 80% |
| XP event processing backlog | > 1000 events |
| Rank inconsistencies | > 0.1% of users |

---

*Document maintained by: Backend Team*
*Last updated: 2026-05-30*
