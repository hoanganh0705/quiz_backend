import type { UserRole } from '@/common/types/user-role.type';

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

  // Moderation
  DISCUSSION_MODERATE = 'DISCUSSION_MODERATE',
  REVIEW_MODERATE = 'REVIEW_MODERATE',

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

    // Moderation
    Permission.DISCUSSION_MODERATE,
    Permission.REVIEW_MODERATE,

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
    Permission.DISCUSSION_MODERATE,
    Permission.REVIEW_MODERATE,
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
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
};
