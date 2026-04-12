import { Injectable } from '@nestjs/common';
import { AuthConfig } from '../auth.config';
import { AuthTokens, SessionRequestContext } from '../types/auth.types';
import { CryptoService } from '../../../common/service/crypto.service';
import {
  UserSessionRepository,
  type SessionRecord,
} from '../../../core/database/repositories/user-session.repository';

@Injectable()
export class SessionService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    private readonly authConfig: AuthConfig,
    private readonly cryptoService: CryptoService,
  ) {}

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.authConfig.refreshTokenCookieMaxAgeMs).toISOString();
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

    await this.userSessionRepository.createSession({
      jti: refreshTokenJti,
      userId,
      refreshTokenHash,
      ipAddress: context.ipAddress,
      deviceBrowser: context.deviceBrowser,
      deviceOs: context.deviceOs,
      deviceType: context.deviceType,
      expiresAt,
    });

    await this.enforceActiveSessionLimit(userId);
  }

  async getSessionByJtiAndUserId(jti: string, userId: string): Promise<SessionRecord | null> {
    return await this.userSessionRepository.getSessionByJtiAndUserId(jti, userId);
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

  async softRevokeExpiredSessions(): Promise<number> {
    const nowIso = this.getNowIso();
    const revokedRows = await this.userSessionRepository.revokeExpiredSessions(nowIso);
    return revokedRows.length;
  }

  private async enforceActiveSessionLimit(userId: string): Promise<void> {
    const activeSessions =
      await this.userSessionRepository.getActiveSessionIdsOrderedByLastUsed(userId);

    if (activeSessions.length <= this.authConfig.maxActiveSessionsPerUser) {
      return;
    }

    const sessionsToRevoke = activeSessions.slice(
      0,
      activeSessions.length - this.authConfig.maxActiveSessionsPerUser,
    );

    const nowIso = this.getNowIso();
    const sessionIdsToRevoke = sessionsToRevoke.map((s) => s.sessionId);
    await this.userSessionRepository.revokeSessionsByIds(sessionIdsToRevoke, nowIso);
  }
}
