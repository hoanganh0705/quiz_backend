import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type UserRole = 'admin' | 'moderator' | 'user';

export const USER_ROLES: readonly UserRole[] = ['admin', 'moderator', 'user'];

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && USER_ROLES.includes(value as UserRole);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
