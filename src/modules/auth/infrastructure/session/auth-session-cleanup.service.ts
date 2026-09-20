import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserSessionRepository } from '../repositories/user-session.repository';

@Injectable()
export class AuthSessionCleanupService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    @InjectPinoLogger(AuthSessionCleanupService.name) private readonly logger: PinoLogger,
  ) {}

  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const nowIso = new Date().toISOString();
      const revokedRows = await this.userSessionRepository.revokeExpiredSessions(nowIso);

      this.logger.info({
        event: 'auth_session_cleanup_completed',
        affectedSessionsCount: revokedRows.length,
        cleanedAt: nowIso,
      });
    } catch (error: unknown) {
      // The cron tick will retry on the next hour, but emit a warn so
      // operators see a sustained cleanup failure even if the upstream
      // dependency (DB) keeps returning errors.
      this.logger.error({
        event: 'auth_session_cleanup_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
