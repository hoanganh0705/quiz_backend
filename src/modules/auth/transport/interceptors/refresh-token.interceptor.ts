import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { finalize, type Observable } from 'rxjs';
import type { Response } from 'express';
import { AuthCookieService } from '../cookies/auth-cookie.service';
import type { AuthRequestContext } from '../types/auth-http-context.types';

type RequestWithAuthContext = {
  authContext?: AuthRequestContext;
};

@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly authCookieService: AuthCookieService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    // We use `finalize` (not `tap`) so the cookie write happens after
    // the controller completes — including after exception filters
    // resolve. If we used `tap`, a thrown controller exception would
    // short-circuit the cookie write and the caller would see an
    // unrotated refresh token even though the underlying session was
    // already revoked by the domain layer.
    return next.handle().pipe(
      finalize(() => {
        const authContext = request.authContext;
        if (!authContext) {
          return;
        }

        const instructions = authContext.getCookieInstructions();

        if (instructions?.clearRefreshToken) {
          this.authCookieService.clearRefreshTokenCookie(response);
        } else if (instructions?.refreshToken) {
          this.authCookieService.setRefreshTokenCookie(response, instructions.refreshToken);
        }
      }),
    );
  }
}
