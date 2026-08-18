`# Cloudinary Integration

**Date:** 2026-08-18
**Scope:** End-to-end design of the Cloudinary image pipeline shipped in this revision.
**Audience:** Backend engineers, frontend engineers, technical interviewers.
**Source plan:** [`docs/architecture-reviews/cloudinary-migration-plan.md`](./cloudinary-migration-plan.md).
**Source audit:** [`docs/architecture-reviews/image-storage-audit.md`](./image-storage-audit.md).

---

## 1. One-page diagram

```
Next.js (browser)
  └─ <ImageUploadField purpose="avatar"|"quiz">
       ├─ useUpload() ─── FormData (multipart/form-data) ──►  POST /api/v1/uploads
       │                                                       │  (JWT in cookie)
       │                                                       ▼
       │                          NestJS UploadController ─── ParseFilePipe
       │                                                       │  (FileTypeValidator + MaxFileSizeValidator)
       │                                                       ▼
       │                          UploadApplicationService.uploadAvatarOrQuizCover
       │                                                       │
       │                                                       │  1. Per-purpose MIME + size re-check
       │                                                       │  2. STORAGE_PORT.upload(buffer, mime, bytes, ownerId, purpose)
       │                                                       │  3. StorageApplicationService.bindAssetToOwner(...)
       │                                                       ▼
       │                          core/storage.STORAGE_PORT (hexagonal abstraction)
       │                                                       │
       │                                                       ├── fake:      FakeStorageAdapter (in-memory Map)
       │                                                       └── cloudinary: CloudinaryStorageAdapter
       │                                                                            │
       │                                                                            ▼
       │                                                                            Cloudinary SDK
       │                                                                            │   public_id = ${CLOUDINARY_FOLDER}/${ownerId}/${uuidv7}
       │                                                                            │   (server-generated, never trusted from client)
       │                                                                            ▼
       │                                                                            Cloudinary CDN
       │                                                                            └─ returns { public_id, secure_url, bytes, format, width, height }
       │
       │  ◄── { publicId, url, bytes, format, width, height, purpose } ──
       │
       ├─ field.onChange(publicId) ────────► react-hook-form value (string)
       │  form.setValue('avatarPublicId' | 'imagePublicId', publicId)
       │
       └─ On save:
              PATCH /api/v1/users/me | /api/v1/quizzes/:id    { avatarPublicId | imagePublicId }
                                                    │
                                                    ▼
                            UserApplicationService | QuizApplicationService
                                                    │
                                                    │  StorageApplicationService.userOwnsAssetForPurpose(...)
                                                    │    ↳ false → 403 ASSET_NOT_OWNED (no DB write)
                                                    │    ↳ true  → continue
                                                    ▼
                            Drizzle UPDATE user_profiles | quizzes
                                                    │
                                                    │  StorageImageLifecycleService.replaceAvatar / replaceQuizCover
                                                    │    ↳ STORAGE_PORT.delete(oldPublicId)   (best-effort, idempotent)
                                                    │    ↳ StorageApplicationService.unbindAsset(oldPublicId)
                                                    ▼
                            Response: UserMeResponse | QuizResponse
                                                    │
                                                    │  UserResponseMapper | QuizResponseMapper
                                                    │    ↳ STORAGE_PORT.deriveUrl(publicId, purpose) → secure Cloudinary URL
                                                    │    ↳ Falls back to legacy avatarUrl | imageUrl for migrate-on-write rows
                                                    ▼
                            Browser renders <Image src={...} />
                                                    │
                                                    ▼
                            Cloudinary CDN delivers optimised WebP/AVIF
```

---

## 2. Hexagonal architecture at a glance

The whole point of `core/storage/` is that **the domain layer never imports the Cloudinary SDK**. Every module outside `core/storage/infrastructure/cloudinary/` sees only:

| Symbol                         | Kind                 | Purpose                                                       |
| ------------------------------ | -------------------- | ------------------------------------------------------------- |
| `STORAGE_PORT`                 | NestJS DI token      | The boundary between domain and adapter.                      |
| `StoragePort`                  | TypeScript interface | `upload`, `delete`, `deriveUrl`.                              |
| `StorageApplicationService`    | Injectable service   | The §11 ownership rule.                                       |
| `StorageImageLifecycleService` | Injectable service   | Replace/remove/delete with retry-once.                        |
| `UPLOAD_POLICY`                | Constant             | Per-purpose folder, byte cap, MIME allowlist, transformation. |

The concrete adapter is chosen at `AppModule` bootstrap:

```ts
StorageModule.forRoot({
  adapter: process.env.NODE_ENV === 'test' ? 'fake' : 'cloudinary',
});
```

In tests, `adapter: 'fake'` resolves `STORAGE_PORT` to `FakeStorageAdapter`. In dev/staging/prod, it resolves to `CloudinaryStorageAdapter`. The two implementations share the same contract; tests for the Cloudinary adapter use a hand-rolled `CloudinarySDK` mock so they never hit the network.

### Files

- `core/storage/storage.types.ts` — `StoragePort`, `UploadInput`, `UploadResult`.
- `core/storage/storage.port.ts` — `STORAGE_PORT` Symbol token.
- `core/storage/storage.module.ts` — `forRoot({ adapter })` dynamic module.
- `core/storage/domain/upload-policy.ts` — `UPLOAD_POLICY` constant.
- `core/storage/domain/ports/storage-assets-repository.port.ts` — Drizzle port.
- `core/storage/infrastructure/cloudinary/` — Cloudinary adapter + SDK wrapper.
- `core/storage/infrastructure/fake/` — `FakeStorageAdapter` for tests.
- `core/storage/infrastructure/repositories/` — Drizzle implementation of `StorageAssetsRepository`.
- `core/storage/application/storage.application.service.ts` — §11 ownership rule.
- `core/storage/application/storage-image-lifecycle.service.ts` — Replace/remove/delete.

---

## 3. The §11 ownership rule

> _"A `publicId` may only be associated with an entity if the authenticated user is the owner recorded in `storage_assets` for that `publicId` and the recorded purpose matches the target entity."_

### `storage_assets` table

| Column       | Type          | Constraint                               |
| ------------ | ------------- | ---------------------------------------- |
| `id`         | `uuid`        | PK, default `uuidv7()`                   |
| `public_id`  | `text`        | `UNIQUE NOT NULL`                        |
| `owner_id`   | `uuid`        | `NOT NULL`, INDEX                        |
| `purpose`    | `text`        | `NOT NULL`, check in `('avatar','quiz')` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                 |

### Three operations

1. `bindAssetToOwner` — called once by `UploadApplicationService` immediately after a successful Cloudinary upload. Throws `StorageOwnershipBindFailedError` on collision (best-effort deletes the Cloudinary asset, then surfaces 500 `UPLOAD_OWNERSHIP_BIND_FAILED`).
2. `userOwnsAssetForPurpose` — called by `UserApplicationService`/`QuizApplicationService` **before** any DB write. `false` → 403 `ASSET_NOT_OWNED`. **Same response** for missing row, wrong owner, wrong purpose — no oracle.
3. `unbindAsset` — called by the lifecycle service after a Cloudinary delete. Idempotent.

### Structural defence in depth

The DTO `@Matches(STORAGE_PUBLIC_ID_TAIL_PATTERN)` validator catches forged/guessed strings _before_ they hit the DB. The structural shape — `quiz-app/<purpose>/<uuidv7>/<uuidv7>` — guarantees that a publicId cannot be invented; an attacker who guesses a UUID would still need a row in `storage_assets`.

---

## 4. Lifecycle (replace / remove / delete)

```
Replace avatar:
  user.application.updateProfile({ avatarPublicId: <new> })
    ├─ storageOwnership.userOwnsAssetForPurpose(new)  ─ 403 if false
    ├─ DB UPDATE user_profiles SET avatar_public_id = new
    └─ storageLifecycle.replaceAvatar(userId, new)
        ├─ readCurrent() → old
        ├─ STORAGE_PORT.delete(old)        (idempotent, retries once on 5xx)
        └─ storageOwnership.unbindAsset(old)

Remove avatar:
  user.application.updateProfile({ avatarPublicId: null })
    ├─ DB UPDATE user_profiles SET avatar_public_id = NULL
    └─ storageLifecycle.removeAvatar(userId)
        ├─ readCurrent() → old
        ├─ STORAGE_PORT.delete(old)
        └─ storageOwnership.unbindAsset(old)

Delete quiz:
  quiz.application.deleteQuiz(quizId)
    ├─ DB UPDATE quizzes SET deleted_at = now()
    └─ storageLifecycle.deleteQuizCover(quizId)
        ├─ readCurrent() → old
        ├─ STORAGE_PORT.delete(old)
        └─ storageOwnership.unbindAsset(old)
```

The lifecycle service is **best-effort**. Failures are logged at WARN level; the user's profile update still succeeds. An admin sweep (deferred to a future phase) can reconcile any orphans.

---

## 5. Per-purpose transformations

`STORAGE_PORT.deriveUrl(publicId, purpose)` applies the per-purpose transformation on every read:

| Purpose  | Folder             | Transformation                             | Use case                     |
| -------- | ------------------ | ------------------------------------------ | ---------------------------- |
| `avatar` | `quiz-app/avatars` | `w_512,h_512,c_fill,g_auto,q_auto,f_auto`  | Square 512 px, auto-gravity. |
| `quiz`   | `quiz-app/quizzes` | `w_1600,h_900,c_fill,g_auto,q_auto,f_auto` | 16:9 cover, auto-gravity.    |

The `f_auto,q_auto` pair is what gives Cloudinary's free optimisation: WebP/AVIF to capable browsers, JPEG/PNG fallback, perceptual-quality auto-target.

---

## 6. Folder layout

```
Cloudinary dashboard
└── quiz-app-dev/                         ← CLOUDINARY_FOLDER (dev)
    ├── avatars/
    │   └── <ownerId>/                    ← structural segment
    │       └── <uuidv7>                  ← UUIDv7 tail
    └── quizzes/
        └── <ownerId>/
            └── <uuidv7>

quiz-app/                                  ← CLOUDINARY_FOLDER (prod)
    └── (same shape)
```

The `<ownerId>` segment is purely structural — it makes the `publicId` self-describing in the dashboard. Ownership is **not** decided by string parsing; the `storage_assets` row is the source of truth. The segment is a debugging affordance: when an engineer is investigating a leak in the Cloudinary console, the owner is one click away.

---

## 7. Next.js `remotePatterns`

`quiz_frontend/next.config.ts` ships the following patterns (post-Phase-9):

```ts
remotePatterns: [
  { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
  { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/demo/**' },
  { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
  { protocol: 'https', hostname: 'example.test', pathname: '/**' },
  { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
  { protocol: 'https', hostname: 'example.com', pathname: '/**' },
];
```

The wildcard `/res.cloudinary.com/**` is intentional: it accepts every cloud name. Locking to `/<CLOUDINARY_CLOUD_NAME>/**` would force a config rewrite when the cloud name rotates between environments. The `/demo/**` pattern is added because Cloudinary's documentation cloud (`demo`) is used in seed data and in some Playwright fixtures.

---

## 8. Environment variables

### Backend (`quiz_backend/.env.example`)

```bash
# Cloudinary cloud name (visible in the dashboard URL).
CLOUDINARY_CLOUD_NAME=change-me

# Cloudinary API key. NEVER expose to the frontend.
CLOUDINARY_API_KEY=change-me

# Cloudinary API secret. NEVER expose to the frontend. Server-only.
CLOUDINARY_API_SECRET=change-me

# Cloudinary folder prefix. The adapter composes public_id as
# `${CLOUDINARY_FOLDER}/${ownerId}/${uuidv7}`. Dev/prod cannot collide:
#   dev:  quiz-app-dev
#   prod: quiz-app
CLOUDINARY_FOLDER=quiz-app-dev
```

### Frontend (`quiz_frontend/.env.example`)

```bash
# Cloudinary cloud name (Phase 9 of the migration plan).
# Used by deriveUrlClient() in src/lib/storage/public-id-pattern.ts.
# This is NEXT_PUBLIC_ — the cloud name is not a secret.
# API key + API secret are server-only and NEVER set here.
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
```

### `.gitignore`

`quiz_backend/.env` and `quiz_frontend/.env.local` are both gitignored. The CI secret scanner has a rule for `CLOUDINARY_API_SECRET=...` that fails the build if the literal env var name appears outside `.env`/`.env.local` (see `scripts/check-cloudinary-secret-bundle-leak.mjs`).

---

## 9. Migrate-on-write (Phase 7)

Existing rows with Base64 strings in `user_profiles.avatar_url` and `quizzes.image_url` continue to render because `UserResponseMapper` / `QuizResponseMapper` prefer the new column and fall back to the legacy column:

```ts
// UserResponseMapper.toUserMeResponse
const avatarUrl = avatarPublicId ? this.storage.deriveUrl(avatarPublicId, 'avatar') : row.avatarUrl; // legacy Base64 row continues to render
```

The first user-initiated save through the new upload flow overwrites the Base64 string with a `public_id`. No script runs in production; no data migration is needed. See `image-storage-audit.md §11` for the full rationale.

---

## 10. Test matrix (§14)

### Unit tests (Jest)

| File                                                                | Coverage                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `core/storage/infrastructure/cloudinary/cloudinary.adapter.spec.ts` | Folder/ownerId/UUIDv7 composition; error mapping; idempotent delete.                                                                 |
| `core/storage/domain/upload-policy.spec.ts`                         | Snapshot of the per-purpose policy table; SVG exclusion; `fill/auto/auto/auto` transformation.                                       |
| `core/storage/domain/storage-port.contract.spec.ts`                 | Any adapter must satisfy this contract: upload produces `${folder}/${ownerId}/${uuidv7}`; delete is idempotent; `deriveUrl` is pure. |
| `core/storage/application/storage.application.service.spec.ts`      | `bindAssetToOwner`, `userOwnsAssetForPurpose`, `unbindAsset`.                                                                        |
| `core/storage/application/storage-image-lifecycle.service.spec.ts`  | Replace/remove/delete + retry-once + idempotent.                                                                                     |
| `modules/upload/application/upload.application.service.spec.ts`     | Per-purpose size cap; per-purpose MIME allowlist; ownership bind failure path.                                                       |
| `modules/user/application/user.application.service.spec.ts`         | §11 gate integration: cross-user / cross-purpose / forged.                                                                           |
| `modules/quiz/application/quiz.application.service.spec.ts`         | Same matrix for quiz covers.                                                                                                         |
| `modules/user/mappers/user-response.mapper.spec.ts`                 | `deriveAvatarUrl` precedence (`publicId` over `avatarUrl`).                                                                          |
| `modules/quiz/mappers/quiz-response.mapper.spec.ts`                 | `deriveImageUrl` precedence.                                                                                                         |

### E2E (Jest supertest)

| File                                     | Coverage                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `test/uploads-and-ownership.e2e-spec.ts` | Cross-user theft, forged publicId, cross-purpose reuse, owner-allowed, null-clears, 401 on missing auth. |

### E2E (Playwright)

| File                               | Coverage                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `e2e/uploads/upload-field.spec.ts` | Multipart upload happy-path; client-side oversize rejection; forged-publicId shape check. |
| `e2e/uploads/uploads.helpers.ts`   | Network stubs (`/api/v1/auth/me`, `/api/v1/uploads`, `/api/v1/users/me`).                 |

### Security scripts

| File                                              | Coverage                                          |
| ------------------------------------------------- | ------------------------------------------------- |
| `scripts/check-cloudinary-secret-bundle-leak.mjs` | Source + bundle scan for `CLOUDINARY_API_SECRET`. |

---

## 11. Security guarantees

1. **MIME allowlist** — `FileTypeValidator` + per-purpose `UPLOAD_POLICY.allowedMime` (no SVG; XSS-via-SVG rejected at the DTO).
2. **Size cap** — `MaxFileSizeValidator` (8 MB hard ceiling) + per-purpose cap (5 MB avatar, 8 MB quiz).
3. **Rate limit** — `POST /api/v1/uploads` is `@Throttle({ default: { limit: 20, ttl: 60_000 } })`.
4. **Server-only credentials** — `CLOUDINARY_API_SECRET` is never sent to the frontend; the bundle scanner enforces this on every PR.
5. **Magic-byte check** — Cloudinary's SDK runs server-side; mismatches surface as `UPLOAD_PROVIDER_UNAVAILABLE`.
6. **JSON body limit** — `main.ts` sets an explicit 1 MB JSON body limit (the previous default was unbounded, which would have allowed attackers to bloat Postgres with Base64).
7. **§11 ownership rule** — every PATCH/POST that carries a `publicId` calls `userOwnsAssetForPurpose` **before** the DB write. Same response for missing row and wrong owner (no oracle).
8. **Structural shape validation** — the DTO `@Matches(STORAGE_PUBLIC_ID_TAIL_PATTERN)` catches forged/guessed strings before the DB lookup.
9. **Idempotent delete** — `STORAGE_PORT.delete('not-found')` resolves. The lifecycle service retries once on 5xx and then logs a warning.
10. **Best-effort cleanup on bind failure** — if `bindAssetToOwner` throws after a successful Cloudinary upload, the adapter delete runs to avoid orphaning the asset.

---

## 12. OpenAPI regeneration

The OpenAPI spec must be regenerated whenever the upload DTO or controller changes:

```bash
cd quiz_backend
pnpm start:dev   # in one terminal
pnpm generate:openapi  # in another — hits /api/v1/docs/openapi.json
git add docs/generated/openapi.json
```

The frontend Orval SDK is regenerated from the spec:

```bash
cd quiz_frontend
pnpm generate:api    # runs Orval against docs/generated/openapi.json
```

If you skip regeneration, the SDK may still type-check (the typed inputs are hand-maintained in `src/lib/api/generated/schemas/{createQuizDto,updateQuizDto,updateMeDto}.ts` with `TODO` markers), but at runtime the SDK will pass stale fields and the server will return 400 `BAD_REQUEST`.

---

## 13. Future revisions (intentionally out of scope)

- **Question image and category image** — keep URL-only for this revision. When the second use-case lands, extend `UPLOAD_POLICY` with a `question` and `category` purpose; the ownership model already supports arbitrary purposes.
- **TTL orphan sweep** — a cron job that lists Cloudinary resources in `quiz-app-dev/` and reconciles against `storage_assets`, deleting any orphans older than 30 days. This is documented in `cloudinary-migration-plan.md §10` but not implemented.
- **Drop legacy columns** — once `avatar_url` / `image_url` are `NULL` for a sustained window (e.g. 30 days of zero rows in a CI query), drop them in a follow-up Drizzle migration.
- **Custom Cloudinary delivery domain** — if a CNAME is added, swap `res.cloudinary.com` in `next.config.ts` `remotePatterns` and in `deriveUrl` / `deriveUrlClient`.
