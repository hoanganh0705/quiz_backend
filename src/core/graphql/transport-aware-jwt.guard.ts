/**
 * Transport-aware JWT guard.
 *
 * The globally registered `JwtGuard` reads its token through
 * `context.switchToHttp()`. A GraphQL execution context is not an HTTP
 * context, so that call yields the wrong request object and the guard either
 * rejects every GraphQL query or crashes while reading headers.
 *
 * This guard resolves the underlying HTTP request for either transport, then
 * applies the same verification rules. It also honours `@Public()`, so a
 * resolver opts out of authentication explicitly rather than by accident.
 */
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { GqlExecutionContext } from '@nestjs/graphql';

import { jwtConfig, type JwtConfig } from '@/core/config';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { isUserRole } from '@/common/types/user-role.type';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { isGraphQLContext } from './graphql-context.util';

type AuthenticatedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
};

@Injectable()
export class TransportAwareJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly jwt: JwtConfig,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = this.resolveRequest(context);
    if (!request) return true;

    const payload = await this.verify(this.extractToken(request));
    request.user = payload;
    return true;
  }

  private resolveRequest(context: ExecutionContext): AuthenticatedRequest | null {
    if (!isGraphQLContext(context)) {
      return context.switchToHttp().getRequest<AuthenticatedRequest>();
    }

    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req?: AuthenticatedRequest;
    }>();
    if (!gqlContext?.req) return null;
    // Identity is derived per field, so a query may mix public and gated
    // fields. Stashing it on the shared request object would let one field's
    // auth decision leak into a sibling field's.
    return { ...gqlContext.req, user: undefined };
  }

  private extractToken(request: AuthenticatedRequest): string {
    const authHeader = this.readHeader(request, 'authorization');
    if (!authHeader) throw new UnauthorizedException('Authorization header is missing');

    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }
    return token;
  }

  private readHeader(request: AuthenticatedRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return value[0];
    return value;
  }

  private async verify(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwt.accessSecret,
        issuer: this.jwt.issuer,
        audience: this.jwt.audience,
      });

      if (!payload?.sub || !isUserRole(payload.role)) {
        throw new UnauthorizedException('Invalid access token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
