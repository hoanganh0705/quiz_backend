import { Inject, Injectable } from '@nestjs/common';
import { AuthConfig } from '../auth.config';
import type { AuthTokens, SessionRequestContext } from '../types/auth-context.types';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import {
  SESSION_REPOSITORY_PORT,
  type SessionRepositoryPort,
  type SessionRecord,
} from './ports/session-repository.port';

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY_PORT)
    private readonly userSessionRepository: SessionRepositoryPort,
    private readonly authConfig: AuthConfig,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
  ) {}

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.authConfig.sessions.refreshSessionTtlMs).toISOString();
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
      this.authConfig.sessions.maxActiveSessionsPerUser,
    );
  }

  async getSessionByJtiAndUserId(
    jti: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    return this.userSessionRepository.getSessionByJtiAndUserId(jti, userId, nowIso);
  }

  async findLatestActiveSessionByUserId(
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    return this.userSessionRepository.findLatestActiveSessionByUserId(userId, nowIso);
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
