import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SessionConfig } from '../config/session.config';
import type { AuthTokens, SessionRequestContext } from '../types/auth-context.types';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import {
  SESSION_REPOSITORY_PORT,
  type SessionRepositoryPort,
  type SessionRecord,
} from './ports/session-repository.port';
import {
  SessionInvalidationBus,
  type SessionInvalidationEvent,
} from '../infrastructure/session/session-invalidation.bus';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly deniedSessionIds = new Map<string, number>();
  private readonly deniedJtis = new Map<string, number>();
  private readonly deniedRefreshTokenHashes = new Map<string, number>();
  private readonly deniedUsers = new Map<string, number>();
  private unsubscribeBus: (() => void) | null = null;
  private denyListSweepInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(SESSION_REPOSITORY_PORT)
    private readonly userSessionRepository: SessionRepositoryPort,
    private readonly sessionConfig: SessionConfig,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    private readonly invalidationBus: SessionInvalidationBus,
    @InjectPinoLogger(SessionService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    // Subscribe to the cross-instance invalidation bus. When a peer
    // instance revokes a session, the bus dispatches a typed event
    // here and we add the identifier to the local deny-list. The
    // read paths short-circuit on the deny-list before hitting the
    // database, so a revoked session is rejected immediately on
    // every instance, not just the one that issued the revocation.
    this.unsubscribeBus = this.invalidationBus.onInvalidation((event) => {
      this.applyInvalidationLocally(event);
    });

    // Periodically sweep expired entries from the deny-list. The
    // bus gives us a TTL for each entry, so the Map only ever
    // holds entries that are still in their validity window.
    // Without the sweep, a long-running instance would accumulate
    // entries indefinitely. 60-second cadence is a trade-off
    // between memory and sweep overhead.
    this.denyListSweepInterval = setInterval(() => {
      this.sweepDenyList();
    }, 60_000);
    // Don't keep the process alive just to sweep the deny-list.
    if (typeof this.denyListSweepInterval.unref === 'function') {
      this.denyListSweepInterval.unref();
    }
  }

  onModuleDestroy(): void {
    this.unsubscribeBus?.();
    this.unsubscribeBus = null;
    if (this.denyListSweepInterval) {
      clearInterval(this.denyListSweepInterval);
      this.denyListSweepInterval = null;
    }
    this.deniedSessionIds.clear();
    this.deniedJtis.clear();
    this.deniedRefreshTokenHashes.clear();
    this.deniedUsers.clear();
  }

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.sessionConfig.refreshSessionTtlMs).toISOString();
  }

  private getNowIso(): string {
    return new Date().toISOString();
  }

  /**
   * Apply a single invalidation event to the in-process deny-list.
   * Called for every event received on the pub/sub channel,
   * including events emitted by the local instance (the bus is
   * a fan-out — there is no "skip the publisher" optimization
   * because the cost of a few extra Map writes is negligible
   * compared to the cost of an instance missing its own
   * revocation).
   */
  private applyInvalidationLocally(event: SessionInvalidationEvent): void {
    const expiresAtMs = event.emittedAtMs + this.invalidationBus.denyListTtlMs;
    const now = Date.now();
    if (expiresAtMs <= now) {
      // Already expired by the time we received it; nothing to do.
      return;
    }

    if (event.sessionId) {
      this.deniedSessionIds.set(event.sessionId, expiresAtMs);
    }
    if (event.jti) {
      this.deniedJtis.set(event.jti, expiresAtMs);
    }
    if (event.refreshTokenHash) {
      this.deniedRefreshTokenHashes.set(event.refreshTokenHash, expiresAtMs);
    }
    if (event.kind === 'all_for_user' && event.identifier) {
      this.deniedUsers.set(event.identifier, expiresAtMs);
    }
  }

  private sweepDenyList(): void {
    const now = Date.now();
    const prune = (map: Map<string, number>): void => {
      for (const [key, expiresAt] of map) {
        if (expiresAt <= now) {
          map.delete(key);
        }
      }
    };
    prune(this.deniedSessionIds);
    prune(this.deniedJtis);
    prune(this.deniedRefreshTokenHashes);
    prune(this.deniedUsers);
  }

  private isDeniedUser(userId: string): boolean {
    const expiresAt = this.deniedUsers.get(userId);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.deniedUsers.delete(userId);
      return false;
    }
    return true;
  }

  private isDeniedSessionId(sessionId: string): boolean {
    const expiresAt = this.deniedSessionIds.get(sessionId);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.deniedSessionIds.delete(sessionId);
      return false;
    }
    return true;
  }

  private isDeniedJti(jti: string): boolean {
    const expiresAt = this.deniedJtis.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.deniedJtis.delete(jti);
      return false;
    }
    return true;
  }

  private isDeniedRefreshTokenHash(hash: string): boolean {
    const expiresAt = this.deniedRefreshTokenHashes.get(hash);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.deniedRefreshTokenHashes.delete(hash);
      return false;
    }
    return true;
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
    if (this.isDeniedJti(jti) || this.isDeniedUser(userId)) {
      return null;
    }
    return this.userSessionRepository.getSessionByJtiAndUserId(jti, userId, nowIso);
  }

  async findLatestActiveSessionByUserId(
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    if (this.isDeniedUser(userId)) {
      return null;
    }
    return this.userSessionRepository.findLatestActiveSessionByUserId(userId, nowIso);
  }

  async findActiveSessionsByUserId(userId: string): Promise<SessionRecord[]> {
    if (this.isDeniedUser(userId)) {
      return [];
    }
    return this.userSessionRepository.findActiveSessionsByUserId(userId, this.getNowIso());
  }

  async findSessionByIdAndUserId(sessionId: string, userId: string): Promise<SessionRecord | null> {
    if (this.isDeniedSessionId(sessionId) || this.isDeniedUser(userId)) {
      return null;
    }
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
    const revoked = await this.userSessionRepository.revokeSessionsByUserId(userId, nowIso);
    if (revoked.length === 0) return;

    // The `all_for_user` event lets every instance short-circuit
    // any lookup for this user, regardless of sessionId/jti/hash.
    // The per-session events below back that up so the read path
    // can also deny by a specific identifier (e.g. when a
    // refresh request arrives with a known JTI for a session
    // belonging to this user).
    await this.invalidationBus.publish({
      kind: 'all_for_user',
      identifier: userId,
      reason: 'revoke_all_active_sessions',
    });
    for (const session of revoked) {
      await this.invalidationBus.publish({
        kind: 'session',
        identifier: session.sessionId,
        sessionId: session.sessionId,
        jti: session.jti,
        refreshTokenHash: session.refreshTokenHash,
        reason: 'revoke_all_active_sessions',
      });
    }
  }

  async revokeOtherActiveSessions(userId: string, sessionId: string): Promise<void> {
    const nowIso = this.getNowIso();
    const revoked = await this.userSessionRepository.revokeOtherSessionsByUserId(
      userId,
      sessionId,
      nowIso,
    );
    if (revoked.length === 0) return;

    // Same `all_for_user` + per-session dual publish as above.
    // The `all_for_user` is the primary signal: any session for
    // this user other than the protected one is now invalid.
    await this.invalidationBus.publish({
      kind: 'all_for_user',
      identifier: userId,
      sessionId,
      reason: 'revoke_other_active_sessions',
    });
    for (const session of revoked) {
      await this.invalidationBus.publish({
        kind: 'session',
        identifier: session.sessionId,
        sessionId: session.sessionId,
        jti: session.jti,
        refreshTokenHash: session.refreshTokenHash,
        reason: 'revoke_other_active_sessions',
      });
    }
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
      await this.invalidationBus.publish({
        kind: 'all_for_user',
        identifier: userId,
        sessionId: currentSessionId,
        reason: 'revoke_other_active_sessions_with_count',
      });
      for (const session of otherSessions) {
        await this.invalidationBus.publish({
          kind: 'session',
          identifier: session.sessionId,
          sessionId: session.sessionId,
          jti: session.jti,
          refreshTokenHash: session.refreshTokenHash,
          reason: 'revoke_other_active_sessions_with_count',
        });
      }
    }

    return revokedCount;
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    const nowIso = this.getNowIso();
    const revoked = await this.userSessionRepository.revokeSessionById(sessionId, nowIso);
    if (!revoked) return;

    await this.invalidationBus.publish({
      kind: 'session',
      identifier: revoked.sessionId,
      sessionId: revoked.sessionId,
      jti: revoked.jti,
      refreshTokenHash: revoked.refreshTokenHash,
      reason: 'revoke_session_by_id',
    });
  }

  async revokeSessionByJti(jti: string): Promise<void> {
    const nowIso = this.getNowIso();
    const revoked = await this.userSessionRepository.revokeSessionByJti(jti, nowIso);
    if (!revoked) return;

    await this.invalidationBus.publish({
      kind: 'jti',
      identifier: revoked.jti,
      sessionId: revoked.sessionId,
      jti: revoked.jti,
      refreshTokenHash: revoked.refreshTokenHash,
      reason: 'revoke_session_by_jti',
    });
  }

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    const nowIso = this.getNowIso();
    const revoked = await this.userSessionRepository.revokeSessionByRefreshTokenHash(
      refreshTokenHash,
      nowIso,
    );
    if (!revoked) return;

    await this.invalidationBus.publish({
      kind: 'refresh_token_hash',
      identifier: revoked.refreshTokenHash,
      sessionId: revoked.sessionId,
      jti: revoked.jti,
      refreshTokenHash: revoked.refreshTokenHash,
      reason: 'revoke_session_by_refresh_token_hash',
    });
  }

  async countActiveSessionsByUserId(userId: string): Promise<number> {
    const nowIso = this.getNowIso();
    return this.userSessionRepository.countActiveSessionsByUserId(userId, nowIso);
  }
}
