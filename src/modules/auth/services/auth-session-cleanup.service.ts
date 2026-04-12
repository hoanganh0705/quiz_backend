import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserSessionRepository } from '../../../core/database/repositories/user-session.repository';

@Injectable()
export class AuthSessionCleanupService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    @InjectPinoLogger(AuthSessionCleanupService.name) private readonly logger: PinoLogger,
  ) {}

  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    const nowIso = new Date().toISOString();

    const revokedRows = await this.userSessionRepository.revokeExpiredSessions(nowIso);

    this.logger.info({
      event: 'auth_session_cleanup_completed',
      affectedSessionsCount: revokedRows.length,
      cleanedAt: nowIso,
    });
  }
}
