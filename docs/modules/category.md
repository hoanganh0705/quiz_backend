# Category Module

## Purpose

Owns the **curated taxonomy of quiz categories**: the category catalog and the user follow-through relationship. Categories are the top-level hierarchical classification for quizzes, distinct from the folksonomic tags owned by the **Tag module**.

## Responsibilities

**Owns**
- Category catalog (name, slug, description, icon, cover image)
- Category ranking (by popularity and trending scores, derived from `quizStats`)
- User follow-through on categories

**Does not own**
- Quiz assignment to categories (the Quiz module owns the FK)
- Quiz analytics (delegated to the Quiz module's `QuizAnalyticsService`)
- Tag taxonomy (Tag module)

## Core Concepts

| Concept | Description |
|---|---|
| **Category** | A curated top-level classification: `name`, `slug`, `description`, `iconUrl`, `coverImageUrl`. Soft-deleted. |
| **CategoryFollow** | A user's follow of a category: `userId` + `categoryId`. Soft-deleted. |
| **FollowedCategoryRow** | Projected read model: category with follow metadata for the requesting user. |
| **RankedCategoryRow** | Projected read model: category with `popularityScore` and `trendingScore` from aggregated `quizStats`. |

## Business Rules

- **Slug uniqueness**: active categories have unique slugs. Deleted categories release their slug.
- **Name uniqueness**: active categories have unique lowercase names (enforced by DB partial unique index).
- **One active follow per user per category**: partial unique index on `(user_id, category_id) WHERE deleted_at IS NULL`.
- **Follow idempotency**: following an already-followed category returns the existing active follow; following a previously-followed-and-unfollowed category restores the existing row rather than inserting a new one.
- **Restore idempotency**: restoring an already-active category returns the existing row.
- **Slug conflict on restore**: if a deleted category's slug was claimed by a newly created category during the deletion window, restore raises `CategorySlugConflictError`.
- **Category creator**: any authenticated user can create a category. No `Permission` gate found in the module.

## Relationships

```
Category
├── has many → Follows (CategoryFollow)
├── has many → Quizzes (Quiz module — FK on Quiz side)
└── ranked by → quizStats (via Quiz module)

CategoryFollow
├── belongs to → User (FK)
└── belongs to → Category (FK, cascade)
```

## Lifecycle

### Category

```
Active (deletedAt = null)
    ↓ deleteCategory()
Soft-deleted (deletedAt = now)
    ↓ restoreCategory()
Active (deletedAt = null) — idempotent if already active (raises ALREADY_ACTIVE)
```

### CategoryFollow

```
Active (deletedAt = null)
    ↓ unfollowCategory()
Soft-deleted (deletedAt = now)
    ↓ followCategory() — restores instead of inserting
Active (deletedAt = null)
```

## Permissions

No RBAC `@Permissions` are used in the Category module. All write endpoints (`POST`, `PATCH`, `DELETE`, `POST restore`) require a valid JWT; read endpoints are public.

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Reads category-scoped quiz listings via `QUIZ_LISTING_PORT` (`QuizApplicationService.listQuizzes`). Reads category analytics via `QUIZ_ANALYTICS_PORT` (`QuizAnalyticsService`). Invalidates category analytics cache on category delete/restore. |

## Invariants

- A `CategoryFollow` always belongs to exactly one active user and one active category.
- Exactly one active follow per user per category at any time.
- Active categories have unique slugs and names.

## Future Extension Points

- **Category hierarchy** (parent/child): not currently modeled. A `parentId` FK does not exist on the `categories` table.
- **Category ranking algorithm**: not yet implemented (methods exist in `RankedCategoryRow` projection but the ranking computation is delegated to the Quiz module's analytics).