import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AuthConfig } from '../auth.config';
import { SessionRequestContext, RefreshTokenPayload } from '../types/auth.types';
import { RedisService } from '../../../core/redis/redis.service';
import { SessionRecord, SessionService } from './session.service';

type RateLimitBucket = 'login_ip' | 'login_user' | 'refresh_ip' | 'refresh_user';

@Injectable()
export class SecurityService {
  constructor(
    private readonly authConfig: AuthConfig,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
    @InjectPinoLogger(SecurityService.name) private readonly logger: PinoLogger,
  ) {}

  private getRateLimitConfig(bucket: RateLimitBucket): { limit: number; windowMs: number } {
    switch (bucket) {
      case 'login_ip':
        return { limit: 10, windowMs: 60_000 };
      case 'login_user':
        return { limit: 8, windowMs: 60_000 };
      case 'refresh_ip':
        return { limit: 30, windowMs: 60_000 };
      case 'refresh_user':
        return { limit: 20, windowMs: 60_000 };
      default:
        return { limit: 10, windowMs: 60_000 };
    }
  }

  private async enforceRateLimit(bucket: RateLimitBucket, key: string): Promise<void> {
    const { limit, windowMs } = this.getRateLimitConfig(bucket);
    const rateKey = `auth_rate_limit:${bucket}:${key}`;
    const count = await this.redisService.incrementWindowCounter(rateKey, windowMs);

    if (count > limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async enforceLoginRateLimit(context: SessionRequestContext, userId?: string): Promise<void> {
    await this.enforceRateLimit('login_ip', context.ipAddress ?? 'unknown');

    if (userId) {
      await this.enforceRateLimit('login_user', userId);
    }
  }

  async enforceRefreshRateLimit(context: SessionRequestContext, userId: string): Promise<void> {
    await this.enforceRateLimit('refresh_ip', context.ipAddress ?? 'unknown');
    await this.enforceRateLimit('refresh_user', userId);
  }

  isRefreshTokenWithinGraceWindow(lastUsedAt: string, nowIso: string): boolean {
    const lastUsedMs = Date.parse(lastUsedAt);
    const nowMs = Date.parse(nowIso);

    if (!Number.isFinite(lastUsedMs) || !Number.isFinite(nowMs)) {
      return false;
    }

    return nowMs - lastUsedMs <= this.authConfig.refreshReuseGraceWindowMs;
  }

  isSameSessionContext(
    session: { ipAddress: string | null; deviceInfo: string | null },
    context: SessionRequestContext,
  ): boolean {
    const hasSessionIp = typeof session.ipAddress === 'string' && session.ipAddress.length > 0;
    const hasContextIp = typeof context.ipAddress === 'string' && context.ipAddress.length > 0;
    const hasSessionDevice =
      typeof session.deviceInfo === 'string' && session.deviceInfo.length > 0;
    const hasContextDevice = typeof context.userAgent === 'string' && context.userAgent.length > 0;

    const ipMatches = !hasSessionIp || !hasContextIp || session.ipAddress === context.ipAddress;
    const deviceMatches =
      !hasSessionDevice || !hasContextDevice || session.deviceInfo === context.userAgent;

    return ipMatches && deviceMatches;
  }

  evaluateSessionBinding(
    session: {
      ipAddress: string | null;
      deviceInfo: string | null;
      userId: string;
      jti: string;
    },
    context: SessionRequestContext,
  ): { shouldReject: boolean } {
    const hasSessionIp = !!session.ipAddress;
    const hasSessionDevice = !!session.deviceInfo;
    const hasRequestIp = !!context.ipAddress;
    const hasRequestDevice = !!context.userAgent;

    const ipMismatch = hasSessionIp
      ? !hasRequestIp || session.ipAddress !== context.ipAddress
      : false;
    const deviceMismatch = hasSessionDevice
      ? !hasRequestDevice || session.deviceInfo !== context.userAgent
      : false;

    if (!ipMismatch && !deviceMismatch) {
      return { shouldReject: false };
    }

    this.logger.warn({
      event: this.authConfig.isSessionBindingStrict
        ? 'auth_refresh_session_binding_mismatch'
        : 'auth_session_binding_suspicious',
      userId: session.userId,
      jti: session.jti,
      storedIpAddress: session.ipAddress,
      requestIpAddress: context.ipAddress,
      storedUserAgent: session.deviceInfo,
      requestUserAgent: context.userAgent,
      strictMode: this.authConfig.isSessionBindingStrict,
    });

    return {
      shouldReject: this.authConfig.isSessionBindingStrict && (ipMismatch || deviceMismatch),
    };
  }

  async handleGraceWindowReuse(
    session: SessionRecord,
    context: SessionRequestContext,
    nowIso: string,
    payload: RefreshTokenPayload,
  ): Promise<boolean> {
    const isWithinGraceWindow = this.isRefreshTokenWithinGraceWindow(session.lastUsedAt, nowIso);
    const isSameContext = this.isSameSessionContext(session, context);

    if (!isWithinGraceWindow || !isSameContext) {
      return false;
    }

    const nextReuseCount = await this.sessionService.incrementReuseCount(session.sessionId);
    if (nextReuseCount > 1) {
      this.logger.warn({
        event: 'auth_refresh_reuse_grace_window_abuse_detected',
        userId: payload.sub,
        jti: payload.jti,
        sessionId: session.sessionId,
        reuseCount: nextReuseCount,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      await this.sessionService.revokeAllActiveSessions(payload.sub);
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been revoked',
      );
    }

    this.logger.warn({
      event: 'auth_refresh_reuse_within_grace_window',
      userId: payload.sub,
      jti: payload.jti,
      sessionId: session.sessionId,
      reuseCount: nextReuseCount,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return true;
  }
}
