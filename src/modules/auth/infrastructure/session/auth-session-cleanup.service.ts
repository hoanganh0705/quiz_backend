import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';

const AUTH_SESSION_CLEANUP_LOCK_KEY = 'auth:cron:sessions_cleanup';
const AUTH_SESSION_CLEANUP_LOCK_TTL_MS = 2 * 60 * 1000;
const AUTH_SESSION_CLEANUP_JOB = 'auth-session-cleanup';

@Injectable()
export class AuthSessionCleanupService {
  constructor(
    private readonly userSessionRepository: UserSessionRepository,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(AuthSessionCleanupService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return;
    try {
      await this.runCleanup();
    } finally {
      await this.cache.releaseAdvisoryLock(AUTH_SESSION_CLEANUP_LOCK_KEY, lockToken);
    }
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: AUTH_SESSION_CLEANUP_LOCK_KEY,
      lockTtlMs: AUTH_SESSION_CLEANUP_LOCK_TTL_MS,
      job: AUTH_SESSION_CLEANUP_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'auth_session_cleanup_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  private async runCleanup(): Promise<void> {
    try {
      const nowIso = new Date().toISOString();
      const revokedRows = await this.userSessionRepository.revokeExpiredSessions(nowIso);

      this.logger.info({
        event: 'auth_session_cleanup_completed',
        affectedSessionsCount: revokedRows.length,
        cleanedAt: nowIso,
      });
    } catch (error: unknown) {
      this.logger.error({
        event: 'auth_session_cleanup_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
