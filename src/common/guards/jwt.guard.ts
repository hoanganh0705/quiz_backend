import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserRole } from '../decorators/roles.decorator';

export type JwtUserPayload = {
  sub: string;
  role: UserRole;
};

type AuthenticatedRequest = Request & {
  user?: JwtUserPayload;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getAccessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
      })()
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(token, {
        secret: this.getAccessTokenSecret(),
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
