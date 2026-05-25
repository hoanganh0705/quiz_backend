# Tag Module — API Documentation

> **Base URL**: `/api/v1/tags`
> **Generated from source**: `src/modules/tag/`

---

## Module Overview

| Aspect | Detail |
|---|---|
| **Purpose** | CRUD management for quiz tags |
| **Business responsibility** | Create, list, read, update, and soft-delete tags used to label and filter quizzes |
| **Transport** | HTTP REST (no WebSocket events) |
| **Global prefix** | `/api/v1` |
| **Controller prefix** | `/tags` |
| **Architecture** | Flat (service handles DB access directly via Drizzle ORM) |

### Security Summary

- **Read endpoints** (`GET`) are `@Public()` — no authentication required.
- **Write endpoints** (`POST`, `PATCH`, `DELETE`) require **Bearer access token** + **`admin` role**.
- Authorization is enforced via `@Roles('admin')` decorator + global `RolesGuard`.

### Difference from Category

Tags are lightweight labels with only `name` and `slug` — no `description` or `imageUrl`. They serve as fine-grained filtering labels while categories provide broader classification.

---

## API Endpoints

---

### GET `/api/v1/tags`

#### Description

Lists all active (non-deleted) tags with cursor-based pagination, ordered by `createdAt` descending.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Query Parameters

| Param | Type | Required | Rules | Description |
|---|---|---|---|---|
| `cursor` | `string` | No | Max 512 chars | Opaque cursor from a previous response's `pagination.nextCursor` |
| `limit` | `number` | No | Integer, 1–100. Default: `10` | Number of items per page |

#### Response — `200 OK`

```json
{
  "data": [
    {
      "tagId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "name": "JavaScript",
      "slug": "javascript",
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z"
    },
    {
      "tagId": "a9b8c7d6-e5f4-3210-abcd-ef0987654321",
      "name": "Data Structures",
      "slug": "data-structures",
      "createdAt": "2026-05-19T08:30:00.000Z",
      "updatedAt": "2026-05-19T08:30:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z",
    "pagination": {
      "limit": 10,
      "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA1...",
      "hasNextPage": true
    }
  }
}
```

#### Pagination

Cursor-based pagination (same pattern as all other list endpoints):

1. First request: `GET /api/v1/tags?limit=20`
2. If `hasNextPage` is `true`, pass `nextCursor` to the next request: `GET /api/v1/tags?limit=20&cursor=eyJ...`
3. Repeat until `hasNextPage` is `false`.

The cursor is an opaque Base64-encoded JSON payload. Do **not** construct or modify it manually.

#### Notes For Frontend Developers

- Items are sorted newest-first (`createdAt DESC`).
- `nextCursor` is `null` when there are no more pages.

---

### GET `/api/v1/tags/:slug`

#### Description

Retrieves a single active tag by its URL-friendly slug.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `slug` | `string` | Yes | URL-friendly tag identifier (e.g., `javascript`, `data-structures`) |

#### Response — `200 OK`

```json
{
  "data": {
    "tagId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "JavaScript",
    "slug": "javascript",
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-20T10:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Message | When |
|---|---|---|
| `400 Bad Request` | `"Tag slug cannot be empty"` | Empty slug |
| `400 Bad Request` | `"Tag slug must be lowercase..."` | Invalid slug format |
| `404 Not Found` | `"Tag not found"` | No active tag with that slug |

#### Internal Flow

1. Normalize slug (trim + lowercase).
2. Validate slug format against pattern `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
3. Query database for active (non-deleted) tag matching slug.
4. If not found → throw `404`.
5. Return tag.

---

### POST `/api/v1/tags`

#### Description

Creates a new tag. If no slug is provided, one is auto-generated from the name.

#### Authentication

**Required** — Bearer access token.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Authorization

**`admin` role required.** Non-admin users receive `403 Forbidden`.

#### Request Body

```json
{
  "name": "JavaScript",
  "slug": "javascript"
}
```

#### Validation Rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | **Yes** | 1–120 chars. Auto-trimmed. |
| `slug` | `string` | No | Max 120 chars. Lowercase only. Pattern: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Auto-generated from `name` if omitted. |

#### Response — `200 OK`

```json
{
  "data": {
    "tagId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "JavaScript",
    "slug": "javascript",
    "createdAt": "2026-05-25T14:00:00.000Z",
    "updatedAt": "2026-05-25T14:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Message | When |
|---|---|---|
| `400 Bad Request` | Validation errors | Invalid request body |
| `401 Unauthorized` | `"Authorization header is missing"` | No auth header |
| `403 Forbidden` | `"You do not have permission to access this resource"` | Non-admin user |
| `409 Conflict` | `"Tag name or slug already exists"` | Duplicate name or slug |

#### Internal Flow

1. Trim name.
2. If slug provided → normalize (trim + lowercase + validate pattern). If not → auto-generate from name.
3. Insert into database.
4. If unique constraint violation (duplicate name/slug) → throw `409`.
5. Return created tag.

#### Notes For Frontend Developers

- The `slug` field is optional. If omitted, the backend generates it from the name (e.g., `"Data Structures"` → `"data-structures"`).
- Sending a duplicate name or slug returns `409 Conflict`.

---

### PATCH `/api/v1/tags/:id`

#### Description

Partially updates an existing tag. Only provided fields are changed.

#### Authentication

**Required** — Bearer access token.

#### Authorization

**`admin` role required.**

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (UUID v4) | Yes | Tag ID |

#### Request Body

All fields are optional. Only include fields you want to change.

```json
{
  "name": "TypeScript",
  "slug": "typescript"
}
```

#### Validation Rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | No | 1–120 chars. Auto-trimmed. |
| `slug` | `string` | No | Max 120 chars. Lowercase, pattern: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. |

#### Response — `200 OK`

```json
{
  "data": {
    "tagId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "TypeScript",
    "slug": "typescript",
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-25T14:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Message | When |
|---|---|---|
| `400 Bad Request` | Validation errors | Invalid request body or invalid UUID |
| `401 Unauthorized` | Auth error | No/invalid access token |
| `403 Forbidden` | `"You do not have permission..."` | Non-admin user |
| `404 Not Found` | `"Tag not found"` | Tag doesn't exist or is deleted |
| `409 Conflict` | `"Tag name or slug already exists"` | Duplicate name or slug |

#### Internal Flow

1. Parse and validate UUID path param.
2. Build patch object from provided fields only.
3. If no fields provided → return current tag unchanged.
4. Set `updatedAt` to now.
5. Update in database where `tagId` matches and `deletedAt` is null.
6. If no row returned → throw `404`.
7. If unique constraint violation → throw `409`.
8. Return updated tag.

#### Notes For Frontend Developers

- Sending an empty body `{}` is valid — the current tag is returned without changes.

---

### DELETE `/api/v1/tags/:id`

#### Description

Soft-deletes a tag. The tag is marked with a `deletedAt` timestamp and excluded from all queries.

#### Authentication

**Required** — Bearer access token.

#### Authorization

**`admin` role required.**

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (UUID v4) | Yes | Tag ID |

#### Request Body

None.

#### Response — `200 OK`

```json
{
  "data": {
    "message": "Tag deleted successfully"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

#### Error Responses

| Status | Message | When |
|---|---|---|
| `400 Bad Request` | `"Validation failed (uuid is expected)"` | Invalid UUID format |
| `401 Unauthorized` | Auth error | No/invalid access token |
| `403 Forbidden` | `"You do not have permission..."` | Non-admin user |
| `404 Not Found` | `"Tag not found"` | Tag doesn't exist or already deleted |

#### Internal Flow

1. Parse and validate UUID path param.
2. Look up active (non-deleted) tag by ID.
3. If not found → throw `404`.
4. Set `deletedAt` and `updatedAt` to now.
5. Return success message.

#### Notes For Frontend Developers

- This is a **soft delete**. The tag still exists in the database but is no longer returned by any endpoint.
- Deleting an already-deleted tag returns `404`.
- Quizzes linked to the deleted tag may still reference its ID — handle gracefully in the UI.

---

## TypeScript Interfaces

```typescript
// ============================================================
// REQUEST TYPES
// ============================================================

interface CreateTagRequest {
  /** 1–120 chars. Auto-trimmed. */
  name: string;
  /** Max 120 chars. Lowercase, hyphens allowed. Auto-generated from name if omitted. */
  slug?: string;
}

interface UpdateTagRequest {
  /** 1–120 chars. Auto-trimmed. */
  name?: string;
  /** Max 120 chars. Lowercase, hyphens allowed. */
  slug?: string;
}

interface ListTagsQuery {
  /** Opaque cursor from previous response. */
  cursor?: string;
  /** 1–100. Default: 10. */
  limit?: number;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

interface TagResponse {
  tagId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

interface TagPagination {
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface DeleteTagResponse {
  message: string;
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

type TagApiResponse = ApiResponse<TagResponse>;
type TagListApiResponse = ApiResponse<TagResponse[]>;  // meta.pagination included
type DeleteTagApiResponse = ApiResponse<DeleteTagResponse>;
```

---

## Endpoint Quick Reference

| Method | Path | Auth | Role | Body | Description |
|---|---|---|---|---|---|
| `GET` | `/api/v1/tags` | ❌ | — | — | List tags (paginated) |
| `GET` | `/api/v1/tags/:slug` | ❌ | — | — | Get tag by slug |
| `POST` | `/api/v1/tags` | ✅ Bearer | `admin` | `CreateTagRequest` | Create tag |
| `PATCH` | `/api/v1/tags/:id` | ✅ Bearer | `admin` | `UpdateTagRequest` | Update tag |
| `DELETE` | `/api/v1/tags/:id` | ✅ Bearer | `admin` | — | Soft-delete tag |
