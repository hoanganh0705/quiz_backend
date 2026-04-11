import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, isNull, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { userSessions } from '../../core/database/schema';

@Injectable()
export class AuthSessionCleanupService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(AuthSessionCleanupService.name) private readonly logger: PinoLogger,
  ) {}

  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    const nowIso = new Date().toISOString();

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

    this.logger.info({
      event: 'auth_session_cleanup_completed',
      affectedSessionsCount: revokedRows.length,
      cleanedAt: nowIso,
    });
  }
}
