# Discussion Module

## Purpose

Owns the **per-quiz Q&A and threaded discussion surface**: discussion threads anchored to a quiz, comments with a two-level reply hierarchy, votes, solve marking, moderation, and user subscriptions.

## Responsibilities

**Owns**
- Discussion threads anchored to a quiz
- Comments and two-level replies (comment → reply)
- Upvote/downvote on threads and comments
- Solve marking (thread author nominates a reply as the accepted answer)
- Thread subscriptions (notify on new comment)
- Thread saving (personal bookmark)
- Content reporting and moderator review pipeline
- Moderation audit log (365-day retention)
- Trending, unanswered, and search feeds

**Does not own**
- The quizzes being discussed (Quiz module owns the FK)
- User profiles (User module)
- Notifications (Notification module — discussion events are consumed there)
- Social feeds (Social module — discussion events are consumed there)

## Core Concepts

| Concept | Description |
|---|---|
| **DiscussionThread** | A Q&A thread anchored to a quiz: `title`, `body`, `authorId`, `quizId`, `status ∈ {open, closed, hidden, deleted}`, `solvedCommentId`. |
| **DiscussionComment** | A comment on a thread or a reply to a comment. Two-level hierarchy via `parentCommentId`. `contentStatus ∈ {visible, hidden, deleted}`. |
| **DiscussionVote** | A vote (up/down) on a thread or comment. Polymorphic via `targetId` + `targetType`. |
| **DiscussionReport** | A user report on a thread or comment. `status ∈ {open, reviewed, dismissed, actioned}`. |
| **DiscussionThreadSubscription** | A user's subscription to a thread (notify on new comment). |
| **DiscussionSavedThread** | A user's saved/bookmark of a thread. |

## Business Rules

- **Thread always attached to a quiz**: a thread must reference an existing, non-deleted quiz.
- **Thread edit window**: only the author may edit their thread; thread must not be `deleted`.
- **Thread delete**: only the author may soft-delete; cascades soft-delete to all comments.
- **Thread status transitions**: `open` → `closed` (author) → `open` (author); any non-deleted → `hidden` (moderator) → `open` (moderator restore).
- **Comment creation**: only on `open` threads; only on `visible` threads for subscription/save.
- **Comment reply depth**: two-level only (comment or reply as parent). Max 100 replies per parent comment.
- **Comment ownership**: only the author may delete their comment.
- **Moderation**: only `DISCUSSION_MODERATE` holders may hide/restore threads and comments, review reports, and list reports.
- **Self-vote and self-report prohibited**: a user cannot vote on or report their own content.
- **Duplicate report prohibited**: one open report per user per target.
- **Solve marking**: only the thread author; the nominated comment must belong to the same thread; `solvedCommentId` is `ON DELETE SET NULL`.
- **Cascade deletes**: deleting a thread cascades to comments (soft-delete); deleting a user cascades to their threads and comments.

## Relationships

```
DiscussionThread
├── belongs to → Quiz (FK, cascade)
├── belongs to → Author User (FK, cascade)
├── has many → Comments (DiscussionComment, cascade)
├── has many → Votes (DiscussionVote, cascade)
├── has many → Reports (DiscussionReport, cascade)
├── has many → Subscriptions (DiscussionThreadSubscription, cascade)
├── has many → Saved threads (DiscussionSavedThread, cascade)
└── optionally points to → SolvedComment (DiscussionComment, ON DELETE SET NULL)

DiscussionComment
├── belongs to → Thread (FK, cascade)
├── belongs to → Author User (FK, cascade)
├── optionally belongs to → Parent Comment (self-referential FK, cascade)
└── has many → Votes (DiscussionVote, cascade)
```

## Lifecycle

### DiscussionThread

```
Open (status = open) — accepts comments and votes
    ↓ closeThread() [author]
Closed (status = closed) — no new comments
    ↓ reopenThread() [author]
Open
    ↓ hideThread() [moderator]
Hidden (status = hidden) — invisible to non-author/non-mod
    ↓ restoreThread() [moderator]
Open
    ↓ deleteThread() [author only]
Deleted (status = deleted, deletedAt = now) — soft-deleted; no mutations allowed
```

### DiscussionComment

```
Visible (contentStatus = visible)
    ↓ hideComment() [moderator]
Hidden (contentStatus = hidden) — visible to moderators only
    ↓ restoreComment() [moderator]
Visible
    ↓ deleteComment() [author only]
Deleted (contentStatus = deleted, deletedAt = now)
```

### DiscussionReport

```
Open (status = open)
    ↓ reviewReport() [moderator]
Reviewed | Dismissed | Actioned
```

## Permissions

| Action | Requirement |
|---|---|
| Create thread, comment, vote, report, subscribe, save, solve, close/reopen | Authenticated user |
| Hide/restore thread or comment, review reports | `DISCUSSION_MODERATE` (Admin, Moderator) |
| List reports | `DISCUSSION_MODERATE` |
| Browse trending, unanswered, search, quiz discussions | Public |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Validates quiz existence via `QuizExistencePort` before thread creation. |
| **User** | Validates user existence via `UserExistencePort` for profiles and `@username` mention resolution. |
| **Notification** | All domain events are consumed by `DiscussionNotificationListener` (Notification module) to dispatch in-app, WebSocket, email, or push notifications. |
| **Social** | All domain events are consumed by `DiscussionFeedListenerAdapter` (Social module) to record social feed activities. |

## Invariants

- A thread always belongs to exactly one existing quiz.
- A comment always belongs to exactly one thread.
- A reply always belongs to exactly one parent comment; the parent belongs to the same thread as the reply.
- Exactly one correct answer per solved thread.
- No user may vote on or report their own content.
- No two open reports from the same user on the same target.
- Moderation actions are never deleted; they are immutable with 365-day retention.

## Future Extension Points

- **Rich text / markdown**: comment bodies are plain text today.
- **Upvote-only or combined score**: votes are stored as distinct up/down records; net score is computed in queries.
- **Thread pinning**: not yet modeled.
- **Moderation appeals**: not yet modeled.