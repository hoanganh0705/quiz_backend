import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { userSessions, users } from '../../core/database/schema';
import { RegisterDto } from './dto/request/register.dto';
import { LoginDto } from './dto/request/login.dto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  AccessTokenPayload,
  AuthIdentity,
  AuthTokens,
  LoginResult,
  RefreshTokenPayload,
  RefreshTokenResult,
  RegisterResult,
  SessionRequestContext,
} from './types/auth.types';
import { AuthConfig } from './auth.config';
import { CryptoService } from '../../common/service/crypto.service';

const USER_IDENTITY_COLUMNS = {
  userId: users.userId,
  username: users.username,
  email: users.email,
  role: users.role,
};

const SESSION_LOOKUP_COLUMNS = {
  sessionId: userSessions.sessionId,
  jti: userSessions.jti,
  userId: userSessions.userId,
  refreshTokenHash: userSessions.refreshTokenHash,
  reuseCount: userSessions.reuseCount,
  ipAddress: userSessions.ipAddress,
  deviceInfo: userSessions.deviceInfo,
  lastUsedAt: userSessions.lastUsedAt,
  revokedAt: userSessions.revokedAt,
  expiresAt: userSessions.expiresAt,
};

type RateLimitBucket = 'login_ip' | 'login_user' | 'refresh_ip' | 'refresh_user';

@Injectable()
export class AuthService {
  private readonly rateLimitStore = new Map<string, { count: number; resetAtMs: number }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly authConfig: AuthConfig,
    private readonly jwtService: JwtService,
    private readonly cryptoService: CryptoService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
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

  private enforceRateLimit(bucket: RateLimitBucket, key: string): void {
    const nowMs = Date.now();
    const { limit, windowMs } = this.getRateLimitConfig(bucket);
    const rateKey = `${bucket}:${key}`;

    const currentState = this.rateLimitStore.get(rateKey);
    if (!currentState || currentState.resetAtMs <= nowMs) {
      this.rateLimitStore.set(rateKey, {
        count: 1,
        resetAtMs: nowMs + windowMs,
      });
      return;
    }

    if (currentState.count >= limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.rateLimitStore.set(rateKey, {
      count: currentState.count + 1,
      resetAtMs: currentState.resetAtMs,
    });
  }

  private getRefreshTokenExpiresAtIso(): string {
    return new Date(Date.now() + this.authConfig.refreshTokenCookieMaxAgeMs).toISOString();
  }

  private getNowIso(): string {
    return new Date().toISOString();
  }

  private isRefreshTokenWithinGraceWindow(lastUsedAt: string, nowIso: string): boolean {
    const lastUsedMs = Date.parse(lastUsedAt);
    const nowMs = Date.parse(nowIso);

    if (!Number.isFinite(lastUsedMs) || !Number.isFinite(nowMs)) {
      return false;
    }

    return nowMs - lastUsedMs <= this.authConfig.refreshReuseGraceWindowMs;
  }

  private isSameSessionContext(
    session: {
      ipAddress: string | null;
      deviceInfo: string | null;
    },
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

  private async findLatestActiveSessionByUserId(userId: string, nowIso: string) {
    const [latestSession] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, nowIso),
        ),
      )
      .orderBy(desc(userSessions.lastUsedAt), desc(userSessions.createdAt))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch latest active user session');
      });

    if (!latestSession) {
      return null;
    }

    return latestSession;
  }

  private evaluateSessionBinding(
    session: {
      ipAddress: string | null;
      deviceInfo: string | null;
      userId: string;
      jti: string;
    },
    context: SessionRequestContext,
  ): { ipMismatch: boolean; deviceMismatch: boolean; shouldReject: boolean } {
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
      return {
        ipMismatch: false,
        deviceMismatch: false,
        shouldReject: false,
      };
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

    const shouldReject = this.authConfig.isSessionBindingStrict && (ipMismatch || deviceMismatch);

    return {
      ipMismatch,
      deviceMismatch,
      shouldReject,
    };
  }

  private toAuthIdentity(user: {
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
  }): AuthIdentity {
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  private async issueTokens(identity: AuthIdentity): Promise<AuthTokens> {
    const refreshTokenJti = randomUUID();

    const accessTokenPayload: AccessTokenPayload = {
      sub: identity.userId,
      role: identity.role,
      iss: this.authConfig.accessTokenIssuer,
      aud: this.authConfig.accessTokenAudience,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.authConfig.accessTokenSecret,
      expiresIn: this.authConfig.accessTokenExpiresInSeconds,
    });

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: identity.userId,
      jti: refreshTokenJti,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.authConfig.refreshTokenSecret,
      expiresIn: this.authConfig.refreshTokenExpiresInSeconds,
    });

    return { accessToken, refreshToken, refreshTokenJti };
  }

  private isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Record<string, unknown>;
    return typeof candidate.sub === 'string' && typeof candidate.jti === 'string';
  }

  private async createUserSession(
    userId: string,
    refreshToken: string,
    jti: string,
    context: SessionRequestContext,
  ): Promise<void> {
    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();

    await this.db
      .insert(userSessions)
      .values({
        jti,
        userId,
        refreshTokenHash,
        reuseCount: 0,
        ipAddress: context.ipAddress,
        deviceInfo: context.userAgent,
        expiresAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user session');
      });

    await this.enforceActiveSessionLimit(userId);
  }

  private async revokeAllActiveSessions(userId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user sessions');
      });
  }

  private async enforceActiveSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.db
      .select({
        sessionId: userSessions.sessionId,
      })
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .orderBy(asc(userSessions.lastUsedAt), asc(userSessions.createdAt))
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch active sessions');
      });

    if (activeSessions.length <= this.authConfig.maxActiveSessionsPerUser) {
      return;
    }

    const sessionsToRevoke = activeSessions.slice(
      0,
      activeSessions.length - this.authConfig.maxActiveSessionsPerUser,
    );

    const nowIso = new Date().toISOString();
    for (const session of sessionsToRevoke) {
      await this.db
        .update(userSessions)
        .set({
          revokedAt: nowIso,
          lastUsedAt: nowIso,
        })
        .where(eq(userSessions.sessionId, session.sessionId))
        .catch(() => {
          throw new InternalServerErrorException('Failed to enforce active session limit');
        });
    }
  }

  async register(
    registerDto: RegisterDto,
    context: SessionRequestContext,
  ): Promise<RegisterResult> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const normalizedUsername = registerDto.username.trim().toLowerCase();

    const [existingUser] = await this.db
      .select({
        userId: users.userId,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(eq(users.email, normalizedEmail), eq(users.username, normalizedUsername)),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (existingUser) {
      this.logger.warn({
        event: 'auth_register_conflict',
        email: normalizedEmail,
      });
      throw new ConflictException('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const [createdUser] = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
      })
      .returning({
        userId: users.userId,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    const identity = this.toAuthIdentity(createdUser);
    const tokens = await this.issueTokens(identity);
    await this.createUserSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
    );

    return {
      ...createdUser,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, context: SessionRequestContext): Promise<LoginResult> {
    this.enforceRateLimit('login_ip', context.ipAddress ?? 'unknown');

    const normalizedEmail = loginDto.email.trim().toLowerCase();

    const [foundUser] = await this.db
      .select({
        ...USER_IDENTITY_COLUMNS,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, normalizedEmail)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (!foundUser) {
      this.logger.warn({ event: 'auth_login_user_not_found', email: normalizedEmail });
      throw new UnauthorizedException('Invalid email or password');
    }

    this.enforceRateLimit('login_user', foundUser.userId);

    const isPasswordValid = await bcrypt.compare(loginDto.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({ event: 'auth_login_invalid_password', userId: foundUser.userId });
      throw new UnauthorizedException('Invalid email or password');
    }

    const identity = this.toAuthIdentity(foundUser);
    const tokens = await this.issueTokens(identity);
    await this.createUserSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
    );

    return {
      ...identity,
      ...tokens,
    };
  }

  async refreshToken(
    refreshToken: string,
    context: SessionRequestContext,
  ): Promise<RefreshTokenResult> {
    let payload: RefreshTokenPayload;

    try {
      const decodedPayload: unknown = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.authConfig.refreshTokenSecret,
      });

      if (!this.isRefreshTokenPayload(decodedPayload)) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }

      payload = decodedPayload;
    } catch {
      this.logger.warn({ event: 'auth_refresh_token_invalid' });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    this.enforceRateLimit('refresh_ip', context.ipAddress ?? 'unknown');
    this.enforceRateLimit('refresh_user', payload.sub);

    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const nowIso = this.getNowIso();
    let hasHandledGraceReuse = false;

    let [existingSession] = await this.db
      .select(SESSION_LOOKUP_COLUMNS)
      .from(userSessions)
      .where(and(eq(userSessions.jti, payload.jti), eq(userSessions.userId, payload.sub)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user session');
      });

    if (!existingSession) {
      const latestSession = await this.findLatestActiveSessionByUserId(payload.sub, nowIso);

      if (
        latestSession &&
        (await this.handleGraceWindowReuse(latestSession, context, nowIso, payload))
      ) {
        existingSession = latestSession;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_session_missing',
          userId: payload.sub,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    if (existingSession.refreshTokenHash !== refreshTokenHash) {
      if (await this.handleGraceWindowReuse(existingSession, context, nowIso, payload)) {
        hasHandledGraceReuse = true;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_hash_mismatch',
          userId: payload.sub,
          sessionId: existingSession.sessionId,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    if (
      !hasHandledGraceReuse &&
      (existingSession.revokedAt !== null || existingSession.expiresAt <= nowIso)
    ) {
      if (await this.handleGraceWindowReuse(existingSession, context, nowIso, payload)) {
        hasHandledGraceReuse = true;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_invalid_session_state',
          userId: payload.sub,
          sessionId: existingSession.sessionId,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    const bindingEvaluation = this.evaluateSessionBinding(existingSession, context);
    if (bindingEvaluation.shouldReject) {
      this.logger.warn({
        event: 'auth_refresh_session_binding_rejected',
        userId: payload.sub,
        sessionId: existingSession.sessionId,
        jti: payload.jti,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedException('Session context mismatch');
    }

    const [user] = await this.db
      .select(USER_IDENTITY_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, existingSession.userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (!user) {
      this.logger.warn({
        event: 'auth_refresh_user_not_found',
        userId: existingSession.userId,
      });
      throw new UnauthorizedException('User not found');
    }

    const identity = this.toAuthIdentity(user);
    const tokens = await this.issueTokens(identity);
    const nextRefreshTokenHash = this.cryptoService.hashSha256(tokens.refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAtIso();

    await this.db
      .update(userSessions)
      .set({
        jti: tokens.refreshTokenJti,
        refreshTokenHash: nextRefreshTokenHash,
        reuseCount: 0,
        ipAddress: context.ipAddress,
        deviceInfo: context.userAgent,
        expiresAt,
        lastUsedAt: nowIso,
      })
      .where(eq(userSessions.sessionId, existingSession.sessionId))
      .catch(() => {
        throw new InternalServerErrorException('Failed to rotate user session');
      });

    return tokens;
  }

  private async revokeSessionByJti(jti: string): Promise<void> {
    const nowIso = this.getNowIso();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(and(eq(userSessions.jti, jti), isNull(userSessions.revokedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by jti');
      });
  }

  private async revokeSessionByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    const nowIso = this.getNowIso();

    await this.db
      .update(userSessions)
      .set({
        revokedAt: nowIso,
        lastUsedAt: nowIso,
      })
      .where(
        and(eq(userSessions.refreshTokenHash, refreshTokenHash), isNull(userSessions.revokedAt)),
      )
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke user session by token hash');
      });
  }

  private async incrementReuseCount(sessionId: string): Promise<number> {
    const [updatedSession] = await this.db
      .update(userSessions)
      .set({
        reuseCount: sql`${userSessions.reuseCount} + 1`,
      })
      .where(eq(userSessions.sessionId, sessionId))
      .returning({
        reuseCount: userSessions.reuseCount,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to update session reuse count');
      });

    if (!updatedSession) {
      throw new InternalServerErrorException('Failed to update session reuse count');
    }

    return updatedSession.reuseCount;
  }

  private async handleGraceWindowReuse(
    session: {
      sessionId: string;
      userId: string;
      jti: string;
      lastUsedAt: string;
      ipAddress: string | null;
      deviceInfo: string | null;
    },
    context: SessionRequestContext,
    nowIso: string,
    payload: RefreshTokenPayload,
  ): Promise<boolean> {
    const isWithinGraceWindow = this.isRefreshTokenWithinGraceWindow(session.lastUsedAt, nowIso);
    const isSameContext = this.isSameSessionContext(session, context);

    if (!isWithinGraceWindow || !isSameContext) {
      return false;
    }

    const nextReuseCount = await this.incrementReuseCount(session.sessionId);
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

      await this.revokeAllActiveSessions(payload.sub);
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

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.authConfig.refreshTokenSecret,
      });

      if (this.isRefreshTokenPayload(payload)) {
        await this.revokeSessionByJti(payload.jti);
        return;
      }
    } catch {
      this.logger.warn({ event: 'auth_logout_fallback_to_hash' });
    }

    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    await this.revokeSessionByRefreshTokenHash(refreshTokenHash);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllActiveSessions(userId);
  }
}
