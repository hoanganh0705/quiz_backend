# USER MODULE — PRODUCTION-READINESS AUDIT

> Module: `src/modules/user/`
> Companion audit: `docs/audits/AUTH_MODULE_PRODUCTION_READINESS_AUDIT.md`
> Convention: same severity scale and finding layout as the auth-module audit.

## 0. Module shape (for context)

The user module is read-heavy and is composed of:

- **Transport**: `UserController` (`@Controller('users')`), `UserPresenter`,
  `user-swagger-decorators.ts`, `user-application-logger.interceptor.ts`
  (not inspected — by analogy).
- **Application**: `UserApplicationService`, `UserActivityServiceImpl`.
- **Domain**: `UserDomainService`, `UserService.calculateLevel`,
  `StreakService`, `UserDomainEventBus`, port interfaces, DTO types,
  `user-domain.errors.ts`, `user-profile-private.error.ts`.
- **Infrastructure**: `UserRepository`, `UserSearchAdapter`,
  `RankingXpStreakListenerAdapter`.

The module is well-organized (consistent application/domain/infra split),
so most of the findings are about correctness, security, and
production-readiness of the public surface area, not architectural
redesign.

Findings are sorted by severity within each category.

---

## 1. Critical Findings

### F-1 · IDOR on `GET /users/:userId/quizzes/analytics` — any authenticated user can read another user's creator analytics

**Category**: Security
**Severity**: Critical
**Location**:
- `src/modules/user/transport/controller/user.controller.ts:223-235` (`getUserQuizAnalytics`)
- `src/modules/quiz/application/quiz.application.service.ts:265-269` (`getMyQuizAnalytics`)
- `src/modules/quiz/domain/analytics/ports/quiz-listing.port.ts:20`
- `src/modules/quiz/domain/quiz/quiz-query.service.ts:209-211`
  (`getCreatorAnalytics`)

**Current behavior**:
- The endpoint accepts any `:userId` path parameter (UUIDv7) and returns the
  creator-side analytics for that user
  (`CreatorQuizAnalyticsDto`: total quizzes, draft count, published count,
  total attempts, unique players, average score, average rating, total
  bookmarks, total reviews, `lastUpdated`).
- The controller does not check ownership, role, or privacy.
- `getMyQuizAnalytics(userId)` in `QuizApplicationService` does call
  `userDomainService.getMe(userId)` to assert the user *exists* (so a
  non-existent UUID yields 404), but never compares `userId` against the
  authenticated subject.
- The matching `QuizApplicationService.listMyQuizAnalytics` method's name
  and documentation describe it as a "my" endpoint (intended to be called
  by the authenticated user against their own `userId`); the user module
  simply passes the path parameter through unchanged.

**Problem**:
- This is a textbook IDOR (Insecure Direct Object Reference). Any
  authenticated user can fetch another user's creator analytics by
  iterating UUIDs or scraping usernames. The response leaks sensitive
  business metrics (engagement and review totals) that the owner did not
  consent to share. Note that the underlying `getCreatorAnalytics` query
  is intentionally read-as-owner in the quiz module — there is no privacy
  filter at all.
- The author of the route appears to have copy-pasted the
  `getMyQuizAnalytics` plumbing rather than introducing a privacy-aware
  variant.

**Recommendation**:
- Either remove `GET /users/:userId/quizzes/analytics` entirely (callers
  who need their own analytics should hit `GET /quizzes/me/analytics`),
  or
- Mirror the `assertProfileVisible(targetUserId, requesterId)` pattern
  used by every other public `:userId` route in `UserController`
  (`listBadgesByUserId`, `getUserTournamentHistory`,
  `getPublicTournamentProfile`) and gate the endpoint on the
  `user_profile_settings.isPublic` flag — and additionally on
  `showStatistics` once that flag is enforced (see F-2).

**Reasoning**: The endpoint exposes private business metrics that the
target user has not chosen to share. The same pattern that protects every
other `:userId` route in this controller (the privacy gate in
`UserDomainService.assertProfileVisible`) is missing here. The fix is
small and surgical; no architectural changes are needed.

**Breaking change risk**: High. Any client that depends on viewing other
users' creator analytics must be migrated. If the endpoint is desired
publicly, scope it to public profiles (`isPublic = true` and
`showStatistics = true`) — this is itself a breaking change for any
client relying on the current unconditional exposure.

---

### F-2 · `PATCH /users/me` overwrites omitted profile fields with `NULL` (silent data loss)

**Category**: REST API Design / Business Semantics
**Severity**: Critical
**Location**:
- `src/modules/user/infrastructure/repositories/user.repository.ts:498-546`
  (`updateProfile`)
- `src/modules/user/domain/user.service.ts:157-227`
  (`updateProfile`)
- `src/modules/user/dto/request/update-me.dto.ts`

**Current behavior**:
- The PATCH body is documented as supporting three-way semantics
  (`undefined` = leave alone; `null`/`""` = clear). The DTO uses
  `trimStringToNullIfBlank` to convert `""` → `null` and `@IsOptional()`
  to keep `undefined` distinct.
- The domain layer correctly preserves the distinction (`'displayName' in
  command && command.displayName !== undefined` vs `'bio' in command`).
- However, `UserRepository.updateProfile` builds an `onConflictDoUpdate`
  with `set: { displayName: patch.displayName ?? null, ... }`. Because
  `patch` is a partial object, `patch.displayName ?? null` evaluates to
  `null` whenever the field is *missing from the patch* (and likewise
  for `bio`, `avatarUrl`). The upsert then explicitly writes `NULL` for
  every field that was not supplied in the request.
- For first-time profile creation (no existing row), this is harmless —
  the `values` clause is the same as the `set` clause and the row did
  not exist. For an existing profile, **omitting any of `displayName`,
  `bio`, or `avatarUrl` silently clears them**.

**Problem**:
- `PATCH` is meant to be a partial update. The current implementation
  is effectively a full-replacement upsert: a `PATCH /users/me` with
  `{ "bio": "Hello" }` wipes `displayName` and `avatarUrl` from the
  `user_profiles` row.
- The domain layer's three-way distinction is silently undone by the
  repository. The DTO docs and the response (which still returns the
  pre-update values for any field not provided — but only because the
  re-`SELECT` re-joins against the now-NULL'd columns and pulls NULL,
  then the controller maps those NULLs back into the response) are
  inconsistent with what the database actually contains after the
  commit.

**Recommendation**:
- In `UserRepository.updateProfile`, drop the `?? null` fallbacks and
  only include keys that are actually present in `patch`:

  ```ts
  const set: Partial<typeof userProfiles.$inferInsert> = { updatedAt: nowIso };
  if ('displayName' in patch) set.displayName = patch.displayName;
  if ('avatarUrl'   in patch) set.avatarUrl   = patch.avatarUrl;
  if ('bio'         in patch) set.bio         = patch.bio;
  ```

  Apply the same to the `values` clause for the initial insert path
  (or rely solely on `onConflictDoUpdate` with the partial `set` —
  Drizzle treats absent keys as no-ops for `DO UPDATE`).
- Add a regression test that asserts an omitted field is unchanged.

**Reasoning**: This is a data-integrity bug, not a UX nit. It silently
destroys user data on the most common partial update shape. The fix is
localized to one method.

**Breaking change risk**: Low. Clients that were inadvertently relying
on the bug (passing only the field they want to change and accepting
that other fields are cleared) will need to send a full payload. This is
the correct REST contract and should be enforced.

---

### F-3 · Cursor UUID pattern rejects UUIDv7, breaking pagination on every list endpoint that uses a UUID tiebreaker

**Category**: Bug / Pagination / Maintainability
**Severity**: Critical
**Location**:
- `src/modules/user/mappers/user-activity-cursor.mapper.ts:9-10`
- `src/modules/user/mappers/user-badge-cursor.mapper.ts:9-10`
- `src/modules/user/mappers/my-tournament-cursor.mapper.ts:3`
- `src/modules/user/mappers/my-tournament-history-cursor.mapper.ts:3`

**Current behavior**:
```ts
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```
- The regex anchors the version nibble to `[1-5]`. The variant nibble is
  `[89ab]` (i.e. RFC 4122 variant bits).
- Every ID that the application generates or accepts is UUIDv7:
  `ParseUUIDPipe({ version: '7' })` is used throughout the controllers
  (e.g. `user.controller.ts:247, 265, 287, 310`); the database default
  is `sql\`uuidv7()\`` for `users.userId`, `userProfiles.profileId`,
  `userBadges.userBadgeId`, `tournamentParticipants.participantId`,
  `userActivityEvents.eventId`, etc. (see
  `src/core/database/schema/auth/schema.ts:51`, `user/schema.ts:39, 82,
  119`).

**Problem**:
- UUIDv7 has the version nibble `7`. A cursor issued by the server has a
  valid base64-encoded JSON whose `eventId` / `userBadgeId` /
  `participantId` is a UUIDv7 string. The mapper's `isUuid` validator
  rejects it (`[1-5]` does not match `7`).
- `parse()` then throws `new Error('Invalid cursor')`. Because the throw
  is a plain `Error`, the `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts:205-249`)
  falls into the uncaught-`Error` branch and returns **500 Internal Server
  Error** with the literal `exception.message` (or `'Internal server
  error'` in production). The expected 400 Bad Request never happens.
- The first cursor call works fine (no cursor is sent), but as soon as a
  client paginates to the next page using the returned `nextCursor`,
  every list endpoint explodes:
  - `GET /users/me/badges` (`me/badges` → `listMyBadges`)
  - `GET /users/me/activity` (`me/activity` → `listUserActivity`)
  - `GET /users/me/tournaments` (`me/tournaments` → `listMyTournaments`)
  - `GET /users/me/tournament-history`
    (`me/tournament-history` → `listMyTournamentHistory`)
  - `GET /users/:userId/badges`
  - `GET /users/:userId/tournament-history`
  - `GET /users/:userId/quizzes` (the quiz module's own cursor mappers
    do not have this bug; verified at `quiz-cursor.mapper.ts`)

**Recommendation**:
- Change the regex to accept version `[0-9a-f]` (any version) and the
  variant `[89ab]`, OR
- Hard-code `[0-9a-f]` for the version nibble and `[89ab]` for the
  variant nibble (RFC 4122 layout) and additionally accept UUIDv7 with
  version `7`, OR
- Use a permissive `isUuid` helper from `src/common/utils/cursor.util.ts`
  and call it once from a shared place. Note: the file already exports
  `isStringMatchingPattern` for exactly this kind of check.
- Also: catch the `Error` and rethrow as `BadRequestException` so the
  wire shape becomes 400 instead of 500. Compare with the strict
  `decodeInstanceCursor` / `decodeLeaderboardCursor` /
  `decodeInstancePlayerCursor` in `src/common/utils/cursor.util.ts:35-114`,
  which throw `BadRequestException('Invalid cursor')` and produce a
  correct 400 response.

**Reasoning**: This is a hard production bug — the entire cursor
pagination contract is broken end-to-end for the user module's list
endpoints. The `[1-5]` regex is a relic from pre-UUIDv7 designs.

**Breaking change risk**: None — clients cannot currently paginate past
page 1, so the change only affects forward flow.

---

## 2. High Findings

### F-4 · `GET /users/me/ranking` and `GET /users/me/analytics` shortcut the privacy check for self → soft-deleted user can crash the endpoint with a 500

**Category**: Security / Robustness
**Severity**: High
**Location**:
- `src/modules/user/domain/user.service.ts:76-88` (`assertProfileVisible`)
- `src/modules/user/transport/controller/user.controller.ts:167-191`

**Current behavior**:
- `assertProfileVisible(targetUserId, requesterId)` short-circuits with
  `if (requesterId === targetUserId) return;` for self-requests.
- `GET /users/me/ranking` (line 175) and `GET /users/me/analytics`
  (line 188) pass `userId` (from `CurrentUser('sub')`) as both the
  target and the requester, so the privacy check is bypassed.
- However, the controller still calls
  `userApplicationService.getUserRanking(userId, userId)` /
  `.getUserAnalytics(userId, userId)`. These services eventually call
  `userRepository.findMeById` / `userRepository.getUserAnalytics`,
  which `LEFT JOIN` against `users` with `users.deleted_at IS NULL`.
- If the JWT subject belongs to a soft-deleted user, `findMeById`
  returns `null`. The repository returns `null` to the domain
  service, which throws `UserNotFoundError` (404) — that path is fine.
  The remaining edge cases (`getUserRanking` upserts a ranking row,
  `getUserAnalytics` runs a multi-CTE SQL) can plausibly return data
  inconsistent with the controller's expectation that the user is
  alive.

**Problem**:
- The shortcut is a behavioural inconsistency. For non-self requests,
  the existence check is mandatory (`assertProfileVisible` calls
  `findMeById` first). For self requests, it is skipped. This means a
  token whose `sub` claim refers to a deleted user can hit
  `GET /users/me/ranking` and get an arbitrary state — either a
  silent success (ranking upsert on a dead user) or a 500 from the
  ranking analytics SQL hitting the `LEFT JOIN` exclusion.
- The correct guard is the global JWT guard's token-validation, which
  is done elsewhere. The local short-circuit is fine in principle but
  should still verify the user exists — the achievement module
  (`achievement.application.service.ts:345-351`) does this for
  `assertUserExists(userId)` exactly because soft-deletion is the
  common case.

**Recommendation**:
- Replace the `if (requesterId === targetUserId) return;` shortcut
  with: still call `findMeById` (the existence check), then run the
  privacy check. This mirrors the path used by every other public
  `:userId` endpoint and removes the asymmetry.

  ```ts
  async assertProfileVisible(targetUserId, requesterId): Promise<void> {
    const user = await this.userRepository.findMeById(targetUserId);
    if (!user) throw new UserNotFoundError();
    if (requesterId === targetUserId) return;
    const isPublic = await this.isUserProfilePublic(targetUserId);
    if (!isPublic) throw new UserProfilePrivateError(targetUserId);
  }
  ```
- Apply to all the public-list endpoints (`listUserBadges`,
  `getMyTournaments`, `getMyTournamentHistory`,
  `getPublicTournamentProfile`).

**Reasoning**: Soft-deletion is a normal lifecycle event; the module
should not depend on every endpoint's downstream code to handle a
NULL user. The fix restores a single, uniform existence + privacy
invariant at the boundary.

**Breaking change risk**: Low. The only behaviour change is that a
self request with a token for a soft-deleted user will now uniformly
return 404 (matching the cross-module pattern in the achievement
module) instead of a 500.

---

### F-5 · `StreakService.recalculateStreak` is incomplete (`TODO`s) but is wired into the `xp.added` event path

**Category**: Domain Logic / Data Consistency
**Severity**: High
**Location**:
- `src/modules/user/domain/services/streak.service.ts:36-90`
- `src/modules/user/infrastructure/adapters/ranking-xp-streak-listener.adapter.ts:62-79`
- `src/modules/attempt/infrastructure/repositories/attempt.repository.ts:481-515`
  (the actual atomic SQL update)
- `src/modules/achievement/infrastructure/adapters/user-achievement-listener.adapter.ts:60-92`
  (consumer of `user.streak_updated`)

**Current behavior**:
- `StreakService.recalculateStreak` declares:
  ```ts
  const lastAttemptDate = null; // TODO: fetch from user record or attempt history
  const previousStreak = 0;      // TODO: fetch from user record
  ```
  The branch logic that follows always falls through to the
  `else { currentStreak = 1; longestStreak = previousStreak; }` branch
  (the "streak broken — start fresh" path) because both probes are
  static (`null` vs `today` ≠ `null`; `null` vs `yesterday` ≠ `null`).
- Despite this, the method emits `user.streak_updated` with
  `currentStreak: 1, longestStreak: 0, previousStreak: 0` on every
  `xp.added` event, **and**
- `AttemptRepository.completeAttemptAndSideEffects` separately runs an
  *atomic* SQL `UPDATE users ... current_streak = ...` (lines 481-515)
  that does the real streak transition as part of the
  attempt-completion transaction.
- `RankingXpStreakListenerAdapter.onModuleInit` subscribes the broken
  `StreakService` to every `xp.added` event emitted by the ranking
  module (which fires for attempt completions, tournament completions,
  achievement grants, admin bonuses).

**Problem**:
- Two independent write paths exist for `current_streak` /
  `longest_streak`:
  1. The atomic SQL inside the attempt-completion transaction
     (authoritative, correct).
  2. `StreakService.recalculateStreak` invoked from `xp.added`
     (broken, emits events with wrong values).
- The broken event has a real downstream consumer: the achievement
  module's `UserAchievementListenerAdapter` reacts to
  `user.streak_updated` and feeds the event payload into the rule
  engine. The `currentStreak: 1, longestStreak: 0` payload will
  produce wrong achievement grants (e.g. 7-day-streak badge can never
  be awarded).
- For every XP source other than `quiz_attempts.completed` (e.g.
  tournaments, achievements, admin bonuses), the SQL transaction in
  `AttemptRepository.completeAttemptAndSideEffects` does *not* run, so
  the only path that updates `users.current_streak` is the broken
  `StreakService` — meaning tournaments and other XP sources leave the
  streak counter permanently at zero in the database, yet still emit
  `user.streak_updated = 1` events that the achievement engine consumes.

**Recommendation**:
- Pick one of:
  - (a) **Delete `StreakService` and `RankingXpStreakListenerAdapter`
    entirely.** The atomic SQL inside
    `AttemptRepository.completeAttemptAndSideEffects` already handles
    the only XP source that should move the streak counter
    (completed quiz attempts). Non-attempt XP sources (tournaments,
    bonuses) should not affect the streak. Emit the
    `user.streak_updated` event from the attempt-completion path so
    the achievement listener still works.
  - (b) **Finish `StreakService.recalculateStreak`**: read the user's
    current `lastStreakDay`, `currentStreak`, `longestStreak` from
    the DB, run the same §3.1 SQL semantics, persist the result, and
    then emit the event. Ensure tournament/achievement XP paths also
    route through this service (or define which XP sources count
    toward the streak).
- Add a regression test asserting that a tournament-win XP event leaves
  the streak counter unchanged in the DB *and* does not emit a
  spurious `user.streak_updated = 1`.

**Reasoning**: A canonical streak state lives in `users.current_streak`
and is updated by the attempt-completion SQL. The `StreakService`
implementation is a half-finished alternative that races with the
authoritative path and misleads the achievement engine. The simplest
correct outcome is to align everything on the atomic SQL and remove the
secondary path.

**Breaking change risk**: Medium. Achievement-module rules that listen
to `user.streak_updated` will continue to receive the same event types,
but with the correct payload after the fix. Any client UI that depended
on the wrong value (i.e. anyone who somehow wired up against the buggy
emission) will see the correct value.

---

### F-6 · `UpdateMeSettingsDto` writes to `users.settings` (generic JSONB) instead of `user_profile_settings` (privacy flags)

**Category**: REST API Design / Domain Model Consistency
**Severity**: High
**Location**:
- `src/modules/user/dto/request/update-me-settings.dto.ts`
- `src/modules/user/infrastructure/repositories/user.repository.ts:548-604`
  (`updateSettings`)
- `src/core/database/schema/user/schema.ts:78-110` (`user_profile_settings`)
- `src/core/database/schema/auth/schema.ts:75`
  (`users.settings` JSONB)

**Current behavior**:
- `user_profile_settings` has 6 explicit privacy toggles
  (`isPublic`, `showStatistics`, `showAchievements`, `showActivity`,
  `showRankImprovement`, `showTournamentActivity`).
- `users.settings` is a generic `jsonb` column for arbitrary per-user
  preferences (theme, notifications, language, etc.).
- `PATCH /users/me/settings` accepts an arbitrary JSON object and writes
  it *whole* to `users.settings`. There is no DTO or endpoint that
  reads or updates the `user_profile_settings` table.
- The `UserMeResponseDto` includes `settings: users.settings` — never
  any of the privacy flags.

**Problem**:
- The privacy toggles that the schema explicitly defines are
  unreachable from the API. They are never set, never returned, never
  enforced (see F-7). A user wanting to make their profile private has
  no API surface to do so.
- The endpoint name `UpdateMeSettingsDto` is misleading: a client
  reading the docs will reasonably assume this is the place to set
  privacy toggles. Instead, the body shape (`Record<string, unknown>`,
  `maxProperties: 50`, `MaxKeyStringLength`) is oriented at
  key-value preferences.
- The user's response (`UserMeResponseDto.settings`) returns the same
  `users.settings` blob — making it impossible for a client to know
  whether `isPublic: false` was actually respected.

**Recommendation**:
- Add explicit sub-DTOs (or a new endpoint) for the privacy fields,
  e.g. `GET /users/me/profile-settings` and
  `PATCH /users/me/profile-settings` with typed boolean fields for
  each privacy toggle. Map these to `user_profile_settings`.
- Either rename `PATCH /users/me/settings` to
  `PATCH /users/me/preferences`, or split into two endpoints
  (`/settings` for the privacy table, `/preferences` for the JSONB
  blob).
- Update `UserMeResponseDto` (or a new dedicated
  `UserMeProfileSettingsDto`) to surface the privacy flags so the
  client UI can render them.

**Reasoning**: Schema-declared fields that are never written or read
from the API are dead code. Either the schema column should be dropped
or the API should expose it. The audit prefers "expose it" because the
intent (privacy toggles) is clearly part of the product surface, and
making them settable is required to satisfy F-7 below.

**Breaking change risk**: Medium-High. The current endpoint must be
either renamed or complemented. If the existing endpoint is renamed,
clients must migrate to the new URL.

---

### F-7 · Granular privacy flags (`showStatistics`, `showAchievements`, `showActivity`, `showTournamentActivity`) are never enforced

**Category**: Security / Domain Logic
**Severity**: High
**Location**:
- `src/core/database/schema/user/schema.ts:78-110`
- `src/modules/user/domain/user.service.ts:65-68`
  (`isUserProfilePublic`)
- `src/modules/user/infrastructure/repositories/user.repository.ts:81-89`
  (`findUserProfileSettings`)

**Current behavior**:
- `user_profile_settings` defines five granular visibility flags:
  `showStatistics`, `showAchievements`, `showActivity`,
  `showRankImprovement`, `showTournamentActivity`.
- The repository reads only `isPublic` (line 83:
  `.select({ isPublic: userProfileSettings.isPublic })`).
- The domain service exposes only `isUserProfilePublic` which checks
  `isPublic` (line 67: `return settings?.isPublic ?? true;`).
- A grep across the codebase for these flag names returns zero hits
  outside the schema file:
  `showStatistics|showAchievements|showActivity|showTournamentActivity`
  matches only `user/schema.ts` lines 87-91.

**Problem**:
- All four granular toggles are persisted but never read or enforced.
  A user who sets `showAchievements = false` cannot prevent another
  user from reading their badges via `GET /users/:userId/badges`, their
  activity via `GET /users/me/activity` (no route exposes activity
  for other users, but the data is reachable internally), etc.
- Specifically:
  - `showAchievements` should gate `listBadgesByUserId`.
  - `showStatistics` should gate `getUserAnalytics`,
    `getPublicTournamentProfile`, `getUserRanking`,
    `getUserQuizAnalytics` (see F-1).
  - `showActivity` should gate any future `/users/:userId/activity`
    route and inform the social module's `getUserActivity` (which
    today does not consult user privacy at all — see F-13).
  - `showTournamentActivity` should gate
    `getUserTournamentHistory` and the public tournament profile.

**Recommendation**:
- Extend `UserRepositoryPort.findUserProfileSettings` to return all
  relevant booleans (or add `findUserPrivacySettings` returning a
  typed object).
- Extend `UserDomainService` with a `getEffectiveVisibility(userId)`
  helper that returns the resolved `{ isPublic, showAchievements,
  showStatistics, showActivity, showTournamentActivity }` for the
  current requester, defaulting to `true` for missing rows.
- Apply the appropriate guard at each public `:userId` endpoint in
  `UserController` (and at the social-module
  `getUserActivity` boundary — see F-13).

**Reasoning**: The schema defines these flags, the
`isUserProfilePublic` method is the obvious extension point, and the
endpoints already call `assertProfileVisible`. Adding the granular
checks is a localized change.

**Breaking change risk**: High (intentional). A user who had previously
publicly shared their analytics and toggles them off will now start
receiving 403 for those reads. This is the intended behavior — the
schema fields imply the feature exists.

---

### F-8 · Duplicate `UserRepository` provider registration between `UserModule` and `DatabaseModule`

**Category**: Maintainability
**Severity**: High (correctness, not just style)
**Location**:
- `src/modules/user/user.module.ts:30, 34` (registers
  `UserRepository` and binds `USER_REPOSITORY_PORT` via `useClass`).
- `src/core/database/database.module.ts:35, 45` (also registers
  `UserRepository` as a global provider, exported).
- `src/app.module.ts:116` (comment explicitly notes that
  `USER_REPOSITORY_PORT` is intentionally registered in the user module
  while the concrete class is exposed via the global DB module).

**Current behavior**:
- `UserRepository` is declared twice: once as a global provider in
  `DatabaseModule`, once locally in `UserModule`.
- NestJS resolves this with two distinct injector trees; the local
  registration wins for `@Inject(USER_REPOSITORY_PORT)` consumers
  inside `UserModule`. Other modules that inject the concrete class
  (`CommentNotificationListenerAdapter`,
  `UserExistenceAdapter`, `SocialService`) get the global instance.
- The `app.module.ts` comment acknowledges this pattern is intentional
  ("we ensure that these guards/interceptors/filters are applied to all
  routes ... By doing this, we ensure that ..."), but the comment is
  about APP_GUARD, not about the `USER_REPOSITORY_PORT` binding
  (which is a different paragraph of the comment).

**Problem**:
- Two instances of `UserRepository` exist at runtime. Each instance
  holds its own `DrizzleDB` (both are decorated with `@Inject(DRIZZLE)`
  and pull the same singleton, so this is harmless today — but it is a
  latent landmine: any future state on the repository (caches, in-flight
  counters, mock-injection hooks for tests) would diverge silently
  between the two trees.
- Module-local binding via `useClass` is unusual in this codebase. The
  auth module's analogous setup uses `useExisting`:
  `auth.module.ts:118` →
  `{ provide: AUTH_USER_REPOSITORY_PORT, useExisting: UserRepository }`
  (and the comment there correctly describes the choice). The user
  module's choice of `useClass` creates a *second* instance instead of
  aliasing the existing one.
- The comment in `app.module.ts` is misleading — it does not justify
  the per-module instance, only the use of `provide/useClass` for
  ports in general.

**Recommendation**:
- Either:
  - (a) Drop the `UserRepository` declaration from `DatabaseModule`
    (remove lines 35 and 45 from `database.module.ts`), and keep only
    the `UserModule` registration. Document why the user module is the
    canonical owner.
  - (b) Keep the `DatabaseModule` registration and switch the
    `UserModule` binding to `useExisting`:
    `{ provide: USER_REPOSITORY_PORT, useExisting: UserRepository }`,
    matching the auth module's pattern.

  Option (b) is the lower-risk change.

**Reasoning**: Two instances of the same class with the same DB handle
is currently correct, but it is a maintainability and testability
hazard. The auth module has already chosen the `useExisting` pattern;
the user module should match.

**Breaking change risk**: None. The same `UserRepository` class is used;
only the DI binding changes.

---

## 3. Medium Findings

### F-9 · `StreakService.recalculateStreak` emits the wrong event payload shape (object vs class) but the port signature accepts `unknown` and it works by accident

**Category**: Domain Model Consistency
**Severity**: Medium
**Location**:
- `src/modules/user/domain/services/streak.service.ts:68-78`
- `src/modules/user/domain/events/user-domain-event-bus.port.ts:13`
- `src/modules/user/domain/events/user-domain.events.ts:26-34`
- `src/modules/user/infrastructure/adapters/ranking-xp-streak-listener.adapter.ts:42-44`

**Current behavior**:
- `UserStreakUpdatedEvent` is declared as an `interface` in
  `user-domain.events.ts:26-34` (not a class).
- The event bus port's `emitStreakUpdated(event: UserStreakUpdatedEvent)`,
  but `subscribe` accepts `(event: unknown) => void`.
- `StreakService.recalculateStreak` constructs a *plain object* and
  passes it to `emitStreakUpdated`. The plain object happens to
  satisfy the structural type `UserStreakUpdatedEvent`.
- The achievement listener adapter (`user-achievement-listener.adapter.ts:55`)
  discriminates via `event.eventType === 'user.streak_updated'`. This
  works because the runtime object has `eventType: 'user.streak_updated'`.

**Problem**:
- Two other user-domain events are concrete classes (`UserProfileUpdatedEvent`,
  `UserSettingsUpdatedEvent`) emitted via dedicated `emitProfileUpdated`
  / `emitSettingsUpdated` ports. The streak event is the odd one out:
  it's an interface, emitted via `emitStreakUpdated(event)` (which is
  structurally typed), and consumers receive a `UserDomainEvent` union
  that includes the *class* members but the runtime type is a plain
  object.
- `instanceof UserStreakUpdatedEvent` would fail on the current payload
  (because it is not a class). Today no listener uses `instanceof`,
  but the inconsistency will surprise future contributors.

**Recommendation**:
- Convert `UserStreakUpdatedEvent` to a class (matching the pattern of
  the other two events). Update `StreakService` to construct an
  instance.

**Reasoning**: Consistency. The user module already chose the
"class-based event with `readonly eventType`" pattern; the streak
event should match.

**Breaking change risk**: Low. Internal type contract.

---

### F-10 · `GET /users/me/tournament-history` and `GET /users/:userId/tournament-history` return the same DTO shape; the public-history endpoint is intended to be privacy-aware but is documented identically to the me endpoint

**Category**: REST API Design / Swagger
**Severity**: Medium
**Location**:
- `src/modules/user/transport/controller/user.controller.ts:137-152,
  276-297`
- `src/modules/user/transport/swagger/user-swagger-decorators.ts:152-162`
- `src/modules/user/dto/response/my-tournament-history.dto.ts`

**Current behavior**:
- Both endpoints share the same Swagger decorator
  (`ApiPublicTournamentHistoryResponse` = `ApiMyTournamentHistoryResponse`),
  the same DTO (`MyTournamentHistoryResponseDto`), and the same
  application method (`getMyTournamentHistory`).
- The public endpoint routes via `assertProfileVisible`, the me
  endpoint does not.
- The decorator's description for `ApiPublicTournamentHistoryResponse`
  is identical to `ApiMyTournamentHistoryResponse`.

**Problem**:
- The public-history response is wired up to use the *me* DTO and the
  *me* Swagger decorator. The semantics differ (one is "my completed
  tournaments", the other is "another user's completed tournaments
  subject to privacy"). The wire shape currently matches, but the
  intent for future evolution does not.
- If/when the privacy flags are enforced (F-7), the public endpoint
  may legitimately omit or alter some fields. The current setup
  forces both endpoints to share one DTO.

**Recommendation**:
- Either rename the existing DTO to `TournamentHistoryItemDto` /
  `TournamentHistoryResponseDto` (without the `My` prefix) and use
  the same DTO from both endpoints (acceptable today), or
- Introduce a separate `PublicTournamentHistoryResponseDto` and
  separate Swagger decorator. Update `UserPresenter` to project
  fields accordingly.

**Reasoning**: Naming consistency. The codebase uses the `My` prefix
elsewhere (`MyTournamentsResponseDto`, `MyTournamentAnalyticsResponseDto`,
`MyBadgeItemDto`) consistently for self-scoped data. Sharing one DTO
between a self-scoped and an externally-scoped endpoint is a latent
maintenance hazard.

**Breaking change risk**: Low if the wire shape is preserved. Low-
Medium if the DTO is split.

---

### F-11 · Swagger `ApiOkResourceList` references wrapper DTOs instead of item DTOs for `MyTournaments`, `MyTournamentHistory`, and the quiz list — produces inaccurate OpenAPI schemas

**Category**: Swagger / OpenAPI
**Severity**: Medium
**Location**:
- `src/modules/user/transport/swagger/user-swagger-decorators.ts:146-180`

**Current behavior**:
```ts
export const ApiMyTournamentsResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentsResponseDto, 'cursor', { ... });
export const ApiMyTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryResponseDto, 'cursor', { ... });
export const ApiUserQuizListResponse = (): MethodDecorator =>
  ApiOkResourceList(QuizListResponseDto, 'cursor', { ... });
```
- `ApiOkResourceList(wrapper, ...)` produces an OpenAPI schema with
  `data: wrapper[]` — i.e. a list of wrappers. The runtime wire shape
  is `data: MyTournamentItemDto[]` (the item DTO), so the schema
  describes the wrong type.
- The comment block above the badges/activity decorators explicitly
  documents this past fix:
  > Before: `ApiOkResourceList(UserBadgesResponseDto, ...)` generated
  >   `data: UserBadgesResponseDto[]`  ← wrong (it's the wrapper, not the item)
  > After:  `ApiOkResourceList(UserBadgeItemDto, ...)` generates
  >   `data: UserBadgeItemDto[]`      ← matches the wire shape
  …but the same mistake has been preserved for the three remaining
  endpoints.

**Problem**:
- Generated TypeScript clients (e.g. from `openapi-typescript`) will
  type `data` as `MyTournamentsResponseDto[]`, not
  `MyTournamentItemDto[]`. This produces compile errors on the client
  side or, worse, silently-wrong code if the client developer treats
  the wrapper as an item.
- The comment above the badges/activity decorators proves the project
  is aware of the bug. It was simply not propagated.

**Recommendation**:
- Pass the item DTOs:
  - `ApiMyTournamentsResponse` →
    `ApiOkResourceList(MyTournamentItemDto, 'cursor', { ... })`.
  - `ApiMyTournamentHistoryResponse` →
    `ApiOkResourceList(MyTournamentHistoryItemDto, 'cursor', { ... })`.
  - `ApiUserQuizListResponse` →
    `ApiOkResourceList(QuizListItemDto, 'cursor', { ... })`.
- Re-export the items if they are not already exposed in the DTO file.

**Reasoning**: Trivial fix, restores schema accuracy. The badges/activity
decorators above already document the canonical pattern.

**Breaking change risk**: None (schema only). Generated clients may
type `data` differently — this is the intended outcome.

---

### F-12 · `UserApplicationService.getMyTournaments` ignores `requesterId` when `requesterId !== userId` is passed (the controller always passes `userId` for both — collapses the privacy shortcut)

**Category**: Domain Logic / Redundancy
**Severity**: Medium
**Location**:
- `src/modules/user/application/user.application.service.ts:102-133`
- `src/modules/user/domain/user.service.ts:280-315`

**Current behavior**:
- The controller (`user.controller.ts:120-135`) calls
  `listMyTournaments(userId, userId, query)` for `GET /users/me/tournaments`.
- The application service signature is `getMyTournaments(userId,
  requesterId, query)`. The two `userId` arguments are always equal for
  the `/me/` route.
- For the public `GET /users/:userId/tournament-history`, the
  controller correctly passes `(userId, requesterId)` with distinct
  values — so `requesterId` is meaningful.
- `UserDomainService.getMyTournaments` then calls
  `assertProfileVisible(query.userId, query.requesterId)`, which
  correctly short-circuits for self-requests and gates private
  profiles for non-self.

**Problem**:
- The dual-`userId` call from the `/me/tournaments` controller is a
  misread of the API contract: it passes the same value for the
  "target" and the "requester". The application service's
  `requesterId` parameter is therefore a tautology for the me
  endpoint. This works today, but is confusing for future readers and
  obscures the privacy semantics.
- It also conflates two distinct concerns:
  - `userId` is the user whose tournaments are being listed.
  - `requesterId` is the user making the request (which may be
    different for `/users/:userId/tournament-history`).

**Recommendation**:
- For the `/me/*` routes, pass the requester's userId explicitly as
  `requesterId` and read the target from a different parameter
  (e.g. `getMyTournaments(requesterId, query)` with the target implied
  to be the requester). Or refactor the me-endpoints into a
  dedicated `getMyTournaments(requesterId, query)` method.

**Reasoning**: The dual-parameter signature on the application service
is correct for the public endpoint, but the me-endpoint collapses it.
The ambiguity is a maintainability landmine.

**Breaking change risk**: None (refactor).

---

### F-13 · `GET /social/users/:userId/activity` does not consult `user_profile_settings.showActivity`

**Category**: Cross-Module Consistency / Security
**Severity**: Medium
**Location**:
- `src/modules/social/transport/controller/social.controller.ts:200-224`
- `src/modules/social/domain/services/social.service.ts:640-664`

**Current behavior**:
- The social controller exposes a public `/social/users/:userId/activity`
  endpoint that returns the target user's activity feed.
- The service checks only the block relationship (`BlockedUserError` /
  `SOCIAL_BLOCKED_USER` / `SOCIAL_USER_BLOCKED`) before returning data.
- It does not call `userDomainService.assertProfileVisible` and does
  not read `user_profile_settings.showActivity`.

**Problem**:
- The user module's privacy semantics (specifically the
  `showActivity` flag) is not honoured by the social module's
  counterpart. Two modules own overlapping concepts (activity feed)
  and apply different rules.
- The user module's own `GET /users/me/activity` exists, but a user
  with `showActivity = false` (if/when the flag is enforced — see
  F-7) cannot prevent the social route from leaking the same data.

**Recommendation**:
- Inject `UserDomainService` (or a slim privacy-port) into
  `SocialService.getUserActivity` and call `assertProfileVisible`
  before the block check, so the privacy gate is checked first.
- This unifies the rules between the user and social modules.

**Reasoning**: Cross-module consistency. The activity feed is the
same data viewed from two routes; both must apply the same privacy
gate.

**Breaking change risk**: Medium. Once `showActivity` is enforced
end-to-end, existing clients that relied on the always-public social
route will see 403s.

---

### F-14 · `users.settings` JSONB is round-tripped into `UserMeResponseDto.settings` without validation, with no max-depth or value-length constraints

**Category**: Domain Model Consistency / Validation
**Severity**: Medium
**Location**:
- `src/modules/user/dto/request/update-me-settings.dto.ts:16-30`
- `src/modules/user/infrastructure/repositories/user.repository.ts:548-604`
- `src/modules/user/mappers/user-response.mapper.ts:17`

**Current behavior**:
- `UpdateMeSettingsDto` validates the top-level object (max 50 keys,
  each key string ≤ 200 chars) but allows arbitrary nested JSON values
  with no constraints on depth, value string length, or value type.
- `UserRepository.updateSettings` writes the blob unchanged to
  `users.settings` (Postgres JSONB column).
- `UserMeResponseDto.settings` is returned to any authenticated client
  that calls `GET /users/me` (self) — but only to self, since the
  controller does not expose a public profile endpoint that returns
  this DTO. So the data exposure surface is limited to the
  authenticated user themselves.
- `mappers/user-response.mapper.ts:17` guards against
  `isObjectRecord(row.settings)` returning `false` and falls back to
  `{}`.

**Problem**:
- The DTO comment explicitly notes:
  > Individual value constraints (e.g. max string length for string
  > values, max nesting depth) can be added later if abuse patterns
  > emerge.
  This is acceptable as a deliberate design choice, but combined with
  the fact that `users.settings` is the *only* JSONB-blob write path
  with no application-side schema, it is a maintainability hazard.
  Settings "schemas" drift client-side; consumers can disagree on the
  meaning of `theme: 'dark'`.
- The `user_profile_settings` table has a `jsonb_typeof(settings) =
  'object'` check (`auth/schema.ts:102`) which only enforces "is
  object" — it does not bound depth or key counts.

**Recommendation**:
- Document the design choice in the module's README and decide whether
  the JSONB blob should be normalized into typed columns over time.
- If kept, add a server-side `MAX_VALUE_LENGTH` and depth check in the
  DTO (`class-validator`'s `@Validate(...)` custom or a transform).
- Consider using `user_profile_settings` as the typed surface (see
  F-6) and `users.settings` for the truly-arbitrary blob.

**Reasoning**: Maintainability, not a security bug (the data only
flows back to the same user). But a long-lived JSONB blob with no
schema discipline is a recipe for product drift.

**Breaking change risk**: Low.

---

### F-15 · `UserRepository.updateProfile` upsert does not touch `users.updatedAt`, so `UserMeResponseDto.updatedAt` is stale after a profile PATCH

**Category**: REST API Design / Data Consistency
**Severity**: Medium
**Location**:
- `src/modules/user/infrastructure/repositories/user.repository.ts:498-546`
- `src/modules/user/dto/response/user-me.dto.ts:62-67`

**Current behavior**:
- `updateProfile` updates `userProfiles.updatedAt` in the SET clause.
- The returned `UserMeRow` re-joins `users.updatedAt` (line 533), but
  the update transaction does not bump `users.updatedAt`.
- `UserMeResponseDto.updatedAt` is documented as
  "Last write to the user record (any column, not just profile)".

**Problem**:
- After `PATCH /users/me { bio: "..." }`, the response shows
  `updatedAt` as the timestamp of the last *user* row update (which
  may be days old). Clients using `updatedAt` to detect "profile has
  been modified" will not see the change.

**Recommendation**:
- In `updateProfile`, also update `users.updatedAt = nowIso` in the
  same transaction.

**Reasoning**: One-line fix; aligns the documented contract
("last write to the user record, any column") with reality.

**Breaking change risk**: None.

---

### F-16 · `UserRepository.updateProfile` strips `.trim()` whitespace from `bio` but does not validate the trimmed length against the `user_profiles_display_name_len` DB check

**Category**: Validation / Data Integrity
**Severity**: Medium
**Location**:
- `src/modules/user/domain/user.service.ts:165-173`
- `src/modules/user/dto/request/update-me.dto.ts:38-42`
- `src/core/database/schema/user/schema.ts:66-68`

**Current behavior**:
- DTO `@MaxLength(500)` runs on the *raw* string (before trimming).
- Domain layer calls `command.bio?.trim() ?? null`, reducing length.
- Repository upserts the trimmed value.
- DB check
  `user_profiles_display_name_len` (note: misnamed — applies to
  `display_name` only) is on `length(btrim(display_name)) >= 1 AND <= 100`.

**Problem**:
- The bio length is not DB-checked. The DTO's `@MaxLength(500)` is
  enforced before trimming, so a 500-char bio with 480 leading
  whitespace characters would pass DTO validation, get trimmed to
  ~20 chars, and silently shrink in the DB. Not a corruption, but the
  API contract is leaky.
- The bio schema has no `length` check, unlike `display_name`.

**Recommendation**:
- Add a `CHECK (bio IS NULL OR length(btrim(bio)) <= 500)` to the
  schema in a follow-up migration, OR
- Validate the trimmed length in the domain layer before persisting.

**Reasoning**: Mirrors the existing pattern for `display_name`. The
fix is small.

**Breaking change risk**: None for existing data (existing rows pass).
For future payloads, no payload can pass the DTO today that violates
the post-trim 500-char limit.

---

### F-17 · `userProfiles.tagline` and `userProfiles.pinnedBadgeIds` schema columns are not exposed by any DTO or endpoint

**Category**: REST API Design / Maintainability
**Severity**: Medium
**Location**:
- `src/core/database/schema/user/schema.ts:46-47`
- (No `tagline` or `pinnedBadgeIds` field anywhere in the DTOs or
  application/service code.)

**Current behavior**:
- The schema defines `tagline: text('tagline')` (with a `length <= 160`
  check) and `pinnedBadgeIds: jsonb('pinned_badge_ids').default([])`.
- No DTO, request, response, mapper, service, or controller path
  references these columns. The schema is the only place they appear.

**Problem**:
- Dead schema. Two persisted columns are unreachable from the API.
- Either the product feature exists and the API is incomplete, or the
  columns are leftover and should be dropped.

**Recommendation**:
- Confirm product intent. Either:
  - Add `GET /users/me` / `PATCH /users/me` fields for `tagline` and
    `pinnedBadgeIds` (with appropriate DTOs, validators, and security
    checks on the pinned-badge ids), or
  - Drop the columns in a follow-up migration.

**Reasoning**: Schema dead code is a maintainability hazard (it
appears in `findMeById`'s `LEFT JOIN` projection, so any read path
that projects all `userProfiles` columns will read NULL for these —
which is fine, but it implies future intent that never landed).

**Breaking change risk**: Depends on the chosen direction.

---

## 4. Low / Improvement Findings

### F-18 · `UserRankingNotFoundError` and `UserAnalyticsNotFoundError` are exported but never thrown

**Category**: Maintainability / Dead Code
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/domain/errors/user-domain.errors.ts:43-62`
- `src/common/errors/problem-code-mapping.ts:336-357`

**Current behavior**:
- Both classes are exported with sensible 404 mappings.
- `UserRankingNotFoundError` is never thrown (the `getUserRanking`
  domain service creates the row on demand instead — see F-19).
- `UserAnalyticsNotFoundError` is never thrown (`getUserAnalytics`
  always returns a computed payload, never a not-found signal).

**Problem**:
- Dead code. Both classes inflate the public error surface and the
  problem-mapping table without a single throw site.

**Recommendation**:
- Delete both classes and the matching `ProblemCodeMapping` entries,
  OR
- Make the service actually throw them (preferred for
  `UserAnalyticsNotFoundError`: the analytics payload currently
  silently returns 0/empty for a deleted user, which masks the
  not-found state).

**Reasoning**: Module markers are documented in the file comment as
legitimate intermediate classes, but these two are not even used as
markers — they have a `code` field and are wired into the mapping.
Drop them or use them.

**Breaking change risk**: Low.

---

### F-19 · `UserDomainService.getUserRanking` silently creates a `user_ranking` row on read (write-on-read side effect) — only documented in Swagger, not in code

**Category**: Maintainability / Developer Experience
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/domain/user.service.ts:126-149`
- `src/modules/user/transport/swagger/user-swagger-decorators.ts:130-138`

**Current behavior**:
- `getUserRanking` calls `userRepository.getUserRanking`. If no row
  exists, it calls `userRepository.createUserRanking(userId)` and
  uses the new row.
- The `ApiUserRankingResponse` Swagger decorator documents this:
  > Note: the first call for a user with no ranking record creates one
  > (write-on-read).
- No other endpoint in the codebase exhibits this write-on-read
  pattern.

**Problem**:
- The write-on-read is a hidden side effect on a `GET` endpoint. A
  developer reading `user.service.ts` may not realize this from the
  implementation comment (`Phase 4.1 (L1)`). The intent is documented
  in Swagger, which is good, but the convention is inconsistent with
  the rest of the codebase.

**Recommendation**:
- Document the contract at the top of `getUserRanking` (and
  propagate to the controller method's `description` if not already
  done — it currently is).
- Consider whether `createUserRanking` should run inside a transaction
  (it currently does not, per the repository code).

**Reasoning**: Pure documentation/clarity improvement.

**Breaking change risk**: None.

---

### F-20 · `listUserBadges`, `listUserActivity`, `getMyTournaments`, `getMyTournamentHistory` differ in default `limit` (10 vs 20) — minor inconsistency

**Category**: REST API Design / Developer Experience
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/dto/request/list-user-badges-query.dto.ts:25` (`= 10`)
- `src/modules/user/dto/request/list-user-activity-query.dto.ts:25` (`= 20`)
- `src/modules/user/dto/request/get-my-tournaments-query.dto.ts:26` (no default)
- `src/modules/user/dto/request/get-my-tournament-history-query.dto.ts:26` (no default)

**Current behavior**:
- Four pagination DTOs exist with inconsistent defaults.
- The application service fills in `query.limit ?? 20` for the
  tournament endpoints (where the DTO default is absent), but
  `listUserBadges` / `listUserActivity` rely on the DTO default
  (`10` / `20`).
- The quiz module's `ListQuizzesQueryDto` defaults to `20`.

**Problem**:
- Defaults are scattered across DTOs and application services. A new
  contributor must check both layers to find the canonical default.
- The badge default of `10` is unusual — the quiz module uses `20`,
  the activity module uses `20`, and other modules also use `20`.

**Recommendation**:
- Standardize on a single default (e.g. `20`) for every list endpoint,
  and apply it either in the DTO (via `@Expose` / `@Transform` + a
  property default) or in the application service — but not both.

**Reasoning**: Consistency. The rest of the codebase gravitates to 20.

**Breaking change risk**: Low. The badge endpoint's default would
change from 10 to 20 — clients that omitted `limit` and rely on
exactly 10 results would need to set `limit=10`.

---

### F-21 · `apiOk` static method on `UserPresenter` is private but `wrapPaginatedDto` is module-level — minor asymmetry

**Category**: Maintainability
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/transport/presenters/user.presenter.ts:27-41, 56-86`

**Current behavior**:
- `wrapPaginatedDto` is a free function at module scope.
- `UserPresenter.ok` is a `private static readonly` reference to
  `ApiResponse.ok`.

**Problem**:
- Minor asymmetry. Either both should be module-level helpers or both
  should be static methods. The current shape is not wrong, just
  inconsistent.

**Recommendation**:
- Leave as-is (this is purely stylistic).

**Reasoning**: Stylistic, low value.

**Breaking change risk**: None.

---

### F-22 · `private static readonly ok` arrow property on `UserPresenter` is shared across 8 endpoints but does not surface typed `data` shape

**Category**: Maintainability / Type Safety
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/transport/presenters/user.presenter.ts:58`

**Current behavior**:
- `private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);`
- All 8 single-resource endpoints bind this directly:
  `readonly getMe = UserPresenter.ok<UserMeResponseDto>;`.
- This produces a uniform envelope for all of them but does not
  encode any per-endpoint invariants.

**Problem**:
- Trivial; flagging only because other modules' presenters sometimes
  attach a small header (request id, debug trace) at the presenter
  level. The user module's presenter is correct but minimal.

**Recommendation**:
- Leave as-is.

**Reasoning**: Stylistic. No change needed.

**Breaking change risk**: None.

---

### F-23 · `GetMyTournamentsQueryDto` and `GetMyTournamentHistoryQueryDto` accept a `cursor` without validating the base64 / JSON shape — relies on the mapper to throw

**Category**: REST API Design / Validation
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/dto/request/get-my-tournaments-query.dto.ts:1-28`
- `src/modules/user/dto/request/get-my-tournament-history-query.dto.ts:1-28`
- `src/modules/user/mappers/my-tournament-cursor.mapper.ts:11-26`
- `src/modules/user/mappers/my-tournament-history-cursor.mapper.ts:11-26`

**Current behavior**:
- DTOs accept any string under `cursor`. The mapper is responsible for
  rejecting malformed cursors.
- The mapper throws `new Error('Invalid cursor: ...')` on failure —
  which the global filter maps to 500 (see F-3).

**Problem**:
- Combined with F-3, a malformed cursor returns 500. After F-3 is
  fixed (the mapper rejects UUIDv7, so every legitimate cursor is
  rejected), every cursor will return 500. Even after that fix, the
  mapper's `new Error('Invalid cursor: ...')` should be
  `new BadRequestException('Invalid cursor')` to produce 400 instead
  of 500.

**Recommendation**:
- Replace `throw new Error('Invalid cursor: ...')` in the mappers with
  `throw new BadRequestException('Invalid cursor')`, matching the
  strict decoder style in `src/common/utils/cursor.util.ts`.

**Reasoning**: Aligns with the project convention.

**Breaking change risk**: None (only error code changes from 500 to
400, which is the correct response).

---

### F-24 · `UserApplicationService.toUserBadgesResponse` duplicates the cursor-serialization logic across `listUserBadges`, `listUserActivity`, `getMyTournaments`, `getMyTournamentHistory`

**Category**: Redundancy / Maintainability
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/application/user.application.service.ts:205-233` and
  the inline cursor serialization in `listUserActivity`,
  `getMyTournaments`, `getMyTournamentHistory`

**Current behavior**:
- Each list endpoint independently:
  1. Parses the cursor (via its own mapper).
  2. Calls the domain service.
  3. Builds the `{ items, pagination: { limit, hasNextPage, nextCursor } }`
     shape, serializing the next cursor inline via the same mapper.

**Problem**:
- Cursor handling is repeated four times. A shared
  `wrapPaginated(items, limit, hasNextPage, nextCursor, serialize)`
  helper would consolidate the boilerplate.

**Recommendation**:
- Extract the page-building logic into a small helper that takes the
  serialize function as a callback. Pure refactor.

**Reasoning**: Maintainability. Optional.

**Breaking change risk**: None.

---

### F-25 · Controller comment `// registered last to avoid shadowing /me/* routes` is misleading: NestJS routes are matched by registration order, but `:userId` cannot shadow literal `me` because `me` is matched as `:userId` first

**Category**: Developer Experience / Comment
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/transport/controller/user.controller.ts:220-222`

**Current behavior**:
```ts
// ─── Public :userId routes (registered last to avoid shadowing /me/* routes) ──
// NOTE: Global JwtGuard enforces authentication; @ApiAuth() documents this in OpenAPI.
```

**Problem**:
- The comment implies that `:userId` could shadow `me`. In NestJS's
  Express adapter, the first matching route wins. If `:userId` routes
  are registered first, then `GET /me` would resolve to
  `GET /:userId` and `userId = 'me'` would fail UUID validation
  (`ParseUUIDPipe({ version: '7' })`). The current registration
  ordering has the `me/*` routes first, then `:userId` last — which
  is the correct ordering. The comment is correct in spirit but its
  framing is slightly misleading: the reason `:userId` comes last is
  not that it would "shadow" but that the UUID pipe would reject the
  literal `me`.
- This is purely a comment accuracy issue.

**Recommendation**:
- Update the comment to:
  ```ts
  // ─── Public :userId routes (registered AFTER /me/* to ensure literal
  //   `me` matches the /me/* handlers; :userId would otherwise be
  //   matched first and rejected by ParseUUIDPipe(version: '7')).
  ```

**Reasoning**: Documentation accuracy.

**Breaking change risk**: None.

---

### F-26 · `UserActivityCursorPayload.isUuid` regex pattern duplicates the same `[1-5]` version-restriction bug already covered by F-3 — but it lives only on UUIDs used by user-activity events (which are all UUIDv7)

**Category**: Bug (subset of F-3)
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/mappers/user-activity-cursor.mapper.ts:9-10`

**Current behavior**: Identical bug as F-3. Listed separately because
the file also has its own `isIsoDateString` regex that does not
validate the *time* portion (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`),
so a malformed timestamp string like `"2026-01-01T99:99:99"` would
also pass.

**Problem**:
- Same as F-3 (covered there).
- Additionally: the `isIsoDateString` check is loose (it validates
  shape, not value). The `common/utils/cursor.util.ts` already exports
  a stricter `isIsoDateString` that uses `Date.parse`.

**Recommendation**:
- Adopt the `isIsoDateString` helper from `cursor.util.ts` instead of
  redefining a loose regex inline.

**Reasoning**: Centralized utility.

**Breaking change risk**: Low.

---

### F-27 · `isObjectRecord(item.metadata)` fallback to `{}` in `toUserActivityItem` silently masks schema-violating metadata rows

**Category**: Domain Logic / Data Consistency
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/application/user.application.service.ts:226-233`

**Current behavior**:
```ts
private toUserActivityItem(item: UserActivityRow): UserActivityResponseDto['items'][number] {
  return {
    ...
    metadata: isObjectRecord(item.metadata) ? item.metadata : {},
  };
}
```

**Problem**:
- The DB check `user_activity_events_metadata_object` enforces
  `jsonb_typeof(metadata) = 'object'` at write time. So
  `isObjectRecord` should always be true. The `{}` fallback is
  defensive but if it ever triggers, the client loses all event
  metadata without any log signal.

**Recommendation**:
- Log a `warn` event when the fallback triggers so a schema violation
  (or migration bug) is observable.

**Reasoning**: Observability.

**Breaking change risk**: None.

---

### F-28 · `ApiUserMeResponse`'s `@ApiProperty` for `displayName`, `avatarUrl`, `bio` is typed as `String` even though the field is `string | null` — minor Swagger schema detail

**Category**: Swagger / OpenAPI
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/dto/response/user-me.dto.ts:16-39`

**Current behavior**:
- `displayName!: string | null` (with `nullable: true`).
- `@ApiPropertyOptional({ type: String, ... nullable: true })`.

**Problem**:
- The OpenAPI generator will emit `type: 'string'`, `nullable: true`,
  `format: undefined`. That is correct, but the `userId`, `username`,
  `email` examples use the `format: 'uuid'` for `userId` (no — they
  use `example` only).
- No real bug. Flagging only because the audit is broad.

**Recommendation**:
- Leave as-is.

**Reasoning**: Stylistic.

**Breaking change risk**: None.

---

### F-29 · `UserController.listUserActivity` is documented as "my activity" but lives in the public `/me/` namespace — naming inconsistency with `social.controller.ts.getUserActivity`

**Category**: Cross-Module Consistency
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/transport/controller/user.controller.ts:101-118`
- `src/modules/social/transport/controller/social.controller.ts:200-224`

**Current behavior**:
- User module: `GET /users/me/activity` returns "my activity events"
  (auth-gated, only the authenticated user's own activity).
- Social module: `GET /social/users/:userId/activity` returns the
  target user's activity (subject to block rules only, see F-13).

**Problem**:
- Two endpoints, same conceptual resource ("user activity feed"),
  different controllers, different privacy rules (F-13). A reader of
  the API cannot easily tell whether one is a superset of the other.
- The user module's name is `listUserActivity` even though it is
  scoped to the me-self case (the method only accepts
  `@CurrentUser('sub') userId`).

**Recommendation**:
- Rename `listUserActivity` to `listMyActivity` for symmetry with
  `listMyBadges`, `listMyTournaments`, `listMyTournamentHistory`.
- Consider merging the two endpoints behind a shared implementation
  once F-13 is addressed.

**Reasoning**: Naming consistency. The codebase uses `My` suffix for
self-scoped read endpoints.

**Breaking change risk**: Low (only the controller method name).

---

### F-30 · `UserMeRow.xpTotal` is sourced via `COALESCE` in `findMeById` but the response DTO does not document that 0 is a valid value for a brand-new user with no `user_ranking` row

**Category**: Developer Experience / Swagger
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/dto/response/user-me.dto.ts:41-42`

**Current behavior**:
- `xpTotal!: number;` documented as
  "Total experience points earned", `example: 15420`.

**Problem**:
- No note that 0 is expected for a new user (and that the value is
  coalesced from `user_ranking.allTimeXp`, not from `users.*`).
  Developers debugging "why is xpTotal 0" will not be guided by the
  schema.

**Recommendation**:
- Add a brief description:
  > Total experience points earned (0 for users with no ranking row).

**Reasoning**: Developer experience.

**Breaking change risk**: None.

---

### F-31 · “Public” comment header on `:userId` routes is misleading and obscures a cross-module `@Public()` vs `@ApiAuth()` inconsistency

**Category**: Cross-Module Consistency / Developer Experience
**Severity**: Low (Improvement)
**Location**:
- `src/modules/user/transport/controller/user.controller.ts:220-221`
- `src/modules/social/transport/controller/social.controller.ts:200-243`
- `src/modules/comment/transport/controller/user-comment.controller.ts` (`@Public()` annotation pattern)
- `src/modules/review/transport/controller/user-review.controller.ts` (`@Public()` annotation pattern)

**Current behavior**:
- `user.controller.ts:220` comments the section: `// ─── Public :userId routes (registered last to avoid shadowing /me/* routes) ──` and immediately notes `Global JwtGuard enforces authentication`.
- Every route below this comment uses `@ApiAuth()` (lines 223-319), not `@Public()`.
- In contrast, the social module uses `@Public()` on `GET /social/users/:userId/activity` and `GET /social/users/:userId/stats`. The comment and review modules similarly mark comparable read-by-`userId` routes as `@Public()`.
- The user module's `:userId` routes *are* intentionally authenticated (every owner has a privacy toggle via `assertProfileVisible`), which is correct — but the section comment frames them as “Public”, which contradicts the runtime contract and other modules' convention.

**Problem**:
- A reader scanning the controller sees the “Public :userId routes” header and reasonably expects public (unauthenticated) access, like the social/comment/review modules. The actual contract is "requires authentication, then privacy-gated"; this is encoded only in the per-route `@ApiAuth()` and the `assertProfileVisible` call.
- Cross-module consistency: every other module that exposes a "view another user" route uses `@Public()` to communicate the access contract at the route level. The user module's pattern (auth-required + privacy filter) is *intentional* and *correct*, but it is not visually distinguished from the other modules' patterns.
- The cross-cutting consequence: a contributor migrating a route from the user module to the social module (or vice versa) would carry over the wrong annotation by copying the visible pattern.

**Recommendation**:
- Rename the section header:
  ```ts
  // ─── Authenticated, privacy-gated :userId routes (registered AFTER
  //   /me/* to ensure literal `me` matches the /me/* handlers —
  //   see assertProfileVisible in UserDomainService for the privacy flow).
  ```
- Optionally add a short JSDoc above each `:userId` handler clarifying:
  > “Requires authentication. Returns 403 if the target profile is
  > private (or if the requester is blocked by the target). See
  > `assertProfileVisible`.”
- Leave the actual auth requirement in place — removing `@ApiAuth()` and adding `@Public()` would expose privacy-gated data to unauthenticated callers.

**Reasoning**: The behaviour is correct (it just needs to be obvious in the code), and the comment misleads cross-module readers. Pure documentation fix.

**Breaking change risk**: None.

---

## 5. Findings explicitly considered and rejected

These were inspected during the audit but determined not to warrant
changes:

- **`PATCH /users/me/settings` is described as "Replaces the
  authenticated user's preference object" (whole-object replace
  semantics)**. This is appropriate for a generic JSONB blob. The
  audit considered whether it should be a partial-merge DTO but
  rejected the change because the `users.settings` schema has no
  documented field semantics — the contract is "blob, you replace
  it whole". Document the choice rather than fix it.
- **`GET /users/:userId/badges` returns 200 for self-requests but
  requires 403 for non-self private profiles.** This is the intended
  behaviour (`assertProfileVisible` distinguishes self vs other).
  No change.
- **`user_module.ts` exports `StreakService` even though
  `RankingXpStreakListenerAdapter` is the only consumer.** Removing
  the export would lock the listener into the user module (which is
  fine) but the export matches the project's `Module` convention of
  exposing every internal provider. Leave as-is.
- **`MyTournamentsResponseDto.pagination.nextCursor` example includes
  the literal UUID `660e8400-e29b-71d4-a716-446655440000`, which is
  not a UUIDv7 (it's UUIDv4-style).** This is purely an example
  string in the Swagger doc — `cursor.util.ts`'s decoder would
  reject it (since the version nibble is `4`, matching `[1-5]`).
  Acceptable as documentation. If F-3 is fixed (broadened to all
  version nibbles), the example would become parseable, which is
  arguably better.

---

## 6. Summary

| Severity | Count | Notable |
| --- | --- | --- |
| Critical | 3 | F-1 (IDOR), F-2 (PATCH data loss), F-3 (broken cursor pagination) |
| High | 5 | F-4 (self-skip privacy hole), F-5 (broken streak service), F-6 (settings mismatch), F-7 (privacy flags unenforced), F-8 (duplicate DI) |
| Medium | 9 | F-9 … F-17 |
| Low / Improvement | 14 | F-18 … F-31 |

The three Critical findings should be the priority for the next
release: the IDOR (F-1), the PATCH data loss (F-2), and the broken
cursor pagination (F-3) all surface as 4xx/5xx-level defects that
affect core flows. F-5 is also a candidate for the same release
because the broken `StreakService` is the source of incorrect
achievement grants.

F-6 and F-7 are related (privacy settings mismatch) and can be
addressed together in a follow-up privacy refactor.

F-8 is a one-line change (switch `useClass` to `useExisting` in
`user.module.ts:34`).

---

## 7. Implementation Plan (Phases)

The 31 findings are grouped into **8 phases** ordered to minimise
cross-PR blast radius. Each phase can ship as a separate PR. No
phase requires architectural redesign — every change is a localised
tightening.

### Phase overview

| Phase | Theme                                                          | Findings                                  | Risk                                  |
| ----- | -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| 1     | Critical correctness hot-fixes (security, data loss, pagination) | F-1, F-2, F-3                             | High (data + security)                |
| 2     | Streak service completion + repository DI + event payload       | F-5, F-8, F-9                             | Medium (data integrity)               |
| 3     | Privacy refactor (user + social modules)                       | F-4, F-6, F-7, F-12, F-13                 | Medium–High (behavioural)             |
| 4     | Cross-module privacy/scope + endpoint naming consistency        | F-10, F-29                                | Low–Medium (clarifies contract)       |
| 5     | Swagger / OpenAPI accuracy                                     | F-11, F-28, F-30                          | None (documentation only)             |
| 6     | Repository correctness (stale ts, trim, write-on-read, metadata)| F-15, F-16, F-19, F-27                    | Low–Medium                            |
| 7     | Dead code, schema, JSONB validation, cursor input validation   | F-14, F-17, F-18, F-23, F-26              | Low                                   |
| 8     | DX, naming, presenter polish, controller comment                | F-20, F-21, F-22, F-24, F-25, F-31        | None                                  |

### Finding → Phase index

| Finding | Phase |
| ------- | ----- |
| F-1  | 1 |
| F-2  | 1 |
| F-3  | 1 |
| F-4  | 3 |
| F-5  | 2 |
| F-6  | 3 |
| F-7  | 3 |
| F-8  | 2 |
| F-9  | 2 |
| F-10 | 4 |
| F-11 | 5 |
| F-12 | 3 |
| F-13 | 3 |
| F-14 | 7 |
| F-15 | 6 |
| F-16 | 6 |
| F-17 | 7 |
| F-18 | 7 |
| F-19 | 6 |
| F-20 | 8 |
| F-21 | 8 |
| F-22 | 8 |
| F-23 | 7 |
| F-24 | 8 |
| F-25 | 8 |
| F-26 | 7 |
| F-27 | 6 |
| F-28 | 5 |
| F-29 | 4 |
| F-30 | 5 |
| F-31 | 8 |

---

### Phase 1 — Critical correctness hot-fixes

**Findings:** F-1 (IDOR), F-2 (PATCH data loss), F-3 (broken cursor pagination)
**Risk:** High — patches correctness of security, persistence, and list-pagination flows. Must ship before the next public release.

**Why this phase first:** every other phase depends on the underlying data and contracts being correct (e.g., a refactor of `UserRepository.updateProfile` would be wasted if F-2 is still nulling fields).

#### F-1 — Lock down `GET /users/:userId/quizzes/analytics` (IDOR)

In `UserDomainService.getUserQuizAnalytics` (`src/modules/user/domain/user.service.ts:280-286`), gate the call with `assertProfileVisible(userId, requesterId)` **and** require `requesterId === userId` OR an explicit `quiz:read-analytics` permission. Currently any authenticated user can fetch the creator analytics of any other user.

- Add a new domain check, e.g. `assertCanReadCreatorAnalytics(requesterId, targetUserId)`, that throws `UserAnalyticsNotFoundError` (404) for cross-user reads.
- Update `UserController.getUserQuizAnalytics` (`user.controller.ts:280-290`) to pass the authenticated `userId` as the requester.
- Document the resulting 404 in the Swagger decorator (`user-swagger-decorators.ts`).

**Verification:**
- Add an integration test: `GET /users/{otherUserId}/quizzes/analytics` as user A returns 404 (not 200).
- Confirm `GET /users/me/quizzes/analytics` continues to return 200.

#### F-2 — `PATCH /users/me` must not null omitted fields

`UserRepository.updateProfile` (`src/modules/user/infrastructure/repositories/user.repository.ts:498-521`) uses `patch.field ?? null` for every field, which silently overwrites omitted fields with `NULL`. Replace the upsert with a partial update that distinguishes "field absent" from "field set to null":

```ts
// Sketch (NOT a copy-paste fix — confirm against the DTO contract)
const set: Record<string, unknown> = { updatedAt: nowIso };
if ('displayName' in patch) set.displayName = patch.displayName;
if ('avatarUrl' in patch) set.avatarUrl = patch.avatarUrl;
if ('bio' in patch) set.bio = patch.bio;
```

If the `userProfiles` row does not exist, do the insert separately, then issue the partial update. Do not use `onConflictDoUpdate` for the update path unless the insert is guaranteed.

**Verification:**
- Send `{ "bio": "new bio" }` and confirm `displayName` / `avatarUrl` are unchanged.
- Send `{ "displayName": null }` and confirm the stored value is `null` (explicit clear).
- Send `{}` and confirm `updatedAt` is also unchanged (or document that it always moves).

#### F-3 — Cursor UUID regex must accept UUIDv7

The cursor mappers `user-activity-cursor.mapper.ts`, `user-badge-cursor.mapper.ts`, `my-tournament-cursor.mapper.ts`, `my-tournament-history-cursor.mapper.ts` all reject UUID versions `1-5` while the application generates `uuidv7()` values. This makes every cursor-backed list endpoint return 500 (the mapper throws a native `Error`, which `global-exception.filter.ts` does not translate to a 4xx).

- Update the regex to accept any valid UUID version (drop the version sub-pattern, or accept `0-9a-f` for the version nibble). Canonical: `UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`
- Add a shared `UUID_V7_PATTERN` for endpoints that genuinely want to constrain to v7 (e.g., `:userId` path validation already uses `ParseUUIDPipe({ version: '7' })`).
- Convert mapper `throw new Error(...)` to `throw new BadRequestException(...)` so the global filter renders it as RFC7807 with status `400`.

**Verification:**
- Curl a paginated list endpoint and confirm the second page loads.
- Send a syntactically valid base64 cursor containing `{"id": "00000000-0000-0000-0000-000000000000"}` (nil UUID) and confirm 400.

---

### Phase 2 — Streak service completion + repository DI + event payload

**Findings:** F-5, F-8, F-9
**Risk:** Medium — completes an unfinished service, dedupes a DI registration, and tightens the event contract. All changes are localised.

**Why this phase second:** the streak data path is read by every "social" view of the user and powers achievement grants. Fixing it before Phase 3 (privacy) ensures the streak values surfaced to other users are accurate.

#### F-5 — Complete `StreakService.recalculateStreak`

The current implementation (`src/modules/user/domain/services/streak.service.ts:36-90`) emits `user.streak_updated` events but never persists the new `current_streak`, `longest_streak`, or `last_streak_day` values. A working `updateStreakCache` already exists on the repository port (`src/modules/user/domain/ports/user-repository.port.ts:152-170`, implemented at `user.repository.ts:639-721`).

- Wire `StreakService.recalculateStreak` to:
  1. Read the existing streak state via a new port method `getStreakCache(userId)` (or extend `findMeById`).
  2. Compute the new state from the `attemptTimestamp` using real inputs (drop the `lastAttemptDate = null` / `previousStreak = 0` hard-codes).
  3. Call `userRepository.updateStreakCache(userId, { currentStreak, longestStreak, lastStreakDay }, now)` inside a transaction.
  4. Only after the transaction commits, emit `user.streak_updated`.
- Remove the parallel atomic SQL update in `AttemptRepository.updateStreakCache` (`src/modules/attempt/infrastructure/repositories/attempt.repository.ts`) and route it through the same `userRepository.updateStreakCache` to avoid two writers.

**Verification:**
- Run a quiz attempt, then `GET /users/me` and confirm `currentStreak` increments.
- Run two attempts on consecutive UTC days and confirm `longestStreak` updates when `currentStreak` exceeds it.
- Skip a day and confirm the streak resets to 1 (not 0).

#### F-8 — Drop the duplicate `UserRepository` provider in `UserModule`

`DatabaseModule` already provides `UserRepository` globally; `UserModule` registers a second instance via `useClass: UserRepository` (`src/modules/user/user.module.ts:34`). Replace with `useExisting: UserRepository` so all consumers share one instance.

#### F-9 — Make `user.streak_updated` payload a class

`StreakService.recalculateStreak` (`src/modules/user/domain/services/streak.service.ts:80-87`) emits `new UserStreakUpdatedEvent(userId, newStreak, longestStreak, lastStreakDay)` but constructs it via a plain object literal. Define a proper event class in `src/modules/user/domain/events/` (matching the `user.profile_updated` event style) and instantiate it via `new`. Update the `UserDomainEventBus` payload type from `unknown` to the concrete event type.

**Verification:**
- After fixing F-5, run the achievement grant listener and confirm it receives a typed payload.
- Run the existing streak integration tests; they should pass unchanged.

---

### Phase 3 — Privacy refactor (user + social modules)

**Findings:** F-4, F-6, F-7, F-12, F-13
**Risk:** Medium–High — touches the privacy contract that other modules rely on. Coordinate with the social module and document behaviour changes in the OpenAPI description.

**Why this phase third:** every public-facing endpoint that exposes another user's data needs to read and honour `user_profile_settings`. Until the privacy flags are wired in, the privacy refactor in this phase is incomplete.

#### F-4 — `assertProfileVisible` must not skip existence for self

`UserDomainService.assertProfileVisible` (`src/modules/user/domain/user.service.ts:65-88`) short-circuits to `return` when `targetUserId === requesterId`. A soft-deleted user's JWT therefore reaches `getUserRanking` / `getUserAnalytics` and triggers a 500. Always call `assertUserExists(targetUserId)` first; only skip the privacy check after the existence check passes.

#### F-6 — Settings DTO writes the right column

`UpdateMeSettingsDto` (`src/modules/user/dto/request/update-me-settings.dto.ts`) currently mutates `users.settings`. Move the persistence to `user_profile_settings` (which carries the privacy flags). Either:

- Treat the privacy flags as the only writable fields and ignore everything else (simplest, but loses user preferences), **or**
- Keep `users.settings` for free-form preferences AND migrate the privacy flags to `user_profile_settings` (this is the version implied by F-7).

Recommendation: the second option. Update the DTO to split into `privacy` and `preferences` sub-objects, persist each to its own table.

#### F-7 — Enforce granular privacy flags

Once the privacy flags live in `user_profile_settings` (F-6), `assertProfileVisible` must consult them:

| Flag                     | Endpoint                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `showStatistics`         | `GET /users/:userId/ranking`, `GET /users/:userId/analytics`             |
| `showAchievements`       | `GET /users/:userId/badges`, `GET /users/:userId/badges`                 |
| `showActivity`           | `GET /users/:userId/activity` (user module)                              |
| `showTournamentActivity` | `GET /users/:userId/tournaments`, `GET /users/:userId/tournament-history` |

Add a new repository method `getProfilePrivacySettings(userId): Promise<PrivacySettings | null>` and call it from `assertProfileVisible`. Throw `UserProfilePrivateError` if the flag is `false` and the requester is not the owner.

#### F-12 — `getMyTournaments` must respect `requesterId`

`UserApplicationService.getMyTournaments` (`src/modules/user/application/user.application.service.ts:111-145`) collapses `targetUserId === requesterId`, bypassing the privacy check that exists for `:userId` reads. The controller (`user.controller.ts:148-160`) passes the same value for both. Either:

- Pass the authenticated `userId` as `requesterId` and `userId` for `/me/tournaments`, or
- Use a separate code path for `/me` that skips the privacy check entirely (current intent).

Document the chosen approach in `user.application.service.ts` with a one-line comment.

#### F-13 — Social module must consult `showActivity`

`SocialController.getUserActivity` (`src/modules/social/transport/controller/social.controller.ts:200-243`) does not consult `user_profile_settings.showActivity`. After F-6/F-7 land, add the privacy check in the social module (either import the user module's `assertProfileVisible` or expose a small `UserPrivacyPort`).

**Verification (full phase):**
- As user B with `showActivity: false`, `GET /users/{B}/activity` returns 403.
- As user A with `showStatistics: false`, `GET /users/{A}/ranking` returns 403.
- As the owner, all reads continue to return 200.
- After soft-deleting user A, `GET /users/me/ranking` returns 404 (not 500).

---

### Phase 4 — Cross-module privacy/scope + endpoint naming consistency

**Findings:** F-10, F-29
**Risk:** Low–Medium — clarifies the contract between modules without changing data flow.

#### F-10 — Distinct response DTOs for `/me/tournament-history` vs `:userId/tournament-history`

Currently both endpoints share `MyTournamentHistoryResponseDto` and the same Swagger decorator. Split the public-history endpoint into a new `PublicTournamentHistoryResponseDto` that omits internal fields and documents the privacy-gating behaviour. Add a method-level `@ApiOperation` description that mentions the privacy gate.

#### F-29 — Rename `listUserActivity` to `listMyActivity`

`UserController.listUserActivity` (`user.controller.ts:78-90`) is mounted on `/users/me/activity` but the method name suggests cross-user activity. Rename to `listMyActivity` to match the path. Update the Swagger `summary` / `description` accordingly.

---

### Phase 5 — Swagger / OpenAPI accuracy

**Findings:** F-11, F-28, F-30
**Risk:** None — documentation only.

#### F-11 — `ApiOkResourceList` must reference item DTOs, not wrapper DTOs

In `src/modules/user/transport/swagger/user-swagger-decorators.ts`:

- `ApiMyTournamentsResponse` (line 146) → pass the item DTO, not `MyTournamentsResponseDto`.
- `ApiMyTournamentHistoryResponse` (line 176) → pass the item DTO.
- `ApiPublicTournamentHistoryResponse` (line 180) → pass the item DTO.
- `ApiUserQuizListResponse` (line ~190) → pass the item DTO, not `QuizListResponseDto`.

Mirror the existing badges/activity pattern (lines 108-127).

#### F-28 — Nullable fields need explicit `nullable: true`

`UserMeResponseDto` (`src/modules/user/dto/response/user-me.dto.ts`) decorates `displayName`, `avatarUrl`, `bio` with `type: String` but the field type is `string | null`. Add `nullable: true` to the `@ApiProperty` options to make the schema accurate.

#### F-30 — Document `xpTotal = 0` semantics

Add a Swagger `@ApiProperty` description on `xpTotal` explaining that 0 means the user has no `user_ranking` row yet (brand-new user), and that the value is initialised on the first read of `GET /users/me/ranking` (see F-19).

**Verification (full phase):** re-generate the OpenAPI spec and confirm:
- `data` arrays for paginated lists show item DTOs (no wrapper fields like `pagination`).
- `displayName`, `avatarUrl`, `bio` declare `nullable: true`.
- `xpTotal` description explains the 0 default.

---

### Phase 6 — Repository correctness

**Findings:** F-15, F-16, F-19, F-27
**Risk:** Low–Medium — affects the freshness and semantics of the data returned to clients.

#### F-15 — `PATCH /users/me` must update `users.updatedAt`

`UserRepository.updateProfile` (`src/modules/user/infrastructure/repositories/user.repository.ts:498-521`) updates `userProfiles.updatedAt` but not `users.updatedAt`. The `UserMeResponseDto.updatedAt` field reads from `users.updatedAt`, so the timestamp is stale after a profile PATCH.

- After the partial update in Phase 1, also bump `users.updatedAt` in the same transaction (single `update(users).set({ updatedAt: nowIso }).where(eq(users.id, userId))`).
- Apply the same fix in `updateSettings` if the response should reflect settings changes.

#### F-16 — Trim `bio` and re-check length

`UserRepository.updateProfile` strips whitespace from `bio` but does not re-validate the trimmed length against the `user_profiles_display_name_len` / analogous `bio_len` DB constraint. After trimming, re-run the DTO validation (`@MaxLength(N)`) and reject with `400` if the trimmed value exceeds the limit.

#### F-19 — Document (or move) the write-on-read side effect

`UserDomainService.getUserRanking` (`src/modules/user/domain/user.service.ts:126-149`) creates a `user_ranking` row if it does not exist. This is documented in Swagger but not in the code. Two acceptable resolutions:

- **Document**: add a JSDoc comment on `getUserRanking` explaining the side effect and that the row is created on the first call.
- **Move**: convert the lazy creation into a startup migration that back-fills `user_ranking` for every existing user, then drop the write from `getUserRanking`.

Recommendation: document for now; revisit during the privacy refactor (Phase 3) or a dedicated ranking cleanup PR.

#### F-27 — Surface metadata schema violations instead of silently swallowing

`UserApplicationService.toUserActivityItem` (`src/modules/user/application/user.application.service.ts:228-244`) falls back to `{}` when `isObjectRecord(item.metadata)` returns false. Two acceptable resolutions:

- **Log + return `null`** for the metadata field and add a debug log.
- **Throw** during the mapping stage so corrupted rows surface in CI / monitoring.

Recommendation: log and continue. The activity timeline is best-effort.

**Verification (full phase):**
- After `PATCH /users/me`, `GET /users/me` shows a fresh `updatedAt`.
- Submitting a 1001-character `bio` returns 400 (matches the DB constraint).
- The first call to `GET /users/me/ranking` for a brand-new user returns `xpTotal: 0` and creates a row in `user_ranking` (verified by subsequent reads being consistent).

---

### Phase 7 — Dead code, schema, JSONB validation, cursor input validation

**Findings:** F-14, F-17, F-18, F-23, F-26
**Risk:** Low — mostly cleanup and tightening of inputs.

#### F-14 — Bound the `users.settings` JSONB

`UpdateMeSettingsDto` allows arbitrary JSONB with up to 50 top-level keys and 200-character key names (`src/modules/user/dto/request/update-me-settings.dto.ts:16-29`). After Phase 3 splits the DTO into `privacy` + `preferences`, the `preferences` blob should:

- Cap value depth at 3 (reject nested objects beyond depth 3).
- Cap string values at 1000 characters.
- Reject binary blobs (no `Buffer`).

This is best done with a custom validator (e.g., `@IsShallowPreferencesBlob()`).

#### F-17 — Remove or expose the dead schema columns

`userProfiles.tagline` and `userProfiles.pinnedBadgeIds` (`src/core/database/schema/user/schema.ts`) are defined but not exposed by any DTO. Two acceptable resolutions:

- **Remove** the columns and run a migration.
- **Expose** them via `PATCH /users/me` (with appropriate privacy implications for `pinnedBadgeIds`).

Recommendation: remove unless there is a roadmap item that consumes them within the next release.

#### F-18 — Delete unused error classes

`UserRankingNotFoundError` and `UserAnalyticsNotFoundError` (`src/modules/user/domain/errors/user-domain.errors.ts`) are exported and mapped but never thrown. Remove them from the file and from `problem-code-mapping.ts`.

#### F-23 — DTOs must validate `cursor` shape

`GetMyTournamentsQueryDto.cursor` and `GetMyTournamentHistoryQueryDto.cursor` (`src/modules/user/dto/request/get-my-tournaments-query.dto.ts`, `get-my-tournament-history-query.dto.ts`) accept any string. Add `@Matches(/^[A-Za-z0-9+/=]+$/)` (base64 alphabet) and rely on the mapper for the JSON-shape check (already covered by F-3's `BadRequestException` fix).

#### F-26 — Drop the duplicate UUID regex in `user-activity-cursor.mapper.ts`

`isUuid` in `user-activity-cursor.mapper.ts:12-22` carries the same `[1-5]` version-restriction bug as F-3. After F-3 fixes the shared regex, remove the local helper and import the shared one.

**Verification (full phase):**
- Lint + build clean.
- Existing user module tests pass.
- `rg "UserRankingNotFoundError|UserAnalyticsNotFoundError"` returns no results.

---

### Phase 8 — DX, naming, presenter polish, controller comment

**Findings:** F-20, F-21, F-22, F-24, F-25, F-31
**Risk:** None — quality-of-life improvements.

#### F-20 — Unify pagination `limit` defaults

Pick a single default (the audit recommends `20`) and apply it across `listUserBadges`, `listUserActivity`, `getMyTournaments`, `getMyTournamentHistory`. Update each DTO and the corresponding `@ApiProperty` description.

#### F-21 — Make `apiOk` module-level for consistency

`UserPresenter.apiOk` (`src/modules/user/transport/presenters/user.presenter.ts`) is a private static method while `wrapPaginatedDto` is a module-level function. Either expose both at the module level or make both private static. Recommendation: keep both module-level to match the bookmark / social presenters.

#### F-22 — Surface typed `data` shape

`UserPresenter.ok` (`src/modules/user/transport/presenters/user.presenter.ts`) is typed as `<T>` but the underlying call does not enforce per-endpoint invariants. Replace with per-endpoint factory functions:

```ts
static me = (data: UserMeResponseDto): ApiResponseEnvelope<UserMeResponseDto> => this.ok(data);
static ranking = (data: UserRankingResponseDto): ApiResponseEnvelope<UserRankingResponseDto> => this.ok(data);
// ...
```

This is purely a typing convenience; no runtime change.

#### F-24 — Extract a shared `toPaginated` helper

`UserApplicationService.toUserBadgesResponse`, `listUserBadges`, `listUserActivity`, `getMyTournaments`, `getMyTournamentHistory` (`src/modules/user/application/user.application.service.ts:228-244` and surrounding) duplicate the cursor-serialisation logic. Extract a single helper:

```ts
private toPaginated<T>(
  items: readonly T[],
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null },
): ApiResponseEnvelope<T[]>;
```

#### F-25 — Fix the misleading controller comment

`UserController` (`src/modules/user/transport/controller/user.controller.ts:220-225`) says `:userId` is "registered last to avoid shadowing /me/* routes". NestJS matches routes in registration order, but the literal `me` would be captured by `:userId` regardless. Rewrite the comment to reflect the actual order (auth/privacy gating), not the (non-existent) shadowing concern.

#### F-31 — Rename the misleading "Public" header

The same section header is labelled "Public :userId routes" but every route under it is `@ApiAuth()` (see F-29/F-10 from the privacy refactor). After F-29 lands, also rename the header to `"Authenticated, privacy-gated :userId routes"` and link to `assertProfileVisible` in the comment.

**Verification (full phase):**
- All user module tests pass.
- TypeScript build is clean (`tsc --noEmit`).
- No new ESLint warnings.

---

### Recommended PR sequencing

1. **PR #1 — Phase 1** (F-1, F-2, F-3). Land immediately. ~2-4 hours of careful work + integration tests. Highest blast radius.
2. **PR #2 — Phase 5** (F-11, F-28, F-30). Land immediately after PR #1. Documentation only, no behaviour change. ~30 minutes.
3. **PR #3 — Phase 7** (F-14, F-17, F-18, F-23, F-26). Land immediately. Dead code + input tightening. ~1-2 hours.
4. **PR #4 — Phase 2** (F-5, F-8, F-9). Land as soon as F-5 has integration tests. ~3-5 hours.
5. **PR #5 — Phase 6** (F-15, F-16, F-19, F-27). Land after PR #4. ~2-3 hours.
6. **PR #6 — Phase 3** (F-4, F-6, F-7, F-12, F-13). Land after the social module is ready to consume the new privacy API. ~1-2 days. Coordinate with social module.
7. **PR #7 — Phase 4** (F-10, F-29). Land with PR #6 or shortly after. ~30 minutes.
8. **PR #8 — Phase 8** (F-20, F-21, F-22, F-24, F-25, F-31). Land last. ~1-2 hours. Pure polish.

Total estimated effort: ~5-7 working days for one engineer, excluding the privacy refactor (Phase 3) which should be coordinated with the social module owner.