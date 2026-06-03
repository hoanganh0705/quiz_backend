import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { TokenProvider } from '../../domain/ports/token.provider';
import { Inject } from '@nestjs/common';
import { TOKEN_PROVIDER } from '../../domain/ports/token.provider';

export const CurrentSessionId = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<string> => {
    const request = ctx.switchToHttp().getRequest<{ cookies?: Record<string, string> }>();
    const refreshToken = request.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found in request');
    }

    try {
      const tokenProvider = ctx.switchToHttp().getRequest()[TOKEN_PROVIDER] as
        | TokenProvider
        | undefined;
      if (tokenProvider) {
        const payload = await tokenProvider.tryVerifyRefreshToken(refreshToken);
        if (payload?.jti) {
          return payload.jti;
        }
      }
    } catch {
      // Fall through to error
    }

    throw new UnauthorizedException('Unable to determine current session');
  },
);
