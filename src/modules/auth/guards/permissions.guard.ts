import {
  ForbiddenException,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { hasPermission, Permission } from '@/modules/auth/authz/permissions';
import { PERMISSIONS_KEY } from '@/modules/auth/decorators/permissions.decorator';
import { assertRequestUser } from '../utils/request-user.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @InjectPinoLogger(PermissionsGuard.name) private readonly logger?: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    const requestUser = assertRequestUser(request.user, {
      logger: this.logger,
      unauthenticatedEvent: 'permissions_guard_unauthenticated',
      invalidRoleEvent: 'permissions_guard_invalid_role',
    });

    // Permission gate is RBAC-only; ownership/resource-state checks stay in service layer.
    const allowed = requiredPermissions.some((permission) =>
      hasPermission(requestUser.role, permission),
    );
    if (!allowed) {
      this.logger?.warn({
        event: 'permissions_guard_forbidden',
        userId: requestUser.sub,
        userRole: requestUser.role,
        requiredPermissions,
      });
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
