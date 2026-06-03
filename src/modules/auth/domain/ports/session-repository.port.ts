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

  updateSessionForRotation(
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

  revokeSessionsByUserId(userId: string, nowIso: string): Promise<void>;

  revokeOtherSessionsByUserId(userId: string, sessionId: string, nowIso: string): Promise<void>;

  revokeSessionById(sessionId: string, nowIso: string): Promise<void>;

  revokeSessionByJti(jti: string, nowIso: string): Promise<void>;

  revokeSessionByRefreshTokenHash(refreshTokenHash: string, nowIso: string): Promise<void>;

  countActiveSessionsByUserId(userId: string, nowIso: string): Promise<number>;
}

export const SESSION_REPOSITORY_PORT = Symbol('SESSION_REPOSITORY_PORT');
