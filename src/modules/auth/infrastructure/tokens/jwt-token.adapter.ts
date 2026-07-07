import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenClaims,
  AuthIdentity,
  AuthTokens,
  RefreshTokenClaims,
  RefreshTokenPayload,
} from '../../types/auth-context.types';
import type { TokenProvider } from '@/modules/auth/domain/ports/token.provider';
import { TokenConfig } from '../../config/token.config';
import { ID_GENERATOR, type IdGeneratorPort } from '@/common/utils/id-generator';

@Injectable()
export class JwtTokenAdapter implements TokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenConfig: TokenConfig,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGeneratorPort,
  ) {}

  async issueTokens(identity: AuthIdentity, sessionId?: string): Promise<AuthTokens> {
    const refreshTokenJti = this.idGenerator.generate();
    const accessTokenPayload: AccessTokenClaims = {
      sub: identity.userId,
      role: identity.role,
      ...(sessionId ? { sessionId } : {}),
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.tokenConfig.access.secret,
      expiresIn: this.tokenConfig.access.expiresInSeconds,
      issuer: this.tokenConfig.access.issuer,
      audience: this.tokenConfig.access.audience,
    });

    const refreshTokenPayload: RefreshTokenClaims = {
      sub: identity.userId,
      jti: refreshTokenJti,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.tokenConfig.refresh.secret,
      expiresIn: this.tokenConfig.refresh.expiresInSeconds,
      issuer: this.tokenConfig.refresh.issuer,
      audience: this.tokenConfig.refresh.audience,
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
      const decodedPayload: unknown = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.tokenConfig.refresh.secret,
        issuer: this.tokenConfig.refresh.issuer,
        audience: this.tokenConfig.refresh.audience,
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
