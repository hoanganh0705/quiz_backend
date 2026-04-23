import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, isUserRole, type UserRole } from '../decorators/roles.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { assertRequestUser } from '../utils/request-user.util';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectPinoLogger(RolesGuard.name) private readonly logger: PinoLogger,
  ) {}

  private normalizeRequiredRoles(roles: unknown): UserRole[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    return roles.filter((role): role is UserRole => isUserRole(role));
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
    const requestUser = assertRequestUser(request.user, {
      logger: this.logger,
      unauthenticatedEvent: 'roles_guard_unauthenticated',
      invalidRoleEvent: 'roles_guard_invalid_role',
    });

    const userRole = requestUser.role;

    if (!normalizedRoles.includes(userRole)) {
      this.logger.warn({
        event: 'roles_guard_forbidden',
        userId: requestUser.sub,
        userRole,
        requiredRoles: normalizedRoles,
      });
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
