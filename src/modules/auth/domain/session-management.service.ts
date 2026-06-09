import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SessionService } from './session.service';
import { SessionNotFoundError } from './errors';

export type ActiveSessionInfo = {
  sessionId: string;
  deviceBrowser: string | null;
  deviceOs: string | null;
  deviceType: string;
  ipAddress: string | null;
  lastActiveAt: string;
};

@Injectable()
export class SessionManagementService {
  constructor(
    private readonly sessionService: SessionService,
    @InjectPinoLogger(SessionManagementService.name) private readonly logger: PinoLogger,
  ) {}

  async getActiveSessions(userId: string): Promise<ActiveSessionInfo[]> {
    const sessions = await this.sessionService.findActiveSessionsByUserId(userId);

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      deviceBrowser: session.deviceBrowser,
      deviceOs: session.deviceOs,
      deviceType: session.deviceType,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastUsedAt,
    }));
  }

  async revokeSession(
    userId: string,
    targetSessionId: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<void> {
    const session = await this.sessionService.findSessionByIdAndUserId(targetSessionId, userId);

    if (!session) {
      throw new SessionNotFoundError('Session not found');
    }

    await this.sessionService.revokeSessionById(targetSessionId);

    this.logger.info({
      event: 'auth_security_session_revoked',
      eventType: 'session_revoked',
      userId,
      sessionId: targetSessionId,
      timestamp: new Date().toISOString(),
      revokedByIp: ipAddress,
    });

    this.logger.info({
      event: 'auth_session_revoked',
      userId,
      sessionId: targetSessionId,
      isCurrentSession: targetSessionId === currentSessionId,
    });
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
    ipAddress?: string,
  ): Promise<number> {
    const revokedCount = await this.sessionService.revokeOtherActiveSessionsAndReturnCount(
      userId,
      currentSessionId,
    );

    this.logger.info({
      event: 'auth_security_all_other_sessions_revoked',
      eventType: 'all_other_sessions_revoked',
      userId,
      currentSessionId,
      revokedSessionCount: revokedCount,
      timestamp: new Date().toISOString(),
      ipAddress,
    });

    this.logger.info({
      event: 'auth_other_sessions_revoked',
      userId,
      currentSessionId,
      revokedSessionCount: revokedCount,
    });

    return revokedCount;
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    return this.sessionService.countActiveSessionsByUserId(userId);
  }
}
