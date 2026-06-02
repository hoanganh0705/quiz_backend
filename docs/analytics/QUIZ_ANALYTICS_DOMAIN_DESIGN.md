# Quiz Analytics — Architecture Design

> **Document Version**: 1.1
> **Created**: 2026-06-02
> **Updated**: 2026-06-02
> **Status**: Design Complete - Ready for Implementation
> **Note**: Analytics is implemented as a feature within the Quiz Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Domain Boundaries](#2-domain-boundaries)
3. [Core Analytics Metrics](#3-core-analytics-metrics)
4. [Update Flows](#4-update-flows)
5. [Module Structure](#5-module-structure)
6. [API Design](#6-api-design)
7. [Implementation Plan](#7-implementation-plan)
8. [Schema Extensions](#8-schema-extensions)
9. [Summary](#9-summary)

---

# 1. Overview

## 1.1 Purpose

The Quiz Analytics Feature provides analytical metrics about quizzes, including performance statistics, popularity scores, and trending calculations. It aggregates data from existing domains (Attempt, Review, Bookmark) without owning the source data.

## 1.2 Core Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| Quiz Metrics | totalAttempts, uniquePlayers, averageScore, completionRate | Design below |
| Review Metrics | averageRating, ratingCount | Design below |
| Bookmark Metrics | bookmarkCount | Design below |
| Popularity Metrics | popularityScore | Design below |
| Trending Metrics | trendingScore | Design below |
| Category Analytics | Aggregated metrics per category | Design below |

## 1.3 Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                      DESIGN PRINCIPLES                           │
│                                                                  │
│  1. ANALYTICS READS FROM SOURCE DOMAINS                        │
│     - Does NOT own attempts, reviews, or bookmarks               │
│     - Queries source tables via repository layer                 │
│     - Computes derived metrics on demand or via scheduled jobs   │
│                                                                  │
│  2. QUIZ_STATS IS THE STORE OF RECORD                          │
│     - Reuse existing quiz_stats table                            │
│     - Extend for new analytics fields                           │
│     - Denormalized for fast reads                               │
│                                                                  │
│  3. METRIC CALCULATION IS EVENTUALLY CONSISTENT               │
│     - Use asynchronous refresh for accuracy                     │
│     - Accept slight staleness for performance                   │
│     - Scheduled recalculation as fallback                       │
│                                                                  │
│  4. ANALYTICS DOES NOT TRIGGER BUSINESS LOGIC                  │
│     - Read-only feature from business perspective               │
│     - No side effects on source domains                         │
│                                                                  │
│  5. SIMPLICITY OVER COMPLETENESS                               │
│     - No CQRS, no event sourcing                               │
│     - Simple SQL aggregations first                             │
│     - Caching only when necessary                               │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. Domain Boundaries

## 2.1 Boundary Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN BOUNDARY MAP                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         QUIZ MODULE                                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │              QUIZ ANALYTICS FEATURE                           │   │   │
│  │  │                                                               │   │   │
│  │  │  OWNED:                    READ FROM:                         │   │   │
│  │  │  - quiz_stats              - quiz_attempts                     │   │   │
│  │  │  - analytics fields        - quiz_reviews                      │   │   │
│  │  │  - trending_score          - bookmarked_quizzes                │   │   │
│  │  │  - popularity_score                                                │   │   │
│  │  │                                                               │   │   │
│  │  │  COMPUTES:                                                      │   │   │
│  │  │  - totalAttempts        - popularityScore                      │   │   │
│  │  │  - uniquePlayers        - trendingScore                         │   │   │
│  │  │  - averageScore         - categoryMetrics                      │   │   │
│  │  │  - completionRate                                            │   │   │
│  │  │  - averageRating                                             │   │   │
│  │  │  - bookmarkCount                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  EXTERNAL DOMAINS (Read-Only):                                     │   │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐         │   │
│  │  │   Attempt   │     │   Review    │     │  Bookmark   │         │   │
│  │  │   Domain    │     │   Domain    │     │   Domain    │         │   │
│  │  └─────────────┘     └─────────────┘     └─────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 What Belongs to Quiz Analytics

### 2.2.1 Metrics Storage

| Entity | Description |
|--------|-------------|
| `quiz_stats` | Primary store for quiz-level metrics (extends existing) |
| Analytics fields | avgRating, ratingCount, bookmarkCount, popularityScore, trendingScore |

### 2.2.2 Computed Values

| Metric | Description |
|--------|-------------|
| `totalAttempts` | Count of all completed attempts |
| `uniquePlayers` | Count of distinct users who attempted |
| `averageScore` | Mean score percent across attempts |
| `completionRate` | Ratio of completed vs started attempts |
| `averageRating` | Mean rating from reviews |
| `ratingCount` | Total number of reviews |
| `bookmarkCount` | Total bookmarks for a quiz |
| `popularityScore` | Composite popularity indicator |
| `trendingScore` | Time-decay weighted activity score |

## 2.3 What Belongs to Quiz Domain

| Responsibility | Rationale |
|----------------|-----------|
| Quiz metadata | title, description, slug, imageUrl |
| Quiz versions | version management, publish status |
| Quiz content | questions, answers, difficulty |
| Creator association | ownership and permissions |
| Featured flag | editorial decision |

**Why**: Quiz is the authoritative source for quiz content and identity. Analytics should never modify quiz data.

## 2.4 What Belongs to Attempt Domain

| Responsibility | Rationale |
|----------------|-----------|
| Attempt lifecycle | start, submit, complete, abandon |
| Answer records | individual question responses |
| Scoring logic | correct count, time calculations |
| XP computation | earned XP calculation |

**Why**: Attempt owns the business transaction of taking a quiz. Analytics reads the results.

## 2.5 What Belongs to Review Domain

| Responsibility | Rationale |
|----------------|-----------|
| Review creation | submit, update, delete |
| Rating validation | 1-5 scale enforcement |
| Comment management | text content ownership |
| One-review-per-user | uniqueness constraint |

**Why**: Review owns user feedback submission. Analytics aggregates the results.

## 2.6 What Belongs to Bookmark Domain

| Responsibility | Rationale |
|----------------|-----------|
| Collection management | create, rename, delete collections |
| Bookmark CRUD | add, remove bookmarks |
| User ownership | private by default |

**Why**: Bookmark owns user collections. Analytics reads bookmark counts.

---

# 3. Core Analytics Metrics

## 3.1 Quiz Metrics

### 3.1.1 totalAttempts

**Definition**: Count of all completed quiz attempts.

**Formula**:
```
totalAttempts = COUNT(attemptId)
  WHERE status = 'completed'
  AND quizVersionId IN (SELECT quizVersionId FROM quizVersions WHERE quizId = :quizId)
```

**Data Source**: `quiz_attempts` table

**Update Frequency**: On each attempt completion

### 3.1.2 uniquePlayers

**Definition**: Count of distinct users who completed at least one attempt.

**Formula**:
```
uniquePlayers = COUNT(DISTINCT userId)
  WHERE status = 'completed'
  AND quizVersionId IN (SELECT quizVersionId FROM quizVersions WHERE quizId = :quizId)
```

**Data Source**: `quiz_attempts` table

**Update Frequency**: On each attempt completion

### 3.1.3 averageScore

**Definition**: Mean score percentage across all completed attempts.

**Formula**:
```
averageScore = AVG(scorePercent)
  WHERE status = 'completed'
  AND quizVersionId IN (SELECT quizVersionId FROM quizVersions WHERE quizId = :quizId)
```

**Data Source**: `quiz_attempts` table

**Update Frequency**: On each attempt completion

### 3.1.4 completionRate

**Definition**: Ratio of completed attempts to total started attempts.

**Formula**:
```
completionRate = completedCount / totalCount * 100

Where:
  completedCount = COUNT(attemptId) WHERE status = 'completed'
  totalCount = COUNT(attemptId) WHERE status IN ('started', 'completed')
```

**Data Source**: `quiz_attempts` table

**Update Frequency**: On each attempt status change

## 3.2 Review Metrics

### 3.2.1 averageRating

**Definition**: Mean rating value from all reviews.

**Formula**:
```
averageRating = AVG(rating)
  WHERE quizId = :quizId
```

**Data Source**: `quiz_reviews` table

**Update Frequency**: On each review submit/update/delete

### 3.2.2 ratingCount

**Definition**: Total number of reviews for a quiz.

**Formula**:
```
ratingCount = COUNT(reviewId)
  WHERE quizId = :quizId
```

**Data Source**: `quiz_reviews` table

**Update Frequency**: On each review submit/delete

## 3.3 Bookmark Metrics

### 3.3.1 bookmarkCount

**Definition**: Total number of times a quiz has been bookmarked across all collections.

**Formula**:
```
bookmarkCount = COUNT(bookmarkId)
  WHERE quizId = :quizId
```

**Data Source**: `bookmarked_quizzes` table

**Update Frequency**: On each bookmark add/remove

## 3.4 Popularity Metrics

### 3.4.1 popularityScore

**Definition**: Composite score indicating quiz popularity relative to others.

**Formula**:
```
popularityScore = (attemptsWeight * normalizedAttempts)
                + (bookmarksWeight * normalizedBookmarks)
                + (ratingsWeight * normalizedRatings)

Where weights (configurable):
  attemptsWeight = 0.5
  bookmarksWeight = 0.3
  ratingsWeight = 0.2

Normalization (min-max scaling per time window):
  normalizedValue = (value - minValue) / (maxValue - minValue)
```

**Data Source**: Aggregated from `quiz_stats`, `quiz_reviews`, `bookmarked_quizzes`

**Update Frequency**: Scheduled (hourly recommended)

**Note**: Popularity is relative and requires global normalization.

## 3.5 Trending Metrics

### 3.5.1 trendingScore

**Definition**: Time-decay weighted activity score for trending identification.

**Formula**:
```
trendingScore = Σ (activityWeight * recencyDecay)

Where:
  activityWeight = 1 for attempt, 2 for bookmark, 3 for review (configurable)
  recencyDecay = exp(-λ * hoursAgo)
  λ = ln(2) / halfLifeHours (halfLifeHours = 24 recommended)

Simplified discrete version:
  trendingScore = Σ (activityWeight * score) for activities in last 168 hours (7 days)

Where score per activity:
  - Attempt: 1 point
  - Bookmark: 2 points
  - Review: 3 points

With time decay multiplier:
  multiplier = 1.0 if <24h, 0.5 if <48h, 0.25 if <72h, 0.1 if <168h
```

**Data Source**: `quiz_attempts`, `bookmarked_quizzes`, `quiz_reviews`

**Update Frequency**: Scheduled (every 15 minutes recommended)

**Note**: Trending uses a sliding window (7 days) with exponential decay.

---

# 4. Update Flows

## 4.1 Event Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPDATE FLOW DIAGRAM                               │
│                                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│  │ Attempt  │     │  Review  │     │ Bookmark │     │Scheduled │          │
│  │Completed │     │Submitted │     │Created/  │     │ Job      │          │
│  │          │     │          │     │Deleted   │     │          │          │
│  └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘          │
│       │                │                │                │                  │
│       │                │                │                │                  │
│       ▼                ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    QUIZ ANALYTICS FEATURE                    │           │
│  │                                                                  │           │
│  │  ┌─────────────────────────────────────────────────────┐    │           │
│  │  │           ASYNCHRONOUS REFRESH                        │    │           │
│  │  │                                                      │    │           │
│  │  │  1. Attempt Completed                                │    │           │
│  │  │     → Update quiz_stats (sync)                       │    │           │
│  │  │     → Queue trending refresh (async)                  │    │           │
│  │  │                                                      │    │           │
│  │  │  2. Review Submitted                                 │    │           │
│  │  │     → Update review metrics (sync)                    │    │           │
│  │  │     → Queue popularity refresh (async)                │    │           │
│  │  │                                                      │    │           │
│  │  │  3. Bookmark Created/Deleted                        │    │           │
│  │  │     → Update bookmark count (sync)                    │    │           │
│  │  │     → Queue popularity refresh (async)                │    │           │
│  │  │                                                      │    │           │
│  │  │  4. Scheduled Job                                    │    │           │
│  │  │     → Recalculate all trending scores                │    │           │
│  │  │     → Recalculate popularity normalization            │    │           │
│  │  │     → Validate data consistency                       │    │           │
│  │  └─────────────────────────────────────────────────────┘    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Synchronous Updates

### 4.2.1 When to Use Sync

| Scenario | Reason |
|----------|--------|
| Quiz attempt completed | Immediate feedback needed for creator dashboard |
| Review submitted | Rating must reflect immediately |
| Bookmark created/deleted | Count must be accurate |

### 4.2.2 Implementation

```typescript
// In Attempt Command Service (existing code)
async completeAttempt(...) {
  // ... existing completion logic ...

  // NEW: Sync analytics update
  await this.analyticsService.refreshQuizMetrics(quizId);
}
```

**Rationale**: Analytics is a derived projection. Source domain calls analytics after mutation.

## 4.3 Asynchronous Updates

### 4.3.1 When to Use Async

| Scenario | Reason |
|----------|--------|
| Popularity normalization | Requires global aggregation |
| Trending calculation | Reads from multiple tables |
| Bulk metric refresh | Performance isolation |

### 4.3.2 Implementation Pattern

```typescript
// Use NestJS Queue (Bull) for async processing
@Injectable()
export class AnalyticsQueueService {
  async queueRefresh(quizId: string, type: 'popularity' | 'trending') {
    await this.queue.add('analytics-refresh', {
      quizId,
      type,
      timestamp: Date.now(),
    });
  }
}
```

**Rationale**: Heavy computations should not block user requests.

## 4.4 Scheduled Recalculation

### 4.4.1 Schedule Design

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Trending Refresh | Every 15 minutes | Keep trending scores current |
| Popularity Normalization | Hourly | Re-normalize popularity scores |
| Data Validation | Daily | Detect and fix inconsistencies |
| Full Rebuild | Weekly | Complete metric recalculation |

### 4.4.2 Implementation Pattern

```typescript
// Using @nestjs/schedule
@Injectable()
export class AnalyticsSchedulerService {
  @Cron('*/15 * * * *') // Every 15 minutes
  async refreshTrendingScores() {
    await this.analyticsService.refreshAllTrendingScores();
  }

  @Cron('0 * * * *') // Every hour
  async refreshPopularityScores() {
    await this.analyticsService.refreshAllPopularityScores();
  }

  @Cron('0 3 * * 0') // Weekly Sunday 3 AM
  async fullRebuild() {
    await this.analyticsService.rebuildAllMetrics();
  }
}
```

## 4.5 Recommendation: Hybrid Approach

For simplicity, recommend this approach:

```
┌────────────────────────────────────────────────────────────────┐
│                   RECOMMENDED UPDATE STRATEGY                   │
│                                                                 │
│  1. SYNC updates for quiz_stats fields                         │
│     - totalAttempts, uniquePlayers, averageScore                │
│     - completionRate                                            │
│     - averageRating, ratingCount                                │
│     - bookmarkCount                                             │
│                                                                 │
│  2. ASYNC for trending/popularity                              │
│     - trendingScore                                             │
│     - popularityScore                                           │
│                                                                 │
│  3. SCHEDULED validation                                        │
│     - Daily consistency check                                  │
│     - Weekly full rebuild                                       │
│                                                                 │
│  RATIONALE:                                                     │
│  - Sync for accuracy-critical metrics                          │
│  - Async for expensive computations                            │
│  - Scheduled for data integrity                                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

# 5. Module Structure

## 5.1 Directory Structure

Analytics is implemented as a feature within the Quiz Module:

```
src/modules/quiz/
├── domain/
│   ├── analytics/
│   │   ├── quiz-analytics.service.ts       # Core business logic
│   │   ├── metrics-calculator.service.ts   # Metric computation
│   │   ├── trending.service.ts            # Trending calculations
│   │   ├── popularity.service.ts          # Popularity calculations
│   │   ├── ports/
│   │   │   └── index.ts                  # Port definitions
│   │   ├── errors/
│   │   │   └── index.ts                  # Domain errors
│   │   └── types/
│   │       └── index.ts                  # Domain types
│   ├── quiz.service.ts
│   ├── quiz-query.service.ts
│   └── ports/
│
├── infrastructure/
│   ├── repositories/
│   │   ├── quiz.repository.ts
│   │   ├── quiz-analytics.repository.ts  # Quiz stats queries
│   │   └── index.ts
│   └── queue/
│       ├── analytics-queue.service.ts
│       └── analytics.processor.ts
│
├── scheduler/
│   ├── analytics.scheduler.ts
│   └── index.ts
│
├── dto/
│   ├── request/
│   └── response/
│       ├── quiz-analytics.dto.ts
│       ├── trending-quizzes.dto.ts
│       ├── popular-quizzes.dto.ts
│       ├── category-analytics.dto.ts
│       └── index.ts
│
├── transport/
│   ├── controller/
│   │   └── quiz-analytics.controller.ts
│   └── filters/
│
└── quiz.module.ts  (updated with analytics imports)
```

## 5.2 Service Responsibilities

### 5.2.1 QuizAnalyticsService

```typescript
// Core service for quiz analytics
interface QuizAnalyticsService {
  // Sync refresh methods
  refreshQuizMetrics(quizId: string): Promise<void>;
  refreshReviewMetrics(quizId: string): Promise<void>;
  refreshBookmarkMetrics(quizId: string): Promise<void>;

  // Query methods
  getQuizAnalytics(quizId: string): Promise<QuizAnalytics>;
  getQuizMetrics(quizId: string): Promise<QuizMetrics>;

  // Batch operations
  refreshMetricsForQuizzes(quizIds: string[]): Promise<void>;
}
```

### 5.2.2 MetricsCalculatorService

```typescript
// Pure computation logic
interface MetricsCalculatorService {
  calculateTotalAttempts(quizId: string): Promise<number>;
  calculateUniquePlayers(quizId: string): Promise<number>;
  calculateAverageScore(quizId: string): Promise<number>;
  calculateCompletionRate(quizId: string): Promise<number>;
  calculateAverageRating(quizId: string): Promise<number>;
  calculateBookmarkCount(quizId: string): Promise<number>;
}
```

### 5.2.3 TrendingService

```typescript
// Trending score calculations
interface TrendingService {
  calculateTrendingScore(quizId: string): Promise<number>;
  getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]>;
  refreshAllTrendingScores(): Promise<void>;
}
```

### 5.2.4 PopularityService

```typescript
// Popularity score calculations
interface PopularityService {
  calculatePopularityScore(quizId: string): Promise<number>;
  getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]>;
  refreshAllPopularityScores(): Promise<void>;
  normalizeAllScores(): Promise<void>;
}
```

## 5.3 Port Definitions

### 5.3.1 AnalyticsRepositoryPort

```typescript
interface AnalyticsRepositoryPort {
  // Quiz stats CRUD
  getQuizStats(quizId: string): Promise<QuizStats | null>;
  upsertQuizStats(quizId: string, data: Partial<QuizStats>): Promise<void>;

  // Aggregation queries
  aggregateAttemptsByQuiz(quizId: string): Promise<AttemptAggregation>;
  aggregateReviewsByQuiz(quizId: string): Promise<ReviewAggregation>;
  aggregateBookmarksByQuiz(quizId: string): Promise<number>;
  aggregateAttemptsByCategory(): Promise<CategoryAggregation[]>;
}
```

### 5.3.2 External Domain Ports (Read-Only)

```typescript
// Ports to query source domains (read-only)
// These are injected from other modules

interface AttemptQueryPort {
  getCompletedAttemptsByQuizVersion(quizVersionId: string): Promise<Attempt[]>;
  getCompletedAttemptsByQuiz(quizId: string): Promise<Attempt[]>;
}

interface ReviewQueryPort {
  getReviewsByQuiz(quizId: string): Promise<Review[]>;
  getReviewCountByQuiz(quizId: string): Promise<number>;
}

interface BookmarkQueryPort {
  getBookmarkCountByQuiz(quizId: string): Promise<number>;
}
```

---

# 6. API Design

## 6.1 API Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API RESPONSIBILITIES                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GET /quizzes/:quizId/analytics                                     │    │
│  │                                                                       │    │
│  │  Returns: QuizAnalytics                                              │    │
│  │    - totalAttempts, uniquePlayers                                    │    │
│  │    - averageScore, completionRate                                    │    │
│  │    - averageRating, ratingCount                                      │    │
│  │    - bookmarkCount                                                   │    │
│  │                                                                       │    │
│  │  Access: Quiz creator or admin                                       │    │
│  │  Cache: 5 minutes                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GET /analytics/trending                                             │    │
│  │                                                                       │    │
│  │  Query: limit (default 10), categoryId (optional)                   │    │
│  │  Returns: TrendingQuiz[]                                             │    │
│  │    - quizId, title, slug, imageUrl                                   │    │
│  │    - trendingScore, totalAttempts                                    │    │
│  │    - period: 'daily' | 'weekly'                                      │    │
│  │                                                                       │    │
│  │  Access: Public                                                      │    │
│  │  Cache: 15 minutes                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GET /analytics/popular                                             │    │
│  │                                                                       │    │
│  │  Query: limit (default 10), categoryId (optional)                   │    │
│  │  Returns: PopularQuiz[]                                              │    │
│  │    - quizId, title, slug, imageUrl                                   │    │
│  │    - popularityScore, totalAttempts                                  │    │
│  │    - averageRating, bookmarkCount                                    │    │
│  │                                                                       │    │
│  │  Access: Public                                                      │    │
│  │  Cache: 1 hour                                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GET /categories/:categoryId/analytics                               │    │
│  │                                                                       │    │
│  │  Returns: CategoryAnalytics                                          │    │
│  │    - totalQuizzes, activeQuizzes                                     │    │
│  │    - totalAttempts, totalPlayers                                     │    │
│  │    - averageScore, averageRating                                     │    │
│  │    - topQuizzes: PopularQuiz[]                                      │    │
│  │                                                                       │    │
│  │  Access: Public                                                      │    │
│  │  Cache: 1 hour                                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GET /analytics/creator/:userId                                     │    │
│  │                                                                       │    │
│  │  Returns: CreatorAnalytics                                           │    │
│  │    - totalQuizzes, publishedQuizzes                                  │    │
│  │    - totalAttempts (across all quizzes)                             │    │
│  │    - totalPlayers, totalReviews                                      │    │
│  │    - averageRating (across all quizzes)                              │    │
│  │    - topPerformingQuiz, worstPerformingQuiz                          │    │
│  │                                                                       │    │
│  │  Access: Quiz creator or admin                                       │    │
│  │  Cache: 5 minutes                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Response DTOs

### 6.2.1 QuizAnalytics Response

```typescript
interface QuizAnalyticsResponse {
  quizId: string;
  metrics: {
    totalAttempts: number;
    uniquePlayers: number;
    averageScore: number;        // percentage (0-100)
    completionRate: number;     // percentage (0-100)
  };
  reviewMetrics: {
    averageRating: number;       // 1-5 scale
    ratingCount: number;
  };
  engagementMetrics: {
    bookmarkCount: number;
  };
  popularity: {
    popularityScore: number;
    trendingScore: number;
    rank?: number;              // rank among all quizzes
  };
  lastUpdated: string;         // ISO timestamp
}
```

### 6.2.2 TrendingQuizzes Response

```typescript
interface TrendingQuizzesResponse {
  period: 'daily' | 'weekly';
  quizzes: Array<{
    rank: number;
    quizId: string;
    title: string;
    slug: string;
    imageUrl?: string;
    trendingScore: number;
    totalAttempts: number;
    recentAttempts: number;     // attempts in trending window
  }>;
  lastUpdated: string;
}
```

### 6.2.3 PopularQuizzes Response

```typescript
interface PopularQuizzesResponse {
  quizzes: Array<{
    rank: number;
    quizId: string;
    title: string;
    slug: string;
    imageUrl?: string;
    popularityScore: number;
    totalAttempts: number;
    averageRating: number;
    bookmarkCount: number;
  }>;
  lastUpdated: string;
}
```

### 6.2.4 CategoryAnalytics Response

```typescript
interface CategoryAnalyticsResponse {
  categoryId: string;
  categoryName: string;
  summary: {
    totalQuizzes: number;
    activeQuizzes: number;       // quizzes with attempts in 30 days
    totalAttempts: number;
    totalPlayers: number;
    averageScore: number;
    averageRating: number;
  };
  topQuizzes: PopularQuiz[];    // top 5 by popularity
  lastUpdated: string;
}
```

---

# 7. Implementation Plan

## 7.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION PHASES                                 │
│                                                                              │
│  Phase 4.1 ─── Foundation (Quiz Module Enhancement)                        │
│  │   ├── Schema extensions                                                 │
│  │   ├── Add analytics services to quiz module                             │
│  │   └── Sync metric updates                                               │
│  │                                                                          │
│  Phase 4.2 ─── Aggregation & Trends                                        │
│  │   ├── Trending calculations                                             │
│  │   ├── Popularity calculations                                           │
│  │   └── Scheduled refresh jobs                                             │
│  │                                                                          │
│  Phase 4.3 ─── APIs & Polish                                               │
│      ├── Analytics API endpoints                                             │
│      ├── Category analytics                                                 │
│      └── Creator analytics                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Phase 4.1: Foundation (Week 1)

### Goal
Add analytics feature to the quiz module with basic metric storage and synchronous updates.

### Tasks

| # | Task | Description | Effort |
|---|------|-------------|--------|
| 4.1.1 | Schema Extension | Add analytics fields to quiz_stats table | 2 hours |
| 4.1.2 | Create Analytics Folder | Add `domain/analytics/` folder in quiz module | 1 hour |
| 4.1.3 | QuizAnalyticsRepository | Implement repository for quiz_stats CRUD | 4 hours |
| 4.1.4 | MetricsCalculatorService | Implement pure calculation methods | 4 hours |
| 4.1.5 | QuizAnalyticsService | Implement refresh and query methods | 4 hours |
| 4.1.6 | Integration with Attempt | Call analytics refresh on attempt completion | 2 hours |
| 4.1.7 | Integration with Review | Call analytics refresh on review submit/delete | 2 hours |
| 4.1.8 | Integration with Bookmark | Call analytics refresh on bookmark add/remove | 2 hours |
| 4.1.9 | Basic API | GET /quizzes/:quizId/analytics endpoint | 4 hours |
| 4.1.10 | Testing | Unit tests for MetricsCalculatorService | 4 hours |

### Deliverables
- Analytics feature integrated into quiz module
- Quiz stats table extended with metrics fields
- Synchronous metric updates on entity changes
- Basic analytics API endpoint

### Success Criteria
- Quiz analytics endpoint returns accurate metrics
- Metrics update immediately when attempts/reviews/bookmarks change

## 7.3 Phase 4.2: Aggregation & Trends (Week 2)

### Goal
Implement trending and popularity calculations with scheduled refresh.

### Tasks

| # | Task | Description | Effort |
|---|------|-------------|--------|
| 4.2.1 | TrendingService | Implement trending score calculation | 8 hours |
| 4.2.2 | PopularityService | Implement popularity score calculation | 8 hours |
| 4.2.3 | AnalyticsScheduler | Set up scheduled refresh jobs | 4 hours |
| 4.2.4 | Async Queue Setup | Configure Bull queue for async processing | 4 hours |
| 4.2.5 | Trending API | GET /analytics/trending endpoint | 4 hours |
| 4.2.6 | Popular API | GET /analytics/popular endpoint | 4 hours |
| 4.2.7 | Validation Job | Daily consistency check job | 4 hours |
| 4.2.8 | Testing | Integration tests for trending/popularity | 8 hours |

### Deliverables
- Trending and popularity calculation services
- Scheduled refresh jobs
- Trending and popular quizzes APIs

### Success Criteria
- Trending quizzes show recent activity correctly
- Popularity scores reflect relative quiz performance
- Scheduled jobs run reliably

## 7.4 Phase 4.3: APIs & Polish (Week 3)

### Goal
Complete API coverage and creator analytics.

### Tasks

| # | Task | Description | Effort |
|---|------|-------------|--------|
| 4.3.1 | CategoryAnalyticsService | Implement category aggregation | 8 hours |
| 4.3.2 | Category API | GET /categories/:categoryId/analytics | 4 hours |
| 4.3.3 | CreatorAnalyticsService | Implement creator-level analytics | 8 hours |
| 4.3.4 | Creator API | GET /analytics/creator/:userId | 4 hours |
| 4.3.5 | Caching | Add response caching to APIs | 4 hours |
| 4.3.6 | Error Handling | Edge cases and error responses | 4 hours |
| 4.3.7 | Documentation | API documentation | 2 hours |
| 4.3.8 | Performance Testing | Load test analytics endpoints | 4 hours |

### Deliverables
- Complete analytics API suite
- Category analytics
- Creator analytics
- Caching implementation

### Success Criteria
- All analytics endpoints functional
- Response times < 200ms for cached responses
- Full API documentation available

## 7.5 Effort Summary

| Phase | Tasks | Total Hours | Notes |
|-------|-------|------------|-------|
| 4.1 | 10 | 29 | Core infrastructure |
| 4.2 | 8 | 44 | Complex calculations |
| 4.3 | 8 | 38 | APIs and polish |
| **Total** | **26** | **~111** | 3-week solo effort |

---

# 8. Schema Extensions

## 8.1 Quiz Stats Extension

The existing `quiz_stats` table should be extended with additional columns:

```typescript
// Add to existing quiz_stats table definition
export const quizStatsExtended = {
  // ... existing fields ...

  // NEW: Review metrics
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 })
    .default('0')
    .notNull(),
  ratingCount: integer('rating_count').default(0).notNull(),

  // NEW: Bookmark metrics
  bookmarkCount: integer('bookmark_count').default(0).notNull(),

  // NEW: Calculated scores
  popularityScore: numeric('popularity_score', { precision: 10, scale: 4 })
    .default('0')
    .notNull(),
  trendingScore: numeric('trending_score', { precision: 10, scale: 4 })
    .default('0')
    .notNull(),

  // NEW: Metadata
  lastCalculatedAt: timestamp('last_calculated_at', {
    withTimezone: true,
    mode: 'string',
  }),

  // NEW: Category for analytics
  categoryId: uuid('category_id'),
};
```

## 8.2 Migration

```typescript
// Migration: extend_quiz_stats_for_analytics
export async function up(db: Database) {
  // Add new columns
  await db.execute(sql`
    ALTER TABLE quiz_stats
    ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS bookmark_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS popularity_score numeric(10,4) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS trending_score numeric(10,4) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS last_calculated_at timestamptz,
    ADD COLUMN IF NOT EXISTS category_id uuid;
  `);

  // Add index for trending queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_stats_trending_score_desc
    ON quiz_stats (trending_score DESC NULLS LAST);
  `);

  // Add index for popularity queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_stats_popularity_score_desc
    ON quiz_stats (popularity_score DESC NULLS LAST);
  `);

  // Add foreign key for category
  await db.execute(sql`
    ALTER TABLE quiz_stats
    ADD CONSTRAINT quiz_stats_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL;
  `);

  // Add check constraints
  await db.execute(sql`
    ALTER TABLE quiz_stats
    ADD CONSTRAINT quiz_stats_avg_rating_range
    CHECK (avg_rating >= 0 AND avg_rating <= 5);
  `);
}
```

---

# 9. Summary

## 9.1 Ownership Summary

| Feature | Ownership | Rationale |
|---------|-----------|-----------|
| Quiz Analytics | Within Quiz Module | Computed from quiz-related data |
| Quiz Domain | Quiz Module | Content, metadata, versions |
| Attempt Domain | Separate Module | Lifecycle, answers, scoring |
| Review Domain | Separate Module | Submission, ratings, comments |
| Bookmark Domain | Separate Module | Collections, user data |

## 9.2 Metrics Summary

| Metric | Formula | Update |
|--------|---------|--------|
| totalAttempts | COUNT(attempts) WHERE completed | Sync |
| uniquePlayers | COUNT(DISTINCT users) | Sync |
| averageScore | AVG(scorePercent) | Sync |
| completionRate | completed / total * 100 | Sync |
| averageRating | AVG(rating) | Sync |
| ratingCount | COUNT(reviews) | Sync |
| bookmarkCount | COUNT(bookmarks) | Sync |
| popularityScore | Weighted composite | Async |
| trendingScore | Time-decay weighted | Scheduled |

## 9.3 Module Structure

```
Quiz Module (Enhanced)
├── domain/
│   ├── analytics/
│   │   ├── quiz-analytics.service.ts
│   │   ├── metrics-calculator.service.ts
│   │   ├── trending.service.ts
│   │   ├── popularity.service.ts
│   │   └── ports/
│   ├── quiz.service.ts
│   └── ...
├── infrastructure/
│   ├── repositories/
│   │   └── quiz-analytics.repository.ts
│   └── queue/
├── scheduler/
│   └── analytics.scheduler.ts
├── dto/response/
│   └── quiz-analytics.dto.ts
└── quiz.module.ts
```

## 9.4 API Endpoints

| Endpoint | Access | Cache |
|----------|--------|-------|
| GET /quizzes/:quizId/analytics | Creator/Admin | 5 min |
| GET /analytics/trending | Public | 15 min |
| GET /analytics/popular | Public | 1 hour |
| GET /categories/:categoryId/analytics | Public | 1 hour |
| GET /analytics/creator/:userId | Creator/Admin | 5 min |

## 9.5 Implementation Priority

1. **Phase 4.1**: Schema extension, basic metrics, sync updates
2. **Phase 4.2**: Trending, popularity, scheduled jobs
3. **Phase 4.3**: Complete APIs, category analytics, creator analytics

---

> **End of Document**
