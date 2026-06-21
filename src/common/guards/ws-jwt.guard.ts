import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { isUserRole } from '@/common/types/user-role.type';
import type { JwtPayload } from '@/common/guards/jwt.guard';

export type AuthenticatedSocket = Socket & { user?: JwtPayload };

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly accessTokenSecret: string;
  private readonly accessTokenIssuer: string;
  private readonly accessTokenAudience: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret = this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_SECRET');
    this.accessTokenIssuer = this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_ISSUER');
    this.accessTokenAudience = this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_AUDIENCE');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: AuthenticatedSocket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException('WebSocket authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.accessTokenSecret,
        issuer: this.accessTokenIssuer,
        audience: this.accessTokenAudience,
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
