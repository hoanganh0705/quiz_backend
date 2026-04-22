import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  AccessTokenPayload,
  AuthIdentity,
  AuthTokens,
  RefreshTokenPayload,
} from '../types/auth.types';
import { AuthConfig } from '../auth.config';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authConfig: AuthConfig,
  ) {}

  async issueTokens(identity: AuthIdentity): Promise<AuthTokens> {
    const refreshTokenJti = randomUUID();
    const accessTokenPayload: AccessTokenPayload = {
      sub: identity.userId,
      role: identity.role,
      iss: this.authConfig.accessTokenIssuer,
      aud: this.authConfig.accessTokenAudience,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.authConfig.accessTokenSecret,
      expiresIn: this.authConfig.accessTokenExpiresInSeconds,
    });

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: identity.userId,
      jti: refreshTokenJti,
      // Keep claim parity with access tokens so verification policy stays consistent.
      iss: this.authConfig.accessTokenIssuer,
      aud: this.authConfig.accessTokenAudience,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.authConfig.refreshTokenSecret,
      expiresIn: this.authConfig.refreshTokenExpiresInSeconds,
      issuer: this.authConfig.accessTokenIssuer,
      audience: this.authConfig.accessTokenAudience,
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
      typeof candidate.aud === 'string';
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
        secret: this.authConfig.refreshTokenSecret,
        issuer: this.authConfig.accessTokenIssuer,
        audience: this.authConfig.accessTokenAudience,
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
      return await this.verifyRefreshToken(refreshToken);
    } catch {
      return null;
    }
  }
}
