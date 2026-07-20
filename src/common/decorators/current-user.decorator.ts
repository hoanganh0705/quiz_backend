import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { JwtPayload } from '../guards/jwt.guard';

/**
 * Extracts the authenticated user from the request.
 * Throws UnauthorizedException if the user is not authenticated.
 *
 * @param data - Optional property name to extract from the JWT payload
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    if (!data) {
      return user;
    }

    return user[data];
  },
);

/**
 * Extracts the authenticated user from the request, or returns undefined if not authenticated.
 * Use this decorator for endpoints that can be accessed by both authenticated and anonymous users.
 *
 * @param data - Optional property name to extract from the JWT payload
 */
export const OptionalCurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (!data) {
      return user;
    }

    return user[data];
  },
);
