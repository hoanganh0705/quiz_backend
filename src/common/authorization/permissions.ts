import type { UserRole } from '@/common/types/user-role.type';

export enum Permission {
  QUIZ_CREATE = 'QUIZ_CREATE',
  QUIZ_VERIFY = 'QUIZ_VERIFY',

  QUIZ_VERSION_CREATE_OWN = 'QUIZ_VERSION_CREATE_OWN',
  QUIZ_VERSION_CREATE_ANY = 'QUIZ_VERSION_CREATE_ANY',
  QUIZ_VERSION_VIEW_OWN = 'QUIZ_VERSION_VIEW_OWN',
  QUIZ_VERSION_VIEW_ANY = 'QUIZ_VERSION_VIEW_ANY',
  QUIZ_VERSION_EDIT_OWN = 'QUIZ_VERSION_EDIT_OWN',
  QUIZ_VERSION_EDIT_ANY = 'QUIZ_VERSION_EDIT_ANY',
  QUIZ_VERSION_PUBLISH_OWN = 'QUIZ_VERSION_PUBLISH_OWN',
  QUIZ_VERSION_PUBLISH_ANY = 'QUIZ_VERSION_PUBLISH_ANY',

  TOURNAMENT_CREATE = 'TOURNAMENT_CREATE',
  TOURNAMENT_VIEW = 'TOURNAMENT_VIEW',
  TOURNAMENT_REGISTER = 'TOURNAMENT_REGISTER',
  TOURNAMENT_ATTEMPT = 'TOURNAMENT_ATTEMPT',
}

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    Permission.QUIZ_CREATE,
    Permission.QUIZ_VERIFY,
    Permission.QUIZ_VERSION_CREATE_OWN,
    Permission.QUIZ_VERSION_CREATE_ANY,
    Permission.QUIZ_VERSION_VIEW_OWN,
    Permission.QUIZ_VERSION_VIEW_ANY,
    Permission.QUIZ_VERSION_EDIT_OWN,
    Permission.QUIZ_VERSION_EDIT_ANY,
    Permission.QUIZ_VERSION_PUBLISH_OWN,
    Permission.QUIZ_VERSION_PUBLISH_ANY,
    Permission.TOURNAMENT_CREATE,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,
  ],
  moderator: [
    Permission.QUIZ_VERSION_VIEW_ANY,
    Permission.QUIZ_VERSION_PUBLISH_ANY,
    Permission.QUIZ_VERIFY,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,
  ],
  user: [
    Permission.QUIZ_CREATE,
    Permission.QUIZ_VERSION_CREATE_OWN,
    Permission.QUIZ_VERSION_VIEW_OWN,
    Permission.QUIZ_VERSION_EDIT_OWN,
    Permission.QUIZ_VERSION_PUBLISH_OWN,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_REGISTER,
    Permission.TOURNAMENT_ATTEMPT,
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
};
