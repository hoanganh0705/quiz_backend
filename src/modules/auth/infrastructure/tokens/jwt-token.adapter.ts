import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type {
  AccessTokenClaims,
  AuthIdentity,
  AuthTokens,
  RefreshTokenClaims,
  RefreshTokenPayload,
} from '../../types/auth-context.types';
import { AuthConfig } from '../../auth.config';
import type { TokenProvider } from '../../domain/ports/token.provider';

@Injectable()
export class JwtTokenAdapter implements TokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authConfig: AuthConfig,
  ) {}

  async issueTokens(identity: AuthIdentity): Promise<AuthTokens> {
    const refreshTokenJti = randomUUID();
    const accessTokenPayload: AccessTokenClaims = {
      sub: identity.userId,
      role: identity.role,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.authConfig.tokens.access.secret,
      expiresIn: this.authConfig.tokens.access.expiresInSeconds,
      issuer: this.authConfig.tokens.access.issuer,
      audience: this.authConfig.tokens.access.audience,
    });

    const refreshTokenPayload: RefreshTokenClaims = {
      sub: identity.userId,
      jti: refreshTokenJti,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.authConfig.tokens.refresh.secret,
      expiresIn: this.authConfig.tokens.refresh.expiresInSeconds,
      issuer: this.authConfig.tokens.refresh.issuer,
      audience: this.authConfig.tokens.refresh.audience,
    });

    return { accessToken, refreshToken, refreshTokenJti };
  }

  private isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Record<string, unknown>;
    const hasRequiredFields =
      typeof candidate.sub === 'string' &&
      typeof candidate.jti === 'string' &&
      typeof candidate.iss === 'string' &&
      (typeof candidate.aud === 'string' ||
        (Array.isArray(candidate.aud) &&
          candidate.aud.every((audience) => typeof audience === 'string')));
    if (!hasRequiredFields) {
      return false;
    }

    const expOk = candidate.exp === undefined || typeof candidate.exp === 'number';
    const iatOk = candidate.iat === undefined || typeof candidate.iat === 'number';
    return expOk && iatOk;
  }

  async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      // Enforce secret + issuer + audience so refresh tokens are scoped to this service context.
      const decodedPayload: unknown = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.authConfig.tokens.refresh.secret,
        issuer: this.authConfig.tokens.refresh.issuer,
        audience: this.authConfig.tokens.refresh.audience,
      });

      if (!this.isRefreshTokenPayload(decodedPayload)) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }
      return decodedPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async tryVerifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload | null> {
    try {
      return this.verifyRefreshToken(refreshToken);
    } catch {
      return null;
    }
  }
}
