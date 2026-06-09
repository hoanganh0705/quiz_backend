import { Inject, Injectable } from '@nestjs/common';
import { SessionConfig } from '../config/session.config';
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
    private readonly sessionConfig: SessionConfig,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
  ) {}

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.sessionConfig.refreshSessionTtlMs).toISOString();
  }

  private getNowIso(): string {
    return new Date().toISOString();
  }

  async createSession(
    userId: string,
    refreshToken: string,
    refreshTokenJti: string,
    context: SessionRequestContext,
    explicitSessionId?: string,
  ): Promise<string> {
    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();
    const nowIso = this.getNowIso();

    return this.userSessionRepository.createSessionWithActiveLimit(
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
      this.sessionConfig.maxActiveSessionsPerUser,
      explicitSessionId,
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

  async findActiveSessionsByUserId(userId: string): Promise<SessionRecord[]> {
    return this.userSessionRepository.findActiveSessionsByUserId(userId, this.getNowIso());
  }

  async findSessionByIdAndUserId(sessionId: string, userId: string): Promise<SessionRecord | null> {
    return this.userSessionRepository.findSessionByIdAndUserId(sessionId, userId, this.getNowIso());
  }

  async rotateSession(
    sessionId: string,
    tokens: AuthTokens,
    context: SessionRequestContext,
    nowIso: string,
  ): Promise<void> {
    const nextRefreshTokenHash = this.cryptoService.hashSha256(tokens.refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();

    // Uses rotateSessionWithLock which holds pg_advisory_xact_lock(hashtext(sessionId))
    // for the duration of the transaction — preventing concurrent refresh requests for
    // the same session from racing and overwriting each other's token hash.
    await this.userSessionRepository.rotateSessionWithLock(sessionId, {
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

  async revokeOtherActiveSessions(userId: string, sessionId: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeOtherSessionsByUserId(userId, sessionId, nowIso);
  }

  async revokeOtherActiveSessionsAndReturnCount(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const nowIso = this.getNowIso();
    const sessions = await this.userSessionRepository.findActiveSessionsByUserId(userId, nowIso);
    const otherSessions = sessions.filter((s) => s.sessionId !== currentSessionId);
    const revokedCount = otherSessions.length;

    if (revokedCount > 0) {
      await this.userSessionRepository.revokeOtherSessionsByUserId(
        userId,
        currentSessionId,
        nowIso,
      );
    }

    return revokedCount;
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionById(sessionId, nowIso);
  }

  async revokeSessionByJti(jti: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionByJti(jti, nowIso);
  }

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    const nowIso = this.getNowIso();
    await this.userSessionRepository.revokeSessionByRefreshTokenHash(refreshTokenHash, nowIso);
  }

  async countActiveSessionsByUserId(userId: string): Promise<number> {
    const nowIso = this.getNowIso();
    return this.userSessionRepository.countActiveSessionsByUserId(userId, nowIso);
  }
}
