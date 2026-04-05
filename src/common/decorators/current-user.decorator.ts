import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { JwtUserPayload } from '../guards/jwt.guard';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
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
