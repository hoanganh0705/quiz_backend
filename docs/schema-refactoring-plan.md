# Drizzle Schema Refactoring Plan

> **Status**: Draft — not yet started
> **Last updated**: 2026-06-22
> **Drizzle config**: `schema: './src/core/database/schema'`
> **Current schema**: 2 files (`schema/index.ts` 2,979 lines + `schema/relations.ts` 590 lines)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Dependency Analysis](#3-dependency-analysis)
4. [Risk Assessment](#4-risk-assessment)
5. [Candidate Folder Structures](#5-candidate-folder-structures)
6. [Recommended Folder Structure](#6-recommended-folder-structure)
7. [Incremental Migration Plan](#7-incremental-migration-plan)
8. [Validation Strategy](#8-validation-strategy)

---

## 1. Current State Analysis

### 1.1 Physical Inventory

| Aspect | Count |
|---|---|
| `schema/index.ts` | 2,979 lines |
| `schema/relations.ts` | 590 lines |
| Total tables | ~35 |
| Total enums | 15 |
| Total named relations | 30 |
| Total indexes | ~100+ |
| Total check constraints | ~60+ |
| Total foreign keys | ~70+ |
| Drizzle migrations journaled | 4 |

### 1.2 Complete Table Registry

```
authAuditLogs
badges
badgeRules
bookmarkCollections
bookmarkedQuizzes
categoryFollows
categories
discussionComments
discussionReports
discussionSavedThreads
discussionThreads
discussionThreadSubscriptions
discussionVotes
friendships
idempotencyKeys
notificationPreferences
notifications
oauthAccounts
outboxEvents
passwordHistory
passwordResetTokens
quizAnswerOptions
quizAttemptAnswers
quizAttemptEvents
quizAttempts
quizCategories
quizInstances
quizInstancePlayers
quizQuestions
quizReviews
quizStats
quizTags
quizVersions
quizzes
rankingMilestones
rankHistory
rankRecalculationWorkItems
reviewHelpfulVotes
reviewReports
sentVerificationTokens
socialFeedActivities
tagFollows
tags
tournamentParticipants
tournamentRoundParticipants
tournamentRounds
tournamentStats
tournaments
userActivityEvents
userBadges
userFollows
userProfiles
userProfileSettings
userRanking
userSessions
users
```

### 1.3 Complete Enum Registry

```
activityEventType
badgeCategory
badgeRuleType
badgeType
discussionContentStatus
discussionReportStatus
discussionReportTargetType
discussionThreadStatus
discussionVoteValue
friendshipStatus
notificationChannel
notificationType
quizDifficulty
quizInstanceStatus
quizVersionStatus
tournamentRoundStatus
tournamentStatus
userRole
```

---

## 2. Bounded Contexts

The schema naturally decomposes into 12 bounded contexts. These are derived from table groupings, foreign key patterns, and the existing `src/modules/*` hexagonal architecture.

| # | Context | Tables | Count | Maps To |
|---|---|---|---|---|
| S | **shared** | enums, tsvector type | — | `shared/` |
| 1 | **auth** | users, userSessions, passwordResetTokens, sentVerificationTokens, passwordHistory, oauthAccounts, authAuditLogs | 7 | `src/modules/auth/` |
| 2 | **quiz** | quizzes, quizVersions, quizQuestions, quizAnswerOptions, quizCategories, quizTags, quizStats, quizAttempts, quizAttemptAnswers, quizAttemptEvents, quizReviews, bookmarkCollections, bookmarkedQuizzes, quizInstances, quizInstancePlayers | 15 | `src/modules/quiz/` |
| 3 | **achievement** | badges, badgeRules, userBadges | 3 | `src/modules/achievement/` |
| 4 | **ranking** | userRanking, rankHistory, rankingMilestones, rankRecalculationWorkItems | 4 | `src/modules/ranking/` |
| 5 | **discussion** | discussionThreads, discussionComments, discussionVotes, discussionReports, discussionThreadSubscriptions, discussionSavedThreads | 6 | `src/modules/discussion/` |
| 6 | **social** | socialFeedActivities, friendships, blockedUsers, userFollows | 4 | `src/modules/social/` |
| 7 | **notification** | notifications, notificationPreferences | 2 | `src/modules/notification/` |
| 8 | **taxonomy** | categories, tags, categoryFollows, tagFollows | 4 | `src/modules/category/` + `src/modules/tag/` |
| 9 | **tournament** | tournaments, tournamentRounds, tournamentParticipants, tournamentRoundParticipants, tournamentStats | 5 | `src/modules/tournament/` |
| 10 | **user** | userProfiles, userProfileSettings, userActivityEvents | 3 | `src/modules/user/` |
| 11 | **review** | reviewHelpfulVotes, reviewReports | 2 | `src/modules/review/` |
| 12 | **outbox** | outboxEvents, idempotencyKeys | 2 | (cross-cutting) |

### 2.1 Join / Pivot Tables Per Context

| Join Table | Joins | Belongs To |
|---|---|---|
| `quizCategories` | quizzes × categories | quiz ↔ taxonomy |
| `quizTags` | quizzes × tags | quiz ↔ taxonomy |
| `bookmarkedQuizzes` | bookmarkCollections × quizzes | quiz |
| `quizInstancePlayers` | quizInstances × quizAttempts × users | quiz |
| `tournamentParticipants` | tournaments × users | tournament ↔ auth |
| `tournamentRoundParticipants` | tournamentRounds × tournamentParticipants × quizAttempts | tournament ↔ quiz |
| `categoryFollows` | categories × users | taxonomy ↔ auth |
| `tagFollows` | tags × users | taxonomy ↔ auth |
| `friendships` | users × users | social (self-referential) |
| `blockedUsers` | users × users | social (self-referential) |
| `userFollows` | users × users | social (self-referential) |
| `discussionThreadSubscriptions` | discussionThreads × users | discussion ↔ auth |
| `discussionSavedThreads` | discussionThreads × users | discussion ↔ auth |

---

## 3. Dependency Analysis

### 3.1 Context Dependency Hierarchy

```
shared (enums + types)
  └── auth (users is the central hub — every domain FKs to users)
        ├── achievement
        ├── ranking
        ├── user
        ├── social
        ├── notification
        ├── taxonomy (categories, tags)
        │     └── quiz (quizCategories → categories, quizTags → tags)
        ├── quiz
        │     ├── review (quizReviews, reviewHelpfulVotes, reviewReports)
        │     └── discussion (discussionThreads → quizzes)
        │     └── tournament (quizVersions, quizAttempts)
        └── outbox (no FK dependencies on anything)
```

### 3.2 Cross-Domain Foreign Keys

These FKs span domain boundaries and require careful handling during extraction:

| FK Holder (domain) | Column | References (domain) | Notes |
|---|---|---|---|
| `discussion` | `discussionThreads.quizId` | `quizzes` (quiz) | FK declared in discussion's relations |
| `quiz` | `quizzes.creatorId` | `users` (auth) | FK declared in quiz's schema |
| `quiz` | `quizzes.publishedVersionId` | `quizVersions` (quiz) | Self-contained within quiz |
| `quiz` | `quizInstances.hostUserId` | `users` (auth) | FK declared in quiz's schema |
| `quiz` | `quizCategories.categoryId` | `categories` (taxonomy) | FK declared in quiz's schema |
| `quiz` | `quizTags.tagId` | `tags` (taxonomy) | FK declared in quiz's schema |
| `quiz` | `quizReviews.quizId` | `quizzes` (quiz) | Self-contained within quiz |
| `quiz` | `quizReviews.userId` | `users` (auth) | FK declared in quiz's schema |
| `quiz` | `quizAttempts.userId` | `users` (auth) | FK declared in quiz's schema |
| `quiz` | `quizAttemptAnswers.questionId` | `quizQuestions` (quiz) | Self-contained |
| `quiz` | `quizAttemptAnswers.selectedOptionId` | `quizAnswerOptions` (quiz) | Self-contained |
| `tournament` | `tournaments.categoryId` | `categories` (taxonomy) | FK declared in tournament's relations |
| `tournament` | `tournamentRounds.quizVersionId` | `quizVersions` (quiz) | FK declared in tournament's relations |
| `tournament` | `tournamentParticipants.userId` | `users` (auth) | FK declared in tournament's schema |
| `tournament` | `tournamentRoundParticipants.attemptId` | `quizAttempts` (quiz) | FK declared in tournament's relations |
| `social` | `friendships.requesterId` | `users` (auth) | Self-referential, declared in social |
| `social` | `blockedUsers.blockerId` | `users` (auth) | Self-referential, declared in social |
| `social` | `userFollows.followerId` | `users` (auth) | Self-referential, declared in social |
| `social` | `socialFeedActivities.userId` | `users` (auth) | FK declared in social's schema |
| `user` | `userProfiles.userId` | `users` (auth) | FK declared in user's schema |
| `user` | `userProfileSettings.userId` | `users` (auth) | FK declared in user's schema |
| `user` | `userActivityEvents.userId` | `users` (auth) | FK declared in user's schema |
| `notification` | `notifications.userId` | `users` (auth) | FK declared in notification's schema |
| `notification` | `notificationPreferences.userId` | `users` (auth) | FK declared in notification's schema |
| `achievement` | `userBadges.userId` | `users` (auth) | FK declared in achievement's schema |
| `achievement` | `userBadges.badgeId` | `badges` (achievement) | Self-contained |
| `achievement` | `badgeRules.badgeId` | `badges` (achievement) | Self-contained |
| `ranking` | `userRanking.userId` | `users` (auth) | FK declared in ranking's schema |
| `ranking` | `rankHistory.userId` | `users` (auth) | FK declared in ranking's schema |
| `ranking` | `rankingMilestones.userId` | `users` (auth) | FK declared in ranking's schema |
| `ranking` | `rankRecalculationWorkItems.userId` | `users` (auth) | FK declared in ranking's schema |
| `taxonomy` | `categoryFollows.userId` | `users` (auth) | FK declared in taxonomy's schema |
| `taxonomy` | `categoryFollows.categoryId` | `categories` (taxonomy) | Self-contained |
| `taxonomy` | `tagFollows.userId` | `users` (auth) | FK declared in taxonomy's schema |
| `taxonomy` | `tagFollows.tagId` | `tags` (taxonomy) | Self-contained |
| `review` | `reviewHelpfulVotes.userId` | `users` (auth) | FK declared in review's schema |
| `review` | `reviewHelpfulVotes.reviewId` | `quizReviews` (quiz) | FK declared in review's schema |
| `review` | `reviewReports.userId` | `users` (auth) | FK declared in review's schema |
| `review` | `reviewReports.reviewId` | `quizReviews` (quiz) | FK declared in review's schema |

### 3.3 Self-Referential Foreign Keys

| Table | Self-Referential FK | Notes |
|---|---|---|
| `discussionComments` | `parentCommentId → commentId` | Must stay in discussion domain |
| `discussionThreads` | `solvedCommentId → discussionComments.commentId` | Cross-table, same domain |
| `discussionThreads` | `solvedBy → users.userId` | Cross-domain (auth) |

### 3.4 Special Patterns

- **`tsvector` custom type** (`customType<{ data: string }>`): Used by `users`, `quizzes`, `discussionThreads`. Must live in `shared/types.ts`.
- **Partial unique indexes** (`.where()`): Used for soft-delete uniqueness across many tables. Drizzle handles these correctly in separate files.
- **Composite unique constraints**: Multi-column uniques (e.g., `uq_quiz_categories_pair` on `(categoryId, quizId)`) must move with their parent table.
- **Forward reference workaround**: Schema already uses `(quizzes as { quizId: AnyPgColumn }).quizId` cast for self-referential FKs. Must be preserved after splitting.

---

## 4. Risk Assessment

### 4.1 Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Forward reference breakage after file split | Critical | High | Preserve cross-file import patterns; use relative paths within domain |
| Cross-domain FK in split schemas | High | Certain | Declare cross-domain FKs in the `relations.ts` of the FK holder |
| `users` as universal dependency hub | High | Certain | Extract auth first; all other domains import `users` from `auth/` |
| `drizzle.config.ts` path update | High | Certain | Update from `'./src/core/database/schema'` to `'./src/core/database/schema/index.ts'` after final phase |
| Relations file cross-references | High | Certain | Each domain gets its own `relations.ts`; cross-domain relations declared in FK holder's file |
| Module import path updates | Medium | Certain | All `src/modules/*` currently import from `@/core/database/schema`; update per phase |
| Migration compatibility | High | Medium | Each phase must produce zero SQL diff (only file organization changes) |
| `tsvector` custom type | Low | Certain | Move to `shared/types.ts`; all domains import from there |
| Self-referential FK in `discussionComments` | Medium | Certain | Must stay within discussion domain; handled in `discussion/schema.ts` |
| Circular within quiz domain (`quizzes ↔ quizVersions`) | Low | Low | Self-contained within quiz; no extraction ordering issue |

### 4.2 Critical Decision Points

**Where to declare cross-domain FKs?**
The FK should be declared in the `relations.ts` of the domain that **holds** the FK, not the referenced domain. For example, `discussionThreads.quizId → quizzes` is declared in `discussion/relations.ts` (importing `quizzes` from `quiz/`), not in `quiz/relations.ts`.

---

## 5. Candidate Folder Structures

### Option A — Flat Schema Files

```
schema/
├── _shared.ts
├── auth.ts
├── auth.relations.ts
├── quiz.ts
├── quiz.relations.ts
├── ranking.ts
├── ranking.relations.ts
├── ...
└── index.ts
```

- **Pros**: Minimal change, easy to scan
- **Cons**: Flat namespace; discoverability degrades as file count grows; no colocation of schema + relations

### Option B — Directory-Per-Domain (Recommended)

```
schema/
├── shared/
│   ├── enums.ts
│   └── types.ts
├── auth/
│   ├── schema.ts
│   └── relations.ts
├── quiz/
│   ├── schema.ts
│   └── relations.ts
├── ranking/
│   ├── schema.ts
│   └── relations.ts
├── achievement/
│   ├── schema.ts
│   └── relations.ts
├── discussion/
│   ├── schema.ts
│   └── relations.ts
├── social/
│   ├── schema.ts
│   └── relations.ts
├── notification/
│   ├── schema.ts
│   └── relations.ts
├── taxonomy/
│   ├── schema.ts
│   └── relations.ts
├── tournament/
│   ├── schema.ts
│   └── relations.ts
├── user/
│   ├── schema.ts
│   └── relations.ts
├── review/
│   ├── schema.ts
│   └── relations.ts
├── outbox/
│   ├── schema.ts
│   └── relations.ts
└── index.ts
```

- **Pros**: Mirrors existing `src/modules/*` hexagonal architecture exactly; scales gracefully; clean separation; each domain independently understandable
- **Cons**: More directories; slightly more path complexity; requires drizzle config update

### Option C — Hybrid

Same as Option B but enums are further split (each domain has its own enums) instead of a single `shared/enums.ts`.

- **Cons**: Cross-domain enum imports are painful; enums rarely change so a shared file is pragmatic

---

## 6. Recommended Folder Structure

**Option B — Directory-Per-Domain**

Rationale: The codebase already has 13 hexagonal modules at `src/modules/{auth,quiz,tournament,...}`. The schema refactoring should mirror that architecture. The schema is the persistence layer, and domain modules already own their infrastructure adapters. Having `schema/{auth,quiz,tournament}/` map directly onto `modules/{auth,quiz,tournament}/` creates a clear, discoverable convention.

```
src/core/database/schema/
├── shared/
│   ├── enums.ts       # All 15 enums — single source of truth
│   └── types.ts       # tsvector customType, shared column helpers
├── auth/
│   ├── schema.ts      # users, userSessions, passwordResetTokens,
│   │                  # sentVerificationTokens, passwordHistory,
│   │                  # oauthAccounts, authAuditLogs
│   └── relations.ts   # usersRelations, userSessionsRelations
├── quiz/
│   ├── schema.ts      # quizzes, quizVersions, quizQuestions,
│   │                  # quizAnswerOptions, quizCategories, quizTags,
│   │                  # quizStats, quizAttempts, quizAttemptAnswers,
│   │                  # quizAttemptEvents, quizReviews, bookmarkCollections,
│   │                  # bookmarkedQuizzes, quizInstances, quizInstancePlayers
│   └── relations.ts   # All quiz relations
├── achievement/
│   ├── schema.ts      # badges, badgeRules, userBadges
│   └── relations.ts
├── ranking/
│   ├── schema.ts      # userRanking, rankHistory, rankingMilestones,
│   │                  # rankRecalculationWorkItems
│   └── relations.ts
├── discussion/
│   ├── schema.ts      # discussionThreads, discussionComments,
│   │                  # discussionVotes, discussionReports,
│   │                  # discussionThreadSubscriptions,
│   │                  # discussionSavedThreads
│   └── relations.ts   # Cross-FK to quizzes declared here
├── social/
│   ├── schema.ts      # socialFeedActivities, friendships, blockedUsers,
│   │                  # userFollows
│   └── relations.ts   # Self-referential FKs to users declared here
├── notification/
│   ├── schema.ts      # notifications, notificationPreferences
│   └── relations.ts
├── taxonomy/
│   ├── schema.ts      # categories, tags, categoryFollows, tagFollows
│   └── relations.ts
├── tournament/
│   ├── schema.ts      # tournaments, tournamentRounds,
│   │                  # tournamentParticipants,
│   │                  # tournamentRoundParticipants, tournamentStats
│   └── relations.ts   # Cross-FK to quizVersions, quizAttempts
├── user/
│   ├── schema.ts      # userProfiles, userProfileSettings,
│   │                  # userActivityEvents
│   └── relations.ts
├── review/
│   ├── schema.ts      # reviewHelpfulVotes, reviewReports
│   └── relations.ts   # FK to quizReviews declared here
├── outbox/
│   ├── schema.ts      # outboxEvents, idempotencyKeys
│   └── relations.ts
└── index.ts           # Pure barrel: re-exports everything from each domain
```

**`drizzle.config.ts` update** (post Phase 8):
```typescript
schema: './src/core/database/schema/index.ts',
```

---

## 7. Incremental Migration Plan

> **Critical principle**: Each phase must be **zero-migration**. The database schema does not change — only the TypeScript file organization changes. Validation = `drizzle-kit generate` produces zero-diff or only whitespace/comments diff.

---

### Phase 0 — Preparation

**Goal**: Audit the codebase, establish conventions, create the directory skeleton.

**Steps**:
1. Create all domain directories under `schema/`
2. Create `shared/enums.ts` with all 15 enums (copy from `index.ts`)
3. Create `shared/types.ts` with `tsvector` customType
4. Create stub `schema.ts` and `relations.ts` in each domain directory (empty exports)
5. Update `drizzle.config.ts` to `schema: './src/core/database/schema/index.ts'` **only after Phase 8**

**Files created**: ~26 new files (2 per domain + 2 in shared + stubs)

**Expected risk**: Very Low — all new files, old `schema/index.ts` unchanged

**Rollback**: Delete the new directories; revert `drizzle.config.ts`

**Validation checklist**:
- [ ] All directories created under `schema/`
- [ ] `shared/enums.ts` compiles (all 15 enums present)
- [ ] `shared/types.ts` compiles (`tsvector` customType present)
- [ ] `tsc --noEmit` passes
- [ ] Existing tests still pass

---

### Phase 1 — Extract Shared Enums + Types

**Goal**: All 15 enums and `tsvector` customType live in `shared/`. All domain files import from there.

**Files modified**:
- `schema/index.ts` — replace inline enum definitions with `export * from './shared/enums'`; replace inline `tsvector` with `export * from './shared/types'`

**Enums moved**:
```
activityEventType, badgeCategory, badgeRuleType, badgeType,
discussionContentStatus, discussionReportStatus, discussionReportTargetType,
discussionThreadStatus, discussionVoteValue, friendshipStatus,
notificationChannel, notificationType, quizDifficulty, quizInstanceStatus,
quizVersionStatus, tournamentRoundStatus, tournamentStatus, userRole
```

**Expected risk**: Very Low — all domain files still import via `schema/index.ts` barrel

**Rollback**: Revert `schema/index.ts` to inline enum definitions

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] All 15 enums accessible via `schema/index.ts` re-exports
- [ ] `tsc --noEmit` passes
- [ ] All module imports still resolve via `@/core/database/schema`

---

### Phase 2 — Extract Auth Domain

**Goal**: Extract `users` and all auth tables to `auth/schema.ts`. Extract auth relations to `auth/relations.ts`.

**Tables extracted** (7):
```
users, userSessions, passwordResetTokens, sentVerificationTokens,
passwordHistory, oauthAccounts, authAuditLogs
```

**Enums consumed**: `userRole` (from shared)

**Relations extracted**:
```
usersRelations, userSessionsRelations
```

**Files created/modified**:
- Create `schema/auth/schema.ts` — 7 tables
- Create `schema/auth/relations.ts` — 2 relation blocks
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Outgoing FKs from this domain**: None (auth tables only FK to `users`, which lives here)

**Incoming FKs** (other domains FK to users — they will import `users` from here):
- All other domains

**Expected risk**: Low — `users` has no outgoing FKs; only incoming from other domains

**Rollback**: Move tables back to `schema/index.ts`; delete `auth/` directory

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] `tsc --noEmit` passes
- [ ] Auth module imports (`@/core/database/schema`) still resolve
- [ ] Drizzle `db.query.usersRelations` and `db.query.userSessionsRelations` still work
- [ ] All FK constraints still point to `users` table

---

### Phase 3 — Extract Quiz Domain

**Goal**: Extract the full quiz subgraph. This is the largest extraction.

**Tables extracted** (15):
```
quizzes, quizVersions, quizQuestions, quizAnswerOptions,
quizCategories, quizTags, quizStats, quizAttempts,
quizAttemptAnswers, quizAttemptEvents, quizReviews,
bookmarkCollections, bookmarkedQuizzes, quizInstances,
quizInstancePlayers
```

**Review tables** (2 — co-located with quiz):
```
reviewHelpfulVotes, reviewReports
```

**Enums consumed** (from shared): `quizDifficulty`, `quizVersionStatus`, `quizInstanceStatus`

**Relations extracted**: All quiz relations (see Section 6 for full list)

**Cross-domain FKs to declare** (in `quiz/relations.ts` or importing domain's relations):
- FK to `users` (`creatorId`, `hostUserId`, `userId`) — import from `auth/`
- FK to `categories` (`categoryId`) — import from `taxonomy/` (or declare FK in `quiz/relations.ts` when taxonomy is extracted)
- FK to `tags` (`tagId`) — import from `taxonomy/` (or declare FK in `quiz/relations.ts` when taxonomy is extracted)

> **Note on cross-domain FK ordering**: If `taxonomy` hasn't been extracted yet, `quizCategories.categoryId → categories` and `quizTags.tagId → tags` FKs can temporarily reference the `categories`/`tags` still in `schema/index.ts`. Once taxonomy is extracted in Phase 5, update the imports. Alternatively, declare these FKs in `quiz/relations.ts` after taxonomy is extracted. The safest approach is to declare FKs as late as possible when both sides are extracted.

**Files created/modified**:
- Create `schema/quiz/schema.ts` — 17 tables
- Create `schema/quiz/relations.ts` — all quiz relations
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Expected risk**: Medium — largest domain, most tables, cross-domain FKs to auth and taxonomy

**Rollback**: Move tables back to `schema/index.ts`; delete `quiz/` directory

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] All cross-domain FKs still point to correct tables
- [ ] Quiz domain relations resolve correctly
- [ ] `tsc --noEmit` passes
- [ ] `reviewHelpfulVotes` and `reviewReports` co-located with quiz
- [ ] Review module imports resolve

---

### Phase 4 — Extract Achievement + Ranking

**Goal**: Extract achievement and ranking domains. Both are self-contained relative to auth.

**Achievement tables** (3):
```
badges, badgeRules, userBadges
```

**Achievement relations**: `badgesRelations`, `badgeRulesRelations`, `userBadgesRelations`

**Achievement enums** (from shared): `badgeType`, `badgeRuleType`, `badgeCategory`

**Ranking tables** (4):
```
userRanking, rankHistory, rankingMilestones, rankRecalculationWorkItems
```

**Ranking relations**: `userRankingRelations`, `rankHistoryRelations`

**Shared dependency**: Both import `users` from `auth/`; achievement also imports `badges` from its own domain

**Files created/modified**:
- Create `schema/achievement/schema.ts` — 3 tables
- Create `schema/achievement/relations.ts` — 3 relation blocks
- Create `schema/ranking/schema.ts` — 4 tables
- Create `schema/ranking/relations.ts` — 2 relation blocks
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Expected risk**: Low — self-contained domains with only FK to `users` (already extracted)

**Rollback**: Move tables back to `schema/index.ts`; delete domain directories

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] `tsc --noEmit` passes
- [ ] Achievement module imports resolve
- [ ] Ranking module imports resolve
- [ ] `userBadges` FK to `users` and `badges` still correct
- [ ] `userRanking` FK to `users` still correct

---

### Phase 5 — Extract User + Taxonomy + Discussion

**Goal**: Extract three more domains. These are done together because discussion FKs to quiz (extracted in Phase 3) and taxonomy FKs to quiz (extracted in Phase 3).

#### 5a — User Domain

**Tables** (3):
```
userProfiles, userProfileSettings, userActivityEvents
```

**Relations**: `userProfilesRelations`, `userProfileSettingsRelations`, `userActivityEventsRelations`

**Enums consumed** (from shared): `activityEventType`

**FKs**: All FK to `users` (from `auth/`)

#### 5b — Taxonomy Domain

**Tables** (4):
```
categories, tags, categoryFollows, tagFollows
```

**Relations**: `categoriesRelations`, `tagsRelations`, `tagFollowsRelations`, `categoryFollowsRelations`

**FKs**:
- `categoryFollows.userId → users` (from `auth/`)
- `categoryFollows.categoryId → categories` (self-contained)
- `tagFollows.userId → users` (from `auth/`)
- `tagFollows.tagId → tags` (self-contained)

#### 5c — Discussion Domain

**Tables** (6):
```
discussionThreads, discussionComments, discussionVotes,
discussionReports, discussionThreadSubscriptions,
discussionSavedThreads
```

**Relations**: All 6 relation blocks

**Enums consumed** (from shared): `discussionThreadStatus`, `discussionContentStatus`, `discussionVoteValue`, `discussionReportStatus`, `discussionReportTargetType`

**FKs**:
- `discussionThreads.quizId → quizzes` — **import from `quiz/`**, FK declared in `discussion/relations.ts`
- `discussionThreads.authorId → users` — import from `auth/`
- `discussionThreads.solvedCommentId → discussionComments.commentId` — self-contained (discussion domain)
- `discussionThreads.solvedBy → users.userId` — import from `auth/`
- `discussionComments.threadId → discussionThreads.threadId` — self-contained
- `discussionComments.authorId → users` — import from `auth/`
- `discussionComments.parentCommentId → discussionComments.commentId` — **self-referential, must stay in discussion domain**
- `discussionVotes.userId → users` — import from `auth/`
- `discussionReports.reporterId → users` — import from `auth/`
- `discussionReports.reviewedByUserId → users` — import from `auth/`
- `discussionThreadSubscriptions.userId → users` — import from `auth/`
- `discussionThreadSubscriptions.threadId → discussionThreads` — self-contained
- `discussionSavedThreads.userId → users` — import from `auth/`
- `discussionSavedThreads.threadId → discussionThreads` — self-contained

**Files created/modified**:
- Create `schema/user/schema.ts` + `schema/user/relations.ts`
- Create `schema/taxonomy/schema.ts` + `schema/taxonomy/relations.ts`
- Create `schema/discussion/schema.ts` + `schema/discussion/relations.ts`
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Expected risk**: Medium — self-referential FK in discussion; cross-domain FK discussion→quiz

**Rollback**: Move tables back; delete domain directories

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] Self-referential FK `discussionComments.parentCommentId → discussionComments.commentId` preserved
- [ ] Cross-FK `discussionThreads.quizId → quizzes` still correct
- [ ] `tsc --noEmit` passes
- [ ] Discussion, user, and taxonomy module imports resolve

---

### Phase 6 — Extract Social + Notification

**Goal**: Extract social and notification domains. Both are straightforward.

**Social tables** (4):
```
socialFeedActivities, friendships, blockedUsers, userFollows
```

**Social relations**: `friendshipsRelations`, `blockedUsersRelations`, `userFollowsRelations`

**Social enums** (from shared): `friendshipStatus`, `socialFeedActivityType`

**Social FKs**: All FK to `users` (from `auth/`); self-referential (friendships, blockedUsers, userFollows all reference `users` table twice)

**Notification tables** (2):
```
notifications, notificationPreferences
```

**Notification relations**: `notificationsRelations`, `notificationPreferencesRelations`

**Notification enums** (from shared): `notificationType`, `notificationChannel`

**Notification FKs**: All FK to `users` (from `auth/`)

**Files created/modified**:
- Create `schema/social/schema.ts` + `schema/social/relations.ts`
- Create `schema/notification/schema.ts` + `schema/notification/relations.ts`
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Expected risk**: Low — self-contained with only FK to `users`

**Rollback**: Move tables back; delete domain directories

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] `tsc --noEmit` passes
- [ ] Social module imports resolve
- [ ] Notification module imports resolve
- [ ] Self-referential FKs in social domain preserved

---

### Phase 7 — Extract Tournament

**Goal**: Extract tournament domain. This is done last among the cross-domain domains because it FKs to quiz (quizVersions, quizAttempts), taxonomy (categories), and auth (users).

**Tables** (5):
```
tournaments, tournamentRounds, tournamentParticipants,
tournamentRoundParticipants, tournamentStats
```

**Relations**: All 5 relation blocks

**Enums consumed** (from shared): `quizDifficulty`, `tournamentStatus`, `tournamentRoundStatus`

**FKs** (declared in `tournament/relations.ts` importing from other domains):
- `tournaments.categoryId → categories` — import from `taxonomy/`
- `tournamentRounds.quizVersionId → quizVersions` — import from `quiz/`
- `tournamentRounds.tournamentId → tournaments` — self-contained
- `tournamentParticipants.tournamentId → tournaments` — self-contained
- `tournamentParticipants.userId → users` — import from `auth/`
- `tournamentRoundParticipants.attemptId → quizAttempts` — import from `quiz/`
- `tournamentRoundParticipants.participantId → tournamentParticipants` — self-contained
- `tournamentRoundParticipants.roundId → tournamentRounds` — self-contained
- `tournamentStats.tournamentId → tournaments` — self-contained

**Files created/modified**:
- Create `schema/tournament/schema.ts` + `schema/tournament/relations.ts`
- Modify `schema/index.ts` — remove extracted tables, add re-exports

**Expected risk**: Medium — FKs to quiz (quizVersions, quizAttempts), taxonomy (categories), auth (users)

**Rollback**: Move tables back; delete domain directory

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff
- [ ] Cross-FK `tournamentRounds.quizVersionId → quizVersions` preserved
- [ ] Cross-FK `tournamentRoundParticipants.attemptId → quizAttempts` preserved
- [ ] Cross-FK `tournaments.categoryId → categories` preserved
- [ ] `tsc --noEmit` passes
- [ ] Tournament module imports resolve

---

### Phase 8 — Extract Outbox + Finalize Barrel

**Goal**: Extract the last domain and finalize the root `index.ts` as a pure barrel re-export.

**Tables** (2):
```
outboxEvents, idempotencyKeys
```

**No outgoing FKs to any domain table.** These can be extracted last.

**Files created/modified**:
- Create `schema/outbox/schema.ts` — 2 tables (no relations needed)
- Modify `schema/index.ts` — remove all remaining table/enum definitions; replace with pure barrel re-exports from each domain folder

**Final `schema/index.ts` shape**:
```typescript
// shared
export * from './shared/enums';
export * from './shared/types';

// domains
export * from './auth/schema';
export * from './auth/relations';
export * from './quiz/schema';
export * from './quiz/relations';
// ... all other domains

// outbox
export * from './outbox/schema';
```

**Update `drizzle.config.ts`**:
```typescript
schema: './src/core/database/schema/index.ts',
```

**Expected risk**: Low — outbox has no FK dependencies; final barrel is straightforward

**Rollback**: Move tables back; revert `drizzle.config.ts` path

**Validation checklist**:
- [ ] `drizzle-kit generate` produces zero SQL diff vs. baseline
- [ ] `tsc --noEmit` passes
- [ ] All module files compile and run (integration test suite)
- [ ] No remaining inline table/enum definitions in `schema/index.ts`
- [ ] `drizzle.config.ts` schema path confirmed as `'./src/core/database/schema/index.ts'`
- [ ] Each domain barrel exports only its tables
- [ ] Each domain relations file exports only its relations

---

### Phase Summary

| Phase | Domain | Tables | Risk | Rollback | Key Dependency |
|---|---|---|---|---|---|
| 0 | Preparation | — | Very Low | Delete new dirs | None |
| 1 | Shared enums + types | 15 enums + tsvector | Very Low | Revert imports | None |
| 2 | Auth | 7 | Low | Revert to `index.ts` | shared |
| 3 | Quiz + Review | 17 | Medium | Revert to `index.ts` | shared, auth |
| 4 | Achievement + Ranking | 7 | Low | Revert to `index.ts` | shared, auth |
| 5 | User + Taxonomy + Discussion | 13 | Medium | Revert to `index.ts` | shared, auth, quiz |
| 6 | Social + Notification | 6 | Low | Revert to `index.ts` | shared, auth |
| 7 | Tournament | 5 | Medium | Revert to `index.ts` | shared, auth, quiz, taxonomy |
| 8 | Outbox + finalize barrel | 2 | Low | Revert to `index.ts` | None |

---

## 8. Validation Strategy

### 8.1 Per-Phase Validation (Automated)

Run these commands **after every phase**:

```bash
# 1. Generate migration and check for diff
npx drizzle-kit generate
git diff src/core/database/migrations/ --stat
# Expected: 0 lines or only whitespace/comments

# 2. TypeScript compilation
npx tsc --noEmit
# Expected: 0 errors

# 3. Verify schema export shape matches baseline
node -e "const s = require('./src/core/database/schema'); console.log(Object.keys(s).sort().join('\n'))"
# Expected: same exports as before the phase
```

### 8.2 End-to-End Validation (Post Phase 8)

```bash
# 1. Full migration diff check (must be zero)
npx drizzle-kit generate --strict
git diff src/core/database/migrations/

# 2. Run full test suite
npm test

# 3. Application startup smoke test
npm run start:dev
# Verify: all modules load, DB connections establish, no import errors

# 4. Manual smoke tests per domain
# Run a representative query from each domain:
#   - Auth: user login session lookup
#   - Quiz: quiz listing + question retrieval
#   - Achievement: badge query
#   - Ranking: user rank query
#   - Discussion: thread listing
#   - Social: friend list
#   - Notification: notification delivery
#   - Tournament: tournament listing
#   - Outbox: outbox event processing
```

### 8.3 If Migration Diff Appears

If `drizzle-kit generate` produces a non-zero SQL diff after any phase:

1. **Do not panic.** This is usually caused by one of:
   - Column type annotation changed (e.g., enum type name changed)
   - Constraint naming changed (Drizzle generates constraint names)
   - Index ordering changed
2. Check `src/core/database/migrations/` for the generated SQL
3. Compare with the baseline migration file
4. Fix by ensuring enum types and constraint names match exactly
5. If truly zero-diff is impossible (Drizzle version differences), document the expected diff

---

## Appendix A — Current Module Imports

All `src/modules/*` files currently import schema entities via:
```typescript
import { ... } from '@/core/database/schema';
```

After refactoring, each module's infrastructure repositories will continue to use this same import path — the barrel `schema/index.ts` re-exports everything, so no per-module import changes are needed.

## Appendix B — Forward Reference Patterns

The schema already uses a workaround for forward references:
```typescript
// Cast workaround used for self-referential FKs
(quizzes as { quizId: AnyPgColumn }).quizId

// Standard reference (within same file)
quizzes.quizId
```

After splitting, cross-domain FKs must use relative imports:
```typescript
// In quiz/schema.ts
import { users } from '../auth/schema';

// In discussion/relations.ts
import { quizzes } from '../quiz/schema';
```

## Appendix C — Drizzle Config

**Current** (`drizzle.config.ts`):
```typescript
schema: './src/core/database/schema',
```

**After Phase 8**:
```typescript
schema: './src/core/database/schema/index.ts',
```
