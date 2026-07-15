# Quiz Module

## Purpose

Owns the **full quiz authoring and publication lifecycle**: quizzes, versions, questions, answer options, tag associations, analytics (popularity, trending, category/tag rollups), and related quiz discovery.

> User attempts at quizzes belong to the **Attempt module**. Bookmarks belong to the **Bookmark module**. Reviews belong to the **Review module**. Discussions belong to the **Discussion module**.

## Responsibilities

**Owns**
- Quiz catalog with soft-delete, slug, and visibility settings
- Quiz versioning (draft → published → archived)
- Question and answer-option management per version
- Quiz-tag and quiz-category associations
- Denormalised `quizStats` (totalAttempts, avgScore, avgRating, bookmarkCount, popularityScore, trendingScore)
- Trending, popular, featured, and similar quiz listings
- Analytics rollups (per-quiz, per-creator, per-category, per-tag)
- Search across quiz titles and descriptions

**Does not own**
- User attempts and scoring (Attempt module)
- Bookmarks and collections (Bookmark module)
- Reviews and votes (Review module)
- Real-time quiz instances (Instance module)
- Tournament sessions (Tournament module)

## Core Concepts

| Concept | Description |
|---|---|
| **Quiz** | A quiz entity with metadata (`title`, `slug`, `imageUrl`, `creatorId`, `categoryId`, `isFeatured`, `isHidden`, `isVerified`, `publishedVersionId`). Soft-deleted. |
| **QuizVersion** | A published snapshot of a quiz with `status ∈ {draft, published, archived}`, `difficulty`, `durationMs`, `passingScorePercent`, `rewardXp`. |
| **QuizQuestion** | A question within a version, ordered by `position`. |
| **QuizAnswerOption** | An answer option within a question, ordered by `position`. Exactly one `isCorrect = true` per question (enforced at DB level). |
| **QuizTag** | Join entity linking a quiz to a tag. |
| **QuizStats** | Denormalised analytics for a quiz (updated on Attempt, Review, Bookmark events). |
| **QuizDifficulty** | `easy | medium | hard` |
| **QuizVersionStatus** | `draft | published | archived` |

## Business Rules

- **Slug uniqueness**: active quizzes have unique lowercase slugs. Deleted quizzes release their slug for reuse.
- **Title non-blank**: enforced by DB CHECK constraint.
- **One published version at a time**: a quiz's `publishedVersionId` FK points to at most one `published` version. Publishing a new version archives the prior one.
- **Minimum questions to publish**: a version must have at least 5 questions before it can be published.
- **Exactly one correct answer per question**: enforced by a DB partial unique index.
- **Visibility gate**: a version can be published as `isHidden = false` only if the quiz is `isVerified = true` (unless the publisher holds `QUIZ_VERIFY`).
- **Soft delete cascades**: deleting a quiz soft-deletes the quiz row and cascades hard-deletes via FK `ON DELETE CASCADE` to its versions, questions, options, and tag associations. `quizStats` is cascade-hard-deleted with the quiz.
- **Restore**: not implemented for quizzes. Soft-deleted quizzes remain deleted.
- **Owner rule**: the `creatorId` FK uses `ON DELETE SET NULL` — a deleted user does not delete their quizzes.
- **Slug auto-generation**: when omitted on create, the slug is derived from the title via `buildSlug()`.

## Relationships

```
Quiz
├── created by → User (creatorId, ON DELETE SET NULL)
├── belongs to → Category (categoryId, ON DELETE SET NULL)
├── has many → Tags (via QuizTag)
├── has many → Versions (one may be published)
│       ├── has many → Questions
│       │       └── has many → AnswerOptions (exactly one isCorrect)
├── has one → QuizStats
├── has many → Discussions (Discussion module — FK from Discussion side)
├── has many → Attempts (Attempt module — FK from Attempt side)
├── has many → Bookmarks (Bookmark module — FK from Bookmark side)
├── has many → Reviews (Review module — FK from Review side)
└── has many → Instances (Instance module — FK from Instance side)
```

## Lifecycle

### QuizVersion

```
Draft (status = draft)
    ↓ publish()
Published (status = published; quizzes.publishedVersionId set)
    ↓ publish a newer version
Archived (prior published version archived; new version becomes published)
    ↓ (never un-archived)
```

### Quiz

```
Active (deletedAt = null)
    ↓ softDelete()
Soft-deleted (deletedAt = now; not returned in any list; slug released)
    ↓ (no restore)
```

## Permissions

| Action | Permission | Who holds it |
|---|---|---|
| Create quiz | `QUIZ_CREATE` | Any authenticated user (via `user` role) |
| Edit quiz | `QUIZ_EDIT_OWN` (owner) or `QUIZ_EDIT_ANY` | Owner, Admin |
| Delete quiz | `QUIZ_DELETE_OWN` (owner) or `QUIZ_DELETE_ANY` | Owner, Admin |
| Create version | `QUIZ_VERSION_CREATE_OWN` or `QUIZ_VERSION_CREATE_ANY` | Owner, Admin |
| View versions | `QUIZ_VERSION_VIEW_OWN` or `QUIZ_VERSION_VIEW_ANY` | Owner, Admin |
| Edit version | `QUIZ_VERSION_EDIT_OWN` or `QUIZ_VERSION_EDIT_ANY` | Owner, Admin |
| Publish version | `QUIZ_VERSION_PUBLISH_OWN` or `QUIZ_VERSION_PUBLISH_ANY` | Owner, Admin |
| Publish hidden/unverified quiz | `QUIZ_VERIFY` (in addition to publish permission) | Admin, Moderator |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Tag** | Quiz module reads tag associations via `QUIZ_LISTING_PORT` (tag module's `QuizApplicationService`). Provides `QuizListingPort` consumed by Tag module for `listQuizzesByTag` and `getTagAnalytics`. |
| **Category** | Quiz module reads category via FK on `quizzes.categoryId`. Provides `QuizListingPort` consumed by Category module for category-scoped quiz listings and category analytics. |
| **Attempt** | Listens to `AttemptCompletedEvent` from `ATTEMPT_DOMAIN_EVENT_BUS`; refreshes `quizStats` accordingly. |
| **Review** | Listens to `review.submitted` and `review.deleted` via `REVIEW_DOMAIN_EVENT_BUS`; refreshes `quizStats`. |
| **Bookmark** | Direct read from `bookmarkedQuizzes` table for `quizStats.bookmarkCount`. |
| **User** | Reads creator analytics via `USER_DOMAIN_SERVICE`. Checks creator existence for `getMyQuizAnalytics`. |

## Invariants

- A `QuizVersion` always belongs to exactly one quiz.
- A quiz has at most one `published` version at any time.
- A `QuizVersion` with `status = published` always has at least 5 questions.
- A `QuizAnswerOption` always has exactly one `isCorrect = true` per question.
- `quizStats` is always consistent with the actual counts from Attempt, Review, and Bookmark tables (enforced by refresh-on-event).
- Slugs are unique among active quizzes.

## Future Extension Points

- **Quiz import/export**: not yet modeled.
- **Scheduled publish**: not yet modeled (a publish can be made immediately or via a future timestamp).
- **Version diffing**: the current architecture supports editing a draft version but does not expose a structured diff between versions.