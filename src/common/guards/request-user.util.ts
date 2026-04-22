import { UnauthorizedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { isUserRole, type UserRole } from '@/common/decorators/roles.decorator';

type RequestUser = {
  sub?: unknown;
  role?: unknown;
};

type RequestUserAssertionOptions = {
  logger?: PinoLogger;
  unauthenticatedEvent: string;
  invalidRoleEvent: string;
};

export type AuthorizedRequestUser = {
  sub: string;
  role: UserRole;
};

export const assertRequestUser = (
  user: unknown,
  options: RequestUserAssertionOptions,
): AuthorizedRequestUser => {
  const requestUser: RequestUser | null = user && typeof user === 'object' ? user : null;

  if (!requestUser || typeof requestUser.sub !== 'string') {
    options.logger?.warn({
      event: options.unauthenticatedEvent,
      userId: requestUser?.sub,
      userRole: requestUser?.role,
    });
    throw new UnauthorizedException('User is not authenticated');
  }

  if (!isUserRole(requestUser.role)) {
    options.logger?.warn({
      event: options.invalidRoleEvent,
      userId: requestUser.sub,
      userRole: requestUser.role,
    });
    throw new UnauthorizedException('Invalid user role in token');
  }

  return {
    sub: requestUser.sub,
    role: requestUser.role,
  };
};
