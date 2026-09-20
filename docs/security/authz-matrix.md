# Authorization Matrix (IDOR Audit)

**Status:** Living document
**Owners:** Auth + Platform Security
**Last reviewed:** 2026-08-18

This document captures the **authoritative authorization decisions** for every endpoint that accepts a user-controlled identifier (the classic IDOR / BOLA attack surface). It exists so:

1. The next engineer who adds a `PATCH /resource/:id` endpoint knows the established pattern.
2. The E2E test suite can be generated mechanically from the matrix.
3. Auditors can review authorization decisions without reading every controller.

> **Rule of thumb:** If the request body contains a resource ID (e.g. `avatarPublicId`, `imagePublicId`, `tagIds`) **and** the resource is owned by a specific user, the controller MUST verify ownership before the DB write. The pattern lives in `StorageApplicationService.userOwnsAssetForPurpose`.

---

## Legend

| Column      | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| Endpoint    | The HTTP verb + path. Body fields only listed when they carry a foreign ID.      |
| Resource    | The owned record that needs an authorization check.                              |
| Owner check | Where the ownership gate is enforced (service, controller, middleware, none).    |
| Body fields | User-controlled IDs that require ownership verification (typically `*PublicId`). |
| Status      | ✅ Verified · ⚠️ Needs follow-up · 🆕 New this phase                             |

---

## Avatar / Cover Image / Quiz Cover

These all flow through the same `storage_assets` table and the same `userOwnsAssetForPurpose` gate.

| Endpoint                 | Resource          | Owner check                                                                                                | Body fields      | Status |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| `PATCH /users/me`        | avatar            | `UserApplicationService.updateProfile` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'avatar' })` | `avatarPublicId` | ✅     |
| `POST /quizzes`          | quiz cover image  | `QuizApplicationService.createQuiz` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'quiz' })`      | `imagePublicId`  | ✅     |
| `PATCH /quizzes/:quizId` | quiz cover image  | `QuizApplicationService.updateQuiz` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'quiz' })`      | `imagePublicId`  | ✅     |
| `POST /uploads/sign`     | upload signed URL | `UploadApplicationService` — purpose must match the authenticated user's intent                            | (n/a)            | ✅     |

**Invariant:** `storage_assets.owner_id = auth.user.sub` MUST be `true` before any `*PublicId` is accepted in a write payload. The DTO `@Matches` validator catches malformed shapes upstream; the gate is the authoritative check on the `(publicId, owner, purpose)` triple.

---

## Quiz / Question / Version Mutations

| Endpoint                                      | Resource | Owner check                                                                                  | Body fields              | Status |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- | ------------------------ | ------ |
| `PATCH /quizzes/:quizId`                      | quiz row | `QuizCommandService.updateQuiz` → `QuizPolicy.assertCanEdit(quiz.creatorId, user)`           | none                     | ✅     |
| `DELETE /quizzes/:quizId`                     | quiz row | `QuizCommandService.softDeleteQuizById` → `QuizPolicy.assertCanDelete(quiz.creatorId, user)` | none                     | ✅     |
| `POST /quizzes/:quizId/versions`              | quiz     | `QuizVersionApplicationService` → policy check                                               | `tagIds[]`, `categoryId` | ✅     |
| `PATCH /quizzes/:quizId/versions/:versionId`  | version  | policy check on parent quiz creator                                                          | `tagIds[]`, `categoryId` | ✅     |
| `DELETE /quizzes/:quizId/versions/:versionId` | version  | policy check on parent quiz creator                                                          | none                     | ✅     |

---

## Attempts / Reviews / Bookmarks

| Endpoint                                | Resource          | Owner check                                                                                | Body fields        | Status |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ | ------------------ | ------ |
| `POST /quizzes/:quizId/attempts`        | quiz              | none (any authenticated user may attempt)                                                  | none               | ✅     |
| `PATCH /attempts/:attemptId`            | attempt           | `attempt.userId = auth.user.sub` checked in repository                                     | `answers[]`        | ✅     |
| `POST /quizzes/:quizId/reviews`         | review            | visibility guard via `ReviewAuthorizationPolicy.isVisibleToReviewers`; must have completed attempt | none        | ✅     |
| `PATCH /quizzes/:quizId/reviews`        | review            | `ReviewService.assertCanModify` → `ReviewAuthorizationPolicy.canModify(actor, target)`       | none               | ✅     |
| `DELETE /quizzes/:quizId/reviews`       | review            | `ReviewService.assertCanModify` → `ReviewAuthorizationPolicy.canModify(actor, target)`       | none               | ✅     |
| `GET /quizzes/:quizId/reviews`          | review            | visibility guard via `isVisibleToReviewers` (public)                                       | none               | ✅     |
| `GET /quizzes/:quizId/reviews/stats`    | review aggregate  | visibility guard via `isVisibleToReviewers` (public)                                       | none               | ✅     |
| `GET /quizzes/:quizId/reviews/analytics`| quiz analytics    | `ReviewAuthorizationPolicy.canViewAnalytics` (creator or moderator)                         | none               | ✅     |
| `GET /reviews/:reviewId`                | review            | visibility guard via `assertQuizVisibleById` (authenticated)                               | none               | ✅     |
| `POST /reviews/:reviewId/helpful`       | reviewHelpfulVote | `ReviewService.assertCanVote` rejects self-vote; visibility guard on parent quiz            | `helpful`, `idempotencyKey` | ✅ |
| `DELETE /reviews/:reviewId/helpful`     | reviewHelpfulVote | `reviewExistsIncludingDeleted` then `removeHelpfulVote`                                    | none               | ✅     |
| `POST /reviews/:reviewId/report`        | reviewReport      | `ReviewAuthorizationPolicy.canReport` rejects self-report                                  | `reason`, `details`, `idempotencyKey` | ✅ |
| `GET /reviews/me`                       | dashboard         | none (returns caller's own data)                                                           | none               | ✅     |
| `GET /users/me/reviews`                 | review            | none (own user)                                                                            | none               | ✅     |
| `GET /users/me/reviews/:quizId`         | review            | none (own user)                                                                            | none               | ✅     |
| `GET /users/me/reported-reviews`        | reviewReport      | none (own user)                                                                            | `status`           | ✅     |
| `GET /users/:userId/reviews`            | review            | public read; visibility filter `quizzes.isHidden = false AND publishedVersionId IS NOT NULL` | none             | ✅     |
| `GET /admin/reviews/reports`            | reviewReport      | `@Permissions(Permission.REVIEW_MODERATE)`                                                 | `status`           | ✅     |
| `PATCH /admin/reviews/reports/:reportId`| reviewReport      | `@Permissions(Permission.REVIEW_MODERATE)` + state-machine guard in service                | `status`           | ✅     |
| `DELETE /admin/reviews/:reviewId`       | review            | `@Permissions(Permission.REVIEW_MODERATE)`; soft delete with audit log                     | none               | ✅     |
| `POST /quizzes/:quizId/bookmarks`       | bookmark          | `bookmark.userId = auth.user.sub` enforced by repository                                   | `collectionId`     | ✅     |
| `POST /bookmarks/collections`           | bookmark collection | `collection.userId = auth.user.sub` set on insert, no separate check needed               | none               | ✅     |
| `PATCH /bookmarks/collections/:id`      | bookmark collection | `BookmarkCommandService.updateCollection` → `getOwnedCollectionOrThrow(collectionId, user)` | `name`, `description` | ✅  |
| `DELETE /bookmarks/collections/:id`     | bookmark collection | `BookmarkCommandService.deleteCollection` → `getOwnedCollectionOrThrow(collectionId, user)` | none               | ✅     |
| `POST /bookmarks/collections/:id/quizzes` | bookmark         | `BookmarkCommandService.addBookmark` → `getOwnedCollectionOrThrow(collectionId, user)`     | `quizId`, `notes`  | ✅     |
| `POST /bookmarks/collections/:id/quizzes/bulk` | bookmark   | `BookmarkCommandService.addBookmarksBulk` → `getOwnedCollectionOrThrow(collectionId, user)` | `quizIds[]`        | ✅     |
| `DELETE /bookmarks/collections/:id/quizzes/bulk` | bookmark | `BookmarkCommandService.removeBookmarksBulk` → `getOwnedCollectionOrThrow(collectionId, user)` | `quizIds[]`    | ✅     |
| `PATCH /bookmarks/collections/:id/quizzes/:quizId` | bookmark | `BookmarkCommandService.updateBookmark` → `getOwnedCollectionOrThrow(collectionId, user)` | `notes`            | ✅     |
| `DELETE /bookmarks/collections/:id/quizzes/:quizId` | bookmark | `BookmarkCommandService.removeBookmark` → `getOwnedCollectionOrThrow(collectionId, user)` | none           | ✅     |
| `POST /bookmarks/collections/:id/move`  | bookmark          | `BookmarkCommandService.moveBookmark` → re-checks source **and** target ownership         | `quizId`, `targetCollectionId` | ✅ |

---

## Comments

The comment module exposes top-level comments + one-level replies on each quiz, plus
per-comment votes / reports / moderator hide / restore. Owner checks fall into two
buckets:

- **Self-or-moderator**: edit / delete / vote / report. Self checks reject self-vote
  and self-report; ownership is verified against the row's `authorId`.
- **Moderator-only**: hide / restore / review-report. Guarded by
  `@Permissions(Permission.COMMENT_MODERATE)` at the controller, with a second
  `CommentAuthorizationPolicy.assertCanModerate` belt-and-braces check in the
  service.

`POST /comments/:id/vote` reads the requesting viewer's JWT subject, never trusts
the request body for identity, and refuses any vote on one's own comment.

| Endpoint                                          | Resource       | Owner check                                                                                        | Body fields                | Status |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| `GET /comments/:commentId`                        | comment        | `CommentService.getComment` filters soft-deleted (`deletedAt IS NULL`)                            | none                       | ✅     |
| `PATCH /comments/:commentId`                      | comment        | `CommentService.editComment` → ownership + ownership-matched `expectedUpdatedAt` (optimistic lock) | `body`, `expectedUpdatedAt` | ✅    |
| `DELETE /comments/:commentId`                     | comment        | `CommentService.deleteComment` → `authorId = auth.user.sub` soft-delete; replies-count decrement in tx | none                  | ✅     |
| `PUT /comments/:commentId/vote`                   | commentVote    | `CommentService.vote` rejects self-vote; cached `userVote` projection reflects caller's vote      | `value`, `idempotencyKey`  | ✅     |
| `DELETE /comments/:commentId/vote`                | commentVote    | `CommentService.removeVote` is a no-op when no vote exists; never emits phantom events             | none                       | ✅     |
| `POST /comments/:commentId/reports`               | commentReport  | `CommentService.reportComment` rejects self-report; duplicate-key maps to `DuplicateReportError`   | `reason`, `details`, `idempotencyKey` | ✅ |
| `GET /comments/reports`                           | commentReport  | `@Permissions(Permission.COMMENT_MODERATE)`                                                       | `status`                   | ✅     |
| `POST /comments/reports/:reportId/review`         | commentReport  | `@Permissions(Permission.COMMENT_MODERATE)` + state-transition guard in service                   | `status`, `actionTaken`    | ✅     |
| `POST /comments/:commentId/hide`                  | comment        | `@Permissions(Permission.COMMENT_MODERATE)` + `CommentAuthorizationPolicy.assertCanModerate`      | none                       | ✅     |
| `POST /comments/:commentId/restore`               | comment        | `@Permissions(Permission.COMMENT_MODERATE)` + `CommentAuthorizationPolicy.assertCanModerate`      | none                       | ✅     |
| `POST /quizzes/:quizId/comments`                  | comment        | `quizExists` guard via `QuizExistencePort`; `parentCommentId` must belong to same quiz            | `body`, `parentCommentId`  | ✅     |
| `GET /quizzes/:quizId/comments`                   | comment        | public read; soft-deleted + hidden comments excluded                                              | none                       | ✅     |
| `GET /users/me/comments`                          | comment        | none (caller's own data)                                                                          | none                       | ✅     |
| `GET /users/:userId/comments`                     | comment        | public read of the target user's comment history                                                   | none                       | ✅     |

---

## Social

The social module handles friend requests, friendships, follows, blocks, and a social
activity feed. Authorization falls into three buckets:

- **Self-or-moderator**: edit/delete a friend request, unfollow, unblock, remove a friend.
  Ownership is verified against the row's owner columns (`requesterId`, `followerId`,
  `blockerId`).
- **Public read**: a user's friend list, followers/following, public stats, public activity
  timeline (subject to the target's `showActivity` privacy flag), search-suggestions,
  trending users.
- **Authenticated-only**: send/respond to friend requests, post a follow/block, read
  the authenticated user's own feed/analytics/relationship/leaderboard.

`GET /social/users/:userId/activity` honours the target user's `showActivity` flag and
returns 403 to a non-owner caller when the flag is `false`. Search results explicitly
exclude users that the caller has blocked and users that have blocked the caller.

The block + unblock write paths are wrapped in a single transaction together with the
audit-log entry to keep the `social.user.blocked` / `social.user.unblocked` events
atomic with the underlying row mutation.

| Endpoint                                            | Resource           | Owner check                                                                                | Body fields  | Status |
| --------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ | ------------ | ------ |
| `POST /social/friend-requests/:userId`              | friendRequest      | rejects self-request; pre-checks `isFriend` / `isBlocked` / `isBlockedBy` / `hasPendingRequest` | none         | ✅     |
| `GET /social/friend-requests/incoming`               | friendRequest      | none (caller's own data)                                                                   | none         | ✅     |
| `GET /social/friend-requests/outgoing`               | friendRequest      | none (caller's own data)                                                                   | none         | ✅     |
| `POST /social/friend-requests/:friendshipId/respond` | friendRequest      | `addresseeId = auth.user.sub` enforced in repository                                       | `accept`     | ✅     |
| `DELETE /social/friend-requests/:friendshipId`       | friendRequest      | `requesterId = auth.user.sub` enforced in repository                                       | none         | ✅     |
| `GET /social/friends/:userId`                        | friendship         | visibility guard via mutual-friend / non-blocked check                                     | `limit`, `cursor` | ✅ |
| `DELETE /social/friends/:userId`                     | friendship         | `findAcceptedFriendship` + row-count race guard                                            | none         | ✅     |
| `POST /social/follow/:userId`                        | follow             | rejects self-follow; pre-checks `isBlocked` / `isBlockedBy`; idempotent on conflict        | none         | ✅     |
| `DELETE /social/follow/:userId`                      | follow             | `findActiveFollow` + row-count race guard                                                  | none         | ✅     |
| `POST /social/block/:userId`                         | block              | rejects self-block; transactionally removes friendship and writes audit row                 | `reason`     | ✅     |
| `DELETE /social/block/:userId`                       | block              | `findActiveBlock` + row-count race guard; audit row written inside the same transaction     | none         | ✅     |
| `GET /social/blocked`                                | block              | none (caller's own data)                                                                   | none         | ✅     |
| `GET /social/feed`                                   | socialFeedActivity | none (caller's own data); blocked / blocking users excluded in SQL                        | `cursor`, `limit` | ✅ |
| `GET /social/suggestions`                            | socialSuggestion   | none (caller's own data); pending-request / friend / blocked users excluded in SQL         | `cursor`, `limit` | ✅ |
| `GET /social/users/search`                           | user search        | filters out users the caller blocked AND users that blocked the caller                     | `q`, `limit` | ✅     |
| `GET /social/search/suggestions`                     | username search    | none                                                                                       | `q`, `limit` | ✅     |
| `GET /social/users/trending`                         | trending           | none                                                                                       | `limit`      | ✅     |
| `GET /social/users/:userId/stats`                    | user stats         | none (public aggregate)                                                                    | none         | ✅     |
| `GET /social/users/:userId/activity`                 | public activity    | visibility guard via `showActivity` flag; non-owner gets 403 when the flag is `false`     | `cursor`, `limit` | ✅ |
| `GET /social/me/analytics`                           | my analytics       | none (caller's own data)                                                                   | none         | ✅     |
| `GET /social/friends/leaderboard`                    | friend leaderboard | none (caller's own data)                                                                   | `period`, `limit` | ✅ |
| `GET /social/counts`                                 | social counts      | none (caller's own data)                                                                   | none         | ✅     |
| `GET /social/users/:userId/followers`                | follow             | none (public aggregate)                                                                    | `cursor`, `limit` | ✅ |
| `GET /social/users/:userId/following`                | follow             | none (public aggregate)                                                                    | `cursor`, `limit` | ✅ |
| `GET /social/users/:userId/mutual-friends`           | friendship         | blocks both directions before computing the intersection                                   | `cursor`, `limit` | ✅ |
| `GET /social/users/:userId/mutual-followers`         | follow             | blocks both directions before computing the intersection                                   | `cursor`, `limit` | ✅ |
| `GET /social/relationship/:userId`                   | relationship       | none (caller's own data)                                                                   | none         | ✅     |

---

## Account & Auth

| Endpoint                            | Resource           | Owner check                                               | Body fields | Status |
| ----------------------------------- | ------------------ | --------------------------------------------------------- | ----------- | ------ |
| `POST /auth/register`               | (none)             | n/a                                                       | none        | ✅     |
| `POST /auth/change-password`        | session / password | `userId = auth.user.sub` + `currentSessionId` from cookie | none        | ✅     |
| `POST /auth/password-reset/request` | (none)             | n/a                                                       | none        | ✅     |
| `POST /auth/password-reset/confirm` | reset token        | hashed token validation + `pg_advisory_xact_lock`         | none        | ✅     |
| `DELETE /users/me`                  | account            | `userId = auth.user.sub`                                  | none        | ✅     |

---

## Ranking

The ranking module exposes public leaderboards, per-user rank views, and admin-only
recalculation / reset / consistency endpoints. All admin endpoints are gated by
`Permission.RANKING_ADMIN`, enforced by the global `PermissionsGuard`. Per-user rank
endpoints (`/leaderboard/me/*`) require the caller to be authenticated; public
endpoints (`/leaderboard`, `/leaderboard/:userId/rank`, `/leaderboard/:userId/history`)
allow anonymous reads so unauthenticated browsing of leaderboards still works.

| Endpoint                                  | Resource                          | AuthZ check                                  | Status |
| ----------------------------------------- | --------------------------------- | -------------------------------------------- | ------ |
| `GET /leaderboard`                        | `ranking.leaderboard`             | none (public)                                | ✅     |
| `GET /leaderboard/distribution`           | `ranking.distribution`            | none (public)                                | ✅     |
| `GET /leaderboard/me/rank`                | `ranking.user-rank`               | authenticated (`userId = auth.user.sub`)     | ✅     |
| `GET /leaderboard/:userId/rank`           | `ranking.user-rank`               | none (public)                                | ✅     |
| `GET /leaderboard/me/nearby`              | `ranking.user-rank`               | authenticated                                | ✅     |
| `GET /leaderboard/me/history`             | `ranking.history`                 | authenticated                                | ✅     |
| `GET /leaderboard/:userId/history`        | `ranking.history`                 | none (public)                                | ✅     |
| `GET /leaderboard/recent-winners`         | `ranking.recent-winners`          | none (public)                                | ✅     |
| `GET /leaderboard/top-movers`             | `ranking.top-movers`              | none (public)                                | ✅     |
| `GET /leaderboard/me/movement`            | `ranking.user-rank`               | authenticated                                | ✅     |
| `GET /leaderboard/me/percentile`          | `ranking.user-rank`               | authenticated                                | ✅     |
| `GET /leaderboard/me/peak-ranks`          | `ranking.peak-ranks`              | authenticated                                | ✅     |
| `GET /leaderboard/me/milestones`          | `ranking.milestones`              | authenticated                                | ✅     |
| `GET /admin/ranking/status`               | `ranking.admin.status`            | `RANKING_ADMIN`                              | ✅     |
| `POST /admin/ranking/recalculate`         | `ranking.admin.recalculate`       | `RANKING_ADMIN`                              | ✅     |
| `POST /admin/ranking/reset`               | `ranking.admin.reset`             | `RANKING_ADMIN`                              | ✅     |
| `POST /admin/ranking/consistency-check`   | `ranking.admin.consistency`       | `RANKING_ADMIN`                              | ✅     |

---

## Phase 0 #3 Audit Results

| Endpoint                 | Field reviewed                            | Verdict                                                            |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------ |
| `PATCH /users/me`        | `avatarPublicId`                          | ✅ Gate enforced in `UserApplicationService.updateProfile`         |
| `POST /quizzes`          | `imagePublicId`, `tagIds[]`, `categoryId` | ✅ Gate enforced in `QuizApplicationService.createQuiz`            |
| `PATCH /quizzes/:quizId` | `imagePublicId`, `tagIds[]`, `categoryId` | ✅ Gate enforced in `QuizApplicationService.updateQuiz`            |
| `POST /uploads/sign`     | (none — pre-upload signing)               | ✅ Ownership of _future_ asset established via `ownerId` parameter |

**No IDOR vulnerabilities were found.** Every endpoint that accepts a user-controlled resource identifier verifies ownership before the DB write.

---

## When Adding a New Endpoint

If you add a `POST` / `PATCH` / `DELETE` endpoint that:

- Accepts a `*PublicId` field in the body → **MUST** call `storageOwnership.userOwnsAssetForPurpose`.
- Targets a row owned by a user → **MUST** call the relevant `*Policy.assertCan*` method.
- Targets a row owned by an organization/team (future) → **MUST** add a new policy class.

Then add a row to the matrix above and a corresponding entry in the authz test matrix (`test/fixtures/authz-matrix.ts`).

---

## Related Documents

- `docs/audits/BACKEND_AUDIT_REPORT.md` §2 Storage & File Handling
- `src/core/storage/application/storage.application.service.ts` — `userOwnsAssetForPurpose` impl
- `src/modules/quiz/domain/quiz/quiz-command.service.ts` — `QuizPolicy.assertCan*` usages
