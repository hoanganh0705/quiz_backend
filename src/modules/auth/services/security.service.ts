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
    session: {
      deviceBrowser: string | null;
      deviceType: string;
    },
    context: SessionRequestContext,
  ): boolean {
    const hasSessionBrowser =
      typeof session.deviceBrowser === 'string' && session.deviceBrowser.length > 0;
    const hasContextBrowser =
      typeof context.deviceBrowser === 'string' && context.deviceBrowser.length > 0;
    const hasSessionDeviceType =
      typeof session.deviceType === 'string' && session.deviceType.length > 0;
    const hasContextDeviceType =
      typeof context.deviceType === 'string' && context.deviceType.length > 0;

    const canCompareBrowser = hasSessionBrowser && hasContextBrowser;
    const canCompareDeviceType = hasSessionDeviceType && hasContextDeviceType;

    const browserMatches = !canCompareBrowser || session.deviceBrowser === context.deviceBrowser;
    const deviceTypeMatches = !canCompareDeviceType || session.deviceType === context.deviceType;

    return browserMatches && deviceTypeMatches;
  }

  evaluateSessionBinding(
    session: {
      ipAddress: string | null;
      deviceBrowser: string | null;
      deviceOs: string | null;
      deviceType: string;
      userId: string;
      jti: string;
    },
    context: SessionRequestContext,
  ): { shouldReject: boolean } {
    const hasSessionIp = !!session.ipAddress;
    const hasRequestIp = !!context.ipAddress;
    const hasSessionDeviceBrowser = !!session.deviceBrowser;
    const hasRequestDeviceBrowser = !!context.deviceBrowser;
    const hasSessionDeviceType = !!session.deviceType;
    const hasRequestDeviceType = !!context.deviceType;

    const canCompareIp = hasSessionIp && hasRequestIp;
    const ipChanged = canCompareIp && session.ipAddress !== context.ipAddress;
    const deviceBrowserMismatch = hasSessionDeviceBrowser
      ? !hasRequestDeviceBrowser || session.deviceBrowser !== context.deviceBrowser
      : false;
    const deviceTypeMismatch = hasSessionDeviceType
      ? !hasRequestDeviceType || session.deviceType !== context.deviceType
      : false;
    const deviceMismatch = deviceBrowserMismatch || deviceTypeMismatch;

    if (!ipChanged && !deviceMismatch) {
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
      storedDeviceBrowser: session.deviceBrowser,
      requestDeviceBrowser: context.deviceBrowser,
      storedDeviceOs: session.deviceOs,
      requestDeviceOs: context.deviceOs,
      storedDeviceType: session.deviceType,
      requestDeviceType: context.deviceType,
      ipChanged,
      deviceMismatch,
      strictMode: this.authConfig.isSessionBindingStrict,
    });

    return {
      shouldReject: this.authConfig.isSessionBindingStrict && deviceMismatch,
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

    const reuseCounterKey = `auth:refresh_reuse:${payload.jti}`;
    const nextReuseCount = await this.redisService.incrementCounterWithInitialTtlSeconds(
      reuseCounterKey,
      this.authConfig.refreshTokenExpiresInSeconds,
    );

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
