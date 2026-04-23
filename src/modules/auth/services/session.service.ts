import { Injectable } from '@nestjs/common';
import { AuthConfig } from '../auth.config';
import { AuthTokens, SessionRequestContext } from '../types/auth.types';
import { CryptoService } from '@/modules/auth/services/crypto.service';
import {
  UserSessionRepository,
  type SessionRecord,
} from '@/core/database/repositories/user-session.repository';

@Injectable()
export class SessionService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    private readonly authConfig: AuthConfig,
    private readonly cryptoService: CryptoService,
  ) {}

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.authConfig.refreshSessionTtlMs).toISOString();
  }

  private getNowIso(): string {
    return new Date().toISOString();
  }

  async createSession(
    userId: string,
    refreshToken: string,
    refreshTokenJti: string,
    context: SessionRequestContext,
  ): Promise<void> {
    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();
    const nowIso = this.getNowIso();

    await this.userSessionRepository.createSessionWithActiveLimit(
      {
        jti: refreshTokenJti,
        userId,
        refreshTokenHash,
        ipAddress: context.ipAddress,
        deviceBrowser: context.deviceBrowser,
        deviceOs: context.deviceOs,
        deviceType: context.deviceType,
        expiresAt,
      },
      nowIso,
      this.authConfig.maxActiveSessionsPerUser,
    );
  }

  async getSessionByJtiAndUserId(
    jti: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    return await this.userSessionRepository.getSessionByJtiAndUserId(jti, userId, nowIso);
  }

  async findLatestActiveSessionByUserId(
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    return await this.userSessionRepository.findLatestActiveSessionByUserId(userId, nowIso);
  }

  async rotateSession(
    sessionId: string,
    tokens: AuthTokens,
    context: SessionRequestContext,
    nowIso: string,
  ): Promise<void> {
    const nextRefreshTokenHash = this.cryptoService.hashSha256(tokens.refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();

    await this.userSessionRepository.updateSessionForRotation(sessionId, {
      jti: tokens.refreshTokenJti,
      refreshTokenHash: nextRefreshTokenHash,
      ipAddress: context.ipAddress,
      deviceBrowser: context.deviceBrowser,
      deviceOs: context.deviceOs,
      deviceType: context.deviceType,
      expiresAt,
      lastUsedAt: nowIso,
    });
  }

  async revokeAllActiveSessions(userId: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionsByUserId(userId, nowIso);
  }

  async revokeSessionByJti(jti: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionByJti(jti, nowIso);
  }

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionByRefreshTokenHash(refreshTokenHash, nowIso);
  }
}
