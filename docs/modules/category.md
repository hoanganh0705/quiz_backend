# Category Module — API Documentation

> **Base URL**: `/api/v1/categories`
> **Generated from source**: `src/modules/category/`

---

## Module Overview

| Aspect | Detail |
|---|---|
| **Purpose** | CRUD management for quiz categories |
| **Business responsibility** | Create, list, read, update, and soft-delete categories used to organize quizzes |
| **Transport** | HTTP REST (no WebSocket events) |
| **Global prefix** | `/api/v1` |
| **Controller prefix** | `/categories` |
| **Architecture** | Flat (no layered domain/application split — service handles everything directly) |

### Security Summary

- **Read endpoints** (`GET`) are `@Public()` — no authentication required.
- **Write endpoints** (`POST`, `PATCH`, `DELETE`) require **Bearer access token** + **`admin` role**.
- Authorization is enforced via the `@Roles('admin')` decorator + global `RolesGuard`.

---

## API Endpoints

---

### GET `/api/v1/categories`

#### Description

Lists all active (non-deleted) categories with cursor-based pagination, ordered by `createdAt` descending.

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
      "categoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Science",
      "description": "Questions about physics, chemistry, biology, and more",
      "slug": "science",
      "imageUrl": "https://cdn.example.com/categories/science.png",
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z"
    },
    {
      "categoryId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "History",
      "description": null,
      "slug": "history",
      "imageUrl": null,
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

This endpoint uses **cursor-based pagination**:

1. First request: `GET /api/v1/categories?limit=10`
2. If `hasNextPage` is `true`, use `nextCursor` in the next request: `GET /api/v1/categories?limit=10&cursor=eyJjcmVhdGVk...`
3. Repeat until `hasNextPage` is `false`.

The cursor is an opaque Base64-encoded JSON payload. Do **not** construct or modify it manually.

#### Notes For Frontend Developers

- Items are sorted newest-first (`createdAt DESC`).
- The `nextCursor` is `null` when there are no more pages.

---

### GET `/api/v1/categories/:slug`

#### Description

Retrieves a single active category by its URL-friendly slug.

#### Authentication

**None** — `@Public()` route.

#### Authorization

None.

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `slug` | `string` | Yes | URL-friendly category identifier (e.g., `science`, `pop-culture`) |

#### Response — `200 OK`

```json
{
  "data": {
    "categoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Science",
    "description": "Questions about physics, chemistry, biology, and more",
    "slug": "science",
    "imageUrl": "https://cdn.example.com/categories/science.png",
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
| `400 Bad Request` | `"Category slug cannot be empty"` | Empty slug |
| `400 Bad Request` | `"Category slug must be lowercase..."` | Invalid slug format |
| `404 Not Found` | `"Category not found"` | No active category with that slug |

#### Internal Flow

1. Normalize slug (trim + lowercase).
2. Validate slug format against pattern `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
3. Query database for active (non-deleted) category matching slug.
4. If not found → throw `404`.
5. Return category.

---

### POST `/api/v1/categories`

#### Description

Creates a new category. If no slug is provided, one is auto-generated from the name.

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
  "name": "Science",
  "description": "Questions about physics, chemistry, biology, and more",
  "slug": "science",
  "imageUrl": "https://cdn.example.com/categories/science.png"
}
```

#### Validation Rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | **Yes** | 1–120 chars. Auto-trimmed. |
| `description` | `string \| null` | No | Max 500 chars. Blank strings are normalized to `null`. |
| `slug` | `string` | No | Max 120 chars. Lowercase only. Pattern: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Auto-generated from `name` if omitted. |
| `imageUrl` | `string \| null` | No | Valid URL, max 2048 chars. Blank strings are normalized to `null`. |

#### Response — `200 OK`

```json
{
  "data": {
    "categoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Science",
    "description": "Questions about physics, chemistry, biology, and more",
    "slug": "science",
    "imageUrl": "https://cdn.example.com/categories/science.png",
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
| `409 Conflict` | `"Category name or slug already exists"` | Duplicate name or slug |

#### Internal Flow

1. Trim name.
2. If slug provided → normalize (trim + lowercase + validate pattern). If not → auto-generate from name.
3. Normalize `description` and `imageUrl` (blank → `null`).
4. Insert into database.
5. If unique constraint violation (duplicate name/slug) → throw `409`.
6. Return created category.

#### Notes For Frontend Developers

- The `slug` field is optional. If omitted, the backend generates it by converting the name to lowercase, stripping special characters, and replacing spaces with hyphens (e.g., `"Pop Culture"` → `"pop-culture"`).
- Sending a duplicate name or slug returns `409 Conflict`.

---

### PATCH `/api/v1/categories/:id`

#### Description

Partially updates an existing category. Only provided fields are changed.

#### Authentication

**Required** — Bearer access token.

#### Authorization

**`admin` role required.**

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (UUID v4) | Yes | Category ID |

#### Request Body

All fields are optional. Only include fields you want to change.

```json
{
  "name": "Updated Science",
  "description": "Updated description",
  "slug": "updated-science",
  "imageUrl": "https://cdn.example.com/categories/science-v2.png"
}
```

#### Validation Rules

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | No | 1–120 chars. Auto-trimmed. |
| `description` | `string \| null` | No | Max 500 chars. Blank → `null`. |
| `slug` | `string` | No | Max 120 chars. Lowercase, pattern: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. |
| `imageUrl` | `string \| null` | No | Valid URL, max 2048 chars. Blank → `null`. |

#### Response — `200 OK`

```json
{
  "data": {
    "categoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Updated Science",
    "description": "Updated description",
    "slug": "updated-science",
    "imageUrl": "https://cdn.example.com/categories/science-v2.png",
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
| `404 Not Found` | `"Category not found"` | Category doesn't exist or is deleted |
| `409 Conflict` | `"Category name or slug already exists"` | Duplicate name or slug |

#### Internal Flow

1. Parse and validate UUID path param.
2. Build patch object from provided fields only.
3. If no fields provided → return current category unchanged.
4. Set `updatedAt` to now.
5. Update in database where `categoryId` matches and `deletedAt` is null.
6. If no row returned → throw `404`.
7. If unique constraint violation → throw `409`.
8. Return updated category.

#### Notes For Frontend Developers

- Sending an empty body `{}` is valid — the current category is returned without changes.
- To clear `description` or `imageUrl`, send `null` explicitly: `{ "description": null }`.
- Sending an empty string `""` for nullable fields is equivalent to `null` (auto-normalized).

---

### DELETE `/api/v1/categories/:id`

#### Description

Soft-deletes a category. The category is not physically removed — it is marked with a `deletedAt` timestamp and excluded from all queries.

#### Authentication

**Required** — Bearer access token.

#### Authorization

**`admin` role required.**

#### Path Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` (UUID v4) | Yes | Category ID |

#### Request Body

None.

#### Response — `200 OK`

```json
{
  "data": {
    "message": "Category deleted successfully"
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
| `404 Not Found` | `"Category not found"` | Category doesn't exist or already deleted |

#### Internal Flow

1. Parse and validate UUID path param.
2. Look up active (non-deleted) category by ID.
3. If not found → throw `404`.
4. Set `deletedAt` and `updatedAt` to now.
5. Return success message.

#### Notes For Frontend Developers

- This is a **soft delete**. The category still exists in the database but is no longer visible.
- Deleting an already-deleted category returns `404`.
- Quizzes linked to the deleted category may still reference it — handle gracefully in the UI.

---

## Response Format Convention

All successful responses are wrapped by the global `ResponseFormatInterceptor`:

### Single Item

```json
{
  "data": { ... },
  "meta": { "timestamp": "..." }
}
```

### Paginated List

```json
{
  "data": [ ... ],
  "meta": {
    "timestamp": "...",
    "pagination": {
      "limit": 10,
      "nextCursor": "..." | null,
      "hasNextPage": true | false
    }
  }
}
```

---

## Error Format Convention

Errors follow the global error format:

```json
{
  "data": {
    "statusCode": 404,
    "message": "Category not found",
    "error": "Not Found",
    "requestId": "req-abc123",
    "path": "/api/v1/categories/invalid-slug",
    "method": "GET"
  },
  "meta": {
    "timestamp": "2026-05-25T14:00:00.000Z"
  }
}
```

---

## TypeScript Interfaces

```typescript
// ============================================================
// REQUEST TYPES
// ============================================================

interface CreateCategoryRequest {
  /** 1–120 chars. Auto-trimmed. */
  name: string;
  /** Max 500 chars. Optional. Send null to clear. */
  description?: string | null;
  /** Max 120 chars. Lowercase, hyphens allowed. Auto-generated from name if omitted. */
  slug?: string;
  /** Valid URL, max 2048 chars. Optional. Send null to clear. */
  imageUrl?: string | null;
}

interface UpdateCategoryRequest {
  /** 1–120 chars. Auto-trimmed. */
  name?: string;
  /** Max 500 chars. Send null to clear. */
  description?: string | null;
  /** Max 120 chars. Lowercase, hyphens allowed. */
  slug?: string;
  /** Valid URL, max 2048 chars. Send null to clear. */
  imageUrl?: string | null;
}

interface ListCategoriesQuery {
  /** Opaque cursor from previous response. */
  cursor?: string;
  /** 1–100. Default: 10. */
  limit?: number;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

interface CategoryResponse {
  categoryId: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryPagination {
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface DeleteCategoryResponse {
  message: string;
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

type CategoryApiResponse = ApiResponse<CategoryResponse>;
type CategoryListApiResponse = ApiResponse<CategoryResponse[]>;  // meta.pagination included
type DeleteCategoryApiResponse = ApiResponse<DeleteCategoryResponse>;
```

---

## Endpoint Quick Reference

| Method | Path | Auth | Role | Body | Description |
|---|---|---|---|---|---|
| `GET` | `/api/v1/categories` | ❌ | — | — | List categories (paginated) |
| `GET` | `/api/v1/categories/:slug` | ❌ | — | — | Get category by slug |
| `POST` | `/api/v1/categories` | ✅ Bearer | `admin` | `CreateCategoryRequest` | Create category |
| `PATCH` | `/api/v1/categories/:id` | ✅ Bearer | `admin` | `UpdateCategoryRequest` | Update category |
| `DELETE` | `/api/v1/categories/:id` | ✅ Bearer | `admin` | — | Soft-delete category |
