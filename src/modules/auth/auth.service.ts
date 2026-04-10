import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { userSessions, users } from '../../core/database/schema';
import { RegisterDto } from './dto/request/register.dto';
import { createHash } from 'crypto';
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
} from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  private getAccessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
      })()
    );
  }

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_REFRESH_TOKEN_SECRET is not defined in environment variables');
      })()
    );
  }

  private getTokenExpiresInSeconds(configKey: string): number {
    const rawValue = this.configService.get<string>(configKey);
    if (!rawValue) {
      throw new Error(`${configKey} is not defined in environment variables`);
    }

    const trimmedValue = rawValue.trim().toLowerCase();
    const matchedValue = trimmedValue.match(/^(\d+)([smhd])?$/);
    if (!matchedValue) {
      throw new Error(
        `${configKey} has invalid format. Expected number or number with one of: s, m, h, d`,
      );
    }

    const amount = Number(matchedValue[1]);
    const unit = matchedValue[2] ?? 's';

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 60 * 60 * 24;
      default:
        throw new Error(`${configKey} has unsupported unit`);
    }
  }

  private getRefreshTokenCookieMaxAgeMs(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_COOKIE_MAX_AGE_MS');

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_COOKIE_MAX_AGE_MS must be a positive integer');
    }

    return rawValue;
  }

  private async issueTokens(identity: AuthIdentity): Promise<AuthTokens> {
    const accessTokenPayload: AccessTokenPayload = {
      sub: identity.userId,
      role: identity.role,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.getAccessTokenSecret(),
      expiresIn: this.getTokenExpiresInSeconds('ACCESS_TOKEN_EXPIRES_IN'),
    });

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: identity.userId,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.getTokenExpiresInSeconds('REFRESH_TOKEN_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  private async createUserSession(userId: string, refreshToken: string): Promise<void> {
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.getRefreshTokenCookieMaxAgeMs()).toISOString();

    await this.db
      .insert(userSessions)
      .values({
        userId,
        refreshTokenHash,
        expiresAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user session');
      });
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const nowIso = new Date().toISOString();

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
        throw new InternalServerErrorException('Failed to revoke user session');
      });
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResult> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      this.logger.warn({ event: 'auth_refresh_token_invalid' });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const nowIso = new Date().toISOString();

    const [existingSession] = await this.db
      .select({
        sessionId: userSessions.sessionId,
        userId: userSessions.userId,
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.refreshTokenHash, refreshTokenHash),
          eq(userSessions.userId, payload.sub),
          gt(userSessions.expiresAt, nowIso),
          isNull(userSessions.revokedAt),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user session');
      });

    if (!existingSession) {
      this.logger.warn({ event: 'auth_refresh_session_not_found', userId: payload.sub });
      throw new UnauthorizedException('Refresh session not found or expired');
    }

    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        role: users.role,
      })
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

    const identity: AuthIdentity = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.issueTokens(identity);
    const nextRefreshTokenHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.getRefreshTokenCookieMaxAgeMs()).toISOString();

    await this.db
      .update(userSessions)
      .set({
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt,
        lastUsedAt: nowIso,
      })
      .where(eq(userSessions.sessionId, existingSession.sessionId))
      .catch(() => {
        throw new InternalServerErrorException('Failed to rotate user session');
      });

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    const [foundUser] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        role: users.role,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), sql`lower(${users.email}) = ${normalizedEmail}`))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (!foundUser) {
      this.logger.warn({ event: 'auth_login_user_not_found', email: normalizedEmail });
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({ event: 'auth_login_invalid_password', userId: foundUser.userId });
      throw new UnauthorizedException('Invalid email or password');
    }

    const identity: AuthIdentity = {
      userId: foundUser.userId,
      username: foundUser.username,
      email: foundUser.email,
      role: foundUser.role,
    };
    const tokens = await this.issueTokens(identity);
    await this.createUserSession(identity.userId, tokens.refreshToken);

    return {
      ...identity,
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
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
          or(
            sql`lower(${users.email}) = ${normalizedEmail}`,
            sql`lower(${users.username}) = lower(${normalizedUsername})`,
          ),
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

    const identity: AuthIdentity = {
      userId: createdUser.userId,
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
    };
    const tokens = await this.issueTokens(identity);
    await this.createUserSession(identity.userId, tokens.refreshToken);

    return {
      ...createdUser,
      ...tokens,
    };
  }
}
