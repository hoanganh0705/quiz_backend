import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';
import type { JwtPayload } from './jwt.guard';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectPinoLogger(RolesGuard.name) private readonly logger: PinoLogger,
  ) {}

  private isUserRole(value: unknown): value is UserRole {
    return value === 'admin' || value === 'moderator' || value === 'creator' || value === 'user';
  }

  private hasJwtUserShape(user: unknown): user is JwtPayload {
    if (!user || typeof user !== 'object') {
      return false;
    }

    const maybeUser = user as Record<string, unknown>;
    return typeof maybeUser.sub === 'string' && this.isUserRole(maybeUser.role);
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
      this.logger.warn({ event: 'roles_guard_unauthenticated' });
      throw new UnauthorizedException('User is not authenticated');
    }

    const userRole = user.role;

    if (!normalizedRoles.includes(userRole)) {
      this.logger.warn({
        event: 'roles_guard_forbidden',
        userId: user.sub,
        userRole,
        requiredRoles: normalizedRoles,
      });
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
