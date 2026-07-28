# Auth Module — Production-Readiness Audit & Fix Plan

**Module:** `src/modules/auth`
**Audit date:** 2026-07-27
**Auditor:** Cursor Agent (production-readiness review)
**Scope:** REST API design, business semantics, HTTP status codes, request/response consistency, error handling (RFC 7807), domain model, naming consistency, redundancy, Swagger/OpenAPI, security, DX, maintainability, cross-module consistency.

The auth module is mature and functionally complete. This plan catalogues **28 findings** (2 High, 4 Medium, 12 Low, 6 Improvement, plus 4 false-alarms / restated items) and groups them into **8 actionable phases** ordered to minimise cross-PR blast radius. No findings propose a redesign — every change is a localised tightening.

---

## Findings Index

| #   | Severity    | Finding                                                                              | Phase                 |
| --- | ----------- | ------------------------------------------------------------------------------------ | --------------------- |
| 1   | High        | Wrong response DTO type on `POST /auth/reset-password`                               | 1                     |
| 2   | High        | `GET /auth/me` duplicates `GET /users/me`                                            | 6 (doc-only)          |
| 3   | Medium      | Password validation rules differ across 3 DTOs                                       | 2                     |
| 4   | Medium      | `DELETE /auth/account` should be `DELETE /users/me`                                  | 6 (kept as-is)        |
| 5   | Medium      | `POST /auth/logout` docs/code mismatch on cookie requirement                         | 3                     |
| 6   | Medium      | `/auth/security/dashboard` overlaps with `/auth/me` and `/users/me`                  | 6 (service-layer fix) |
| 7   | Low         | `AccountSecurityDto` lives in wrong file                                             | 7                     |
| 8   | Improvement | Class-level interceptor order needs a comment                                        | 3                     |
| 9   | Low         | `LoginResponseDto` mapper has dead `?? ''` fallback                                  | 7                     |
| 10  | Improvement | `ResourceConflictError` exported but never thrown                                    | 7                     |
| 11  | Low         | `VerifyEmailResponseDto` reused for 2 endpoints; `ResetPasswordResponseDto` separate | 7                     |
| 12  | Low         | `change-password` documents 409 with generic example                                 | 5                     |
| 13  | Low         | `logout-all` returns 201 for an action endpoint                                      | 4                     |
| 14  | Low         | `verify-email` returns 201 for an idempotent action                                  | 4                     |
| 15  | Low         | `verify-password` returns 200 + `{ valid: false }` instead of 401                    | 5                     |
| 16  | Low         | `forgot-password` returns 201 for a non-creation action                              | 4                     |
| 17  | Improvement | `@Throttle` constants duplicated between decorator and Redis                         | 7                     |
| 18  | Low         | `revokeSession` audit log drops `ipAddress`                                          | 5                     |
| 19  | Low         | `findActiveByEmailWithPassword` needs timing-safety documentation                    | 8                     |
| 20  | —           | Restated by #5                                                                       | —                     |
| 21  | Low         | `LogoutResponseDto` example doesn't match runtime output                             | 5                     |
| 22  | Improvement | Conflict / NotFound / BadRequest option constants duplicated                         | 7                     |
| 23  | Low         | `check-email` / `check-username` should be `GET` not `POST`                          | 4                     |
| 24  | —           | False alarm — `AuthCookieService` is in use                                          | —                     |
| 25  | Improvement | `TokenResponseDto` declared but never used (dead code)                               | 7                     |
| 26  | Improvement | `AccountDeletionResult` duplicates 4 other message-only types                        | 7                     |
| 27  | Low         | `activeSessionCount` available from two endpoints                                    | 8                     |
| 28  | Improvement | `findMeById` repository method is unused (dead code)                                 | 7                     |

---

## Phase overview

| Phase | Theme                                                | Findings                                  | Risk                                |
| ----- | ---------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| 1     | Type-only OpenAPI fix                                | #1                                        | None (one-line)                     |
| 2     | Unify password policy                                | #3                                        | Medium (tightens registration rule) |
| 3     | Doc/code alignment for logout + interceptor pinning  | #5, #8                                    | None / low                          |
| 4     | HTTP verb + status-code hygiene                      | #13, #14, #16, #23                        | Low–Medium                          |
| 5     | Sensitive-operation correctness + audit completeness | #12, #15, #18, #21                        | Medium (#15)                        |
| 6     | Auth-module endpoint ownership review                | #2, #4, #6                                | None–Low (doc + derived field)      |
| 7     | Dead-code + naming cleanup                           | #7, #9, #10, #11, #17, #22, #25, #26, #28 | None                                |
| 8     | Documentation + consistency polish                   | #19, #27                                  | None                                |

---

## Phase 1 — Fix OpenAPI type drift on `reset-password`

**Findings:** #1
**Risk:** None (wire shape is identical)

### Change

`src/modules/auth/transport/presenters/auth.presenter.ts` (line 53):

```diff
- readonly resetPassword = AuthPresenter.ok<VerifyEmailResponseDto>;
+ readonly resetPassword = AuthPresenter.ok<ResetPasswordResponseDto>;
```

Add the type-only import at the top of the file (line 11 already imports the value, just add `type` keyword):

```diff
- import type { ForgotPasswordResponseDto } from '../../dto/response/password-reset.dto';
+ import { ResetPasswordResponseDto } from '../../dto/response/password-reset.dto';
+ import type { ForgotPasswordResponseDto } from '../../dto/response/password-reset.dto';
```

(or import the type via `import type`).

### Verification

- Re-generate the OpenAPI spec and confirm the schema reference under `POST /api/v1/auth/reset-password` is `ResetPasswordResponseDto` (not `VerifyEmailResponseDto`).
- Run the existing auth module integration tests — they should pass unchanged.

---

## Phase 2 — Unify password policy across registration, change-password, reset-password

**Findings:** #3
**Risk:** Medium (registration rule tightens; legacy `6-char-with-special` passwords are no longer accepted by the change-password flow on subsequent attempts)

### Decision matrix

The two password policies currently in use:

| Site           | minLength | Regex                           | Used by                                                         |
| -------------- | --------- | ------------------------------- | --------------------------------------------------------------- |
| Registration   | 6         | `[A-Z]` + `\d` + `[^A-Za-z0-9]` | `RegisterDto.password`                                          |
| Change / Reset | 8         | `[a-z]` + `[A-Z]` + `\d`        | `ChangePasswordDto.newPassword`, `ResetPasswordDto.newPassword` |

Recommendation: **adopt the 8-char / lower+upper+digit rule everywhere.** It is the safer rule, already in use at 2 of 3 sites, and matches OWASP guidance.

### Changes

1. Update `src/modules/auth/dto/request/register.dto.ts` (lines 30–44):
   - `minLength: 6` → `minLength: 8`
   - `maxLength: 100` → `maxLength: 128` (match the other DTOs)
   - Regex: `^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$` → `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)`
   - Update error message: `'Password must contain at least 1 uppercase letter, 1 number, and 1 special character'` → `'Password must contain at least one uppercase letter, one lowercase letter, and one number'`

2. Extract a shared `NewPasswordDto` to remove the duplication between `ChangePasswordDto.newPassword` and `ResetPasswordDto.newPassword`:

   New file `src/modules/auth/dto/request/new-password.dto.ts`:

   ```ts
   import { ApiProperty } from '@nestjs/swagger';
   import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

   export const NEW_PASSWORD_MIN = 8;
   export const NEW_PASSWORD_MAX = 128;
   export const NEW_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
   export const NEW_PASSWORD_MESSAGE =
     'Password must contain at least one uppercase letter, one lowercase letter, and one number';

   export class NewPasswordDto {
     @ApiProperty({
       description: 'New password',
       minLength: NEW_PASSWORD_MIN,
       maxLength: NEW_PASSWORD_MAX,
       example: 'NewSecurePassword123',
     })
     @IsString()
     @MinLength(NEW_PASSWORD_MIN, {
       message: `Password must be at least ${NEW_PASSWORD_MIN} characters long`,
     })
     @MaxLength(NEW_PASSWORD_MAX, {
       message: `Password must not exceed ${NEW_PASSWORD_MAX} characters`,
     })
     @Matches(NEW_PASSWORD_REGEX, { message: NEW_PASSWORD_MESSAGE })
     newPassword!: string;
   }
   ```

   In `src/modules/auth/dto/request/password-reset.dto.ts`:
   - Replace the inline `newPassword` block in `ResetPasswordDto` and `ChangePasswordDto` with `extends NewPasswordDto` or `@ImportType` from `@nestjs/swagger`.

   (NestJS does not have a built-in DTO composition helper. Two reasonable options:
   - **Option A:** Keep `ResetPasswordDto` / `ChangePasswordDto` declaring `newPassword` directly, but import the regex / length constants from the new shared file. Same runtime behaviour, slightly less DTO reuse.
   - **Option B:** Compose DTOs using `class-validator`'s `ValidateNested` + a nested DTO. Adds a `Type(() => NewPasswordDto)` decorator. Cleanest reuse but requires `@Type` from `class-transformer` and a small ValidationPipe tweak.

   **Recommendation:** Option A for now (minimal blast radius); revisit Option B if more shared password fields appear.)

3. Update `src/modules/auth/transport/controller/auth.controller.ts` and the OpenAPI docs to reflect the new policy.

### Verification

- Re-run the auth test suite — any test that registers with a 6-char password must be updated.
- Manually test that `POST /api/v1/auth/register` with `Str0ng!Pass` (old valid) now returns 400, while `StrongPass1` (new valid) succeeds.
- Confirm that `POST /api/v1/auth/change-password` and `POST /api/v1/auth/reset-password` accept the same password shape as registration.

### Rollout

If existing users have passwords that no longer satisfy the new rule, they can still authenticate (login does not re-validate password policy). They will only encounter the new rule when they next change/reset their password. No data migration required.

---

## Phase 3 — Logout documentation + interceptor pinning

**Findings:** #5, #8
**Risk:** None (doc change + one comment)

### Changes

1. **#5 — `POST /auth/logout` is tolerant of a missing cookie.**

   The current behaviour (succeeds whether or not the cookie is present) is the REST-correct choice. The fix is doc-only.

   `src/modules/auth/transport/controller/auth.controller.ts` (lines 402–407):

   ```diff
   - description:
   -   'Clears the refresh token cookie. The access token remains valid until it expires. ' +
   -   'Requires the refresh token cookie to be present.',
   + description:
   +   'Idempotent logout. Always returns 201 and clears the refresh token cookie. ' +
   +   'If the cookie is missing, the request still succeeds (the cookie is already cleared). ' +
   +   'The access token remains valid until it expires.',
   ```

   And remove the misleading `@ApiUnauthorizedResponse(unauthorizedOptions)` (line 412) — the endpoint has no 401 path. (If a downstream team relies on the spec documenting 401, keep it; otherwise remove.)

2. **#8 — Pin the interceptor order with a one-line comment.**

   `src/modules/auth/transport/controller/auth.controller.ts` (line 154):

   ```diff
   + // Order matters: RefreshTokenInterceptor MUST wrap RequestContextInterceptor
   + // so its finalize() callback sees the populated AuthRequestContext.cookieInstructions.
   @UseInterceptors(RequestContextInterceptor, RefreshTokenInterceptor)
   ```

### Verification

- No code path changes; tests should pass unchanged.
- Visually confirm the OpenAPI doc for `POST /auth/logout` no longer claims to require the cookie.

---

## Phase 4 — HTTP verb + status-code hygiene

**Findings:** #13, #14, #16, #23
**Risk:** Low–Medium

These are all the same root issue: action-style POST endpoints return 201 Created when they don't actually create a resource. Plus, two availability-check endpoints use POST when they should be GET.

### Changes

1. **#13 — `POST /auth/logout-all`** (line 424):
   - Replace `@ApiCreatedResource(LogoutResponseDto, ...)` with `@ApiOkResource(LogoutResponseDto, ...)`.
   - Note: NestJS will still return 201 at runtime by default for `@Post()`. To return 200 OK, add `@HttpCode(HttpStatus.OK)` above the method. (Document the choice.)

2. **#14 — `POST /auth/verify-email`** (line 213):
   - `@ApiCreatedResource(...)` → `@ApiOkResource(...)` + `@HttpCode(HttpStatus.OK)`.

3. **#16 — `POST /auth/forgot-password`** (line 541):
   - Same: `@ApiCreatedResource(...)` → `@ApiOkResource(...)` + `@HttpCode(HttpStatus.OK)`.

4. **#23 — `POST /auth/check-email` and `POST /auth/check-username`** (lines 636, 656):
   - Convert verb to `GET`. New routes: `GET /api/v1/auth/check-email?email=...` and `GET /api/v1/auth/check-username?username=...`.
   - Change DTOs from `@Body()`-driven to `@Query()`-driven (use the existing validation decorators, no rule changes).
   - Move `@Throttle` and `@Public` decorators to the new methods.
   - Keep the old `POST` routes as deprecated aliases (return 301 to the GET, or simply leave them calling the same service but document as deprecated). **Recommendation:** deprecate but keep for one minor version to give frontend teams time to migrate.

### Open question

Does the project have a convention on whether `POST /action` endpoints should return 200 or 201? If 201 is the established convention (some teams prefer 201 for all `@Post()`), skip the status-code change in #13/#14/#16 and only fix the `@ApiCreatedResource` → `@ApiOkResource` documentation drift. Check the social, comment, and bookmark modules for precedent — most `@ApiAuthActionNoContent` calls in `social.controller.ts` (e.g. `respondToFriendRequest` line 351) use 204 No Content, which suggests action endpoints are NOT meant to return 201.

### Verification

- Re-generate OpenAPI; confirm the affected endpoints document 200 OK.
- Manual curl: hit each endpoint, confirm the HTTP status code matches.

### Rollout

The verb changes for `check-email` / `check-username` are URL-visible and require a frontend migration window. The other three are wire-invisible (different status code, same body) unless a client hard-codes 201 expectations.

---

## Phase 5 — Sensitive-operation correctness + audit completeness

**Findings:** #12, #15, #18, #21
**Risk:** Medium (semantic change in #15)

### Changes

1. **#15 — `POST /auth/verify-password` should return 401 on wrong password.**

   Currently: returns 200 OK with `{ valid: false }` if the password is wrong (see `credential-verification.service.ts:21-22`).
   Recommended: throw `InvalidPasswordError` (the same exception used by `change-password`), which maps to 401 `AUTH_INVALID_CURRENT_PASSWORD`.

   `src/modules/auth/domain/credential-verification.service.ts`:

   ```diff
   async verifyPassword(userId: string, password: string): Promise<CredentialVerificationResult> {
     const credentials = await this.userRepository.findActiveUserCredentialsById(userId);
     if (!credentials) {
   -   return { valid: false };
   +   throw new InvalidPasswordError();
     }

     const valid = await this.passwordProvider.verify(password, credentials.passwordHash);
   -   return { valid };
   +   if (!valid) {
   +     throw new InvalidPasswordError();
   +   }
   +   return { valid: true };
   }
   ```

   (Add `import { InvalidPasswordError } from './errors';`.)

   Then update the DTO and the controller:
   - `VerifyPasswordResponseDto` no longer needs the `{ valid: false }` shape. Simplify to a success-only response, OR keep the `{ valid: boolean }` shape and document that `valid: false` is no longer reachable (it would only appear if the schema validator leaks a success-path envelope with `valid: false`, which is impossible).
   - `@ApiUnauthorizedResponse(unauthorizedOptions)` is already on the endpoint (line 687) — good, no decorator change needed.
   - `@ApiInternalServerErrorResponse(...)` is present; add `@ApiUnauthorizedResponse(...)` to document the new 401 path explicitly (it's already there).

   **Open question:** if a frontend team is currently reading `data.valid === false` to gate a sensitive operation, this change breaks them. Confirm with the frontend team before merging. If they need backwards compatibility, deprecate the field over one minor version.

2. **#18 — Audit log loses `ipAddress` on session revoke.**

   `src/modules/auth/transport/controller/auth.controller.ts` (line 508, `revokeSession`):

   ```diff
   - const result = await this.authApplicationService.revokeSession(
   -   userId,
   -   sessionId,
   -   currentSessionId,
   - );
   + const result = await this.authApplicationService.revokeSession(
   +   userId,
   +   sessionId,
   +   currentSessionId,
   +   context.session.ipAddress ?? undefined,
   + );
   ```

   Same change for `revokeAllOtherSessions` (line 480).
   Both methods already accept an optional `ipAddress` parameter in `session-management.service.ts`.

3. **#12 — `change-password` 409 example.**

   Optional: replace the generic `ErrorResponseExamples.conflict` on `@ApiConflictResponse(conflictOptions)` (line 597) with a custom `examples` block that documents the specific `AUTH_PASSWORD_REUSE` code. Skip if the project standard is generic examples.

4. **#21 — `LogoutResponseDto` example.**

   `src/modules/auth/dto/response/logout-response.dto.ts` (line 7): replace example `'Successfully logged out. Refresh cookie cleared.'` with one of the actual runtime outputs: `'Logged out successfully'` or `'Logged out from all sessions successfully'`. Document both as a multi-example.

### Verification

- Add an integration test for `POST /auth/verify-password` covering the wrong-password case (must return 401 with `AUTH_INVALID_CURRENT_PASSWORD`).
- Add a regression test for `revokeSession` that asserts the audit log includes `ipAddress` (query the audit table or assert via a mocked logger).

### Rollout

The `verify-password` semantic change is breaking for any caller that reads `data.valid`. Coordinate with the frontend team; consider a 2-step rollout:

1. **Step A:** keep `valid` field, also throw 401 on wrong password. Both shapes are valid for one minor version.
2. **Step B:** remove `valid` field after the deprecation window.

---

## Phase 6 — Auth-module endpoint ownership review

**Findings:** #2, #4, #6
**Risk:** None–Low (doc/structure tightening only)

This phase reviews whether three auth-module endpoints are conceptually misplaced, and whether any of them should be relocated to another module. The review applies the **ownership-preservation principle**: authentication-related workflows (credential verification, session revocation, cookie clearing, audit logging) are within the auth module's natural responsibility, even when they operate on the current user.

Two endpoints have legitimate architectural reasons to stay where they are. One endpoint has a payload-mix concern that can be fixed without relocation.

### Per-finding verdict

| #   | Finding                                                             | Verdict                    | Reason                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #2  | `GET /auth/me` duplicates `GET /users/me`                           | **Keep with modification** | Both endpoints exist with different response shapes. Each serves a different use case. The fix is to make the relationship explicit in OpenAPI, not to relocate one.                                                      |
| #4  | `DELETE /auth/account` should be `DELETE /users/me`                 | **Keep as-is**             | The endpoint requires credential verification, session revocation, cookie clearing, and audit logging — all auth-domain responsibilities. Relocation would create a cross-module dependency with no clear business value. |
| #6  | `/auth/security/dashboard` overlaps with `/auth/me` and `/users/me` | **Keep with modification** | The URL is appropriate. The issue is that the response shape mixes user-domain and session-domain data via an anemic aggregation service. Fix the composition, not the URL.                                               |

---

### #2 — `GET /api/v1/auth/me`

**Verdict:** Keep the endpoint in the auth module. Document the relationship to `/api/v1/users/me`.

**Reasoning:**

- The auth module is the natural owner of "current authenticated principal" semantics. JWT-based authentication naturally lives here — the auth module already issues the access token, holds the refresh token, and runs the login flow.
- `GET /api/v1/users/me` is a profile-shape endpoint owned by the user module: it returns display name, avatar, bio, XP, streaks, settings, and timestamps. It is a user-resource lookup.
- The two endpoints serve different use cases:
  - `/auth/me` — used by the SPA on every page load to bootstrap the auth state (small payload, frequent reads).
  - `/users/me` — used by the profile page and settings UI (larger payload, infrequent reads).
- The slim 5-field payload of `/auth/me` is intentional. If a frontend team needs the user profile, they call `/users/me`. If they only need the principal identity (e.g. for "is the user authenticated?" UI gating), they call `/auth/me`.
- Forcing one endpoint to serve both would either (a) bloat `/auth/me` with 12+ profile fields that 90% of callers ignore, or (b) require `/users/me` to be called on every page load, multiplying database hits on a hot path.
- The current shape is correct; the documentation gap is the real issue.

**Problem:** The OpenAPI description on `GET /auth/me` does not explain when a client should prefer it over `/users/me`. New API consumers may assume the two are interchangeable and pick one at random.

**Recommendation:** Update the Swagger `@ApiOperation.description` on `GET /auth/me` to clarify the use-case split. Do not relocate or deprecate either endpoint.

#### Changes

`src/modules/auth/transport/controller/auth.controller.ts` (lines 617–620):

```diff
  @Get('me')
  @ApiOperation({
    summary: 'Get current user identity',
    description:
-     'Returns the authenticated user profile (userId, username, email, role, isVerified).',
+     'Returns the authenticated principal identity (userId, username, email, role, isVerified).\n\n' +
+     'This is the slim identity payload used to bootstrap the auth state on the client. ' +
+     'For the full user profile (display name, avatar, bio, XP, streaks, settings, timestamps), ' +
+     'use `GET /api/v1/users/me` instead. ' +
+     'The two endpoints are complementary, not interchangeable.',
  })
```

Optionally, add a one-line note to `src/modules/user/transport/controller/user.controller.ts` (`GET /me`, line 71) pointing back to `/auth/me` for the identity-only case.

#### Verification

- Re-generate OpenAPI and confirm the new description appears on `GET /auth/me`.
- Manually fetch the spec and confirm both endpoints are documented with cross-references.
- No runtime changes; existing tests pass unchanged.

#### Rollout

Documentation-only change. Safe to land in a single PR with no coordination required.

---

### #4 — `DELETE /api/v1/auth/account`

**Verdict:** Keep the endpoint in the auth module.

**Reasoning:**

- Account deletion in this codebase is not a "delete a row from the users table" operation. It is a workflow that includes:
  1. **Credential verification** — the user must re-enter their password.
  2. **Session revocation** — all refresh tokens for the user must be invalidated across every instance.
  3. **Refresh cookie clearing** — the response must clear the `refreshToken` cookie on the client.
  4. **Audit logging** — an `account_deleted` outbox event is written.
  5. **Transactional integrity** — all four steps share one `pg_advisory_xact_lock` to serialise against concurrent reset-password / change-password / delete-account flows for the same user.

  Steps 1, 3, and 4 are auth-domain responsibilities by definition. Step 2 (session revocation) is a session-domain concern owned by `SessionService` in the auth module. Step 5 (the advisory lock) coordinates against auth operations, not user operations.

- Compare with `PATCH /api/v1/users/me` (user module) — that endpoint updates profile fields and does not touch credentials, sessions, cookies, or outbox events. The two endpoints share the URL prefix but not the responsibility.

- Moving the controller, DTOs, application service, and domain service to the user module would require:
  - Importing `SessionService`, `AuthCookieService`, `PasswordAdapter`, `AccountDeletionService`, and the password-reset event payload types from the auth module.
  - Resolving the `users → auth` dependency direction. The auth module currently imports nothing from the user module for this flow; flipping the direction introduces a circular-dependency risk and a tightly-coupled module boundary.
  - Coordinating a public-API URL change (`/auth/account` → `/users/me`) and writing a migration guide for every frontend caller.
  - Re-wiring the audit log and outbox publisher ownership.

  None of these costs are justified by a clear business value. The endpoint is correctly placed.

**Problem:** None that warrants relocation. The endpoint is at the right URL, in the right module, with the right responsibilities.

**Recommendation:** No change. The endpoint is correctly owned by the auth module.

#### Changes

None. (If desired, the OpenAPI description could be enhanced to explain the workflow's scope, but this is optional.)

#### Verification

N/A — no change.

#### Rollout

N/A.

---

### #6 — `GET /api/v1/auth/security/dashboard`

**Verdict:** Keep the endpoint in the auth module. Fix the response composition at the service layer.

**Reasoning:**

- The URL `/auth/security/dashboard` is appropriately scoped: it is a security-oriented aggregation of session-domain and user-domain data, returned to the authenticated user. Splitting it into `/users/me/security` + `/auth/sessions/count` would force the frontend to make two calls and re-merge the data, with no benefit.
- The real concern is that the aggregation logic in `AccountSecurityService.getAccountSecurity()` (`src/modules/auth/domain/account-security.service.ts:34-45`) is **anemic**: it takes four flat fields from the repository and returns them unchanged. The service does not enforce any invariants, derive any new information, or coordinate any cross-domain logic. It is a passthrough.

  This is not a relocation problem; it is a service-layer quality problem. The fix is to either:
  - Add domain logic to the service (derive `passwordAgeDays` from `lastPasswordChangedAt`, classify the session count into `low`/`normal`/`high` risk tiers, etc.), or
  - Acknowledge that the aggregation is genuinely trivial and rename the service / inline it.

- The DTO file location (`AccountSecurityDto` inside `session-management.dto.ts`, lines 39–66) is a maintainability nit covered in Phase 7. It does not affect runtime correctness.

**Problem:** The aggregation service is anemic and adds indirection without value. The response payload is composed at the controller/service boundary with no business logic, which means any future enhancement (cache invalidation, derived fields, cross-field consistency checks) will silently scatter across the call chain.

**Recommendation:** Keep the endpoint and the URL. Improve the aggregation service so it actually does work — at minimum, centralise the field composition and add a docstring explaining the data lineage. Do not split or relocate.

#### Changes

`src/modules/auth/domain/account-security.service.ts`:

1. Add a class-level docstring describing what the aggregation represents (a security snapshot for the dashboard) and which fields come from which repository methods.
2. Add a derived field — `passwordAgeDays: number | null` computed from `lastPasswordChangedAt` and `nowIso`. This gives the dashboard at least one piece of business logic and makes the service's role defensible.
3. Update `getSecurityDashboard` in the application service to pass `nowIso` to the security service.

`src/modules/auth/dto/response/account-security.dto.ts` (after the Phase 7 file move):

```diff
  @ApiProperty({
    description:
      'Timestamp of the last password change (PostgreSQL timestamptz, null if never changed)',
    type: String,
    nullable: true,
    example: '2026-07-14 01:49:39.302+00',
  })
  lastPasswordChangeAt!: string | null;
+
+ @ApiProperty({
+   description:
+     'Days since the last password change (null if the password has never been changed). ' +
+     'Derived server-side from lastPasswordChangeAt — never stored.',
+   type: Number,
+   nullable: true,
+   example: 14,
+ })
+ passwordAgeDays!: number | null;
```

Then `auth.application.service.ts:208-216` (the `getSecurityDashboard` mapper):

```diff
  async getSecurityDashboard(userId: string): Promise<AccountSecurityDto> {
    const metadata = await this.accountSecurityService.getAccountSecurity(userId);
+   const passwordAgeDays =
+     metadata.lastPasswordChangedAt === null
+       ? null
+       : Math.floor(
+           (Date.now() - Date.parse(metadata.lastPasswordChangedAt)) / (1000 * 60 * 60 * 24),
+         );

    return {
      emailVerified: metadata.emailVerified,
      activeSessionCount: metadata.activeSessionCount,
      lastSuccessfulLoginAt: metadata.lastLoginAt,
      lastPasswordChangeAt: metadata.lastPasswordChangedAt,
+     passwordAgeDays,
    };
  }
```

#### Verification

- Unit/integration test: `getAccountSecurity` returns the correct derived `passwordAgeDays` for (a) a user who has never changed their password (expect `null`), (b) a user who changed their password N days ago (expect `N`), (c) a user who changed their password in the future (expect clamped to `0`, not negative).
- Manual curl: the dashboard endpoint now includes the new field with correct values.
- No URL change; no breaking change to existing clients.

#### Rollout

Single PR. Add the new field as additive — never remove `lastPasswordChangeAt`, only add `passwordAgeDays` alongside it. Existing clients ignore the new field.

---

### Summary

| Finding                       | Verdict                | Change type                                                    |
| ----------------------------- | ---------------------- | -------------------------------------------------------------- |
| #2 `/auth/me`                 | Keep with modification | OpenAPI doc enhancement only                                   |
| #4 `/auth/account`            | Keep as-is             | None                                                           |
| #6 `/auth/security/dashboard` | Keep with modification | Add derived `passwordAgeDays` field; enhance service docstring |

No endpoint is relocated. No module boundary is crossed. No deprecation is introduced. No migration guide is required.

The three endpoints remain in the auth module because authentication-related workflows — credential verification, session revocation, cookie clearing, audit logging — are the auth module's core responsibility, and that responsibility is independent of which user is currently authenticated.

---

## Phase 7 — Dead-code + naming cleanup

**Findings:** #7, #9, #10, #11, #17, #22, #25, #26, #28
**Risk:** None (internal refactor)

### Changes

1. **#7 — Move `AccountSecurityDto` out of `session-management.dto.ts`.**
   - New file: `src/modules/auth/dto/response/account-security.dto.ts`. Move the class. Update imports in `auth.controller.ts` and `auth.application.service.ts`.

2. **#9 — Remove dead `?? ''` fallback in `auth-response.mapper.ts` (line 32).**

   ```diff
   - dto.sessionId = (result as LoginResult & { sessionId?: string }).sessionId ?? '';
   + dto.sessionId = result.sessionId;
   ```

   `LoginResult.sessionId` is non-optional (`auth-result.types.ts:15`).

3. **#10 — Delete `ResourceConflictError` and its `ProblemCodeMapping` entry.**
   - Delete `src/modules/auth/domain/errors/auth-domain.errors.ts` lines 107–112 (the class).
   - Delete `AUTH_RESOURCE_CONFLICT` from `src/common/errors/problem-code-mapping.ts` (lines 61–65).
   - Verify with `rg "ResourceConflictError" src/` that no throw sites reference it.

4. **#11 — Consolidate message-only DTOs.**
   - Optional. The current per-endpoint DTO convention is established in the project. Skip if you want to preserve consistency with the rest of the codebase. If you do consolidate, do it as a separate codebase-wide PR touching social, comment, bookmark, etc. — out of scope for the auth module.

5. **#17 — Extract `@Throttle` constants to `AuthThrottleConfig`.**
   - New file `src/modules/auth/config/throttle.config.ts`:

     ```ts
     import { Inject, Injectable } from '@nestjs/common';
     import { authThrottleConfig } from '@/core/config/auth-throttle.config';
     import type { AuthThrottleConfig as AuthThrottleConfigType } from '@/core/config/auth-throttle.config';

     @Injectable()
     export class AuthThrottleConfig {
       constructor(
         @Inject(authThrottleConfig.KEY)
         private readonly config: AuthThrottleConfigType,
       ) {}

       get register() {
         return this.config.register;
       }
       get verifyEmail() {
         return this.config.verifyEmail;
       }
       get resendVerificationEmail() {
         return this.config.resendVerificationEmail;
       }
       get login() {
         return this.config.login;
       }
       get googleLogin() {
         return this.config.googleLogin;
       }
       get forgotPassword() {
         return this.config.forgotPassword;
       }
       get checkAvailability() {
         return this.config.checkAvailability;
       }
     }
     ```

   - New core config `src/core/config/auth-throttle.config.ts` (the central source of truth).
   - Replace inline `{ default: { limit, ttl: 60_000 } }` decorators in `auth.controller.ts` with `@Throttle({ default: AuthThrottleConfig.register })`.
   - Update `security.service.ts` to read the same constants instead of its hardcoded `getRateLimitConfig` switch.

6. **#22 — Deduplicate error-response option constants.**

   `src/modules/auth/transport/controller/auth.controller.ts` (lines 99–133) duplicates `badRequestOptions`, `notFoundOptions`, etc. already defined in `src/common/swagger/swagger-decorators.ts`.
   - Option A: import the shared constants from `swagger-decorators.ts`.
   - Option B: use the helper decorators directly (`ApiBadRequest()`, `ApiUnauthorized()`, etc.) and drop the local constants.

   **Recommendation:** Option B. Most consistent with the user, social, and bookmark modules' style.

7. **#25 — Delete `TokenResponseDto`.**

   `src/modules/auth/dto/response/token-response.dto.ts` is unused. The file is one space of description different from `RefreshTokenResponseDto`. Delete.

8. **#26 — Consolidate `AccountDeletionResult` with other message-only result types.**
   - Skip if #11 is skipped. Otherwise, introduce a shared `MessageResult` type in `auth-result.types.ts` and have all 5 message-only types alias it.

9. **#28 — Delete `findMeById` from `user.repository.ts`.**
   - Verify with `rg "findMeById" src/` that no callers exist.
   - Delete lines 288–317.

### Verification

- Run the full test suite.
- Run `rg "ResourceConflictError"` / `rg "TokenResponseDto"` / `rg "findMeById"` to confirm no stale references.

---

## Phase 8 — Documentation + consistency polish

**Findings:** #19, #27
**Risk:** None

### Changes

1. **#19 — Document the dummy-hash timing-safety decision.**

   In `src/modules/auth/infrastructure/repositories/user.repository.ts`, add a file-header comment explaining why `findActiveByEmailWithPassword` and similar methods deliberately compute a bcrypt compare against a dummy hash even when the user is not found. This prevents future "optimisation" that would leak the user-existence signal.

   ```ts
   /**
    * Note: every login-related query path compares the supplied password
    * against a bcrypt hash (real or dummy) to keep the response time
    * independent of whether the user exists. Do not refactor to skip the
    * compare on the "user not found" branch — it leaks account existence.
    */
   ```

2. **#27 — Document that `activeSessionCount` is a snapshot.**

   In `src/modules/auth/dto/response/account-security.dto.ts` (after the move in Phase 7), update the `activeSessionCount` description:

   ```diff
   - description: 'Number of currently active sessions (typical: 1; higher values indicate devices remembered across logins)',
   + description: 'Snapshot of the number of currently active sessions. May differ from `GET /auth/sessions` length under concurrent revocations.',
   ```

   Or, after the Phase 6 derived-field addition, drop this field entirely since it is derivable from `/auth/sessions`.

---

## Execution order

Recommended PR sequence:

1. **PR #1 — Phase 1** (one-line fix). Land immediately. Total time: ~10 minutes.
2. **PR #2 — Phase 3** (docs + comment). Land immediately. No risk.
3. **PR #3 — Phase 7.5** (dead-code cleanup: #10, #25, #28, #22, #9). Group the dead-code items together. Low risk.
4. **PR #4 — Phase 4** (HTTP verb/status hygiene). Land after a frontend check on the deprecation timeline for `check-email` / `check-username`.
5. **PR #5 — Phase 5** (sensitive-operation + audit completeness). Land after coordinating #15 with the frontend team.
6. **PR #6 — Phase 2** (password policy unification). Coordinate with the frontend team on the registration rule tightening.
7. **PR #7 — Phase 7 (rest)** (naming cleanup, throttle config extraction, response option dedup).
8. **PR #8 — Phase 8** (docs polish).
9. **PR #9 — Phase 6** (auth-module endpoint ownership review). Doc-only + additive `passwordAgeDays` field. No URL changes, no deprecation, no migration guide. Land as a single PR.

---

## Files touched (summary)

| File                                                                                   | Phases        |
| -------------------------------------------------------------------------------------- | ------------- |
| `src/modules/auth/transport/presenters/auth.presenter.ts`                              | 1             |
| `src/modules/auth/dto/request/register.dto.ts`                                         | 2             |
| `src/modules/auth/dto/request/password-reset.dto.ts`                                   | 2             |
| `src/modules/auth/dto/request/new-password.dto.ts` (new)                               | 2             |
| `src/modules/auth/transport/controller/auth.controller.ts`                             | 2, 3, 4, 5, 6 |
| `src/modules/auth/domain/credential-verification.service.ts`                           | 5             |
| `src/modules/auth/domain/account-security.service.ts`                                  | 6             |
| `src/modules/auth/dto/response/account-security.dto.ts` (new, after Phase 7 file move) | 6, 7          |
| `src/modules/auth/dto/response/session-management.dto.ts` (slim down)                  | 7             |
| `src/modules/auth/dto/response/logout-response.dto.ts`                                 | 5             |
| `src/modules/auth/dto/response/token-response.dto.ts` (delete)                         | 7             |
| `src/modules/auth/dto/response/verify-email-response.dto.ts`                           | 7             |
| `src/modules/auth/dto/response/password-reset.dto.ts`                                  | 7             |
| `src/modules/auth/domain/errors/auth-domain.errors.ts`                                 | 7             |
| `src/modules/auth/infrastructure/repositories/user.repository.ts`                      | 7             |
| `src/modules/auth/infrastructure/repositories/user-session.repository.ts`              | — (unchanged) |
| `src/modules/auth/config/throttle.config.ts` (new)                                     | 7             |
| `src/core/config/auth-throttle.config.ts` (new)                                        | 7             |
| `src/common/errors/problem-code-mapping.ts`                                            | 7             |

---

## Cross-module notes

- Phase 6 does not introduce any cross-module coupling. All three endpoints remain in the auth module. The new `passwordAgeDays` field is server-derived and is consumed only by the auth module's dashboard endpoint.
- Phase 2's password-policy tightening will require coordinating with the auth module's `verify-password` endpoint (which currently allows the old rule). Verify that `verify-password` uses the same validator.
- `ProblemCodeMapping` removes `AUTH_RESOURCE_CONFLICT` in Phase 7. Confirm with the `oauth/errors.ts` file that it does not import `ResourceConflictError`.

---

## Acceptance criteria

Each phase is complete when:

1. The named files are edited as specified.
2. The existing test suite (`pnpm test`) passes.
3. New tests (if any) for that phase pass.
4. The OpenAPI spec regenerates without warnings (`pnpm build` or `pnpm docs:generate`).
5. No file in `src/` outside the listed changes is modified by the same PR.

After all 9 PRs land:

- The auth module owns credential, session, OAuth, verification-token, account-deletion, and security-snapshot flows. No endpoint is relocated to another module.
- The user module continues to own profile and account-management endpoints for general CRUD (e.g. `PATCH /users/me`, `GET /users/me`).
- Password policy is consistent across all entry points.
- All action-style endpoints use 200 OK; only resource-creation endpoints use 201 Created.
- All dead code (`ResourceConflictError`, `TokenResponseDto`, `findMeById`, dead mapper fallback) is gone.
- Throttle config lives in one place.
