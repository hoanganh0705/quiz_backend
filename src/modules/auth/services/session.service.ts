import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../core/database/database.module';
import { userSessions } from '../../../core/database/schema';
import { AuthConfig } from '../auth.config';
import { AuthTokens, SessionRequestContext } from '../types/auth.types';
import { CryptoService } from '../../../common/service/crypto.service';

export type SessionRecord = {
  sessionId: string;
  jti: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress: string | null;
  deviceBrowser: string | null;
  deviceOs: string | null;
  deviceType: string;
  lastUsedAt: string;
  revokedAt: string | null;
  expiresAt: string;
};

const SESSION_LOOKUP_COLUMNS = {
  sessionId: userSessions.sessionId,
  jti: userSessions.jti,
  userId: userSessions.userId,
  refreshTokenHash: userSessions.refreshTokenHash,
  ipAddress: userSessions.ipAddress,
  deviceBrowser: userSessions.deviceBrowser,
  deviceOs: userSessions.deviceOs,
  deviceType: userSessions.deviceType,
  lastUsedAt: userSessions.lastUsedAt,
  revokedAt: userSessions.revokedAt,
  expiresAt: userSessions.expiresAt,
};

@Injectable()
export class SessionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
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

    await this.db
      .insert(userSessions)
      .values({
        jti: refreshTokenJti,
        userId,
        refreshTokenHash,
        ipAddress: context.ipAddress,
        deviceBrowser: context.deviceBrowser,
        deviceOs: context.deviceOs,
        deviceType: context.deviceType,
        expiresAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user session');
      });

    await this.enforceActiveSessionLimit(userId);
  }

  async getSessionByJtiAndUserId(jti: string, userId: string): Promise<SessionRecord | null> {
    const [session] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(and(eq(userSessions.jti, jti), eq(userSessions.userId, userId)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user session');
      });

    return (session as SessionRecord | undefined) ?? null;
  }

  async findLatestActiveSessionByUserId(
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    const [latestSession] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, nowIso),
        ),
      )
      .orderBy(desc(userSessions.lastUsedAt), desc(userSessions.createdAt))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch latest active user session');
      });

    return (latestSession as SessionRecord | undefined) ?? null;
  }

  async rotateSession(
    sessionId: string,
    tokens: AuthTokens,
    context: SessionRequestContext,
    nowIso: string,
  ): Promise<void> {
    const nextRefreshTokenHash = this.cryptoService.hashSha256(tokens.refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();

    await this.db
      .update(userSessions)
      .set({
        jti: tokens.refreshTokenJti,
        refreshTokenHash: nextRefreshTokenHash,
        ipAddress: context.ipAddress,
        deviceBrowser: context.deviceBrowser,
        deviceOs: context.deviceOs,
        deviceType: context.deviceType,
        expiresAt,
        lastUsedAt: nowIso,
      })
      .where(eq(userSessions.sessionId, sessionId))
      .catch(() => {
        throw new InternalServerErrorException('Failed to rotate user session');
      });
  }

  async revokeAllActiveSessions(userId: string): Promise<void> {
    const nowIso = this.getNowIso();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user sessions');
      });
  }

  async revokeSessionByJti(jti: string): Promise<void> {
    const nowIso = this.getNowIso();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.jti, jti), isNull(userSessions.revokedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by jti');
      });
  }

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    const nowIso = this.getNowIso();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(
        and(eq(userSessions.refreshTokenHash, refreshTokenHash), isNull(userSessions.revokedAt)),
      )
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by token hash');
      });
  }

  async softRevokeExpiredSessions(): Promise<number> {
    const nowIso = this.getNowIso();

    const revokedRows = await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
      })
      .where(and(lt(userSessions.expiresAt, nowIso), isNull(userSessions.revokedAt)))
      .returning({
        sessionId: userSessions.sessionId,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to cleanup expired sessions');
      });

    return revokedRows.length;
  }

  private async enforceActiveSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.db
      .select({
        sessionId: userSessions.sessionId,
      })
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .orderBy(asc(userSessions.lastUsedAt), asc(userSessions.createdAt))
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch active sessions');
      });

    if (activeSessions.length <= this.authConfig.maxActiveSessionsPerUser) {
      return;
    }

    const sessionsToRevoke = activeSessions.slice(
      0,
      activeSessions.length - this.authConfig.maxActiveSessionsPerUser,
    );

    const nowIso = this.getNowIso();
    for (const session of sessionsToRevoke) {
      await this.db
        .update(userSessions)
        .set({
          revokedAt: nowIso,
          lastUsedAt: nowIso,
        })
        .where(eq(userSessions.sessionId, session.sessionId))
        .catch(() => {
          throw new InternalServerErrorException('Failed to enforce active session limit');
        });
    }
  }
}
