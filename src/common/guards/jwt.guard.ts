import {
  applyDecorators,
  Injectable,
  UnauthorizedException,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Socket } from 'socket.io';
import { jwtConfig } from '@/core/config';
import type { JwtConfig } from '@/core/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isUserRole, type UserRole } from '../types/user-role.type';

export type JwtPayload = {
  sub: string;
  role: UserRole;
  sessionId?: string;
};

export type AuthenticatedSocket = Socket & { user?: JwtPayload };

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwt: JwtConfig,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwt.accessSecret,
        issuer: this.jwt.issuer,
        audience: this.jwt.audience,
      });

      if (!payload?.sub || !isUserRole(payload.role)) {
        throw new UnauthorizedException('Invalid access token payload');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

export const RequireAuth = () => applyDecorators(UseGuards(JwtGuard));
