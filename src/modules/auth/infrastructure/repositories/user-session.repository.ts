import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userSessions } from '@/core/database/schema';
import type {
  SessionRepositoryPort,
  SessionRecord,
} from '@/modules/auth/domain/ports/session-repository.port';

export type { SessionRecord };

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
export class UserSessionRepository implements SessionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createSessionWithActiveLimit(
    data: {
      jti: string;
      userId: string;
      refreshTokenHash: string;
      ipAddress: string | null;
      deviceBrowser: string | null;
      deviceOs: string | null;
      deviceType: string;
      expiresAt: string;
    },
    nowIso: string,
    maxActiveSessionsPerUser: number,
    explicitSessionId?: string,
  ): Promise<string> {
    if (!Number.isInteger(maxActiveSessionsPerUser) || maxActiveSessionsPerUser <= 0) {
      throw new InternalServerErrorException('Invalid max active sessions configuration');
    }

    let createdSessionId: string = '';

    await this.db
      .transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.userId}))`);

        const sessionIdToUse = explicitSessionId ?? randomUUID();

        const [created] = await tx
          .insert(userSessions)
          .values({ ...data, sessionId: sessionIdToUse })
          .returning({ sessionId: userSessions.sessionId });

        createdSessionId = created?.sessionId ?? sessionIdToUse;

        const activeSessions = await tx
          .select({
            sessionId: userSessions.sessionId,
          })
          .from(userSessions)
          .where(
            and(
              eq(userSessions.userId, data.userId),
              isNull(userSessions.revokedAt),
              gt(userSessions.expiresAt, nowIso),
            ),
          )
          .orderBy(asc(userSessions.lastUsedAt), asc(userSessions.createdAt));

        if (activeSessions.length <= maxActiveSessionsPerUser) {
          return;
        }

        const sessionsToRevoke = activeSessions.slice(
          0,
          activeSessions.length - maxActiveSessionsPerUser,
        );
        const sessionIdsToRevoke = sessionsToRevoke.map((s) => s.sessionId);

        await tx
          .update(userSessions)
          .set({
            revokedAt: nowIso,
            lastUsedAt: nowIso,
          })
          .where(inArray(userSessions.sessionId, sessionIdsToRevoke));
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user session');
      });

    return createdSessionId;
  }

  async getSessionByJtiAndUserId(
    jti: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    const [session] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(
        and(
          eq(userSessions.jti, jti),
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, nowIso),
        ),
      )
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

  async findActiveSessionsByUserId(userId: string, nowIso: string): Promise<SessionRecord[]> {
    const sessions = await this.db
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
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch active user sessions');
      });

    return sessions as SessionRecord[];
  }

  async findSessionByIdAndUserId(
    sessionId: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null> {
    const [session] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionId, sessionId),
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, nowIso),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user session by id');
      });

    return (session as SessionRecord | undefined) ?? null;
  }

  async rotateSessionWithLock(
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
    await this.db.transaction(async (tx) => {
      // Serializes concurrent refresh-token rotations for the same sessionId.
      // Two concurrent rotations without the lock: both read session, both write,
      // second write overwrites the first → first token becomes permanently invalid.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`);

      await tx.update(userSessions).set(data).where(eq(userSessions.sessionId, sessionId));
    });
  }

  async revokeSessionsByUserId(
    userId: string,
    nowIso: string,
  ): Promise<Array<{ sessionId: string; jti: string; refreshTokenHash: string }>> {
    return this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .returning({
        sessionId: userSessions.sessionId,
        jti: userSessions.jti,
        refreshTokenHash: userSessions.refreshTokenHash,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user sessions');
      });
  }

  async revokeOtherSessionsByUserId(
    userId: string,
    sessionId: string,
    nowIso: string,
  ): Promise<Array<{ sessionId: string; jti: string; refreshTokenHash: string }>> {
    return this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          sql`${userSessions.sessionId} <> ${sessionId}`,
        ),
      )
      .returning({
        sessionId: userSessions.sessionId,
        jti: userSessions.jti,
        refreshTokenHash: userSessions.refreshTokenHash,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke other user sessions');
      });
  }

  async revokeSessionById(
    sessionId: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null> {
    const [row] = await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.sessionId, sessionId), isNull(userSessions.revokedAt)))
      .returning({
        sessionId: userSessions.sessionId,
        jti: userSessions.jti,
        refreshTokenHash: userSessions.refreshTokenHash,
        userId: userSessions.userId,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by id');
      });
    return row ?? null;
  }

  async revokeSessionByJti(
    jti: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null> {
    const [row] = await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.jti, jti), isNull(userSessions.revokedAt)))
      .returning({
        sessionId: userSessions.sessionId,
        jti: userSessions.jti,
        refreshTokenHash: userSessions.refreshTokenHash,
        userId: userSessions.userId,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by jti');
      });
    return row ?? null;
  }

  async revokeSessionByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null> {
    const [row] = await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(
        and(eq(userSessions.refreshTokenHash, refreshTokenHash), isNull(userSessions.revokedAt)),
      )
      .returning({
        sessionId: userSessions.sessionId,
        jti: userSessions.jti,
        refreshTokenHash: userSessions.refreshTokenHash,
        userId: userSessions.userId,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by token hash');
      });
    return row ?? null;
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

  async countActiveSessionsByUserId(userId: string, nowIso: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, nowIso),
        ),
      )
      .catch(() => {
        throw new InternalServerErrorException('Failed to count active sessions');
      });

    return result?.count ?? 0;
  }
}
