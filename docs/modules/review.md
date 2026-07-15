# Review Module

## Purpose

Owns the **quiz review surface**: per-user reviews with star ratings and helpful votes, plus a moderator reports pipeline.

## Responsibilities

**Owns**
- One review per user per quiz
- Helpful votes on reviews
- Review reports and moderator review pipeline

**Does not own**
- Quiz analytics (Quiz module)
- User attempt data (Attempt module)

## Core Concepts

| Concept | Description |
|---|---|
| **Review** | A user's star rating (`rating ∈ [1,5]`) and text review for a quiz. |
| **ReviewHelpfulVote** | A user's vote marking a review as helpful. |
| **ReviewReport** | A user's report of a review for moderation. |

## Business Rules

- **One review per user per quiz**: enforced by unique constraint on `(quizId, userId)`.
- **Attempt required**: users must have completed at least one attempt before reviewing.
- **Ownership**: only the review author may update or delete their review.
- **Self-report prohibited**: a user cannot report their own review.
- **Duplicate report prohibited**: one open report per user per review.
- **Rating range**: `rating ∈ [1, 5]` enforced by DB CHECK constraint.

## Relationships

```
Review
├── belongs to → User (authorId)
├── belongs to → Quiz (quizId)
├── has many → HelpfulVotes
├── has many → Reports
└── rated by → rating ∈ [1, 5]
```

## Lifecycle

### Review

```
Created (rating + optional text)
    ↓ update() [author only]
Updated
    ↓ delete() [author only]
Deleted (soft-deleted; author only)
```

## Permissions

| Action | Requirement |
|---|---|
| Create, update, delete review | Authenticated user; author for update/delete |
| Vote helpful, report | Authenticated user |
| List reports, dismiss/action reports | `REVIEW_MODERATE` (Admin, Moderator) |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Listens to `review.submitted` and `review.deleted` via `REVIEW_DOMAIN_EVENT_BUS`; calls `refreshQuizMetrics(event.quizId)` to update `quizStats.avgRating`. |
| **Attempt** | Validates that the user has at least one completed attempt before allowing review creation. |

## Invariants

- Exactly one review per user per quiz.
- `rating ∈ [1, 5]`.
- No self-report.
- No duplicate reports.

## Future Extension Points

- **Review reactions** (beyond helpful): not yet modeled.
- **Review images/attachments**: not yet modeled.