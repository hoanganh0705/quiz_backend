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
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException('WebSocket authentication token is missing');
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

      client.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
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

    return null;
  }
}
