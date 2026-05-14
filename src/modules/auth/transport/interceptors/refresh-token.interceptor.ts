import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { tap, type Observable } from 'rxjs';
import { AuthCookieService } from '../cookies/auth-cookie.service';
import type { AuthRequestContext } from '../../types/auth-context.types';

type RequestWithAuthContext = {
  authContext?: AuthRequestContext;
};

@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly authCookieService: AuthCookieService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    return next.handle().pipe(
      tap(() => {
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
