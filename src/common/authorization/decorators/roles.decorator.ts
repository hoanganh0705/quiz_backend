import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@/common/types/user-role.type';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
