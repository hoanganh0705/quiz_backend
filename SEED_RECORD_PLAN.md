# Seed Record Enhancement Plan

## Goal

Make `SEED_RECORD.md` a **complete reference** for every seeded row: every persisted field (IDs, foreign keys, timestamps, JSON blobs), all relationship targets, and every entity — including those currently skipped.

**Non-goal**: change any seed data values, query logic, or database schema. Only recording/reporting changes.

---

## Current Coverage Gaps

| Seed file | What's recorded now | What's missing |
|---|---|---|
| `user.seed.ts` | username, email, role, displayName, userId, isVerified, xpTotal; **details** block with all fields | Nothing major — already the gold standard |
| `category.seed.ts` | slug, name, description | categoryId, imageUrl, createdAt, updatedAt; no details |
| `tag.seed.ts` | slug, name | tagId, createdAt, updatedAt; no details |
| `badge.seed.ts` | slug, name, type, rule-types summary | badgeId, category, description, iconUrl, isActive, timestamps; rules only as comma-separated types, no per-rule details |
| `quiz.seed.ts` (Quizzes) | slug, title, creator, versions, category, tags | quizId, creatorId, description, isFeatured, isHidden, isVerified, publishedVersionId, categoryId, tagIds, timestamps; no details |
| `quiz.seed.ts` (Quiz Versions) | quiz, version, status, questions, difficulty, durationMs, rewardXp | quizVersionId, quizId, versionNumber, passingScorePercent, createdByUserId, publishedAt, archivedAt, timestamps; no details |
| `ranking.seed.ts` | username, allTimeRank, allTimeXp, weeklyXp, monthlyXp, peakAllTimeRank | userId, weeklyRank, monthlyRank, dailyRank, all peaks, reset timestamps, isDirty; **no history or milestone records at all** |
| `user-badge.seed.ts` | username, badgeSlug, earnedAt | userBadgeId, userId, badgeId, badgeVersion, progress, metadata, expiresAt, revokedAt, revocationReason; no details |
| `notification.seed.ts` (Notifications) | notificationId, username, type, channel, title, isRead | userId, message, metadata, readAt, expiresAt, createdAt, deletedAt; no details |
| `notification.seed.ts` (Notification Preferences) | **Not recorded at all** | All preference rows silently seeded but invisible in the report |
| `discussion.seed.ts` | threadId, quizSlug, author, title, status, isSolved, comment/vote counts | quizId, authorId, body, vote breakdown, solvedAt, solvedCommentId, solvedBy; **no comment or vote records at all** |
| `review.seed.ts` | username, quizSlug, rating, comment | quizId, userId, createdAt, updatedAt; no details |
| `bookmark.seed.ts` (Collections) | name, owner, quiz count | collectionId, userId, description, createdAt, updatedAt; no details |
| `bookmark.seed.ts` (Bookmarked Quizzes) | collection, owner, quizSlug | bookmarkId, collectionId, quizId, notes, bookmarkedAt, updatedAt; no details |
| `tournament.seed.ts` | title, status, difficulty, dates, rounds, quizzes, category | tournamentId, description, prize, maxParticipants, categoryId, createdAt, updatedAt; **no round or participant records at all** |
| `instance.seed.ts` | quizSlug, version, host, status, maxPlayers | instanceId, quizVersionId, hostUserId, createdAt, updatedAt; no details |

---

## Changes

### 1. `src/commands/seed/infrastructure/seed-recorder.ts`

**Purpose**: polish the renderer so it handles richer `details` and new entity kinds gracefully.

| Change | Description |
|---|---|
| Improve label fallback in details block | Currently `record.fields.username ?? record.fields.email ?? record.id`. Add fallbacks for `slug`, `notificationId`, `threadId`, `quizSlug`, `collection`, `title`, and a generic `id` so every entity renders a readable label. |
| (No type changes needed) | `SeedRecord` already supports `details: Record<string, unknown>` — seed files just need to populate it. |

### 2. `src/commands/seed/foundation/user.seed.ts`

**Already complete** — uses `details` with every field. No change needed.

### 3. `src/commands/seed/foundation/category.seed.ts`

- Add `.returning({ categoryId, slug, name, createdAt, updatedAt })` after the upsert so we have the DB-assigned IDs and timestamps.
- Map results back to seeds by slug.
- Add a `details` block to each `recorder.record()` call with every field: `categoryId`, `slug`, `name`, `description`, `imageUrl`, `createdAt`, `updatedAt`.

### 4. `src/commands/seed/foundation/tag.seed.ts`

- Same pattern as categories: add `.returning({ tagId, slug, name, createdAt, updatedAt })`.
- Map results back to seeds by slug.
- Add `details` with `tagId`, `slug`, `name`, `createdAt`, `updatedAt`.

### 5. `src/commands/seed/foundation/badge.seed.ts`

- Add `.returning({ badgeId, slug, name, createdAt, updatedAt })` to the badge upsert.
- Build `slugToBadgeId` from returning rows (already partially exists).
- For each badge, expand `details` to include: `badgeId`, `slug`, `category`, `type`, `name`, `description`, `iconUrl`, `isActive`, `createdAt`, `updatedAt`, and a `rules` array where each rule carries `ruleType`, `priority`, `config`, `isActive`.
- Keep the headline `fields` table readable (slug, name, type, rule-count).

### 6. `src/commands/seed/development/quiz.seed.ts`

**Quizzes**:
- Add `.returning({ quizId, slug, title, creatorId, publishedVersionId, createdAt, updatedAt })` to `ensureQuiz()`.
- After taxonomy assignment, re-fetch or carry `categoryId` and `tagIds` into the record.
- Add `details` with every quiz field: `quizId`, `creatorId`, `title`, `slug`, `description`, `isFeatured`, `isHidden`, `isVerified`, `publishedVersionId`, `categoryId`, `tagIds`, `createdAt`, `updatedAt`.

**Quiz Versions**:
- Add `.returning({ quizVersionId, versionNumber, status, createdAt, updatedAt })` to `ensureQuizVersion()`.
- Add `details` with: `quizVersionId`, `quizId`, `versionNumber`, `status`, `difficulty`, `durationMs`, `passingScorePercent`, `rewardXp`, `createdByUserId`, `publishedAt`, `archivedAt`, `createdAt`, `updatedAt`.

### 7. `src/commands/seed/development/ranking.seed.ts`

- After the upsert, add `.returning({ userId, updatedAt })` (or use the known `userId` from lookup).
- Expand the `recorder.record()` call to include every ranking field in `details`: `userId`, all XP fields, all rank fields, all peak fields, all reset timestamps, `lastActivityAt`, `isDirty`.
- Add `details.history` array with each history row (`historyId`, `userId`, `period`, `snapshotDate`, `rank`, `xp`, `recordedAt`).
- Add `details.milestones` array with each milestone (`id`, `userId`, `milestone`, `rank`, `achievedAt`).

### 8. `src/commands/seed/development/user-badge.seed.ts`

- The `insert(...).returning({ userBadgeId })` already exists.
- After insertion, use the resolved `userId` and `badgeId` (already available from lookup) to build a full `details` block.
- Add `details` with: `userBadgeId`, `userId`, `badgeId`, `badgeSlug`, `username`, `earnedAt`, `badgeVersion`, `progress`, `metadata`, `expiresAt`, `revokedAt`, `revocationReason`.

### 9. `src/commands/seed/development/notification.seed.ts`

**Notifications** (already partially recorded):
- Add `details` with every field: `notificationId`, `userId`, `username`, `type`, `title`, `message`, `metadata`, `channel`, `isRead`, `readAt`, `expiresAt`, `createdAt`, `deletedAt`.

**Notification Preferences** (new — currently missing):
- Add a `recorder.record()` call inside the preference upsert loop.
- `kind: 'Notification Preferences'`, `id: username`.
- `fields`: username, inAppEnabled, emailEnabled, pushEnabled, achievementEnabled, tournamentEnabled, rankEnabled, friendEnabled, discussionEnabled, summaryEnabled, marketingEnabled, rankImprovementThreshold.
- `details`: `userId`, all boolean flags, `rankImprovementThreshold`, `quietHoursStart`, `quietHoursEnd`, `createdAt`, `updatedAt`.

### 10. `src/commands/seed/development/discussion.seed.ts`

**Discussion Threads**:
- After thread insert, carry `quizId`, `authorId`, `solvedBy` into the record.
- Add `details` with: `threadId`, `quizId`, `quizSlug`, `authorId`, `authorUsername`, `title`, `body`, `status`, `commentsCount`, `votesCount`, `upvotesCount`, `downvotesCount`, `isSolved`, `solvedAt`, `solvedCommentId`, `solvedBy`, `createdAt`, `updatedAt`.

**Discussion Comments** (new — currently not recorded):
- Add `recorder.record()` for each comment after insertion.
- `kind: 'Discussion Comments'`, `id: commentId`.
- `fields`: commentId, threadId, author, body (truncated), parentCommentId, repliesCount.
- `details`: `commentId`, `threadId`, `authorId`, `authorUsername`, `parentCommentId`, `body`, `repliesCount`, `votesCount`, `upvotesCount`, `downvotesCount`, `createdAt`, `updatedAt`.

**Discussion Votes** (new — currently not recorded):
- After vote insert (which already returns `voteId`), add `recorder.record()`.
- `kind: 'Discussion Votes'`, `id: voteId`.
- `fields`: voteId, username, targetType, targetId, value.
- `details`: `voteId`, `userId`, `targetType`, `targetId`, `value`, `createdAt`, `updatedAt`.

### 11. `src/commands/seed/development/review.seed.ts`

- Change `insert(...).returning()` to return the review row fields (at minimum `quizId`, `userId`, `rating`, `comment`, `createdAt`, `updatedAt`).
- Add `details` with: `quizId`, `quizSlug`, `userId`, `username`, `rating`, `comment`, `createdAt`, `updatedAt`.

### 12. `src/commands/seed/development/bookmark.seed.ts`

**Bookmark Collections**:
- After insert/upsert, carry the resolved `collectionId` and `userId` into the record.
- Add `details` with: `collectionId`, `userId`, `username`, `name`, `description`, `createdAt`, `updatedAt`.

**Bookmarked Quizzes**:
- After insertion, carry `bookmarkId` from the returning clause.
- Add `details` with: `bookmarkId`, `collectionId`, `quizId`, `quizSlug`, `notes`, `bookmarkedAt`, `updatedAt`.

### 13. `src/commands/seed/scenarios/tournament.seed.ts`

- Add `.returning({ tournamentId, title, createdAt, updatedAt })` to tournament insert.
- After all rounds are created, record each round: `kind: 'Tournament Rounds'`, `id: tournamentId:roundN`.
  - `details`: `roundId`, `tournamentId`, `roundNumber`, `name`, `description`, `quizVersionId`, `status`, `isElimination`, `participantLimit`, `createdAt`, `updatedAt`.
- After participant insert/upsert, record each participant: `kind: 'Tournament Participants'`, `id: tournamentId:username`.
  - `details`: `participantId`, `tournamentId`, `userId`, `username`, `registeredAt`, `totalScore`, `totalTimeMs`, `rankFinal`, `status`, `updatedAt`.
- Expand tournament `details` to include `tournamentId`, `description`, `prize`, `maxParticipants`, `categoryId`, `categorySlug`, `quizVersionIds`, timestamps.

### 14. `src/commands/seed/scenarios/instance.seed.ts`

- Add `.returning({ instanceId, quizVersionId, hostUserId, status, createdAt, updatedAt })` to the insert.
- Add `details` with: `instanceId`, `quizVersionId`, `quizSlug`, `hostUserId`, `hostUsername`, `maxPlayers`, `status`, `createdAt`, `updatedAt`.

---

## Implementation Order

Suggested order (foundation first, then development, then scenarios):

1. `seed-recorder.ts` — label fallback improvements
2. `category.seed.ts` + `tag.seed.ts` — simplest, good warm-up
3. `badge.seed.ts` — medium complexity (rules details)
4. `quiz.seed.ts` — medium-high (quizzes + versions)
5. `user.seed.ts` — verify it's already optimal
6. `user-badge.seed.ts` — straightforward enrichment
7. `ranking.seed.ts` — add history + milestones sections
8. `notification.seed.ts` — add preferences + notification details
9. `discussion.seed.ts` — add comments + votes sections
10. `review.seed.ts` — simple details enrichment
11. `bookmark.seed.ts` — enrich both sections
12. `tournament.seed.ts` — add rounds + participants sections
13. `instance.seed.ts` — details enrichment

---

## Verification

After all changes:

1. Run `pnpm db:seed:all` and confirm `SEED_RECORD.md` is generated.
2. Each section should have a headline table AND a collapsible details block.
3. Every seeded entity should appear — no gaps between what's seeded and what's recorded.
4. Spot-check that IDs (UUIDs), FK columns, timestamps, and JSON blobs are present in the details blocks.
5. Confirm the seed data itself is unchanged (same counts, same values in the database).
