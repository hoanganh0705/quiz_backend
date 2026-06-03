import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SessionService } from './session.service';
import { SessionNotFoundError } from './errors';
import {
  AUTH_SECURITY_EVENT_BUS,
  type AuthSecurityEventBusPort,
  SessionRevokedEvent,
  AllOtherSessionsRevokedEvent,
} from './events';

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
    @Inject(AUTH_SECURITY_EVENT_BUS)
    private readonly eventBus: AuthSecurityEventBusPort,
    @InjectPinoLogger(SessionManagementService.name) private readonly logger: PinoLogger,
  ) {}

  async getActiveSessions(userId: string, currentSessionId: string): Promise<ActiveSessionInfo[]> {
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

    this.eventBus.emitSessionRevoked({
      eventType: 'session_revoked',
      userId,
      sessionId: targetSessionId,
      timestamp: new Date(),
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
    const sessionsBefore = await this.sessionService.findActiveSessionsByUserId(userId);
    const otherSessions = sessionsBefore.filter((s) => s.sessionId !== currentSessionId);
    const revokedCount = otherSessions.length;

    await this.sessionService.revokeOtherActiveSessions(userId, currentSessionId);

    this.eventBus.emitAllOtherSessionsRevoked({
      eventType: 'all_other_sessions_revoked',
      userId,
      currentSessionId,
      revokedSessionCount: revokedCount,
      timestamp: new Date(),
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
