import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, lt, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database.module';
import { userSessions } from '../schema';

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
export class UserSessionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createSession(data: {
    jti: string;
    userId: string;
    refreshTokenHash: string;
    ipAddress: string | null;
    deviceBrowser: string | null;
    deviceOs: string | null;
    deviceType: string;
    expiresAt: string;
  }): Promise<void> {
    await this.db
      .insert(userSessions)
      .values(data)
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user session');
      });
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

  async updateSessionForRotation(
    sessionId: string,
    data: {
      jti: string;
      refreshTokenHash: string;
      ipAddress: string | null;
      deviceBrowser: string | null;
      deviceOs: string | null;
      deviceType: string;
      expiresAt: string;
      lastUsedAt: string;
    },
  ): Promise<void> {
    await this.db
      .update(userSessions)
      .set(data)
      .where(eq(userSessions.sessionId, sessionId))
      .catch(() => {
        throw new InternalServerErrorException('Failed to rotate user session');
      });
  }

  async revokeSessionsByUserId(userId: string, nowIso: string): Promise<void> {
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

  async revokeSessionByJti(jti: string, nowIso: string): Promise<void> {
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

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string, nowIso: string): Promise<void> {
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

  async revokeExpiredSessions(nowIso: string): Promise<{ sessionId: string }[]> {
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

    return revokedRows;
  }

  async getActiveSessionIdsOrderedByLastUsed(userId: string): Promise<{ sessionId: string }[]> {
    return await this.db
      .select({
        sessionId: userSessions.sessionId,
      })
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .orderBy(asc(userSessions.lastUsedAt), asc(userSessions.createdAt))
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch active sessions');
      });
  }

  async revokeSessionsByIds(sessionIds: string[], nowIso: string): Promise<void> {
    if (sessionIds.length === 0) return;

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(inArray(userSessions.sessionId, sessionIds))
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke sessions');
      });
  }
}
