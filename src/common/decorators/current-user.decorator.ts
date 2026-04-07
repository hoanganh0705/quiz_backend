import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { JwtPayload } from '../guards/jwt.guard';

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
