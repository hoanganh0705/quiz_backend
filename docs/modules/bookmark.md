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
| **BookmarkCollection** | A named collection: `name`, `description`, `coverImageUrl`, `isPublic`, `shareCode`. **Hard-deleted** (rows are removed from the table; no `deletedAt` column exists). |
| **Bookmark** | A quiz's membership in a collection: `collectionId`, `quizId`, `note`. **Hard-deleted** when removed via `removeBookmark` / bulk remove, or cascade-deleted when the parent collection is deleted. |

## Business Rules

- **Name uniqueness per owner**: a `(name, userId)` pair is unique; collision raises `COLLECTION_CONFLICT` (409).
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
Active (row in bookmark_collections)
    ↓ deleteCollection()
Deleted (rows removed from bookmark_collections; bookmarked_quizzes rows cascade-deleted via FK)
    ↓ (no restore — see "Future Extension Points")
```

> **Implementation note (2026-07-15):** collections are **hard-deleted**. The audit at
> `docs/audits/BOOKMARK_API_CONTRACT_AUDIT.md` finding **C4** previously documented this
> table as soft-deleted with a future restore endpoint, which did not match the schema
> (no `deleted_at` column) or the repository (a `DELETE FROM` statement). The decision
> recorded in that audit was to keep the implementation as hard delete and align the
> documentation. There is no restore endpoint.

### Bookmark

```
Active (row in bookmarked_quizzes)
    ↓ removeBookmark() / bulk remove
Not present (row deleted; can be re-added via addBookmark / bulk add)
```

A bookmark row is also deleted automatically (cascade FK) when its parent collection is
deleted.

## Permissions

No RBAC `@Permissions` guards. All endpoints require a valid JWT; data is scoped to the authenticated user (owner for collections, actor for bookmark operations).

## Cross-module Interactions

| Module | Interaction |
|---|---|
| **Quiz** | Validates quiz existence before bookmark operations. Reads completion rate and average score via `QUIZ_ANALYTICS_PORT` for collection analytics. |

## Invariants

- A bookmark always belongs to exactly one active collection and one active quiz.
- Exactly one bookmark per quiz per collection at any time.
- Collection names are unique per `(name, userId)`.

## Future Extension Points

- **Collection restore**: not implemented. Because collections are hard-deleted, a deleted
  collection cannot be restored from the API. Restoring would require either a schema
  change (adding a `deleted_at` column) or a separate backup/snapshot mechanism. Out of
  scope for the current contract.
- **Collection sharing URL**: a `shareCode` field exists but the sharing flow is not yet implemented.