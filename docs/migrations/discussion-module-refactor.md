# Discussion Module — Architecture

> The discussion module is the **comment section** attached to a quiz. It is anchored to a quiz the way YouTube comments are anchored to a video: the comments exist in the context of one quiz, they have at most two levels (top-level comment and reply), they accept votes and reports, and they are moderated at the comment level.
>
> This document is the single source of truth for the module's architecture. It is written from the current product requirements without reference to earlier proposals. The implementation plan in §9 is additive; every phase produces a working, deployable system.

---

## 1. Product

### 1.1 What the module does

A user opens a quiz and reads the comments that other users have left. A user can write a top-level comment, reply to a comment (one level deep), edit their own comment, vote on comments, and report comments they consider inappropriate. A moderator can hide a comment and restore a hidden comment. Mentions of the form `@username` in a comment body notify the mentioned user.

The module does not own quizzes, users, notifications, or social feeds. It publishes events that other modules consume; it does not call into them.

### 1.2 What the module does not do

These are explicitly out of scope. They are listed so that a future reader can recognize when a proposed change is product-shaped rather than architecture-shaped.

- A separate "discussion" wrapper around the comments. There is no `DiscussionThread`. The comments are anchored directly to the quiz.
- Subscribe / bookmark / save on a comment or on the comment section. Bookmarks live in the Bookmark module (quiz-level). Notifications on new comments are not modeled.
- A global feed of comments across quizzes. Comments live under a quiz.
- A user-wide history of comments authored. That belongs to the User / Profile module if it is needed.
- Solve / accept / unanswered. There is no Q&A workflow.
- Public / private / closed states at the comment-section level. The quiz has its own visibility; the comment section inherits it.
- Edit by moderator. Moderator action is hide / restore only.
- Thread-level hide / restore. Moderation is on the comment.

### 1.3 Capabilities

| Capability | Owner | Notes |
|---|---|---|
| Top-level comment on a quiz | Author | Authenticated user. |
| Reply to a comment | Author | One level deep. |
| Edit own comment | Author | Body only. |
| Delete own comment | Author | Soft delete. |
| Vote on a comment | Authenticated user | Up or down. |
| Report a comment | Authenticated user | One open report per user per comment. |
| Hide / restore a comment | Moderator | `DISCUSSION_MODERATE`. |
| Mention `@username` | Composer | Resolved at create time; emits `comment_mentioned`. |

The module also exposes read paths for the question-collection-model (list comments under a quiz, fetch a single comment). These are public.

### 1.4 Module identity

The module is identified as `DiscussionModule` in NestJS, exported as `src/modules/discussion/`. It is a bounded context. The schema lives under `src/core/database/schema/discussion/`. Discussion events are emitted on `DiscussionDomainEventBus`, which is registered globally and consumed by the Notification and Social modules.

---

## 2. Bounded context

The discussion module owns:

- **Comments** — every comment on every quiz.
- **Votes** — every vote on a comment.
- **Reports** — every report on a comment.

It does not own:

- Quizzes (Quiz module).
- Users (User module).
- Notifications (Notification module — consumes events).
- Social feeds (Social module — consumes events).
- Bookmarks (Bookmark module — quiz-level bookmarks).

Cross-module communication is exactly two patterns from the project constitution:

1. **Symbol-typed ports** for synchronous existence checks (the only such check is `QuizExistencePort` to assert the quiz exists before a comment is created).
2. **In-process `DomainEventBus`** for side effects that the comment module triggers but does not own (notification fan-out, social feed activity).

There is no cross-module direct call. There is no cross-module database FK to user / quiz columns beyond the read-only `quizId` the comment carries.

---

## 3. Domain model

### 3.1 Aggregates

There is one aggregate: `Comment`. The aggregate root is the comment itself. A reply is a comment whose `parentCommentId` is set. The two-level hierarchy is enforced by invariant, not by a separate aggregate.

```text
Comment
├── id              : UUIDv7
├── quizId          : UUIDv7 (FK to quiz; existence checked at create time)
├── authorId        : UUIDv7 (FK to user; not validated at create time)
├── parentCommentId : UUIDv7 | null  (when set, must point to a comment on the same quiz)
├── body            : string
├── isHidden        : boolean   (moderator hide)
├── hiddenById      : UUIDv7 | null  (moderator)
├── hiddenAt        : ISO timestamp | null
├── votesCount, upvotesCount, downvotesCount : integer (denormalized)
├── repliesCount    : integer (denormalized; count of direct children)
├── createdAt, updatedAt, deletedAt : ISO timestamp
```

The `isHidden` flag is the only moderation state. It is a boolean, not an enum. The reason is that there are exactly two moderation states: visible (default) and hidden. `deletedAt` is the author-side soft-delete mark. The two are independent: a comment can be `deleted` by its author and not `hidden` by a moderator; the inverse is also possible.

`parentCommentId` is the only structural link within the aggregate. A reply is a comment whose `parentCommentId` is set and whose grandparent is, by construction, `null` (top-level comments have no parent; replies have exactly one parent, which is a top-level comment).

### 3.2 Value objects

These are pure data shapes that the application layer constructs.

```ts
AuthorView {
  userId     : UUIDv7
  username   : string
  displayName: string | null
  avatarUrl  : string | null
}

CommentView {
  id              : UUIDv7
  quizId          : UUIDv7
  authorId        : UUIDv7
  author          : AuthorView
  parentCommentId : UUIDv7 | null
  body            : string
  isHidden        : boolean
  hiddenById      : UUIDv7 | null
  hiddenAt        : ISO | null
  votesCount      : number
  upvotesCount    : number
  downvotesCount  : number
  repliesCount    : number
  createdAt       : ISO
  updatedAt       : ISO
  deletedAt       : ISO | null
}

CommentWithRepliesView extends CommentView {
  replies  : CommentView[]
  userVote : 'upvote' | 'downvote' | null
}

VoteValue         : 'upvote' | 'downvote'
ReportStatus      : 'open' | 'reviewed' | 'dismissed' | 'actioned'
```

### 3.3 Commands

```ts
CreateComment(params: { quizId, authorId, parentCommentId | null, body }) : CommentView
EditComment  (params: { commentId, authorId, body })                    : CommentView
DeleteComment(params: { commentId, authorId })                           : void
Vote         (params: { commentId, userId, value })                      : void
RemoveVote   (params: { commentId, userId })                             : void
ReportComment(params: { commentId, reporterId, reason, details | null }) : void
ReviewReport (params: { reportId, reviewerId, status, actionTaken })    : void
HideComment  (params: { commentId, moderatorId })                        : void
RestoreComment(params: { commentId, moderatorId })                       : void
```

### 3.4 Queries

```ts
ListQuizComments(params: { quizId, limit, cursor })   : { items: CommentWithRepliesView[], ... }
GetComment      (params: { commentId, viewerId })     : CommentView | null
ListMyComments  (params: { userId, limit, cursor })   : { items: MyCommentView[], ... }
ListReports     (params: { status, limit, cursor })   : { items: ReportView[], ... }
```

`ListQuizComments` returns a flat page of top-level comments plus, for each, a `replies` array of the first N replies. The endpoint is public; `userVote` is filled for the requester when authenticated.

`ListMyComments` is the only user-history endpoint. It returns comments authored by the authenticated user, newest first. A public version of the same shape is exposed at `/users/:userId/comments` and resolves against the same query.

### 3.5 Domain rules

| Rule | Where it lives |
|---|---|
| A comment's `quizId` must reference an existing, non-deleted quiz. | `CreateComment` in the domain service. |
| A reply's `parentCommentId` must reference a comment on the same quiz, with `parentCommentId === null`, and `isHidden === false`. | `CreateComment` in the domain service. |
| A reply cannot itself have replies. Replies have a flat list of direct children but no grand-children. The 100-replies-per-parent cap is enforced here. | `CreateComment` in the domain service. |
| `body` must be non-empty after trim. Length capped at the constant in `discussion.constants.ts`. | `CreateComment`, `EditComment`; mirrored in the DTO via `class-validator`. |
| An author can edit / delete only their own comments. | `EditComment`, `DeleteComment`. |
| Moderator hide / restore requires `DISCUSSION_MODERATE`. | `HideComment`, `RestoreComment`. |
| A user cannot vote on their own comment. | `Vote`. |
| A user cannot report their own comment. | `ReportComment`. |
| A user cannot have two open reports on the same comment. | `ReportComment` (enforced by the unique index on `(reporterId, commentId) WHERE status = 'open'`). |
| A comment can be deleted by its author at most once. Repeated calls are no-ops. | `DeleteComment` (idempotency guard). |
| A comment can be hidden by a moderator at most once. Repeated calls are no-ops. | `HideComment` (idempotency guard). |

### 3.6 Domain exceptions

Every exception extends `BaseDomainException` (`src/common/errors/base-domain.exception.ts`) and carries a stable `code`. A new exception requires a new entry in `ProblemCodeMapping` in the same commit.

| Code | HTTP | When |
|---|---|---|
| `DISCUSSION_COMMENT_NOT_FOUND` | 404 | The comment id does not exist or is soft-deleted. |
| `DISCUSSION_COMMENT_FORBIDDEN` | 403 | The actor is not the author and not a moderator. |
| `DISCUSSION_QUIZ_NOT_FOUND` | 404 | The quiz does not exist. |
| `DISCUSSION_PARENT_COMMENT_NOT_FOUND` | 404 | The reply's parent comment does not exist (or is hidden). |
| `DISCUSSION_PARENT_COMMENT_CROSS_THREAD` | 400 | The parent comment is on a different quiz. |
| `DISCUSSION_REPLY_LIMIT_EXCEEDED` | 409 | The parent already has 100 replies. |
| `DISCUSSION_SELF_VOTE` | 403 | The voter is the author. |
| `DISCUSSION_SELF_REPORT` | 403 | The reporter is the author. |
| `DISCUSSION_DUPLICATE_REPORT` | 409 | The reporter already has an open report on this comment. |
| `DISCUSSION_REPORT_NOT_FOUND` | 404 | The report id does not exist. |
| `DISCUSSION_MODERATOR_REQUIRED` | 403 | The actor lacks `DISCUSSION_MODERATE`. |

The set is intentionally narrow. There is no `ClosedThreadError` because there is no thread. There is no `ThreadNotFoundError` because there is no thread. There is no `UnsolveError` because there is no solved state.

### 3.7 Idempotency

- `DeleteComment` is idempotent: a second call on an already-deleted comment is a no-op (returns success without re-emitting the event).
- `HideComment` is idempotent: a second call on an already-hidden comment is a no-op.
- `RestoreComment` is idempotent: a second call on a visible comment is a no-op.
- `Vote` and `RemoveVote` are not idempotent at the application level: a re-vote toggles (same value → remove; different value → flip). The 24-hour replay window is enforced by the rate limiter (`@Throttle`).
- `ReportComment` is guarded by the unique index on `(reporterId, commentId) WHERE status = 'open'`. A second open report raises `DISCUSSION_DUPLICATE_REPORT`.

---

## 4. Persistence

### 4.1 Tables

The module owns three tables.

```text
discussion_comments
  id               UUIDv7  PK
  quiz_id          UUIDv7  not null
  author_id        UUIDv7  not null
  parent_comment_id UUIDv7 null
  body             text    not null
  is_hidden        bool    not null default false
  hidden_by_id     UUIDv7  null
  hidden_at        timestamptz null
  votes_count      int     not null default 0
  upvotes_count    int     not null default 0
  downvotes_count  int     not null default 0
  replies_count    int     not null default 0
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()
  deleted_at       timestamptz null

discussion_comment_votes
  vote_id          UUIDv7  PK
  user_id          UUIDv7  not null
  comment_id       UUIDv7  not null
  value            enum('upvote', 'downvote') not null
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()

discussion_comment_reports
  report_id          UUIDv7  PK
  reporter_id        UUIDv7  not null
  comment_id         UUIDv7  not null
  reason             text    not null
  details            text    null
  status             enum('open', 'reviewed', 'dismissed', 'actioned') not null default 'open'
  reviewed_by_user_id UUIDv7 null
  reviewed_at        timestamptz null
  action_taken       bool    not null default false
  created_at         timestamptz not null default now()
  updated_at         timestamptz not null default now()
```

There is no `discussion_threads` table. There is no `discussion_thread_subscriptions` table. There is no `discussion_saved_threads` table. There is no `discussion_comment_status` enum; the moderation state is `is_hidden` boolean. There is no `discussion_target_type` enum; votes and reports reference `comment_id` directly.

### 4.2 Foreign keys

| Column | References | On delete |
|---|---|---|
| `discussion_comments.quiz_id` | `quizzes.quiz_id` | (no FK — existence is checked at create time by `QuizExistencePort`, not by a DB constraint) |
| `discussion_comments.author_id` | `users.user_id` | (no FK — author is resolved at read time) |
| `discussion_comments.parent_comment_id` | `discussion_comments.id` | `cascade` |
| `discussion_comment_votes.user_id` | `users.user_id` | (no FK) |
| `discussion_comment_votes.comment_id` | `discussion_comments.id` | `cascade` |
| `discussion_comment_reports.reporter_id` | `users.user_id` | (no FK) |
| `discussion_comment_reports.comment_id` | `discussion_comments.id` | `cascade` |
| `discussion_comment_reports.reviewed_by_user_id` | `users.user_id` | (no FK) |

The decision to omit FKs to `users` and `quizzes` follows the project's existing pattern: cross-domain FKs are resolved through application-layer ports, not DB constraints. The intra-table `parent_comment_id` and FK to `discussion_comments` from the dependent tables are kept because they are within the bounded context.

### 4.3 Indexes

```text
discussion_comments:
  (quiz_id, created_at desc) where deleted_at is null
  (author_id, created_at desc) where deleted_at is null
  (parent_comment_id, created_at asc) where deleted_at is null
  (quiz_id, parent_comment_id, created_at asc) where deleted_at is null   -- two-level index
  check (length(btrim(body)) > 0)

discussion_comment_votes:
  unique (user_id, comment_id)
  (comment_id)

discussion_comment_reports:
  (status, created_at desc)
  (comment_id)
  unique (reporter_id, comment_id) where status = 'open'
  check (length(btrim(reason)) > 0)
```

The two-level index `(quiz_id, parent_comment_id, created_at)` is the working index for `ListQuizComments`. The unique index on `(user_id, comment_id)` is the working index for vote upsert. The unique partial index on reports is the working index for the duplicate-report guard.

### 4.4 Counters

`votes_count`, `upvotes_count`, `downvotes_count`, `replies_count` are denormalized. They are mutated in the same transaction as the cause-of-change row. A nightly reconciler (`@Cron('30 3 * * *')`) re-derives them from the source-of-truth rows.

The counter logic lives in the domain service. The repository exposes primitive counter increments (`incrementCommentVoteCount(commentId, deltaUp, deltaDown, tx)`) which the domain service calls inside its own transactional scope. The reconciler is the only path that recomputes from scratch.

### 4.5 Soft delete

`discussion_comments.deleted_at` distinguishes "deleted by author" from "hidden by moderator". The two are independent: a comment can be `deleted_at is null` and `is_hidden = true` (visible only to moderators), or `deleted_at is not null` and `is_hidden = false` (a tombstone visible to nobody). All read paths filter `deleted_at is null` unless the caller is the author or a moderator.

### 4.6 Migration

All schema changes are generated by `pnpm db:generate`. The migration is a single file (one `drizzle-kit` generation) that:

1. Creates `discussion_comments`, `discussion_comment_votes`, `discussion_comment_reports`.
2. Creates the indexes and checks.
3. Creates the foreign keys to other discussion tables.

If a pre-existing `discussion_threads` table is present in the deployment (the prior product), the migration is paired with a one-time archival step in the same migration run: `INSERT INTO ... SELECT ... FROM discussion_threads` — see the implementation plan in §9. The archival strategy is described in §6.

---

## 5. REST API

All endpoints are under the global prefix `api/v1`. The convention is `/api/v1/quizzes/:quizId/comments` for the comment surface (the comment section is anchored to a quiz) and `/api/v1/comments/:commentId` for cross-resource operations (vote, report, hide, restore).

### 5.1 Public read endpoints

```text
GET    /api/v1/quizzes/:quizId/comments
       List comments under a quiz. Cursor pagination. Returns the page of
       top-level comments plus, for each, the first 100 replies.

GET    /api/v1/comments/:commentId
       Fetch a single comment by id. Returns null when not found; the
       controller maps to 404 via COMMENT_NOT_FOUND.
```

The `?limit=` parameter defaults to 20 and is capped at 100. The `?cursor=` parameter is the base64-encoded cursor from the previous page's `meta.pagination.nextCursor`.

`GET /quizzes/:quizId/comments` is the canonical read path. The response shape is `{ data: [CommentWithRepliesDto, ...], meta: { timestamp, pagination } }`.

### 5.2 Authenticated write endpoints

```text
POST   /api/v1/quizzes/:quizId/comments
       Body: { body: string, parentCommentId?: UUIDv7 }
       Create a top-level comment or a reply. The parent, if present, must
       belong to the same quiz and must be a top-level comment.

PATCH  /api/v1/comments/:commentId
       Body: { body: string }
       Edit own comment. Author-only.

DELETE /api/v1/comments/:commentId
       Soft-delete own comment. Author-only. Idempotent.

PUT    /api/v1/comments/:commentId/vote
       Body: { value: 'upvote' | 'downvote' }
       Cast or flip a vote. Same value re-applied removes the vote.
       Self-vote forbidden.

DELETE /api/v1/comments/:commentId/vote
       Remove the caller's vote. No-op when none exists.

POST   /api/v1/comments/:commentId/reports
       Body: { reason: string, details?: string }
       Open a report on a comment. Self-report forbidden. Duplicate open
       reports raise 409.
```

The vote endpoint is `PUT` (not `POST`) because the vote is a resource identified by `(userId, commentId)`. Idempotency follows from the unique index; the same `PUT` always converges to the same state.

### 5.3 Moderator endpoints

```text
POST   /api/v1/comments/:commentId/hide
       Hide a comment. Requires DISCUSSION_MODERATE. Idempotent.

POST   /api/v1/comments/:commentId/restore
       Restore a hidden comment. Requires DISCUSSION_MODERATE. Idempotent.

GET    /api/v1/comments/reports
       List reports. Requires DISCUSSION_MODERATE. Cursor pagination.
       Optional ?status=open|reviewed|dismissed|actioned.

POST   /api/v1/comments/reports/:reportId/review
       Body: { status: 'reviewed' | 'dismissed' | 'actioned', actionTaken?: boolean }
       Close a report. Requires DISCUSSION_MODERATE.
```

The `?status=` filter on the report list mirrors the report state machine. The `actionTaken` flag is informational — it tells the audit log whether the moderator hid the offending content as part of the review.

### 5.4 User-history endpoints

```text
GET    /api/v1/users/me/comments
       List comments authored by the authenticated user. Cursor pagination.

GET    /api/v1/users/:userId/comments
       Same shape, public. The caller is anyone; the result is the public
       comment history of the target user.
```

These are the only user-history endpoints. There is no `users/me/upvoted-comments`, no `users/me/discussion-subscriptions`, no `users/me/saved-threads`. The reasons are listed in §1.2.

### 5.5 Endpoint map

| Endpoint | Auth | Throttle | Schema |
|---|---|---|---|
| `GET /quizzes/:quizId/comments` | Public | none | `CommentWithRepliesDto[]` |
| `GET /comments/:commentId` | Public | none | `CommentDto` |
| `POST /quizzes/:quizId/comments` | Auth | 20/min | `CommentDto` |
| `PATCH /comments/:commentId` | Auth | 20/min | `CommentDto` |
| `DELETE /comments/:commentId` | Auth | 30/min | 204 |
| `PUT /comments/:commentId/vote` | Auth | 20/min | 204 |
| `DELETE /comments/:commentId/vote` | Auth | 20/min | 204 |
| `POST /comments/:commentId/reports` | Auth | 5/min | 204 |
| `POST /comments/:commentId/hide` | Mod | 30/min | 204 |
| `POST /comments/:commentId/restore` | Mod | 30/min | 204 |
| `GET /comments/reports` | Mod | none | `ReportDto[]` |
| `POST /comments/reports/:reportId/review` | Mod | 20/min | 204 |
| `GET /users/me/comments` | Auth | none | `CommentDto[]` |
| `GET /users/:userId/comments` | Public | none | `CommentDto[]` |

Total: 14 endpoints. Of these, 4 are public, 6 are authenticated, 4 are moderator-only.

### 5.6 Response DTOs

```text
CommentDto
  id              UUIDv7
  quizId          UUIDv7
  authorId        UUIDv7
  author          AuthorDto
  parentCommentId UUIDv7 | null
  body            string
  isHidden        boolean
  hiddenById      UUIDv7 | null
  hiddenAt        ISO | null
  votesCount, upvotesCount, downvotesCount: number
  repliesCount    number
  createdAt, updatedAt: ISO
  deletedAt       ISO | null

CommentWithRepliesDto extends CommentDto
  replies  CommentDto[]
  userVote 'upvote' | 'downvote' | null

AuthorDto
  userId      UUIDv7
  username    string
  displayName string | null
  avatarUrl   string | null

ReportDto
  reportId          UUIDv7
  reporterId        UUIDv7
  commentId         UUIDv7
  reason            string
  details           string | null
  status            'open' | 'reviewed' | 'dismissed' | 'actioned'
  reviewedByUserId  UUIDv7 | null
  reviewedAt        ISO | null
  actionTaken       boolean
  createdAt, updatedAt: ISO
```

The DTOs use the `id` field name (not `commentId`) because the resource is unambiguously a comment. The `quizId` field is included on every `CommentDto` because the comment section is per-quiz, and the client needs it to fetch replies or vote.

### 5.7 Pagination

The cursor is a base64-encoded JSON of `{ createdAt: ISO, id: UUIDv7 }`. The same cursor shape is used for `ListQuizComments`, `ListMyComments`, and `ListReports`. The cursor is opaque to the client.

The `meta.pagination.kind` discriminator is `'cursor'`. The `meta.pagination.nextCursor` is `null` when the page is the last one.

---

## 6. Domain events

The module emits events on `DiscussionDomainEventBus`. The bus is in-process. Producers do not depend on the consumer surface.

```text
CommentCreatedEvent
  eventType              'comment_created'
  commentId              UUIDv7
  quizId                 UUIDv7
  parentCommentId        UUIDv7 | null
  authorId               UUIDv7
  authorUsername         string
  parentCommentAuthorId  UUIDv7 | null
  isReply                boolean
  timestamp              Date

CommentEditedEvent
  eventType              'comment_edited'
  commentId              UUIDv7
  quizId                 UUIDv7
  authorId               UUIDv7
  timestamp              Date

CommentDeletedEvent
  eventType              'comment_deleted'
  commentId              UUIDv7
  quizId                 UUIDv7
  authorId               UUIDv7
  timestamp              Date

CommentHiddenEvent
  eventType              'comment_hidden'
  commentId              UUIDv7
  quizId                 UUIDv7
  moderatorId            UUIDv7
  timestamp              Date

CommentRestoredEvent
  eventType              'comment_restored'
  commentId              UUIDv7
  quizId                 UUIDv7
  moderatorId            UUIDv7
  timestamp              Date

CommentMentionedEvent
  eventType              'comment_mentioned'
  commentId              UUIDv7
  quizId                 UUIDv7
  mentionedUserId        UUIDv7
  mentionedUsername      string
  authorId               UUIDv7
  authorUsername         string
  timestamp              Date

VoteCastEvent
  eventType              'vote_cast'
  commentId              UUIDv7
  voterId                UUIDv7
  value                  'upvote' | 'downvote'
  timestamp              Date

VoteRemovedEvent
  eventType              'vote_removed'
  commentId              UUIDv7
  voterId                UUIDv7
  timestamp              Date

CommentReportedEvent
  eventType              'comment_reported'
  reportId               UUIDv7
  commentId              UUIDv7
  reporterId             UUIDv7
  reason                 string
  timestamp              Date

ReportReviewedEvent
  eventType              'report_reviewed'
  reportId               UUIDv7
  reviewerId             UUIDv7
  status                 'reviewed' | 'dismissed' | 'actioned'
  actionTaken            boolean
  timestamp              Date
```

The set is the full set of side effects that the module can produce. There is no `DiscussionThreadCreatedEvent` (there is no thread). There is no `thread_solved` event (there is no solved state). There is no `thread_closed` event (there is no closed state). There is no `comment_mentioned` event when the mentioned user is the author (the author does not receive their own mention).

### 6.1 Producers

The domain service is the sole producer. The application service never emits events directly. The event is emitted after the persistent commit succeeds, never inside the transaction.

### 6.2 Consumers

The Notification module consumes `CommentCreatedEvent` (notifies the parent-comment author of a reply), `CommentMentionedEvent` (notifies the mentioned user), and `CommentReportedEvent` (queues a moderator notification). The Social module consumes `CommentCreatedEvent` (records a `comment_created` activity in the social feed) and `CommentHiddenEvent` (invalidates cached feed entries).

### 6.3 Bus contract

The bus signature is the project's `DomainEventBus` pattern (`src/modules/discussion/domain/events/discussion-event-bus.port.ts`):

```ts
subscribe(handler: (event: DiscussionEvent) => void): () => void

emitCommentCreated(event: CommentCreatedEvent): void
emitCommentEdited(event: CommentEditedEvent): void
emitCommentDeleted(event: CommentDeletedEvent): void
emitCommentHidden(event: CommentHiddenEvent): void
emitCommentRestored(event: CommentRestoredEvent): void
emitCommentMentioned(event: CommentMentionedEvent): void
emitVoteCast(event: VoteCastEvent): void
emitVoteRemoved(event: VoteRemovedEvent): void
emitCommentReported(event: CommentReportedEvent): void
emitReportReviewed(event: ReportReviewedEvent): void
```

Retry semantics: per-handler exponential backoff (5/10/20/40/80s), dead-letter to Redis after five attempts. The bus is the same shape as the existing `TagDomainEventBus`.

---

## 7. Cross-module impact

### 7.1 Quiz module

- **Effect**: none at the database level. The Quiz module does not own the comment tables. The committee is to be consulted only on existence (the `QuizExistencePort`).
- **Surface**: `QuizExistencePort.exists(quizId): Promise<boolean>` is unchanged in shape. The discussion module continues to bind it in `discussion.module.ts` via `{ provide: QUIZ_EXISTENCE_PORT, useExisting: QuizApplicationService }` (or the existing `QuizExistenceAdapter` — whichever is the current pattern).

### 7.2 User module

- **Effect**: the existing `UserExistencePort.findByUsernames` is reused for `@username` mention resolution. The `exists(userId)` check is not needed for the comment module — the comment does not validate the author's existence at create time (the author is the JWT subject).
- **Surface**: `UserExistencePort.findByUsernames(usernames: string[]): Promise<UserPublicInfo[]>` is unchanged. The `exists` method may be retained on the port for other modules; the discussion module simply does not call it.

### 7.3 Notification module

- **Effect**: `DiscussionNotificationListener` is rewired to consume the new event names. The old `discussion_thread_*` and `comment_created` (with `threadId`) handlers are removed. The new handlers are wired against `CommentCreatedEvent`, `CommentMentionedEvent`, `CommentReportedEvent`.
- **Surface**: the module's `Notification` payload schemas gain `commentMentioned` (replacing `discussionReply` and `discussionMention`) if they were distinguished before. The change is additive when possible, deprecation-tagged when not.

### 7.4 Social module

- **Effect**: `DiscussionFeedListenerAdapter` is rewired. The old `recordThreadCreated` and `recordThreadSolved` branches are removed. The new branch records a `comment_created` activity for every `CommentCreatedEvent`. The `social_feed_activities` table receives a tombstone migration for any row with `activity_type = 'discussion_created'` or `activity_type = 'discussion_solved'` (the prior activity types).
- **Surface**: the `social_feed_activity_type` enum loses `'discussion_created'` and `'discussion_solved'`. The migration is additive in the sense that the new enum value `'comment_created'` already exists.

### 7.5 Search module

- **Effect**: none. The discussion module does not publish searchable content to the search index. The previous full-text search on `discussion_threads.discussion_search_vector` is removed.

### 7.6 Bookmark module

- **Effect**: none. The previous `discussion_saved_threads` table is dropped; the bookmark module's quiz-level bookmarks are unchanged.

### 7.7 Analytics module

- **Effect**: none at the module surface. The discussion module does not publish analytics events. The previous `discussionCreated` analytics event is removed.

### 7.8 Auth module

- **Effect**: the discussion module continues to read the JWT subject via the global `JwtGuard`. The `DISCUSSION_MODERATE` permission is declared in `src/common/authorization/permissions.ts` and is unchanged.

---

## 8. Architecture conformance

### 8.1 Layering

The module mirrors the canonical four-layer split:

```
src/modules/discussion/
├── domain/
│   ├── services/comment.service.ts
│   ├── ports/
│   │   ├── comment-repository.port.ts
│   │   ├── quiz-existence.port.ts
│   │   └── user-existence.port.ts
│   ├── events/
│   │   ├── comment.events.ts
│   │   ├── comment-event-bus.port.ts
│   │   └── comment-event-bus.ts
│   └── errors/
│       └── comment.errors.ts
├── application/
│   └── comment-application.service.ts
├── infrastructure/
│   ├── repositories/comment.repository.ts
│   ├── adapters/quiz-existence.adapter.ts
│   ├── adapters/user-existence.adapter.ts
│   ├── audit/comment-moderator-audit.service.ts
│   └── scheduler/comment-counter-reconciler.service.ts
├── mappers/
│   ├── comment-cursor.mapper.ts
│   └── report-cursor.mapper.ts
├── dto/
│   ├── request/
│   │   ├── create-comment.dto.ts
│   │   ├── edit-comment.dto.ts
│   │   ├── vote.dto.ts
│   │   ├── report.dto.ts
│   │   ├── review-report.dto.ts
│   │   ├── list-quiz-comments-query.dto.ts
│   │   ├── list-my-comments-query.dto.ts
│   │   └── list-reports-query.dto.ts
│   └── response/
│       ├── comment.dto.ts
│       ├── comment-with-replies.dto.ts
│       ├── report.dto.ts
│       └── author.dto.ts
├── transport/
│   ├── controllers/comment.controller.ts
│   ├── controllers/quiz-comment.controller.ts
│   ├── controllers/user-comment.controller.ts
│   ├── controllers/report.controller.ts
│   ├── presenters/comment.presenter.ts
│   ├── swagger/comment-swagger-decorators.ts
│   └── swagger/examples/
├── discussion.module.ts
└── index.ts
```

The `domain/` layer owns business rules and ports. The `application/` layer orchestrates cross-module checks and DTO construction. The `infrastructure/` layer is the only consumer of `drizzle-orm` and `core/database/schema/comment/`. The `transport/` layer declares routes, binds DTOs, and delegates to the application service through the presenter.

### 8.2 Cross-module communication

- **Quiz existence**: `QuizExistencePort` (Symbol-typed) is bound in `discussion.module.ts` to the existing `QuizExistenceAdapter`.
- **User lookup**: `UserExistencePort.findByUsernames` (Symbol-typed) is bound to the existing `UserExistenceAdapter`.
- **Notification**: `DiscussionDomainEventBus` emits `CommentCreatedEvent`, `CommentMentionedEvent`, `CommentReportedEvent`. The Notification module subscribes through its own listener.
- **Social**: `DiscussionDomainEventBus` emits `CommentCreatedEvent`. The Social module records the activity.

### 8.3 Ports

```ts
// src/modules/discussion/domain/ports/comment-repository.port.ts
export const COMMENT_REPOSITORY_PORT = Symbol('COMMENT_REPOSITORY_PORT');

export interface CommentRepositoryPort {
  // Comments
  createComment(params: CreateCommentParams, tx?: Db): Promise<CommentView>;
  getCommentById(commentId: UUIDv7): Promise<CommentView | null>;
  getCommentByIdForUpdate(commentId: UUIDv7, tx: Db): Promise<CommentView | null>;
  listComments(params: ListCommentsParams): Promise<CommentWithRepliesView[]>;
  editComment(params: EditCommentParams): Promise<CommentView>;
  softDeleteComment(params: { commentId: UUIDv7; authorId: UUIDv7 }, tx?: Db): Promise<void>;
  setHiddenState(params: { commentId: UUIDv7; hidden: boolean; moderatorId: UUIDv7 }, tx?: Db): Promise<void>;
  incrementVoteCount(commentId: UUIDv7, deltaUp: number, deltaDown: number, tx?: Db): Promise<void>;
  incrementRepliesCount(commentId: UUIDv7, delta: number, tx?: Db): Promise<void>;
  countReplies(parentCommentId: UUIDv7): Promise<number>;

  // Votes
  upsertVote(params: { userId: UUIDv7; commentId: UUIDv7; value: VoteValue }, tx?: Db): Promise<void>;
  removeVote(params: { userId: UUIDv7; commentId: UUIDv7 }, tx?: Db): Promise<void>;
  getUserVote(userId: UUIDv7, commentId: UUIDv7): Promise<VoteValue | null>;

  // Reports
  createReport(params: CreateReportParams): Promise<ReportView>;
  listReports(params: ListReportsParams): Promise<ReportView[]>;
  reviewReport(params: ReviewReportParams): Promise<ReportView>;

  // Counter reconciler
  reconcileCounters(): Promise<{ comments: number; replies: number }>;

  // Helpers
  getUsername(userId: UUIDv7): Promise<string | null>;
  getUsernamesForUsers(userIds: UUIDv7[]): Promise<Map<UUIDv7, string>>;
  transactionally<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
```

The port does not expose Drizzle types. The implementation in `infrastructure/repositories/comment.repository.ts` is the only place that imports `drizzle-orm` and `core/database/schema/comment/`.

### 8.4 Module exports

`discussion.module.ts` exports:

- `CommentApplicationService` (for tests and in-process callers).
- `COMMENT_REPOSITORY_PORT` (for cross-module read-only access if ever needed; not currently consumed).
- `DISCUSSION_DOMAIN_EVENT_BUS` (for cross-module listener registration).
- `CommentModeratorAuditService`.

The domain service is not exported. Module-level state is not used.

### 8.5 Authorization

- `JwtGuard` is global. `@Public()` opts the read endpoints out.
- `PermissionsGuard` is global. The moderator endpoints declare `@Permissions(Permission.DISCUSSION_MODERATE)`.
- `DiscussionAuthorizationPolicy.assertCanModerate(user)` is the single source of truth for moderator authorization, called by the domain service before every hide/restore/review.

### 8.6 Audit log

Every moderation action is recorded in `auth_audit_logs` with `event_type = 'moderator_action'`. The retention is 365 days, applied by truncating `expires_at` on insert. The audit table is owned by the auth module; the discussion module writes through `CommentModeratorAuditService`.

The set of recorded actions is:

```ts
type ModerationAction = 'hide_comment' | 'restore_comment' | 'review_report';
```

The actions are recorded after the domain transaction commits, never inside it.

### 8.7 Throttling

| Endpoint | Limit |
|---|---|
| `POST /quizzes/:quizId/comments` | 20 / minute |
| `PATCH /comments/:commentId` | 20 / minute |
| `DELETE /comments/:commentId` | 30 / minute |
| `PUT /comments/:commentId/vote` | 20 / minute |
| `DELETE /comments/:commentId/vote` | 20 / minute |
| `POST /comments/:commentId/reports` | 5 / minute |
| `POST /comments/:commentId/hide` | 30 / minute |
| `POST /comments/:commentId/restore` | 30 / minute |
| `POST /comments/reports/:reportId/review` | 20 / minute |

Read endpoints are not throttled at the route level. The global `ThrottlerGuard` covers them at the IP level.

### 8.8 DTOs and validation

- Request DTOs use `class-validator` decorators. `body` is a non-empty trimmed string of length 1-2000. `value` is an enum. `reason` is a non-empty trimmed string of length 1-500. `details` is an optional string of length 0-2000.
- Response DTOs are plain TypeScript classes with `@ApiProperty` annotations. The presenter projects to plain objects so the global `ResponseFormatInterceptor` can wrap in `{ data, meta }`.
- Cursor DTOs (`cursor?: string`) use the project's `CursorQueryDto` shape (`limit?`, `cursor?`).

### 8.9 Error mapping

Every `DiscussionError` is mapped in `ProblemCodeMapping` (the central registry). The codes are listed in §3.6. The mapping is locked by `problem-code-mapping.spec.ts`.

### 8.10 OpenAPI

The controller composition lives in `transport/swagger/comment-swagger-decorators.ts`. Every endpoint declares:

- Success status with the correct response DTO schema.
- Every error status the application can throw (via `ApiErrorResponses`).
- The security requirement (`@ApiBearerAuth` or `@Public`).
- The `format: 'uuid'` on every UUID path parameter.

`discussion-openapi.spec.ts` asserts the schema integrity. `docs/generated/openapi.json` is regenerated by `pnpm generate:openapi` and committed alongside the change.

---

## 9. Implementation plan

The plan is additive. Each phase produces a system where the existing tests pass and the new surface is live. The order is dependency-driven: a phase cannot reference a feature that has not yet been migrated.

### 9.1 Constants and shared types

- **Goal**: introduce the new module identity, comment-only enums, and constants.
- **Tasks**:
  - Create `src/modules/discussion/domain/constants.ts` with `MAX_COMMENT_BODY_LENGTH = 2000`, `MAX_REPLIES_PER_COMMENT = 100`, `MAX_REPORT_REASON_LENGTH = 500`, `MAX_REPORT_DETAILS_LENGTH = 2000`.
  - Update `src/core/database/schema/shared/enums.ts` to introduce `discussion_comment_report_status` (carrying `'open' | 'reviewed' | 'dismissed' | 'actioned'`) and `discussion_comment_vote_value` (carrying `'upvote' | 'downvote'`). The old `discussion_thread_status`, `discussion_content_status`, `discussion_report_target_type`, `discussion_thread_status as enum` are retained for the migration only.
- **Risks**: shared schema enum changes touch every DTO that referenced the old enums. The migration is gated by Phase 9.4.
- **Dependencies**: none.
- **Exit criteria**: the constants file compiles. The new enums are exported from the shared schema.

### 9.2 Domain types

- **Goal**: introduce the comment-only domain types and consolidate the value objects.
- **Tasks**:
  - Rewrite `src/modules/discussion/domain/types/index.ts`. The file exports the `Comment` aggregate shapes, the `AuthorView` value object, the `VoteValue` and `ReportStatus` enums, the `CommentSortField` enum (with values `'created_at' | 'votes_count'`), the command parameter shapes, the query parameter shapes, and the cursor types.
  - The file no longer references `DiscussionThread`, `DiscussionThreadStatus`, `DiscussionThreadDetail`, `DiscussionContentStatus`, `DiscussionReportTargetType`, `DiscussionThreadSubscription`, `DiscussionSavedThread`, `PublicDiscussionProfile`, `ThreadStats`, `MyDiscussionStats`, several list-item shapes, or the q&a events.
- **Risks**: any consumer of the old types (`DiscussionService`, `DiscussionApplicationService`, `DiscussionRepository`, the DTOs, the controllers) will fail to compile until they are updated. The downstream phases update them in order.
- **Dependencies**: 9.1.
- **Exit criteria**: the file compiles in isolation.

### 9.3 Domain events

- **Goal**: emit comment-only events. The event names change because the entity changes.
- **Tasks**:
  - Rewrite `src/modules/discussion/domain/events/comment.events.ts` to declare `CommentCreatedEvent`, `CommentEditedEvent`, `CommentDeletedEvent`, `CommentHiddenEvent`, `CommentRestoredEvent`, `CommentMentionedEvent`, `VoteCastEvent`, `VoteRemovedEvent`, `CommentReportedEvent`, `ReportReviewedEvent`.
  - Rewrite `src/modules/discussion/domain/events/comment-event-bus.port.ts` to declare the emit methods for the new event types.
  - Rewrite `src/modules/discussion/domain/events/comment-event-bus.ts` (the implementation) to dispatch the new types.
  - Rewrite `src/modules/discussion/domain/events/index.ts` to re-export the new types.
  - The file `src/modules/discussion/domain/events/discussion-domain.events.ts` is deleted. The old `discussion-event-bus.ts` and `discussion-event-bus.port.ts` are deleted.
- **Risks**: the cross-module consumers (Notification, Social) must be updated in the same change set, or the event bus will have no listeners for the new types. The cross-module work is gated by Phase 9.7.
- **Dependencies**: 9.2.
- **Exit criteria**: the bus compiles in isolation.

### 9.4 Domain service

- **Goal**: rewrite the domain service to operate on comments only.
- **Tasks**:
  - Rewrite `src/modules/discussion/domain/services/comment.service.ts`. The class is renamed from `DiscussionService` to `CommentService`. The methods are: `createComment`, `editComment`, `deleteComment`, `vote`, `removeVote`, `reportComment`, `reviewReport`, `hideComment`, `restoreComment`, `listComments`, `listMyComments`, `getComment`. There is no `createThread`, `markThreadAsSolved`, `subscribeToThread`, `saveThread`, `listTrending`, `listUnanswered`, `search`, `findRelated`, `listParticipants`, `getPublicProfile`, `getThreadStats`, `getMyStats`.
  - The `emitMentionEvents` helper is preserved. The `@username` mention resolution is unchanged.
  - The cross-cutting transactional pattern (`this.repo.transactionally(async (tx) => { ... })`) is preserved for every write that mutates a counter.
- **Risks**: the moderator-id authorization is preserved. The `DiscussionAuthorizationPolicy.assertCanModerate` is reused unchanged.
- **Dependencies**: 9.2, 9.3.
- **Exit criteria**: the service compiles in isolation. The existing unit tests for the service are updated in-place.

### 9.5 Domain exceptions

- **Goal**: introduce the narrow set of exceptions listed in §3.6.
- **Tasks**:
  - Rewrite `src/modules/discussion/domain/errors/comment.errors.ts`. The abstract marker is `CommentError` (renamed from `DiscussionError`). The concrete classes are listed in §3.6.
  - Update `src/common/errors/problem-code-mapping.ts` to register the new codes. The `DISCUSSION_*` codes for the removed concepts are removed in the same change. The new `DISCUSSION_COMMENT_*` codes are added.
  - Update `src/common/errors/problem-code-mapping.spec.ts` to assert the new entries.
- **Risks**: the global `GlobalExceptionFilter` loud-fails on a missing `ProblemCodeMapping` entry. Every new code must be registered in the same commit.
- **Dependencies**: 9.2.
- **Exit criteria**: `pnpm test problem-code-mapping` passes.

### 9.6 Repository

- **Goal**: rewrite the repository to operate on the new tables.
- **Tasks**:
  - Rewrite `src/modules/discussion/infrastructure/repositories/comment.repository.ts` (renamed from `discussion.repository.ts`).
  - The schema file moves from `src/core/database/schema/discussion/schema.ts` to `src/core/database/schema/comment/schema.ts` and is re-exported from `src/core/database/schema/index.ts`.
  - The repository port in `src/modules/discussion/domain/ports/comment-repository.port.ts` exposes only the methods listed in §8.3.
  - The counter-reconciler is moved to `src/modules/discussion/infrastructure/scheduler/comment-counter-reconciler.service.ts` and runs on `@Cron('30 3 * * *')`.
- **Risks**: the schema file rename touches every cross-module importer. The migration plan in §10 handles the data archival.
- **Dependencies**: 9.2, 9.4.
- **Exit criteria**: the repository compiles. The existing repository tests are updated in-place.

### 9.7 Cross-module consumer updates

- **Goal**: Notification and Social modules consume the new event types.
- **Tasks**:
  - `src/modules/notification/infrastructure/adapters/discussion-notification-listener.adapter.ts` (renamed to `comment-notification-listener.adapter.ts`) is rewired:
    - `comment_created` → `notification_type: 'discussion_reply'` (existing value)
    - `comment_mentioned` → `notification_type: 'discussion_mention'` (existing value)
    - `comment_reported` → new moderator notification (uses existing `system_announcement` channel for now)
  - `src/modules/social/infrastructure/adapters/discussion-feed-listener.adapter.ts` (renamed to `comment-feed-listener.adapter.ts`) is rewired:
    - `comment_created` → `social_feed_activity_type: 'comment_created'` (existing value)
  - The `social_feed_activities` migration in §10 tombstones the old `discussion_created` and `discussion_solved` activity types.
- **Risks**: the `SocialModule` and `NotificationModule` import the new event names. The old event names are no longer exported. The cross-module build must pass.
- **Dependencies**: 9.3, 9.6.
- **Exit criteria**: `pnpm build` passes. The listener tests are updated in-place.

### 9.8 Application service and DTOs

- **Goal**: rewrite the application service, the request DTOs, and the response DTOs.
- **Tasks**:
  - `src/modules/discussion/application/comment-application.service.ts` (renamed from `discussion-application.service.ts`) wraps the domain service with the user JWT, the per-user `userVote` enrichment, and the cursor mapper calls.
  - The request DTOs are listed in §8.1.
  - The response DTOs are listed in §5.6.
  - The mapper files (`comment-cursor.mapper.ts`, `report-cursor.mapper.ts`) are the only mappers in the module.
- **Risks**: the DTO field renames (`commentId` → `id`) are wire-level changes. See §10 for the deprecation strategy.
- **Dependencies**: 9.4, 9.5.
- **Exit criteria**: the application service compiles. The OpenAPI artifact is regenerated.

### 9.9 Controllers and presenter

- **Goal**: rewrite the controllers and the presenter.
- **Tasks**:
  - `src/modules/discussion/transport/controllers/comment.controller.ts` — single comment operations (`GET`, `PATCH`, `DELETE`, `vote`, `report`, `hide`, `restore`).
  - `src/modules/discussion/transport/controllers/quiz-comment.controller.ts` — quiz-anchored list and create.
  - `src/modules/discussion/transport/controllers/user-comment.controller.ts` — user-anchored list.
  - `src/modules/discussion/transport/controllers/report.controller.ts` — moderator list and review.
  - `src/modules/discussion/transport/presenters/comment.presenter.ts` — an `ok` method per endpoint.
  - The four controllers together expose the 14 endpoints listed in §5.5.
- **Risks**: the route path changes (`/discussions/...` → `/comments/...` and `/quizzes/:quizId/comments`) are wire-level changes. See §10.
- **Dependencies**: 9.8.
- **Exit criteria**: the controllers compile. The OpenAPI artifact is regenerated.

### 9.10 Module wiring and barrel

- **Goal**: complete the module wiring.
- **Tasks**:
  - `src/modules/discussion/discussion.module.ts` (the module class name is unchanged — `DiscussionModule` — but the providers and controllers are updated).
  - `src/modules/discussion/index.ts` re-exports the public surface.
  - `src/app.module.ts` verifies the import order is unchanged.
- **Risks**: the module class name is the public identity of the module. Renaming is a breaking change. It is preserved.
- **Dependencies**: 9.9.
- **Exit criteria**: `pnpm build` passes. The OpenAPI artifact is regenerated.

### 9.11 Test updates

- **Goal**: update the in-module tests in place.
- **Tasks**:
  - `src/modules/discussion/domain/errors/comment.errors.spec.ts` (renamed from `discussion.errors.spec.ts`) — every exception class asserts its `code` and mapping.
  - `src/modules/discussion/domain/services/comment.service.spec.ts` — the service tests are updated to the new method names.
  - `src/modules/discussion/application/comment-application.service.spec.ts` — the application service tests are updated.
  - `src/modules/discussion/infrastructure/repositories/comment.repository.spec.ts` — the repository tests are updated.
  - `src/modules/discussion/infrastructure/scheduler/comment-counter-reconciler.service.spec.ts` — the reconciler test is updated.
  - `src/modules/discussion/transport/controllers/comment.controller.spec.ts` (renamed from `discussion.controller.spec.ts`) — the controller tests are updated.
  - `src/modules/discussion/transport/comment-openapi.spec.ts` (renamed from `discussion-openapi.spec.ts`) — the OpenAPI spec test is updated.
  - `src/modules/discussion/transport/comment-timestamp.spec.ts` (renamed from `discussion-timestamp.spec.ts`) — the timestamp projection test is updated.
  - `src/common/swagger/openapi-schemas.spec.ts` — the wrapper DTO test is updated.
  - `src/common/errors/problem-code-mapping.spec.ts` — the new codes are added.
  - `src/modules/notification/application/notification-application.service.spec.ts` — the listener tests are updated.
  - `src/modules/social/infrastructure/repositories/social.repository.impl.ts` — the social feed tests are updated.
  - `test/*.e2e-spec.ts` — the cross-module e2e tests are updated.
- **Risks**: dropping a test instead of updating it would leave a false-positive safety net. Every existing test is updated.
- **Dependencies**: 9.10.
- **Exit criteria**: `pnpm test` passes. `pnpm test:e2e` passes.

### 9.12 Documentation

- **Goal**: the module page reflects the new architecture.
- **Tasks**:
  - `docs/modules/discussion.md` is rewritten to describe the comment section.
  - `docs/architecture/overview.md` (or the equivalent) is updated to mention the comment section instead of the threaded discussion.
- **Risks**: none.
- **Dependencies**: 9.11.
- **Exit criteria**: the documents exist and link to this architecture document.

### 9.13 Phase ordering

The phases are sequenced so that the codebase compiles at every step. The first compiling phase is 9.1 + 9.2. The first "external" phase (when the wire changes) is 9.9. The cross-module cutover is 9.7. The final deprecation phase is in §10.

---

## 10. Migration strategy

The migration runs in three independent tracks: the schema, the API, and the events. Each track has a deprecation window. The tracks are coordinated so that the system is in a consistent state at any point in time.

### 10.1 Schema track

The schema migration is generated by `pnpm db:generate`. The migration is a single file:

1. Create `discussion_comments`, `discussion_comment_votes`, `discussion_comment_reports` with their constraints.
2. Create the indexes.
3. Drop `discussion_threads`, `discussion_thread_subscriptions`, `discussion_saved_threads`, `discussion_reports` (the old polymorphic one), `discussion_votes` (the old polymorphic one).

If a pre-existing `discussion_threads` table is in the deployment, the migration is paired with an archival step in the same migration file:

```sql
-- archive top-level comments from prior threads into the new discussion_comments table
INSERT INTO discussion_comments (...)
SELECT ... FROM discussion_threads
  INNER JOIN discussion_comments AS old_comments
    ON old_comments.thread_id = discussion_threads.thread_id;
```

The archival is conservative: it copies only top-level comments. Replies are reconstructed by joining on `parent_comment_id`. The script is idempotent (`ON CONFLICT DO NOTHING` on the new `id`).

The migration is run in production during a maintenance window. The reconciler in §9.6 recomputes the denormalized counters after the migration.

### 10.2 API track

The API cutover uses the project's deprecation pattern (§4.4 of `migration.md`):

- **Phase 1** (when the `/comments` endpoints ship): the `/discussions` endpoints are marked `@deprecated`. The old controllers respond with a `Sunset` header and a `Deprecation` header. The handlers delegate to the new service so the responses are consistent.
- **Phase 2** (90 days later): the old endpoints respond with 410 Gone. The deprecation headers are replaced with a `Link: </api/v1/comments>; rel="successor-version"` header.
- **Phase 3** (180 days later): the old endpoints are removed. The OpenAPI artifact is regenerated.

The window lengths are the project defaults. A compliance need can extend either window.

### 10.3 Event track

The event cutover is coordinated with the cross-module consumer updates (Phase 9.7):

- **Phase 1**: the new event types are emitted. The old event types are still emitted. The cross-module consumers switch to the new types.
- **Phase 2** (30 days later): the old event types are no longer emitted. The cross-module consumers are clean.
- **Phase 3**: the old event types are removed from the union.

The event track is shorter than the API track because there are no external clients for in-process events; the only consumers are the Notification and Social modules, which are updated in the same change set.

### 10.4 Social feed activity tombstone

The `social_feed_activities` table is moved to a tombstone state for the old activity types:

```sql
UPDATE social_feed_activities
SET metadata = metadata || jsonb_build_object('tombstoned_at', NOW(), 'replaced_by', 'comment_created')
WHERE activity_type IN ('discussion_created', 'discussion_solved');
```

The tombstone preserves the row in place so analytics queries that aggregate by `activity_type` continue to work. The activity type column is not removed; the enum loses the two values.

### 10.5 Backward compatibility

The migration is additive in the wire shape. The new endpoints are added before the old endpoints are deprecated. The deprecation headers are present before the 410 Gone is returned. The OpenAPI artifact is regenerated after every phase.

The schema migration is non-additive (it drops tables). The archival step is paired with the migration. The reconciler is run after the migration. The audit log captures the migration run.

---

## 11. Risk analysis

### 11.1 Schema migration risk

The risk is data loss on the old `discussion_threads`, `discussion_saved_threads`, `discussion_thread_subscriptions`, `discussion_reports`, and `discussion_votes` tables. The archival step in §10.1 mitigates the comments (the only data worth preserving). The other tables are dropped without archival — the project constitution's idempotency and conform-to-policy rules apply; the saved threads and subscriptions are user-level bookmarks that the user can re-create if needed.

The migration is run in a maintenance window. The reconciler is run after the migration. The audit log captures the migration.

### 11.2 API compatibility risk

The risk is that existing clients hit the old `/discussions` endpoints after the cutover. The risk is mitigated by the deprecation window (§10.2). The deprecation headers are visible to the client. The 410 Gone is the explicit signal that the endpoint is retired.

### 11.3 Event delivery risk

The risk is that a cross-module consumer drops an event during the cutover. The risk is mitigated by the phased event track (§10.3). The old event types are emitted for 30 days after the new types are introduced. The consumers are updated in the same change set.

### 11.4 Counter consistency risk

The risk is that the denormalized counters drift from the source-of-truth rows during the migration. The risk is mitigated by the reconciler in §9.6. The reconciler runs daily at 03:30 UTC and is idempotent.

### 11.5 Authorization risk

The risk is that non-moderators can hide or restore comments. The risk is mitigated by the `DiscussionAuthorizationPolicy.assertCanModerate` check at the start of every hide / restore / review. The check throws `DiscussionModeratorRequiredError` which is mapped to 403.

### 11.6 Rate limit risk

The risk is that a malicious user floods the comment endpoints. The risk is mitigated by the per-route `@Throttle` decorators (§8.7) and the global `ThrottlerGuard`. The report endpoint has the tightest limit (5/min) to prevent abuse.

### 11.7 Mention resolution risk

The risk is that a malicious user injects an `@username` mention that resolves to a different user. The risk is mitigated by the lowercase normalization in the parser (`@(\w{1,30})`) and the `findByUsernames` lookup. The username is matched case-insensitively. The mention does not bypass the self-mention check (the author does not receive their own mention).

### 11.8 Transactional risk

The risk is that a counter mutation sees a stale value because the read and the write are in different transactions. The risk is mitigated by the `FOR UPDATE` row lock on the comment row inside the transaction. The pattern is the same as the existing `getCommentByIdForUpdate` in the project's tag and social modules.

### 11.9 Soft delete consistency risk

The risk is that a soft-deleted comment is still visible because the read path does not filter `deleted_at`. The risk is mitigated by the `isNull(discussion_comments.deleted_at)` filter on every read path. The filter is enforced in the repository, not in the application layer.

### 11.10 Hidden comment visibility risk

The risk is that a hidden comment is still visible to non-moderators. The risk is mitigated by the `getCommentById` filter (`is_hidden = false OR caller is moderator`) and by the `listComments` filter (`is_hidden = false`). The `userVote` enrichment is also skipped for hidden comments.

---

## 12. Why each remaining concept exists

| Concept | Why it exists |
|---|---|
| `Comment` aggregate | The product is a comment section. |
| Two-level reply hierarchy | The product is a comment section, not a forum. YouTube comments do not have nested replies. |
| `isHidden` boolean | The product has two moderation states: visible and hidden. A boolean is the simplest representation. |
| `deletedAt` timestamp | The author can delete their own comment. The project uses soft-delete everywhere. |
| `votesCount`, `upvotesCount`, `downvotesCount` denormalized counters | The product displays vote counts on every comment. Computing them on the fly at read time is too expensive. The reconciler keeps them honest. |
| `repliesCount` denormalized counter | The product displays the reply count on every top-level comment. |
| `votes` table | The product tracks per-user votes. A separate row per `(user, comment)` is the canonical representation. |
| `reports` table | The product routes user reports to moderators. The status state machine is preserved. |
| `@username` mention parsing | The product supports mentioning other users. The mention emits a notification. |
| `DISCUSSION_MODERATE` permission | The product has moderator-only actions. |
| Audit log | The compliance requirement mandates a 365-day retention on moderation actions. |
| `AuthorView` value object | The product displays the author on every comment. The shape is the same across read and write. |
| `CommentSortField` | The product displays comments sorted by recency or popularity. The two values are the only product cases. |
| Cursor pagination | The project standard. The list can be unbounded. |
| `parentCommentId` self-FK | The reply hierarchy is a parent-child relation. The FK is contained within the aggregate. |
| `SocialModule` listener | The product records a `comment_created` activity in the social feed. |
| `NotificationModule` listener | The product notifies the parent comment author of a reply, the mentioned user of a mention, and the moderators of a report. |

---

## 13. Why each removed concept is unnecessary

| Concept | Why it is unnecessary |
|---|---|
| `DiscussionThread` | The comment is anchored to a quiz. There is no separate thread object. |
| `DiscussionThreadStatus` (`open` / `closed` / `hidden` / `deleted`) | The thread lifecycle is replaced by the comment lifecycle. There is no closed state. |
| `DiscussionContentStatus` enum | The two states (`isHidden`) are represented by a boolean. |
| `DiscussionReportTargetType` (`'thread' | 'comment'`) | The reports are on comments only. The target type is implicit. |
| `DiscussionThreadSubscription` | YouTube comments are not subscribed to. The notification on a new comment is fired through the mention or the parent-comment reply, not through a subscription. |
| `DiscussionSavedThread` | YouTube comments are not bookmarked. The user can copy a link to the comment if they want to save it. |
| `ThreadStats` | The thread-level aggregates are not displayed. |
| `MyDiscussionStats` | The user does not have a "discussion profile" in the comment section. |
| `PublicDiscussionProfile` | The user profile lives in the User module. |
| `TrendingDiscussionListItem` | The comment section is per-quiz. There is no global trending feed. |
| `UnansweredDiscussionListItem` | There is no Q&A workflow. |
| `SearchDiscussionListItem` | A comment is short. The search is at the quiz level. |
| `RelatedDiscussionListItem` | The comment section is per-quiz. There is no between-threads relation. |
| `ThreadParticipantListItem` | The participants are not surfaced. The author is surfaced on every comment. |
| `DiscussionThreadCreatedEvent` | There is no thread creation. |
| `DiscussionThreadSolvedEvent` | There is no solved state. |
| `DiscussionThreadClosedEvent` | There is no closed state. |
| `DiscussionThreadReopenedEvent` | There is no closed state. |
| `DiscussionThreadHiddenEvent` | Moderation is on the comment. |
| `DiscussionThreadRestoredEvent` | Moderation is on the comment. |
| `DiscussionThreadDeletedEvent` | The thread is replaced by the comment. |
| `comment_count` on the quiz | The quiz does not own the comment count. The comment count is computed by the discussion module on demand. |
| `discussion_search_vector` | The comment section is not searchable globally. |
| `is_solved`, `solved_at`, `solved_comment_id`, `solved_by` | There is no solved state. |
| `DiscussionAuthorizationPolicy` thread-method shims | The only moderation actions are on the comment. |

---

## 14. Specification files

The implementation is locked by the project's spec files. Every phase in §9 updates the corresponding spec.

| Spec | What it locks |
|---|---|
| `src/common/errors/problem-code-mapping.spec.ts` | Every new code's HTTP status, title, and typeUri. |
| `src/common/filters/global-exception.filter.spec.ts` | The wire shape of every error. |
| `src/common/interceptors/response-format.interceptor.spec.ts` | The success envelope. |
| `src/common/swagger/openapi-schemas.spec.ts` | The wrapper DTOs in the OpenAPI artifact. |
| `src/modules/discussion/transport/comment-openapi.spec.ts` | The discussion module's OpenAPI artifact. |
| `src/modules/discussion/transport/comment-timestamp.spec.ts` | The presenter emits ISO 8601 timestamps. |
| `src/modules/discussion/dto/request/*.dto.spec.ts` | The validation rules on every request DTO. |
| `src/modules/discussion/domain/errors/comment.errors.spec.ts` | Every exception class's `code` and mapping. |
| `src/modules/discussion/domain/services/comment.service.spec.ts` | The domain service's behavior. |
| `src/modules/discussion/application/comment-application.service.spec.ts` | The application service's behavior. |
| `src/modules/discussion/infrastructure/repositories/comment.repository.spec.ts` | The repository's behavior. |
| `src/modules/discussion/infrastructure/scheduler/comment-counter-reconciler.service.spec.ts` | The reconciler's idempotency. |
| `src/modules/discussion/transport/controllers/comment.controller.spec.ts` | The controller's delegation. |
| `test/comment.e2e-spec.ts` | The cross-module behavior. |
| `test/rfc7807.e2e-spec.ts` | The error wire shape. |
| `test/envelope.e2e-spec.ts` | The success envelope. |

---

## 15. Non-goals

These are explicitly out of scope for the module. They are listed so that a future reader can recognize when a proposed change is product-shaped rather than architecture-shaped.

- A Q&A workflow (questions, answers, accepted answer, unsolved).
- A subscription model on a comment or on the comment section.
- A save / bookmark model on a comment or on the comment section.
- A search model on the comment text.
- A trending / unanswered / related model.
- A user comment profile (history) at the discussion-module level.
- A threaded discussion at the module level.
- A trivia / quiz feature.
- A notification system.
- A social feed.

The module's contribution is the comment section. The seven other modules are responsible for the rest of the product.
