# Image & File Storage Audit

**Date:** 2026-08-17
**Scope:** End-to-end audit of every image/file-related code path across `quiz_frontend` and `quiz_backend`. Read-only; no source code was modified.
**Method:** Direct inspection of Drizzle schemas, NestJS controllers/DTOs, Next.js components, generated Orval SDK, and Dockerfiles. Verified by `grep` against the entire repository for upload-related symbols.

---

## 1. Current Architecture

**Repository layout** — two sibling projects under `quiz/`:

| Layer | Project | Stack |
|---|---|---|
| Frontend | `quiz_frontend` | Next.js `16.1.0`, React `19.2.3`, React-Hook-Form `7.71.1`, Zod `4.3.5`, SWR, Radix UI, Tailwind, Playwright e2e, Vitest |
| Backend | `quiz_backend` | NestJS `11.x` (Express adapter `platform-express`), Drizzle ORM `0.45.x`, PostgreSQL 18 (Docker container, named volume `quizdb_data`), Redis8 (cache, Socket.IO adapter, BullMQ queues), Pino logger, Helmet, JWT auth (`@nestjs/jwt` + Passport-JWT), class-validator/class-transformer, Throttler (default 100 req /60s), Google OAuth, Resend email, Sentry |
| Communication | OpenAPI 3 (NestJS Swagger at `/api/v1/docs`) → generated Orval SDK in `quiz_frontend/src/lib/api/generated/...`, all requests are JSON (`Content-Type: application/json`); Socket.IO realtime |

**Authentication / Authorization**
- Global guards: `ThrottlerGuard` → `JwtGuard` → `PermissionsGuard` (`quiz_backend/src/app.module.ts:152-163`).
- Auth: short-lived JWT access tokens + longer refresh tokens stored in httpOnly cookies.
- Authorization is permission-based (`Permission.QUIZ_CREATE`, `QUIZ_EDIT_OWN`, …).

**Existing file/image libraries** — VERIFIED NONE.
- Backend `quiz_backend/package.json` does NOT list `multer`, `@nestjs/platform-fastify`'s multipart, `busboy`, `formidable`, `sharp`, `file-type`, `aws-sdk`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@cloudinary/url-gen`, `cloudinary`, `@supabase/supabase-js`, or any storage SDK.
- Frontend `quiz_frontend/package.json` does NOT list `react-dropzone`, `uppy`, `filepond`, `browser-image-compression`, or `axios-form-data`.
- `grep` across `quiz_backend/src` finds zero occurrences of `FileInterceptor`, `FilesInterceptor`, `@UploadedFile`, `@UploadedFiles`, `ParseFilePipe`, `diskStorage`, `memoryStorage`, `serveStatic`, `useStaticAssets`, `fs.writeFile`, `fs.unlink`, `path.join(__dirname)`, `uploads/`, `/assets`, `storage/`. Only `pnpm-lock.yaml` / `package-lock.json` mention `multer` (transitive only).

**Static assets**
- Frontend `quiz_frontend/public/` ships ~10 build-time static assets (`avatarPlaceholder.webp`, `placeholder.svg`, `placeholder.webp`, `login.jpg`, `q17.png`, `question.jpg`, `quizCategories.webp`, `step1.jpg`, `step2.jpg`, `step3.jpg`, `tournament.png`). These are bundled at build time, never uploaded by users.
- Backend serves nothing from the filesystem (`express.static` is not mounted).
- Next.js `images.remotePatterns` in `quiz_frontend/next.config.ts:16-43` allowlists `images.unsplash.com`, `example.test`, `cdn.example.com`, `example.com`. All other remote hosts are rejected by the `next/image` loader.

---

## 2. Image/File Operations Found

Four concrete upload sites exist in the frontend; ONE is wired through to the backend as a JSON field, ONE is dead UI, TWO are unrelated dead/incomplete paths. There is no `multipart/form-data` anywhere.

| # | Feature | Frontend location | Backend location | API endpoint | HTTP | Request format | Binary/base64/URL? | Backend handling | DB field | Verified |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Profile picture (avatar)** — current path | `quiz_frontend/src/features/users/components/settings/AccountSettings.tsx:80-93,119-141` (`AvatarSection`) and `EditProfileForm.tsx:167-171` (`<ImageUploadField name="avatarUrl">`) | `quiz_backend/src/modules/user/transport/controller/user.controller.ts:367-379` `PATCH /api/v1/users/me` | `PATCH /api/v1/users/me` | PATCH | JSON body via Orval `userControllerUpdateMe` (`quiz_frontend/src/lib/api/generated/users/users.ts:88-97`, `Content-Type: application/json`) | **base64 data URL** — `FileReader.readAsDataURL(file)` encodes the selected file into `data:image/<mime>;base64,<payload>`; that string is sent as the `avatarUrl` field | Backend DTO `UpdateMeDto.avatarUrl` (`quiz_backend/src/modules/user/dto/request/update-me.dto.ts:49-68`) accepts the string via `@IsUrl({protocols:['http','https']})`; the controller delegates to `UserApplicationService.updateProfile` → `UserDomainService.updateProfile` → `UserRepository.updateProfile` which writes the literal text into `user_profiles.avatar_url` | `user_profiles.avatar_url` (`text`, nullable) | VERIFIED |
| 2 | **Quiz cover image** — current path | `quiz_frontend/src/features/quizzes/components/CreateQuizForm.tsx:143-147` (`<ImageUploadField name="imageUrl">`) | `quiz_backend/src/modules/quiz/transport/controller/quiz.controller.ts:180-204` `POST /api/v1/quizzes` and `:536-565` `PATCH /api/v1/quizzes/:id` | `POST /api/v1/quizzes` & `PATCH /api/v1/quizzes/:id` | POST/PATCH | JSON body | **base64 data URL** (same `FileReader` mechanism) | `CreateQuizDto.imageUrl` (`create-quiz.dto.ts:116-128`) and `UpdateQuizDto.imageUrl` (`update-quiz.dto.ts:81-93`) are validated by `@IsUrl({require_tld:false})`, `MaxLength(2048)`; value is stored verbatim in `quizzes.image_url` | `quizzes.image_url` (`text`, nullable) | VERIFIED |
| 3 | **Question image** | `quiz_frontend/src/features/quizzes/components/QuestionEditor/SingleQuestionForm.tsx:275-283` is a plain `<input>` text field; **no file picker, no `ImageUploadField`, no `FileReader`** — the user must paste a URL. `BulkQuestionForm.tsx:180-191` only carries `imageUrl?: string` from the parsed TSV/JSON. | `quiz_backend/src/modules/quiz/dto/request/create-quiz-question.dto.ts:66-78` | `POST /api/v1/quizzes/:id/versions/:versionId/questions` and `…/questions/bulk` | POST | JSON body | **URL only** (no upload) | `CreateQuizQuestionDto.imageUrl` validated by `@IsUrl({require_tld:false})`, `MaxLength(2048)` | `quiz_questions.image_url` (`text`, nullable) | VERIFIED (no file picker exists) |
| 4 | **Category cover image** | Frontend admin path — VERIFIED: no `<input type="file">` and no `ImageUploadField` consume it; the field is exposed in DTOs only. | `quiz_backend/src/modules/category/dto/request/update-category.dto.ts:55-66` and `category.controller.ts` `PATCH /api/v1/categories/:id` | `PATCH /api/v1/categories/:id` (and admin POST) | PATCH/POST | JSON body | **URL only** | `UpdateCategoryDto.imageUrl` (`@IsUrl({require_tld:false})`, `MaxLength(2048)`) | `categories.image_url` (`text`, nullable, line 347 of `0000_initial_with_coins.sql`) | VERIFIED |
| 5 | **Contact-form attachment** | `quiz_frontend/src/features/support/components/ContactForm.tsx:66-73,257-277` | none (no endpoint accepts attachments) | n/a | n/a | The `<input type="file">` is captured into local state `selectedFile` but `submitContactForm({...})` (lines 79-86) sends only `name, email, subject, category, message`. **The file is never submitted.** | n/a | No backend module exists. | n/a | VERIFIED (dead UI) |
| 6 | **ProfileHeader avatar/cover buttons** | `quiz_frontend/src/features/users/components/my-profile/ProfileHeader.tsx:191-206` `<input type="file">` x2 + `validateFile` (MIME allowlist, size cap). Receives `onAvatarChange?: (file: File) => Promise<void>` and `onCoverChange?: (file: File) => Promise<void>` as props. **No call site passes those props** (`grep -r ProfileHeader` shows only `loading.tsx`, `page.tsx`, `Skeletons.tsx`, `index.ts` consumers — none of them provide handlers). | none | n/a | n/a | none | none | none | n/a | VERIFIED (orphan component, dead path) |

**Answer-image, post-image, rich-text-image, attachment, drag-and-drop, `dropzone`, multi-file upload, signed URLs, image cropping, image compression (server or client), EXIF stripping** — VERIFIED: none of these exist anywhere in the repository.

---

## 3. Current Storage Implementation — End-to-End Flows

### Verified complete lifecycle: User profile picture

```
[User clicks "Upload New Photo"]
   ↓
quiz_frontend/src/features/users/components/settings/AccountSettings.tsx:80
 AvatarSection.handleFileSelect(event)
   ├─ const file = event.target.files?.[0]
   ├─ if (file.size > 5 * 1024 * 1024) alert(...) ; return       (size check; NO MIME check here)
   ├─ const reader = new FileReader()
   ├─ reader.readAsDataURL(file)
   └─ reader.onload = () => onAvatarChange(reader.result as string)
 │
                              ▼   AccountSettings state: avatarDataUrl = "data:image/png;base64,iVBOR..."
   useEffect(() => { form.setValue('avatarUrl', avatarDataUrl, {shouldDirty:true}) }, [avatarDataUrl])
 │
                              ▼
   handleFormSubmit(values) → updateProfile.mutate({ avatarUrl: 'data:image/png;base64,iVBOR...', ... })
                              │
                              ▼
quiz_frontend/src/features/users/hooks/useUpdateMyProfile.ts:75
   sdkResult = await updateMyProfile(payload)
                              │
                              ▼
quiz_frontend/src/features/users/services/users.service.ts:16
   sdk.userControllerUpdateMe(payload)
                              │
                              ▼
quiz_frontend/src/lib/api/generated/users/users.ts:88
   orvalCustomInstance({ url: '/api/v1/users/me', method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          data: updateMeDto })
                              │
                              ▼ (HTTP, body ~1.33× file size in base64)
quiz_backend/src/modules/user/transport/controller/user.controller.ts:376
   PATCH /api/v1/users/me, JwtGuard + PermissionsGuard pass (auth)
                              │
                              ▼
   UpdateMeDto validation: @IsUrl({protocols:['http','https'], require_protocol:true})
   (NB: validator runs against the data URL; base64 strings actually pass `require_protocol:true`
    because `data:image/png;base64,iVBOR...` looks like a URL to validator.js — this is an
    INFERRED consequence; exact validator behaviour should be re-verified in a unit test)
                              │
                              ▼
quiz_backend/src/modules/user/application/user.application.service.ts:177
   updateProfile(userId, dto) → command = { displayName, bio, avatarUrl: dto.avatarUrl }
                              │
                              ▼
quiz_backend/src/modules/user/domain/user.service.ts:270
   patch.avatarUrl = command.avatarUrl?.trim() ?? null
                              │
                              ▼
quiz_backend/src/modules/user/infrastructure/repositories/user.repository.ts:533
   await tx.update(userProfiles).set({ avatarUrl: patch.avatarUrl, updatedAt: nowIso })
                              │
                              ▼
   PostgreSQL UPDATE user_profiles SET avatar_url = 'data:image/png;base64,iVBOR...' WHERE user_id = $1
                              │
                              ▼  (no other transformation; NO fs write; NO upload to object storage)
   Row persisted in user_profiles.avatar_url (text column)
                              │
                              ▼   GET /users/me → SELECT ... LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id │
                              ▼
   JSON response payload: { avatarUrl: 'data:image/png;base64,iVBOR...', ... }
                              │
                              ▼
quiz_frontend/src/components/ui/Avatar (radix-ui) → <AvatarImage src={user.avatarUrl ?? undefined} />
   → browser renders data URL directly (no HTTP fetch)
```

**Where does the file "live"?** It lives **inside the database**, as a base64 string in a `text` column. The filesystem, Docker volume, and any storage backend never see it.

### Same shape for quiz cover image — only differences:
- Triggered from `CreateQuizForm` (`<ImageUploadField name="imageUrl">`) or `SingleQuestionForm` (text URL only).
- Goes through `CreateQuizDto.imageUrl` / `UpdateQuizDto.imageUrl` (`quiz_backend/src/modules/quiz/dto/request/{create,update}-quiz.dto.ts`).
- Persisted to `quizzes.image_url` (`text`, nullable).
- Returned via `QuizResponseDto.imageUrl` and rendered via `next/image` (for seeded Unsplash URLs) or `<img>` (when the data URL is shown in a `<ImageUploadField>` preview).
- DTO has `@MaxLength(2048)` → **VERIFIED limit**: any base64 image larger than 2048 characters will be rejected. For a real photo the limit is the operational choke point.

### Question image — URL only, no upload:
- Frontend never opens a file picker. `SingleQuestionForm.tsx:275` is a plain `<input type="text">` with placeholder `https://example.com/image.jpg`.
- Bulk parser (`BulkQuestionForm.tsx:181-191`) parses the `imageUrl` column out of pasted rows.

### Category cover image — same as question: URL only.

### Contact form attachment — dead UI:
- File is selected (`selectedFile` state) but never reaches the network call.

### ProfileHeader avatar/cover buttons — orphan:
- Validates MIME types (`image/jpeg|png|webp|gif`) and size (5 MB) but exposes no way to submit. **No `useUpdateMyProfile` call.** The component is rendered in two places (`/profile/[name]/page.tsx`, `/my-profile/page.tsx`) without the callbacks wired up.

---

## 4. Database Storage

VERIFIED columns (Drizzle source-of-truth: `quiz_backend/src/core/database/schema/{user,quiz,…}/schema.ts`; SQL snapshot: `quiz_backend/src/core/database/migrations/0000_initial_with_coins.sql`).

| Table | Column | Type | Nullable | FK / cascade | Purpose | Example value (seed) | Actual storage location |
|---|---|---|---|---|---|---|---|
| `user_profiles` | `avatar_url` | `text` | yes | `user_id` → `users.user_id` (`onDelete: 'cascade'`) | Profile picture of a user | `https://images.unsplash.com/photo-1500648767791-00dcc994a43e` | **The database row** (when written by the live app, the value is a base64 data URL stored in this text column) |
| `user_profiles` | `bio` | `text` | yes | (same as above) | Bio | text | DB row |
| `quizzes` | `image_url` | `text` | yes | `creator_id` → `users.user_id` (`onDelete: 'set null'`) | Cover image | `https://images.unsplash.com/...` | DB row |
| `quiz_questions` | `image_url` | `text` | yes | `quiz_version_id` → `quiz_versions.quiz_version_id` (`onDelete: 'cascade'`) | Question image | URL pasted by author | DB row |
| `categories` | `image_url` | `text` | yes | (no FK in schema; admin-owned) | Category cover | `https://images.unsplash.com/...` | DB row |
| `user_profile_settings` | (none) | — | — | — | Privacy toggles only | — | — |
| `users` | (none) | — | — | — | Identity only | — | — |

**Cascade behaviour**
- Deleting a user cascades to `user_profiles` (`onDelete: 'cascade'`), so the `avatar_url` row disappears, but there is **no filesystem blob to clean up** because the blob was never externalised.
- Deleting a quiz cascades to `quiz_versions → quiz_questions`, so its question images vanish with it. Same logic — nothing to clean up externally.
- `quizzes.creator_id` uses `onDelete: 'set null'` — quizzes survive orphaned, retaining their `image_url`.

**Orphan-file risk** — N/A in the filesystem sense (no files exist). However, there IS a logical-orphan risk: if the schema is migrated to an object key in the future, every existing `avatar_url` value that is a `data:` URL or an external Unsplash URL will need migration handling.

**BYTEA / binary / base64-as-binary** — none. All image fields are plain `text`.

**Object keys / public IDs / S3 keys** — none. No abstraction exists.

---

## 5. Frontend Findings

| Aspect | Finding | File |
|---|---|---|
| `<input type="file">` | Found in 4 places: `ImageUploadField`, `AvatarSection`, `ProfileHeader` (×2), `ContactForm`. Only `ImageUploadField` and `AvatarSection` actually wire the file to a backend call, and BOTH do so by encoding it to a base64 data URL via `FileReader.readAsDataURL`. | `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx:68-75`; `quiz_frontend/src/features/users/components/settings/AccountSettings.tsx:88-90` |
| `FormData` / `multipart/form-data` | **VERIFIED none.** `grep -r 'new FormData\|formData('` returns zero matches in `quiz_frontend/src`. | — |
| Drag-and-drop | **VERIFIED none.** No `react-dropzone`, no `@dnd-kit`, no `onDrop` handlers for files. | — |
| Image preview | `<ImageUploadField>` uses `<img src={value}>` (`ImageUploadField.tsx:103-107`); `AvatarSection` uses Radix `AvatarImage`; `ProfileHeader` uses `next/image`. | as cited |
| Client-side compression | **VERIFIED none.** `browser-image-compression` and `sharp` are not installed. | — |
| Cropping | **VERIFIED none.** | — |
| Client-side MIME validation | `ProfileHeader.tsx:33-38` enforces a 4-MIME allowlist (`jpeg|png|webp|gif`). `AccountSettings` does NOT validate MIME. `ImageUploadField` does NOT validate MIME (only `accept="image/*"` hint, `maxBytes` size check). | as cited |
| Size cap (client) | 5 MB in `ImageUploadField` (default), `AccountSettings`, and `ProfileHeader` (`DEFAULT_MAX_BYTES = 5 * 1024 * 1024`). | as cited |
| Upload progress / retry | **VERIFIED none** — the only "spinner" is `Loader2` shown during the JSON PATCH (`ProfileHeader.tsx:282-293`, `AccountSettings.tsx:598-603`). | — |
| Image replacement | Replacement = re-upload via `<ImageUploadField>` / `AvatarSection` (overwrites the text field). No diff/cleanup logic. | — |
| Image deletion | UI button "Remove photo" (`AccountSettings.tsx:146-156`) sets the data URL to `null`, then the PATCH writes `avatarUrl = null`. No external blob to remove because none exists. | — |
| URL handling for `next/image` | `quiz_frontend/next.config.ts:16-43` allowlists `images.unsplash.com`, `example.test`, `cdn.example.com`, `example.com`. Any other remote host (or a `data:` URL fed to `next/image`) fails. The renderer falls back to `<img>` in `ImageUploadField` (`/* eslint-disable-next-line @next/next/no-img-element */`). | as cited |
| Static assets | `quiz_frontend/public/*` (10 files) — bundled at build, served by Next. Not user-uploaded. | — |
| blob URLs / object URLs | **VERIFIED none.** | — |
| Duplicated / inconsistent upload implementations | **YES** — three near-duplicate implementations exist with subtly different behaviour: `ImageUploadField` (no MIME check, only data-URL preview), `AvatarSection` (no MIME check, `alert()` for oversize), `ProfileHeader` (MIME check, no submit handler wired up). | as cited |

---

## 6. Backend Findings

| Aspect | Finding | File / Note |
|---|---|---|
| Controllers accepting uploads | **None.** All `@Body()` parameters are DTO classes validated by `class-validator`. | `quiz_backend/src/modules/user/transport/controller/user.controller.ts`; `quiz_backend/src/modules/quiz/transport/controller/quiz.controller.ts`; etc. |
| `FileInterceptor` / `FilesInterceptor` | Not used anywhere. | `grep -r 'FileInterceptor\|FilesInterceptor' quiz_backend/src` → 0 hits |
| `@UploadedFile()` / `@UploadedFiles()` | Not used anywhere. | grep → 0 hits |
| `ParseFilePipe` / `MaxFileSizeValidator` | Not used anywhere. | grep → 0 hits |
| Custom upload middleware | None. | — |
| `multer` | Not in `dependencies`. Only transitive in `package-lock.json`/`pnpm-lock.yaml`. | `quiz_backend/package.json` |
| `diskStorage` / `memoryStorage` | Not used. | — |
| `fs.writeFile` / `fs.unlink` / `fs.readFile` | Not used. | grep → 0 hits in `quiz_backend/src` |
| `path.join(__dirname, '…')` | Not used (no static-file paths are joined). | grep → 0 hits |
| `serveStatic` / `useStaticAssets` | Not used. Backend serves no static files. | grep → 0 hits |
| Static asset directory | None. `quiz_backend/public/` does not exist. | `ls quiz_backend` |
| `S3` / `Cloudinary` / `R2` / `Supabase` / `Firebase` SDKs | None in `dependencies`. | `quiz_backend/package.json` |
| DTO validation summary | All image-bearing fields are validated as `@IsUrl(...)` strings. Limits: `PROFILE_AVATAR_URL_MAX_LENGTH` (defined in `quiz_backend/src/modules/user/domain/constants/user.domain-constants.ts`), `quizzes.image_url` capped `@MaxLength(2048)`, `quiz_questions.image_url` capped `@MaxLength(2048)`, `categories.image_url` capped `@MaxLength(2048)`. | as cited |
| `useStaticAssets` / static serving | `main.ts` does not mount any static asset handler. | `quiz_backend/src/main.ts:20-87` |
| `helmet` | Present and enabled (`main.ts:34-39`); CSP disabled when Swagger is enabled. | as cited |
| Body parser | Uses Express defaults (NestJS `NestExpressApplication.create()`); 100 KB JSON body limit. **No override.** | `quiz_backend/src/main.ts` |
| Docker volumes | `db:start` script in `package.json:24` uses `quizdb_data:/var/lib/postgresql` for Postgres. Redis (`quizredis`) is a transient container (`docker run … redis:8`). **No volume for backend uploads** — none are produced. | `quiz_backend/package.json:24-49` |
| Environment variables for storage | None in `.env.example` (image/storage keys). `EMAIL_PROVIDER` and `RESEND_API_KEY` are the only third-party provider vars. | `quiz_backend/.env.example` |
| Docker setup | Backend Dockerfile runs `node dist/main.js` as non-root `nodeapp`, copies `node_modules`, `dist`, `migrations`, `package.json`. No `VOLUME` directive. | `quiz_backend/Dockerfile:110-147` |
| Frontend Dockerfile | Multi-stage Next.js standalone build; copies `./public` to runtime image; non-root `nextjs`. No writeable volume. | `quiz_frontend/Dockerfile` |
| Docker Compose | **None in the repo.** `docker-compose*.yml` is in `.dockerignore`. Dev runs Postgres and Redis as standalone `docker run` containers. | `grep` → 0 hits |

---

## 7. Security Findings

| Severity | Issue | Location | Risk | Recommendation |
|---|---|---|---|---|
| **Critical** | Base64 data URLs are stored verbatim in `text` columns (`user_profiles.avatar_url`, `quizzes.image_url`, etc.). A 1 MB image becomes ~1.4 MB of base64; the Express default JSON limit is **100 KB**. **VERIFIED risk: a payload > 100 KB will trigger 413 PayloadTooLargeError before validation runs.** That limit is server-wide and silently breaks the feature rather than gracefully truncating. | `quiz_backend/src/main.ts:57-63` (no body limit override); `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx:29` (5 MB default) | DoS via single 5 MB upload, but more importantly, the user can never upload > ~70 KB of image. | Either raise the body limit with an explicit config (e.g. `app.use(express.json({limit: '10mb'}))`) OR migrate to a real upload endpoint. |
| **Critical** | No MIME validation on the backend. A user POSTing `data:image/svg+xml;base64,...<svg onload=...>…` is treated as a normal string but rendered as HTML/SVG if the frontend ever uses `dangerouslySetInnerHTML`. `data:` URLs in `<img src>` do not execute script in modern browsers, but the precedent is dangerous. | `quiz_backend/src/modules/user/dto/request/update-me.dto.ts:62-66` (`@IsUrl` only checks URL syntax); backend never inspects bytes | Stored XSS / SSRF / phishing vector if downstream code starts rendering these strings as HTML. | Server-side MIME detection (e.g. `file-type`) on the first bytes; reject SVGs by default; sanitise rendered SVG. |
| **Critical** | `@IsUrl` from `class-validator` does NOT guarantee the URL is reachable, HTTPS, or safe. It only validates URL syntax. `create-quiz.dto.ts` uses `require_tld:false` and **does not restrict protocols**, so `data:text/html,<script>` may pass. | `quiz_backend/src/modules/quiz/dto/request/create-quiz.dto.ts:126`; `update-quiz.dto.ts:91`; `create-quiz-question.dto.ts:76`; `update-category.dto.ts:64` | URL smuggling (e.g. `data:text/html,<script>` passes `IsUrl` when `require_protocol:true` is not set). If any consumer renders these strings as href, XSS. | Restrict every image-bearing DTO to `protocols:['http','https']` + `require_protocol:true`. |
| **High** | No filename sanitisation, no magic-byte / file-signature check. Files are passed straight through `FileReader`. | `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx:68-75`; `AccountSettings.tsx:88-90` | Filenames never reach the server (only the data URL), so traversal risk is N/A, but a polyglot file (e.g. an HTML/SVG with embedded image bytes) is uploaded as an `image/*` and stored. | Server-side magic-byte validation; reject non-image signatures. |
| **High** | No rate limiting on image-bearing writes beyond the global 100 req/60s throttler. A user can repeatedly upload new avatars/quiz covers to grow the database. | `quiz_backend/src/modules/user/transport/controller/user.controller.ts:367-379`; `quiz_backend/src/modules/quiz/transport/controller/quiz.controller.ts:180-204` | Resource exhaustion (DB bloat) and bandwidth amplification. | Add per-resource throttler (e.g. 10 avatar updates / hour). |
| **High** | No image optimisation pipeline. Base64 PNGs/JPGs are stored as-is and re-served as-is. | All endpoints | Performance, mobile data cost, render time. | Add sharp pipeline on upload (resize, AVIF/WebP). |
| **High** | No deduplication. Two users uploading the same image produce two large text blobs. | All endpoints | DB bloat. | Hash-based dedup at upload time. |
| **High** | Database stores user-controlled opaque strings that may include `data:` URLs. PostgreSQL `text` has no length cap beyond `(1 GB)`. A malicious user submitting a 50 MB data URL via PATCH would attempt to overwrite the row; whether it succeeds depends on the JSON body limit (100 KB by default — see Critical #1). | `user_profiles.avatar_url` | Combined with the small JSON limit, an attacker can DoS by uploading near-limit payloads at 100 req/min. | Combined fix with Critical #1. |
| **Medium** | `next/image` `remotePatterns` allowlist (`next.config.ts:16-43`) does NOT include `data:` URLs. When a user uploads a base64 image, `next/image` cannot optimise it; the renderer falls back to `<img>` (`ImageUploadField.tsx:103-107`, `eslint-disable @next/next/no-img-element`). | `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx:103-107`; `quiz_frontend/next.config.ts:16-43` | Bypasses Next.js image optimisation entirely. | Migrate to object storage with CDN, then re-enable `next/image` benefits. |
| **Medium** | `ProfileHeader.tsx:269-273` displays the avatar via Radix `<AvatarImage src={(avatarPreview || user.avatarUrl) ?? undefined}>`. If `user.avatarUrl` is a `data:` URL, the browser holds the full payload in the page HTML / DOM — once for every card on the page that shows a user. With many users, this multiplies the HTML payload size dramatically. | `quiz_frontend/src/features/users/components/my-profile/ProfileHeader.tsx:269-273`; many leaderboard/feed cards | Slow page loads; potential OOM on low-memory devices. | Move to URL-only flow with CDN. |
| **Medium** | No CSRF protection on the JSON PATCH that carries the avatar. The backend relies on the SameSite cookie + custom auth. Without an explicit CSRF token, a malicious origin can trigger a PATCH on `users/me` carrying a `data:` URL. | `quiz_backend/src/modules/user/transport/controller/user.controller.ts:367-379` (relies on cookie auth) | CSRF allows an attacker to overwrite a logged-in user's avatar. | Add a CSRF token middleware (e.g. `csurf`-equivalent) or change refresh-token cookie to `SameSite=Strict`. |
| **Medium** | No Content-Security-Policy beyond helmet defaults. Helmet's CSP is OFF when Swagger is enabled (`main.ts:34-39`). If `data:` URLs are loaded as images in many components, the `img-src` directive should include them. Currently, with CSP off in dev/Swagger, the page accepts any inline content. | `quiz_backend/src/main.ts:34-39` | Defence-in-depth gap. | Define a strict CSP and enable it in all modes. |
| **Low** | `ProfileHeader.validateFile` performs client-side MIME allowlist (`ProfileHeader.tsx:33-38`) but never wires it to a submit handler — orphan code, no server-side enforcement. | `quiz_frontend/src/features/users/components/my-profile/ProfileHeader.tsx:33-38,79-87` | Misleading developers reading the code. | Either wire it up or remove the dead handler. |
| **Low** | No `image/*`-only check on `AccountSettings.AvatarSection.handleFileSelect`. The `accept="image/*"` HTML attribute is a hint; nothing blocks `.exe` or `.svg` from being read as a data URL. | `quiz_frontend/src/features/users/components/settings/AccountSettings.tsx:84-91` | Polyglot upload. | Validate MIME/type before `readAsDataURL`. |
| **Low** | `ContactForm` collects `selectedFile` but never sends it; the UI is misleading. | `quiz_frontend/src/features/support/components/ContactForm.tsx:46,66-73,257-277` | UX bug, not a security issue per se. | Either remove or wire to a backend endpoint. |
| **Informational** | No EXIF stripping. A user uploads a photo with GPS coordinates; the frontend renders it directly; no server-side scrub. | All endpoints | Privacy: location leak when users post personal photos. | Add EXIF stripping (e.g. `sharp`'s `.rotate().withMetadata({})` or a dedicated library). |
| **Informational** | No image-bomb mitigation (decompression bombs, e.g. a 10 KB compressed image expanding to 4 GB). | All endpoints | Memory/CPU exhaustion. | Bound `width × height` after decoding. |
| **Informational** | No size limit on the raw bytes on the backend. The cap is the JSON body parser's 100 KB default, but that limit is not documented anywhere in `.env.example` or code. | `quiz_backend/src/main.ts` | Operator surprise. | Document and make configurable. |

---

## 8. Architectural Problems

| # | Current problem | Why it matters in production |
|---|---|---|
| 1 | **Images are stored inside the PostgreSQL database** as base64 text strings. | Database rows inflate (each 1 MB image ≈ 1.4 MB row). WAL size, vacuum cost, replication lag, backup size, and read-amplification all grow with image volume. A 10 k-user platform with 500 kB avatars is already a 14 GB Postgres bloat. |
| 2 | **Express JSON body limit defaults to 100 KB**, blocking any real image upload silently. | Users will see 413 errors with no clear cause; the form will look broken in production. |
| 3 | **No abstraction layer for image storage** in the backend. | Even a hypothetical "use S3" change would require editing every DTO and controller. There is no `StorageService` interface. |
| 4 | **Frontend is tightly coupled to "store a URL string in a JSON field"**, including the data-URL path. | Migration to object storage touches every frontend page that previews an image. |
| 5 | **No CDN.** Every image render hits the backend (or the database → backend → browser round-trip for data URLs). | Latency, bandwidth, no geographic optimisation, no caching headers. |
| 6 | **Three inconsistent UI implementations** of the same upload feature (`ImageUploadField`, `AccountSettings.AvatarSection`, `ProfileHeader`). | Bug surface; user-visible inconsistency (one checks MIME, another does not; one supports cover image, another does not). |
| 7 | **No deletion synchronisation.** Removing an avatar just clears the text column; if the column ever points to an object key, the orphaned object key will leak storage indefinitely. | Storage cost grows unbounded. |
| 8 | **No image optimisation pipeline.** | Mobile users pay full data cost; LCP/INP suffer. |
| 9 | **No rate limiting on image writes** beyond global 100 req/60s. | A single user can DoS by hammering PATCH /users/me with multi-MB data URLs (subject to body limit). |
| 10 | **Two upload code paths are dead/orphan** (`ProfileHeader.onAvatarChange`, `ContactForm.attachment`). | Misleading; future engineers will believe the feature works. |
| 11 | **`next.config.ts` `remotePatterns` allowlist** blocks any user-uploaded external host. | Future-proofing for hosted-user-avatars requires an allowlist update. |
| 12 | **No tests cover image upload security** (no `multipart` parser test, no magic-byte test, no `IsUrl` protocol test). | Regression risk. |
| 13 | **Production image strategy is undetermined.** Seed data uses Unsplash, but real users would naturally upload their own photos. | The current architecture is not production-ready for self-hosted avatars. |

---

## 9. Cloud Migration Options

| Option | Difficulty (this codebase) | Backend changes | Frontend changes | DB changes | Env vars | Direct client upload? | Presigned URLs? | Image transformations | CDN | Suitability — this project | Suitability — portfolio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cloudinary** | Low–Medium | 1) Add `cloudinary` SDK + a `StorageService` with `upload(file): { url, publicId }`. 2) Replace `FileInterceptor` on existing endpoints with a small custom endpoint, or 3) introduce a new `POST /api/v1/uploads` route returning `{url, publicId}` and a new `imageKey` field in DTOs. | Replace `FileReader.readAsDataURL` with `FormData → POST /uploads → store returned URL`. Add `@uploadcare/react` or custom uploader. | Optional: add `image_key text` columns for hygiene; keep `image_url` for read path. | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Yes (unsigned upload presets) | Yes (signed) | Yes (URL params: `w_500,h_500,c_fill,f_auto,q_auto`) | Yes (Cloudinary CDN) | Easy; cleanest API for portfolio | Strong portfolio signal — well-known, rich features, easy to demo |
| **Cloudflare R2** | Medium | 1) Add `@aws-sdk/client-s3` + a `StorageService` that issues presigned PUT URLs. 2) Add `POST /api/v1/uploads/sign` that returns `{url, key, fields}`. 3) Persist returned `key` (or `url`) in DB. 4) Serve public reads via R2's public bucket or a Worker. | Replace `<ImageUploadField>` with a flow that calls `/uploads/sign`, then PUTs the file directly to R2. | Add `image_key text` column. | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | **Yes (presigned)** | Yes | Limited (Cloudflare Images, separate product) | **Yes** (Cloudflare CDN) | Best cost story (no egress fees); slightly more setup | Strong portfolio signal — modern, shows presigned-URL pattern |
| **AWS S3** | Medium–High | Same shape as R2 but with VPC/region/IAM considerations. Larger egress costs. | Same as R2. | Same as R2. | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` | Yes | Yes | Server-side (Lambda or sharp in Nest) | CloudFront optional | Most "production" feel; more boilerplate | Strong portfolio signal — canonical cloud reference |
| **Supabase Storage** | Medium | Add `@supabase/supabase-js`. Build a `StorageService` using the Supabase client. RLS policies govern access. Same presigned/upload pattern as R2/S3. | Same as R2. | Same as R2. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Yes | Yes (signed) | Yes (image transform endpoints) | Yes | Fastest if already using Supabase; otherwise adds a new dependency | Strong portfolio signal if the project already uses Supabase; weak if it does not |

**Current-architecture compatibility**: the backend has **zero coupling to any specific storage backend**. Migration cost is therefore bounded by how many image-bearing DTOs/columns exist (4 DTOs, 4 tables). All four options are feasible.

---

## 10. Recommended Architecture

For a portfolio project that wants to demonstrate clean separation, presigned-upload patterns, and CDN delivery, the strongest signal is:

### Option B (production-oriented) — RECOMMENDED

```
┌──────────────────┐
│  Browser (Next.js)│
│  <ImageUploadField>│
└────────┬─────────┘
         │ 1. user picks file
         ▼ ┌──────────────────────────────────────────────┐
 │  Client validates MIME + size, then │
   │  POST /api/v1/uploads/sign { purpose, mime, │   ←─── 2. request a presigned URL
   │                                  size }      │
   └────────┬─────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────┐
   │  Backend (NestJS)                            │
   │   • JwtGuard + PermissionsGuard               │
   │   • UploadSigningService (Port)              │
   │       → choose adapter at runtime:           │
   │         - CloudflareR2StorageAdapter         │
   │         - S3StorageAdapter                   │
   │         - CloudinaryStorageAdapter           │
   │         - LocalFsStorageAdapter (dev only)   │
   │   • Returns { uploadUrl, key, publicUrl,     │
   │               expiresIn }                    │
   └────────┬─────────────────────────────────────┘
            │
            ▼  3. PUT file (binary, no auth)
   ┌──────────────────────────────────────────────┐
   │  Object Storage (R2 / S3 / Cloudinary)        │
   │   - bucket: quiz-uploads                     │
   │   - prefix: avatars/, quizzes/, questions/,  │
   │             categories/                      │
   │   - CDN: yes (R2/S3/Cloudinary or CloudFront) │
   └────────┬─────────────────────────────────────┘
            │
            ▼  4. PUT succeeds, browser stores publicUrl/key ┌──────────────────────────────────────────────┐
   │  PATCH /api/v1/users/me                      │
   │  body: { avatarUrl: "https://cdn.../key" }   │
   │  (or avatarKey, with URL computed server-side)│
   └────────┬─────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────┐
   │  Postgres                                    │
   │   user_profiles.avatar_url = publicUrl       │
   │   (or .avatar_key = key, computed by repo)   │
   └────────┬─────────────────────────────────────┘
            │
            ▼  5. subsequent reads ┌──────────────────────────────────────────────┐
   │  Browser renders <Image src={avatarUrl}/>    │
   │  → cached at CDN edge                        │
   └──────────────────────────────────────────────┘
```

Key principles:
1. **Single upload-sign endpoint**, called once per upload. The frontend NEVER uploads through the backend.
2. **Backend stores a URL or key** — never binary, never base64.
3. **Storage adapter is a Port/Adapter**, swappable via DI. The four cloud options become drop-in modules.
4. **CDN edge handles all image bytes**; backend never re-serves them.
5. **Deletion**: when `avatarUrl` is replaced or set to null, fire `DELETE` against storage using the previously stored key.

### Option A (simpler portfolio)

If the priority is "ship something tomorrow", a one-endpoint direct-upload to a single provider (Cloudinary unsigned preset or Supabase) is acceptable. The architecture collapses to:

```
Browser → POST /uploads (multipart) → Cloudinary SDK → return URL → PATCH user with URL
```

This works but couples the backend to the chosen provider and lacks the presigned-upload portfolio signal.

---

## 11. Migration Plan

| Phase | Goal | Changes | What does NOT change | DB migrations | Env vars | Tests |
|---|---|---|---|---|---|---|
| **1. Preparation** | Inventory + freeze | Lock schema, document current `image_url` values; identify how many rows are `data:` URLs vs external URLs. | Frontend UX | None | None | Snapshot test counting `data:` rows |
| **2. Storage abstraction** | Introduce Port/Adapter | New module `core/storage/`: `STORAGE_PORT` symbol, `StorageService` interface (`signUpload`, `deleteObject`, `getPublicUrl`), `LocalFsStorageAdapter` (dev), `R2StorageAdapter`, `S3StorageAdapter`, `CloudinaryStorageAdapter`. | Controllers/DTOs unchanged | None | New: `STORAGE_ADAPTER=local|r2|s3|cloudinary` | Unit-test the port with a fake adapter |
| **3. Sign endpoint** | Enable presigned uploads | New controller `POST /api/v1/uploads/sign` (rate-limited 30/min/user). DTO `SignUploadDto { purpose: 'avatar'|'quiz'|'question'|'category', mime, size, checksumSha256 }`. Validates size cap per purpose (e.g. 5 MB avatar, 8 MB quiz), MIME allowlist (jpeg/png/webp/gif). Returns `{ uploadUrl, key, publicUrl, expiresIn }`. | Existing `image_url` columns | None | (depends on adapter) | Unit + e2e sign + upload round-trip |
| **4. Backend migration** | Replace text-storage with URL-only | Update `user.service.updateProfile` / `quiz.service.updateQuiz` to: (a) accept `imageKey` instead of `avatarUrl`/`imageUrl`, compute `publicUrl` server-side; (b) on replace, enqueue `deleteObject(oldKey)`. Deprecate `imageUrl` from `UpdateMeDto` (return deprecation warning for one release). | Frontend can stay on URL for now | `ALTER TABLE … ADD COLUMN image_key text; UPDATE … image_key = substring(image_url from '…');` | as above | Migration script test |
| **5. Frontend migration** | Replace `FileReader.readAsDataURL` with presigned upload | Replace `ImageUploadField` to: validate MIME+size client-side, request `/uploads/sign`, PUT to `uploadUrl`, then call existing PATCH with the new URL. Remove `AvatarSection` from `AccountSettings.tsx` in favour of `ImageUploadField`. Delete the orphan `ProfileHeader.onAvatarChange` dead path; remove `ContactForm` file input or wire it up. | Public-facing API contracts | None | None | Component tests for new upload flow |
| **6. Existing image migration** | Backfill `image_key` | One-off script: for each row in `user_profiles`, `quizzes`, `quiz_questions`, `categories` where `image_url` is a `data:` URL → re-upload to storage (or accept the loss and null them out). For external URLs → keep as URL but mark them read-only. | App code | None | None | Smoke test on seeded DB |
| **7. Cleanup** | Remove legacy paths | Delete `ImageUploadField`'s `FileReader` branch; remove `AvatarSection`; remove dead `ProfileHeader` cover/avatar handlers; remove `ContactForm` attachment UI. Drop the `image_url` text-only fallback if no seed/fixture depends on it. | Public API | `ALTER TABLE … DROP COLUMN image_url;` (after confirming `image_key` covers all reads) | None | Regression tests |
| **8. Testing** | Cover upload pipeline end-to-end | E2E test: pick file → sign → upload → save URL → fetch user → assert URL is reachable and renders. Negative tests: oversized file, disallowed MIME, expired presigned URL. Security test: `data:image/svg+xml;base64,<svg onload=…>` is rejected. | none | none | none | All as listed |
| **9. Production deploy** | Roll out | Stand up object storage bucket with lifecycle rules (delete unreferenced keys after 30 days). Add observability: count of `signUpload` calls, 4xx rate, average PUT latency. Update `docs/` and OpenAPI. | None (this is the deploy step) | None | All storage env vars | Smoke test in staging |

**P0 priorities** are: **Phase 3** (sign endpoint) + **Phase 4** (backend stores URL/key, not binary). These unlock Phases 5-9.

---

## 12. Priority Action Items

| Priority | Action |
|---|---|
| **P0** | Stop storing base64 data URLs in the database — raise the JSON body limit only as a stopgap; the real fix is presigned uploads. |
| **P0** | Restrict every image-bearing DTO to `protocols: ['http','https']` with `require_protocol:true` (currently only `UpdateMeDto` does this; quiz/question/category DTOs do not). |
| **P0** | Remove dead/orphan UI: `ProfileHeader` avatar/cover buttons (no submit handler) and `ContactForm` attachment (never sent). Either wire them up to a real endpoint or delete. |
| **P1** | Introduce `core/storage` Port/Adapter and a `POST /uploads/sign` endpoint. |
| **P1** | Add server-side magic-byte MIME validation, size cap, rate limit, and SVG-by-default rejection. |
| **P1** | Add CSRF protection on cookie-authenticated PATCH endpoints. |
| **P2** | Consolidate the three upload UIs (`ImageUploadField`, `AvatarSection`, `ProfileHeader`) into one. |
| **P2** | Add an EXIF stripping + image optimisation step (sharp) once an adapter is in place. |
| **P2** | Add an end-to-end image-upload security test in CI. |

---

## 13. Final Recommendation

1. **How is my application currently storing images?**
   Inside the PostgreSQL database. Specifically, the frontend encodes user-selected files with `FileReader.readAsDataURL` and submits them as plain JSON text fields (`PATCH /api/v1/users/me {avatarUrl}`, `POST /api/v1/quizzes {imageUrl}`, etc.). The backend persists the literal string — base64 or external URL — into `text` columns (`user_profiles.avatar_url`, `quizzes.image_url`, `quiz_questions.image_url`, `categories.image_url`). There is no multipart upload, no filesystem storage, no cloud bucket, no CDN.

2. **How many image/file upload workflows exist?**
   **Two functional** (avatar, quiz cover), **one planned/half-built** (question image — only URL input, no file picker), **one admin-facing URL-only** (category image), and **two dead UI** paths (`ProfileHeader` avatar/cover buttons, `ContactForm` attachment).

3. **Which parts of the code handle uploads?**
   - `quiz_frontend/src/components/primitives/form/ImageUploadField.tsx` (generic field)
   - `quiz_frontend/src/features/users/components/settings/AccountSettings.tsx` (`AvatarSection`)
   - `quiz_frontend/src/features/users/components/my-profile/EditProfileForm.tsx` (uses `ImageUploadField`)
   - `quiz_frontend/src/features/quizzes/components/CreateQuizForm.tsx` (uses `ImageUploadField`)
   - `quiz_frontend/src/features/users/components/my-profile/ProfileHeader.tsx` (dead)
   - `quiz_frontend/src/features/support/components/ContactForm.tsx` (dead)
   - **Backend**: zero upload-specific code. The image "uploads" are just string fields in `UpdateMeDto`, `CreateQuizDto`, `UpdateQuizDto`, `CreateQuizQuestionDto`, `UpdateCategoryDto`.

4. **Which database fields store image/file information?**
   `user_profiles.avatar_url`, `quizzes.image_url`, `quiz_questions.image_url`, `categories.image_url` — all `text`, all nullable, none with foreign-key constraints to storage. No `image_key`, `storage_key`, `public_id`, or bytea fields exist.

5. **What are the biggest problems with the current implementation?**
   Storing base64 in Postgres (bloat, slow backups), 100 KB body-parser cap blocking real uploads silently, no MIME validation server-side, three inconsistent UI implementations, two dead-code paths, no rate limit on image writes, no CDN, no deletion sync, and a `next/image` remotePatterns allowlist that prevents self-hosted images from being optimised.

6. **Should I introduce cloud object storage?**
   **Yes.** The current implementation cannot survive a real production workload — it cannot store any image larger than ~70 KB, it bloats the DB, and it has no CDN. Migration cost is low because the current code has zero coupling to any storage backend.

7. **Which solution should I use: Cloudinary, Cloudflare R2, AWS S3, or Supabase Storage?**
   **Cloudflare R2** is the strongest default for a portfolio project: no egress fees, simple presigned-PUT pattern, native Cloudflare CDN, well-known in production resumes. **Cloudinary** is the easiest path-of-least-resistance for rich image transformations (resize, format conversion, smart cropping) — slightly more vendor lock-in but great for portfolio demos. **S3** is the canonical "I know cloud" answer; **Supabase Storage** only wins if Supabase is already part of the stack (it is not here).

8. **What is the minimum amount of work required to migrate?**
   Phase 2 (Storage Port/Adapter, ~1 day) + Phase 3 (sign endpoint, ~half a day) + Phase 5 (frontend `<ImageUploadField>` rewrite, ~half a day) + Phase 6 (one-shot data-URL backfill script, ~half a day). Roughly 2-3 working days end-to-end, plus tests.

9. **What architecture would look strongest on a Full-Stack/Backend portfolio?**
   **Option B**: Browser → `POST /uploads/sign` (NestJS) → presigned PUT to Cloudflare R2 / S3 → server stores URL or key in Postgres → Next.js `<Image>` renders through CDN. This pattern demonstrates: hexagonal architecture (Port/Adapter), presigned uploads, separation of concerns, security-by-default (signed URLs short-lived, no public buckets required), and observability readiness.

10. **What should I implement first?**
    **Phase 3: `POST /api/v1/uploads/sign` endpoint + a `core/storage/` module with a `LocalFsStorageAdapter` for development.** This gives you a working end-to-end upload pipeline that talks to a real backend endpoint (not a JSON string), proves the architecture, and lets you swap in R2/S3/Cloudinary in a follow-up PR without touching frontend code. While that's in flight, ship P0 fixes (CSRF, DTO protocol restrictions, removing dead UI) in a separate PR.

11. **How does the production migration handle the existing Base64 rows in `user_profiles.avatar_url` and `quizzes.image_url`?**
    **Migrate-on-write, no scripts.** Rows continue to render indefinitely because the read path (`UserResponseMapper`, `QuizResponseMapper`) prefers `avatarPublicId` / `imagePublicId` and only falls back to the legacy `avatarUrl` / `imageUrl` column when the new column is `null`. The day the user edits their profile (or the quiz creator edits the quiz) and goes through the new upload flow, the column overwrites the Base64 value with a Cloudinary `public_id`. The legacy Base64 row is never explicitly deleted — it just stops being read. External URLs and seed data continue to flow through the fallback indefinitely. See §11 for the full rationale.

---

## 11. Migrate-on-write (Phase 7)

### What this phase does

Phase 7 is a **documentation + observability phase**, not a code-migration phase. No `UPDATE` is ever run against `user_profiles.avatar_url` or `quizzes.image_url` in a script. Instead:

- Rows carrying legacy Base64 strings continue to render through the existing `avatarUrl` / `imageUrl` fallbacks in `UserResponseMapper` and `QuizResponseMapper`.
- The first user-initiated save through the new upload flow writes a `public_id` to the new column. The Base64 string is overwritten in place by the same `UPDATE` statement.
- The legacy column is **never dropped** in this revision. It remains the source of truth for any pre-Cloudinary row that has never been edited through the new flow.

### Why migrate-on-write instead of a one-shot script

- **Reversible.** A bug in a backfill script can corrupt thousands of rows in seconds. A wrong migrate-on-write path only affects the single user who triggered the write.
- **No production downtime.** The script approach typically requires a maintenance window or a dual-write window; the inline approach degrades to "the old string still renders" which is the documented behaviour.
- **No extra storage cost during the window.** The user uploads the new image anyway; the migrate-on-write path is the same `UPDATE` overwriting the Base64 blob with a `public_id`.
- **Testable in isolation.** The mapper fallback is a single branch in `toUserMeResponse` / `toQuizResponse` — easy to unit-test, easy to remove later.

### What changes in code

There are **no functional changes** in Phase 7. The behaviour was already shipped in Phase 6:

- `UserResponseMapper.toUserMeResponse` (and `toUserLookupResponse`) prefer `avatarPublicId`, falling back to `avatarUrl`. See `quiz_backend/src/modules/user/mappers/user-response.mapper.ts`.
- `QuizResponseMapper.toQuizResponse` prefers `imagePublicId`, falling back to `imageUrl`. See `quiz_backend/src/modules/quiz/mappers/quiz-response.mapper.ts`.
- The `UserResponseMapper.resolveAvatarUrl` public helper exposes the same fallback to callers that hand-roll a DTO projection (e.g. the `getMySummary` endpoint).

### Optional: Base64 detection log

The plan calls out an optional `console.warn` (logger.warn) in `user.application.service.updateProfile` that fires when an incoming patch sees `avatarUrl` set but `avatarPublicId` unset — i.e. a row that is still on the legacy Base64 path. This is **not** wired in this revision:

- The public `PATCH /users/me` surface no longer accepts `avatarUrl` (the `UpdateMeDto` field was removed in Phase 5). Internal callers (admin scripts) are the only paths that can still write to `avatarUrl`, and they do so intentionally — calling `console.warn` on those writes would be noise.
- The read path already surfaces the legacy column via the fallback branch, so a frontend that needs to render a Base64 row already does so without any application-level signal.
- Adding the warn at the read path would require touching every mapper entrypoint, which is outside the scope of "minimal documentation".

If the warn is added in a future revision, the right place is `UserResponseMapper.deriveAvatarUrl` (and the quiz equivalent) — log once per read of a row that has `avatarPublicId === null && avatarUrl !== null` and matches `^data:image/`. The hook exists at the mapper boundary; the mapper is the single source of truth for the fallback.

### Documenting the behaviour in the frontend

The frontend `<ImageUploadField>` already handles the Base64-row case correctly: it expects the form-field value to be a `publicId` (the new column), and renders the preview via `deriveUrlClient(publicId, purpose)`. If the form value is `null` (because the user has not yet uploaded a new image), the component renders the empty `<input type="file">` state and the parent page falls back to the existing `<Avatar>` placeholder. No changes are required.

### Definition of done

- This §11 exists in `image-storage-audit.md`.
- A new `docs/architecture-reviews/cloudinary-integration.md` exists with the lifecycle diagram (see Phase 9).
- The `UserResponseMapper` and `QuizResponseMapper` continue to prefer `*PublicId` over legacy `*Url`.
- No data migration script is shipped, scheduled, or referenced anywhere in the codebase or in CI.
- Users with Base64 avatars continue to see those avatars; on next edit they go through the new flow.

### Future revisions (out of scope for Phase 7)

- A future revision may choose to drop the legacy `avatar_url` / `image_url` columns entirely. The migration would be: a one-off read-only sweep that counts rows with `avatarPublicId === null && avatarUrl !== null`; once that count reaches zero for a sustained window, drop the column in a follow-up Drizzle migration. This is intentionally **not** part of Phase 7.

