import type { UserRole } from '@/common/types/user-role.type';

export type { UserRole };

export enum Permission {
  // Quiz
  QUIZ_CREATE = 'QUIZ_CREATE',
  QUIZ_VERIFY = 'QUIZ_VERIFY',
  QUIZ_EDIT_OWN = 'QUIZ_EDIT_OWN',
  QUIZ_EDIT_ANY = 'QUIZ_EDIT_ANY',
  QUIZ_DELETE_OWN = 'QUIZ_DELETE_OWN',
  QUIZ_DELETE_ANY = 'QUIZ_DELETE_ANY',

  // Quiz version
  QUIZ_VERSION_CREATE_OWN = 'QUIZ_VERSION_CREATE_OWN',
  QUIZ_VERSION_CREATE_ANY = 'QUIZ_VERSION_CREATE_ANY',
  QUIZ_VERSION_VIEW_OWN = 'QUIZ_VERSION_VIEW_OWN',
  QUIZ_VERSION_VIEW_ANY = 'QUIZ_VERSION_VIEW_ANY',
  QUIZ_VERSION_EDIT_OWN = 'QUIZ_VERSION_EDIT_OWN',
  QUIZ_VERSION_EDIT_ANY = 'QUIZ_VERSION_EDIT_ANY',
  QUIZ_VERSION_PUBLISH_OWN = 'QUIZ_VERSION_PUBLISH_OWN',
  QUIZ_VERSION_PUBLISH_ANY = 'QUIZ_VERSION_PUBLISH_ANY',

  // Tournament
  TOURNAMENT_CREATE = 'TOURNAMENT_CREATE',
  TOURNAMENT_REGISTER = 'TOURNAMENT_REGISTER',
  TOURNAMENT_ATTEMPT = 'TOURNAMENT_ATTEMPT',
  // Phase 1 / Issue #1 — three new permissions to gate the admin
  // endpoints added by Phase 1 (PATCH /:id, DELETE /:id, POST /:id/cancel).
  //
  //   * `TOURNAMENT_EDIT_OWN`  — the caller's `user.sub` matches the
  //                              tournament's `owner_user_id`. Granted
  //                              to every authenticated role that has
  //                              `TOURNAMENT_CREATE`. This avoids the
  //                              need to grant a global "edit" permission
  //                              to every regular user; instead the
  //                              application-layer policy checks
  //                              ownership before allowing the mutation.
  //
  //   * `TOURNAMENT_EDIT_ANY`  — bypass the ownership check. Granted
  //                              only to `admin` (Phase 1 does not give
  //                              moderators tournament-moderation power;
  //                              that is a future audit item).
  //
  //   * `TOURNAMENT_CANCEL`    — gate the `POST /:id/cancel` endpoint,
  //                              which transitions a tournament to the
  //                              `cancelled` status. Granted to `admin`
  //                              only — cancelling a tournament affects
  //                              every registered participant, so the
  //                              audit demands admin-only authority.
  //
  // The `OWN` / `ANY` separation mirrors the existing
  // `QUIZ_EDIT_OWN` / `QUIZ_EDIT_ANY` /
  // `QUIZ_DELETE_OWN` / `QUIZ_DELETE_ANY` /
  // `QUIZ_VERSION_EDIT_OWN` / `QUIZ_VERSION_EDIT_ANY` /
  // `QUIZ_VERSION_PUBLISH_OWN` / `QUIZ_VERSION_PUBLISH_ANY` shape, so
  // the controller decorator pattern in this module can stay aligned
  // with the quiz module's `@Permissions` conventions.
  TOURNAMENT_EDIT_OWN = 'TOURNAMENT_EDIT_OWN',
  TOURNAMENT_EDIT_ANY = 'TOURNAMENT_EDIT_ANY',
  TOURNAMENT_CANCEL = 'TOURNAMENT_CANCEL',

  // Moderation
  COMMENT_MODERATE = 'COMMENT_MODERATE',
  REVIEW_MODERATE = 'REVIEW_MODERATE',

  // Phase 5 / Issue #21 — gate the creator-only review analytics
  // route at the boundary. Mirrors the bookmark pattern: an
  // internal job that calls `quizAnalyticsService.getQuizAnalytics`
  // directly still has to apply the policy itself, but the route
  // is now closed to anyone without the permission.
  REVIEW_VIEW_QUIZ_ANALYTICS = 'REVIEW_VIEW_QUIZ_ANALYTICS',

  // Taxonomy
  TAG_MANAGE = 'TAG_MANAGE',
  CATEGORY_MANAGE = 'CATEGORY_MANAGE',

  // Achievement
  ACHIEVEMENT_REVOKE = 'ACHIEVEMENT_REVOKE',
  ACHIEVEMENT_ADMIN = 'ACHIEVEMENT_ADMIN',

  // Platform ops
  NOTIFICATION_ANALYTICS = 'NOTIFICATION_ANALYTICS',
  RANKING_ADMIN = 'RANKING_ADMIN',
}

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    // Quiz lifecycle
    Permission.QUIZ_CREATE,
    Permission.QUIZ_VERIFY,
    Permission.QUIZ_EDIT_OWN,
    Permission.QUIZ_EDIT_ANY,
    Permission.QUIZ_DELETE_OWN,
    Permission.QUIZ_DELETE_ANY,
    Permission.QUIZ_VERSION_CREATE_OWN,
    Permission.QUIZ_VERSION_CREATE_ANY,
    Permission.QUIZ_VERSION_VIEW_OWN,
    Permission.QUIZ_VERSION_VIEW_ANY,
    Permission.QUIZ_VERSION_EDIT_OWN,
    Permission.QUIZ_VERSION_EDIT_ANY,
    Permission.QUIZ_VERSION_PUBLISH_OWN,
    Permission.QUIZ_VERSION_PUBLISH_ANY,

    // Tournament (player side; admin tournament moderation is not yet modeled)
    Permission.TOURNAMENT_CREATE,
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,
    // Phase 1 / Issue #1 — admins get the bypass permissions so
    // `TOURNAMENT_EDIT_ANY` and `TOURNAMENT_CANCEL` grant real
    // authority. `TOURNAMENT_EDIT_OWN` is also granted to admins so
    // a future audit log that asks "which role owns this tournament?"
    // has the same answer regardless of whether the owner is the
    // admin who created the tournament or a regular user.
    Permission.TOURNAMENT_EDIT_OWN,
    Permission.TOURNAMENT_EDIT_ANY,
    Permission.TOURNAMENT_CANCEL,

    // Moderation
    Permission.COMMENT_MODERATE,
    Permission.REVIEW_MODERATE,

    // Phase 5 / Issue #21 — admins always have analytics access
    // on every quiz, so they get the new permission.
    Permission.REVIEW_VIEW_QUIZ_ANALYTICS,

    // Taxonomy
    Permission.TAG_MANAGE,
    Permission.CATEGORY_MANAGE,

    // Achievement
    Permission.ACHIEVEMENT_REVOKE,
    Permission.ACHIEVEMENT_ADMIN,

    // Platform ops
    Permission.NOTIFICATION_ANALYTICS,
    Permission.RANKING_ADMIN,
  ],
  moderator: [
    // Quiz (moderation-grade)
    Permission.QUIZ_VERSION_VIEW_ANY,
    Permission.QUIZ_VERSION_PUBLISH_ANY,
    Permission.QUIZ_VERIFY,

    // Tournament (player side, same as a regular user)
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,

    // Moderation
    Permission.COMMENT_MODERATE,
    Permission.REVIEW_MODERATE,

    // Phase 5 / Issue #21 — moderators get analytics access so
    // they can investigate review patterns without escalating to
    // an admin. The route still calls the service-layer policy
    // for ownership / moderation checks.
    Permission.REVIEW_VIEW_QUIZ_ANALYTICS,
  ],
  user: [
    Permission.QUIZ_CREATE,
    Permission.QUIZ_EDIT_OWN,
    Permission.QUIZ_DELETE_OWN,
    Permission.QUIZ_VERSION_CREATE_OWN,
    Permission.QUIZ_VERSION_VIEW_OWN,
    Permission.QUIZ_VERSION_EDIT_OWN,
    Permission.QUIZ_VERSION_PUBLISH_OWN,
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,
    // Phase 1 / Issue #1 — a regular user who calls
    // `POST /tournaments` is recorded as the tournament's
    // `owner_user_id`. Granting `TOURNAMENT_EDIT_OWN` here is
    // necessary for that user to reach the new `PATCH /:id` and
    // `DELETE /:id` endpoints for tournaments they own.
    //
    // The application-layer policy (`TournamentAuthorizationPolicy`)
    // compares the caller's `user.sub` against the loaded
    // `tournament.owner_user_id` before allowing the mutation, so
    // this permission alone cannot escalate — the OWN / ANY split
    // is enforced at the service layer, not by the role alone.
    Permission.TOURNAMENT_EDIT_OWN,
    // Phase 5 / Issue #21 — quiz creators are not granted the
    // permission globally; the route's `PermissionsGuard` plus
    // the service-layer `canViewAnalytics` policy check covers
    // them. Adding the permission to the `user` role would let
    // any authenticated user reach the route and only the policy
    // would stop them, which is the inverse of the audit's
    // intent.
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
};
