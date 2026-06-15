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

export interface SessionRepositoryPort {
  createSessionWithActiveLimit(
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
  ): Promise<string>;

  getSessionByJtiAndUserId(
    jti: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null>;

  findLatestActiveSessionByUserId(userId: string, nowIso: string): Promise<SessionRecord | null>;

  findActiveSessionsByUserId(userId: string, nowIso: string): Promise<SessionRecord[]>;

  findSessionByIdAndUserId(
    sessionId: string,
    userId: string,
    nowIso: string,
  ): Promise<SessionRecord | null>;

  /**
   * Atomically rotates a session's refresh token and refreshes lastUsedAt, within a
   * pg_advisory_xact_lock scoped to the sessionId. This prevents two concurrent
   * refresh requests for the same session from racing — without the lock, the second
   * request overwrites the first's token hash, making the first token invalid.
   */
  rotateSessionWithLock(
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
  ): Promise<void>;

  revokeSessionsByUserId(
    userId: string,
    nowIso: string,
  ): Promise<Array<{ sessionId: string; jti: string; refreshTokenHash: string }>>;

  revokeOtherSessionsByUserId(
    userId: string,
    sessionId: string,
    nowIso: string,
  ): Promise<Array<{ sessionId: string; jti: string; refreshTokenHash: string }>>;

  revokeSessionById(
    sessionId: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null>;

  revokeSessionByJti(
    jti: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null>;

  revokeSessionByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<{ sessionId: string; jti: string; refreshTokenHash: string; userId: string } | null>;

  countActiveSessionsByUserId(userId: string, nowIso: string): Promise<number>;
}

export const SESSION_REPOSITORY_PORT = Symbol('SESSION_REPOSITORY_PORT');
