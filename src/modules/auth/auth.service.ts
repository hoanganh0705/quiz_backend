import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { userSessions, users } from '../../core/database/schema';
import { RegisterDto } from './dto/request/register.dto';
import { createHash } from 'crypto';
import { LoginDto } from './dto/request/login.dto';

export type RegisterResult = {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  accessToken: string;
  refreshToken: string;
};

export type LoginResult = {
  userId: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};

type AuthIdentity = {
  userId: string;
  username: string;
  email: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type RefreshTokenPayload = {
  sub: string;
  type?: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  static readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  static readonly REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  private getAccessTokenSecret(): string {
    return process.env.JWT_ACCESS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'access-dev-secret';
  }

  private getRefreshTokenSecret(): string {
    return process.env.JWT_REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'refresh-dev-secret';
  }

  private async issueTokens(identity: AuthIdentity): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: identity.userId,
        username: identity.username,
        email: identity.email,
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: AuthService.ACCESS_TOKEN_EXPIRES_IN,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: identity.userId,
        type: 'refresh',
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: AuthService.REFRESH_TOKEN_EXPIRES_IN,
      },
    );

    return { accessToken, refreshToken };
  }

  private async createUserSession(userId: string, refreshToken: string): Promise<void> {
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + AuthService.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    ).toISOString();

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
      throw new UnauthorizedException('Refresh session not found or expired');
    }

    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.userId, existingSession.userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const identity: AuthIdentity = {
      userId: user.userId,
      username: user.username,
      email: user.email,
    };
    const tokens = await this.issueTokens(identity);
    const nextRefreshTokenHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + AuthService.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    ).toISOString();

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
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), sql`lower(${users.email}) = ${normalizedEmail}`))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (!foundUser) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const identity: AuthIdentity = {
      userId: foundUser.userId,
      username: foundUser.username,
      email: foundUser.email,
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
        createdAt: users.createdAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    const identity: AuthIdentity = {
      userId: createdUser.userId,
      username: createdUser.username,
      email: createdUser.email,
    };
    const tokens = await this.issueTokens(identity);
    await this.createUserSession(identity.userId, tokens.refreshToken);

    return {
      ...createdUser,
      ...tokens,
    };
  }
}
