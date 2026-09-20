import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { AuthRequestContext } from '../types/auth-http-context.types';
import { AuthRequestContextService } from '../../infrastructure/context/auth-request-context.service';

type RequestWithAuthContext = Request & {
  authContext?: AuthRequestContext;
};

type MutableCookieState = {
  refreshToken?: string;
  clearRefreshToken?: boolean;
};

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly authRequestContextService: AuthRequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    if (!request.authContext) {
      // Internal accumulator kept separate from the public read-only
      // shape so downstream callers cannot mutate the snapshot they
      // receive via `getCookieInstructions()`.
      const cookieState: MutableCookieState = {};
      request.authContext = {
        session: this.authRequestContextService.getSessionRequestContext(request),
        setRefreshToken: (token: string) => {
          cookieState.refreshToken = token;
        },
        clearRefreshToken: () => {
          cookieState.clearRefreshToken = true;
        },
        getCookieInstructions: () => ({
          ...(cookieState.refreshToken !== undefined
            ? { refreshToken: cookieState.refreshToken }
            : {}),
          ...(cookieState.clearRefreshToken === true ? { clearRefreshToken: true } : {}),
        }),
      };
    }

    return next.handle();
  }
}
