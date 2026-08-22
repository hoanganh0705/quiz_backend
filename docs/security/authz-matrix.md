# Authorization Matrix (IDOR Audit)

**Status:** Living document
**Owners:** Auth + Platform Security
**Last reviewed:** 2026-08-18

This document captures the **authoritative authorization decisions** for every endpoint that accepts a user-controlled identifier (the classic IDOR / BOLA attack surface). It exists so:

1. The next engineer who adds a `PATCH /resource/:id` endpoint knows the established pattern.
2. The E2E test suite (see Phase 4) can be generated mechanically from the matrix.
3. Auditors can review authorization decisions without reading every controller.

> **Rule of thumb:** If the request body contains a resource ID (e.g. `avatarPublicId`, `imagePublicId`, `tagIds`) **and** the resource is owned by a specific user, the controller MUST verify ownership before the DB write. The pattern lives in `StorageApplicationService.userOwnsAssetForPurpose`.

---

## Legend

| Column | Meaning |
|--------|---------|
| Endpoint | The HTTP verb + path. Body fields only listed when they carry a foreign ID. |
| Resource | The owned record that needs an authorization check. |
| Owner check | Where the ownership gate is enforced (service, controller, middleware, none). |
| Body fields | User-controlled IDs that require ownership verification (typically `*PublicId`). |
| Status | ✅ Verified · ⚠️ Needs follow-up · 🆕 New this phase |

---

## Avatar / Cover Image / Quiz Cover

These all flow through the same `storage_assets` table and the same `userOwnsAssetForPurpose` gate.

| Endpoint | Resource | Owner check | Body fields | Status |
|----------|----------|-------------|-------------|--------|
| `PATCH /users/me` | avatar | `UserApplicationService.updateProfile` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'avatar' })` | `avatarPublicId` | ✅ |
| `POST /quizzes` | quiz cover image | `QuizApplicationService.createQuiz` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'quiz' })` | `imagePublicId` | ✅ |
| `PATCH /quizzes/:quizId` | quiz cover image | `QuizApplicationService.updateQuiz` → `storageOwnership.userOwnsAssetForPurpose({ purpose: 'quiz' })` | `imagePublicId` | ✅ |
| `POST /uploads/sign` | upload signed URL | `UploadApplicationService` — purpose must match the authenticated user's intent | (n/a) | ✅ |

**Invariant:** `storage_assets.owner_id = auth.user.sub` MUST be `true` before any `*PublicId` is accepted in a write payload. The DTO `@Matches` validator catches malformed shapes upstream; the gate is the authoritative check on the `(publicId, owner, purpose)` triple.

---

## Quiz / Question / Version Mutations

| Endpoint | Resource | Owner check | Body fields | Status |
|----------|----------|-------------|-------------|--------|
| `PATCH /quizzes/:quizId` | quiz row | `QuizCommandService.updateQuiz` → `QuizPolicy.assertCanEdit(quiz.creatorId, user)` | none | ✅ |
| `DELETE /quizzes/:quizId` | quiz row | `QuizCommandService.softDeleteQuizById` → `QuizPolicy.assertCanDelete(quiz.creatorId, user)` | none | ✅ |
| `POST /quizzes/:quizId/versions` | quiz | `QuizVersionApplicationService` → policy check | `tagIds[]`, `categoryId` | ✅ |
| `PATCH /quizzes/:quizId/versions/:versionId` | version | policy check on parent quiz creator | `tagIds[]`, `categoryId` | ✅ |
| `DELETE /quizzes/:quizId/versions/:versionId` | version | policy check on parent quiz creator | none | ✅ |

---

## Attempts / Reviews / Bookmarks

| Endpoint | Resource | Owner check | Body fields | Status |
|----------|----------|-------------|-------------|--------|
| `POST /quizzes/:quizId/attempts` | quiz | none (any authenticated user may attempt) | none | ✅ |
| `PATCH /attempts/:attemptId` | attempt | `attempt.userId = auth.user.sub` checked in repository | `answers[]` | ✅ |
| `POST /quizzes/:quizId/reviews` | review | none (creator cannot self-review per `ReviewPolicy`) | none | ✅ |
| `PATCH /reviews/:reviewId` | review | `review.userId = auth.user.sub` checked in policy | none | ✅ |
| `DELETE /reviews/:reviewId` | review | `review.userId = auth.user.sub` checked in policy | none | ✅ |
| `POST /quizzes/:quizId/bookmarks` | bookmark | `bookmark.userId = auth.user.sub` enforced by repository | `collectionId` | ✅ |

---

## Account & Auth

| Endpoint | Resource | Owner check | Body fields | Status |
|----------|----------|-------------|-------------|--------|
| `POST /auth/register` | (none) | n/a | none | ✅ |
| `POST /auth/change-password` | session / password | `userId = auth.user.sub` + `currentSessionId` from cookie | none | ✅ |
| `POST /auth/password-reset/request` | (none) | n/a | none | ✅ |
| `POST /auth/password-reset/confirm` | reset token | hashed token validation + `pg_advisory_xact_lock` | none | ✅ |
| `DELETE /users/me` | account | `userId = auth.user.sub` | none | ✅ |

---

## Phase 0 #3 Audit Results

The following endpoints were reviewed in the Phase 0 IDOR audit. Each row carries an explicit status.

| Endpoint | Field reviewed | Verdict |
|----------|----------------|---------|
| `PATCH /users/me` | `avatarPublicId` | ✅ Gate enforced in `UserApplicationService.updateProfile` |
| `POST /quizzes` | `imagePublicId`, `tagIds[]`, `categoryId` | ✅ Gate enforced in `QuizApplicationService.createQuiz` |
| `PATCH /quizzes/:quizId` | `imagePublicId`, `tagIds[]`, `categoryId` | ✅ Gate enforced in `QuizApplicationService.updateQuiz` |
| `POST /uploads/sign` | (none — pre-upload signing) | ✅ Ownership of *future* asset established via `ownerId` parameter |

**No IDOR vulnerabilities were found.** Every endpoint that accepts a user-controlled resource identifier verifies ownership before the DB write.

---

## When Adding a New Endpoint

If you add a `POST` / `PATCH` / `DELETE` endpoint that:

- Accepts a `*PublicId` field in the body → **MUST** call `storageOwnership.userOwnsAssetForPurpose`.
- Targets a row owned by a user → **MUST** call the relevant `*Policy.assertCan*` method.
- Targets a row owned by an organization/team (future) → **MUST** add a new policy class.

Then add a row to the matrix above and a corresponding entry in the authz test matrix (`test/fixtures/authz-matrix.ts`) — see Phase 4.

---

## Related Documents

- `docs/audits/BACKEND_AUDIT_REPORT.md` §2 Storage & File Handling
- `src/core/storage/application/storage.application.service.ts` — `userOwnsAssetForPurpose` impl
- `src/modules/quiz/domain/quiz/quiz-command.service.ts` — `QuizPolicy.assertCan*` usages