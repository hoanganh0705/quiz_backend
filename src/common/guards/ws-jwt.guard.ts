import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { jwtConfig } from '@/core/config';
import type { JwtConfig } from '@/core/config';
import { isUserRole } from '@/common/types/user-role.type';
import type { JwtPayload } from '@/common/guards/jwt.guard';

export type AuthenticatedSocket = Socket & { user?: JwtPayload };

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwt: JwtConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: AuthenticatedSocket = context.switchToWs().getClient();
    if (client.user?.sub && isUserRole(client.user.role)) {
      return true;
    }

    const payload = await this.authenticate(client);
    if (!payload) {
      throw new UnauthorizedException('WebSocket authentication token is missing or invalid');
    }

    client.user = payload;
    return true;
  }

  async authenticate(client: Socket): Promise<JwtPayload | null> {
    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwt.accessSecret,
        issuer: this.jwt.issuer,
        audience: this.jwt.audience,
      });

      if (!payload?.sub || !isUserRole(payload.role)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [scheme, token] = authHeader.trim().split(/\s+/);
      if (scheme === 'Bearer' && token) return token;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
      if (match) return decodeURIComponent(match[1]);
    }

    return null;
  }
}
