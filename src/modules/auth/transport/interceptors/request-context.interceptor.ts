import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { AuthCookieInstructions, AuthRequestContext } from '../types/auth-http-context.types';
import { AuthRequestContextService } from '../../infrastructure/context/auth-request-context.service';

type RequestWithAuthContext = Request & {
  authContext?: AuthRequestContext;
};

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly authRequestContextService: AuthRequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    if (!request.authContext) {
      const cookieInstructions: AuthCookieInstructions = {};
      request.authContext = {
        session: this.authRequestContextService.getSessionRequestContext(request),
        setRefreshToken: (token: string) => {
          cookieInstructions.refreshToken = token;
        },
        clearRefreshToken: () => {
          cookieInstructions.clearRefreshToken = true;
        },
        getCookieInstructions: () => cookieInstructions,
      };
    }

    return next.handle();
  }
}
