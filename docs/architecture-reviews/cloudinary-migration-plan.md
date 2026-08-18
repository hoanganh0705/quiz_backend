# Cloudinary Migration Plan — Revised

> **Date:** 2026-08-17
> **Predecessor:** `image-storage-audit.md` (same folder)
> **Scope:** Replace the current Base64-in-PostgreSQL upload path with a server-side Cloudinary upload pipeline, preserving the existing NestJS `domain / application / infrastructure` separation. No source code is modified by this document.

---

## 1. Revised Objective

Move from

```
Next.js ─▶ FileReader.readAsDataURL() ─▶ JSON PATCH ─▶ text column (Base64) ─▶ PostgreSQL
```

to

```
Next.js ─▶ FormData ─▶ NestJS Upload API ─▶ Storage Port ─▶ Cloudinary Adapter ─▶ Cloudinary
                                                                                    │
                                                                                    ▼
                            PATCH /users/me /quizzes/{id} ◀─ { secure_url, public_id } ─ PostgreSQL
```

**In-scope features (must work end-to-end):**
- User avatar upload
- User avatar replacement
- User avatar deletion
- Quiz cover image upload
- Quiz cover image replacement
- Quiz cover image deletion

**Out-of-scope for this revision:**
- Question images (still URL-only — see §2 and §8)
- Category images (still URL-only — admin-controlled)
- Live migration of existing Base64 rows (handled as Phase 7 with a non-destructive strategy)

The application **must NOT** store Base64 image data in PostgreSQL once the new path ships. Any Base64 row that exists at deploy time is migrated per §7.

---

## 2. Re-analysis of the Existing Audit

### MUST CHANGE

| Layer | What | Why |
|---|---|---|
| `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx` | Replace `FileReader.readAsDataURL` flow with FormData + `POST /uploads`. | It is the canonical upload primitive; it must match the new contract. |
| `quiz_frontend/src/features/users/components/settings/AccountSettings.tsx` | Remove the duplicated `AvatarSection` and reuse `<ImageUploadField>`. | Consolidates three near-duplicate implementations. |
| `quiz_backend/src/modules/user/dto/request/update-me.dto.ts` | Stop treating `avatarUrl` as the public-facing write API; introduce an `avatarPublicId` field that the controller resolves to a Cloudinary URL. | Avoids storing user-controlled URLs and lets the server re-derive the URL from `public_id`. |
| `quiz_backend/src/modules/user/application/user.application.service.ts` | Switch `updateProfile` to accept `avatarPublicId` and (optionally) `avatarUrl` for the legacy migration window. | Removes Base64 leakage path. |
| `quiz_backend/src/modules/quiz/dto/request/{create,update}-quiz.dto.ts` | Same: replace `imageUrl` with `imagePublicId`. | Same. |
| `quiz_backend/src/modules/quiz/application/quiz.application.service.ts` | Resolve `imagePublicId` to a Cloudinary URL before persisting. | Keeps the public response payload URL-shaped for backward compatibility. |
| New: `quiz_backend/src/core/storage/` | Introduce the storage abstraction (see §3). | The single most important change — it is what prevents Cloudinary from leaking into the domain. |
| New: `quiz_backend/src/modules/upload/` | New module for the upload endpoint, DTO, validation, controller. | Concentrates upload concerns; no other module needs to know about Cloudinary. |

### SHOULD CHANGE

| Layer | What | Why |
|---|---|---|
| `user_profiles`, `quizzes` tables | Add `avatar_public_id text` and `image_public_id text` columns. | The DB metadata that lets the server re-derive the URL. |
| `quiz_frontend/next.config.ts` | Add `res.cloudinary.com` to `images.remotePatterns`. | So `next/image` can optimise Cloudinary-hosted images. |
| `quiz_backend/src/main.ts` | Explicitly raise `bodyParser` JSON limit (now that we are not carrying Base64 in JSON, JSON payloads shrink, but the limit should still be explicit). | Removes the silent 100 KB cap and makes the cap operator-visible. |
| `.env.example` | Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER=quiz-app`. | Required for the adapter to boot. |
| `quiz_frontend/src/features/users/components/my-profile/EditProfileForm.tsx` | Switch to the new `<ImageUploadField>` API. | Currently calls `updateProfile.mutate({ avatarUrl: dataUrl })`. |

### OPTIONAL / FUTURE

| Layer | What | Why |
|---|---|---|
| `quiz_questions.image_url` | Convert to a Cloudinary upload field with the same `POST /uploads` endpoint. | Defer — the question editor currently only accepts pasted URLs. Out-of-scope for this revision. |
| `categories.image_url` | Same. | Out-of-scope; admin-controlled, currently URL-only. |
| Background cleanup job for orphaned Cloudinary assets | A periodic sweep that deletes `public_id`s no longer referenced by any row. | Useful for production. Not needed at MVP scale; Cloudinary's free tier can absorb a few hundred orphans. |
| `quiz_frontend/src/features/users/components/my-profile/ProfileHeader.tsx` | Either wire `onAvatarChange` / `onCoverChange` to the new upload pipeline, or delete. | Currently dead UI — clean it up in §8. |
| `quiz_frontend/src/features/support/components/ContactForm.tsx` attachment | Same. | Dead UI — clean it up in §8. |
| Direct browser → Cloudinary unsigned uploads | Bypasses the backend entirely. | Faster, but loses server-side validation and gives up the audit trail. Not recommended for this project. |

### Components / APIs to PRESERVE

| Existing | Why preserve |
|---|---|
| `PATCH /api/v1/users/me` (auth + permissions) | The user still updates their profile through this endpoint; only the avatar payload changes. |
| `POST /api/v1/quizzes`, `PATCH /api/v1/quizzes/:id` | Same — the cover image is just one field on a larger payload. |
| `user_profiles.avatar_url`, `quizzes.image_url` (the columns themselves) | We KEEP them for backward compatibility with seed data and external Unsplash URLs. We ADD `*_public_id` alongside. See §6. |
| The `userSummary.bgImageUrl` field on the response DTO | Returned as URL — still works because the server now resolves `public_id → secure_url`. |
| The NestJS `domain / application / infrastructure / dto / transport` module layout | All new code follows it. |
| The global `ThrottlerGuard`, `JwtGuard`, `PermissionsGuard` | All upload endpoints live behind them. |

### Components / APIs to REMOVE (dead/orphan)

| Component / code path | Action |
|---|---|
| `AccountSettings.tsx` `AvatarSection` local `FileReader.readAsDataURL` flow | REMOVE — replaced by `<ImageUploadField>`. |
| `ProfileHeader.tsx` `validateFile`, hidden `<input type="file">` x2, `handleAvatarChange`, `handleCoverChange` | REMOVE — the component has no consumer that wires callbacks. |
| `ContactForm.tsx` `<input type="file">` and `selectedFile` state | REMOVE — file is never submitted. |
| `ImageUploadField.tsx` `reader.readAsDataURL(file)` + `field.onChange(result)` branch | REMOVE — replaced by `FormData` + service call. |

---

## 3. Cloudinary Architecture

### Recommended layout (matches existing `core/*` convention)

```
quiz_backend/src/
├── core/
│   └── storage/                          ← new module — the abstraction
│       ├── storage.module.ts             ← global module exporting STORAGE_PORT
│       ├── storage.port.ts               ← interface (the Port)
│       ├── storage.types.ts              ← shared types (UploadInput, UploadResult, …)
│       └── infrastructure/               ← adapter implementations live here
│           └── cloudinary/
│               ├── cloudinary.module.ts  ← provides CLOUDINARY_STORAGE_ADAPTER
│               ├── cloudinary.config.ts  ← provider factory (reads env)
│               └── cloudinary.adapter.ts ← the Adapter
├── modules/
│   └── upload/                           ← new bounded module
│       ├── upload.module.ts
│       ├── transport/
│       │   └── controller/
│       │       └── upload.controller.ts  ← POST /api/v1/uploads
│       ├── application/
│       │   └── upload.application.service.ts
│       ├── domain/
│       │   ├── upload-purpose.enum.ts
│       │   └── upload-policy.ts          ← per-purpose limits (size, MIME, folder)
│       ├── dto/
│       │   └── request/
│       │       └── upload-file.dto.ts    ← purpose field
│       └── infrastructure/
│           └── (none — delegates to core/storage)
```

### Responsibilities, layer by layer

| Layer | Knows about | Does NOT know about |
|---|---|---|
| Browser | FormData, the upload endpoint URL, the response shape | Cloudinary SDK, API secret, file system |
| `UploadController` | HTTP, `Multer` (or `ParseFilePipe`), `UploadApplicationService` | Cloudinary SDK, env vars |
| `UploadApplicationService` | `UploadPolicy`, `STORAGE_PORT`, the entity update API | Cloudinary SDK, HTTP, multer |
| `StoragePort` (interface) | Generic upload/delete/deriveUrl contract | Cloudinary |
| `CloudinaryStorageAdapter` | The Cloudinary Node SDK (`cloudinary` v2), env config, the folder map | HTTP layer, NestJS DI, the entity update API |
| Cloudinary (SaaS) | Bytes, transformations | The application |

### Dependency rule (Hexagonal)

```
upload.controller  →  upload.application.service  →  STORAGE_PORT
                                                       ▲
                                                       │ implements
                                                       │
                                          CloudinaryStorageAdapter
```

The domain (`quiz`, `user`) imports only `STORAGE_PORT` for `deriveUrl(publicId)`. It never imports the Cloudinary SDK. Cloudinary SDK code lives exclusively in `core/storage/infrastructure/cloudinary/`.

---

## 4. Upload API Design

### Endpoint

```
POST /api/v1/uploads
```

`multipart/form-data` with two fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | yes | The image bytes. Max size and MIME validated server-side. |
| `purpose` | string (enum) | yes | One of: `avatar`, `quiz`. (See below.) |

`purpose` values intentionally limited to what this revision ships:

| `purpose` | Server folder | Max bytes | Allowed MIME | Default transform |
|---|---|---|---|---|
| `avatar` | `quiz-app/avatars` | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | `w_512,h_512,c_fill,g_auto,q_auto,f_auto` |
| `quiz` | `quiz-app/quizzes` | 8 MB | `image/jpeg`, `image/png`, `image/webp` | `w_1600,h_900,c_fill,g_auto,q_auto,f_auto` |

> `question` and `category` are intentionally excluded because the frontend never opens a file picker for them in the current codebase. The enum is extensible later.

### Successful response (201 Created)

```jsonc
{
  "publicId": "quiz-app/avatars/0190b1c2-uuid-7f-aaaa-bbbbbbbbbbbb",
  "url": "https://res.cloudinary.com/<cloud_name>/image/upload/w_512,h_512,c_fill,g_auto,q_auto,f_auto/quiz-app/avatars/0190b1c2-uuid-7f-aaaa-bbbbbbbbbbbb",
  "bytes": 245103,
  "format": "webp",
  "width": 1024,
  "height": 1024
}
```

Notes on the response shape:
- `publicId` is **opaque to the client** — it is the only thing the client must echo back when patching the entity.
- `url` is the URL the client uses to render the image immediately (e.g. for preview). It is **not** stored anywhere by the frontend; the backend re-derives it from `publicId` on every response.
- `bytes`, `format`, `width`, `height` are returned for telemetry; the client ignores them.

### Error responses

| HTTP | When |
|---|---|
| 400 `GLOBAL_VALIDATION` | Missing `purpose`, missing `file`, or wrong content-type. |
| 400 `UPLOAD_FILE_TOO_LARGE` | Bytes > per-purpose limit. |
| 400 `UPLOAD_UNSUPPORTED_MEDIA_TYPE` | MIME not in allowlist. |
| 400 `UPLOAD_INVALID_PURPOSE` | `purpose` not in enum. |
| 401 / 403 | Standard auth / permissions. |
| 429 `GLOBAL_RATE_LIMITED` | Per-user throttler. |
| 502 `UPLOAD_PROVIDER_UNAVAILABLE` | Cloudinary SDK call failed (network, 5xx). |
| 502 `UPLOAD_PROVIDER_REJECTED` | Cloudinary rejected the upload (e.g. corrupt bytes). |
| 500 `UPLOAD_OWNERSHIP_BIND_FAILED` | The Cloudinary upload succeeded but the row in `storage_assets` could not be written. The asset is then deleted (best-effort) so the response shape stays consistent. |

### Asset-association error responses (returned by `PATCH /users/me` and `PATCH /quizzes/:id`)

| HTTP | When |
|---|---|
| 400 `ASSET_PUBLIC_ID_INVALID` | `publicId` is not a string or does not match the `quiz-app/<folder>/<userId>/<uuidv7>` shape. |
| 403 `ASSET_NOT_OWNED` | The `storage_assets` row for that `publicId` has a different `owner_id` than the authenticated user. Same response if the row is missing entirely (treat "I never uploaded this" and "this belongs to someone else" identically to avoid an oracle). |

### Auth, authz, rate limit

- **Authentication:** required (existing `JwtGuard`). The `Authorization: Bearer <access_token>` header is the only authentication mechanism; the `file` field carries no credentials.
- **Authorization:** any authenticated user can upload an `avatar` or a `quiz` cover. **The upload response is bound to the caller at upload time** — the controller calls `StorageApplicationService.bindAssetToOwner({ publicId, ownerId: currentUser.sub, purpose })`, which writes a row into `storage_assets` (see §6). The `publicId` returned to the browser is the only token that can later be associated with an entity, and the row in `storage_assets` is the source of truth that proves ownership.
- **Rate limit:** `@Throttle({ default: { limit: 20, ttl: 60_000 } })` per user — i.e. 20 uploads/minute. On top of the global 100 req/60s limit.

### Validation pipeline

1. `ParseFilePipe` with `FileTypeValidator` (whitelist) and `MaxFileSizeValidator` (per-purpose bytes) — handles malformed multipart and size cap.
2. `UploadApplicationService` enforces per-purpose MIME allowlist and runs `UploadPolicy.canAccept(purpose, mimetype, bytes)` for the per-purpose folder + size + transform lookup.
3. The Cloudinary SDK call is the final gate (Cloudinary re-checks MIME by inspecting magic bytes).

### Filename and Public ID strategy

- The browser's `originalname` is **ignored** (security: path traversal, encoded payloads).
- `public_id` is generated by the adapter as:
  ```
  quiz-app/<folder>/<userId>/<uuidv7>
  ```
  e.g. `quiz-app/avatars/0190b1a0-…-user/0190b1c2-7f3a-7aaa-bbbb-cccccccccccc`.
- `userId` is the authenticated caller's UUIDv7 (from `currentUser.sub`); it is **never** read from the request body or any other client-controlled source.
- `uuidv7` is the project's existing identifier flavour (see `quiz_backend/src/core/database/schema/user/schema.ts` and `quiz/schema.ts` — every primary key uses `uuidv7()`). Reusing it keeps the project consistent.
- This guarantees:
  - **No collisions** (UUIDv7 = 128-bit randomness).
  - **No user-controlled data** in the public_id (no filename leaks).
  - **No special characters** (Cloudinary public_ids cannot contain `/`, `?`, `#`, `&`, or start with `-`).
  - **Reversible purpose** — `public_id.startsWith('quiz-app/avatars/')` is enough to know the asset is an avatar.
  - **Reversible owner** — the segment between the folder and the final UUIDv7 is the `userId` that uploaded it. This is a structural defence-in-depth, **not** the authoritative check: ownership is still decided by the `storage_assets` row (see §6), so a client forging or guessing a `public_id` that begins with another user's id is still rejected.

### Cloudinary folder map

| `purpose` | Folder |
|---|---|
| `avatar` | `quiz-app/avatars` |
| `quiz` | `quiz-app/quizzes` |

Folders are configured in `UploadPolicy` (single source of truth) and consumed by the adapter. Adding a new purpose requires a single edit to `UploadPolicy` + adding the case to the enum.

### Overwrite vs version

Cloudinary is configured for **new asset on every upload** (`invalidate: true`, no `overwrite` flag). Each upload produces a fresh `public_id`. Old assets are deleted in §10 lifecycle.

---

## 5. Cloudinary Storage Design

### Folder tree

```
quiz-app/
├── avatars/                  ← user avatars (UUIDv7)
│   └── 0190b1c2-…
└── quizzes/                  ← quiz cover images (UUIDv7)
    └── 0190c4d8-…
```

Future-proofing:

```
quiz-app/
├── avatars/
├── quizzes/
├── questions/      ← reserved for the future question-image feature
└── categories/      ← reserved for the future category-image feature
```

Reserve the folders now so we don't have to migrate later. The application does not write to them yet.

### Naming rules

| Rule | Reason |
|---|---|
| UUIDv7 only | Collision-free, time-sortable, opaque |
| No user-supplied bytes in `public_id` | Prevents path traversal and special-character bugs |
| Lowercase, hyphens only | Cloudinary constraint |
| Always under a folder prefix | Lets us restrict deletion by prefix and compute total storage per purpose |

### Overwrite behaviour

Cloudinary's `upload` API defaults to overwriting if `public_id` collides. We **never set** `public_id` to a value that already exists (UUIDv7), so collisions are statistically impossible. The adapter calls `cloudinary.uploader.upload(buffer, { public_id, folder, overwrite: false })` to be defensive.

### Deletion

The adapter calls `cloudinary.uploader.destroy(publicId)`. Cloudinary returns `{ result: 'ok' | 'not found' }`. We treat `not found` as success (idempotent delete). All deletes go through the adapter; the application layer never holds raw Cloudinary SDK calls.

---

## 6. Database Design

### Current state (verified in the audit)

| Table | Column | Type |
|---|---|---|
| `user_profiles` | `avatar_url` | `text` |
| `quizzes` | `image_url` | `text` |
| `quiz_questions` | `image_url` | `text` |
| `categories` | `image_url` | `text` |

### Recommended addition

| Table | New column | Type | Nullable | Notes |
|---|---|---|---|---|
| `user_profiles` | `avatar_public_id` | `text` | yes | Set when the avatar is Cloudinary-hosted. |
| `quizzes` | `image_public_id` | `text` | yes | Set when the cover is Cloudinary-hosted. |
| `quiz_questions` | `image_public_id` | `text` | yes | Reserved (out of scope; column added for forward-compatibility). |
| `categories` | `image_public_id` | `text` | yes | Reserved. |

We deliberately do **not** touch `quiz_questions` or `categories` from the application yet — adding the column is cheap and unlocks the future Phase (see §2). We **do** write to `avatar_public_id` and `image_public_id` from this revision onward.

### Required addition — `storage_assets` (ownership ground truth)

A single new table records the binding between a Cloudinary `public_id` and its owner. This is the authoritative source the application consults before accepting any `avatarPublicId` / `imagePublicId`. Without it, the server has no way to prove that a `publicId` submitted by User B actually belongs to User B; with it, the check is one indexed lookup.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` (`uuidv7()` default) | no | PK. |
| `public_id` | `text` | no | The Cloudinary `public_id` (e.g. `quiz-app/avatars/<userId>/<uuidv7>`). **Unique**. |
| `owner_id` | `uuid` | no | The `user_id` that uploaded it (FK → `users.id`). |
| `purpose` | `text` | no | One of `avatar`, `quiz`. Mirrors the upload `purpose` so future assertions can verify `purpose` matches the entity (e.g. an `avatar` asset cannot be assigned to a quiz). |
| `created_at` | `timestamptz` | no | Default `now()`. |

Indexes:
- `UNIQUE (public_id)` — also implicitly indexes lookups by `public_id`, which is the entire point of the table.
- `INDEX (owner_id)` — supports future orphan-cleanup queries ("assets owned by a deleted user") and the per-user asset listing used in tests.

Why a dedicated table rather than piggy-backing on `user_profiles.avatar_public_id`:
- An asset is owned the moment it is uploaded, **before** the user associates it with any entity.
- A quiz may be created from a previously uploaded asset (or vice-versa); the owner of the asset is the user who uploaded it, not the quiz creator if those differ.
- A user may upload several assets in a session and only associate one — the others must still be owned (and deletable) by them.
- The 4 columns above are the minimum needed to answer "is `publicId` owned by `userId` and compatible with `purpose`?" — adding this is far cheaper than threading ownership through every entity table.

Lifecycle on the row:
- **Created** in `UploadApplicationService.uploadAvatarOrQuizCover`, in the same DB transaction that wraps the Cloudinary upload. Failure to insert the row triggers `502 UPLOAD_OWNERSHIP_BIND_FAILED` and a best-effort Cloudinary `destroy(publicId)`.
- **Never updated** — `owner_id` is immutable for the row's lifetime. If a user "transfers" an asset, the row stays put; the receiving user simply re-uploads.
- **Deleted** when the asset is deleted from Cloudinary (`ImageLifecycleService.delete`), in the same transaction. Cascade is explicit (not FK-cascaded) so we never silently lose the row when an entity table is migrated.

The Cloudinary `public_id` structurally encodes `owner_id` (see §4) as defence-in-depth, but the row in `storage_assets` is the source of truth. A user who forges or guesses another user's `public_id` is rejected by the row lookup, not by string parsing.

### Two options considered

**Option A — Store both URL and public_id**

```sql
avatar_url         text  -- URL as currently returned
avatar_public_id   text  -- new
```

Pros: zero work to update existing readers; the response shape does not change. Cons: redundant storage; the URL can drift if Cloudinary's transform params change; the DB now has two columns to keep in sync.

**Option B — Store only public_id; derive the URL**

```sql
avatar_public_id   text
-- avatar_url       text  -- DROPPED
```

Pros: single source of truth; URL changes (e.g. switching from `c_fill` to `c_lfill`) require zero migrations; storage column count shrinks. Cons: every reader path needs to call `STORAGE_PORT.deriveUrl(publicId)`; existing seed data (Unsplash URLs) needs a fallback column; the response DTO shape must include a `null` when no avatar is set.

### Recommendation: **Option A for now, Option B as Phase 8 cleanup**

Keep `avatar_url` and `image_url` columns. Add `avatar_public_id` and `image_public_id` alongside. Application logic prefers the public_id:

1. If `*_public_id` is set → call `STORAGE_PORT.deriveUrl(public_id)` to compute the response URL.
2. Else, fall back to the existing `*_url` column (handles seed/external URLs and the migration window).

Phase 8 (after we have observed production behaviour) drops the URL column and forces the derivation path. This keeps the initial migration risk-free.

---

## 7. Existing Image Migration

The current production database may contain a mix of:

- **A. Existing Base64 images** (rows where `*_url` starts with `data:`)
- **B. Existing external URLs** (Unsplash CDN; any other allowed host)
- **C. Seed/static images** (the rows that the seed script inserts at boot)

### Strategy per category

| Category | Strategy | Why |
|---|---|---|
| **A. Base64** | **Discard on entity update; migrate-on-write.** When a user next updates their profile / quiz and the field currently holds a Base64 value, treat it as "no image" and let them upload fresh. Do not attempt server-side Base64 → Cloudinary re-upload. | (1) Migrating Base64 server-side requires building a parallel pipeline (Cloudinary SDK upload with a base64 data URI), which adds complexity for a path we are about to deprecate. (2) Re-uploading user content the user already replaced with a new file is fine — but silently re-uploading the old Base64 blob and pinning the user to a stale image is worse UX than letting the next save clear it. (3) It avoids a one-shot mass migration that touches every row. |
| **B. External URLs** | **Keep as-is.** They continue to render through the existing `image_url` fallback path. No Cloudinary round-trip. | The DB already stores them as URLs; the response code keeps returning them. Cloudinary is opt-in per entity. |
| **C. Seed/static images** | **Keep as-is.** They are written by the seed script; they will continue to flow through the URL fallback. | Same rationale as (B). |

### Migration safety

This strategy is **non-destructive**:
- No row is updated by the migration script.
- No Cloudinary asset is created during the migration.
- A user with a Base64 avatar continues to see their avatar until they next edit their profile.

The only "destructive" event is the user's own save, which writes either a fresh `public_id` (the typical case) or `null` (the "Remove photo" button). The original Base64 blob is then GC'd by the row update.

A separate optional cleanup script (out of scope for this revision) could enumerate Base64 rows and delete them; not recommended without product approval.

---

## 8. Frontend Refactor

### Current upload UIs

| Component | Status | Action |
|---|---|---|
| `ImageUploadField` (`components/primitives/form/ImageUploadField.tsx`) | Canonical primitive; uses `FileReader.readAsDataURL` and writes the data URL into the form. | **REFACTOR** — keep the component, swap the implementation. |
| `AccountSettings.AvatarSection` (`features/users/components/settings/AccountSettings.tsx:64-162`) | Duplicates the upload logic with an `alert()` for size errors. | **REMOVE** — collapse into `<ImageUploadField>`. |
| `EditProfileForm` (`features/users/components/my-profile/EditProfileForm.tsx:167-171`) | Already uses `<ImageUploadField name="avatarUrl">` with the audit-flagged `reader.onload` flow. | **REFACTOR** — pass the new `onUpload` callback. |
| `CreateQuizForm` (`features/quizzes/components/CreateQuizForm.tsx:143-147`) | Same. | **REFACTOR**. |
| `ProfileHeader` (`features/users/components/my-profile/ProfileHeader.tsx`) | Dead code: `<input type="file">` x2 + `validateFile` + `handleAvatarChange` / `handleCoverChange` that no consumer wires up. | **REMOVE** the file-input + handlers; keep the cover-image surface but read it from the user-summary bundle as today. |
| `ContactForm` (`features/support/components/ContactForm.tsx`) | Dead `<input type="file">` that captures a `File` but never sends it. | **REMOVE** the file input + `selectedFile` state. |
| `SingleQuestionForm` (`features/quizzes/components/QuestionEditor/SingleQuestionForm.tsx:275-283`) | Plain text input for `imageUrl`. | **KEEP** — out of scope for this revision (URL-only field, per audit §2). |
| `BulkQuestionForm` (`features/quizzes/components/QuestionEditor/BulkQuestionForm.tsx`) | Same. | **KEEP**. |

### New `<ImageUploadField>` API

```tsx
<ImageUploadField
  name="avatarPublicId"           // the form field name (now a public_id)
  label="Profile Picture"
  description="JPEG, PNG, WebP, or GIF. Max 5 MB."
  purpose="avatar"                // NEW: drives backend folder/size/MIME
  onUpload={async (publicId) => { /* optional optimistic update */ }}
/>
```

Internal flow:

```
<input type="file">
  → client-side validate (MIME, size)
  → show local preview (ObjectURL → revoked on unmount)
  → setFieldValue(name, publicId) once upload succeeds
```

The component is **upload-aware**: when the user picks a file, the component (a) immediately POSTs `multipart/form-data` to `/api/v1/uploads`, (b) waits for the `{ publicId, url }` response, (c) writes the `publicId` into the form. If the user clears the field, the component (d) tells the backend to delete the asset (see §10).

### New SDK / service module

```
quiz_frontend/src/features/uploads/
├── services/
│   └── upload.service.ts          ← calls POST /api/v1/uploads
└── hooks/
    └── useUpload.ts               ← SWR-mutate wrapper with progress + retry
```

`upload.service.ts`:

```ts
export interface UploadResult {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
  width: number;
  height: number;
}

export async function uploadImage(
  purpose: 'avatar' | 'quiz',
  file: File,
  signal?: AbortSignal,
): Promise<UploadResult>;
```

The hook returns `{ upload, isUploading, progress, error, reset }`. It uses `axios` (already in deps) with `onUploadProgress` for the progress bar.

### Form-state shape change

| Field | Was | Now |
|---|---|---|
| `EditProfileForm` form | `avatarUrl: string \| null` | `avatarPublicId: string \| null` |
| `CreateQuizForm` form | `imageUrl: string \| null` | `imagePublicId: string \| null` |

The render path uses `user.avatarUrl ?? null` to display, where `user.avatarUrl` is still returned by the backend (now derived from `avatarPublicId` when set; falls back to the legacy column).

### Generated SDK / Orval config

The generated endpoint at `/lib/api/generated/uploads/uploads.ts` is **new**; the existing `users/users.ts` and `quizzes/quizzes.ts` keep their current `avatarUrl` / `imageUrl` shape (now read-only). The frontend never sets `avatarUrl` directly any more.

---

## 9. Backend Refactor

### New module: `core/storage/`

```
core/storage/storage.module.ts
core/storage/storage.port.ts          ← @Injectable() abstract class or symbol
core/storage/storage.types.ts
core/storage/infrastructure/cloudinary/
core/storage/infrastructure/cloudinary/cloudinary.module.ts
core/storage/infrastructure/cloudinary/cloudinary.config.ts
core/storage/infrastructure/cloudinary/cloudinary.adapter.ts
```

#### `storage.port.ts`

```ts
export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadInput {
  buffer: Buffer;
  mime: string;
  bytes: number;
  purpose: 'avatar' | 'quiz';
  ownerId: string;          // NEW: required by the adapter to compose public_id
}

export interface UploadResult {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
  width: number;
  height: number;
}

export interface StoragePort {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
  deriveUrl(publicId: string, purpose: 'avatar' | 'quiz'): string;
}
```

#### `cloudinary.adapter.ts`

- Imports `cloudinary` v2 from the SDK.
- Uses `cloudinary.config({ cloud_name, api_key, api_secret })` set in `cloudinary.config.ts`.
- Composes `public_id` as `` `${UPLOAD_POLICY[purpose].folder}/${ownerId}/${uuidv7()}` `` — `ownerId` is sourced from the application service, never from the request body (see §4).
- Calls `cloudinary.uploader.upload_stream({ public_id, folder, resource_type: 'image', overwrite: false }, cb)`.
- Maps Cloudinary's response into our `UploadResult`.
- Implements `deriveUrl` as `cloudinary.url(publicId, { secure: true, transformation: TRANSFORMS[purpose] })`.

#### `cloudinary.config.ts`

A NestJS provider that reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from `ConfigService`, calls `cloudinary.config(...)` once at module init, and exposes the configured instance as a Nest provider.

### New module: `modules/upload/`

#### DTOs (`dto/request/upload-file.dto.ts`)

```ts
export class UploadFileDto {
  @ApiProperty({ enum: ['avatar', 'quiz'] })
  @IsIn(['avatar', 'quiz'])
  purpose!: 'avatar' | 'quiz';
}
```

The `file` field is not in the DTO — `ParseFilePipe` injects it as a `Multer.File`-shaped argument.

#### Domain (`domain/upload-policy.ts`)

```ts
export const UPLOAD_POLICY: Record<UploadPurpose, {
  folder: string;
  maxBytes: number;
  allowedMime: ReadonlySet<string>;
  transformation: ReadonlyArray<Record<string, unknown>>;
}> = {
  avatar: {
    folder: 'quiz-app/avatars',
    maxBytes: 5 * 1024 * 1024,
    allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' }],
  },
  quiz: {
    folder: 'quiz-app/quizzes',
    maxBytes: 8 * 1024 * 1024,
    allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp']),
    transformation: [{ width: 1600, height: 900, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' }],
  },
};
```

#### Application (`application/upload.application.service.ts`)

```ts
@Injectable()
export class UploadApplicationService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly ownership: StorageApplicationService,  // see below
  ) {}

  async uploadAvatarOrQuizCover(
    userId: string,
    purpose: 'avatar' | 'quiz',
    file: Multer.File,
  ): Promise<UploadResult> {
    const policy = UPLOAD_POLICY[purpose];
    if (!policy.allowedMime.has(file.mimetype)) throw new UnsupportedMediaTypeException(...);
    if (file.size > policy.maxBytes) throw new PayloadTooLargeException(...);

    // 1. Upload to Cloudinary with a public_id that structurally encodes the owner
    const result = await this.storage.upload({
      buffer: file.buffer,
      mime: file.mimetype,
      bytes: file.size,
      purpose,
      ownerId: userId,
    });

    // 2. Bind the result to the user in the storage_assets table.
    //    If this fails, the asset is an orphan and is best-effort deleted
    //    so the response shape stays consistent with §4 (502 UPLOAD_OWNERSHIP_BIND_FAILED).
    try {
      await this.ownership.bindAssetToOwner({
        publicId: result.publicId,
        ownerId: userId,
        purpose,
      });
    } catch (err) {
      await this.storage.delete(result.publicId).catch(() => undefined);  // best-effort
      throw new InternalServerErrorException({
        code: 'UPLOAD_OWNERSHIP_BIND_FAILED',
        message: 'Uploaded asset could not be bound to its owner; please retry.',
      });
    }

    return result;
  }
}
```

#### New: `modules/storage/` — ownership lookup service (`application/storage.application.service.ts`)

A thin service that owns all reads of `storage_assets`. Keeping this as a separate application service — not on `STORAGE_PORT` — enforces the layering rule that the storage Port only knows Cloudinary-side concerns, not the database.

```ts
@Injectable()
export class StorageApplicationService {
  constructor(
    @Inject(STORAGE_ASSETS_REPOSITORY)
    private readonly assets: StorageAssetsRepository,
  ) {}

  /** Insert the binding row for a freshly uploaded asset. */
  async bindAssetToOwner(input: {
    publicId: string;
    ownerId: string;
    purpose: 'avatar' | 'quiz';
  }): Promise<void> {
    await this.assets.insert(input);  // throws on UNIQUE conflict — caller's problem
  }

  /**
   * Authoritative ownership check. Returns true iff a row exists with the
   * given publicId, owner_id, AND matching purpose. Missing row is treated
   * identically to "owned by someone else" — see the §11 authorization rule.
   */
  async userOwnsAssetForPurpose(input: {
    publicId: string;
    userId: string;
    purpose: 'avatar' | 'quiz';
  }): Promise<boolean> {
    return this.assets.existsByPublicIdOwnerAndPurpose(input);
  }

  /** Delete the binding row when the underlying Cloudinary asset is deleted. */
  async unbindAsset(publicId: string): Promise<void> {
    await this.assets.deleteByPublicId(publicId);
  }
}
```

The repository (`infrastructure/repositories/storage-assets.repository.ts`) is a Drizzle implementation of three small queries: `insert`, `existsByPublicIdOwnerAndPurpose`, `deleteByPublicId`.

#### Module wiring (`upload.module.ts`)

```ts
@Module({
  imports: [
    StorageModule,                  // provides STORAGE_PORT and the assets repository
  ],
  controllers: [UploadController],
  providers: [
    UploadApplicationService,
    StorageApplicationService,      // registers the bind/lookup/unbind service
  ],
})
export class UploadModule {}
```

#### Controller (`transport/controller/upload.controller.ts`)

```ts
@ApiTags('AuthUser')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadApp: UploadApplicationService) {}

  @Post()
  @ApiAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  }))
  async upload(
    @UploadedFile(...)
    file: Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() currentUser: JwtUser,
  ): Promise<UploadResult> {
    return this.uploadApp.uploadAvatarOrQuizCover(currentUser.sub, dto.purpose, file);
  }
}
```

> Notes on Multer: `multer` is added as a project dependency in this revision (it is currently transitive only). It runs in `memoryStorage` only — bytes never touch disk. `memoryStorage` is required for `cloudinary.uploader.upload_stream` and for the magic-byte inspection we add for security (§11).

#### `main.ts` change

```ts
app.use(express.json({ limit: '1mb' }));  // explicit, no longer carrying Base64
// multipart body is parsed per-controller via FileInterceptor — no global change needed.
```

### Touch-ups in user / quiz modules

| File | Change |
|---|---|
| `modules/user/application/user.application.service.ts` | Accept `avatarPublicId: string \| null` instead of `avatarUrl`. **Before any DB write, call `StorageApplicationService.userOwnsAssetForPurpose({ publicId, userId: currentUser.sub, purpose: 'avatar' })`. If false, throw `ForbiddenException` with code `ASSET_NOT_OWNED`.** When persisting, resolve to URL through `STORAGE_PORT.deriveUrl(publicId, 'avatar')` for `avatar_url` (Option A). Fall back to existing column when `publicId` is null. |
| `modules/user/domain/user.service.ts` | Domain layer: introduce an `AvatarRef` value object that wraps `(publicId: string \| null, fallbackUrl: string \| null)`. |
| `modules/user/dto/request/update-me.dto.ts` | Replace `avatarUrl` with `avatarPublicId`. **Add a `publicId` format validator** that checks the structural shape `^quiz-app/(avatars\|quizzes)/<uuidv7>/<uuidv7>$` so malformed strings fail fast with `400 ASSET_PUBLIC_ID_INVALID`. Deprecate `avatarUrl` (still accepted during the migration window; emits a `Deprecation` response header). |
| `modules/quiz/application/quiz.application.service.ts` | Same ownership-assertion pattern with `purpose: 'quiz'`. `userOwnsAssetForPurpose` is called with the authenticated user; the existing `QUIZ_EDIT_OWN` check still gates *which quiz* the user can edit, while the asset check gates *which image* they can attach to it. |
| `modules/quiz/dto/request/{create,update}-quiz.dto.ts` | Same structural validator. |
| `modules/user/infrastructure/repositories/user.repository.ts` | Add `avatarPublicId` to the `UPDATE user_profiles SET` call. |
| `modules/quiz/infrastructure/repositories/quiz.repository.ts` | Add `imagePublicId` to the `UPDATE quizzes SET` call. |
| `modules/quiz/transport/controller/quiz.controller.ts` | When updating an existing quiz with a new `imagePublicId`, fire-and-forget `STORAGE_PORT.delete(oldPublicId)` (best-effort; see §10). |

### Why the PATCH-time check is sufficient for quiz covers (no quiz ID required at upload time)

A user uploading an asset before a quiz exists gets back a `publicId` whose `storage_assets` row records `owner_id = <that user>` and `purpose = 'quiz'`. When the user later `POST /api/v1/quizzes` (or `PATCH /api/v1/quizzes/:id`) with that `imagePublicId`, the application service runs `userOwnsAssetForPurpose({ publicId, userId, purpose: 'quiz' })`. The check has nothing to do with the quiz id — it only verifies that the *caller* uploaded this asset for the *quiz* purpose. No two-step "first create the quiz, then attach an image" mechanism is needed; the upload is owner-bound the moment it leaves `POST /api/v1/uploads`.

This is the key reason the chosen model is a single `storage_assets` table rather than a folder-encoded owner: the lookup is `(public_id, owner_id, purpose)` against an indexed unique key, which is one query regardless of whether the entity has been created yet.

### Domain dependency rule

```
UserDomainService  ──▶  STORAGE_PORT            (allowed)
                      CloudinaryStorageAdapter (FORBIDDEN)
```

We enforce this by code review + ESLint `no-restricted-imports` for `core/storage/infrastructure/cloudinary/*` outside the storage module.

### Lifecycle hook

A small `ImageLifecycleService` (in `core/storage/`) wraps `STORAGE_PORT.delete` with retry + best-effort logging, and also removes the corresponding `storage_assets` row so the table does not accumulate dead references. Application modules do not call the port's `delete` directly. Used by:

- Avatar removal: `PATCH /users/me { avatarPublicId: null }` → application service loads old `avatarPublicId` → resolves the delete → fires.
- Quiz cover replacement: same pattern in `QuizApplicationService.updateQuiz`.
- Quiz deletion: cascade currently handled by DB FK; the `QuizApplicationService.deleteQuiz` additionally calls `ImageLifecycleService.delete(oldPublicId)` before issuing the DELETE.

The lifecycle hook's "delete" sequence is:

1. `await STORAGE_PORT.delete(publicId)` (idempotent; `not found` is success).
2. `await StorageApplicationService.unbindAsset(publicId)` (idempotent; missing row is success).
3. On (1) success + (2) failure: log WARN and retry once; final failure is logged for manual cleanup. The orphan row in `storage_assets` does not affect authorization correctness — it only inflates the table.

---

## 10. Image Lifecycle

### Upload

```
Browser picks file
  → client-side validation (MIME, size)
  → POST /api/v1/uploads { file, purpose }     (Authorization: Bearer <jwt>)
       → UploadController
            → UploadApplicationService.uploadAvatarOrQuizCover(userId, purpose, file)
                 → STORAGE_PORT.upload({ ..., ownerId: userId })
                      → CloudinaryStorageAdapter composes public_id = folder/<userId>/<uuidv7>
                      → Cloudinary returns { public_id, secure_url, bytes, format, width, height }
                 → StorageApplicationService.bindAssetToOwner({ publicId, ownerId: userId, purpose })
                      → INSERT INTO storage_assets (public_id, owner_id, purpose) VALUES (...)
       → response { publicId, url, ... }
  → ImageUploadField sets form value = publicId
  → user submits entity form (PATCH /users/me or PATCH /quizzes/:id)
       → UserApplicationService / QuizApplicationService
            → StorageApplicationService.userOwnsAssetForPurpose({ publicId, userId, purpose })
                 → must return true (else 403 ASSET_NOT_OWNED)
            → UPDATE entity SET avatar_public_id / image_public_id = $1
```

Failure at the DB step leaves an orphan Cloudinary asset *and* a row in `storage_assets`; the orphan is acceptable, the row is not (it would let the same user try again or block a future cleanup). See "Cleanup" below for the orphan-accounting rules.

### Associate (verify before write)

```
PATCH /users/me { avatarPublicId }   or   POST /api/v1/quizzes { imagePublicId }
  → JWT → currentUser.sub
  → DTO validation (shape of publicId)            → 400 ASSET_PUBLIC_ID_INVALID on failure
  → StorageApplicationService.userOwnsAssetForPurpose({ publicId, userId: currentUser.sub, purpose })
       → true  → UPDATE entity row with public_id, derive URL, write response
       → false → 403 ASSET_NOT_OWNED (no write)
```

PATCH / DELETE on a quiz also continues to enforce `QUIZ_EDIT_OWN` / `QUIZ_EDIT_ANY` — the entity-level check and the asset-level check are independent and stacked.

### Replace

```
User picks a new file in ImageUploadField
  → POST /api/v1/uploads (creates NEW Cloudinary asset; new publicId)
  → form value replaced with new publicId
  → user submits form (PATCH entity)
       → application service reads OLD public_id from DB
       → UPDATE entity SET avatar_public_id = NEW
       → AFTER successful UPDATE, fire-and-forget: STORAGE_PORT.delete(OLD)
```

Order matters: **DB update first, Cloudinary delete second.** If the DB update succeeds and Cloudinary fails, the old asset becomes an orphan — same outcome as the Upload-failure scenario, and same mitigation (best-effort cleanup).

### Delete

```
User clicks "Remove photo"
  → form value = null
  → user submits form (PATCH entity { avatarPublicId: null })
       → application service reads OLD public_id
       → UPDATE entity SET avatar_public_id = NULL
       → AFTER successful UPDATE, fire-and-forget: STORAGE_PORT.delete(OLD)
```

### Failure scenarios

| Scenario | Detection | Mitigation |
|---|---|---|
| Cloudinary upload OK, DB write fails | Cloudinary returns 200, PATCH /users/me fails | The Cloudinary asset is orphaned. Acceptable for an MVP; mitigated by a manual cleanup script (out of scope). The user's avatar simply reverts to the previous one. |
| DB write OK, Cloudinary delete fails | PATCH succeeds, the delete call throws | Logged at WARN; a retry-once happens in `ImageLifecycleService.delete`. Final failure is logged for manual cleanup. |
| User uploads but never associates with entity | The `publicId` is returned but no PATCH happens | Orphan asset. Same as the first scenario. The user's *next* upload produces a second orphan — we accept this for an MVP. A "list and purge orphans" admin endpoint is a Phase 8 nicety. |
| Duplicate upload | Client uploads the same image twice | Cloudinary dedupes by content hash if `use_filename: true` and `unique_filename: false`. We do not use that mode (UUIDv7 is opaque and our policy is content-blind). Two uploads produce two assets. |
| Retry on transient Cloudinary outage | Cloudinary SDK throws `ENOTFOUND` / `ETIMEDOUT` / 5xx | `CloudinaryStorageAdapter.upload` retries up to 3 times with exponential backoff (200ms, 800ms, 3.2s). On final failure, the controller returns `502 UPLOAD_PROVIDER_UNAVAILABLE`. |
| Retry on transient DB outage | Drizzle throws | Standard NestJS retry pattern; the Cloudinary asset is already created, so we treat the request as idempotent: a follow-up PATCH can supply the same `publicId` and the row will be set. |
| Concurrent replace | Two browser tabs PATCH at once | The DB update is a simple `UPDATE … WHERE user_id = $1`; one wins, the other is silently overwritten. The losing tab's "old" public_id was already uploaded by the winning tab — both get deleted (idempotent on the second delete). |

### Why this is acceptable

- We are **not** running distributed transactions. We rely on:
  - DB-first ordering on replace/delete (so the entity row always points at a valid publicId).
  - Idempotent delete (treat `not found` as success).
  - Best-effort cleanup for orphans.
  - Future Phase 8 cleanup script.

For a portfolio-grade system this is exactly the right amount of robustness — more would require a queue + dedup table, which is over-engineering for this scale.

---

## 11. Security

### Validation layers

| Layer | Check |
|---|---|
| Browser | MIME allowlist (`accept`), size cap (matches server). |
| `ParseFilePipe` (NestJS) | `FileTypeValidator` against the *declared* MIME; `MaxFileSizeValidator` (8 MB ceiling). |
| `UploadApplicationService` | Per-purpose allowlist (re-check declared MIME); per-purpose size cap (5 MB avatar, 8 MB quiz). |
| Cloudinary SDK | Re-checks magic bytes server-side; rejects non-image content. |
| `STORAGE_PORT.upload` | Logs the resolved publicId + bytes + request id; no payload logging. |

### Cloudinary credentials

| Variable | Where it lives | Frontend? |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Backend env (`.env`) | Public, but we do not expose it. |
| `CLOUDINARY_API_KEY` | Backend env (`.env`) | **NEVER frontend.** |
| `CLOUDINARY_API_SECRET` | Backend env (`.env`) | **NEVER frontend.** |

Both `api_key` and `api_secret` are server-only. The frontend never receives them; it only ever sees the response `{ publicId, url, … }`.

If we ever consider an unsigned upload preset (browser → Cloudinary directly, no backend), it must be a separate, scoped, rate-limited preset with a folder-restricted `eager` transformation; we **deliberately do not** introduce it in this revision.

### Upload mode

- **Server-side upload only** for this revision. The browser never talks to Cloudinary directly.
- This preserves the server-side validation chain and the audit log.

### Rate limiting

- Global `ThrottlerGuard`: 100 req / 60 s (unchanged).
- `@Throttle({ default: { limit: 20, ttl: 60_000 } })` on `POST /api/v1/uploads`.
- Avatar and quiz cover together share this bucket — the per-purpose split is not needed at this scale.

### Authorization

#### Dedicated ownership rule (MANDATORY, replaces the previous "optional hardening")

> **A `publicId` may only be associated with an entity if the authenticated user is the owner recorded in `storage_assets` for that `publicId` and the recorded `purpose` matches the target entity.**

The rule applies to every endpoint that writes a `publicId` into an entity column:

| Endpoint | Rule check |
|---|---|
| `POST /api/v1/uploads` | The `publicId` returned is bound to `currentUser.sub` server-side (the *only* place `ownerId` is ever written). |
| `PATCH /api/v1/users/me` | Before writing `avatar_public_id`, call `StorageApplicationService.userOwnsAssetForPurpose({ publicId, userId: currentUser.sub, purpose: 'avatar' })`. Missing row and "wrong owner" both return `403 ASSET_NOT_OWNED` — same response, no oracle. |
| `POST /api/v1/quizzes` | Same, with `purpose: 'quiz'`. |
| `PATCH /api/v1/quizzes/:id` | Same. Stacked on top of the existing `QUIZ_EDIT_OWN` permission. |

#### Why this is the right shape

- **One source of truth.** The `storage_assets` row is the only thing the application consults. The encoded `userId` segment in the `public_id` is structural defence-in-depth, not the gate — a client that forges or guesses another user's `public_id` is rejected by the row lookup, not by string parsing.
- **Same response for "I never uploaded this" and "this belongs to someone else".** Avoids an oracle that distinguishes "asset doesn't exist" from "asset exists but isn't yours", which would let a malicious client enumerate other users' public_ids.
- **Quiz covers work without a quiz-id-before-upload constraint.** Ownership is decided by `(publicId, ownerId, purpose)` — the quiz row is irrelevant. A user can upload an image, leave the form open for an hour, then attach it to a brand-new quiz; the lookup is identical.
- **Reuse is impossible across users, possible within the same user's entities for the right purpose.** User A cannot attach User A's *avatar* asset to User A's *quiz* (`purpose` mismatch). This catches the obvious cross-purpose mis-use without introducing per-entity ACLs.

#### Other authorization notes (unchanged from the previous revision)

- `POST /api/v1/uploads`: any authenticated user.
- Association of `publicId` with an entity (`PATCH /users/me`, `PATCH /quizzes/:id`): the existing permission checks (`QUIZ_EDIT_OWN`, `QUIZ_EDIT_ANY`) remain in place **and** are now stacked with the ownership check above.
- Delete authorization is implicit: the only entity that can null its own `publicId` is the entity's owner (enforced by the existing PATCH handler's `assertOwnership` checks). The `publicId` it nulls is also one the user owns (or null) — the `userOwnsAssetForPurpose` check runs on the *current* value before nulling, ensuring the request is consistent.
- Admin endpoints (out of scope) could bulk-delete orphans later.

### SVG policy

- **Reject SVG.** SVG is intentionally excluded from `allowedMime` for both purposes. Cloudinary supports SVG but the security implications (XSS via inline script, content sniffing) outweigh the small UX gain. If the portfolio needs SVG later, the recommended path is to allowlist the source and strip `<script>` via a server-side sanitizer, not to enable raw SVG.

### Public IDs

- Generated server-side as `quiz-app/<folder>/<userId>/<uuidv7>` — see §4. `userId` is sourced from `currentUser.sub`, **never** from the request body or any other client-controlled source.
- The trailing `uuidv7` is the per-asset random component; the embedded `userId` is structural only.
- The authoritative ownership check is the `storage_assets` row, not the structural encoding.
- **No user-supplied bytes** in the public_id (no filename leak, no path traversal, no special-character escapes).
- Used only as a stable identifier; the URL is derived through Cloudinary's transformation parameters so users cannot change them.

### Other

- `image/*` only — enforced by both DTO and Cloudinary.
- The body parser limit is now **explicit** (`1 MB` JSON; multipart is per-controller). This is the reverse of the previous audit's 100 KB surprise: since we no longer transport Base64 in JSON, the JSON limit can be small, while the multipart limit is per-purpose.
- `helmet` CSP (when enabled) will need an `img-src` directive allowing `https://res.cloudinary.com` for image fetches.
- CSRF remains a concern (the audit called this out). The new endpoint accepts multipart bodies that are NOT covered by the existing cookie-only JSON CSRF concerns, but the existing JSON PATCH endpoints that carry `avatarPublicId` still need the same CSRF posture. **Out of scope** for this revision; flagged for a separate security PR.

---

## 12. Image Optimization

Cloudinary's `f_auto, q_auto` is applied on every derived URL via `STORAGE_PORT.deriveUrl`. That single change covers:

- **Automatic format selection** — Cloudinary serves WebP/AVIF to capable browsers, JPEG/PNG to older ones.
- **Quality optimization** — perceptual quality auto-target.
- **No build-time resizing required** — Cloudinary handles it on the fly.

### Per-purpose transformation map

| Purpose | Transformation | Rationale |
|---|---|---|
| `avatar` | `w_512,h_512,c_fill,g_auto,q_auto,f_auto` | Square thumbnails, up to 512 px, auto-gravity (face-aware). |
| `quiz` | `w_1600,h_900,c_fill,g_auto,q_auto,f_auto` | 16:9 cover, up to 1600 px wide, auto-gravity. |

### Usage recommendations

| Render context | Recommended URL | Rationale |
|---|---|---|
| Avatar in a navigation chip | Avatar transformation | Square, small. |
| Avatar in a profile header | Avatar transformation (or `w_256` for a tight crop) | Still square. |
| Quiz cover in a feed card | `w_800,h_450,c_fill,g_auto` | Smaller version of the cover. |
| Quiz cover on the quiz detail page | Quiz cover full transformation | Largest reasonable size. |
| Quiz cover on social/OG previews | Same full transformation; OG renderer will downscale. | Acceptable. |

We **deliberately** do not ship a custom thumbnailing service in NestJS — Cloudinary's URL parameters are the abstraction.

### Browser `<img>` vs `next/image`

- Use `next/image` for all images where the consumer is a Next.js page. Cloudinary URLs are eligible for the Next.js image optimizer.
- Where `next/image` is unsuitable (e.g. dynamic OG meta tag generation), use the raw Cloudinary URL with the appropriate transformation baked in.

---

## 13. Next.js Image Handling

### Current `next.config.ts`

```ts
remotePatterns: [
  { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
  { protocol: 'https', hostname: 'example.test', pathname: '/**' },
  { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
  { protocol: 'https', hostname: 'example.com', pathname: '/**' },
]
```

### Required change

Add the Cloudinary hostname for the project's chosen cloud name. Cloudinary's resource hostname format is `res.cloudinary.com/<cloud_name>`:

```ts
{
  protocol: 'https',
  hostname: 'res.cloudinary.com',
  pathname: '/<CLOUDINARY_CLOUD_NAME>/**',
}
```

The placeholder `<CLOUDINARY_CLOUD_NAME>` should be replaced with the actual value at config-write time. If the project uses a custom delivery domain (CNAME), use that instead of `res.cloudinary.com`.

### Should every Cloudinary image use `next/image`?

**Yes, where reasonable.** `next/image` adds:

- Lazy loading.
- Automatic `srcset` for responsive sizes.
- Built-in format negotiation (when using the Next image optimizer as a proxy).
- CLS protection via explicit width/height.

Caveats:

- `next/image` will fetch the image through the Next.js server, adding one hop. For Cloudinary, this is usually fine — the CDN still wins on cache hits.
- For images rendered outside React (e.g. `next/og`), `next/image` is unavailable; use the Cloudinary URL directly.

---

## 14. Testing Plan

### Unit tests

| File under test | Cases |
|---|---|
| `core/storage/storage.port.ts` (the interface contract) | Mock adapter tests covering `upload`, `delete`, `deriveUrl`. `upload` requires `ownerId` in `UploadInput`; passing a value not matching the assembled `public_id` shape throws. |
| `core/storage/infrastructure/cloudinary/cloudinary.adapter.ts` | Happy path: returns `{ publicId, url, bytes, format, width, height }`. Error mapping: Cloudinary 4xx → `UnsupportedMediaTypeException`; 5xx → `ServiceUnavailableException`. Folder is `quiz-app/<purpose>/<ownerId>/` for each `purpose`. `public_id` ends in a UUIDv7 string. `delete` is idempotent (`not found` → success). |
| `modules/upload/application/upload.application.service.ts` | Per-purpose size cap; per-purpose MIME allowlist; rejects oversize; rejects wrong MIME; happy path returns `UploadResult`. **Calls `StorageApplicationService.bindAssetToOwner` once with the correct `(publicId, ownerId, purpose)` triple; if the bind throws, calls `STORAGE_PORT.delete(publicId)` and throws `UPLOAD_OWNERSHIP_BIND_FAILED`.** |
| `modules/upload/domain/upload-policy.ts` | Snapshot test of the policy table. |
| `modules/storage/application/storage.application.service.ts` (NEW) | `bindAssetToOwner` is a single insert. `userOwnsAssetForPurpose` returns `true` only when `(publicId, ownerId, purpose)` matches; returns `false` for missing rows, wrong owners, and wrong purposes. `unbindAsset` deletes by `publicId` and is idempotent. |
| `modules/user/application/user.application.service.ts` (touched by this revision) | PATCH with `avatarPublicId: <user-owned>` → 200, public_id written, URL derived. **PATCH with `avatarPublicId: <other-user-owned>` → 403 `ASSET_NOT_OWNED`, no DB write.** **PATCH with `avatarPublicId: <malformed-shape>` → 400 `ASSET_PUBLIC_ID_INVALID`.** PATCH with `avatarPublicId: null` clears the column and enqueues delete of the previous public_id. |
| `modules/quiz/application/quiz.application.service.ts` (touched by this revision) | Same matrix for `imagePublicId` / `purpose: 'quiz'`. The existing `QUIZ_EDIT_OWN` check still applies to the quiz id; the asset check is independent. |

### Integration tests (e2e)

| Endpoint | Cases |
|---|---|
| `POST /api/v1/uploads` | Authenticated upload of a real image → 201 with correct shape **and a row in `storage_assets` whose `(public_id, owner_id, purpose)` matches the JWT subject**. Unauthenticated → 401. Oversized upload (9 MB for `purpose=quiz`) → 400 `UPLOAD_FILE_TOO_LARGE`. Wrong MIME (`application/pdf`) → 400 `UPLOAD_UNSUPPORTED_MEDIA_TYPE`. Wrong `purpose` (`'banner'`) → 400 `UPLOAD_INVALID_PURPOSE`. Rate-limit exceeded → 429. |
| `PATCH /api/v1/users/me` | **Cross-user `publicId` theft test (must fail):** seed two users A and B; A uploads an avatar; B calls `PATCH /users/me { avatarPublicId: <A's publicId> }` → **403 `ASSET_NOT_OWNED`, no DB write to B's row, A's row untouched.** With `avatarPublicId: <A's own>` → 200, profile returns Cloudinary URL. With `avatarPublicId: <A's quiz asset>` → 403 `ASSET_NOT_OWNED` (purpose mismatch). With `avatarPublicId: <malformed>` → 400 `ASSET_PUBLIC_ID_INVALID`. With `avatarPublicId: null` → 200, avatar cleared, prior asset deletion enqueued. |
| `POST /api/v1/quizzes` / `PATCH /api/v1/quizzes/:id` | **Cross-user cover theft test (must fail):** A uploads a `purpose=quiz` asset; B creates a quiz with `imagePublicId: <A's quiz publicId>` → **403 `ASSET_NOT_OWNED`, no quiz row written** (POST) / no `image_public_id` written (PATCH). A creates a quiz with `imagePublicId: <A's own quiz publicId>` → 201/200, cover renders. A creates a quiz with `imagePublicId: <A's avatar publicId>` → 403 (purpose mismatch). PATCH by a non-owner quiz user → 403 (existing permission, unchanged). |

### E2E (Playwright)

| Flow | Assertions |
|---|---|
| Select avatar → save profile → reload profile → image renders | Image `src` is `https://res.cloudinary.com/...`; matches the publicId stored; renders within the page; round-trips through a reload. |
| Replace image | Old asset is deleted (verified by `cloudinary.api.resources` listing the publicId as absent); new asset is present. |
| Delete image (Remove photo) | `user_profiles.avatar_public_id` is `NULL`; `user_profiles.avatar_url` is `NULL`; prior Cloudinary asset is absent in listing. |
| Create quiz with cover image | Quiz row's `image_public_id` is set; the quiz list page renders the Cloudinary image. |
| Replace quiz cover image | Old cover deleted; new cover rendered. |
| Delete quiz (soft-delete path) | Prior cover deleted from Cloudinary. |
| Unauthenticated upload attempt | 401 response; UI is blocked by the auth wrapper. |
| Oversized upload attempt | UI shows an inline error from `useUpload.error`; no row written. |
| Unsupported MIME attempt | UI shows an inline error; no row written. |
| **Cross-user avatar theft (browser-level)** | Two browser contexts (User A, User B). A uploads an avatar. B's profile form receives `publicId` (simulated via direct API call from B's session). Server returns 403 `ASSET_NOT_OWNED`. B's avatar column is unchanged. A's avatar column is unchanged. |
| **Cross-user quiz cover theft (browser-level)** | A uploads a quiz cover. B creates a quiz with A's `publicId`. Server returns 403 `ASSET_NOT_OWNED`. Quiz row is not inserted. |

### Security tests

| Test | Why |
|---|---|
| Upload `.exe` with `Content-Type: image/png` declared | Should be rejected by Cloudinary's magic-byte check. If the SDK doesn't surface that as an error, our policy should. |
| Upload SVG with `Content-Type: image/svg+xml` | Should be rejected by the DTO allowlist. |
| Upload a 10 MB file claiming `image/jpeg` | Should be rejected by `ParseFilePipe`'s `MaxFileSizeValidator`. |
| Verify `CLOUDINARY_API_SECRET` does not appear in the generated client bundle | Run `pnpm --filter quiz_frontend build && grep -r 'CLOUDINARY_API_SECRET' .next/`. |
| Replace an asset and intercept the DELETE | Verify the delete call goes to `cloudinary.uploader.destroy(<oldPublicId>)`, not the new one. |
| **Cross-user `publicId` theft — avatar** | User A uploads an avatar (binding row exists in `storage_assets` with `owner_id = A`). User B `PATCH /users/me` with `{ avatarPublicId: <A's publicId> }` → server returns 403 `ASSET_NOT_OWNED`. B's `avatar_public_id` is unchanged. A's row is unchanged. No Cloudinary delete call is issued for either asset. |
| **Cross-user `publicId` theft — quiz cover** | User A uploads a `purpose=quiz` asset. User B `POST /api/v1/quizzes` with `{ imagePublicId: <A's publicId>, … }` → server returns 403 `ASSET_NOT_OWNED`. No quiz row is written. |
| **Cross-purpose reuse** | User A uploads a `purpose=avatar` asset, then tries to attach it to a quiz they own via `POST /api/v1/quizzes` → 403 `ASSET_NOT_OWNED` (purpose mismatch, same response as cross-user). |
| **Forged/guessed `publicId` (no upload at all)** | A row that has never existed is queried → `userOwnsAssetForPurpose` returns `false` → 403 `ASSET_NOT_OWNED`. Verify that the response shape and timing are identical to the cross-user case (no oracle). |
| **Missing `storage_assets` row after a successful upload** | Simulate a Cloudinary-upload-OK + bind-failed race by deleting the row directly: a follow-up PATCH with that `publicId` returns 403 `ASSET_NOT_OWNED`, never writes the entity. |

---

## 15. Implementation Phases

### Phase 0 — Preparation

- **Files / modules affected:** `quiz_backend/.env.example`, `quiz_backend/.env` (gitignored), `quiz_backend/src/core/config/env.validation.ts`.
- **What changes:** confirm Cloudinary account exists; decide on `cloud_name`; decide on the dedicated Cloudinary folder prefix; decide on a deletion policy for orphans (TTL sweep, deferred to a later phase). Wire the four keys into `validateEnv` so the backend boots once Phase 1 lands.
- **Why:** avoid leaking cloud credentials into git or stale `.env.example`; lock the contract that the rest of the migration can build against.
- **Dependencies:** none.
- **Risk:** low.
- **Definition of done:** Cloudinary cloud name, API key, API secret issued and stored locally (never committed). `.env.example` updated with the four env vars. `validateEnv` accepts the new keys (verified via `pnpm exec ts-node scripts/smoke-env-validation.ts`). The folder prefix for non-production environments is `quiz-app-dev`; production is expected to override via `.env` to `quiz-app`. `.gitignore` already covers `.env` (line 39).

### Phase 1 — Storage abstraction

- **Files / modules affected:** new `core/storage/`.
- **What changes:** introduce `STORAGE_PORT`, `UploadInput`, `UploadResult`, `StoragePort` interface; an in-memory `FakeStorageAdapter` for tests.
- **Why:** domain modules must depend on the abstraction, not Cloudinary. This phase is the keystone.
- **Dependencies:** Phase 0.
- **Risk:** low.
- **Definition of done:** `core/storage` compiles; `core/storage/storage.module.ts` registers the port; `FakeStorageAdapter` is wired in test environments.

### Phase 2 — Cloudinary integration

- **Files / modules affected:** `core/storage/infrastructure/cloudinary/`.
- **What changes:** add `cloudinary` to `package.json`; create `cloudinary.config.ts` (provider), `cloudinary.adapter.ts` (the concrete adapter), `cloudinary.module.ts` (DI wiring).
- **Why:** the only place that knows about Cloudinary is this folder.
- **Dependencies:** Phase 1.
- **Risk:** low — backend only, no client impact yet.
- **Definition of done:** `CloudinaryStorageAdapter` passes unit tests in §14; `STORAGE_PORT` resolves to it in dev/prod and to `FakeStorageAdapter` in tests.

### Phase 3 — Upload API + ownership binding

- **Files / modules affected:** new `modules/upload/`; new `modules/storage/` (assets application service + repository); `app.module.ts` registers both; `multer` added to `package.json`; `main.ts` explicit JSON body limit; new permissions constant (none required — `auth.user` covers).
- **What changes:**
  - Controller, DTO, application service, domain policy in `modules/upload/`. Add `@Throttle({ limit: 20, ttl: 60_000 })`. `@UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))`. `ParseFilePipe` with `FileTypeValidator` + `MaxFileSizeValidator`.
  - New `modules/storage/` exposes `StorageApplicationService` with `bindAssetToOwner`, `userOwnsAssetForPurpose`, `unbindAsset`, backed by a small Drizzle repository on the `storage_assets` table.
  - `UploadApplicationService.uploadAvatarOrQuizCover` does **both** the Cloudinary call and the `bindAssetToOwner` insert. On bind failure, the asset is best-effort deleted and `UPLOAD_OWNERSHIP_BIND_FAILED` is returned.
  - `cloudinary.adapter.ts` composes `public_id = folder/<ownerId>/<uuidv7>` using `ownerId` passed in via `UploadInput`.
- **Why:** surface the new upload capability behind a clean endpoint *and* bind the resulting `publicId` to its owner at the same time.
- **Dependencies:** Phase 2.
- **Risk:** medium — the first time we introduce `multipart/form-data` and a parser into the app. Mitigation: limit to a single small route; cover with integration tests.
- **Definition of done:** `POST /api/v1/uploads` returns a valid `UploadResult`; a row in `storage_assets` exists with the matching `(public_id, owner_id, purpose)`; smoke-tested manually with a 1 MB JPEG via curl; existing endpoints unaffected.

### Phase 4 — Database metadata changes

- **Files / modules affected:** Drizzle schema files (`user`, `quiz`, **new `storage`**), migration file, repository updates, DTO updates, application service updates.
- **What changes:**
  - Add `avatar_public_id text NULL`, `image_public_id text NULL`, and the reserved columns on `quiz_questions` and `categories`.
  - Add a new `storage_assets` table (`id uuidv7 PK`, `public_id text UNIQUE`, `owner_id uuid NOT NULL`, `purpose text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`), with an `INDEX (owner_id)`.
  - Add the column writes to `UPDATE user_profiles SET …` and `UPDATE quizzes SET …`; add the columns to the SELECT projections so they can be read for "old value" on replace/delete.
  - Add the `StorageAssetsRepository` (insert / `existsByPublicIdOwnerAndPurpose` / delete-by-public-id).
- **Why:** we need to know the previous public_id to delete it on replace, *and* we need a durable, queryable owner binding for the new authorization rule.
- **Dependencies:** Phase 3 (the adapter must exist for `deriveUrl`).
- **Risk:** medium — additive schema changes are reversible; DTO changes need Orval regen.
- **Definition of done:** schema migration runs without downtime; `storage_assets` table is queryable; Orval SDK regen produces new typed inputs; existing rows still render.

### Phase 5 — Frontend upload refactor

- **Files / modules affected:** `ImageUploadField`, `EditProfileForm`, `CreateQuizForm`, `AccountSettings`, `ProfileHeader`, `ContactForm`, new `features/uploads/`.
- **What changes:** swap `FileReader.readAsDataURL` for `POST /api/v1/uploads`; collapse `AccountSettings.AvatarSection` into `<ImageUploadField>`; delete the dead file inputs in `ProfileHeader` and `ContactForm`; add a new `purpose` prop to `<ImageUploadField>`; add `useUpload` hook with progress + retry.
- **Why:** consolidate three near-duplicate implementations into one reusable component.
- **Dependencies:** Phase 3 (the endpoint must exist).
- **Risk:** medium — touches the user-visible UX of two flows.
- **Definition of done:** avatar upload works through the new path; quiz cover upload works through the new path; `ProfileHeader` no longer renders an orphan file input; `ContactForm` no longer shows a misleading file input.

### Phase 6 — Image lifecycle / cleanup

- **Files / modules affected:** `core/storage/image-lifecycle.service.ts`; `user.application.service.ts`; `quiz.application.service.ts`; `quiz.application.service.ts` (delete cascade); `user-profile-bundle.service.ts` (read path uses `deriveUrl`).
- **What changes:**
  - Wire `STORAGE_PORT.delete` + `StorageApplicationService.unbindAsset` into (a) avatar replace, (b) avatar remove, (c) quiz cover replace, (d) quiz delete.
  - `UserApplicationService.updateProfile` and `QuizApplicationService.{createQuiz,updateQuiz}` call `userOwnsAssetForPurpose` **before** any DB write; a `false` result raises 403 `ASSET_NOT_OWNED` (or 400 `ASSET_PUBLIC_ID_INVALID` for malformed input — the DTO catches that one layer above).
  - `UserApplicationService.getMe` / `getMySummary` etc. prefer `avatarPublicId` and call `deriveUrl`; fall back to `avatar_url` when the public_id is null.
- **Why:** complete the upload/replace/delete triangle; otherwise the DB grows but Cloudinary grows faster. **And:** make the §11 ownership rule actually fire on every write path.
- **Dependencies:** Phase 4.
- **Risk:** medium — lifecycle bugs are subtle. Mitigation: idempotent delete; retry-once; warn-level logging on failure.
- **Definition of done:** replacing an avatar deletes the old asset (verified in Cloudinary dashboard); removing an avatar deletes the asset; deleting a quiz (with a cover) deletes the asset; **a cross-user PATCH attempt returns 403 `ASSET_NOT_OWNED` and writes nothing**.

### Phase 7 — Migration of existing Base64 images

- **Files / modules affected:** none — the strategy is **migrate-on-write**, no scripts.
- **What changes:** document the behaviour in `docs/architecture-reviews/image-storage-audit.md` and in the frontend `ImageUploadField`. Optional: add a `console.warn` in `user.application.service.updateProfile` that fires when an incoming patch sees `avatarUrl` set but `avatarPublicId` unset (i.e. a Base64 row).
- **Why:** keep the migration non-destructive and reversible.
- **Dependencies:** Phase 6.
- **Risk:** low — by design.
- **Definition of done:** users with Base64 avatars continue to see their avatars; on next edit they go through the new flow; no script runs in production.

### Phase 8 — Testing

- **Files / modules affected:** new test files across `core/storage/`, `modules/upload/`, `modules/user/application/`, `modules/quiz/application/`, plus Playwright specs in `quiz_frontend/e2e/`.
- **What changes:** see §14.
- **Why:** confidence; CI gate.
- **Dependencies:** Phases 3-6.
- **Risk:** low.
- **Definition of done:** all unit tests pass; e2e flows from §14 are green; CI runs them on every PR.

### Phase 9 — Documentation / CV-ready architecture

- **Files / modules affected:** `docs/architecture-reviews/image-storage-audit.md` (replace this revision's content into the final state); a new `docs/architecture-reviews/cloudinary-integration.md`; `quiz_frontend/next.config.ts` documented in code; `.env.example` documented.
- **What changes:** finalize the `remotePatterns` list; document the Cloudinary folder layout; document the lifecycle; document the test matrix.
- **Why:** interview-ready artefacts; maintainability.
- **Dependencies:** Phases 1-8.
- **Risk:** low.
- **Definition of done:** a one-page diagram in `docs/architecture-reviews/cloudinary-integration.md`; the OpenAPI spec regenerated and checked in.

---

## 16. Final Revised Plan

### CURRENT

```
Next.js
  → FileReader.readAsDataURL() (browser)
  → JSON PATCH /users/me, /quizzes/:id (application/json)
  → NestJS controller @Body() DTO with avatarUrl: string
  → PostgreSQL UPDATE user_profiles SET avatar_url = 'data:image/png;base64,…'
```

### TARGET

```
Next.js
  → FormData → POST /api/v1/uploads (multipart/form-data)
       ↓
  → NestJS UploadController (ParseFilePipe + UploadApplicationService)
       ↓
  → core/storage.STORAGE_PORT  (the abstraction)
       ↓
  → core/storage/infrastructure/cloudinary.CloudinaryStorageAdapter
       │   public_id = quiz-app/<folder>/<currentUser.sub>/<uuidv7>
       ↓
  → Cloudinary returns { public_id, secure_url, bytes, format, width, height }
       ↓
  → modules/storage.StorageApplicationService.bindAssetToOwner({ publicId, ownerId, purpose })
       │   INSERT INTO storage_assets (public_id, owner_id, purpose) VALUES (...)
       ↓
  → NestJS UploadController returns { publicId, url, … }
  → ImageUploadField sets form value = publicId
       ↓
  → PATCH /users/me, /quizzes/:id with { avatarPublicId | imagePublicId }
       ↓
  → UserApplicationService / QuizApplicationService
       │   StorageApplicationService.userOwnsAssetForPurpose({ publicId, userId, purpose })
       │     → must return true (else 403 ASSET_NOT_OWNED)
       ↓
  → UPDATE user_profiles SET avatar_public_id = $1  (with avatar_url derived via deriveUrl)
  → UPDATE quizzes       SET image_public_id  = $1
```

---

### 1. Exact features that will use Cloudinary

- **User avatar** upload / replace / delete.
- **Quiz cover image** upload / replace / delete.
- **Question image** and **Category image** remain URL-only for this revision (no Cloudinary involvement yet).

### 2. Exact APIs to add / change

| API | Status |
|---|---|
| `POST /api/v1/uploads` | **NEW.** multipart/form-data. `purpose ∈ {'avatar','quiz'}`. |
| `PATCH /api/v1/users/me` | **CHANGED.** Accepts `avatarPublicId` instead of `avatarUrl`. Old field still accepted during migration window with a `Deprecation` header. |
| `POST /api/v1/quizzes` | **CHANGED.** Accepts `imagePublicId` instead of `imageUrl`. |
| `PATCH /api/v1/quizzes/:id` | **CHANGED.** Same. |
| `GET /api/v1/users/me` | **CHANGED.** Response continues to expose `avatarUrl` (now derived from `avatarPublicId` when set). |
| `GET /api/v1/users/me/summary` | **CHANGED.** Same derivation for `avatarUrl` and `bgImageUrl` (when applicable). |
| `GET /api/v1/quizzes/:id` | **CHANGED.** `imageUrl` derived from `imagePublicId` when set. |

### 3. Exact DB changes

| Table | Add column | Type |
|---|---|---|
| `user_profiles` | `avatar_public_id` | `text NULL` |
| `quizzes` | `image_public_id` | `text NULL` |
| `quiz_questions` | `image_public_id` | `text NULL` (reserved, not written yet) |
| `categories` | `image_public_id` | `text NULL` (reserved, not written yet) |

**New table — `storage_assets` (Cloudinary ownership binding):**

| Column | Type | Constraint |
|---|---|---|
| `id` | `uuid` | PK, default `uuidv7()` |
| `public_id` | `text` | `UNIQUE NOT NULL` |
| `owner_id` | `uuid` | `NOT NULL`, INDEX |
| `purpose` | `text` | `NOT NULL`, check in `('avatar','quiz')` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

No columns are dropped in this revision.

### 4. Exact frontend components to modify

| Component | Action |
|---|---|
| `ImageUploadField` | **REFACTOR** — `FormData` + `POST /uploads`, new `purpose` prop. |
| `EditProfileForm` | **REFACTOR** — form field name `avatarPublicId`; uses new upload. |
| `CreateQuizForm` | **REFACTOR** — form field name `imagePublicId`; uses new upload. |
| `AccountSettings.AvatarSection` | **REMOVE** — collapse into `ImageUploadField`. |
| `ProfileHeader` (avatar/cover file inputs + handlers) | **REMOVE** dead paths. |
| `ContactForm` (`<input type="file">`, `selectedFile`) | **REMOVE** dead UI. |
| `SingleQuestionForm`, `BulkQuestionForm` | **KEEP** — URL-only fields, out of scope. |
| New `features/uploads/services/upload.service.ts` | **ADD** |
| New `features/uploads/hooks/useUpload.ts` | **ADD** |
| `next.config.ts` | **EDIT** — add Cloudinary host to `images.remotePatterns`. |

### 5. Exact backend modules to modify

| Module | Change |
|---|---|
| `core/storage/` | **NEW**. Port + adapter + Cloudinary implementation. |
| `modules/upload/` | **NEW**. Controller, DTO, application service, policy. **Wires `StorageApplicationService` into the upload flow** to bind each new `publicId` to its owner. |
| `modules/storage/` | **NEW**. `StorageApplicationService` (`bindAssetToOwner` / `userOwnsAssetForPurpose` / `unbindAsset`) + `StorageAssetsRepository`. |
| `modules/user/` | **EDIT**. DTO + application service + repository to handle `avatarPublicId`. **Application service calls `userOwnsAssetForPurpose` before any DB write.** |
| `modules/quiz/` | **EDIT**. Same for `imagePublicId`. |
| `app.module.ts` | **EDIT**. Import `StorageModule`, `UploadModule`, `StorageModule`. |
| `main.ts` | **EDIT**. Explicit JSON body limit (now smaller). |

### 6. Dead code to remove

- `ImageUploadField`'s `FileReader.readAsDataURL` branch (replaced by `useUpload`).
- `AccountSettings.AvatarSection` (replaced by `<ImageUploadField>`).
- `ProfileHeader`'s hidden `<input type="file">` x2 + `validateFile` + `handleAvatarChange` + `handleCoverChange`.
- `ContactForm`'s `<input type="file">` + `selectedFile` state.
- Any direct usage of `FileReader.readAsDataURL` for upload purposes elsewhere (currently none per the audit).

### 7. Security fixes

| Item | Source |
|---|---|
| Server-side MIME validation via `ParseFilePipe.FileTypeValidator` + per-purpose allowlist | Phase 3 |
| Server-side magic-byte check via Cloudinary SDK | Phase 2 |
| Server-side size cap via `MaxFileSizeValidator` + per-purpose policy | Phase 3 |
| Rate limiting on `POST /api/v1/uploads` (20/min/user) | Phase 3 |
| SVG rejection at the DTO | Phase 3 |
| Public IDs generated server-side as `quiz-app/<folder>/<userId>/<uuidv7>` (no user input) | Phase 2 |
| **Mandatory Cloudinary asset ownership check** via `storage_assets(public_id, owner_id, purpose)` lookup before any PATCH on `users/me` or `quizzes/:id` | Phase 3 + Phase 6 |
| **Bind on upload** — every Cloudinary response produces a `storage_assets` row keyed by the JWT subject; bind failure triggers asset delete + 502 | Phase 3 |
| **Structural `public_id` shape validation** in the DTO (catches forged/guessed strings before the DB lookup) | Phase 6 |
| **Same 403 response** for missing row and wrong-owner row (no oracle) | Phase 6 |
| API secret never exposed to the frontend | Phase 0 / Phase 2 |
| Explicit JSON body limit (1 MB) in `main.ts` | Phase 3 |
| Helmet `img-src` directive covering `https://res.cloudinary.com` | Phase 9 (documentation; CSP change is a separate security PR) |

### 8. Testing requirements

See §14.

### 9. Migration strategy

**Migrate-on-write, non-destructive, no scripts.** Existing Base64 rows continue to render. The next user save writes a `public_id` (or `null`) and the original Base64 string falls out of use. Unsplash/external URLs and seed data continue to flow through the `*_url` fallback column.

### 10. Recommended implementation order

1. **Phase 0** — Cloudinary account + env (½ day).
2. **Phase 1** — Storage abstraction (½ day).
3. **Phase 2** — Cloudinary adapter (½ day, mostly unit-tested).
4. **Phase 3** — Upload API + integration tests (1 day).
5. **Phase 4** — DB metadata columns + repository updates (½ day).
6. **Phase 5** — Frontend refactor + `<ImageUploadField>` rewrite + dead-code removal (1 day).
7. **Phase 6** — Lifecycle wiring (replace/remove/delete) (½ day).
8. **Phase 8** — End-to-end Playwright + security tests (1 day).
9. **Phase 7** — Migrate-on-write documentation (¼ day).
10. **Phase 9** — Documentation finalisation (¼ day).

Total: roughly 5 working days, plus reviews.

---

### After this migration, what can I legitimately claim on my resume about cloud experience?

A grounded, interview-ready summary you can use verbatim:

> *Designed and shipped a server-side image upload pipeline on the quiz platform. Introduced a Storage Port / Adapter (hexagonal) abstraction so the domain layer never sees the cloud SDK, then implemented a Cloudinary adapter for image storage, transformation (auto-format / auto-quality / responsive resizing), and CDN delivery. Frontend uploads go through a single `POST /api/v1/uploads` endpoint (multipart/form-data, per-purpose MIME and size validation, rate-limited) that returns a `public_id`; the database stores only the `public_id` metadata and the server derives the URL. The previous implementation stored Base64 strings inside Postgres text columns — this migration removes binary data from the database, adds server-side MIME and size enforcement, fixes the silent JSON body-parser cap, and consolidates three near-duplicate frontend upload components into one reusable field.*

What this **does** demonstrate:

- Hexagonal architecture / Port–Adapter pattern in a real backend.
- Cloudinary integration: upload, transformation, deletion, URL derivation.
- File-upload security (MIME allowlist, size cap, rate limiting, SVG rejection, server-only credentials).
- Database design hygiene (metadata-only, no binary in DB).
- Lifecycle correctness (replace, delete, orphan handling).
- Frontend consolidation of duplicated components.
- Pragmatic tradeoffs (Option A storage now, Option B in a later phase; migrate-on-write instead of a destructive script).

What this does **NOT** demonstrate (and you should not claim):

- AWS / S3 / EC2 / IAM / VPC experience.
- Cloudflare R2 / Workers experience.
- Kubernetes / container orchestration.
- Terraform / IaC.
- Microservices / event-driven image processing.
- CDN edge engineering beyond "configured Cloudinary's CDN via the SDK".
- Distributed transactions or saga patterns.

These are honest boundaries. The Cloudinary work is real and demonstrable; inflating it into "AWS Cloud Engineer" experience would not survive a technical interview.