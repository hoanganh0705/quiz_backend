import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { extractRefreshTokenFromCookies } from '../../utils/refresh-token.util';

type RefreshTokenOptions = {
  required?: boolean;
};

export const RefreshToken = createParamDecorator(
  (options: RefreshTokenOptions | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ cookies?: unknown }>();
    const refreshToken = extractRefreshTokenFromCookies(request.cookies);

    if (!refreshToken && options?.required) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    return refreshToken;
  },
);
