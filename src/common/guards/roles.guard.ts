import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';
import type { JwtUserPayload } from './jwt.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private isUserRole(value: unknown): value is UserRole {
    return value === 'admin' || value === 'moderator' || value === 'creator' || value === 'user';
  }

  private hasJwtUserShape(user: unknown): user is JwtUserPayload {
    if (!user || typeof user !== 'object') {
      return false;
    }

    const maybeUser = user as Record<string, unknown>;
    return (
      typeof maybeUser.sub === 'string' &&
      typeof maybeUser.username === 'string' &&
      typeof maybeUser.email === 'string' &&
      this.isUserRole(maybeUser.role)
    );
  }

  private normalizeRequiredRoles(roles: unknown): UserRole[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    return roles.filter((role): role is UserRole => this.isUserRole(role));
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<unknown>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const normalizedRoles = this.normalizeRequiredRoles(requiredRoles);

    if (normalizedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    const user = request.user;

    if (!this.hasJwtUserShape(user)) {
      throw new UnauthorizedException('User is not authenticated');
    }

    const userRoleCandidate = (user as { role: unknown }).role;
    if (!this.isUserRole(userRoleCandidate)) {
      throw new UnauthorizedException('User role is invalid');
    }

    const userRole = userRoleCandidate;

    if (!normalizedRoles.includes(userRole)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
