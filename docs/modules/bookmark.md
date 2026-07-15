# Bookmark Module

## Purpose

Owns **user-curated quiz collections**: named collections with personal notes, bulk operations on collection members, and collection-level analytics.

## Responsibilities

**Owns**
- Bookmark collections (named, with description, cover image)
- Quiz-to-collection membership with optional personal notes
- Bulk add and bulk remove operations
- Collection-level analytics (total quizzes, completion rate, average score)
- Collection sharing

**Does not own**
- The quizzes being bookmarked (Quiz module owns `quizzes`)
- Attempt data for completion rate (read via Quiz module's `QUIZ_ANALYTICS_PORT`)

## Core Concepts

| Concept | Description |
|---|---|
| **BookmarkCollection** | A named collection: `name`, `description`, `coverImageUrl`, `isPublic`, `shareCode`. Soft-deleted. |
| **Bookmark** | A quiz's membership in a collection: `collectionId`, `quizId`, `note`. |

## Business Rules

- **Slug uniqueness**: active collections have unique slugs.
- **Bulk add idempotency**: duplicate `(collectionId, quizId)` pairs are silently skipped via `ON CONFLICT DO NOTHING`.
- **Bulk remove idempotency**: removing non-existent pairs is a no-op.
- **Collection ownership**: only the owner may rename, update visibility, delete, or manage the collection's members.
- **Move bookmark**: moves a bookmark between collections; source collection verification is optional.
- **One bookmark per quiz per collection**: unique constraint; duplicate raises `BOOKMARK_CONFLICT`.

## Relationships

```
BookmarkCollection
├── belongs to → User (ownerId)
└── has many → Bookmarks

Bookmark
├── belongs to → Collection (FK, cascade)
├── belongs to → Quiz (FK, cascade)
└── has optional → Note
```

## Lifecycle

### BookmarkCollection

```
Active (deletedAt = null)
    ↓ deleteCollection()
Soft-deleted (deletedAt = now; bookmarks cascade soft-delete)
    ↓ (no restore — not implemented)
```

### Bookmark

```
Active (in collection)
    ↓ removeBookmark() / bulk remove
Not present (soft-deleted; can be re-added via bulk add)
```

## Permissions

No RBAC `@Permissions` guards. All endpoints require a valid JWT; data is scoped to the authenticated user (owner for collections, actor for bookmark operations).

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Validates quiz existence before bookmark operations. Reads completion rate and average score via `QUIZ_ANALYTICS_PORT` for collection analytics. |

## Invariants

- A bookmark always belongs to exactly one active collection and one active quiz.
- Exactly one bookmark per quiz per collection at any time.
- Collection slugs are unique among active collections.

## Future Extension Points

- **Collection restore**: not implemented (soft-deleted collections cannot be restored).
- **Collection sharing URL**: a `shareCode` field exists but the sharing flow is not yet implemented.