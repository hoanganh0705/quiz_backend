# Tag Module

## Purpose

Owns the **folksonomic tag taxonomy**: free-form labels applied to quizzes and the user follow-through relationship. Tags are the community-curated complement to the curated categories owned by the **Category module**.

## Responsibilities

**Owns**
- Tag catalog (name, slug, description)
- Tag ranking (popularity and trending, derived from `quizStats`)
- Related-tag discovery (co-occurrence via shared quizzes)
- User follow-through on tags

**Does not own**
- Quiz-tag associations (the Quiz module owns the `quizTags` table and manages the associations)
- Tag analytics computation (derived on-demand from the Quiz module's `quizStats`)

## Core Concepts

| Concept | Description |
|---|---|
| **Tag** | A folksonomic label: `name`, `slug`. Soft-deleted. |
| **TagFollow** | A user's follow of a tag: `userId` + `tagId`. Soft-deleted. |
| **TagRanking** | Computed on-demand: tags ordered by `popularityScore` or `trendingScore`, summed from `quizStats` joined through `quizTags` and filtered to active, non-hidden quizzes. |
| **TagAnalytics** | Wrapper around the Quiz module's `QuizAnalyticsService.getTagAnalytics(tagId)` result. Not a stored entity. |

## Business Rules

- **Slug uniqueness**: active tags have unique slugs. Deleted tags release their slug.
- **Name uniqueness**: active tags have unique lowercase names (enforced by DB partial unique index).
- **Slug format**: lowercase, alphanumeric with single hyphens, non-empty (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- **Slug normalization**: slugs are lowercased and trimmed before storage. Auto-slug derived from name via `buildSlug()`.
- **One active follow per user per tag**: partial unique index on `(user_id, tag_id) WHERE deleted_at IS NULL`.
- **Follow idempotency**: same as Category — restore of previously-followed tag.
- **Follow requires active tag**: cannot follow a soft-deleted tag.
- **Unfollow idempotency**: returns `unfollowed: false` if no active follow exists (no event emitted).
- **Restore idempotency**: raises `TagAlreadyActiveError` if tag is already active.
- **Slug conflict on restore**: surfaces `TagSlugConflictError` if the slug was claimed by another active tag during the deletion window.
- **Ranking source**: popularity/trending scores are summed from `quizStats` for all active, non-hidden quizzes tagged with this tag. Scores are cached for 60 seconds.
- **Related tags**: tags that co-occur on at least one active, non-hidden quiz with the source tag.

## Relationships

```
Tag
├── has many → Follows (TagFollow)
├── has many → Quizzes (via quizTags — Quiz module owns quizTags)
└── ranked by → quizStats (via Quiz module)

TagFollow
├── belongs to → User (FK, cascade)
└── belongs to → Tag (FK, cascade)
```

## Lifecycle

### Tag

```
Active (deletedAt = null)
    ↓ deleteTag()
Soft-deleted (deletedAt = now; ranking cache invalidated)
    ↓ restoreTag()
Active (deletedAt = null) — idempotent; slug conflict raises TAG_SLUG_CONFLICT
```

### TagFollow

```
Active (deletedAt = null)
    ↓ unfollowTag()
Soft-deleted (deletedAt = now)
    ↓ followTag() — restores existing row instead of inserting
Active (deletedAt = null)
```

## Permissions

| Action | Requirement |
|---|---|
| Browse tags, ranking, related, quizzes, analytics | Public (`@Public()`) |
| Follow / unfollow tag | Authenticated user |
| List own followed tags | Authenticated user |
| Create, update, soft-delete, restore tag | `TAG_MANAGE` permission (Admin only) |

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Reads quiz listings by tag via `QUIZ_LISTING_PORT` (`QuizApplicationService`). Reads tag analytics via `QUIZ_ANALYTICS_PORT` (`QuizAnalyticsService`). The `quizTags` join table is owned by the Quiz module but read by the Tag module for ranking and related-tags computation. |

## Invariants

- A `TagFollow` always belongs to exactly one active user and one active tag.
- Exactly one active follow per user per tag at any time.
- Active tags have unique slugs and names.
- Ranking scores reflect only active, non-hidden quizzes.
- A soft-deleted tag is excluded from all reads including ranking.

## Future Extension Points

- **Tag analytics materialization**: not yet implemented. All analytics are derived on-demand from `quizStats`. A future `TagStats` materialized table could be added.
- **Tag co-moderation**: not yet modeled. Only `TAG_MANAGE` holders can write tags today.
- **Tag merging**: not yet implemented. Merging two tags would require reassigning all `quizTags` associations and handling slug conflicts.