import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { UserRole } from '../../modules/auth/decorators/roles.decorator';

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  private getAccessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
      })()
    );
  }

  private getAccessTokenIssuer(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_ISSUER') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_ISSUER is not defined in environment variables');
      })()
    );
  }

  private getAccessTokenAudience(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_AUDIENCE') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_AUDIENCE is not defined in environment variables');
      })()
    );
  }

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

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getAccessTokenSecret(),
        issuer: this.getAccessTokenIssuer(),
        audience: this.getAccessTokenAudience(),
      });

      if (!payload?.sub || !payload.role) {
        throw new UnauthorizedException('Invalid access token payload');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
