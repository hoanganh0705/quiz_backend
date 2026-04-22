import {
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { hasPermission, Permission } from '@/common/authz/permissions';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import type { JwtPayload } from './jwt.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @InjectPinoLogger(PermissionsGuard.name) private readonly logger?: PinoLogger,
  ) {}

  private hasJwtUserShape(user: unknown): user is JwtPayload {
    if (!user || typeof user !== 'object') {
      return false;
    }

    const maybeUser = user as Record<string, unknown>;
    return typeof maybeUser.sub === 'string' && typeof maybeUser.role === 'string';
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    const user = request.user;

    if (!this.hasJwtUserShape(user)) {
      this.logger?.warn({ event: 'permissions_guard_unauthenticated' });
      throw new UnauthorizedException('User is not authenticated');
    }

    const allowed = requiredPermissions.some((permission) => hasPermission(user.role, permission));
    if (!allowed) {
      this.logger?.warn({
        event: 'permissions_guard_forbidden',
        userId: user.sub,
        userRole: user.role,
        requiredPermissions,
      });
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
