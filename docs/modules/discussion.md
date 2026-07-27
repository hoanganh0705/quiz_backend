# Discussion Module

> **Status (Phase 9.x):** This module owns the **per-quiz comment section**. It is intentionally narrow — exactly the surface area of the YouTube-style comments area below each quiz. Threads, subscriptions, bookmarks, solve marking, trending feeds, and saved-thread history have been removed; see [`docs/migrations/discussion-module-refactor.md`](../migrations/discussion-module-refactor.md) for the rationale.

## Purpose

Owns the **comment section attached to each quiz**: comments anchored to a quiz, replies (two-level hierarchy only), votes, content reporting, and moderator hide/restore. The comment section is **not** a standalone discussion platform.

## Responsibilities

**Owns**
- Comments anchored to a quiz
- Two-level reply hierarchy (comment → reply, no nesting beyond that)
- Upvote / downvote on comments
- Content reporting and moderator review pipeline
- Moderation audit log

**Does not own**
- The quizzes being commented on (Quiz module owns the FK)
- User profiles (User module)
- Notifications (Notification module consumes the comment event bus)
- The threads, subscriptions, bookmarks, trending, or solved-comment concepts that used to live here

## Core Concepts

| Concept | Description |
|---|---|
| **Comment** | A comment on a quiz, or a reply to a comment. `parentCommentId` distinguishes top-level comments from replies; replies-to-replies are forbidden. |
| **CommentVote** | A single (user, comment, value) row representing one vote. The repository enforces a unique-vote-per-user invariant. |
| **CommentReport** | A user report on a comment. `status ∈ {open, dismissed, actioned}`. One open report per (reporter, comment). |

There is no `DiscussionThread`, no `DiscussionSubscription`, no `SavedDiscussion`, no `TrendingDiscussion`, no `SolvedComment` anymore.

## Business Rules

- **Comment is always attached to a quiz**: a comment must reference an existing, non-deleted quiz.
- **Two-level hierarchy only**: the parent of a reply must be a top-level comment (`parentCommentId IS NULL`). Replying to a reply is rejected with `ParentCommentCrossThreadError`.
- **Reply cap**: a top-level comment may have at most `MAX_REPLIES_PER_COMMENT` replies (default `100`). The cap is enforced inside the same transaction that inserts the reply.
- **Edit window**: only the comment author may edit; the comment must not be hidden or deleted.
- **Soft delete**: only the author may soft-delete (`deletedAt` set); when the deleted comment is itself a reply, the parent's `repliesCount` is decremented atomically.
- **Vote ownership**: any authenticated user may vote on any non-self comment. Re-applying the same value toggles the vote off; applying the opposite value flips it.
- **Self-vote / self-report forbidden**: `SelfVoteError` / `SelfReportError`.
- **Duplicate report forbidden**: one open report per reporter per comment (`DuplicateReportError`).
- **Moderation**: only `DISCUSSION_MODERATE` holders may hide / restore comments and review reports. Authorization is enforced by `DiscussionAuthorizationPolicy` inside the domain service.
- **Hidden comments are still readable**: the comment row remains in the database and counts toward pagination, but is invisible to non-moderators at the transport layer.

## Relationships

```
Quiz
└── has many → Comments         (FK, cascade on quiz delete)

Comment
├── belongs to → Quiz           (FK, validated via QuizExistencePort)
├── belongs to → Author User    (FK, validated via UserExistencePort)
├── optionally belongs to → Parent Comment (self-FK, cascade on parent soft-delete)
├── has many → Votes            (one row per voter, unique constraint)
└── has many → Reports          (one row per reporter, unique on (reporter, comment))
```

## Lifecycle

```
Comment
├── Visible
│     ├── edit()            [author only, not deleted, not hidden]
│     └── delete()          [author only] → Soft-deleted (deletedAt)
├── Hidden                  [moderator hide] → not deletable by author
│     └── restore()         [moderator only] → Visible
└── Soft-deleted            → idempotent no-op for further delete calls
```

## Permissions

| Action | Requirement |
|---|---|
| Read a comment | Public |
| List comments on a quiz, list a user's comments | Public |
| Create a comment | Authenticated user |
| Edit / soft-delete own comment | Authenticated user (must be author) |
| Vote / remove vote | Authenticated user (not self) |
| Open a report | Authenticated user (not self, no existing open report) |
| Hide / restore a comment, list reports, review reports | `DISCUSSION_MODERATE` (Admin, Moderator) |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | `QuizExistencePort` is consumed before any comment is created. |
| **User** | `UserExistencePort` is consumed for `@username` mention resolution and author lookup. |
| **Notification** | `CommentDomainEventBus` is consumed by `CommentNotificationListener` to dispatch notifications (replies, mentions, moderator alerts on new reports). |
| **Social** | No direct feed integration — the comment surface is intentionally not a feed generator. |

The dependency graph is one-way: only `Notification` depends on `Discussion` (for the bus symbol and event types). `Discussion` depends on `Quiz` and `User` via their existence ports.

## Domain Events

All events are emitted via the in-process `CommentDomainEventBus` (Redis-backed retry / DLQ). No outbox or external event bus for the comment module — events are observable inside the same process lifetime.

| Event | When |
|---|---|
| `comment_created` | A new comment is committed. |
| `comment_edited` | An author edits their own comment. |
| `comment_deleted` | An author soft-deletes their own comment. |
| `comment_hidden` | A moderator hides a comment. |
| `comment_restored` | A moderator restores a hidden comment. |
| `comment_mentioned` | A comment body mentions `@username` for a known user (other than the author). |
| `vote_cast` | A user casts / flips / toggles a vote. |
| `vote_removed` | A user explicitly removes their vote. |
| `comment_reported` | A user opens a report on a comment. |
| `report_reviewed` | A moderator reviews an open report. |

`comment_created`, `comment_mentioned`, and `comment_reported` are observed by the Notification module. The remaining events are emitted for the audit log and for future consumers.

## Invariants

- Every comment references exactly one existing quiz.
- A reply's `quizId` equals its parent's `quizId` (cross-thread replies are rejected).
- A reply's parent is always a top-level comment (two-level rule).
- A `repliesCount` is always equal to the count of non-deleted children of the comment.
- A user has at most one vote per comment and at most one open report per comment.

## Endpoints

The full route map is documented in [`docs/standards/api-discussion.md`](../standards/api-discussion.md). Summary:

| Verb / Path | Module controller |
|---|---|
| `GET    /quizzes/:quizId/comments` | `QuizCommentController` |
| `POST   /quizzes/:quizId/comments` | `QuizCommentController` |
| `GET    /comments/:commentId` | `CommentController` |
| `PATCH  /comments/:commentId` | `CommentController` |
| `DELETE /comments/:commentId` | `CommentController` |
| `PUT    /comments/:commentId/vote` | `CommentController` |
| `DELETE /comments/:commentId/vote` | `CommentController` |
| `POST   /comments/:commentId/reports` | `CommentController` |
| `POST   /comments/:commentId/hide` | `CommentController` |
| `POST   /comments/:commentId/restore` | `CommentController` |
| `GET    /users/me/comments` | `UserCommentController` |
| `GET    /users/:userId/comments` | `UserCommentController` |
| `GET    /comments/reports` | `ReportController` |
| `PATCH  /comments/reports/:reportId` | `ReportController` |

## Implementation Notes

### Cursor pagination

All list endpoints use cursor pagination. The cursor encodes `{ createdAt: ISO-8601, id: UUIDv7 }` as a base64-JSON envelope (`@/common/utils/cursor.util`). The repository scans in `(createdAt DESC, id DESC)` order so paginating by `createdAt` alone is stable across inserts because UUIDv7 is time-ordered.

### Two-level rule

The "parent of a reply must be top-level" rule is checked by reading the parent row under `SELECT ... FOR UPDATE` inside the same transaction that inserts the reply. This prevents a race where the parent is concurrently deleted or hidden between the read and the write.

### Reply cap

The reply cap is enforced the same way: the cap check, the parent existence check, and the insert all happen inside a single transaction. A concurrent delete on the parent would also try to acquire the row lock, so exactly one wins.

### `Db` opaque type

The repository port exposes `Db` (an opaque handle for the Drizzle transaction). Application-layer code never imports `DrizzleDB`; the `Db` type is what crosses the layer boundary.

### Counter reconciliation

`CommentCounterReconcilerService` runs daily at 03:30 to recompute `discussion_comments.replies_count` from the underlying rows. Updates are idempotent (`IS DISTINCT FROM`), so a re-run is safe. The reconciler is the only scheduled job in the module.

### Moderation audit

`CommentModeratorAuditService` records moderator actions (`hide_comment`, `restore_comment`, `review_report`) through `AuditLogService`. Audit records are immutable; retention is governed by `AuditLogService`'s TTL.