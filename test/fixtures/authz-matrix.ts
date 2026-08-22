/**
 * Authorization matrix for the Quiz backend.
 *
 * Phase 4 #1 of the resilience roadmap (see `BACKEND_AUDIT_REPORT.md`
 * §23 Phase 4).
 *
 * Encodes the expected allow/deny outcome for every authz-sensitive
 * (role, resource, action) triple the API exposes. The matrix is a
 * `const` literal so it can be:
 *
 *   - imported by the authz test harness (`test/authz.e2e-spec.ts`),
 *     which loops the matrix and asserts each combination produces
 *     the expected HTTP status.
 *   - cross-checked against the per-controller `@Roles` /
 *     `@RequirePermissions` decorators in a future lint pass.
 *   - diffed in code review — adding a row to the matrix is the
 *     hard part; forgetting to update the decorators is the easy
 *     silent failure.
 *
 * Roles
 * -----
 *   - `public` — no authentication required (anonymous caller).
 *   - `user`   — any authenticated caller.
 *   - `owner`  — the authenticated caller is the resource's owner.
 *   - `admin`  — platform administrator.
 *
 * Notes
 * -----
 * - The HTTP status here is the *documented* outcome. A future
 *   IDOR regression in any controller (e.g. a missing
 *   `userOwnsAssetForPurpose` check on `imagePublicId`) will surface
 *   as a matrix assertion failure during `pnpm test:e2e`.
 * - `403` is "authenticated but forbidden"; `401` is "no/invalid
 *   auth". The matrix separates them deliberately so the test
 *   catches "I forgot the `@Public` decorator" as well as "I
 *   forgot the `@Roles` decorator".
 * - Resource identifiers in the URL (e.g. `/users/:userId`) are
 *   treated as `owner` (the URL ID == the caller's user id) vs.
 *   `other` (someone else's ID). The authz test distinguishes by
 *   issuing two requests, one with the caller's own ID and one
 *   with a foreign ID.
 */

export type Role = 'public' | 'user' | 'owner' | 'admin';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type AuthzResource =
  | 'quiz'
  | 'quiz.list'
  | 'quiz.stats'
  | 'attempt'
  | 'instance'
  | 'comment'
  | 'review'
  | 'user.me'
  | 'user.other'
  | 'user.profile-bundle'
  | 'upload'
  | 'auth.session'
  | 'auth.registration'
  | 'admin.audit'
  | 'admin.metrics'
  | 'health'
  | 'metrics';

export type AuthzAction = 'read' | 'create' | 'update' | 'delete';

export type AuthzExpectation = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly resource: AuthzResource;
  readonly action: AuthzAction;
  readonly allow: ReadonlyArray<Role>;
  /** HTTP status code the endpoint must return for the allow row. */
  readonly successStatus: number;
};

/**
 * The matrix itself. Keep rows in the same order as the controllers
 * appear in `src/modules/`, so reviewers can scan top-to-bottom.
 */
export const AUTHZ_MATRIX: ReadonlyArray<AuthzExpectation> = [
  // ─── Quiz module ──────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/quizzes',
    resource: 'quiz.list',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/quizzes/:quizId',
    resource: 'quiz',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/quizzes',
    resource: 'quiz',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },
  {
    method: 'PATCH',
    path: '/quizzes/:quizId',
    resource: 'quiz',
    action: 'update',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },
  {
    method: 'DELETE',
    path: '/quizzes/:quizId',
    resource: 'quiz',
    action: 'delete',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/quizzes/:quizId/stats',
    resource: 'quiz.stats',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },

  // ─── Attempt module ───────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/attempts',
    resource: 'attempt',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },
  {
    method: 'GET',
    path: '/attempts/:attemptId',
    resource: 'attempt',
    action: 'read',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },

  // ─── Instance module ──────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/instances',
    resource: 'instance',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },
  {
    method: 'POST',
    path: '/instances/:instanceId/join',
    resource: 'instance',
    action: 'update',
    allow: ['user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/instances/:instanceId/leaderboard',
    resource: 'instance',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },

  // ─── Comment module ───────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/comments',
    resource: 'comment',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },
  {
    method: 'DELETE',
    path: '/comments/:commentId',
    resource: 'comment',
    action: 'delete',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },

  // ─── Review module ────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/reviews',
    resource: 'review',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },
  {
    method: 'PATCH',
    path: '/reviews/:reviewId',
    resource: 'review',
    action: 'update',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },
  {
    method: 'DELETE',
    path: '/reviews/:reviewId',
    resource: 'review',
    action: 'delete',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },

  // ─── User module ──────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/users/me',
    resource: 'user.me',
    action: 'read',
    allow: ['user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'PATCH',
    path: '/users/me',
    resource: 'user.me',
    action: 'update',
    allow: ['user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/users/me/profile-bundle',
    resource: 'user.profile-bundle',
    action: 'read',
    allow: ['user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/users/:userId',
    resource: 'user.other',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'PATCH',
    path: '/users/:userId',
    resource: 'user.other',
    action: 'update',
    allow: ['owner', 'admin'],
    successStatus: 200,
  },

  // ─── Upload module ────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/uploads',
    resource: 'upload',
    action: 'create',
    allow: ['user', 'admin'],
    successStatus: 201,
  },

  // ─── Auth module ──────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/auth/register',
    resource: 'auth.registration',
    action: 'create',
    allow: ['public'],
    successStatus: 201,
  },
  {
    method: 'POST',
    path: '/auth/login',
    resource: 'auth.session',
    action: 'create',
    allow: ['public'],
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    resource: 'auth.session',
    action: 'create',
    allow: ['public'],
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/auth/logout',
    resource: 'auth.session',
    action: 'delete',
    allow: ['user', 'admin'],
    successStatus: 200,
  },

  // ─── Admin module ─────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/admin/audit/search',
    resource: 'admin.audit',
    action: 'read',
    allow: ['admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/admin/metrics',
    resource: 'admin.metrics',
    action: 'read',
    allow: ['admin'],
    successStatus: 200,
  },

  // ─── Health / metrics ─────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/health',
    resource: 'health',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/metrics',
    resource: 'metrics',
    action: 'read',
    allow: ['public', 'user', 'admin'],
    successStatus: 200,
  },
];

/**
 * The exhaustive set of statuses the authz test must assert. Note
 * that 401 ("no/invalid auth") and 403 ("authenticated but forbidden")
 * are *both* needed: a missing `@Public()` decorator produces 401,
 * a missing `@Roles()` produces 403, and the test suite must catch
 * each independently.
 */
export const DENY_PUBLIC_STATUS = 401;
export const DENY_FORBIDDEN_STATUS = 403;
